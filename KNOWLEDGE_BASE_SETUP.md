# Knowledge Base Setup Guide

This guide explains how to set up and use the integrated knowledge base system that combines peer-reviewed research papers from MinIO with factual data from your PostgreSQL database.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER QUERY                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 1: Query Classification                       │
│  • Analyzes intent (conceptual vs factual)                      │
│  • Determines if papers, data, or both are needed               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│          PHASE 2: Parallel Multi-Source Retrieval                │
│  ┌─────────────────┐           ┌──────────────────┐            │
│  │  Research Papers│           │  Database Schema │            │
│  │  (from MinIO)   │           │  (RAG Docs)      │            │
│  │  Vector Search  │           │  Vector Search   │            │
│  └─────────────────┘           └──────────────────┘            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│             PHASE 3: SQL Generation & Execution                  │
│  • Generates SQL from schema context                            │
│  • Executes query on appropriate database                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 4: Synthesis Agent                            │
│  • Combines scientific knowledge from papers                     │
│  • Integrates empirical data from database                      │
│  • Generates comprehensive, evidence-based answer               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                   FINAL ANSWER
```

## Environment Setup

### 1. Add MinIO Credentials

Add these environment variables to your `.env` or `.env.local`:

```bash
# MinIO Configuration for WRI Knowledge Base
MINIO_ENDPOINT=https://s3.wri-indonesia.id
MINIO_REGION=ap-southeast-1
MINIO_ACCESS_KEY=deddysetiawan
MINIO_SECRET_KEY="vXNF9{:01]Sw"
MINIO_BUCKET=etl-kms
MINIO_PAPERS_PATH=open_alex/gold_papers/

# OpenAI (already configured)
OPENAI_API_KEY=your_key_here

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# Database (already configured)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 2. Install Dependencies

The required packages have already been installed:
- `minio` - MinIO client for accessing papers
- `pdf-parse` - PDF text extraction

### 3. Run Database Migration

The schema has been updated with:
- `source` field (default: "schema") - Distinguishes between schema docs and papers
- `payload` field (JSON) - Stores flexible metadata for papers

Migration already applied via `npx prisma db push`.

## Importing Papers from MinIO

### Bulk Import

Import all papers from the WRI MinIO bucket:

```bash
# Import all papers
npx tsx src/scripts/import-papers.ts

# Import with limit (e.g., first 10 papers for testing)
IMPORT_LIMIT=10 npx tsx src/scripts/import-papers.ts
```

The import script will:
1. Connect to MinIO at `etl-kms/open_alex/gold_papers/`
2. Download each PDF paper
3. Extract text content
4. Chunk text into semantic segments (~800 tokens each)
5. Generate embeddings using OpenAI `text-embedding-3-large`
6. Store in PostgreSQL with metadata (title, authors, year, section)

**Expected Output:**
```
🚀 Starting paper import from MinIO...
📍 Source: etl-kms/open_alex/gold_papers/
📚 Found 250 papers, processing 250

[1/250] Processing: Smith_2020_Deforestation_Indonesia.pdf
📄 Extracted 12 pages, 45,231 characters
✂️  Created 38 chunks from 156 paragraphs
🧮 Generating embeddings for 38 chunks...
✅ Processed batch 1/2
✅ Processed batch 2/2
💾 Stored 38 chunks in database
✅ Imported 38 chunks from Smith_2020_Deforestation_Indonesia.pdf

...

========================================================
📊 Import Summary
========================================================
Total papers: 250
✅ Successfully imported: 245
⏭️  Skipped: 0
❌ Failed: 5
📝 Total chunks created: 9,842
========================================================
```

### Dynamic Upload (via API)

Users can also upload papers directly through the API:

```bash
curl -X POST http://localhost:3000/api/knowledge/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@research_paper.pdf" \
  -F "title=Deforestation in Borneo" \
  -F "authors=John Doe, Jane Smith" \
  -F "year=2023" \
  -F "projectId=your_project_id"
```

**Response:**
```json
{
  "success": true,
  "message": "Paper uploaded and indexed successfully",
  "fileName": "research_paper.pdf",
  "chunks": 42,
  "nodeId": "paper-node-upload-1729789234567",
  "projectId": "clx123abc"
}
```

