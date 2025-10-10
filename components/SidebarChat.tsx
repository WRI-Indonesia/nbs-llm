"use client"

import * as React from "react"
import type { ChatMessage } from "@/types"

/* -------------------------------------------------------------------------- */
/* Small UI primitives                                                         */
/* -------------------------------------------------------------------------- */

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

function Code({ children }: { children: React.ReactNode }) {
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
}: {
    /** Optional handler when the user closes the panel. */
    onClose?: () => void
}) {
    const [open, setOpen] = React.useState(true)
    const [messages, setMessages] = React.useState<ChatMessage[]>([])
    const [input, setInput] = React.useState("")
    const [isSending, setIsSending] = React.useState(false)
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

    const send = async () => {
        const q = input.trim()
        if (!q || isSending) return

        const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: q, createdAt: Date.now() }
        setMessages((m) => [...m, userMsg])
        setInput("")
        setIsSending(true)

        try {
            // Simulate AI response (local mode - no API)
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            const responseText = `This is a local demo. In a full implementation, this would connect to an AI service to help you analyze your schema and generate queries.

Your question: "${q}"

To enable real AI features, you would need to:
1. Set up a backend API endpoint
2. Connect to an AI service (OpenAI, Anthropic, etc.)
3. Implement proper schema analysis and SQL generation`
            
            const aMsg: ChatMessage = { 
                id: crypto.randomUUID(), 
                role: "assistant", 
                text: responseText,
                createdAt: Date.now() 
            }
            setMessages((m) => [...m, aMsg])
        } catch (err: any) {
            const detail = err?.message || "Request failed"
            setMessages((m) => [
                ...m,
                { id: crypto.randomUUID(), role: "error", text: String(detail), createdAt: Date.now() },
            ])
        } finally {
            setIsSending(false)
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
        if (!m.text) return null

        return (
            <div className="grid gap-2">
                <Section title="Response">
                    <div className="text-[12px] leading-snug text-gray-900 whitespace-pre-wrap">{m.text}</div>
                </Section>
            </div>
        )
    }

    return (
        <aside
            aria-label="AI Chat Sidebar"
            className={`fixed inset-y-0 right-0 bg-white z-[920] grid [grid-template-rows:auto_1fr_auto] transition-[width] ease-[cubic-bezier(.4,0,.2,1)] duration-150 ${open ? "w-[420px] border-l border-black/10 shadow-[-10px_0_30px_rgba(0,0,0,0.06)]" : "w-0"
                }`}
        >
            {/* header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-black/10 bg-gradient-to-b from-white to-gray-50">
                <div className="font-bold text-[14px]">Ask AI (Local Mode)</div>
                <div className="flex gap-2 items-center">
                    {isSending ? <Spinner /> : null}
                    <button
                        onClick={close}
                        title="Close"
                        className="border border-black/10 bg-white rounded-md px-3 py-1.5 cursor-pointer font-semibold text-[12px] hover:bg-gray-50 active:bg-gray-100"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* messages */}
            <div ref={listRef} className="p-3 overflow-auto flex flex-col gap-3">
                {messages.length === 0 ? (
                    <div className="text-gray-500 text-[12px] leading-snug">
                        Ask questions about your schema. This is currently running in local mode - AI responses are simulated.
                        To enable real AI features, you would need to connect to an AI service.
                    </div>
                ) : null}

                {messages.map((m) => {
                    if (m.role === "user") {
                        return (
                            <div key={m.id} className="flex justify-end">
                                <div className="w-fit max-w-[260px] bg-blue-100 text-gray-900 rounded-md px-2 py-1.5 text-[12px] leading-snug break-words whitespace-pre-line">
                                    {m.text}
                                </div>
                            </div>
                        )
                    }

                    if (m.role === "assistant") {
                        return (
                            <div key={m.id} className="flex">
                                <div className="inline-block w-fit max-w-[360px] bg-gray-50 text-gray-900 p-2.5 rounded-2xl rounded-tl-md text-[12px] leading-snug grid gap-2 border border-black/5">
                                    {renderAssistant(m)}
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div key={m.id} className="text-red-500 text-[11px] leading-snug">
                            {m.text}
                        </div>
                    )
                })}
            </div>

            {/* composer */}
            <div className="border-t border-black/10 p-2.5 grid gap-2">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="e.g. How do I create a new table?"
                    rows={3}
                    className="w-full resize-y p-2 rounded-md border border-black/10 text-[13px] outline-none focus:ring-1 focus:ring-gray-300"
                />
                <div className="flex gap-2 items-center justify-between">
                    <div className="text-[11px] text-gray-500">Enter to send • Shift+Enter for newline</div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={send}
                            disabled={isSending || !input.trim()}
                            className={`border border-black/10 rounded-md px-3 py-2 font-bold text-[12px] ${isSending || !input.trim()
                                ? "bg-gray-200 text-gray-500 cursor-default"
                                : "bg-white hover:bg-gray-50 active:bg-gray-100 cursor-pointer"
                                }`}
                        >
                            {isSending ? (
                                <span className="inline-flex items-center gap-2">
                                    <Spinner /> Sending
                                </span>
                            ) : (
                                "Send"
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </aside>
    )
}
