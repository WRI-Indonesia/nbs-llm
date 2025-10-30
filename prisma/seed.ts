import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { SAMPLE_NODES } from './sample-node.ts'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // --- DB prerequisites (Postgres + pgvector) ------------------------------
console.log('🧩 Ensuring pgvector + similarity functions...');

// 0) extension (safe to re-run)
await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);

// Ensure required base tables exist for first-time setup (minimal subset)
// 1) minio_docs
await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "minio_docs" (
  id SERIAL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding vector(3072),
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now(),
  "fileName" TEXT DEFAULT '' ,
  "answerRelevance" DOUBLE PRECISION,
  "averageScore" DOUBLE PRECISION,
  "contextPrecision" DOUBLE PRECISION,
  "contextRecall" DOUBLE PRECISION,
  faithfulness DOUBLE PRECISION
);
`);

// 1) Ensure mem_semantic table exists (3072-d; no vector index due to 2000-d limit)
await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "mem_semantic" (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(3072) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);
`);

await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS mem_semantic_project_idx ON "mem_semantic" (project_id);
`);

// Optional: if you later switch to 1536-d embeddings, you may enable HNSW.
// Make sure pgvector >= 0.5.0 and embeddings are 1536-d.
/*
await prisma.$executeRawUnsafe(\`
CREATE INDEX IF NOT EXISTS mem_semantic_embedding_hnsw_idx
ON "mem_semantic" USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 200);
\`);
*/


// Ensure node_docs table exists (minimal schema for first-time DBs)
await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "node_docs" (
  id SERIAL PRIMARY KEY,
  "nodeId" TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding vector(3072),
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);
`);


// Function for minio_docs
await prisma.$executeRawUnsafe(`
CREATE OR REPLACE FUNCTION public.match_minio_docs(
  query_embedding_str TEXT,
  top_k INT,
  similarity_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id INT,
  file_name TEXT,
  document_text TEXT,
  similarity FLOAT
)
LANGUAGE sql
AS $$
  SELECT
    md.id,
    md."fileName"::TEXT AS file_name,
    md.text::TEXT AS document_text,
    1 - (md.embedding <=> query_embedding_str::vector(3072)) AS similarity
  FROM "minio_docs" md
  WHERE md.embedding IS NOT NULL
    AND (1 - (md.embedding <=> query_embedding_str::vector(3072))) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT top_k;
$$;
`);

// ---------- hybrid search functions ----------
await prisma.$executeRawUnsafe(`
-- Add full-text search vectors for hybrid search (BM25 + Vector)
-- This migration adds text_search_vector columns and hybrid search functions

-- Step 1: Add text_search_vector columns
ALTER TABLE "minio_docs" ADD COLUMN IF NOT EXISTS text_search_vector tsvector;
`);

await prisma.$executeRawUnsafe(`
  ALTER TABLE "node_docs" ADD COLUMN IF NOT EXISTS text_search_vector tsvector;
`);

// ---------- hybrid search functions ----------
await prisma.$executeRawUnsafe(`
  -- Step 2: Create GIN indexes for full-text search performance
  CREATE INDEX IF NOT EXISTS minio_docs_text_search_idx ON "minio_docs" USING gin(text_search_vector);
`);

await prisma.$executeRawUnsafe(`
  CREATE INDEX IF NOT EXISTS node_docs_text_search_idx ON "node_docs" USING gin(text_search_vector);
`);

await prisma.$executeRawUnsafe(`
  -- Step 3: Populate text_search_vector for existing rows
  UPDATE "minio_docs" 
  SET text_search_vector = to_tsvector('english', COALESCE(text, '')) 
  WHERE text_search_vector IS NULL;
`);

await prisma.$executeRawUnsafe(`
  UPDATE "node_docs" 
  SET text_search_vector = to_tsvector('english', COALESCE(text, '')) 
  WHERE text_search_vector IS NULL;
`);

await prisma.$executeRawUnsafe(`
   -- Step 4: Create trigger function for auto-updating text_search_vector
  CREATE OR REPLACE FUNCTION update_text_search_vector() RETURNS TRIGGER AS $$
  BEGIN
    NEW.text_search_vector := to_tsvector('english', COALESCE(NEW.text, ''));
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`);

await prisma.$executeRawUnsafe(`
   -- Step 5: Create triggers for automatic text_search_vector updates
  DROP TRIGGER IF EXISTS minio_docs_text_search_update ON "minio_docs";
`);

await prisma.$executeRawUnsafe(`
  CREATE TRIGGER minio_docs_text_search_update 
    BEFORE INSERT OR UPDATE ON "minio_docs"
    FOR EACH ROW 
    EXECUTE FUNCTION update_text_search_vector();
`);

await prisma.$executeRawUnsafe(`
  DROP TRIGGER IF EXISTS node_docs_text_search_update ON "node_docs";
`);

await prisma.$executeRawUnsafe(`
  CREATE TRIGGER node_docs_text_search_update 
    BEFORE INSERT OR UPDATE ON "node_docs"
    FOR EACH ROW 
    EXECUTE FUNCTION update_text_search_vector();
`);

