-- Add config JSON column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "config" JSONB;

-- Migrate existing config data from configs table to User.config
UPDATE "User"
SET "config" = jsonb_build_object(
  'chunkSize', c."chunkSize",
  'overlap', c."overlap",
  'topK', c."topK",
  'minCos', c."minCos",
  'cacheEnabled', true,
  'semanticTopK', 10,
  'cacheTtlSemretr', 1800,
  'useHybridSearch', true,
  'hybridMinCosine', 0.2,
  'hybridTopK', 5,
  'hybridAlpha', 0.7,
  'rerankEnabled', true,
  'rerankTopN', 20,
  'rerankModelName', 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  'repromptAgentModel', 'gpt-4o-mini',
  'sqlGeneratorAgentModel', 'gpt-4o',
  'embeddingAgentModel', 'text-embedding-3-large',
  'summarizationModelEndpoint', 'https://seallm.wri-indonesia.or.id/v1/chat/completions',
  'summarizationModel', 'SeaLLMs/SeaLLM-7B-v2.5'
)
FROM "configs" c
WHERE "User"."id" = c."userId";

-- Set default config for users without config
UPDATE "User"
SET "config" = jsonb_build_object(
  'chunkSize', 1000,
  'overlap', 200,
  'topK', 10,
  'minCos', 0.2,
  'cacheEnabled', true,
  'semanticTopK', 10,
  'cacheTtlSemretr', 1800,
  'useHybridSearch', true,
  'hybridMinCosine', 0.2,
  'hybridTopK', 5,
  'hybridAlpha', 0.7,
  'rerankEnabled', true,
  'rerankTopN', 20,
  'rerankModelName', 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  'repromptAgentModel', 'gpt-4o-mini',
  'sqlGeneratorAgentModel', 'gpt-4o',
  'embeddingAgentModel', 'text-embedding-3-large',
  'summarizationModelEndpoint', 'https://seallm.wri-indonesia.or.id/v1/chat/completions',
  'summarizationModel', 'SeaLLMs/SeaLLM-7B-v2.5'
)
WHERE "config" IS NULL;

-- Drop the unique index on configs.userId
DROP INDEX IF EXISTS "configs_userId_key";

-- Drop the configs table
DROP TABLE IF EXISTS "configs";

