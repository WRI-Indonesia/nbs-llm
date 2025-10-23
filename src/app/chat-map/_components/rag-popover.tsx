"use client"

import { useMemo } from "react"
import { FileText } from "lucide-react"
import { LuBook } from "react-icons/lu"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface RagPopoverProps {
  ragDocuments?: Array<{
    id: string
    tableName: string
    text: string
    similarity: number
    documentType: string
  }>
}

export function RagPopover({ ragDocuments }: RagPopoverProps) {
  const hasData = useMemo(() => ragDocuments && ragDocuments.length > 0, [ragDocuments])
  if (!hasData) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
        >
          <LuBook className="w-3 h-3" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-3" align="start">
        <div className="flex h-[40vh] min-h-0 flex-col gap-4">
          {/* RAG Documents Section */}
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-200">
              <FileText className="w-4 h-4 text-green-600" />
              <h4 className="text-sm font-medium">Relevant Documents</h4>
              <Badge variant="secondary" className="text-xs">
                {ragDocuments!.length}
              </Badge>
            </div>

            {/* This is the scroll area */}
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {ragDocuments!.map((doc) => (
                <Card key={doc.id} className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={doc.documentType === "table" ? "default" : "outline"}
                          className="text-xs"
                        >
                          {doc.documentType}
                        </Badge>
                        <span className="text-xs font-medium text-gray-700">
                          {doc.tableName}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {(doc.similarity * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {doc.text}
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
