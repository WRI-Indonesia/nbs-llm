"use client"

import { Table } from "lucide-react"
import { LuTable } from "react-icons/lu"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useChat } from "../_hooks/useChat"
import { useMemo } from "react"

/**
 * DataPopover (JSON string of array of objects → table)
 * - Assumes message.data is ALWAYS a JSON string that parses to an ARRAY OF OBJECTS
 * - Infers columns from keys, preferring the first row's key order, then union extras
 */
export function DataPopover({ id }: { id?: string }) {
  const { messages } = useChat()

  const message = useMemo(() => messages.find((m) => m.id === id), [id, messages])

  // Parse once: MUST be a string of array of objects
  const rows = useMemo<Record<string, unknown>[]>(() => {
    if (!message?.data || typeof message.data !== "string") return []
    try {
      const parsed = JSON.parse(message.data)
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : []
    } catch {
      return []
    }
  }, [message?.data])

  // Columns: keep first row order, then append any new keys found later
  const columns = useMemo(() => {
    if (rows.length === 0) return [] as string[]
    const first = Object.keys(rows[0] ?? {})
    const seen = new Set(first)
    for (const r of rows) {
      for (const k of Object.keys(r ?? {})) {
        if (!seen.has(k)) {
          seen.add(k)
          first.push(k)
        }
      }
    }
    return first
  }, [rows])

  if (rows.length === 0) return null

  const renderCell = (value: unknown) => {
    if (value === null || value === undefined) return "-"
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
    try {
      return JSON.stringify(value)
    } catch {
      return "[unserializable]"
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
        >
          <LuTable className="w-3 h-3" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[720px] p-3" align="start">
        <div className="flex h-[50vh] min-h-0 flex-col gap-4">
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-200">
              <Table className="w-4 h-4 text-purple-600" />
              <h4 className="text-sm font-medium">Query Results</h4>
              <Badge variant="secondary" className="text-xs">
                {rows.length} rows
              </Badge>
            </div>

            <div className="mt-2 flex-1 min-h-0 flex flex-col overflow-auto rounded-md border border-neutral-200">
              <TableComponent>
                <TableHeader className="sticky top-0 bg-white/90 backdrop-blur z-10">
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column} className="text-xs font-medium whitespace-nowrap">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      {columns.map((column) => (
                        <TableCell key={column} className="text-xs align-top">
                          {renderCell((row as Record<string, unknown>)[column])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </TableComponent>
            </div>

            {columns.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">No displayable fields found.</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
