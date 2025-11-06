# AI Search API Route

## Overview

The `/api/ai/search` route is a sophisticated RAG (Retrieval-Augmented Generation) pipeline that converts natural language queries into SQL queries, executes them, and generates human-readable answers. It combines multiple AI agents working together to provide intelligent database querying capabilities.

## Architecture

The route implements a multi-agent pipeline that processes user queries through several stages:

```
User Query
    ↓
[Embedding Agent] → Convert query to vector embedding
    ↓
[Semantic Reuse Check] → Check if similar query was cached
    ↓ (if not reused)
[Memory Agent] → Retrieve episodic & semantic memory
    ↓
[Document Retrieval] → Hybrid/Vector search for relevant documents
    ↓
[Rerank Agent] → Re-rank documents by relevance
    ↓
[SQL Generation Agent] → Generate SQL from query + context
    ↓
[SQL Execution] → Execute SQL query
    ↓
[Summarization Agent] → Generate natural language answer
    ↓
[Memory Write-Back] → Store results in semantic memory
    ↓
Response
```

## Request Format

### Endpoint
```
POST /api/ai/search
```

### Headers
- Authentication required (via `getCurrentUser()`)

### Request Body
```typescript
{
  query: string                    // Required: Natural language query
  projectId: string                 // Required: Project identifier
  min_cosine?: number              // Optional: Minimum cosine similarity (0-1, default: 0.2)
  top_k?: number                   // Optional: Number of documents to retrieve (1-20, default: 5)
  use_hybrid?: boolean             // Optional: Enable hybrid search (default: true)
  hybrid_alpha?: number            // Optional: Hybrid search alpha (0-1, default: 0.7)
  storeInDB?: boolean              // Optional: Store chat history (default: true)
  timestamp?: Date                 // Optional: Query timestamp
}
```

### Configuration Priority
Parameters are resolved in this order:
1. **Request parameter** (highest priority)
2. **User config** (from database)
3. **Environment variable** (fallback)

## Response Format

### Success Response
```typescript
{
  status: 'success'
  answer: string                    // Generated natural language answer
  tokenUsage: {
    embedding: TokenUsage
    sql: TokenUsage | null
    summarize: TokenUsage
    total: number
  }
  tokenCost: {
    embeddingUsd: number
    sqlUsd: number
    summarizeUsd: number
    totalUsd: number
  }
  // When storeInDB is false, includes:
  agentResults?: {
    embedding: {
      model: string
      usage: TokenUsage
    }
    episodicMemory: string[]
    semanticMemory: string[]
    nodeDocuments: NodeDocMatch[]
    minioDocuments: MinioDocMatch[]
    rerank: RerankResult[] | null
    sqlGeneration: {
      query: string
      usage: TokenUsage
    }
    sqlExecution: {
      data: any[]
      error?: string
    }
    summarization: {
      text: string
      usage: TokenUsage
    }
  }
}
```

### Error Response
```typescript
{
  status: 'error'
  message: string
  error?: string
}
```

## Agents

### 1. Embedding Agent
**Purpose**: Converts natural language queries into high-dimensional vector embeddings.

**Model**: `text-embedding-3-large` (3072 dimensions) by default

**Use Cases**:
- Semantic cache lookup (find similar past queries)
- Vector similarity search in PostgreSQL (pgvector)
- Retrieving relevant schema and MinIO documents

**Output**: Vector embedding array

---

### 2. Memory Agent

#### Episodic Memory
**Purpose**: Retrieves recent chat history to maintain conversational context.

**How it works**: Fetches the most recent N chat messages (user + assistant pairs) from `chat_history` table.

**Use Case**: Helps understand follow-up questions like "What about the previous district?"

#### Semantic Memory
**Purpose**: Retrieves semantically similar facts from past queries stored in `mem_semantic` table.

**How it works**:
1. Vector similarity search using cosine distance
2. Composite scoring (70% semantic similarity + 30% lexical Jaccard)
3. MMR (Maximal Marginal Relevance) filtering for diversity

**Use Case**: Reuses knowledge from past successful queries

#### Semantic Memory Write-Back
**Purpose**: Stores query-answer pairs as semantic memory for future retrieval.

**When**: Enabled via `MEM_SEMANTIC_WRITE_ENABLED` env var and `storeInDB` flag

#### Procedural Memory
**Purpose**: Logs execution flow and decisions for audit and optimization.

**When**: Enabled via `MEM_PROCEDURAL_ENABLED` env var and `storeInDB` flag

---

### 3. Document Retrieval

#### Hybrid Search (Default)
**Purpose**: Combines vector similarity with keyword search (BM25-like).

