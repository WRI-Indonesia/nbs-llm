import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Create or replace the match_minio_docs function for vector similarity search
 */
export async function createMatchMinioDocsFunction() {
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
`)
}

/**
 * Create or replace the match_minio_docs_hybrid function for hybrid search (BM25 + Vector)
 */
export async function createMatchMinioDocsHybridFunction() {
  await prisma.$executeRawUnsafe(`
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
`)
}

/**
 * Create or replace the match_node_docs_hybrid function for hybrid search (BM25 + Vector)
 */
export async function createMatchNodeDocsHybridFunction() {
  await prisma.$executeRawUnsafe(`
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
`)
}

/**
 * Create or replace the match_node_docs function for vector similarity search
 */
export async function createMatchNodeDocsFunction() {
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
}

