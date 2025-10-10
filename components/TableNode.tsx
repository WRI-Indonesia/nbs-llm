"use client"

import * as React from "react"
import { Handle, Position } from "@xyflow/react"
import { KeyRound, Link2, Database, PencilLine, Trash2, Plus, Eye, Download, Upload } from "lucide-react"
import * as XLSX from 'xlsx'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import DataPreviewModal from "./DataPreviewModal"
import { toast } from 'sonner'
import type { Column, TableNodeData, ColumnType } from "@/types"

/* --------------------------------- Utils --------------------------------- */

const safeId = (table: string, col: string, suffix: "in" | "out") => 
    `${table}__${col.replace(/\s+/g, "_").toLowerCase()}__${suffix}`

const TYPE_OPTIONS: ColumnType[] = ["text", "number", "boolean"]

function eqi(a?: string, b?: string) {
    return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase()
}

function uniqueColName(cols: Column[], base: string) {
    let i = 1
    let name = base
    const taken = new Set(cols.map((c) => c.name.toLowerCase()))
    while (taken.has(name.toLowerCase())) name = `${base}_${i++}`
    return name
}

// Excel utility functions
function exportToExcel(tableName: string, description: string, columns: Column[], data: any[]) {
    const workbook = XLSX.utils.book_new()
    
    // Create metadata sheet
    const metadataSheet = [
        ['Table Name', tableName],
        ['Description', description || ''],
        [''],
        ['Column Name', 'Data Type', 'Description', 'Primary Key', 'Foreign Key', 'References Table'],
        ...columns.map(col => [
            col.name,
            col.type,
            col.description || '',
            col.isPrimaryKey ? 'Yes' : 'No',
            col.isForeignKey ? 'Yes' : 'No',
            col.references?.table || ''
        ])
    ]
    
    const metadataWS = XLSX.utils.aoa_to_sheet(metadataSheet)
    XLSX.utils.book_append_sheet(workbook, metadataWS, 'Metadata')
    
    // Create data sheet
    if (data && data.length > 0) {
        const headers = columns.map(col => col.name)
        const dataSheet = [headers, ...data.map(row => headers.map(header => row[header] || ''))]
        const dataWS = XLSX.utils.aoa_to_sheet(dataSheet)
        XLSX.utils.book_append_sheet(workbook, dataWS, 'Data')
    } else {
        // Empty data sheet with headers
        const headers = columns.map(col => col.name)
        const dataWS = XLSX.utils.aoa_to_sheet([headers])
        XLSX.utils.book_append_sheet(workbook, dataWS, 'Data')
    }
    
    // Download the file
    XLSX.writeFile(workbook, `${tableName}_export.xlsx`)
}

function parseExcelFile(file: File): Promise<{ columns: Column[]; data: any[]; metadata: { table: string; description: string } }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: 'array' })
                
                // Parse metadata sheet
                const metadataSheet = workbook.Sheets['Metadata']
                if (!metadataSheet) {
                    throw new Error('Metadata sheet not found')
                }
                
                const metadataData = XLSX.utils.sheet_to_json(metadataSheet, { header: 1 }) as any[][]
                const tableName = metadataData[0]?.[1] || ''
                const description = metadataData[1]?.[1] || ''
                
                // Parse columns from metadata
                const columns: Column[] = []
                for (let i = 4; i < metadataData.length; i++) {
                    const row = metadataData[i]
                    if (row && row[0]) {
                        columns.push({
                            name: row[0],
                            type: (row[1] as ColumnType) || 'text',
                            description: row[2] || '',
                            isPrimaryKey: row[3] === 'Yes',
                            isForeignKey: row[4] === 'Yes',
                            references: row[5] ? { table: row[5] } : undefined
                        })
                    }
                }
                
                // Parse data sheet
                const dataSheet = workbook.Sheets['Data']
                let parsedData: any[] = []
                if (dataSheet) {
                    const dataArray = XLSX.utils.sheet_to_json(dataSheet, { header: 1 }) as any[][]
                    if (dataArray.length > 1) {
                        const headers = dataArray[0] as string[]
                        parsedData = dataArray.slice(1).map(row => {
                            const obj: any = {}
                            headers.forEach((header, index) => {
                                obj[header] = row[index] || ''
                            })
                            return obj
                        })
                    }
                }
                
                resolve({
                    columns,
                    data: parsedData,
                    metadata: { table: tableName, description }
                })
            } catch (error) {
                reject(error)
            }
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsArrayBuffer(file)
    })
}

