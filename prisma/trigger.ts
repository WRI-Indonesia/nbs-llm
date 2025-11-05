import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Add text_search_vector columns to tables for hybrid search
 */
export async function addTextSearchVectorColumns() {
  await prisma.$executeRawUnsafe(`
ALTER TABLE "minio_docs" ADD COLUMN IF NOT EXISTS text_search_vector tsvector;
`)

  await prisma.$executeRawUnsafe(`
ALTER TABLE "node_docs" ADD COLUMN IF NOT EXISTS text_search_vector tsvector;
`)
}

/**
 * Populate text_search_vector for existing rows
 */
export async function populateTextSearchVectors() {
  await prisma.$executeRawUnsafe(`
UPDATE "minio_docs" 
SET text_search_vector = to_tsvector('english', COALESCE(text, '')) 
WHERE text_search_vector IS NULL;
`)

  await prisma.$executeRawUnsafe(`
UPDATE "node_docs" 
SET text_search_vector = to_tsvector('english', COALESCE(text, '')) 
WHERE text_search_vector IS NULL;
`)
}

/**
 * Create trigger function for auto-updating text_search_vector
 */
export async function createUpdateTextSearchVectorFunction() {
  await prisma.$executeRawUnsafe(`
CREATE OR REPLACE FUNCTION update_text_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.text_search_vector := to_tsvector('english', COALESCE(NEW.text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`)
}

/**
 * Create triggers for automatic text_search_vector updates
 */
export async function createTextSearchTriggers() {
  // Drop existing triggers if they exist
  await prisma.$executeRawUnsafe(`
DROP TRIGGER IF EXISTS minio_docs_text_search_update ON "minio_docs";
`)

  await prisma.$executeRawUnsafe(`
DROP TRIGGER IF EXISTS node_docs_text_search_update ON "node_docs";
`)

  // Create triggers for minio_docs
  await prisma.$executeRawUnsafe(`
CREATE TRIGGER minio_docs_text_search_update 
  BEFORE INSERT OR UPDATE ON "minio_docs"
  FOR EACH ROW 
  EXECUTE FUNCTION update_text_search_vector();
`)

  // Create triggers for node_docs
  await prisma.$executeRawUnsafe(`
CREATE TRIGGER node_docs_text_search_update 
  BEFORE INSERT OR UPDATE ON "node_docs"
  FOR EACH ROW 
  EXECUTE FUNCTION update_text_search_vector();
`)
}

