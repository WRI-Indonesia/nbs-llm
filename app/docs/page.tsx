import Link from "next/link"
import { Home, Code2, Database, Layers, GitBranch, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Header from "@/components/Header"

export default function TechnicalDocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Introduction */}
        <section className="mb-16">
          <h2 className="text-4xl font-bold mb-6">Architecture Overview</h2>
          <p className="text-lg text-slate-600 mb-4">
            NBS LLM Schema Designer is a modern web application built with Next.js 15 and React 19, 
            leveraging the latest web technologies to provide a seamless database schema design experience with AI-powered assistance.
          </p>
          <p className="text-lg text-slate-600">
            The application follows a component-based architecture with strict TypeScript typing, 
            local-first data persistence, AI integration, and extensible design patterns.
          </p>
        </section>

        {/* Tech Stack */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
            <Layers className="h-8 w-8 text-blue-600" />
            Technology Stack
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Frontend Framework
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Next.js 15</h4>
                  <p className="text-sm text-slate-600">React framework with App Router, server components, and optimized bundling</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">React 19</h4>
                  <p className="text-sm text-slate-600">Latest React with improved hooks, concurrent features, and server actions</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">TypeScript 5</h4>
                  <p className="text-sm text-slate-600">Strong typing for improved developer experience and code quality</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database & ORM
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Prisma ORM</h4>
                  <p className="text-sm text-slate-600">Type-safe database client with schema migrations and intuitive API</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">PostgreSQL / MySQL / SQLite</h4>
                  <p className="text-sm text-slate-600">Support for multiple database providers via Prisma</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Local Storage</h4>
                  <p className="text-sm text-slate-600">Browser-based persistence for offline-first capabilities</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  UI Libraries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">ReactFlow (xyflow/react)</h4>
                  <p className="text-sm text-slate-600">Powerful library for building node-based editors and diagrams</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">shadcn/ui</h4>
                  <p className="text-sm text-slate-600">Beautifully designed, accessible component library built with Radix UI</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Tailwind CSS 4</h4>
                  <p className="text-sm text-slate-600">Utility-first CSS framework for rapid UI development</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5" />
                  Additional Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Dagre</h4>
                  <p className="text-sm text-slate-600">Graph layout library for automatic node positioning</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Lucide React</h4>
                  <p className="text-sm text-slate-600">Modern icon library with 1000+ beautiful icons</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Sonner</h4>
                  <p className="text-sm text-slate-600">Elegant toast notifications for user feedback</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Project Structure */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Project Structure</h2>
          
          <Card>
            <CardContent className="p-6">
              <pre className="text-sm bg-slate-900 text-slate-100 p-6 rounded-lg overflow-x-auto">
{`nbs-llm/
├── app/
│   ├── api/
│   │   ├── ai/                   # AI assistant API routes
│   │   │   ├── ask/              # SQL generation endpoint
│   │   │   ├── index/            # Schema indexing endpoint
│   │   │   └── chat/             # Chat history management
│   │   ├── auth/                 # Authentication routes
│   │   └── schemas/              # Schema CRUD operations
│   ├── docs/
│   │   └── page.tsx              # Technical documentation
│   ├── playground/
│   │   └── page.tsx              # Interactive schema designer
│   ├── layout.tsx                # Root layout with metadata
│   ├── page.tsx                  # Home page with guides
│   └── globals.css               # Global styles and theme
│
├── components/
│   ├── Flow.tsx                  # Main flow editor component
│   ├── SidebarChat.tsx           # AI chat assistant
│   ├── TableNode.tsx             # Custom table node component
│   ├── Header.tsx                # Navigation header
│   ├── AuthModals.tsx            # Authentication modals
│   └── ui/                       # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
│
├── lib/
│   ├── auth.ts                   # Authentication configuration
│   ├── prisma.ts                 # Prisma client singleton
│   ├── schema-storage.ts         # Storage abstraction layer
│   └── utils.ts                  # Utility functions
│
├── prisma/
│   ├── migrations/               # Database migrations
│   └── schema.prisma             # Database schema definition
│
├── types/
│   └── index.ts                  # Centralized TypeScript types
│
├── public/                       # Static assets
├── .env                          # Environment variables (git-ignored)
├── .env.example                  # Example environment config
├── package.json                  # Dependencies and scripts
└── tsconfig.json                 # TypeScript configuration`}
              </pre>
            </CardContent>
          </Card>
        </section>

        {/* Component Architecture */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Component Architecture</h2>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Flow.tsx - Main Editor</CardTitle>
                <CardDescription>The core component managing the schema visualization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Key Responsibilities:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>State management for nodes and edges</li>
                    <li>Integration with ReactFlow for rendering</li>
                    <li>Auto-layout using Dagre algorithm</li>
                    <li>Local storage persistence</li>
                    <li>Version history management</li>
                    <li>Foreign key relationship building</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Key Hooks:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">useNodesState</code> - Manages table nodes</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">useEdgesState</code> - Manages relationships</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">useCallback</code> - Optimized event handlers</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>TableNode.tsx - Table Visualization</CardTitle>
                <CardDescription>Custom ReactFlow node for displaying database tables</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Features:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>Visual column display with type indicators</li>
                    <li>Primary key (PK) and foreign key (FK) badges</li>
                    <li>Connection handles for relationship creation</li>
                    <li>Inline editing dialog</li>
                    <li>Column add/remove/edit operations</li>
                    <li>Duplicate name validation</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SidebarChat.tsx - AI Assistant</CardTitle>
                <CardDescription>Conversational interface for schema help</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Current Implementation:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>Local demo mode with simulated responses</li>
                    <li>Message history management</li>
                    <li>Keyboard shortcuts (Enter to send)</li>
                    <li>Auto-scroll to latest message</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Future Integration:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>Connect to OpenAI, Anthropic, or local LLM</li>
                    <li>Schema-aware context for better suggestions</li>
                    <li>SQL query generation and validation</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Type System */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Type System</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Core Types (/types/index.ts)</CardTitle>
              <CardDescription>Centralized type definitions for type safety</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
{`// Column definition
export type ColumnType = "text" | "number" | "boolean"

export type Column = {
  name: string
  type: ColumnType
  description?: string
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  references?: { table: string; column?: string }
}

// Table node data
export type TableNodeData = {
  schema?: string
  table: string
  description?: string
  columns: Column[]
  reservedTableNames?: string[]
  onEditColumns?: (nodeId: string, nextCols: Column[]) => void
  onEditTableMeta?: (nodeId: string, next: { 
    table: string
    description?: string 
  }) => void
  onAfterImport?: (nodeId: string, payload: any) => void
  onRefresh?: () => Promise<void> | void
}

// Chat messages
export type ChatMessage =
  | { id: string; role: "user"; text: string; createdAt: number }
  | { id: string; role: "assistant"; text?: string; createdAt: number }
  | { id: string; role: "error"; text: string; createdAt: number }`}
              </pre>
            </CardContent>
          </Card>
        </section>

        {/* Data Flow */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Data Flow & State Management</h2>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>State Management Pattern</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">1. Local State (React Hooks)</h4>
                  <p className="text-sm text-slate-600 mb-2">
                    Primary state management using React hooks for performance and simplicity
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 ml-4">
                    <li>Nodes and edges managed by ReactFlow hooks</li>
                    <li>UI state (modals, loading) in component state</li>
                    <li>Version history in local state</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Browser Storage (localStorage)</h4>
                  <p className="text-sm text-slate-600 mb-2">
                    Persistent storage for offline-first functionality
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 ml-4">
                    <li>Graph data serialized to JSON</li>
                    <li>Auto-save on every edit</li>
                    <li>Loads automatically on mount</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Database (Prisma + PostgreSQL)</h4>
                  <p className="text-sm text-slate-600 mb-2">
                    Server-side persistence for production deployments
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 ml-4">
                    <li>Store complete schema definitions</li>
                    <li>Multi-user support</li>
                    <li>Version control and history</li>
                    <li>Backup and restore capabilities</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Edit Flow Sequence</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm text-slate-600">
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600">1.</span>
                    <div>
                      <strong>User Action:</strong> Click edit button or connect nodes
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600">2.</span>
                    <div>
                      <strong>State Update:</strong> React state updates with new data
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600">3.</span>
                    <div>
                      <strong>Edge Rebuild:</strong> Foreign keys analyzed, edges regenerated
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600">4.</span>
                    <div>
                      <strong>Auto-Layout:</strong> Dagre calculates optimal positions
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600">5.</span>
                    <div>
                      <strong>Save:</strong> Data serialized and saved to localStorage/database
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600">6.</span>
                    <div>
                      <strong>Version Create:</strong> New version entry added to history
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600">7.</span>
                    <div>
                      <strong>UI Update:</strong> Toast notification confirms save
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Configuration */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Configuration & Setup</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>Configure database and external services</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
{`# NextAuth Configuration
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Google OAuth (optional - for Google sign-in)
# Get these from https://console.developers.google.com/
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Database
DATABASE_URL=


OPENAI_API_KEY=
EMBED_MODEL_NAME=
CHAT_MODEL=`}
              </pre>
            </CardContent>
          </Card>
        </section>

        {/* Deployment */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Deployment</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Vercel (Recommended)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                  <li>Push code to GitHub repository</li>
                  <li>Import project in Vercel dashboard</li>
                  <li>Add environment variables</li>
                  <li>Deploy automatically on push</li>
                </ol>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <strong className="text-blue-900">Note:</strong>
                  <p className="text-blue-800 mt-1">Vercel provides automatic CI/CD, edge functions, and serverless database support</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Self-Hosted</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`# Build for production
npm run build

# Start production server
npm start

# Or use PM2
pm2 start npm --name "flow-schema" -- start`}
                </pre>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <strong className="text-amber-900">Requirements:</strong>
                  <ul className="list-disc list-inside text-amber-800 mt-1 space-y-1">
                    <li>Node.js 18+ installed</li>
                    <li>PostgreSQL/MySQL running</li>
                    <li>Environment variables configured</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Performance */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Performance Optimizations</h2>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Client-Side</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>React.memo</strong> for expensive components</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>useCallback</strong> for stable function references</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Debounced saves</strong> to prevent excessive writes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Lazy loading</strong> for non-critical components</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Virtual scrolling</strong> for large node lists</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Server-Side</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Server Components</strong> for static content</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Database connection pooling</strong> via Prisma</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Edge runtime</strong> for faster response times</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Static page generation</strong> where possible</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* API Routes (Future) */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">API Routes (Future Implementation)</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Planned API Endpoints</CardTitle>
              <CardDescription>RESTful API for schema operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <code className="bg-blue-100 text-blue-900 px-2 py-1 rounded font-mono text-sm">GET /api/schemas</code>
                  <p className="text-sm text-slate-600 mt-1">List all saved schemas</p>
                </div>
                <div>
                  <code className="bg-green-100 text-green-900 px-2 py-1 rounded font-mono text-sm">POST /api/schemas</code>
                  <p className="text-sm text-slate-600 mt-1">Create new schema</p>
                </div>
                <div>
                  <code className="bg-amber-100 text-amber-900 px-2 py-1 rounded font-mono text-sm">PUT /api/schemas/:id</code>
                  <p className="text-sm text-slate-600 mt-1">Update existing schema</p>
                </div>
                <div>
                  <code className="bg-red-100 text-red-900 px-2 py-1 rounded font-mono text-sm">DELETE /api/schemas/:id</code>
                  <p className="text-sm text-slate-600 mt-1">Delete schema</p>
                </div>
                <div>
                  <code className="bg-purple-100 text-purple-900 px-2 py-1 rounded font-mono text-sm">POST /api/schemas/:id/versions</code>
                  <p className="text-sm text-slate-600 mt-1">Create version snapshot</p>
                </div>
                <div>
                  <code className="bg-indigo-100 text-indigo-900 px-2 py-1 rounded font-mono text-sm">GET /api/schemas/:id/export</code>
                  <p className="text-sm text-slate-600 mt-1">Export schema as SQL/JSON</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Contributing */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Development Guide</h2>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
{`# Clone repository
git clone https://github.com/WRI-Indonesia/nbs-llm.git
cd nbs-llm

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Run Prisma migrations
npx prisma migrate dev

# Start development server
npm run dev

# Open browser
# Navigate to http://localhost:3000`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Code Standards</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span>Use TypeScript for all new files</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span>Follow ESLint and Prettier configurations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span>Write JSDoc comments for complex functions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span>Keep components under 300 lines</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span>Extract reusable logic into custom hooks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span>Place all types in /types directory</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t bg-slate-50 py-8">
        <div className="container mx-auto px-4 text-center text-slate-600">
          <p>© 2025 NBS LLM Schema Designer. Built with ❤️ using Next.js and Prisma.</p>
          <p className="mt-2">
            <a href="https://github.com/WRI-Indonesia/nbs-llm" className="text-blue-600 hover:text-blue-800 underline">
              View on GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

