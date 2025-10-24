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

interface DataPopoverProps {
  data?: Array<Record<string, any>>
}

export function DataPopover({ data }: DataPopoverProps) {
  const { getDataColumns, hasData } = useChat()
  
  const columns = getDataColumns(data)
  const hasValidData = hasData(data)
  
  if (!hasValidData) return null

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

      <PopoverContent className="w-[600px] p-3" align="start">
        <div className="flex h-[40vh] min-h-0 flex-col gap-4">
          {/* Data Table Section */}
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-200">
              <Table className="w-4 h-4 text-purple-600" />
              <h4 className="text-sm font-medium">Query Results</h4>
              <Badge variant="secondary" className="text-xs">
                {data!.length} rows
              </Badge>
            </div>

            {/* Table Container */}
            <div className="mt-2 flex-1 min-h-0 flex flex-col">
              {/* Static Header */}
              <div className="flex-shrink-0">
                <TableComponent>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column} className="text-xs font-medium">
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                </TableComponent>
              </div>
              
              {/* Scrollable Body */}
              <div className="flex-1 min-h-0 overflow-auto">
                <TableComponent>
                  <TableBody>
                    {data!.map((row, index) => (
                      <TableRow key={index}>
                        {columns.map((column) => (
                          <TableCell key={column} className="text-xs">
                            {row[column] !== null && row[column] !== undefined 
                              ? String(row[column]) 
                              : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
