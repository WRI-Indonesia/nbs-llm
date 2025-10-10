import Link from "next/link"
import { ArrowRight, Database, Workflow, Sparkles, MousePointerClick, Pencil, GitBranch, MessageSquare, Save, Eye, Zap, BookOpen, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Toaster } from "@/components/ui/sonner"
import AuthButton from "@/components/AuthButton"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-purple-200/50 bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-sm">
              <Database className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Flow Schema Designer</h1>
          </div>
          <nav className="flex gap-2 items-center">
            <Link href="/">
              <Button variant="ghost" className="hover:bg-purple-100 hover:text-purple-700 transition-colors">Home</Button>
            </Link>
            <Link href="/docs">
              <Button variant="ghost" className="gap-2 hover:bg-blue-100 hover:text-blue-700 transition-colors">
                <BookOpen className="h-4 w-4" />
                Docs
              </Button>
            </Link>
            <Link href="/playground">
              <Button className="gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all">
                Playground <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <AuthButton />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Zap className="h-4 w-4" />
            <span>Visual Database Design Made Easy</span>
          </div>
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            Visual Database Schema Designer
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Create, edit, and visualize your database schemas with an intuitive flow-based interface. 
            Build relationships between tables with drag-and-drop simplicity. Works with or without authentication! 🎨✨
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/playground">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" className="gap-2">
                <Code2 className="h-5 w-5" />
                View Docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">Why Choose Flow Schema Designer?</h3>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="border-2 hover:border-blue-300 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Workflow className="h-7 w-7 text-blue-600" />
              </div>
              <CardTitle>Visual Flow Editor</CardTitle>
              <CardDescription>
                Design your database schema using an intuitive visual flow interface powered by ReactFlow. 
                See your entire schema at a glance! 👁️
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-green-300 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Database className="h-7 w-7 text-green-600" />
              </div>
              <CardTitle>Smart Relationships</CardTitle>
              <CardDescription>
                Define primary keys, foreign keys, and automatically visualize relationships between tables. 
                Connect with a simple drag! 🔗
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-purple-300 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="h-7 w-7 text-purple-600" />
              </div>
              <CardTitle>Prisma Integration</CardTitle>
              <CardDescription>
                Sync your designs directly to your database using Prisma ORM. 
                From design to production in seconds! ⚡
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How to Use - More Visual */}
      <section className="container mx-auto px-4 py-16 bg-gradient-to-b from-blue-50/50 to-transparent -mx-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">How to Use in 5 Easy Steps</h3>
            <p className="text-lg text-slate-600">Follow this simple guide to master Flow Schema Designer 🚀</p>
          </div>
          
          <div className="space-y-6">
            {/* Step 1 */}
            <Card className="border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      1
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <MousePointerClick className="h-6 w-6 text-blue-600" />
                      <h4 className="text-2xl font-bold">Open the Playground</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Click the <span className="font-semibold text-blue-600">"Playground"</span> button to start designing. 
                      You'll see a sample schema with users, posts, and comments tables to get you started!
                    </p>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        Sample Data Included ✓
                      </span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        Beginner Friendly ✓
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="border-l-4 border-l-purple-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      2
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Pencil className="h-6 w-6 text-purple-600" />
                      <h4 className="text-2xl font-bold">Edit Your Tables</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Click the <span className="font-semibold">pencil icon</span> on any table to customize it:
                    </p>
                    <div className="grid md:grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 text-slate-700">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>✏️ Change table names and descriptions</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>➕ Add new columns or remove existing ones</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>🎯 Set column types (text, number, boolean)</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>🔑 Mark as Primary Key (PK) or Foreign Key (FK)</span>
                      </div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm text-purple-900">
                        <strong>💡 Pro Tip:</strong> The system automatically validates duplicate names and required fields!
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="border-l-4 border-l-green-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      3
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <GitBranch className="h-6 w-6 text-green-600" />
                      <h4 className="text-2xl font-bold">Create Relationships</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Connect your tables by <span className="font-semibold">dragging connections</span> between them. It's as easy as drawing a line! 🎨
                    </p>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-green-700 font-bold">→</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">Foreign Key (Right Side)</p>
                          <p className="text-sm text-slate-600">Drag from the handle on the RIGHT side of a table</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-green-700 font-bold">←</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">Primary Key (Left Side)</p>
                          <p className="text-sm text-slate-600">Drop on the handle on the LEFT side of another table</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-900">
                        <strong>✨ Magic:</strong> The graph automatically updates layout and saves your changes!
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 4 */}
            <Card className="border-l-4 border-l-amber-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      4
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <MessageSquare className="h-6 w-6 text-amber-600" />
                      <h4 className="text-2xl font-bold">Ask the AI Assistant</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Stuck? Click <span className="font-semibold text-amber-600">"Ask AI"</span> to get help with your schema design! 🤖
                    </p>
                    <div className="grid md:grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-xl">💬</span>
                        <span>Ask schema design questions</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-xl">📚</span>
                        <span>Learn best practices</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-xl">🎓</span>
                        <span>Get instant feedback</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-xl">🔧</span>
                        <span>Troubleshoot issues</span>
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-900">
                        <strong>📌 Note:</strong> Currently in demo mode. Connect to an AI service for real-time assistance!
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 5 */}
            <Card className="border-l-4 border-l-indigo-500 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      5
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Save className="h-6 w-6 text-indigo-600" />
                      <h4 className="text-2xl font-bold">Save & Version Control</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Your work is <span className="font-semibold">automatically saved</span> with full version history! 💾
                    </p>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Eye className="h-4 w-4 text-indigo-700" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">View Version History</p>
                          <p className="text-sm text-slate-600">Click "Versions" to see all your schema changes over time</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <GitBranch className="h-4 w-4 text-indigo-700" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">Restore Previous Versions</p>
                          <p className="text-sm text-slate-600">Made a mistake? Easily roll back to any previous version</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Database className="h-4 w-4 text-indigo-700" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">Sync with Database</p>
                          <p className="text-sm text-slate-600">Configure your DATABASE_URL to sync with Prisma (coming soon!)</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <p className="text-sm text-indigo-900">
                        <strong>🛡️ Smart Storage:</strong> Logged in users save to database with version history. 
                        Non-logged users save to localStorage. Your data is always safe!
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Start CTA */}
          <div className="mt-12 text-center">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white">
              <h4 className="text-2xl font-bold mb-3">Ready to Start?</h4>
              <p className="text-lg mb-6 text-blue-50">Jump into the playground and create your first schema in under 2 minutes! ⚡</p>
              <Link href="/playground">
                <Button size="lg" variant="secondary" className="gap-2">
                  <Zap className="h-5 w-5" />
                  Launch Playground Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Info */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>
                  Instant auto-save and real-time updates. No waiting, no loading screens.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Database className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Database Ready</CardTitle>
                <CardDescription>
                  Export to Prisma schema or SQL. Deploy to PostgreSQL, MySQL, or SQLite.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Well Documented</CardTitle>
                <CardDescription>
                  Comprehensive guides and technical docs to help you every step of the way.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-3xl font-bold mb-6">Start Designing Beautiful Schemas Today</h3>
          <p className="text-xl text-slate-600 mb-8">
            Start designing immediately with localStorage, or sign up for database sync and version history. 
            No credit card needed. Just pure schema design magic! ✨
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/playground">
              <Button size="lg" className="gap-2">
                <Workflow className="h-5 w-5" />
                Open Playground
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" className="gap-2">
                <BookOpen className="h-5 w-5" />
                Read Technical Docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-slate-50 py-8">
        <div className="container mx-auto px-4 text-center text-slate-600">
          <p>© 2025 Flow Schema Designer. Built with Next.js, Prisma, and ReactFlow.</p>
        </div>
      </footer>
      <Toaster 
        position="bottom-right"
        expand={true}
        richColors={true}
        closeButton={true}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          },
        }}
      />
    </div>
  )
}