/* --------------------------------- Component --------------------------------- */

export default function TableNode({ id, data }: { id: string; data: TableNodeData }) {
    const schema = data.schema ?? "public"
    const { table, description, columns, reservedTableNames = [], otherTables = [] } = data
    const [open, setOpen] = React.useState(false)
    const [previewOpen, setPreviewOpen] = React.useState(false)
    const [draftCols, setDraftCols] = React.useState(columns)
    const [draftTable, setDraftTable] = React.useState(table)
    const [draftDesc, setDraftDesc] = React.useState(description ?? "")
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        setDraftCols(columns)
        setDraftTable(table)
        setDraftDesc(description ?? "")
    }, [columns, table, description])

    const updateCol = (i: number, patch: Partial<Column>) => 
        setDraftCols((d) => d.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
    
    const removeCol = (i: number) => 
        setDraftCols((d) => d.filter((_, idx) => idx !== i))
    
    const addCol = () => 
        setDraftCols((d) => [...d, { name: uniqueColName(d, "new_column"), type: "text", description: "" }])

    const onTogglePK = (i: number, checked: boolean | string) => 
        updateCol(i, { isPrimaryKey: !!checked })
    
    const onToggleFK = (i: number, checked: boolean | string) => {
        if (checked) 
            updateCol(i, { isForeignKey: true, references: draftCols[i].references ?? { table: "" } })
        else 
            updateCol(i, { isForeignKey: false, references: undefined })
    }

    const dupColName = (name: string, idx: number) => 
        draftCols.some((c, i) => i !== idx && eqi(c.name, name))
    
    const badCols = draftCols.some((c, i) => !c.name.trim() || dupColName(c.name, i) || !c.description?.trim())
    const dupTable = reservedTableNames.filter((n) => !eqi(n, table)).some((n) => eqi(n, draftTable))
    const badTable = !draftTable.trim() || dupTable || !draftDesc.trim()

    const onSave = () => {
        if (badCols || badTable) return
        
        
        data.onEditColumns?.(id, draftCols)
        if (draftTable !== table || draftDesc !== description) 
            data.onEditTableMeta?.(id, { table: draftTable, description: draftDesc })
        setOpen(false)
        
        // Refresh needed when creating foreign key references via modal
        if (data.onRefresh) {
            data.onRefresh()
        }
    }

    const handleExportExcel = () => {
        exportToExcel(table, description || '', columns, data?.data || [])
    }

    const handleImportExcel = () => {
        fileInputRef.current?.click()
    }


    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            const result = await parseExcelFile(file)
            data.onAfterImport?.(id, result)
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
            // Show success message
            toast.success('Excel Import Successful', {
                description: `Imported ${result.data.length} rows and ${result.columns.length} columns from Excel file.`,
                duration: 3000,
            })
        } catch (error) {
            console.error('Error importing Excel file:', error)
            toast.error('Excel Import Failed', {
                description: 'Please make sure the file has the correct format with Metadata and Data sheets.',
                duration: 5000,
            })
        }
    }

    return (
        <Card className="relative w-[280px] rounded-xl border-2 border-slate-200 shadow-lg bg-gradient-to-br from-white to-slate-50 hover:shadow-xl hover:border-blue-300 transition-all duration-300 group">
            <CardContent className="p-0">
                <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                    <Badge variant="secondary" className="text-xs gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 border-blue-200">
                        <Database className="h-3 w-3" />
                        {schema}
                    </Badge>

                    <div className="flex items-center gap-1">
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 hover:bg-green-100 hover:text-green-600 transition-colors" 
                            title="Preview data"
                            onClick={() => setPreviewOpen(true)}
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
                        
                        
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-blue-100 hover:text-blue-600 transition-colors" title="Edit table">
                                    <PencilLine className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
                                <DialogHeader className="space-y-3 pb-4 border-b">
                                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                        <Database className="h-6 w-6 text-blue-600" />
                                        Edit Table Schema
                                    </DialogTitle>
                                    <p className="text-sm text-muted-foreground">
                                        Define your table structure, columns, and relationships
                                    </p>
                                </DialogHeader>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                                    <div className="md:col-span-1">
                                        <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                                            Table Name
                                        </label>
                                        <Input 
                                            value={draftTable} 
                                            onChange={(e) => setDraftTable(e.target.value)} 
                                            className={`${badTable ? "border-red-500 focus-visible:ring-red-500" : "border-slate-300"} h-10`}
                                            placeholder="e.g., users, products"
                                        />
                                        {dupTable && (
                                            <div className="flex items-center gap-1 mt-1.5 text-red-600">
                                                <span className="text-xs font-medium">⚠️ Name must be unique</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                                            Description <span className="text-red-500">*</span>
                                        </label>
                                        <Textarea 
                                            value={draftDesc} 
                                            onChange={(e) => setDraftDesc(e.target.value)} 
                                            placeholder="Brief description of what this table stores"
                                            className={`${!draftDesc.trim() ? "border-red-500 focus-visible:ring-red-500" : "border-slate-300"} min-h-[40px]`}
                                            rows={2}
                                        />
                                        {!draftDesc.trim() && (
                                            <div className="flex items-center gap-1 mt-1.5 text-red-600">
                                                <span className="text-xs font-medium">⚠️ Description is required</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-semibold text-slate-900">Columns</h3>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <KeyRound className="h-3 w-3 text-yellow-600" />
                                                Primary Key
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Link2 className="h-3 w-3 text-blue-600" />
                                                Foreign Key
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                                    {draftCols.map((col, i) => {
                                        const isDup = dupColName(col.name, i)
                                        const empty = !col.name.trim()
                                        return (
                                            <div 
                                                key={i} 
                                                className={`rounded-lg border-2 p-4 bg-gradient-to-br from-white to-slate-50 shadow-sm hover:shadow-md transition-all ${
                                                    isDup || empty ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                                                }`}
                                            >
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                                                    <div className="md:col-span-4">
                                                        <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                                            Column Name
                                                        </label>
                                                        <Input 
                                                            value={col.name} 
                                                            onChange={(e) => updateCol(i, { name: e.target.value })} 
                                                            className={`${isDup || empty ? "border-red-500" : "border-slate-300"} h-9`}
                                                            placeholder="column_name"
                                                        />
                                                        {(isDup || empty) && (
                                                            <span className="text-xs text-red-600 mt-1 block">
                                                                {empty ? '⚠️ Required' : '⚠️ Duplicate'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                                            Data Type
                                                        </label>
                                                        <Select 
                                                            value={col.type} 
                                                            onValueChange={(v) => updateCol(i, { type: v as ColumnType })}
                                                        >
                                                            <SelectTrigger className="h-9 border-slate-300">
                                                                <SelectValue placeholder="Type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {TYPE_OPTIONS.map((t) => (
                                                                    <SelectItem key={t} value={t}>
                                                                        <span className="capitalize">{t}</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="md:col-span-4 flex items-end gap-3">
                                                        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md hover:bg-yellow-50 transition-colors">
                                                            <Checkbox 
                                                                checked={!!col.isPrimaryKey} 
                                                                onCheckedChange={(c) => onTogglePK(i, c)}
                                                                className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-600"
                                                            />
                                                            <KeyRound className="h-3.5 w-3.5 text-yellow-600" />
                                                            <span className="text-sm font-medium">PK</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md hover:bg-blue-50 transition-colors">
                                                            <Checkbox 
                                                                checked={!!col.isForeignKey} 
                                                                onCheckedChange={(c) => onToggleFK(i, c)}
                                                                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-600"
                                                            />
                                                            <Link2 className="h-3.5 w-3.5 text-blue-600" />
                                                            <span className="text-sm font-medium">FK</span>
                                                        </label>
                                                    </div>
                                                    <div className="md:col-span-1 flex items-end justify-end">
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => removeCol(i)}
                                                            className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-3">
                                                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                                        Description <span className="text-red-500">*</span>
                                                    </label>
                                                    <Textarea 
                                                        value={col.description ?? ""} 
                                                        onChange={(e) => updateCol(i, { description: e.target.value })}
                                                        placeholder="Describe what this column stores..."
                                                        className={`${!col.description?.trim() ? "border-red-500 focus-visible:ring-red-500" : "border-slate-300"} text-sm min-h-[60px]`}
                                                        rows={2}
                                                    />
                                                    {!col.description?.trim() && (
                                                        <span className="text-xs text-red-600 mt-1 block">
                                                            ⚠️ Description is required
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {col.isForeignKey && (
                                                    <div className="mt-3">
                                                        <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                                            References Table
                                                        </label>
                                                        <Select 
                                                            value={col.references?.table ? `${col.references.table}.${col.references.column || ''}` : "none"} 
                                                            onValueChange={(value) => {
                                                                if (value === "none" || !value) {
                                                                    updateCol(i, { references: undefined })
                                                                } else {
                                                                    const [tableName, columnName] = value.split('.')
                                                                    if (tableName && columnName) {
                                                                        updateCol(i, { references: { table: tableName, column: columnName } })
                                                                    } else {
                                                                        updateCol(i, { references: undefined })
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-9 border-slate-300">
                                                                <SelectValue placeholder="Select table to reference" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">
                                                                    <span className="text-slate-500">None</span>
                                                                </SelectItem>
                                                                {otherTables.flatMap(otherTable => 
                                                                    otherTable.columns
                                                                        .filter(c => c.isPrimaryKey)
                                                                        .map(pkCol => (
                                                                            <SelectItem key={`${otherTable.table}.${pkCol.name}`} value={`${otherTable.table}.${pkCol.name}`}>
                                                                                {otherTable.table}.{pkCol.name} (PK)
                                                                            </SelectItem>
                                                                        ))
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={addCol} 
                                        className="w-full gap-2 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 h-12 text-slate-600 hover:text-blue-700"
                                    >
                                        <Plus className="h-5 w-5" />
                                        Add Column
                                    </Button>
                                </div>

                                <DialogFooter className="gap-2 pt-4 border-t">
                                    <Button 
                                        variant="ghost" 
                                        onClick={() => setOpen(false)}
                                        className="min-w-[100px]"
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={onSave} 
                                        disabled={badCols || badTable}
                                        className="min-w-[100px] bg-blue-600 hover:bg-blue-700"
                                    >
                                        Save Changes
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="px-4 pt-3 pb-2 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                    <div className="text-base font-semibold text-slate-800 mb-1">{table}</div>
                    {description && (
                        <div className="text-xs text-slate-600 leading-relaxed">{description}</div>
                    )}
                </div>

                {columns.map((col, idx) => {
                    const isLast = idx === columns.length - 1
                    const topCentered = "calc(50% + 1px)"
                    
                    
                    return (
                        <div 
                            key={`${table}-${col.name}-${idx}`} 
                            className={`relative grid grid-cols-[20px_1fr] items-center px-4 py-2 hover:bg-slate-50 transition-colors ${!isLast ? "border-b border-slate-100" : ""}`}
                        >
                            {col.isPrimaryKey && (
                                <Handle 
                                    type="target" 
                                    id={safeId(table, col.name, "in")} 
                                    position={Position.Left} 
                                    className="!absolute !w-2.5 !h-2.5 !bg-slate-900 z-10" 
                                    style={{ left: -1, top: topCentered, transform: "translateY(-50%)" }} 
                                />
                            )}
                            {col.isForeignKey && (
                                <Handle 
                                    type="source" 
                                    id={safeId(table, col.name, "out")} 
                                    position={Position.Right} 
                                    className="!absolute !w-2.5 !h-2.5 !bg-slate-900 z-10" 
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
                                <div className="text-sm font-medium truncate text-slate-800" title={col.name}>{col.name}</div>
                                <div className="text-xs text-slate-500 font-mono">{col.type}</div>
                                {col.description && (
                                    <div className="text-xs text-slate-600 mt-0.5 line-clamp-1" title={col.description}>
                                        {col.description}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </CardContent>
            
            {/* Data Preview Modal */}
            <DataPreviewModal
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                tableName={table}
                data={data.data || []}
                columns={columns.map(col => col.name)}
            />
            
            {/* Hidden file input for Excel import */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </Card>
    )
}
