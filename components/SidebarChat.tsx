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


interface AIResponseData {
    ok: boolean;
    sql_initial?: string;
    sql_final?: string;
    executed?: boolean;
    error?: string;
    rows?: unknown[];
    used?: AIRagItem[];
    summary?: string;
    suggestions?: string[];
    derivation?: {
        from_prompt: string[];
        from_data: string[];
        join_logic: string[];
    };
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
                const currentSessionId = sessionId || localStorage.getItem('etl-ai-sessionId') || crypto.randomUUID()
                if (!sessionId) {
                    localStorage.setItem('etl-ai-sessionId', currentSessionId)
                }

                // Check if schema is indexed for current schema
                const schemaIdToCheck = currentSchemaId && currentSchemaId !== 'undefined' ? currentSchemaId : null
                const indexCheckUrl = schemaIdToCheck 
                    ? `/api/ai/index?schemaId=${schemaIdToCheck}`
                    : `/api/ai/index?sessionId=${currentSessionId}`
                
                const indexResponse = await fetch(indexCheckUrl)
                if (indexResponse.ok) {
                    const indexData = await indexResponse.json()
                    setIsIndexed(indexData.count > 0)
                } else {
                    setIsIndexed(false)
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
                                if (metadata.sql_final || metadata.sql_initial || metadata.rows || metadata.summary || metadata.suggestions || metadata.derivation) {
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

    // Check if index needs to be updated based on schema changes
    const checkAndUpdateIndex = React.useCallback(async () => {
        try {
            const currentSessionId = sessionId || localStorage.getItem('etl-ai-sessionId')
            if (!currentSessionId) {
                console.error('No session ID available for indexing')
                return false
            }

            // If currentSchemaId is undefined, we'll rely on sessionId to find the schema
            const schemaIdToUse = currentSchemaId && currentSchemaId !== 'undefined' ? currentSchemaId : null
            
            console.log('Checking index with:', { schemaId: schemaIdToUse, sessionId: currentSessionId })

            // Check current index status
            const indexStatusUrl = schemaIdToUse 
                ? `/api/ai/index?schemaId=${schemaIdToUse}`
                : `/api/ai/index?sessionId=${currentSessionId}`
            
            const indexStatusResponse = await fetch(indexStatusUrl)
            if (!indexStatusResponse.ok) {
                console.error('Failed to check index status:', await indexStatusResponse.text())
                return false
            }
            
            const { count } = await indexStatusResponse.json()
            console.log('Current index count:', count)
            
            // If no index exists, we need to create one
            if (count === 0) {
                setIsIndexing(true)
                setIndexingProgress("Creating index for your schema...")
                
                const indexResponse = await fetch('/api/ai/index', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        schemaId: schemaIdToUse,
                        sessionId: currentSessionId 
                    })
                })
                
                if (indexResponse.ok) {
                    const indexData = await indexResponse.json()
                    setIndexingProgress(`Indexed ${indexData.documentsIndexed} schema elements...`)
                    setIsIndexed(true)
                    
                    // Small delay to show progress
                    await new Promise(resolve => setTimeout(resolve, 500))
                    setIsIndexing(false)
                    setIndexingProgress("")
                    return true
                } else {
                    const errorData = await indexResponse.json()
                    console.error('Failed to create index:', errorData)
                    throw new Error(errorData.error || 'Failed to create index')
                }
            }
            
            // Index exists, check if it needs updating
            // For now, we'll update the index to ensure it's current with any schema changes
            // This ensures the index is always up-to-date with the latest schema modifications
            setIsIndexing(true)
            setIndexingProgress("Updating index with latest schema changes...")
            
            const indexResponse = await fetch('/api/ai/index', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    schemaId: schemaIdToUse,
                    sessionId: currentSessionId 
                })
            })
            
            if (indexResponse.ok) {
                const indexData = await indexResponse.json()
                setIndexingProgress(`Updated index with ${indexData.documentsIndexed} schema elements...`)
                setIsIndexed(true)
                
                // Small delay to show progress
                await new Promise(resolve => setTimeout(resolve, 500))
                setIsIndexing(false)
                setIndexingProgress("")
                return true
            } else {
                const errorData = await indexResponse.json()
                console.error('Failed to update index:', errorData)
                throw new Error(errorData.error || 'Failed to update index')
            }
        } catch (error) {
            console.error('Index check/update failed:', error)
            setIsIndexing(false)
            setIndexingProgress("")
            return false
        }
    }, [currentSchemaId, sessionId])

    const send = async () => {
        const q = input.trim()
        if (!q || isSending) return

        const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: q, createdAt: Date.now() }
        setMessages((m) => [...m, userMsg])
        setInput("")
        setIsSending(true)

        try {
            // Get current session ID
            const currentSessionId = sessionId || localStorage.getItem('etl-ai-sessionId')
            
            // Always check and update index before asking questions
            const indexReady = await checkAndUpdateIndex()
            if (!indexReady) {
                throw new Error('Failed to prepare index for querying')
            }

            // Send question to AI API
            const response = await fetch('/api/ai/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: q,
                    topK: 8,
                    minScore: 0.1, // Lower threshold for better matching
                    chatModel: 'gpt-4o-mini',
                    useGraphJson: true,
                    schemaId: currentSchemaId,
                    execute: true,
                    sessionId: currentSessionId
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
            const currentSessionId = sessionId || localStorage.getItem('etl-ai-sessionId')
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
        if (m.data && (m.data.sql_final || m.data.sql_initial || m.data.rows || m.data.summary || m.data.suggestions || m.data.derivation)) {
            const data = m.data as AIResponseData
            return (
                <div className="space-y-3">
                    <Accordion type="multiple" className="w-full">
                        {/* Generated SQL Section */}
                        {(data.sql_final || data.sql_initial) && (
                            <AccordionItem value="sql" className="border border-purple-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Code className="h-4 w-4 text-purple-600" />
                                        <span className="font-medium text-purple-900">Generated SQL</span>
                                        {data.error && (
                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                                Error
                                            </span>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pt-4 pb-4">
                                    <div className="space-y-4">
                                        {data.sql_initial && (
                                            <div>
                                                <div className="text-sm font-medium text-slate-700 mb-2">Initial SQL (Plain Tables):</div>
                                                <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                                                    <pre>{data.sql_initial}</pre>
                                                </div>
                                            </div>
                                        )}
                                        {data.error && (
                                            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                                                <div className="text-sm font-medium text-red-800 mb-1">Execution Error:</div>
                                                <div className="text-sm text-red-700">{data.error}</div>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* Table Results Section */}
                        {data.rows && data.rows.length > 0 && (
                            <AccordionItem value="results" className="border border-green-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Table className="h-4 w-4 text-green-600" />
                                        <span className="font-medium text-green-900">Query Results</span>
                                        <span className="text-sm text-green-700">({data.rows.length} rows)</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pt-4 pb-4">
                                    <div className="space-y-2">
                                        <div className="text-sm text-slate-600 mb-2">
                                            Showing {data.rows.length} rows
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse border border-slate-300 text-sm">
                                                <thead>
                                                    <tr className="bg-slate-100">
                                                        {Object.keys(data.rows[0] as Record<string, unknown>).map((col: string) => (
                                                            <th key={col} className="border border-slate-300 px-3 py-2 text-left font-medium">
                                                                {col}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.rows.map((row: unknown, idx: number) => {
                                                        const rowData = row as Record<string, unknown>
                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                {Object.entries(rowData).map(([col, value]) => (
                                                                    <td key={col} className="border border-slate-300 px-3 py-2">
                                                                        {typeof value === 'boolean' ? 
                                                                            (value ? '✓' : '✗') : 
                                                                            String(value || '')
                                                                        }
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
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
                                <AccordionContent className="px-4 pt-4 pb-4">
                                    <div className="space-y-2">
                                        {data.used.map((item: AIRagItem, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-900">
                                                        {item.key}
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
                                                        {item.table && (
                                                            <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded">
                                                                {item.table}
                                                            </span>
                                                        )}
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
                                <AccordionContent className="px-4 pt-4 pb-4">
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

                        {/* Derivation Section */}
                        {data.derivation && (
                            <AccordionItem value="derivation" className="border border-orange-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Lightbulb className="h-4 w-4 text-orange-600" />
                                        <span className="font-medium text-orange-900">Derivation</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pt-4 pb-4">
                                    <div className="space-y-4">
                                        {data.derivation.from_prompt && data.derivation.from_prompt.length > 0 && (
                                            <div>
                                                <div className="text-sm font-medium text-slate-700 mb-2">From Prompt:</div>
                                                <div className="space-y-2">
                                                    {data.derivation.from_prompt.map((item: string, idx: number) => (
                                                        <div key={idx} className="p-2 bg-blue-50 rounded-lg text-sm text-slate-700">
                                                            {item}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {data.derivation.from_data && data.derivation.from_data.length > 0 && (
                                            <div>
                                                <div className="text-sm font-medium text-slate-700 mb-2">From Data:</div>
                                                <div className="space-y-2">
                                                    {data.derivation.from_data.map((item: string, idx: number) => (
                                                        <div key={idx} className="p-2 bg-green-50 rounded-lg text-sm text-slate-700">
                                                            {item}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {data.derivation.join_logic && data.derivation.join_logic.length > 0 && (
                                            <div>
                                                <div className="text-sm font-medium text-slate-700 mb-2">Join Logic:</div>
                                                <div className="space-y-2">
                                                    {data.derivation.join_logic.map((item: string, idx: number) => (
                                                        <div key={idx} className="p-2 bg-purple-50 rounded-lg text-sm text-slate-700">
                                                            {item}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* Suggestions Section */}
                        {data.suggestions && data.suggestions.length > 0 && (
                            <AccordionItem value="suggestions" className="border border-teal-200 rounded-lg">
                                <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-t-lg hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Lightbulb className="h-4 w-4 text-teal-600" />
                                        <span className="font-medium text-teal-900">Suggestions</span>
                                        <span className="text-sm text-teal-700">({data.suggestions.length} items)</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pt-4 pb-4">
                                    <div className="space-y-3">
                                        {data.suggestions.map((suggestion: string, idx: number) => (
                                            <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                                <div className="text-sm text-slate-700">{suggestion}</div>
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
            className={`fixed inset-y-0 right-0 bg-gradient-to-br from-white via-purple-50/30 to-indigo-50/30 backdrop-blur-xl z-[920] grid [grid-template-rows:auto_1fr_auto] transition-[width] ease-[cubic-bezier(.4,0,.2,1)] duration-300 ${open ? "w-[600px] border-l border-purple-200/50 shadow-[-10px_0_40px_rgba(139,92,246,0.1)]" : "w-0"
                }`}
        >
            {/* Modern Header */}
            <div className="flex items-center justify-between px-4 py-3 mt-[75px] border-b border-purple-200/30 bg-gradient-to-r from-white/95 via-purple-50/95 to-indigo-50/95 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-sm">
                        <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="font-bold text-[14px] bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            AI Assistant
                        </div>
                        <div className="text-[11px] text-gray-500">
                            {isIndexing ? indexingProgress : isIndexed ? 'Ready - Index will update automatically' : 'Ready - Index will be created automatically'}
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
                            <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[12px] text-blue-700">
                                🔄 Schema will be indexed automatically when you ask a question
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
                                <div className="max-w-[500px] bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-3 text-[13px] leading-relaxed shadow-sm">
                                    {m.text}
                                </div>
                            </div>
                        )
                    }

                    if (m.role === "assistant") {
                        return (
                            <div key={m.id} className="flex">
                                <div className="max-w-[500px] bg-white/90 backdrop-blur-sm border border-purple-200/50 rounded-2xl rounded-bl-md p-4 shadow-sm">
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
                                <svg className="h-4 w-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
