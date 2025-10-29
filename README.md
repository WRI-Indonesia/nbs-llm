# NBS LLM - Nature-Based Solutions Language Learning Model

NBS LLM enables users to explore Nature-Based Solutions datasets using natural-language chat, optional shapefile-defined project areas, and automated SQL generation with contextual document retrieval.

## Overview

The system allows two approaches for defining project area context:

| Context Source | Behavior |
|----------------|----------|
| **User uploads a shapefile** | System automatically extracts covered districts/provinces and scopes results to those boundaries. |
| **User does not upload a shapefile** | User must specify location in the query (district or province). |

If **no shapefile is uploaded** and the **query does not include a location**, the system will request the user to either:
- Upload a shapefile, or
- Mention location explicitly in the question

This ensures responses always remain spatially meaningful.

## Key Features

### AI-Powered Chat Interface
Ask questions in natural language:
- “What is the population in Kabupaten Bogor?”
- “Show me deforestation rate in my project location.”

### Optional Shapefile Upload
Uploading a shapefile provides enhanced functionality:
- Automatic extraction of districts and provinces
- Interactive map visualization of your project boundary
- Automatic scoping of all subsequent queries

Supported formats:
- ZIP containing `.shp`, `.shx`, `.dbf`
- GeoJSON ZIP
- Multi-layer shapefile ZIP

### Location-Aware Query Handling

| Scenario | Result |
|---------|--------|
| Shapefile uploaded | Location context automatically applied |
| No shapefile + query contains location | Query runs normally |
| No shapefile + no location in query | System asks to upload shapefile or specify location |

### Automated SQL Generation
The system converts natural language into optimized PostgreSQL queries using database schema context.

### RAG (Retrieval-Augmented Generation)
Relevant documents and schema context are retrieved automatically and included in final responses.

## Multi-Agent Architecture

Below is how each agent operates, including purpose, inputs/outputs, and decision rules.

### 1) Reprompt Query Agent
- **Model:** GPT-4o-mini
- **Purpose:** Clean and normalize the user’s question; enforce location context (district/province) and expand macro-regions (e.g., “Java” → DKI Jakarta, Banten, Jawa Barat, etc.).
- **Inputs:**
  - Raw user query text
  - Project area metadata (districts/provinces) if a shapefile was uploaded
- **Processing & Rules:**
  - Fixes typos and clarifies intent.
  - Normalizes Indonesian location names (Kab/Kota).
  - If a shapefile is **not** uploaded, checks whether the query **mentions a district/province**; if neither is present, returns **`false`** to trigger a UI prompt asking the user to **upload a shapefile or include a location**.
- **Outputs:**
  - A normalized query string suitable for embedding/SQL steps **or** `false` when location requirements are not met.
- **Edge Cases & Safeguards:**
  - Handles macro-regions and ambiguous place names by expanding/normalizing to districts/provinces.
  - If location terms conflict with shapefile scope, the shapefile scope takes precedence.

### 2) Embedding Agent
- **Model:** text-embedding-3-large (3072-dim vectors)
- **Purpose:** Convert the normalized query into a semantic vector for similarity search across:
  - Database schema node documents (to guide SQL generation)
  - MinIO content documents (to enrich final answers via RAG)
- **Inputs:** Normalized query string from the Reprompt Query Agent.
- **Processing & Rules:**
  - Generates a 3072-dimension embedding used with cosine similarity.
  - Default retrieval parameters: `top_k = 5`, `min_cosine = 0.2` (configurable).
- **Outputs:** JSON-serializable embedding vector (3072 dims).
- **Edge Cases & Safeguards:**
  - If query is location-incoherent (missed upstream), retrieval may yield low similarity; system checks thresholds before proceeding.

### 3) SQL Generation Agent
- **Model:** GPT-4o
- **Purpose:** Translate natural language into optimized PostgreSQL SQL using schema documents; handle JOINs, filters, aggregations, and use `ILIKE` for case-insensitive text matching.
- **Inputs:**
  - Normalized query
  - Relevant schema documents (retrieved via embeddings from node docs)
- **Execution Gate:**
  - **Only runs if** `relevantNodeDocs.length > 0`. If no relevant schema is found, system skips SQL creation and relies on RAG or asks for clarification.
- **Processing & Rules:**
  - Generates syntactically valid SQL tailored to project schema and scoped to project area.
  - Optimizes JOINs and WHERE clauses with project-level access control.
- **Outputs:** PostgreSQL SQL string.
- **Edge Cases & Safeguards:**
  - Uses conservative filters if schema context is limited.
  - Handles SQL execution errors gracefully and reports back to user.

### 4) Summarization Agent
- **Model:** SeaLLM
- **Purpose:** Produce a conversational, context-rich answer by synthesizing:
  - SQL query results
  - RAG document snippets (MinIO + schema notes)
- **Inputs:**
  - Normalized user query
  - SQL results (if any)
  - RAG context documents
- **Processing & Rules:**
  - Merges structured SQL data with contextual text to produce a friendly, complete answer.
  - References location context from shapefile or user query.
- **Outputs:** Final natural-language answer.
- **Edge Cases & Safeguards:**
  - If SQL unavailable but RAG data exists, still generates answer from documents.
  - If both are missing, prompts user to clarify or add context.

### Retrieval & Execution Flow
1. **User Query & Auth check** → saved to chat history.
2. **Reprompt Agent** → normalize + enforce location; may return `false` prompting upload or location mention.
3. **Embedding Agent** → generates semantic vector.
4. **RAG Retrieval** → retrieves schema + content documents (`top_k=5`, `min_cosine=0.2`).
5. **SQL Generation Agent** → runs if schema docs available.
6. **SQL Execution** → executes with project scoping.
7. **Summarization Agent** → merges SQL + RAG data into conversational answer.
8. **Persist** → stores conversation, SQL, RAG docs, and response.

## Shapefile Workflow (Optional but Recommended)

1. Navigate to `/chat-map`
2. Upload shapefile ZIP
3. System extracts geography
4. Map displays project boundary
5. All future queries automatically scoped

## Usage Examples

| Query Example | System Behavior |
|--------------|----------------|
| “What is average rainfall?” | System requests shapefile upload or location mention |
| “What is average rainfall in Bali?” | Query executes |
| Upload shapefile → “What is average rainfall?” | Query executes using shapefile boundary |

## Installation & Setup

```bash
npm install
```

Create `.env.local` and configure environment variables for:
- Database
- OpenAI
- Google OAuth
- MinIO
- Redis

Initialize the database:

```bash
npx prisma db push
npx prisma db seed
psql -d nbs_llm -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Start development server:

```bash
npm run dev
```

Start background worker (optional):

```bash
npm run worker
```

## Project Structure

```
src/
├── app/
│   ├── api/ai/search/
│   ├── chat-map/
│   └── knowledge/
├── components/
├── lib/
└── workers/
```

## Technical Stack

| Component | Technology |
|----------|------------|
| Frontend | Next.js, React, OpenLayers, React Flow |
| Backend | Node.js, Prisma, PostgreSQL, pgvector |
| AI | GPT-4o, GPT-4o-mini, text-embedding-3-large, SeaLLM |
| Storage & Queue | MinIO, Redis (BullMQ) |

## License
Internal project — All rights reserved.
