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

  // ---------- minio_docs ----------
  await prisma.$executeRawUnsafe(`
  ALTER TABLE "minio_docs"
  ALTER COLUMN embedding TYPE vector(3072) USING embedding::vector(3072);
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

  // ---------- node_docs ----------
  await prisma.$executeRawUnsafe(`
  ALTER TABLE "node_docs"
  ALTER COLUMN embedding TYPE vector(3072) USING embedding::vector(3072);
  `);

  /*
    Function for node_docs.
    - node_id_filter is optional (NULL searches all nodes).
  */
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
    SELECT
      nd.id,
      nd."nodeId"::TEXT AS node_id,
      nd.text::TEXT AS document_text,
      1 - (nd.embedding <=> query_embedding_str::vector(3072)) AS similarity
    FROM "node_docs" nd
    WHERE nd.embedding IS NOT NULL
      AND (node_id_filter IS NULL OR nd."nodeId" = node_id_filter)
      AND (1 - (nd.embedding <=> query_embedding_str::vector(3072))) >= similarity_threshold
    ORDER BY similarity DESC
    LIMIT top_k;
  $$;
  `);


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