// ---------- hybrid search functions ----------
await prisma.$executeRawUnsafe(`
-- Step 6: Create hybrid search function for minio_docs
-- Combines vector similarity (cosine) with keyword search (BM25-like using ts_rank)
CREATE OR REPLACE FUNCTION public.match_minio_docs_hybrid(
  query_text TEXT,
  query_embedding_str TEXT,
  top_k INT,
  similarity_threshold FLOAT DEFAULT 0.0,
  alpha FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id INT,
  file_name TEXT,
  document_text TEXT,
  similarity FLOAT,
  vector_score FLOAT,
  keyword_score FLOAT
)
LANGUAGE sql
AS $$
  WITH vector_results AS (
    SELECT
      md.id,
      md."fileName"::TEXT AS file_name,
      md.text::TEXT AS document_text,
      1 - (md.embedding <=> query_embedding_str::vector(3072)) AS vector_sim
    FROM "minio_docs" md
    WHERE md.embedding IS NOT NULL
      AND (1 - (md.embedding <=> query_embedding_str::vector(3072))) >= similarity_threshold
    ORDER BY md.embedding <=> query_embedding_str::vector(3072)
    LIMIT top_k * 2
  ),
  -- Get keyword search results using PostgreSQL full-text search
  keyword_results AS (
    SELECT
      md.id,
      md."fileName"::TEXT AS file_name,
      md.text::TEXT AS document_text,
      COALESCE(ts_rank_cd(md.text_search_vector, plainto_tsquery('english', query_text)), 0) AS keyword_rank
    FROM "minio_docs" md
    WHERE md.text_search_vector IS NOT NULL
      AND md.text_search_vector @@ plainto_tsquery('english', query_text)
    ORDER BY keyword_rank DESC
    LIMIT top_k * 2
  ),
  -- Combine results from both searches
  combined_results AS (
    SELECT DISTINCT
      COALESCE(v.id, k.id) AS id,
      COALESCE(v.file_name, k.file_name) AS file_name,
      COALESCE(v.document_text, k.document_text) AS document_text,
      COALESCE(v.vector_sim, 0) AS vector_score,
      COALESCE(k.keyword_rank, 0) AS keyword_score
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.id = k.id
  ),
  -- Calculate max scores for normalization
  max_scores AS (
    SELECT
      COALESCE(MAX(cr.vector_score), 0) AS max_vector,
      COALESCE(MAX(cr.keyword_score), 0) AS max_keyword
    FROM combined_results cr
  ),
  -- Normalize scores to 0-1 range
  normalized_results AS (
    SELECT
      c.id,
      c.file_name,
      c.document_text,
      c.vector_score,
      c.keyword_score,
      CASE 
        WHEN m.max_vector > 0 THEN c.vector_score / m.max_vector
        ELSE 0
      END AS normalized_vector_score,
      CASE 
        WHEN m.max_keyword > 0 THEN c.keyword_score / m.max_keyword
        ELSE 0
      END AS normalized_keyword_score
    FROM combined_results c
    CROSS JOIN max_scores m
  )
  -- Calculate hybrid scores and return top_k results
  SELECT
    n.id,
    n.file_name,
    n.document_text,
    (alpha * n.normalized_vector_score + (1 - alpha) * n.normalized_keyword_score) AS similarity,
    n.vector_score,
    n.normalized_keyword_score AS keyword_score
  FROM normalized_results n
  WHERE (alpha * n.normalized_vector_score + (1 - alpha) * n.normalized_keyword_score) > 0
  ORDER BY (alpha * n.normalized_vector_score + (1 - alpha) * n.normalized_keyword_score) DESC
  LIMIT top_k;
$$;
`);

