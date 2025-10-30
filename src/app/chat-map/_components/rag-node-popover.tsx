"use client"

import { FileText, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useChat } from "../_hooks/useChat"
import { useMemo } from "react"

export function RagNodePopover({ id }: { id?: string }) {
  const { messages } = useChat()

  const message = useMemo(() => messages.find((m) => m.id === id), [id, messages])

  const docs = useMemo(() => {
    try {
      const raw = message?.ragNodeDocuments
      if (!raw) return []
      const parsed = JSON.parse(raw as string)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [message])

  if (docs.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
        >
          <Lightbulb className="w-3 h-3" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-3" align="start">
        <div className="flex h-[40vh] flex-col gap-4">
          <div className="flex flex-col min-h-0">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-200">
              <FileText className="w-4 h-4 text-green-600" />
              <h4 className="text-sm font-medium">Relevant Columns</h4>
              <Badge variant="secondary" className="text-xs">
                {docs.length}
              </Badge>
            </div>

            <div className="mt-2 flex-1 overflow-y-auto space-y-2 pr-1">
              {docs.map((doc) => (
                <Card key={doc.id} className="p-3">
                  <div className="space-y-2">
                    <Badge variant="secondary" className="text-xs">
                      {(doc.similarity * 100).toFixed(1)}%
                    </Badge>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {doc.document_text}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
