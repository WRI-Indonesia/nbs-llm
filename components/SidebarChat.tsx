"use client"

import * as React from "react"
import type { ChatMessage } from "@/types"
import { MessageSquare, Database, Code, Table, Brain, Lightbulb } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Type definitions for AI response data
interface AIRagItem {
    key: string;
    score: number;
    kind: string;
    table: string;
    isForeignKey?: boolean;
    isPrimaryKey?: boolean;
    description: string;
}

interface AITableReasoning {
    name: string;
    reason: string;
}

interface AIColumnReasoning {
    name?: string;
    column?: string;
    reason: string;
}

interface AIJoinReasoning {
    left: string;
    right: string;
    reason: string;
}

interface AIReasoning {
    tables?: AITableReasoning[];
    columns?: AIColumnReasoning[];
    join_keys?: AIJoinReasoning[] | Record<string, any>;
}

interface AISuggestions {
    [key: string]: string;
}

interface AIResponseData {
    sql?: string;
    resultCount?: number;
    columns?: string[];
    result?: Record<string, unknown>[];
    used?: AIRagItem[];
    summary?: string;
    reasoning?: AIReasoning;
    suggestions?: AISuggestions;
    simulated?: boolean;
}

function Spinner({ size = 16 }: { size?: number }) {
    const s = size
    const b = Math.max(2, Math.round(size / 8))
    return (
        <div
            aria-hidden
            style={{
                width: s,
                height: s,
                borderRadius: 999,
                border: `${b}px solid rgba(0,0,0,0.12)`,
                borderTopColor: "#111827",
                animation: "spin 0.9s linear infinite",
            }}
        />
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    const [open, setOpen] = React.useState(true)

    return (
        <div className="border-b border-gray-100 pb-1">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between text-left font-semibold text-[12px] text-gray-900"
            >
                <span>{title}</span>
                <span className="text-gray-500 text-[10px]">{open ? "▲" : "▼"}</span>
            </button>

            {open && <div className="mt-1 text-[12px] text-gray-800">{children}</div>}
        </div>
    )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
    return (
        <pre className="m-0 whitespace-pre-wrap break-words text-[11px] leading-snug bg-[#0b1020] text-gray-200 p-2.5 rounded-lg overflow-auto">
            <code>{children}</code>
        </pre>
    )
}

/* -------------------------------------------------------------------------- */
/* SidebarChat component                                                       */
/* -------------------------------------------------------------------------- */

export default function SidebarChat({
    onClose,
    currentSchemaId,
    sessionId,
}: {
    /** Optional handler when the user closes the panel. */
    onClose?: () => void
    /** Current schema ID for indexing */
    currentSchemaId?: string
    /** Session ID for chat history */
    sessionId?: string | null
}) {
    const [open, setOpen] = React.useState(true)
    const [messages, setMessages] = React.useState<ChatMessage[]>([])
    const [input, setInput] = React.useState("")
    const [isSending, setIsSending] = React.useState(false)
    const [isIndexing, setIsIndexing] = React.useState(false)
    const [isIndexed, setIsIndexed] = React.useState(false)
    const [indexingProgress, setIndexingProgress] = React.useState("")
    const listRef = React.useRef<HTMLDivElement | null>(null)

    const close = () => {
        setOpen(false)
        onClose?.()
    }

    const scrollToBottom = React.useCallback(() => {
        const el = listRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
    }, [])

    React.useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    // Initialize session and load chat history
    React.useEffect(() => {
        const initializeChat = async () => {
            try {
                // Use passed sessionId or create one
                const currentSessionId = sessionId || localStorage.getItem('ai-chat-sessionId') || crypto.randomUUID()
                if (!sessionId) {
                    localStorage.setItem('ai-chat-sessionId', currentSessionId)
                }

                // Check if schema is indexed
                const indexResponse = await fetch('/api/ai/index')
                if (indexResponse.ok) {
                    const indexData = await indexResponse.json()
                    setIsIndexed(indexData.count > 0)
                }

                // Load chat history
                const historyResponse = await fetch(`/api/ai/chat?sessionId=${currentSessionId}`)
                if (historyResponse.ok) {
                    const historyData = await historyResponse.json()
                    const historyMessages: ChatMessage[] = historyData.messages.map((msg: any) => {
                        const message: ChatMessage = {
                            id: msg.id,
                            role: msg.role as "user" | "assistant",
                            text: msg.content,
                            createdAt: msg.createdAt
                        }
                        
                        // For assistant messages, try to parse structured data from metadata
                        if (msg.role === 'assistant' && msg.metadata) {
                            try {
                                const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata
                                if (metadata.sql || metadata.resultCount !== undefined || metadata.summary || metadata.reasoning) {
                                    (message as any).data = metadata
                                    message.text = '' // Clear text since we'll render with accordions
                                }
                            } catch (e) {
                                // If parsing fails, keep the original text format
                                console.warn('Failed to parse message metadata:', e)
                            }
                        }
                        
                        return message
                    })
                    setMessages(historyMessages)
                }
            } catch (error) {
                console.error('Failed to initialize chat:', error)
            }
        }

        initializeChat()
    }, [sessionId])

    const send = async () => {
        const q = input.trim()
        if (!q || isSending) return

        const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: q, createdAt: Date.now() }
        setMessages((m) => [...m, userMsg])
        setInput("")
        setIsSending(true)

        try {
            // Get current session ID
            const currentSessionId = sessionId || localStorage.getItem('ai-chat-sessionId')
            
            if (!isIndexed) {
                setIsIndexing(true)
                setIndexingProgress("Analyzing your schema...")
                
                // Index the current schema
                const indexResponse = await fetch('/api/ai/index', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        schemaId: currentSchemaId,
                        sessionId: currentSessionId 
                    })
                })
                
                if (indexResponse.ok) {
                    const indexData = await indexResponse.json()
                    setIndexingProgress(`Indexed ${indexData.documentsIndexed} schema elements...`)
                    setIsIndexed(true)
                    
                    // Small delay to show progress
                    await new Promise(resolve => setTimeout(resolve, 500))
                } else {
                    throw new Error('Failed to index schema')
                }
                
                setIsIndexing(false)
                setIndexingProgress("")
            }

            // Send question to AI API
            const response = await fetch('/api/ai/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: q,
                    sessionId: currentSessionId,
                    topK: 8,
                    minScore: 0.2
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Request failed')
            }

            const data = await response.json()
            
            // Store the structured data for accordion rendering
            const aMsg: ChatMessage = { 
                id: crypto.randomUUID(), 
                role: "assistant", 
                text: '', // Empty text since we'll render with accordions
                createdAt: Date.now(),
                data: data // Store the structured response data
            }
            setMessages((m) => [...m, aMsg])
        } catch (err: unknown) {
            const detail = err instanceof Error ? err.message : "Request failed"
            setMessages((m) => [
                ...m,
                { id: crypto.randomUUID(), role: "error", text: String(detail), createdAt: Date.now() },
            ])
        } finally {
            setIsSending(false)
            setIsIndexing(false)
            setIndexingProgress("")
        }
    }

    const clearChat = async () => {
        try {
            const currentSessionId = sessionId || localStorage.getItem('ai-chat-sessionId')
            if (currentSessionId) {
                await fetch(`/api/ai/chat?sessionId=${currentSessionId}`, {
                    method: 'DELETE'
                })
                setMessages([])
            }
        } catch (error) {
            console.error('Failed to clear chat:', error)
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            void send()
        }
    }

    /* -------------------------- Render helpers -------------------------- */

    const renderAssistant = (m: Extract<ChatMessage, { role: "assistant" }>) => {
        // For structured AI responses, render with accordions
        if (m.data && (m.data.sql || m.data.resultCount !== undefined || m.data.summary || m.data.reasoning)) {
            const data = m.data as AIResponseData
            return (
                <div className="space-y-3">
                    <Accordion type="multiple" className="w-full">
                        {/* Generated SQL Section */}
                        {data.sql && (
                            <AccordionItem value="sql" className="border border-purple-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Code className="h-4 w-4 text-purple-600" />
                                        <span className="font-medium text-purple-900">Generated SQL</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                    <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                                        <pre>{data.sql}</pre>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* Table Results Section */}
                        {data.resultCount !== undefined && (
                            <AccordionItem value="results" className="border border-green-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Table className="h-4 w-4 text-green-600" />
                                        <span className="font-medium text-green-900">Query Results</span>
                                        <span className="text-sm text-green-700">({data.resultCount} rows)</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                    {data.result && data.result.length > 0 ? (
                                        <div className="space-y-2">
                                            <div className="text-sm text-slate-600 mb-2">
                                                Showing {data.result.length} of {data.resultCount} rows
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full border-collapse border border-slate-300 text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-100">
                                                            {data.columns?.map((col: string) => (
                                                                <th key={col} className="border border-slate-300 px-3 py-2 text-left font-medium">
                                                                    {col}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {data.result.map((row: Record<string, unknown>, idx: number) => (
                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                {data.columns?.map((col: string) => (
                                                                    <td key={col} className="border border-slate-300 px-3 py-2">
                                                                        {typeof row[col] === 'boolean' ? 
                                                                            (row[col] ? '✓' : '✗') : 
                                                                            String(row[col] || '')
                                                                        }
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-sm">No results found</div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* RAG Similarity Scores Section */}
                        {data.used && data.used.length > 0 && (
                            <AccordionItem value="similarity" className="border border-blue-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Database className="h-4 w-4 text-blue-600" />
                                        <span className="font-medium text-blue-900">RAG Similarity Scores</span>
                                        <span className="text-sm text-blue-700">({data.used.length} items)</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                    <div className="space-y-2">
                                        {data.used.map((item: AIRagItem, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-900">
                                                        {item.table}.{item.key}
                                                    </div>
                                                    <div className="text-sm text-slate-600 mt-1">
                                                        {item.description}
                                                    </div>
                                                    <div className="flex gap-2 mt-2">
                                                        {item.isPrimaryKey && (
                                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">PK</span>
                                                        )}
                                                        {item.isForeignKey && (
                                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">FK</span>
                                                        )}
                                                        <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded">
                                                            {item.kind}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="ml-4 text-right">
                                                    <div className="text-lg font-bold text-blue-600">
                                                        {(item.score * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* Summary Section */}
                        {data.summary && (
                            <AccordionItem value="summary" className="border border-indigo-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Brain className="h-4 w-4 text-indigo-600" />
                                        <span className="font-medium text-indigo-900">Summary</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                    <div className="prose prose-sm max-w-none text-slate-700">
                                        {data.summary.split('\n').map((line: string, idx: number) => (
                                            <p key={idx} className="mb-2 last:mb-0">
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* Reasoning Section */}
                        {data.reasoning && (
                            <AccordionItem value="reasoning" className="border border-orange-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Lightbulb className="h-4 w-4 text-orange-600" />
                                        <span className="font-medium text-orange-900">SQL Reasoning</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                    <div className="space-y-4">
                                        {data.reasoning.tables && (
                                            <div>
                                                <h4 className="font-medium text-slate-900 mb-2">Table Selection:</h4>
                                                <div className="space-y-2">
                                                    {data.reasoning.tables.map((table: AITableReasoning, idx: number) => (
                                                        <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                                            <div className="font-medium text-slate-900">{table.name}</div>
                                                            <div className="text-sm text-slate-600 mt-1">{table.reason}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {data.reasoning.columns && (
                                            <div>
                                                <h4 className="font-medium text-slate-900 mb-2">Column Selection:</h4>
                                                <div className="space-y-2">
                                                    {data.reasoning.columns.map((col: AIColumnReasoning, idx: number) => (
                                                        <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                                            <div className="font-medium text-slate-900">{col.name || col.column}</div>
                                                            <div className="text-sm text-slate-600 mt-1">{col.reason}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {data.reasoning.join_keys && (
                                            <div>
                                                <h4 className="font-medium text-slate-900 mb-2">Join Logic:</h4>
                                                <div className="space-y-2">
                                                    {Array.isArray(data.reasoning.join_keys) ? (
                                                        data.reasoning.join_keys.map((join: AIJoinReasoning, idx: number) => (
                                                            <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                                                <div className="font-medium text-slate-900">
                                                                    {join.left} ↔ {join.right}
                                                                </div>
                                                                <div className="text-sm text-slate-600 mt-1">{join.reason}</div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        Object.entries(data.reasoning.join_keys).map(([key, join]: [string, any], idx: number) => (
                                                            <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                                                <div className="font-medium text-slate-900">
                                                                    {join.left || join.left_table} ↔ {join.right || join.right_table}
                                                                </div>
                                                                <div className="text-sm text-slate-600 mt-1">{join.reason || join.justification}</div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* Suggestions Section */}
                        {data.suggestions && (
                            <AccordionItem value="suggestions" className="border border-teal-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Lightbulb className="h-4 w-4 text-teal-600" />
                                        <span className="font-medium text-teal-900">Suggestions</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                    <div className="space-y-3">
                                        {Object.entries(data.suggestions).map(([key, value]: [string, string]) => (
                                            <div key={key} className="p-3 bg-slate-50 rounded-lg">
                                                <div className="font-medium text-slate-900 capitalize mb-1">
                                                    {key.replace(/_/g, ' ')}
                                                </div>
                                                <div className="text-sm text-slate-600">{value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}
                    </Accordion>
                </div>
            )
        }

        // Fallback to original text rendering for non-structured responses
        if (!m.text) return null

        // Parse markdown-like formatting
        const sections = m.text.split(/\*\*(.*?)\*\*:/g)
        const formattedSections = []

        for (let i = 0; i < sections.length; i += 2) {
            if (i === 0 && sections[i].trim()) {
                formattedSections.push(
                    <div key="intro" className="text-[12px] leading-snug text-gray-900 whitespace-pre-wrap">
                        {sections[i]}
                    </div>
                )
            }
            if (i + 1 < sections.length) {
                const title = sections[i + 1]
                const content = sections[i + 2] || ''
                
                if (title === 'Generated SQL' && content.includes('```sql')) {
                    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/)
                    if (sqlMatch) {
                        formattedSections.push(
                            <Section key={title} title={title}>
                                <CodeBlock>{sqlMatch[1]}</CodeBlock>
                            </Section>
                        )
                    }
                } else {
                    formattedSections.push(
                        <Section key={title} title={title}>
                            <div className="text-[12px] leading-snug text-gray-900 whitespace-pre-wrap">
                                {content.trim()}
                            </div>
                        </Section>
                    )
                }
            }
        }

        return (
            <div className="grid gap-2">
                {formattedSections.length > 0 ? formattedSections : (
                    <div className="text-[12px] leading-snug text-gray-900 whitespace-pre-wrap">
                        {m.text}
                    </div>
                )}
            </div>
        )
    }

    return (
        <aside
            aria-label="AI Chat Sidebar"
            className={`fixed inset-y-0 right-0 bg-gradient-to-br from-white via-purple-50/30 to-indigo-50/30 backdrop-blur-xl z-[920] grid [grid-template-rows:auto_1fr_auto] transition-[width] ease-[cubic-bezier(.4,0,.2,1)] duration-300 ${open ? "w-[420px] border-l border-purple-200/50 shadow-[-10px_0_40px_rgba(139,92,246,0.1)]" : "w-0"
                }`}
        >
            {/* Modern Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-purple-200/30 bg-gradient-to-r from-white/95 via-purple-50/95 to-indigo-50/95 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-sm">
                        <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="font-bold text-[14px] bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            AI Assistant
                        </div>
                        <div className="text-[11px] text-gray-500">
                            {isIndexing ? indexingProgress : isIndexed ? 'Ready' : 'Initializing...'}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    {(isSending || isIndexing) && <Spinner size={14} />}
                    {messages.length > 0 && (
                        <button
                            onClick={clearChat}
                            title="Clear Chat"
                            className="p-2 rounded-lg border border-orange-200/50 bg-white/80 hover:bg-orange-50/80 active:bg-orange-100/80 transition-all duration-200 backdrop-blur-sm"
                        >
                            <svg className="h-4 w-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={close}
                        title="Close"
                        className="p-2 rounded-lg border border-purple-200/50 bg-white/80 hover:bg-purple-50/80 active:bg-purple-100/80 transition-all duration-200 backdrop-blur-sm"
                    >
                        <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={listRef} className="p-4 overflow-auto flex flex-col gap-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="p-4 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl mb-4">
                            <MessageSquare className="h-8 w-8 text-purple-600" />
                        </div>
                        <div className="text-gray-600 text-[13px] leading-relaxed max-w-[280px]">
                            Ask questions about your schema. The AI will analyze your database structure and generate SQL queries with real data results.
                        </div>
                        {!isIndexed && !isIndexing && (
                            <div className="mt-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-[12px] text-orange-700">
                                ⚠️ Schema will be indexed automatically
                            </div>
                        )}
                        {isIndexing && (
                            <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[12px] text-blue-700 flex items-center gap-2">
                                <Spinner size={12} />
                                {indexingProgress}
                            </div>
                        )}
                    </div>
                ) : null}

                {messages.map((m) => {
                    if (m.role === "user") {
                        return (
                            <div key={m.id} className="flex justify-end">
                                <div className="max-w-[280px] bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-3 text-[13px] leading-relaxed shadow-sm">
                                    {m.text}
                                </div>
                            </div>
                        )
                    }

                    if (m.role === "assistant") {
                        return (
                            <div key={m.id} className="flex">
                                <div className="max-w-[320px] bg-white/90 backdrop-blur-sm border border-purple-200/50 rounded-2xl rounded-bl-md p-4 shadow-sm">
                                    {renderAssistant(m)}
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div key={m.id} className="flex justify-center">
                            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-[12px]">
                                {m.text}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Modern Input Area */}
            <div className="border-t border-purple-200/30 bg-gradient-to-r from-white/95 via-purple-50/95 to-indigo-50/95 backdrop-blur-sm p-4">
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Ask about your schema... (e.g., 'Show me all users with their posts')"
                        rows={3}
                        disabled={isSending || isIndexing}
                        className="w-full resize-none p-3 rounded-xl border border-purple-200/50 bg-white/80 backdrop-blur-sm text-[13px] outline-none focus:ring-2 focus:ring-purple-300/50 focus:border-purple-300/50 transition-all duration-200 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <div className="text-[11px] text-gray-400">
                            {isSending || isIndexing ? 'Processing...' : 'Enter to send • Shift+Enter for newline'}
                        </div>
                        <button
                            onClick={send}
                            disabled={isSending || isIndexing || !input.trim()}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                                isSending || isIndexing || !input.trim()
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 shadow-sm hover:shadow-md active:scale-95"
                            }`}
                        >
                            {(isSending || isIndexing) ? (
                                <Spinner size={14} />
                            ) : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </aside>
    )
}