// ---------- hybrid search functions ----------
await prisma.$executeRawUnsafe(`
  -- Step 7: Create hybrid search function for node_docs
  CREATE OR REPLACE FUNCTION public.match_node_docs_hybrid(
    query_text TEXT,
    query_embedding_str TEXT,
    top_k INT,
    similarity_threshold FLOAT DEFAULT 0.0,
    node_id_filter TEXT DEFAULT NULL,
    alpha FLOAT DEFAULT 0.7
  )
  RETURNS TABLE (
    id INT,
    node_id TEXT,
    document_text TEXT,
    similarity FLOAT,
    vector_score FLOAT,
    keyword_score FLOAT
  )
  LANGUAGE sql
  AS $$
    WITH vector_results AS (
      SELECT
        nd.id,
        nd."nodeId"::TEXT AS node_id,
        nd.text::TEXT AS document_text,
        1 - (nd.embedding <=> query_embedding_str::vector(3072)) AS vector_sim
      FROM "node_docs" nd
      WHERE nd.embedding IS NOT NULL
        AND (node_id_filter IS NULL OR nd."nodeId" = node_id_filter)
        AND (1 - (nd.embedding <=> query_embedding_str::vector(3072))) >= similarity_threshold
      ORDER BY nd.embedding <=> query_embedding_str::vector(3072)
      LIMIT top_k * 2
    ),
    keyword_results AS (
      SELECT
        nd.id,
        nd."nodeId"::TEXT AS node_id,
        nd.text::TEXT AS document_text,
        COALESCE(ts_rank_cd(nd.text_search_vector, plainto_tsquery('english', query_text)), 0) AS keyword_rank
      FROM "node_docs" nd
      WHERE nd.text_search_vector IS NOT NULL
        AND (node_id_filter IS NULL OR nd."nodeId" = node_id_filter)
        AND nd.text_search_vector @@ plainto_tsquery('english', query_text)
      ORDER BY keyword_rank DESC
      LIMIT top_k * 2
    ),
    combined_results AS (
      SELECT DISTINCT
        COALESCE(v.id, k.id) AS id,
        COALESCE(v.node_id, k.node_id) AS node_id,
        COALESCE(v.document_text, k.document_text) AS document_text,
        COALESCE(v.vector_sim, 0) AS vector_score,
        COALESCE(k.keyword_rank, 0) AS keyword_score
      FROM vector_results v
      FULL OUTER JOIN keyword_results k ON v.id = k.id
    ),
    max_scores AS (
      SELECT
        COALESCE(MAX(cr.vector_score), 0) AS max_vector,
        COALESCE(MAX(cr.keyword_score), 0) AS max_keyword
      FROM combined_results cr
    ),
    normalized_results AS (
      SELECT
        c.id,
        c.node_id,
        c.document_text,
        c.vector_score,
        c.keyword_score,
        CASE 
          WHEN m.max_vector > 0 THEN c.vector_score / m.max_vector
          ELSE 0
        END AS normalized_vector_score,
        CASE 
          WHEN m.max_keyword > 0 THEN c.keyword_score / m.max_keyword
          ELSE 0
        END AS normalized_keyword_score
      FROM combined_results c
      CROSS JOIN max_scores m
    )
    SELECT
      n.id,
      n.node_id,
      n.document_text,
      (alpha * n.normalized_vector_score + (1 - alpha) * n.normalized_keyword_score) AS similarity,
      n.vector_score,
      n.normalized_keyword_score AS keyword_score
    FROM normalized_results n
    WHERE (alpha * n.normalized_vector_score + (1 - alpha) * n.normalized_keyword_score) > 0
    ORDER BY (alpha * n.normalized_vector_score + (1 - alpha) * n.normalized_keyword_score) DESC
    LIMIT top_k;
  $$;
`);


// ---------- node_docs ----------
await prisma.$executeRawUnsafe(`
ALTER TABLE "node_docs"
ALTER COLUMN embedding TYPE vector(3072) USING embedding::vector(3072);
`);

// Function for node_docs
await prisma.$executeRawUnsafe(`
  CREATE OR REPLACE FUNCTION public.match_node_docs(
    query_embedding_str TEXT,
    top_k INT,
    similarity_threshold FLOAT DEFAULT 0.0,
    node_id_filter TEXT DEFAULT NULL
  )
  RETURNS TABLE (
    id INT,
    node_id TEXT,
    document_text TEXT,
    similarity FLOAT
  )
  LANGUAGE sql
  AS $$
    WITH q AS (
      SELECT query_embedding_str::vector(3072) AS qv
    )
    SELECT
      nd.id,
      nd."nodeId"::TEXT AS node_id,
      nd.text::TEXT AS document_text,
      1 - (nd.embedding <=> q.qv) AS similarity
    FROM "node_docs" nd, q
    WHERE nd.embedding IS NOT NULL
      AND (node_id_filter IS NULL OR nd."nodeId" = node_id_filter)
      AND (1 - (nd.embedding <=> q.qv)) >= similarity_threshold
    ORDER BY nd.embedding <=> q.qv
    LIMIT top_k;
  $$;
  `)

  // --- Your existing seed logic -------------------------------------------
  console.log('🗑️  Resetting existing data...')
  await prisma.flowEdge.deleteMany()
  await prisma.flowNode.deleteMany()
  await prisma.flowProject.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  console.log('👤 Creating admin user...')
  const hashedPassword = await bcrypt.hash('admin123', 12)
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      emailVerified: new Date(),
      password: hashedPassword,
      role: 'ADMIN',
    }
  })

  console.log('⚙️  Creating default config for admin user...')
  await prisma.config.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      chunkSize: 1000,
      overlap: 200,
      topK: 10,
      minCos: 0.2,
    } as any,
  })

  console.log('📊 Creating default flow project...')
  const flowProject = await prisma.flowProject.create({
    data: {
      id: 'DEFAULT',
      name: 'Main Project',
      description: 'Main knowledge flow project with sample data',
    }
  })

  console.log('🔗 Creating sample flow node...')
  for (const node of SAMPLE_NODES) {
    const sampleNode = await prisma.flowNode.create({
      data: {
        projectId: flowProject.id,
        nodeId: node.id,
        type: node.type as string,
        position: node.position,
        data: node.data as any
      }
    })
    console.log(`Created sample node: ${sampleNode.nodeId}`)
  }

  console.log('✅ Seed completed successfully!')
  console.log(`   - Created admin user: ${adminUser.email}`)
  console.log(`   - Admin password: admin123`)
  console.log(`   - Created project: ${flowProject.name}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
