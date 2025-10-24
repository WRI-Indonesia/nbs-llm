# 🚀 Quick Start Guide

## What's New?

Your system now has a **Hybrid Knowledge Base** that combines:
- 📚 **Research Papers** from MinIO (WRI's peer-reviewed journals)
- 📊 **Database Data** from PostgreSQL (your factual datasets)
- 🧠 **AI Synthesis** that combines both sources intelligently

---

## Step-by-Step Setup

### 1️⃣ Verify MinIO Connection

Test that you can connect to the WRI MinIO bucket:

```bash
npx tsx src/scripts/test-minio-connection.ts
```

**Expected Output:**
```
✅ Connection successful!
   Found 250 papers

📄 First 5 papers:
1. Smith_2020_Deforestation_Indonesia.pdf
2. Jones_2021_Palm_Oil_Kalimantan.pdf
...
```

### 2️⃣ Import Papers (Start Small)

Import your first batch of papers:

```bash
# Option 1: Interactive script (recommended)
./scripts/import-papers-quick.sh

# Option 2: Command line (import 10 papers)
IMPORT_LIMIT=10 npx tsx src/scripts/import-papers.ts
```

**What happens:**
1. Downloads PDFs from MinIO
2. Extracts text content
3. Chunks into semantic segments
4. Generates embeddings
5. Stores in PostgreSQL

**Time:** ~3-5 minutes for 10 papers

### 3️⃣ Test a Query

Try different query types:

#### Conceptual Query (Papers Only)
```bash
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main drivers of deforestation in Indonesia?",
    "projectId": "your_project_id",
    "min_cosine": 0.7,
    "top_k": 5
  }'
```

**Response:** Synthesis from research papers with citations

#### Factual Query (Data Only)
```bash
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How many hectares of forest in Nunukan?",
    "projectId": "your_project_id"
  }'
```

**Response:** SQL query + data results

#### Hybrid Query (Papers + Data)
```bash
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What does research say about deforestation in East Kalimantan, and what are the actual numbers?",
    "projectId": "your_project_id"
  }'
```

**Response:** Scientific context + empirical data combined

### 4️⃣ Monitor Performance

Check cache statistics:

```bash
curl http://localhost:3000/api/cache?action=stats
```

**Expected:**
```json
{
  "stats": {
    "hits": 15,
    "misses": 8,
    "hitRate": 65.2
  },
  "size": 23,
  "health": true
}
```

---

## Query Examples

### Example 1: Research Question
**Query:** "What methods are used to measure forest carbon stocks?"

**System Action:**
- Classifies as conceptual → searches papers only
- Retrieves relevant paper chunks about carbon measurement methods
- Synthesizes answer with citations

**Response:**
```
"Forest carbon stock measurement typically employs allometric equations 
combined with field plot sampling (Smith et al., 2020). Remote sensing 
techniques using LiDAR are increasingly used for landscape-scale 
assessments (Jones & Lee, 2021)..."
```

### Example 2: Data Question
**Query:** "Show me deforestation rate by district in East Kalimantan"

**System Action:**
- Classifies as factual → searches schema only
- Generates SQL query
- Executes and returns results

**Response:**
```json
{
  "sqlQuery": "SELECT district, deforestation_rate FROM forestry_data WHERE province = 'East Kalimantan'",
  "data": [
    {"district": "Nunukan", "deforestation_rate": 2.3},
    {"district": "Berau", "deforestation_rate": 1.8}
  ]
}
```

### Example 3: Hybrid Question
**Query:** "What does research say about REDD+ effectiveness, and what carbon data do we have for Kalimantan?"

**System Action:**
- Classifies as hybrid → searches both sources
- Retrieves papers about REDD+ effectiveness
- Generates SQL for carbon data in Kalimantan
- Synthesizes comprehensive answer

**Response:**
```
"Research shows REDD+ programs can reduce deforestation by 30-50% when 
properly implemented (Doe et al., 2022). In East Kalimantan, our data 
indicates carbon stocks of 120.5 tC/ha in protected areas versus 85.2 
tC/ha in production forests, supporting findings that conservation 
interventions preserve significant carbon..."
```

---

## Configuration

### Adjust Retrieval Sensitivity

Edit query parameters:

```javascript
{
  "query": "your question",
  "min_cosine": 0.7,  // Higher = stricter (0.5-0.9)
  "top_k": 5,         // Number of results (1-20)
  "projectId": "..."
}
```

**Guidelines:**
- `min_cosine: 0.8-0.9` → Very strict (exact matches only)
- `min_cosine: 0.7` → Default (balanced)
- `min_cosine: 0.5-0.6` → Broader (more results, may be less relevant)

### Cache Management

```bash
# View cache stats
curl http://localhost:3000/api/cache?action=stats

# Clear entire cache
curl -X DELETE http://localhost:3000/api/cache

# Clear specific pattern
curl -X POST http://localhost:3000/api/cache \
  -H "Content-Type: application/json" \
  -d '{"action": "invalidate", "pattern": "sql-gen*"}'
```

---

## Uploading New Papers

### Via API

```bash
curl -X POST http://localhost:3000/api/knowledge/upload \
  -F "file=@my_research_paper.pdf" \
  -F "title=Deforestation Study" \
  -F "authors=Jane Doe, John Smith" \
  -F "year=2024" \
  -F "projectId=your_project_id"
```

### Via Script

Add PDFs to MinIO, then re-run import:
```bash
IMPORT_LIMIT=5 npx tsx src/scripts/import-papers.ts
```

---

## Troubleshooting

### "No papers found"

**Check:**
1. MinIO connection: `npx tsx src/scripts/test-minio-connection.ts`
2. Database: `SELECT COUNT(*) FROM rag_docs WHERE source='paper'`
3. Credentials in `.env.local`

### "Low relevance scores"

**Try:**
1. Lower `min_cosine` to `0.5`
2. Increase `top_k` to `10`
3. Rephrase query with keywords from paper abstracts

### "Papers not used in synthesis"

**Verify:**
1. Query classification: Check `queryIntent` in response
2. Paper embeddings exist: `SELECT * FROM rag_docs WHERE source='paper' AND embedding IS NULL`
3. Try explicit conceptual query: "What does research say about..."

---

## Architecture Summary

```
┌──────────────┐
│  USER QUERY  │
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│ Query Classifier    │  ← Determines: Papers? Data? Both?
└──────┬──────────────┘
       │
       ├─────────────┬─────────────┐
       ▼             ▼             ▼
   Papers       Schema         Both
   (MinIO)      (DB)        (Parallel)
       │             │             │
       └─────────────┴─────────────┘
                     │
                     ▼
            ┌────────────────┐
            │ Synthesis      │  ← Combines sources
            │ Agent          │     with citations
            └────────┬───────┘
                     │
                     ▼
              FINAL ANSWER
```

---

## Next Steps

1. ✅ Test MinIO connection
2. ✅ Import 10-25 papers
3. ✅ Test conceptual query
4. ✅ Test factual query
5. ✅ Test hybrid query
6. ✅ Monitor cache performance
7. 📈 Import more papers (100+)
8. 🎯 Fine-tune thresholds based on results

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/minio-client.ts` | MinIO connection & paper downloads |
| `src/lib/pdf-processor.ts` | PDF text extraction & chunking |
| `src/scripts/import-papers.ts` | Bulk import script |
| `src/app/api/ai/search/route.ts` | Enhanced search with synthesis |
| `src/app/api/knowledge/upload/route.ts` | Dynamic paper uploads |
| `KNOWLEDGE_BASE_SETUP.md` | Detailed documentation |
| `IMPLEMENTATION_COMPLETE.md` | Technical summary |

---

## Support

**Documentation:**
- `KNOWLEDGE_BASE_SETUP.md` - Complete setup guide
- `IMPLEMENTATION_COMPLETE.md` - Technical details
- `QUICK_START.md` - This file

**Test Scripts:**
- `src/scripts/test-minio-connection.ts` - Test MinIO
- `scripts/import-papers-quick.sh` - Interactive import

**Need Help?**
1. Check logs for errors
2. Verify environment variables
3. Test MinIO connection
4. Review query response `queryIntent` field

---

**Status:** ✅ Ready for Production  
**Version:** 1.0.0  
**Date:** October 24, 2025