**How it works**: Uses PostgreSQL functions `match_node_docs_hybrid()` and `match_minio_docs_hybrid()`.

**Parameters**:
- `hybrid_alpha`: Weight between vector (0) and keyword (1) search (default: 0.7)

#### Pure Vector Search
**Purpose**: Fallback when hybrid search is disabled.

**How it works**: Uses PostgreSQL functions `match_node_docs()` and `match_minio_docs()`.

**Sources**:
- **Node Documents**: Schema information (tables, columns, types, relationships)
- **MinIO Documents**: Context documents stored in MinIO

---

### 4. Rerank Agent
**Purpose**: Re-ranks retrieved documents using cross-encoder models for better relevance.

**Model**: `cross-encoder/ms-marco-MiniLM-L-6-v2` by default (via HuggingFace)

**How it works**:
- Scores each query-document pair using cross-encoder
- Sorts by relevance score
- Selects top-N documents

**When**: Enabled via `RERANK_ENABLED` env var or user config

**Benefits**: Improves SQL generation accuracy by prioritizing most relevant schema information

---

### 5. SQL Generation Agent
**Purpose**: Converts natural language queries into executable SQL queries.

**Model**: `gpt-4o` by default

**Input**:
- User's natural language query
- Relevant schema documents (from retrieval + rerank)
- Memory context (episodic + semantic snippets)
- Constraints and task hints

**Output**: Raw SQL query (PostgreSQL-compliant)

**Features**:
- Handles JOINs, aggregations, filters
- Uses COALESCE for NULLs
- Uses ILIKE for case-insensitive text search
- Generates clean SQL without markdown

---

### 6. SQL Execution
**Purpose**: Executes the generated SQL query against the project's database.

**Caching**: Results are cached for 30 minutes using SQL query hash as key.

**Error Handling**: If execution fails, falls back to RAG-based answer generation.

---

### 7. Summarization Agent
**Purpose**: Generates natural language answers from SQL results and context.

**Model**: `SeaLLM` by default (configurable)

**Input**:
- User's original query
- SQL execution results (data rows)
- Context documents (MinIO docs + semantic + episodic memory)

**Output**: Conversational answer in user's language (auto-detects Indonesian/English)

**Features**:
- Domain-specific (Nature-Based Solutions)
- Concise and friendly
- Language consistency

---

## Key Features

### 1. Semantic Reuse
If a similar query was asked recently (cosine similarity ≥ 0.93), the system returns the cached answer without running the full pipeline.

### 2. Hybrid Search
Combines vector similarity with keyword search for better document retrieval.

### 3. Multi-Memory System
- **Episodic**: Recent conversation context
- **Semantic**: Learned facts from past queries
- **Procedural**: Execution logs for analysis

### 4. Intelligent Caching
- Embeddings: 30 days
- SQL generation: 12 hours
- SQL results: 30 minutes
- Document retrieval: 30 minutes
- Rerank results: 20 minutes

### 5. Graceful Error Handling
- SQL execution failures fall back to RAG-based answers
- Missing API tokens don't break the flow (agents skip gracefully)
- Comprehensive error messages

### 6. Cost Tracking
Tracks token usage and costs for:
- Embedding generation
- SQL generation
- Summarization

## Environment Variables

### Search Configuration
- `HYBRID_MIN_COSINE`: Minimum cosine similarity threshold (default: 0.2)
- `HYBRID_TOP_K`: Number of documents to retrieve (default: 5)
- `USE_HYBRID_SEARCH`: Enable hybrid search (default: 'true')
- `HYBRID_ALPHA`: Hybrid search alpha parameter (default: 0.7)

### Memory Configuration
- `MEM_SEMANTIC_WRITE_ENABLED`: Enable semantic memory write-back (default: 'true')
- `MEM_EPISODIC_ENABLED`: Enable episodic memory retrieval (default: 'true')
- `MEM_PROCEDURAL_ENABLED`: Enable procedural memory logging (default: 'true')
- `EPISODIC_TOPK`: Number of episodic memory snippets (default: 6)
- `SEMANTIC_REUSE_SIM`: Similarity threshold for semantic reuse (default: 0.93)

### Agent Configuration
- `EMBEDDING_AGENT_MODEL`: Embedding model name (default: 'text-embedding-3-large')
- `SQL_GENERATOR_AGENT_MODEL`: SQL generation model (default: 'gpt-4o')
- `SUMMARIZATION_MODEL`: Summarization model (default: 'SeaLLM')
- `SUMMARIZATION_MODEL_ENDPOINT`: Summarization endpoint URL
- `RERANK_ENABLED`: Enable reranking (default: 'true')
- `RERANK_MODEL_NAME`: Rerank model name (default: 'cross-encoder/ms-marco-MiniLM-L-6-v2')
- `RERANK_TOPN`: Number of documents to rerank (default: 20)
- `HF_API_TOKEN`: HuggingFace API token for reranking

