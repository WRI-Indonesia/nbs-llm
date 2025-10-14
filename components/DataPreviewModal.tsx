"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Search, Database, Eye } from "lucide-react"

interface DataPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableName: string
  data: any[]
  columns: string[]
}

export default function DataPreviewModal({ 
  open, 
  onOpenChange, 
  tableName, 
  data, 
  columns 
}: DataPreviewModalProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const rowsPerPage = 10

  // Filter data based on search term
  const filteredData = React.useMemo(() => {
    if (!searchTerm.trim()) return data
    
    return data.filter(row => 
      Object.values(row).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }, [data, searchTerm])

  // Calculate pagination
  const totalPages = Math.ceil(filteredData.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const currentData = filteredData.slice(startIndex, endIndex)

  // Reset to first page when search changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1))
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages))
  }

  const handleClose = () => {
    onOpenChange(false)
    setSearchTerm("")
    setCurrentPage(1)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogOverlay className="z-[1100]" />
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col z-[1101]">
        <DialogHeader className="space-y-3 pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6 text-blue-600" />
            Data Preview: {tableName}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span>{data.length} total rows</span>
            </div>
            {searchTerm && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {filteredData.length} filtered rows
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Search Bar */}
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search in all columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm("")}
                className="text-slate-500 hover:text-slate-700"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto border rounded-lg min-h-0">
            {currentData.length > 0 ? (
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50">
                  <TableRow>
                    {columns.map((column, index) => (
                      <TableHead key={index} className="font-semibold text-slate-700 text-sm">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((row, rowIndex) => (
                    <TableRow key={rowIndex} className="hover:bg-slate-50 transition-colors">
                      {columns.map((column, colIndex) => (
                        <TableCell key={colIndex} className="text-sm text-slate-600">
                          {row[column] !== null && row[column] !== undefined 
                            ? String(row[column]) 
                            : <span className="text-slate-400 italic">null</span>
                          }
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <Database className="h-12 w-12 mb-4 text-slate-300" />
                <p className="text-lg font-medium">No data found</p>
                <p className="text-sm">
                  {searchTerm ? "Try adjusting your search terms" : "This table has no data"}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
              <div className="text-sm text-slate-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} rows
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
