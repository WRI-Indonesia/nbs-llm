'use client'

import { useCallback, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Column, ColumnType, TableNodeData } from "@/types/table-nodes"
import { Download, Eye, KeyRound, Link2, Upload } from "lucide-react"
import { Handle, Position } from "@xyflow/react"
import { Card, CardContent } from "@/components/ui/card"
import { EditSchemaModal } from "./edit-schema-modal"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { DataPreviewModal } from "./data-preview-modal"
import { safeId } from "../utils"

type ParsedResult = {
    columns: Column[]
    data: any[]
    metadata: { table: string; description: string }
}

function TableNode({ id, data }: { id: string; data: TableNodeData }) {
    const { table, description, columns = [] } = data
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [previewOpen, setPreviewOpen] = useState(false)

    // Never throws/rejects. Returns `null` on any failure, with toast.error already shown.
    const parseExcelFile = useCallback(
        (file: File): Promise<ParsedResult | null> =>
            new Promise((resolve) => {
                const reader = new FileReader()

                reader.onload = (e) => {
                    try {
                        const bytes = new Uint8Array(e.target?.result as ArrayBuffer)
                        const workbook = XLSX.read(bytes, { type: "array" })

                        const metadataSheet = workbook.Sheets["Metadata"]
                        if (!metadataSheet) {
                            toast.error("Excel Import Failed", {
                                description: "Metadata sheet not found. Please add a sheet named “Metadata”.",
                                duration: 5000,
                            })
                            return resolve(null)
                        }

                        const metadataData = XLSX.utils.sheet_to_json(metadataSheet, { header: 1 }) as any[][]
                        const tableName = (metadataData[0]?.[1] as string) || ""
                        const desc = (metadataData[1]?.[1] as string) || ""

                        const parsedColumns: Column[] = []
                        for (let i = 4; i < metadataData.length; i++) {
                            const row = metadataData[i]
                            if (row && row[0]) {
                                parsedColumns.push({
                                    name: String(row[0]),
                                    type: ((row[1] as ColumnType) || "text") as ColumnType,
                                    description: (row[2] as string) || "",
                                    isPrimaryKey: row[3] === "Yes",
                                    isForeignKey: row[4] === "Yes",
                                    references: row[5] ? { table: String(row[5]) } : undefined,
                                })
                            }
                        }

                        const dataSheet = workbook.Sheets["Data"]
                        let parsedData: any[] = []
                        if (dataSheet) {
                            const dataArray = XLSX.utils.sheet_to_json(dataSheet, { header: 1 }) as any[][]
                            if (Array.isArray(dataArray) && dataArray.length > 1) {
                                const headers = (dataArray[0] as string[]).map((h) => String(h))
                                parsedData = dataArray.slice(1).map((row) => {
                                    const obj: any = {}
                                    headers.forEach((header, index) => {
                                        obj[header] = row?.[index] ?? ""
                                    })
                                    return obj
                                })
                            }
                        }

                        return resolve({
                            columns: parsedColumns,
                            data: parsedData,
                            metadata: { table: tableName, description: desc },
                        })
                    } catch {
                        toast.error("Excel Import Failed", {
                            description: "The file could not be parsed. Ensure it follows the expected template.",
                            duration: 5000,
                        })
                        return resolve(null)
                    }
                }

                reader.onerror = () => {
                    toast.error("Excel Import Failed", {
                        description: "Failed to read file. Please try again or choose a different Excel file.",
                        duration: 5000,
                    })
                    return resolve(null)
                }

                try {
                    reader.readAsArrayBuffer(file)
                } catch {
                    toast.error("Excel Import Failed", {
                        description: "Could not start file read. Please try a different file.",
                        duration: 5000,
                    })
                    return resolve(null)
                }
            }),
        []
    )

    // No try/catch needed; parseExcelFile never throws/rejects.
    const handleFileChange = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            if (!file) return

            const result = await parseExcelFile(file)
            if (!result) {
                if (fileInputRef.current) fileInputRef.current.value = ""
                return
            }

            try {
                data.onAfterImport?.(id, result)
            } catch {
                // Swallow any consumer errors and notify via toast.
                toast.error("Post-Import Handler Failed", {
                    description: "Imported data was parsed, but an internal handler failed to run.",
                    duration: 5000,
                })
                if (fileInputRef.current) fileInputRef.current.value = ""
                return
            }

            if (fileInputRef.current) fileInputRef.current.value = ""

            toast.success("Excel Import Successful", {
                description: `Imported ${result.data.length} rows and ${result.columns.length} columns from Excel file.`,
                duration: 3000,
            })
        },
        [data, id, parseExcelFile]
    )

    const handleExportExcel = useCallback(() => {
        try {
            const workbook = XLSX.utils.book_new()
            const metadataSheet = [
                ["Table Name", table || ""],
                ["Description", description || ""],
                [""],
                ["Column Name", "Data Type", "Description", "Primary Key", "Foreign Key", "References Table"],
                ...(columns || []).map((col) => [
                    col.name ?? "",
                    col.type ?? "text",
                    col.description ?? "",
                    col.isPrimaryKey ? "Yes" : "No",
                    col.isForeignKey ? "Yes" : "No",
                    col.references?.table ?? "",
                ]),
            ]
            const metadataWS = XLSX.utils.aoa_to_sheet(metadataSheet)
            XLSX.utils.book_append_sheet(workbook, metadataWS, "Metadata")

            const headers = (columns || []).map((c) => c.name)
            const rows = Array.isArray(data.data) ? data.data : []

            if (rows.length > 0) {
                const dataSheet = [headers, ...rows.map((row: any) => headers.map((header) => row?.[header] ?? ""))]
                const dataWS = XLSX.utils.aoa_to_sheet(dataSheet)
                XLSX.utils.book_append_sheet(workbook, dataWS, "Data")
            } else {
                const dataWS = XLSX.utils.aoa_to_sheet([headers])
                XLSX.utils.book_append_sheet(workbook, dataWS, "Data")
            }

            try {
                XLSX.writeFile(workbook, `${table || "table"}_export.xlsx`)
                toast.success("Excel Export Successful", {
                    description: "Your Excel file has been generated.",
                    duration: 3000,
                })
            } catch {
                toast.error("Excel Export Failed", {
                    description: "Could not save the Excel file. Please try again.",
                    duration: 5000,
                })
            }
        } catch {
            toast.error("Excel Export Failed", {
                description: "Something went wrong while preparing the workbook.",
                duration: 5000,
            })
        }
    }, [columns, data.data, description, table])

    const handleImportExcel = useCallback(() => {
        try {
            fileInputRef.current?.click()
        } catch {
            toast.error("File Picker Error", {
                description: "Could not open the file picker. Please try again.",
                duration: 5000,
            })
        }
    }, [])

    const openPreview = useCallback(() => setPreviewOpen(true), [])
    const columnNames = useMemo(() => (columns || []).map((c) => c.name), [columns])
    const topCentered = "calc(50% + 1px)"

    const columnRows = useMemo(
        () =>
            (columns || []).map((col, idx) => {
                const isLast = idx === (columns || []).length - 1
                return (
                    <div
                        key={`${table}-${col.name}-${idx}`}
                        className={`relative grid grid-cols-[20px_1fr] items-center px-4 py-2 hover:bg-slate-50 transition-colors ${!isLast ? "border-b border-slate-100" : ""
                            }`}
                    >
                        {col.isPrimaryKey && (
                            <Handle
                                type="target"
                                id={safeId(table, col.name, "in")}
                                position={Position.Left}
                                className="!absolute !w-2.5 !h-2.5 !bg-slate-900 z-1"
                                style={{ left: -1, top: topCentered, transform: "translateY(-50%)" }}
                            />
                        )}
                        {col.isForeignKey && (
                            <Handle
                                type="source"
                                id={safeId(table, col.name, "out")}
                                position={Position.Right}
                                className="!absolute !w-2.5 !h-2.5 !bg-slate-900 z-1"
                                style={{ right: -1, top: topCentered, transform: "translateY(-50%)" }}
                            />
                        )}
                        <div className="flex items-center justify-center">
                            {col.isPrimaryKey ? (
                                <KeyRound className="h-4 w-4 text-yellow-600" />
                            ) : col.isForeignKey ? (
                                <Link2 className="h-4 w-4 text-blue-600" />
                            ) : (
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                            )}
                        </div>
                        <div className="flex flex-col leading-tight">
                            <div className="text-sm font-medium text-slate-800 truncate max-w-[210px]" title={col.name}>
                                {col.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">{col.type}</div>
                            {col.description && (
                                <div className="text-xs text-slate-600 mt-0.5 max-w-[210px] truncate" title={col.description}>
                                    {col.description}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }),
        [columns, table, topCentered]
    )

    return (
        <Card className="relative w-[280px] rounded-xl border-2 border-slate-200 shadow-lg bg-gradient-to-br from-white to-slate-50 hover:shadow-xl hover:border-blue-300 transition-all duration-300 rounded-md pt-0">
            <CardContent className="p-0">
                <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-end bg-gradient-to-r from-slate-50 to-white rounded-t-md">
                    <div className="flex items-center gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:bg-green-100 hover:text-green-600 transition-colors"
                            title="Preview data"
                            onClick={openPreview}
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                            title="Export to Excel"
                            onClick={handleExportExcel}
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:bg-purple-100 hover:text-purple-600 transition-colors"
                            title="Import from Excel"
                            onClick={handleImportExcel}
                        >
                            <Upload className="h-4 w-4" />
                        </Button>
                        <EditSchemaModal id={id} data={data} />
                    </div>
                </div>

                <div className="px-4 pt-3 pb-2 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                    <div className="text-base font-semibold text-slate-800 mb-1 truncate max-w-[210px]" title={table}>{table}</div>
                    {description && <div className="text-xs text-slate-600 leading-relaxed">{description}</div>}
                </div>

                {columnRows}
            </CardContent>

            <DataPreviewModal
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                tableName={table}
                data={data.data || []}
                columns={columnNames}
            />

            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
        </Card>
    )
}

export default TableNode