### Cache Configuration
- `CACHE_TTL_RERANK`: Rerank cache TTL in seconds (default: 1200)

## Database Schema

The route interacts with several database tables:

- `chat_history`: Stores user queries and assistant responses
- `mem_semantic`: Stores semantic memory (facts/knowledge)
- `node_docs`: Schema documents with vector embeddings
- `minio_docs`: MinIO documents with vector embeddings
- `user`: User configuration and preferences

## Error Handling

### Authentication Errors
- Returns 401 if user is not authenticated

### Validation Errors
- Returns 400 for invalid parameters (missing query, invalid ranges, etc.)

### SQL Execution Errors
- Falls back to RAG-based answer generation
- Includes error message in response when `storeInDB` is false

### Agent Errors
- Agents fail gracefully (return default values or skip)
- Errors are logged but don't break the pipeline

## Performance Considerations

1. **Caching**: Extensive caching reduces redundant API calls
2. **Semantic Reuse**: Skips full pipeline for similar queries
3. **Parallel Processing**: Some operations can run in parallel
4. **Token Limits**: Inputs are truncated to avoid token overflow

## Example Usage

### Basic Query
```json
POST /api/ai/search
{
  "query": "Show me species data for Berau district",
  "projectId": "proj123"
}
```

### With Custom Parameters
```json
POST /api/ai/search
{
  "query": "Compare mammal species in Berau vs Nunukan",
  "projectId": "proj123",
  "min_cosine": 0.3,
  "top_k": 10,
  "use_hybrid": true,
  "hybrid_alpha": 0.8,
  "storeInDB": false
}
```

### Response (storeInDB: false)
```json
{
  "status": "success",
  "answer": "Kabupaten Berau memiliki keanekaragaman hayati yang cukup tinggi...",
  "tokenUsage": {
    "embedding": { "prompt": 13, "completion": 0, "total": 13, "source": "estimated" },
    "sql": { "prompt": 1250, "completion": 85, "total": 1335, "source": "measured" },
    "summarize": { "prompt": 1197, "completion": 173, "total": 1370, "source": "measured" },
    "total": 2718
  },
  "tokenCost": {
    "embeddingUsd": 0.00000169,
    "sqlUsd": 0.012,
    "summarizeUsd": 0.005,
    "totalUsd": 0.017
  },
  "agentResults": {
    "embedding": {
      "model": "text-embedding-3-large",
      "usage": { "prompt": 13, "completion": 0, "total": 13, "source": "estimated" }
    },
    "episodicMemory": ["user: Show me species in Berau", "assistant: ..."],
    "semanticMemory": ["Episode: Show species in Berau — ..."],
    "nodeDocuments": [...],
    "minioDocuments": [...],
    "rerank": [...],
    "sqlGeneration": {
      "query": "SELECT ...",
      "usage": { "prompt": 1250, "completion": 85, "total": 1335, "source": "measured" }
    },
    "sqlExecution": {
      "data": [{ "district_name": "Berau", "mammal_count": 150, ... }]
    },
    "summarization": {
      "text": "Kabupaten Berau memiliki...",
      "usage": { "prompt": 1197, "completion": 173, "total": 1370, "source": "measured" }
    }
  }
}
```

## File Structure

```
api/ai/search/
├── route.ts                    # Main API route handler
├── _agents/                    # AI agent implementations
│   ├── base-agent.ts          # Base class for all agents
│   ├── embedding-agent.ts     # Embedding generation
│   ├── memory-agent.ts        # Memory operations
│   ├── rerank-agent.ts        # Document reranking
│   ├── sql-generation-agent.ts # SQL generation
│   ├── summarization-agent.ts  # Answer generation
│   └── index.ts               # Agent exports
└── _utils/                    # Utility functions
    ├── cache.ts               # Caching utilities
    ├── chat-history-utils.ts  # Chat history management
    ├── pricing.ts             # Cost calculation
    ├── response-handler.ts     # Error response handling
    ├── sql-utils.ts           # SQL execution
    └── types.ts               # TypeScript type definitions
```

## Notes

- The route uses `force-dynamic` to ensure fresh data on each request
- All database operations use Prisma ORM
- Vector operations use PostgreSQL's pgvector extension
- The pipeline is designed to be fault-tolerant and continue even if some agents fail

