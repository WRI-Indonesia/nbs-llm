import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bot,
  MessageSquare,
  Map,
  Database,
  Brain,
  Sparkles,
  Search,
  FileText,
  ArrowRight,
  Zap,
  Workflow,
  Layers,
  Globe,
  Shield,
  BarChart3,
  CheckCircle2,
  Code,
  Server,
  FileSearch,
  ArrowDown,
  ArrowRightCircle,
  Circle,
  Clock,
  Play,
  Loader,
} from "lucide-react";

export default function Home() {
  const features = [
    {
      icon: MessageSquare,
      title: "AI-Powered Chat",
      description:
        "Ask questions in natural language. If no shapefile is uploaded, simply include a district or province in your query.",
      href: "/chat-map",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Map,
      title: "Interactive Maps & Optional Shapefile",
      description:
        "Upload a shapefile ZIP to define your project area. The system auto-extracts districts/provinces and scopes all queries to that boundary.",
      href: "/chat-map",
      gradient: "from-green-500 to-emerald-500",
    },
    {
      icon: Database,
      title: "Knowledge Management",
      description:
        "Build and manage your knowledge graph with React Flow, schema nodes, document indexing, and relationships.",
      href: "/knowledge",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: BarChart3,
      title: "Automated SQL",
      description:
        "Generate optimized PostgreSQL from plain English with JOINs, filters, and aggregations—guided by relevant schema docs.",
      href: "/chat-map",
      gradient: "from-orange-500 to-red-500",
    },
    {
      icon: Globe,
      title: "RAG-Powered Answers",
      description:
        "Retrieval-Augmented Generation combines SQL results with relevant documents for complete, context-aware responses.",
      href: "/chat-map",
      gradient: "from-indigo-500 to-purple-500",
    },
    {
      icon: Shield,
      title: "Secure Access",
      description:
        "Google OAuth authentication, protected routes, and project-scoped data access control.",
      href: "/chat-map",
      gradient: "from-red-500 to-rose-500",
    },
  ];

  const agents = [
    {
      icon: Sparkles,
      title: "Reprompt Query Agent",
      description:
        "Normalizes user queries and enforces location context; expands macro-regions and fixes typos.",
      detailedDesc:
        "Uses GPT-4o-mini to fix typos, normalize Indonesian district/province names (Kab/Kota), expand macro-regions (e.g., Java → DKI Jakarta, Banten, Jawa Barat), and merge shapefile-derived locations when present. If no shapefile and no location in the query, returns 'false' so the UI can ask the user to upload a shapefile or include a location.",
      bgClassName: "from-blue-500/20 to-cyan-500/20",
      borderClassName: "border-blue-500/30",
      iconBgClassName: "from-blue-500 to-blue-600",
      model: "GPT-4o-mini",
      inputs: ["User query", "Shapefile districts/provinces (if any)"],
      outputs: ["Normalized query", "false (when location missing)"],
    },
    {
      icon: Brain,
      title: "Embedding Agent",
      description:
        "Turns the normalized query into a 3072-dimensional semantic vector for retrieval.",
      detailedDesc:
        "Uses text-embedding-3-large to create a 3072-d embedding. Powers cosine-similarity search over schema node docs (for SQL) and MinIO documents (for context). Default retrieval parameters: top_k = 5, min_cosine = 0.2.",
      bgClassName: "from-purple-500/20 to-pink-500/20",
      borderClassName: "border-purple-500/30",
      iconBgClassName: "from-purple-500 to-purple-600",
      model: "text-embedding-3-large",
      inputs: ["Normalized query"],
      outputs: ["3072-dim embedding vector (JSON)"],
    },
    {
      icon: Database,
      title: "SQL Generation Agent",
      description:
        "Transforms natural language into optimized PostgreSQL using schema-aware context.",
      detailedDesc:
        "Analyzes relevant schema docs and produces valid SQL with appropriate JOINs, filters, aggregations, and ILIKE for case-insensitive matches. Only runs when relevantNodeDocs.length > 0.",
      bgClassName: "from-green-500/20 to-emerald-500/20",
      borderClassName: "border-green-500/30",
      iconBgClassName: "from-green-500 to-green-600",
      model: "GPT-4o",
      inputs: ["Normalized query", "Relevant schema documents"],
      outputs: ["PostgreSQL SQL query"],
    },
    {
      icon: FileText,
      title: "Summarization Agent",
      description:
        "Produces a conversational answer by synthesizing SQL results and RAG documents.",
      detailedDesc:
        "Uses SeaLLM to merge SQL outputs with RAG-retrieved documents (MinIO + schema notes). If SQL is unavailable but RAG exists, still provides a narrative from documents.",
      bgClassName: "from-orange-500/20 to-red-500/20",
      borderClassName: "border-orange-500/30",
      iconBgClassName: "from-orange-500 to-orange-600",
      model: "SeaLLM",
      inputs: ["Normalized query", "SQL result data (if any)", "RAG context documents"],
      outputs: ["Natural-language answer"],
    },
  ];

  const workflowSteps = [
    {
      step: 1,
      title: "User Query & Authentication",
      agent: null,
      description:
        "User submits a natural-language query. Shapefile upload is optional; if provided, districts/provinces are extracted and used to scope all queries.",
      inputs: [
        "Query text",
        "Project ID",
        "Location parameters (from shapefile, if any)",
        "Timestamp",
      ],
      outputs: ["Validated query", "User session", "Project area scope (if any)"],
      process:
        "Validates authentication, optionally handles shapefile upload (extract districts/provinces), saves the user message to chat history.",
      icon: MessageSquare,
      borderClassName: "border-slate-500",
      iconClassName: "text-slate-600",
      bgClassName: "from-slate-500 to-slate-600",
    },
    {
      step: 2,
      title: "Reprompt Query Agent",
      agent: agents[0],
      description:
        "Normalizes and improves the query, handles typos and Indonesian location references, and enforces location presence when no shapefile is provided.",
      inputs: ["Original query", "Shapefile location (optional)"],
      outputs: ["Normalized query", "false (when location missing)"],
      process:
        "GPT-4o-mini fixes typos, expands macro-regions (e.g., Java → DKI Jakarta, Banten, Jawa Barat), normalizes district names (Kab/Kota). If no shapefile and no location term, returns false to trigger a UI prompt.",
      icon: Sparkles,
      borderClassName: "border-blue-500",
      iconClassName: "text-blue-600",
      bgClassName: "from-blue-500 to-blue-600",
      condition:
        "If output is false → UI asks user to upload shapefile or include a district/province in the query.",
    },
    {
      step: 3,
      title: "Generate Embedding",
      agent: agents[1],
      description: "Converts the normalized query into a semantic embedding vector.",
      inputs: ["Normalized query"],
      outputs: ["3072-dim embedding vector (JSON)"],
      process:
        "OpenAI text-embedding-3-large generates a 3072-d semantic vector for cosine-similarity search.",
      icon: Brain,
      borderClassName: "border-purple-500",
      iconClassName: "text-purple-600",
      bgClassName: "from-purple-500 to-purple-600",
    },
    {
      step: 4,
      title: "RAG Document Retrieval",
      agent: null,
      description:
        "Finds relevant schema node docs (for SQL) and MinIO docs (for context) using cosine similarity.",
      inputs: ["Query embedding", "top_k = 5", "min_cosine = 0.2"],
      outputs: ["Relevant node documents", "Relevant MinIO documents"],
      process:
        "PostgreSQL functions match_node_docs() and match_minio_docs() perform vector similarity search with the configured thresholds.",
      icon: FileSearch,
      borderClassName: "border-indigo-500",
      iconClassName: "text-indigo-600",
      bgClassName: "from-indigo-500 to-indigo-600",
    },
    {
      step: 5,
      title: "SQL Generation Agent",
      agent: agents[2],
      description:
        "Generates PostgreSQL from natural language using schema context; applies proper JOINs, filters, aggregations, and ILIKE.",
      inputs: ["Normalized query", "Relevant schema documents"],
      outputs: ["PostgreSQL SQL query"],
      process:
        "GPT-4o analyzes schema docs and generates optimized SQL. Applies project scoping during execution.",
      icon: Database,
      borderClassName: "border-green-500",
      iconClassName: "text-green-600",
      bgClassName: "from-green-500 to-green-600",
      condition: "Only executes if relevantNodeDocs.length > 0.",
    },
    {
      step: 6,
      title: "SQL Execution",
      agent: null,
      description:
        "Executes the generated SQL against the project database with project-scoped access control.",
      inputs: ["SQL query", "Project ID"],
      outputs: ["Query result data (array)", "Execution error (if any)"],
      process:
        "Validates and executes SQL; surfaces errors gracefully while preserving context for summarization.",
      icon: Code,
      borderClassName: "border-green-500",
      iconClassName: "text-green-600",
      bgClassName: "from-green-500 to-green-600",
    },
    {
      step: 7,
      title: "Summarization Agent",
      agent: agents[3],
      description:
        "Creates the final conversational answer by combining SQL results with RAG documents.",
      inputs: ["Normalized query", "SQL result data", "RAG context documents"],
      outputs: ["Natural-language answer"],
      process:
        "SeaLLM synthesizes SQL outputs with contextual snippets. If SQL is unavailable but RAG exists, still produces a narrative from documents.",
      icon: FileText,
      borderClassName: "border-orange-500",
      iconClassName: "text-orange-600",
      bgClassName: "from-orange-500 to-orange-600",
    },
    {
      step: 8,
      title: "Save & Return",
      agent: null,
      description:
        "Persists the complete conversation and returns the response to the user.",
      inputs: ["Assistant message", "SQL query", "RAG documents", "Query results"],
      outputs: ["Success response"],
      process:
        "Stores conversation, SQL text, RAG docs, and results for history and auditing.",
      icon: CheckCircle2,
      borderClassName: "border-slate-500",
      iconClassName: "text-slate-600",
      bgClassName: "from-slate-500 to-slate-600",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero Section */}
      <section className="relative container mx-auto px-4 py-24 pt-32">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-primary/5 blur-3xl" />
        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/20 text-primary text-sm font-semibold mb-6 shadow-lg backdrop-blur-sm">
            <Bot className="w-5 h-5" />
            Nature-Based Solutions LLM
          </div>
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-foreground via-primary to-purple-600 bg-clip-text text-transparent">
              Multi-Agent AI System
            </span>
            <br />
            <span className="text-5xl md:text-6xl bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              for Data Intelligence
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Query your NBS data in plain language. Upload a shapefile to get automatic project-area scoping—or, if you skip it, just include a district or province in your question.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button asChild size="lg" className="text-base px-8 py-6 h-auto">
              <Link href="/chat-map" className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Try Chat Interface
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="text-base px-8 py-6 h-auto"
            >
              <Link href="/knowledge" className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Explore Knowledge Base
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
          <div className="mx-auto max-w-xl pt-4">
            <div className="rounded-xl border text-sm p-3 bg-background/70">
              <strong>Location requirement:</strong> If no shapefile is uploaded and your query has no district/province, the system will prompt you to upload a shapefile or include a location.
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Agent System Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/20 text-primary text-sm font-semibold mb-6">
            <Workflow className="w-5 h-5" />
            Powered by Advanced AI Agents
          </div>
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Multi-Agent Architecture
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Four specialized agents collaborate to normalize queries, retrieve context, generate SQL, and craft clear, location-aware answers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto mb-20">
          {agents.map((agent, index) => (
            <Card
              key={index}
              className={`group relative overflow-hidden border-2 hover:shadow-2xl transition-all duration-500 ${agent.borderClassName} bg-gradient-to-br ${agent.bgClassName} backdrop-blur-sm`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative">
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${agent.iconBgClassName} text-white shadow-lg`}
                  >
                    <agent.icon className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">
                      {agent.title}
                    </CardTitle>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/80 border text-xs font-medium mb-3">
                      <Server className="w-3 h-3" />
                      {agent.model}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-4">
                <CardDescription className="text-base leading-relaxed">
                  {agent.description}
                </CardDescription>
                <p className="text-sm text-muted-foreground">
                  {agent.detailedDesc}
                </p>
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                      <ArrowDown className="w-4 h-4 text-green-600" />
                      Inputs
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {agent.inputs.map((input, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-medium border border-green-500/20"
                        >
                          {input}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                      <ArrowRight className="w-4 h-4 text-blue-600" />
                      Outputs
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {agent.outputs.map((output, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-medium border border-blue-500/20"
                        >
                          {output}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed Agent Workflow */}
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500/20 to-primary/20 border border-purple-500/20 text-purple-700 dark:text-purple-400 text-sm font-semibold mb-6">
              <Zap className="w-5 h-5" />
              Complete Agent Workflow
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Step-by-Step Process Flow
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From submission to final response, here’s how your question moves through the system.
            </p>
          </div>

          <div className="space-y-6">
            {workflowSteps.map((step, index) => (
              <div key={index} className="relative">
                {/* Connection Line */}
                {index < workflowSteps.length - 1 && (
                  <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gradient-to-b from-primary via-purple-500 to-primary/20 -z-10" />
                )}

                <Card
                  className={`relative overflow-hidden border-l-4 ${step.borderClassName} hover:shadow-xl transition-all duration-300 ${step.borderClassName.includes("slate")
                      ? "bg-gradient-to-r from-slate-500/5 to-transparent"
                      : step.borderClassName.includes("blue")
                        ? "bg-gradient-to-r from-blue-500/5 to-transparent"
                        : step.borderClassName.includes("purple")
                          ? "bg-gradient-to-r from-purple-500/5 to-transparent"
                          : step.borderClassName.includes("indigo")
                            ? "bg-gradient-to-r from-indigo-500/5 to-transparent"
                            : step.borderClassName.includes("green")
                              ? "bg-gradient-to-r from-green-500/5 to-transparent"
                              : step.borderClassName.includes("orange")
                                ? "bg-gradient-to-r from-orange-500/5 to-transparent"
                                : "bg-gradient-to-r from-slate-500/5 to-transparent"
                    }`}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Step Number & Icon */}
                      <div className="flex items-start gap-4">
                        <div
                          className={`relative flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${step.bgClassName} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                        >
                          {step.step}
                        </div>
                        <div
                          className={`p-3 rounded-xl border ${step.borderClassName.includes("slate")
                              ? "bg-slate-500/10 border-slate-500/20"
                              : step.borderClassName.includes("blue")
                                ? "bg-blue-500/10 border-blue-500/20"
                                : step.borderClassName.includes("purple")
                                  ? "bg-purple-500/10 border-purple-500/20"
                                  : step.borderClassName.includes("indigo")
                                    ? "bg-indigo-500/10 border-indigo-500/20"
                                    : step.borderClassName.includes("green")
                                      ? "bg-green-500/10 border-green-500/20"
                                      : step.borderClassName.includes("orange")
                                        ? "bg-orange-500/10 border-orange-500/20"
                                        : "bg-slate-500/10 border-slate-500/20"
                            }`}
                        >
                          <step.icon className={`w-6 h-6 ${step.iconClassName}`} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-4">
                        <div>
                          <h3 className="text-xl font-bold mb-1">{step.title}</h3>
                          {step.agent && (
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-medium mb-2">
                              <step.agent.icon className="w-3 h-3" />
                              {step.agent.title}
                            </div>
                          )}
                          <p className="text-muted-foreground leading-relaxed">
                            {step.description}
                          </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
                              <ArrowDown className="w-4 h-4" />
                              Inputs
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {step.inputs.map((input, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-medium border border-green-500/20"
                                >
                                  {input}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
                              <ArrowRight className="w-4 h-4" />
                              Outputs
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {step.outputs.map((output, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-medium border border-blue-500/20"
                                >
                                  {output}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-border/30">
                          <div className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold mb-1">Process:</p>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {step.process}
                              </p>
                              {step.condition && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium italic">
                                  ⚠️ {step.condition}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Key Features
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Everything you need to explore and analyze your Nature-Based Solutions data with powerful AI capabilities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group relative overflow-hidden hover:shadow-2xl transition-all duration-500 border-2 hover:border-primary/50"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
              />
              <CardHeader className="relative">
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <CardDescription className="text-base leading-relaxed mb-4">
                  {feature.description}
                </CardDescription>
                <Button variant="ghost" size="sm" asChild className="group/btn">
                  <Link href={feature.href} className="flex items-center gap-2">
                    Learn more
                    <ArrowRight className="ml-1 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Technical Highlights */}
      <section className="container mx-auto px-4 py-20">
        <Card className="max-w-6xl mx-auto border-2 bg-gradient-to-br from-muted/50 via-background to-muted/30 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-purple-600">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-3xl">Technical Stack</CardTitle>
            </div>
            <CardDescription className="text-base">
              Built with cutting-edge technologies for optimal performance and scalability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-600" />
                  AI & Machine Learning
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-blue-600 text-blue-600" />
                    OpenAI GPT-4o & GPT-4o-mini
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-blue-600 text-blue-600" />
                    Text Embedding 3 Large (3072-dim)
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-blue-600 text-blue-600" />
                    RAG (Retrieval-Augmented Generation)
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-blue-600 text-blue-600" />
                    Semantic Search with PostgreSQL pgvector
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-blue-600 text-blue-600" />
                    SeaLLM for Summarization
                  </li>
                </ul>
              </div>
              <div className="space-y-3 p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-600" />
                  Infrastructure
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-purple-600 text-purple-600" />
                    Next.js 15 with App Router
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-purple-600 text-purple-600" />
                    PostgreSQL with Prisma ORM
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-purple-600 text-purple-600" />
                    MinIO Object Storage
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-purple-600 text-purple-600" />
                    BullMQ for Job Processing
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-purple-600 text-purple-600" />
                    Redis for Queue Management
                  </li>
                </ul>
              </div>
              <div className="space-y-3 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <Map className="w-5 h-5 text-green-600" />
                  Data Visualization
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-green-600 text-green-600" />
                    OpenLayers for Interactive Maps
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-green-600 text-green-600" />
                    React Flow for Knowledge Graphs
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-green-600 text-green-600" />
                    Shapefile & GeoJSON Support
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-green-600 text-green-600" />
                    Real-time SQL Execution
                  </li>
                </ul>
              </div>
              <div className="space-y-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-600" />
                  Security & Auth
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-red-600 text-red-600" />
                    NextAuth.js with Google OAuth
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-red-600 text-red-600" />
                    Secure Session Management
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-red-600 text-red-600" />
                    Protected API Routes
                  </li>
                  <li className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-red-600 text-red-600" />
                    User-based Access Control
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="max-w-4xl mx-auto border-2 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl mb-3">Ready to Get Started?</CardTitle>
            <CardDescription className="text-lg">
              Explore your data with a powerful, location-aware multi-agent AI system.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button asChild size="lg" className="text-base px-8 py-6 h-auto">
              <Link href="/chat-map" className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Launch Chat Interface
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="text-base px-8 py-6 h-auto border-2"
            >
              <Link href="/knowledge" className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Manage Knowledge Base
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
