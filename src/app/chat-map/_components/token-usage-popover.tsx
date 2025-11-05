"use client"

import { Sigma } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card } from '@/components/ui/card'
import { useChat } from '../_hooks/useChat'
import { useMemo } from 'react'

export function TokenUsagePopover({ id }: { id?: string }) {
    const { messages } = useChat()
    const meta = useMemo(() => messages.find((m) => m.id === id) as any, [id, messages])
    if (!meta) return null

    const tokenUsage = meta.tokenUsage || (() => {
        try {
            return meta.improvedPrompt ? JSON.parse(meta.improvedPrompt)?.tokenUsage : null
        } catch { return null }
    })()

    const tokenCost = meta.tokenCost || null

    if (!tokenUsage && !tokenCost) return null

    const fmtUsd = (n?: number) => (typeof n === 'number' ? `$${n.toFixed(6)}` : '-')

    const emb = tokenUsage?.embedding
    const sql = tokenUsage?.sql
    const sum = tokenUsage?.summarize
    const total = tokenUsage?.total

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                    title="Show token usage & cost"
                >
                    <Sigma className="w-3 h-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[440px] max-h-[80vh] overflow-y-auto" align="start">
                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3 pb-2 border-b border-neutral-200">
                        <div className="flex items-center gap-2">
                            <Sigma className="w-4 h-4 text-slate-700" />
                            <h4 className="text-sm font-medium">Token usage & estimated cost</h4>
                        </div>
                        {tokenCost && (
                            <div className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5">
                                Total: {fmtUsd(tokenCost.totalUsd)}
                            </div>
                        )}
                    </div>

                    <div className="text-[11px] leading-relaxed text-slate-600">
                        This reflects tokens consumed across the stages of your request. Costs are computed using your configured OpenAI model prices (USD per 1K tokens) and shown as an estimate.
                    </div>

                    <Card className="p-3 bg-white rounded-md border">
                        <div className="text-xs text-gray-800 space-y-3">
                            {emb && (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium text-slate-700">Embedding</div>
                                        <div className="text-slate-500">P: <span className="font-mono">{emb.prompt}</span></div>
                                    </div>
                                    <div className="text-[11px] text-slate-500">Tokens used to create the query embedding vector.</div>
                                    {tokenCost && (
                                        <div className="text-[11px] text-slate-700">Cost: <span className="font-mono">{fmtUsd(tokenCost.embeddingUsd)}</span></div>
                                    )}
                                </div>
                            )}

                            {sql && (
                                <div className="pt-2 border-t border-neutral-200">
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium text-slate-700">SQL generation</div>
                                        <div className="text-slate-500">P: <span className="font-mono">{sql.prompt}</span> · C: <span className="font-mono">{sql.completion}</span></div>
                                    </div>
                                    <div className="text-[11px] text-slate-500">LLM tokens used to generate the SQL query from schema/context.</div>
                                    {tokenCost && (
                                        <div className="text-[11px] text-slate-700">Cost: <span className="font-mono">{fmtUsd(tokenCost.sqlUsd)}</span></div>
                                    )}
                                </div>
                            )}

                            {sum && (
                                <div className="pt-2 border-t border-neutral-200">
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium text-slate-700">Summarization</div>
                                        <div className="text-slate-500">P: <span className="font-mono">{sum.prompt}</span> · C: <span className="font-mono">{sum.completion}</span></div>
                                    </div>
                                    <div className="text-[11px] text-slate-500">Prompt includes system+user content and truncated data/context; completion is the final answer.</div>
                                    {tokenCost && (
                                        <div className="text-[11px] text-slate-700">Cost: <span className="font-mono">{fmtUsd(tokenCost.summarizeUsd)}</span></div>
                                    )}
                                </div>
                            )}

                            <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                                <div className="font-medium text-slate-700">Totals</div>
                                <div className="text-slate-700">
                                    Tokens: <span className="font-mono">{typeof total === 'number' ? total : '-'}</span>
                                    {tokenCost && (
                                        <>
                                            <span className="mx-2 text-slate-400">|</span>
                                            Cost: <span className="font-mono">{fmtUsd(tokenCost.totalUsd)}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <div className="text-[11px] text-slate-500">
                        Note: Some values may be estimates if the provider does not return exact token usage for a stage.
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}


