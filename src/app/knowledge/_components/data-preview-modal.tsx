"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Search, Database, Eye, X, ArrowUpAZ, ArrowDownAZ } from "lucide-react"
import clsx from "clsx"

interface ColumnConfig {
    key: string
    label?: string
    width?: string
    align?: "left" | "center" | "right"
    /** whether this column is sortable (default: true) */
    sortable?: boolean
    /** override how to read the value for sorting */
    sortAccessor?: (row: any) => unknown
    /** hint for comparator; if omitted we infer */
    sortType?: "string" | "number" | "date"
}

interface DataPreviewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tableName: string
    data: any[]
    columns: string[] | ColumnConfig[]
    rowsPerPage?: number
}

const DEFAULT_ROWS_PER_PAGE = 10 as const

type SortDirection = "asc" | "desc"

export function DataPreviewModal({
    open,
    onOpenChange,
    tableName,
    data,
    columns,
    rowsPerPage = DEFAULT_ROWS_PER_PAGE,
}: DataPreviewModalProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<SortDirection>("asc")
    const deferredSearch = useDeferredValue(searchTerm)

    const columnDefs: ColumnConfig[] = useMemo(() => {
        if (!columns?.length) return []
        if (typeof (columns as any[])[0] === "string") {
            return (columns as string[]).map((c) => ({ key: c, label: c, sortable: true }))
        }
        return (columns as ColumnConfig[]).map((c) => ({ sortable: true, ...c }))
    }, [columns])

    const widths = useMemo(() => {
        const remainingWidth = `minmax(8rem, 1fr)`
        return columnDefs.map((c) => c.width ?? remainingWidth)
    }, [columnDefs])

    // --- Search & Filter -----------------------------------------------------
    const normalizedQuery = deferredSearch.trim().toLowerCase()
    const filteredData = useMemo(() => {
        if (!normalizedQuery) return data
        return data.filter((row) =>
            Object.values(row ?? {}).some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery))
        )
    }, [data, normalizedQuery])

    // --- Sorting -------------------------------------------------------------
    const inferType = (val: unknown): ColumnConfig["sortType"] => {
        if (val == null) return "string"
        if (typeof val === "number") return "number"
        // detect ISO-like dates or Date objects
        if (val instanceof Date) return "date"
        const s = String(val)
        if (!Number.isNaN(Number(s)) && s.trim() !== "") return "number"
        if (!Number.isNaN(Date.parse(s))) return "date"
        return "string"
    }

    const comparator = (a: any, b: any, type: ColumnConfig["sortType"]) => {
        if (a == null && b == null) return 0
        if (a == null) return -1
        if (b == null) return 1
        switch (type) {
            case "number": {
                const na = typeof a === "number" ? a : Number(a)
                const nb = typeof b === "number" ? b : Number(b)
                return na === nb ? 0 : na < nb ? -1 : 1
            }
            case "date": {
                const ta = a instanceof Date ? a.getTime() : Date.parse(String(a))
                const tb = b instanceof Date ? b.getTime() : Date.parse(String(b))
                return ta === tb ? 0 : ta < tb ? -1 : 1
            }
            default: {
                const sa = String(a).toLowerCase()
                const sb = String(b).toLowerCase()
                return sa.localeCompare(sb)
            }
        }
    }

    const sortedData = useMemo(() => {
        if (!sortKey) return filteredData
        const col = columnDefs.find((c) => c.key === sortKey)
        if (!col) return filteredData
        const type = col.sortType ?? inferType(col.sortAccessor ? col.sortAccessor(filteredData[0]) : filteredData[0]?.[col.key])
        const copy = [...filteredData]
        copy.sort((ra, rb) => {
            const va = col.sortAccessor ? col.sortAccessor(ra) : ra?.[col.key]
            const vb = col.sortAccessor ? col.sortAccessor(rb) : rb?.[col.key]
            const cmp = comparator(va, vb, type)
            return sortDir === "asc" ? cmp : -cmp
        })
        return copy
    }, [filteredData, sortKey, sortDir, columnDefs])

    // --- Pagination ----------------------------------------------------------
    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(sortedData.length / rowsPerPage)),
        [sortedData.length, rowsPerPage]
    )

    const { startIndex, endIndex } = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage
        return { startIndex: start, endIndex: start + rowsPerPage }
    }, [currentPage, rowsPerPage])

    const currentData = useMemo(() => sortedData.slice(startIndex, endIndex), [sortedData, startIndex, endIndex])

    useEffect(() => {
        setCurrentPage(1)
    }, [normalizedQuery, sortKey, sortDir])

    const handlePreviousPage = useCallback(() => setCurrentPage((p) => Math.max(p - 1, 1)), [])
    const handleNextPage = useCallback(() => setCurrentPage((p) => Math.min(p + 1, totalPages)), [totalPages])
    const setPage = useCallback((page: number) => setCurrentPage(page), [])

    const handleClose = useCallback(() => {
        onOpenChange(false)
        setSearchTerm("")
        setCurrentPage(1)
        setSortKey(null)
        setSortDir("asc")
    }, [onOpenChange])

    const pageNumbers = useMemo(() => {
        const count = Math.min(5, totalPages)
        const nums: number[] = []
        for (let i = 0; i < count; i++) {
            let pageNum: number
            if (totalPages <= 5) {
                pageNum = i + 1
            } else if (currentPage <= 3) {
                pageNum = i + 1
            } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
            } else {
                pageNum = currentPage - 2 + i
            }
            nums.push(pageNum)
        }
        return nums
    }, [currentPage, totalPages])

    // --- Highlight helper ----------------------------------------------------
    const highlight = useCallback(
        (text: string) => {
            if (!normalizedQuery) return text
            const idx = text.toLowerCase().indexOf(normalizedQuery)
            if (idx === -1) return text
            const before = text.slice(0, idx)
            const match = text.slice(idx, idx + normalizedQuery.length)
            const after = text.slice(idx + normalizedQuery.length)
            return (
                <>
                    {before}
                    <mark className="rounded bg-yellow-100 px-0.5 py-0 text-yellow-900">{match}</mark>
                    {after}
                </>
            )
        },
        [normalizedQuery]
    )

    const toggleSort = (key: string, enabled: boolean | undefined) => {
        if (enabled === false) return
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        } else {
            setSortKey(key)
            setSortDir("asc")
        }
    }

    const sortIcon = (key: string) => {
        if (sortKey !== key) return null
        return sortDir === "asc" ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogPortal>
                <DialogContent className="sm:max-w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="space-y-3 p-6 pb-4 border-b flex-shrink-0">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <Eye className="h-6 w-6 text-blue-600" />
                            Data Preview: {tableName}
                        </DialogTitle>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                <span>{data.length} total rows</span>
                            </div>
                            {normalizedQuery && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                    {filteredData.length} filtered rows
                                </Badge>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="flex flex-col flex-1 overflow-hidden p-6 pt-4 gap-4">
                        {/* Search */}
                        <form
                            className="flex items-center gap-2 flex-shrink-0"
                            onSubmit={(e) => {
                                e.preventDefault()
                            }}
                        >
                            <div className="relative w-full max-w-xl">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    aria-label="Search all columns"
                                    className="pl-9 pr-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search in all columns…"
                                />
                                {!!searchTerm && (
                                    <button
                                        type="button"
                                        aria-label="Clear search"
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                                    >
                                        <X className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                )}
                            </div>
                        </form>

                        {/* Table */}
                        <div className="flex-1 overflow-auto border rounded-lg min-h-0">
                            {currentData.length > 0 ? (
                                <div className="w-full">
                                    <Table className="table-fixed">
                                        <colgroup>
                                            {widths.map((w, i) => (
                                                <col key={i} style={{ width: w }} />
                                            ))}
                                        </colgroup>
                                        <TableHeader className="sticky top-0 bg-slate-50 shadow-[inset_0_-1px_0_theme(colors.slate.200)]">
                                            <TableRow>
                                                {columnDefs.map((col) => (
                                                    <TableHead
                                                        key={col.key}
                                                        className={clsx(
                                                            "font-medium text-slate-700 text-sm whitespace-nowrap overflow-hidden text-ellipsis select-none",
                                                            col.align === "center" && "text-center",
                                                            col.align === "right" && "text-right"
                                                        )}
                                                        title={col.label ?? col.key}
                                                    >
                                                        <button
                                                            type="button"
                                                            className={clsx(
                                                                "inline-flex items-center gap-1.5 hover:text-slate-900",
                                                                col.sortable !== false ? "cursor-pointer" : "cursor-default"
                                                            )}
                                                            onClick={() => toggleSort(col.key, col.sortable)}
                                                        >
                                                            <span className="truncate max-w-20">{col.label ?? col.key}</span>
                                                            {sortIcon(col.key)}
                                                        </button>
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentData.map((row, rowIndex) => (
                                                <TableRow key={rowIndex} className={clsx("transition-colors", rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/30", "hover:bg-slate-50")}>
                                                    {columnDefs.map((col) => {
                                                        const raw = row?.[col.key]
                                                        const value = raw == null ? "" : String(raw)
                                                        return (
                                                            <TableCell
                                                                key={col.key}
                                                                className={clsx(
                                                                    "text-sm text-slate-700 align-top whitespace-nowrap overflow-hidden text-ellipsis py-2.5",
                                                                    col.align === "center" && "text-center",
                                                                    col.align === "right" && "text-right"
                                                                )}
                                                                title={value || "null"}
                                                            >
                                                                {value ? (
                                                                    <span className="block truncate">{highlight(value)}</span>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">null</span>
                                                                )}
                                                            </TableCell>
                                                        )
                                                    })}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                    <Database className="h-12 w-12 mb-4 text-slate-300" />
                                    <p className="text-lg font-medium">No data found</p>
                                    <p className="text-sm">
                                        {normalizedQuery ? "Try adjusting your search terms" : "This table has no data"}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-2 border-t flex-shrink-0">
                                <div className="text-sm text-slate-600">
                                    Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} rows
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
                                        {pageNumbers.map((pageNum) => (
                                            <Button
                                                key={pageNum}
                                                variant={currentPage === pageNum ? "default" : "ghost"}
                                                size="sm"
                                                onClick={() => setPage(pageNum)}
                                                className="w-8 h-8 p-0"
                                                aria-current={currentPage === pageNum ? "page" : undefined}
                                                aria-label={`Go to page ${pageNum}`}
                                            >
                                                {pageNum}
                                            </Button>
                                        ))}
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
