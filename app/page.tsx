import Link from "next/link"
import { ArrowRight, Database, Workflow, Sparkles, MousePointerClick, Pencil, GitBranch, MessageSquare, Save, Eye, Zap, BookOpen, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Toaster } from "@/components/ui/sonner"
import Header from "@/components/Header"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Zap className="h-4 w-4" />
            <span>Data Lab Indonesia LLM - Talk with your data</span>
          </div>
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            Data Lab Indonesia LLM Experimental
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Transform your Excel data into powerful relational databases with an intuitive visual interface. 
            Create relationships between your data tables, then talk with your data using AI to get insights, 
            solutions, and learn SQL and prompts. Turn your spreadsheets into intelligent data systems! 📊🤖✨
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
        <h3 className="text-3xl font-bold text-center mb-12">Why Choose Data Lab Indonesia LLM?</h3>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="border-2 hover:border-blue-300 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Workflow className="h-7 w-7 text-blue-600" />
              </div>
              <CardTitle>Excel to Database Converter</CardTitle>
              <CardDescription>
                Transform your Excel spreadsheets into structured relational databases with an intuitive visual interface. 
                Import, organize, and connect your data tables seamlessly! 📊
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-green-300 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Database className="h-7 w-7 text-green-600" />
              </div>
              <CardTitle>AI-Powered Data Chat</CardTitle>
              <CardDescription>
                Talk with your data using natural language! Ask questions, get insights, generate SQL queries, 
                and learn data analysis techniques through AI conversation. 🤖💬
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-purple-300 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="h-7 w-7 text-purple-600" />
              </div>
              <CardTitle>SQL & Prompt Learning</CardTitle>
              <CardDescription>
                Learn SQL queries and AI prompting techniques through interactive examples. 
                Master data analysis skills while working with your own data! 📚🎓
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
            <p className="text-lg text-slate-600">Follow this simple guide to master Data Lab Indonesia LLM 🚀</p>
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
                      <h4 className="text-2xl font-bold">Import Your Excel Data</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Click the <span className="font-semibold text-blue-600">"Playground"</span> button to start. 
                      Upload your Excel files or start with sample data to understand how to structure your information!
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
                      <h4 className="text-2xl font-bold">Structure Your Data</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Click the <span className="font-semibold">pencil icon</span> on any table to organize your data:
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
                      <h4 className="text-2xl font-bold">Connect Your Data</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Create relationships between your data tables by <span className="font-semibold">dragging connections</span>. 
                      Link related information across different datasets! 🔗
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
                      <h4 className="text-2xl font-bold">Talk with Your Data</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Click <span className="font-semibold text-amber-600">"Ask AI"</span> to start a conversation with your data! 
                      Get insights, generate SQL queries, and learn data analysis techniques! 🤖💬
                    </p>
                    <div className="grid md:grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-xl">📊</span>
                        <span>Ask questions about your data</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-xl">🔍</span>
                        <span>Get insights and patterns</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-xl">💻</span>
                        <span>Generate SQL queries</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-xl">🎓</span>
                        <span>Learn SQL and prompting</span>
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-900">
                        <strong>✨ Examples:</strong> "Show me sales trends", "Find customers with high value", "Generate a report for Q4 performance"
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
                      <h4 className="text-2xl font-bold">Save & Share Your Data</h4>
                    </div>
                    <p className="text-slate-600 mb-4 text-lg">
                      Your data models and conversations are <span className="font-semibold">automatically saved</span> with full version history! 💾
                    </p>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Eye className="h-4 w-4 text-indigo-700" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">View Version History</p>
                          <p className="text-sm text-slate-600">Click "Versions" to see all your data model changes over time</p>
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
                          <p className="font-semibold text-slate-800">Export Your Data</p>
                          <p className="text-sm text-slate-600">Export your structured data to SQL, CSV, or other formats for analysis</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <p className="text-sm text-indigo-900">
                        <strong>🛡️ Smart Storage:</strong> Logged in users save to database with version history. 
                        Non-logged users save to localStorage. Your data and conversations are always safe!
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
              <h4 className="text-2xl font-bold mb-3">Ready to Transform Your Data?</h4>
              <p className="text-lg mb-6 text-blue-50">Jump into the playground and start talking with your data in under 2 minutes! ⚡</p>
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
                <CardTitle>Data Export Ready</CardTitle>
                <CardDescription>
                  Export your structured data to SQL, CSV, JSON, or other formats for analysis and sharing.
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
          <h3 className="text-3xl font-bold mb-6">Start Talking with Your Data Today</h3>
          <p className="text-xl text-slate-600 mb-8">
            Transform your Excel data into intelligent systems with AI-powered conversations. 
            No credit card needed. Just pure data magic! ✨
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
          <p>© 2025 Data Lab Indonesia LLM. Built with Next.js, Prisma, and ReactFlow.</p>
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