## Using the Knowledge Base

### Query Examples

#### 1. Conceptual Query (Papers Only)
```
Query: "What are the main drivers of deforestation in Indonesia?"

Response:
- Searches papers only
- Returns synthesis from relevant research
- Cites papers: "According to [Smith et al., 2020]..."
```

#### 2. Factual Query (Data Only)
```
Query: "How many hectares of forest were lost in Nunukan in 2022?"

Response:
- Searches schema docs only
- Generates SQL query
- Returns data results
```

#### 3. Hybrid Query (Papers + Data)
```
Query: "What does research say about deforestation rates in East Kalimantan, 
and what are the actual numbers for Nunukan?"

Response:
- Searches both papers and schema
- Combines scientific context with empirical data
- Provides comprehensive answer like:
  "Research indicates that deforestation in East Kalimantan is driven by 
   oil palm expansion and illegal logging (Smith et al., 2020). In Nunukan 
   specifically, data shows 1,234 hectares were lost in 2022, with 67% 
   attributed to agricultural conversion..."
```

### API Response Structure

```typescript
{
  "success": true,
  "query": "your question",
  "sqlQuery": "SELECT * FROM ...", // If data query
  "answer": "Comprehensive synthesized answer...",
  "data": [...], // If data query
  "papers": [ // If papers found
    {
      "title": "Paper title",
      "authors": "Author names",
      "year": 2020,
      "section": "Introduction",
      "similarity": 0.87
    }
  ],
  "queryIntent": {
    "needsPapers": true,
    "needsData": true,
    "isConceptual": false,
    "keywords": ["deforestation", "rate"]
  },
  "searchStats": {
    "totalDocumentsFound": 5,
    "totalPapersFound": 3,
    "minCosineThreshold": 0.7,
    "topK": 5
  }
}
```

## Monitoring & Management

### View Imported Papers

```bash
curl http://localhost:3000/api/knowledge/upload \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Cache Statistics

```bash
curl http://localhost:3000/api/cache?action=stats
```

### Clear Cache (if needed)

```bash
curl -X DELETE http://localhost:3000/api/cache
```

## Performance Optimization

### Caching
- All LLM calls are cached using Redis
- 24-hour TTL by default
- Significant cost savings for repeated queries

### Embeddings
- Papers are chunked intelligently by section
- ~800 tokens per chunk (optimal for retrieval)
- 100-token overlap between chunks for context

### Retrieval
- Papers use slightly lower similarity threshold (0.56) vs schemas (0.7)
- Top-K limited to 5 for optimal synthesis
- Parallel retrieval from both sources

## Troubleshooting

### Papers Not Showing Up

1. Check if papers were imported:
```sql
SELECT COUNT(*), source FROM rag_docs GROUP BY source;
```

Expected: At least one row with `source = 'paper'`

2. Check embedding quality:
```sql
SELECT * FROM rag_docs WHERE source = 'paper' AND embedding IS NULL;
```

Should return 0 rows.

### MinIO Connection Issues

Test connection manually:
```typescript
import { listPapers } from './src/lib/minio-client'
const papers = await listPapers()
console.log(papers)
```

### Low Relevance Scores

- Adjust `min_cosine` threshold in query (default 0.7)
- Check query phrasing - use keywords from paper abstracts
- Verify embedding model matches (`text-embedding-3-large`)

## Advanced: Custom Metadata

Papers support flexible metadata in the `payload` field:

```typescript
{
  "fileName": "paper.pdf",
  "title": "Paper Title",
  "authors": "Authors",
  "year": 2023,
  "doi": "10.1234/example",
  "journal": "Nature",
  "abstract": "Full abstract...",
  "keywords": ["forest", "carbon"],
  "section": "Methods",
  "chunkIndex": 5,
  "tokenCount": 782
}
```

This allows for:
- Filtering by year, journal, or keywords
- Citation formatting
- Advanced search capabilities

## Next Steps

1. **Import papers**: Run the bulk import script
2. **Test queries**: Try conceptual, factual, and hybrid queries
3. **Monitor performance**: Check cache hit rates
4. **Enrich knowledge base**: Upload additional papers as needed
5. **Fine-tune retrieval**: Adjust thresholds based on results

For questions or issues, check the logs or create an issue in the repository.

