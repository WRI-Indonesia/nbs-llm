# NBS LLM - Nature-Based Solutions Language Learning Model

This is a [Next.js](https://nextjs.org) project that provides an AI-powered chat interface for querying Nature-Based Solutions data with integrated mapping capabilities.

## Features

- 🤖 AI-powered chat interface for data queries
- 🗺️ Interactive map visualization with shapefile support
- 📊 SQL query generation and execution
- 🔍 RAG (Retrieval-Augmented Generation) for context-aware responses
- 🎯 Cohere Rerank integration for improved relevance
- 📈 Data visualization and analysis tools
- 🔐 Authentication with Google OAuth

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- OpenAI API key
- Google OAuth credentials
- (Optional) Cohere API key for advanced document reranking

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory and add the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/nbs_llm"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"
OPENAI_EMBEDDING="text-embedding-3-large"

# Cohere (Optional - for advanced reranking)
COHERE_API_KEY="your-cohere-api-key"
```

### 3. Database Setup

Set up your PostgreSQL database and run the Prisma migrations:

```bash
# Push the database schema to your database
npx prisma db push

# Seed the database with initial data
npx prisma db seed
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

- `src/app/` - Next.js app router pages and API routes
- `src/app/chat-map/` - Chat interface with map integration
- `src/app/knowledge/` - Knowledge management interface
- `src/components/` - Reusable UI components
- `src/lib/` - Utility functions and configurations
- `prisma/` - Database schema and migrations

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma studio` - Open Prisma Studio for database management

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Prisma Documentation](https://www.prisma.io/docs) - database toolkit and ORM
- [OpenLayers](https://openlayers.org/) - mapping library
- [NextAuth.js](https://next-auth.js.org/) - authentication for Next.js

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
