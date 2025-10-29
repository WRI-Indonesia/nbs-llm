# NBS LLM - Nature-Based Solutions Language Learning Model

This is a [Next.js](https://nextjs.org) project that provides an AI-powered chat interface for querying Nature-Based Solutions data with integrated mapping capabilities and a sophisticated multi-agent AI system.

## 🚀 Overview

NBS LLM is an intelligent data querying platform that combines natural language processing, geographic information systems, and advanced AI agents to help you explore and analyze Nature-Based Solutions data. The system uses a multi-agent architecture where specialized AI agents work together to understand, process, and answer your queries with unprecedented accuracy.

## ✨ Key Features

### 🤖 AI-Powered Chat Interface
Natural language interface for querying your data with intelligent conversation capabilities. Simply ask questions in plain English and get intelligent, context-aware responses.

### 🗺️ Interactive Maps & Shapefile Upload
- **Upload Shapefiles**: Upload ZIP files containing shapefiles (.shp, .shx, .dbf) to define your project area
- **Automatic District Extraction**: The system automatically extracts districts and provinces from your uploaded shapefile
- **Project Area Scoping**: Once uploaded, all queries are automatically scoped to your project area, allowing you to ask location-specific questions
- **Visual Mapping**: Visualize your project boundaries, spatial data, and query results on interactive OpenLayers maps
- **GeoJSON Support**: Full support for shapefiles and GeoJSON formats

### 📊 Automated SQL Generation
Generate SQL queries automatically from natural language. The SQL Generation Agent analyzes your database schema and creates optimized PostgreSQL queries with proper JOINs, filters, and aggregations.

### 🔍 RAG (Retrieval-Augmented Generation)
Retrieval-Augmented Generation for context-aware responses from your document repository. The system continuously retrieves relevant documents from both database schema nodes and MinIO storage to provide comprehensive, accurate answers.

### 📈 Knowledge Management
Build and manage your knowledge graph with React Flow visualizations:
- Visual schema design and management
- Table node creation and relationships
- Schema documentation and indexing
- MinIO document storage integration

### 🔐 Secure Authentication
Google OAuth authentication with secure data access controls, session management, and user-based access control.

## 🏗️ Multi-Agent Architecture

Our system uses a sophisticated multi-agent architecture with four specialized AI agents:

### 1. Reprompt Query Agent
- **Model**: GPT-4o-mini
- **Purpose**: Intelligently processes and normalizes user queries
- **Capabilities**:
  - Fixes typos and improves query clarity
  - Normalizes Indonesian location names (district/province)
  - Expands macro-regions (Java → DKI Jakarta, Banten, Jawa Barat, etc.)
  - Handles location parameters from uploaded shapefiles
  - Returns 'false' if query contains no location information
- **Inputs**: User query, District parameters (from shapefile)
- **Outputs**: Normalized query, Error flag if invalid

### 2. Embedding Agent
- **Model**: text-embedding-3-large
- **Purpose**: Generates high-dimensional semantic embeddings
- **Capabilities**:
  - Converts normalized queries into 3072-dimensional vectors
  - Enables semantic similarity search across document databases
  - Powers RAG document retrieval system
- **Inputs**: Normalized query string
- **Outputs**: 3072-dimensional embedding vector (JSON string)

### 3. SQL Generation Agent
- **Model**: GPT-4o
- **Purpose**: Transforms natural language into optimized PostgreSQL SQL
- **Capabilities**:
  - Analyzes relevant database schema documents
  - Generates precise SQL queries with proper syntax
  - Handles JOINs, filters, aggregations, and complex queries
  - Uses ILIKE for case-insensitive text matching
  - Only executes if relevant schema documents are found
- **Inputs**: Normalized query, Relevant schema documents
- **Outputs**: PostgreSQL SQL query

### 4. Summarization Agent
- **Model**: SeaLLM
- **Purpose**: Creates conversational, context-rich answers
- **Capabilities**:
  - Synthesizes SQL query results with RAG documents
  - Generates friendly, conversational responses
  - Combines data from multiple sources (SQL + MinIO documents)
  - Provides comprehensive, context-aware answers
- **Inputs**: User query, SQL result data, RAG context documents
- **Outputs**: Natural language answer

## 🔄 Complete Agent Workflow

The system processes queries through the following 8-step workflow:

### Step 1: User Query & Authentication
- User submits natural language query through chat interface
- System validates authentication and user session
- Saves user message to chat history
- **Inputs**: Query text, Project ID, Location parameters (from shapefile), Timestamp
- **Outputs**: Validated query, User session

### Step 2: Reprompt Query Agent
- Normalizes and improves the query
- Handles typos and location references
- Expands macro-regions to specific provinces
- Normalizes district names (Kab/Kota format)
- **Process**: GPT-4o-mini processes query, fixes typos, expands regions (Java → DKI Jakarta, Banten, etc.)

### Step 3: Generate Embedding
- Converts normalized query into semantic embedding vector
- **Process**: OpenAI text-embedding-3-large generates 3072-dim semantic vector
- **Inputs**: Normalized query string
- **Outputs**: 3072-dim embedding vector (JSON string)

### Step 4: RAG Document Retrieval
- Finds relevant documents using cosine similarity search
- Searches both database schema nodes and MinIO storage
- Uses configurable similarity thresholds (min_cosine, top_k)
- **Process**: PostgreSQL functions `match_node_docs()` and `match_minio_docs()` perform vector similarity search
- **Inputs**: Query embedding, top_k (default: 5), min_cosine (default: 0.2)
- **Outputs**: Relevant node documents, Relevant MinIO documents

### Step 5: SQL Generation Agent
- Generates PostgreSQL SQL query from natural language
- Uses relevant schema documents for context
- Creates optimized queries with proper syntax
- **Condition**: Only executes if `relevantNodeDocs.length > 0`
- **Process**: GPT-4o analyzes schema documents, generates optimized SQL
- **Inputs**: Normalized query, Relevant schema documents
- **Outputs**: PostgreSQL SQL query

### Step 6: SQL Execution
- Executes generated SQL query against project database
- Validates query and handles errors gracefully
- Executes with project-scoped access control
- **Process**: Validates and executes SQL, handles errors gracefully
- **Inputs**: SQL query, Project ID
- **Outputs**: Query result data (array), Execution error (if any)

### Step 7: Summarization Agent
- Generates final conversational answer
- Combines SQL results with RAG context documents
- Creates comprehensive, friendly response
- **Process**: SeaLLM synthesizes SQL results with RAG documents
- **Inputs**: Normalized query, SQL result data, MinIO document contexts
- **Outputs**: Natural language answer

### Step 8: Save & Return
- Persists complete conversation history
- Saves all metadata (SQL, RAG docs, data) to database
- Returns success response to user
- **Process**: Saves conversation with all metadata for history tracking
- **Inputs**: Assistant message, SQL query, RAG documents, Query results
- **Outputs**: Success response

### RAG Process Throughout Workflow

Throughout the workflow, the system performs continuous RAG retrieval:

1. **Step 4**: Uses query embedding to find relevant documents from:
   - Database schema nodes (via `match_node_docs()` function)
   - MinIO storage (via `match_minio_docs()` function)

2. **Step 5**: Schema documents (node docs) are used by SQL Generation Agent to understand table structure and relationships

3. **Step 7**: MinIO documents provide additional context to the Summarization Agent for generating comprehensive, context-aware answers

All retrieved documents are:
- Scored by cosine similarity (configurable `min_cosine` threshold, default: 0.2)
- Limited by `top_k` parameter (default: 5, max: 20)
- Used to enhance both SQL generation and answer summarization

## 🗺️ Shapefile Upload & Project Area

### How It Works

1. **Upload Shapefile**: Upload a ZIP file containing shapefile components (.shp, .shx, .dbf)
2. **Automatic Processing**: The system processes the shapefile and extracts geographic boundaries
3. **District Extraction**: Districts and provinces are automatically extracted from the shapefile geometry
4. **Map Visualization**: Your project area is displayed on the interactive map
5. **Location Scoping**: All subsequent queries are automatically scoped to your project area

### Using Project Area in Queries

Once you upload a shapefile:
- The system extracts districts and provinces from the shapefile
- These location parameters are automatically included in your queries
- You can ask questions like:
  - "What is the population in my project area?"
  - "Show me all conservation projects in my project location"
  - "What districts are covered by my shapefile?"
- The Reprompt Query Agent normalizes these locations and includes them in the query context

### Supported Formats

- **Shapefiles**: ZIP files containing .shp, .shx, and .dbf files
- **GeoJSON**: Direct GeoJSON upload (via ZIP)
- **Multiple Layers**: Support for multiple shapefiles in a single ZIP

## 🛠️ Prerequisites

- Node.js 18+ 
- PostgreSQL database (with pgvector extension for embeddings)
- OpenAI API key
- Google OAuth credentials
- MinIO instance (for document storage)
- Redis (for job queue management)

## 📦 Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/nbs_llm"
GEO_DATABASE_URL=""

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"
EMBEDDING_AGENT_MODEL="text-embedding-3-large"
SQL_GENERATOR_AGENT_MODEL="gpt-4o"
REPROMPT_AGENT_MODEL="gpt-4o-mini"

# Summarization (SeaLLM)
SUMMARIZATION_MODEL_ENDPOINT="your-sellm-endpoint"
SUMMARIZATION_MODEL="your-sellm-model"

# MinIO
MINIO_ENDPOINT="your-minio-endpoint"
MINIO_ACCESS_KEY="your-minio-access-key"
MINIO_SECRET_KEY="your-minio-secret-key"
MINIO_BUCKET="your-bucket-name"
MINIO_USE_SSL=false

# Redis (for BullMQ)
REDIS_HOST="localhost"
REDIS_PORT=6379
```

### 3. Database Setup

```bash
# Push the database schema to your database
npx prisma db push

# Seed the database with initial data
npx prisma db seed

# Verify pgvector extension is installed
psql -d nbs_llm -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### 5. Start Background Workers (Optional)

For document processing and indexing:

```bash
npm run worker
```

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── ai/
│   │       └── search/
│   │           ├── route.ts              # Main search API endpoint
│   │           └── _utils/
│   │               ├── generate-embedding-agent.ts
│   │               ├── generate-sql-agent.ts
│   │               ├── summarization-agent.ts
│   │               ├── reprompt-query-agent.ts
│   │               └── ...
│   ├── chat-map/                          # Chat interface with map
│   │   ├── _components/
│   │   ├── _contexts/
│   │   └── _utils/
│   │       └── shapefile-utils.ts         # Shapefile processing
│   └── knowledge/                         # Knowledge management
├── components/                            # Reusable UI components
├── lib/
│   ├── prisma.ts                          # Database client
│   ├── minio.ts                           # MinIO client
│   ├── queue.ts                           # BullMQ setup
│   └── geo-prisma.ts                      # Geographic database queries
└── workers/
    └── index-worker.ts                    # Background job processor
```

## 🎯 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run worker` - Start background worker for document processing
- `npx prisma studio` - Open Prisma Studio for database management
- `npx prisma db push` - Push schema changes to database
- `npx prisma db seed` - Seed database with initial data

## 🔧 Technical Stack

### AI & Machine Learning
- **OpenAI GPT-4o** - SQL generation
- **OpenAI GPT-4o-mini** - Query reprompting
- **OpenAI text-embedding-3-large** - Semantic embeddings (3072 dimensions)
- **SeaLLM** - Answer summarization
- **RAG (Retrieval-Augmented Generation)** - Context-aware responses
- **Semantic Search** - PostgreSQL pgvector for similarity search

### Infrastructure
- **Next.js 15** - React framework with App Router
- **PostgreSQL** - Primary database with Prisma ORM
- **pgvector** - Vector similarity search extension
- **MinIO** - Object storage for documents
- **BullMQ** - Job queue management
- **Redis** - Queue backend
- **NextAuth.js** - Authentication with Google OAuth

### Data Visualization
- **OpenLayers** - Interactive mapping library
- **React Flow** - Knowledge graph visualization
- **Shapefile Support** - Full shapefile parsing and display
- **GeoJSON** - Geographic data format support

### Security
- **NextAuth.js** - Secure session management
- **Google OAuth** - Authentication provider
- **Protected API Routes** - User-based access control
- **Project Scoping** - Data isolation per project

## 📖 Usage Guide

### 1. Upload Shapefile to Define Project Area

1. Navigate to the Chat Map interface (`/chat-map`)
2. Upload a ZIP file containing your shapefile (.shp, .shx, .dbf)
3. The system will:
   - Process and display your shapefile on the map
   - Extract districts and provinces automatically
   - Scope all queries to your project area

### 2. Ask Location-Aware Questions

Once your shapefile is uploaded, you can ask questions like:

- "What is the average rainfall in my project area?"
- "Show me all conservation projects in the districts covered by my shapefile"
- "What is the population density in my project location?"

The system automatically includes your project area districts in the query context.

### 3. Manage Knowledge Base

1. Navigate to Knowledge Management (`/knowledge`)
2. Create table nodes for your database schema
3. Upload documents to MinIO storage
4. Build relationships between tables
5. Index your documents for RAG retrieval

### 4. Chat with Your Data

1. Go to Chat Map interface (`/chat-map`)
2. Type your question in natural language
3. The multi-agent system processes your query:
   - Normalizes and improves your query
   - Generates embeddings for semantic search
   - Retrieves relevant documents
   - Generates and executes SQL
   - Creates a comprehensive answer
4. View results on the map and in the chat interface

## 🔍 How the Multi-Agent System Works

1. **User submits query** → Authenticated and saved to history
2. **Reprompt Agent** → Normalizes query, handles typos, expands locations
3. **Embedding Agent** → Converts query to semantic vector
4. **RAG Retrieval** → Finds relevant schema docs (for SQL) and content docs (for context)
5. **SQL Agent** → Generates optimized PostgreSQL query using schema context
6. **SQL Execution** → Runs query against database, returns results
7. **Summarization Agent** → Combines SQL results + RAG docs into natural answer
8. **Save & Return** → Persists conversation and returns response

Throughout this process, the system maintains context from:
- Your uploaded shapefile (project area)
- Relevant database schema documents
- Relevant content documents from MinIO
- Previous conversation history

## 🚢 Deployment

### Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme):

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Environment Variables for Production

Ensure all environment variables are set in your deployment platform:
- Database connection string
- OpenAI API keys
- Google OAuth credentials
- MinIO configuration
- Redis connection details

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
- [Prisma Documentation](https://www.prisma.io/docs) - Database toolkit and ORM
- [OpenLayers](https://openlayers.org/) - Mapping library
- [NextAuth.js](https://next-auth.js.org/) - Authentication for Next.js
- [PostgreSQL pgvector](https://github.com/pgvector/pgvector) - Vector similarity search
- [BullMQ](https://docs.bullmq.io/) - Job queue management

## 🤝 Contributing

This is an internal project for Nature-Based Solutions data analysis. For questions or issues, please contact the development team.

## 📄 License

Internal project - All rights reserved
