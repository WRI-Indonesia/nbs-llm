import Link from "next/link"
import { Home, Code2, Database, Layers, GitBranch, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Header from "@/components/Header"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Technical Documentation - Data Lab Indonesia LLM",
  description: "Comprehensive technical documentation for Data Lab Indonesia LLM. Learn about architecture, authentication, organization management, and API endpoints.",
}

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
            Data Lab Indonesia LLM is a modern, collaborative data platform built with Next.js 15 and React 19, 
            leveraging the latest web technologies to provide a seamless database schema design experience with AI-powered assistance, 
            team collaboration, and knowledge sharing capabilities.
          </p>
          <p className="text-lg text-slate-600">
            The application follows a component-based architecture with strict TypeScript typing, 
            multi-tenant organization support, authentication & authorization, local-first data persistence, AI integration, 
            and extensible design patterns for enterprise-scale deployments.
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
                  <h4 className="font-semibold text-sm text-slate-700">Multi-tenant Architecture</h4>
                  <p className="text-sm text-slate-600">Organization-based data isolation and access control</p>
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
                  Authentication & Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">NextAuth.js</h4>
                  <p className="text-sm text-slate-600">Secure authentication with email/password and OAuth providers</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Email Verification</h4>
                  <p className="text-sm text-slate-600">Account verification system with secure token-based validation</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Role-Based Access Control</h4>
                  <p className="text-sm text-slate-600">Organization roles (OWNER, ADMIN, MEMBER, VIEWER) with granular permissions</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-700">Session Management</h4>
                  <p className="text-sm text-slate-600">Secure session handling with automatic token refresh</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
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
{`data-lab-indonesia-llm/
├── app/
│   ├── api/
│   │   ├── ai/                   # AI assistant API routes
│   │   │   ├── ask/              # SQL generation endpoint
│   │   │   ├── index/            # Schema indexing endpoint
│   │   │   └── chat/             # Chat history management
│   │   ├── auth/                 # Authentication routes
│   │   │   ├── signin/           # Login endpoint
│   │   │   ├── signup/           # Registration endpoint
│   │   │   ├── verify-email/     # Email verification
│   │   │   └── [...nextauth]/    # NextAuth configuration
│   │   ├── blogs/                # Blog system API
│   │   │   ├── route.ts          # Blog CRUD operations
│   │   │   ├── comments/         # Comment system
│   │   │   └── upload-image/     # Image upload for blogs
│   │   ├── organizations/        # Organization management
│   │   │   ├── route.ts          # Organization CRUD
│   │   │   ├── members/          # Member management
│   │   │   └── invitations/      # Invitation system
│   │   ├── schemas/              # Schema CRUD operations
│   │   └── user/                 # User profile management
│   ├── auth/                     # Authentication pages
│   │   ├── verify-email/         # Email verification page
│   │   └── email-verified/       # Success page
│   ├── blogs/                    # Blog pages
│   │   ├── create/               # Blog creation
│   │   ├── [slug]/               # Blog viewing/editing
│   │   └── page.tsx              # Blog listing
│   ├── organizations/             # Organization pages
│   │   ├── manage/               # Organization management
│   │   └── invite/[token]/       # Invitation acceptance
│   ├── docs/
│   │   └── page.tsx              # Technical documentation
│   ├── playground/
│   │   └── page.tsx              # Interactive schema designer
│   ├── profile/
│   │   └── page.tsx              # User profile management
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
│   ├── AuthButton.tsx            # Authentication button
│   ├── UserDropdown.tsx          # User menu dropdown
│   ├── EmailVerification.tsx     # Email verification component
│   ├── CKEditor.tsx              # Rich text editor
│   ├── RichTextEditor.tsx        # Blog editor
│   ├── DataPreviewModal.tsx      # Data preview modal
│   ├── GeoUploadButton.tsx       # Geographic data upload
│   ├── Map.tsx                   # Map visualization
│   └── ui/                       # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
│
├── lib/
│   ├── auth.ts                   # NextAuth configuration
│   ├── prisma.ts                 # Prisma client singleton
│   ├── schema-storage.ts         # Storage abstraction layer
│   ├── email.ts                  # Email service configuration
│   ├── minio.ts                  # File storage service
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

        {/* Authentication & Organization System */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Authentication & Organization System</h2>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>NextAuth.js Integration</CardTitle>
                <CardDescription>Secure authentication with multiple providers and session management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Authentication Providers:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>Email/Password authentication with bcrypt hashing</li>
                    <li>Google OAuth integration</li>
                    <li>Email verification system with secure tokens</li>
                    <li>Session management with automatic refresh</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Security Features:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>Password hashing with bcrypt (12 rounds)</li>
                    <li>Email verification tokens with expiration</li>
                    <li>Secure session cookies with httpOnly flag</li>
                    <li>CSRF protection via NextAuth</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Multi-Tenant Organization System</CardTitle>
                <CardDescription>Role-based access control with organization management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Organization Features:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>Create and manage organizations with custom names and descriptions</li>
                    <li>Invite team members via email with role assignment</li>
                    <li>Organization slug generation for clean URLs</li>
                    <li>Member management with role-based permissions</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Role Hierarchy:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><strong>OWNER:</strong> Full control, can delete organization</li>
                    <li><strong>ADMIN:</strong> Manage members, edit organization settings</li>
                    <li><strong>MEMBER:</strong> Create/edit schemas and blogs</li>
                    <li><strong>VIEWER:</strong> Read-only access to shared content</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blog & Knowledge Sharing System</CardTitle>
                <CardDescription>Collaborative content creation and sharing platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Blog Features:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>Rich text editor with CKEditor integration</li>
                    <li>Jupyter notebook import and rendering</li>
                    <li>Image upload and management</li>
                    <li>Comment system for discussions</li>
                    <li>Tag-based categorization</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Visibility Controls:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><strong>PUBLIC:</strong> Visible to everyone</li>
                    <li><strong>INTERNAL:</strong> Visible to organization members only</li>
                    <li><strong>PRIVATE:</strong> Visible to author only</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
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
NEXTAUTH_SECRET=your-nextauth-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (optional - for Google sign-in)
# Get these from https://console.developers.google.com/
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here
EMBED_MODEL_NAME=text-embedding-3-large
CHAT_MODEL=gpt-4o-mini

# Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Minio
MINIO_ENDPOINT=localhost
MINIO_REGION=us-east-1
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=data-lab-files
MINIO_PUBLIC_BROWSER=true`}
              </pre>
            </CardContent>
          </Card>
        </section>

        {/* GitHub Actions Configuration */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">GitHub Actions Configuration</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Required GitHub Secrets</CardTitle>
              <CardDescription>Configure these secrets in your GitHub repository settings for automated deployment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-slate-700">NextAuth Configuration:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">NEXTAUTH_SECRET</code> - NextAuth secret key</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">NEXTAUTH_URL</code> - Application URL</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-slate-700">Google OAuth:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> - Google OAuth client ID</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code> - Google OAuth client secret</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-slate-700">Database:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">DATABASE_URL</code> - Database connection string</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-slate-700">OpenAI:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">OPENAI_API_KEY</code> - OpenAI API key</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">EMBED_MODEL_NAME</code> - Embedding model name</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">CHAT_MODEL</code> - Chat model name</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-slate-700">Gmail:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">SMTP_HOST</code> - SMTP server hostname</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">SMTP_PORT</code> - SMTP server port</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">SMTP_SECURE</code> - Use SSL/TLS</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">SMTP_USER</code> - SMTP username</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">SMTP_PASS</code> - SMTP password</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">SMTP_FROM</code> - From email address</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-slate-700">Minio:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">MINIO_ENDPOINT</code> - MinIO server endpoint</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">MINIO_REGION</code> - MinIO region</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">MINIO_ACCESS_KEY</code> - MinIO access key</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">MINIO_SECRET_KEY</code> - MinIO secret key</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">MINIO_BUCKET</code> - MinIO bucket name</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">MINIO_PUBLIC_BROWSER</code> - Enable public browser access</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-slate-700">VM Deployment:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">VM_HOST</code> - VM hostname/IP</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">VM_USER</code> - VM username</li>
                    <li><code className="bg-slate-100 px-1 py-0.5 rounded">VM_SSH_KEY</code> - SSH private key</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">How to Set GitHub Secrets:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>Go to your GitHub repository</li>
                  <li>Click on "Settings" tab</li>
                  <li>Navigate to "Secrets and variables" → "Actions"</li>
                  <li>Click "New repository secret"</li>
                  <li>Add each secret name and value</li>
                  <li>Save the secret</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Deployment */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Deployment</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>GitHub Actions (Current)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600 mb-3">
                  Automated Docker build and deployment to VM using GitHub Actions
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                  <li>Push code to main branch</li>
                  <li>GitHub Actions builds Docker image</li>
                  <li>Pushes to GitHub Container Registry</li>
                  <li>Deploys to VM via SSH</li>
                  <li>Updates running container</li>
                </ol>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <strong className="text-green-900">Current Setup:</strong>
                  <p className="text-green-800 mt-1">Automated deployment to llm.wri-indonesia.or.id</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vercel (Alternative)</CardTitle>
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
pm2 start npm --name "data-lab-llm" -- start`}
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
          <p>© 2025 Data Lab Indonesia LLM. Built with ❤️ using Next.js, Prisma, ReactFlow, and NextAuth.</p>
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

