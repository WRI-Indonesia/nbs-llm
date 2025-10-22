'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { DialogHeader, DialogFooter, Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Column, ColumnType, TableNodeData } from "@/types/table-nodes"
import { Checkbox } from "@radix-ui/react-checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { PencilLine, Database, KeyRound, Link2, Trash2, Plus } from "lucide-react"
import { TYPE_OPTIONS } from "../data"

export function EditSchemaModal({ id, data }: { id: string; data: TableNodeData }) {
    const { table, description, columns, reservedTableNames = [], otherTables = [] } = data

    const [open, setOpen] = useState(false)
    const [columnsDraft, setColumnsDraft] = useState(columns)
    const [tableDraft, setTableDraft] = useState(table)
    const [descriptionDraft, setDescriptionDraft] = useState(description ?? "")

    useEffect(() => {
        setColumnsDraft(columns)
        setTableDraft(table)
        setDescriptionDraft(description ?? "")
    }, [columns, table, description])

    const normalize = useCallback((v?: string) => (v ?? "").trim().toLowerCase(), [])

    const generateUniqueColumnName = useCallback((cols: Column[], base: string) => {
        let i = 1
        let name = base
        const taken = new Set(cols.map((c) => normalize(c.name)))
        while (taken.has(normalize(name))) name = `${base}_${i++}`
        return name
    }, [normalize])

    const updateColumn = useCallback(
        (index: number, patch: Partial<Column>) =>
            setColumnsDraft((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c))),
        []
    )

    const removeColumn = useCallback(
        (index: number) => setColumnsDraft((prev) => prev.filter((_, i) => i !== index)),
        []
    )

    const addColumn = useCallback(
        () =>
            setColumnsDraft((prev) => [
                ...prev,
                { name: generateUniqueColumnName(prev, "new_column"), type: "text", description: "" },
            ]),
        [generateUniqueColumnName]
    )

    const togglePrimaryKey = useCallback((index: number, checked: boolean | string) => {
        updateColumn(index, { isPrimaryKey: !!checked })
    }, [updateColumn])

    const toggleForeignKey = useCallback((index: number, checked: boolean | string) => {
        if (checked) {
            updateColumn(index, { isForeignKey: true, references: columnsDraft[index].references ?? { table: "" } })
        } else {
            updateColumn(index, { isForeignKey: false, references: undefined })
        }
    }, [columnsDraft, updateColumn])

    const hasDuplicateColumnName = useCallback(
        (name: string, currentIndex: number) =>
            columnsDraft.some((c, i) => i !== currentIndex && normalize(c.name) === normalize(name)),
        [columnsDraft, normalize]
    )

    const hasInvalidColumns = useMemo(
        () =>
            columnsDraft.some((c, i) => !c.name.trim() || hasDuplicateColumnName(c.name, i) || !c.description?.trim()),
        [columnsDraft, hasDuplicateColumnName]
    )

    const isDuplicateTableName = useMemo(
        () => reservedTableNames.filter((n) => normalize(n) !== normalize(table)).some((n) => normalize(n) === normalize(tableDraft)),
        [reservedTableNames, table, tableDraft, normalize]
    )

    const hasInvalidTable = useMemo(
        () => !tableDraft.trim() || isDuplicateTableName || !descriptionDraft.trim(),
        [tableDraft, isDuplicateTableName, descriptionDraft]
    )

    const referenceOptions = useMemo(
        () =>
            otherTables.flatMap((t) =>
                t.columns.filter((c) => c.isPrimaryKey).map((pk) => ({
                    value: `${t.table}.${pk.name}`,
                    label: `${t.table}.${pk.name} (PK)`,
                }))
            ),
        [otherTables]
    )

    const handleOpenChange = useCallback((next: boolean) => setOpen(next), [])
    const handleCancel = useCallback(() => setOpen(false), [])
    const handleSave = useCallback(() => {
        if (hasInvalidColumns || hasInvalidTable) return
        data.onEditColumns?.(id, columnsDraft)
        if (tableDraft !== table || descriptionDraft !== description) {
            data.onEditTableMeta?.(id, { table: tableDraft, description: descriptionDraft })
        }
        setOpen(false)
        data.onRefresh?.()
    }, [columnsDraft, data, description, descriptionDraft, hasInvalidColumns, hasInvalidTable, id, table, tableDraft])

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                    title="Edit table"
                >
                    <PencilLine className="h-4 w-4" />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
                <DialogHeader className="space-y-3 pb-4 border-b flex-shrink-0">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Database className="h-6 w-6 text-blue-600" />
                        Edit Table Schema
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">Define your table structure, columns, and relationships</p>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 flex-shrink-0">
                        <div className="md:col-span-1">
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Table Name</label>
                            <Input
                                value={tableDraft}
                                onChange={(e) => setTableDraft(e.target.value)}
                                className={`${hasInvalidTable ? "border-red-500 focus-visible:ring-red-500" : "border-slate-300"} h-10`}
                                placeholder="e.g., users, products"
                            />
                            {isDuplicateTableName && (
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
                                value={descriptionDraft}
                                onChange={(e) => setDescriptionDraft(e.target.value)}
                                placeholder="Brief description of what this table stores"
                                className={`${!descriptionDraft.trim() ? "border-red-500 focus-visible:ring-red-500" : "border-slate-300"} min-h-[40px]`}
                                rows={2}
                            />
                            {!descriptionDraft.trim() && (
                                <div className="flex items-center gap-1 mt-1.5 text-red-600">
                                    <span className="text-xs font-medium">⚠️ Description is required</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t pt-4 flex-shrink-0">
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

                    <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                        {columnsDraft.map((col, i) => {
                            const isDup = hasDuplicateColumnName(col.name, i)
                            const isEmpty = !col.name.trim()
                            return (
                                <div
                                    key={i}
                                    className={`rounded-lg border-2 p-4 bg-gradient-to-br from-white to-slate-50 shadow-sm hover:shadow-md transition-all ${isDup || isEmpty ? "border-red-300 bg-red-50/50" : "border-slate-200"
                                        }`}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                                        <div className="md:col-span-4">
                                            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Column Name</label>
                                            <Input
                                                value={col.name}
                                                onChange={(e) => updateColumn(i, { name: e.target.value })}
                                                className={`${isDup || isEmpty ? "border-red-500" : "border-slate-300"} h-9`}
                                                placeholder="column_name"
                                            />
                                            {(isDup || isEmpty) && (
                                                <span className="text-xs text-red-600 mt-1 block">{isEmpty ? "⚠️ Required" : "⚠️ Duplicate"}</span>
                                            )}
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Data Type</label>
                                            <Select value={col.type} onValueChange={(v) => updateColumn(i, { type: v as ColumnType })}>
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
                                                    onCheckedChange={(c) => togglePrimaryKey(i, c)}
                                                    className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-600"
                                                />
                                                <KeyRound className="h-3.5 w-3.5 text-yellow-600" />
                                                <span className="text-sm font-medium">PK</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md hover:bg-blue-50 transition-colors">
                                                <Checkbox
                                                    checked={!!col.isForeignKey}
                                                    onCheckedChange={(c) => toggleForeignKey(i, c)}
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
                                                onClick={() => removeColumn(i)}
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
                                            onChange={(e) => updateColumn(i, { description: e.target.value })}
                                            placeholder="Describe what this column stores..."
                                            className={`${!col.description?.trim() ? "border-red-500 focus-visible:ring-red-500" : "border-slate-300"} text-sm min-h-[60px]`}
                                            rows={2}
                                        />
                                        {!col.description?.trim() && <span className="text-xs text-red-600 mt-1 block">⚠️ Description is required</span>}
                                    </div>

                                    {col.isForeignKey && (
                                        <div className="mt-3">
                                            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">References Table</label>
                                            <Select
                                                value={
                                                    col.references?.table ? `${col.references.table}.${col.references.column || ""}` : "none"
                                                }
                                                onValueChange={(value) => {
                                                    if (!value || value === "none") {
                                                        updateColumn(i, { references: undefined })
                                                        return
                                                    }
                                                    const [tName, cName] = value.split(".")
                                                    if (tName && cName) updateColumn(i, { references: { table: tName, column: cName } })
                                                    else updateColumn(i, { references: undefined })
                                                }}
                                            >
                                                <SelectTrigger className="h-9 border-slate-300">
                                                    <SelectValue placeholder="Select table to reference" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">
                                                        <span className="text-slate-500">None</span>
                                                    </SelectItem>
                                                    {referenceOptions.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
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
                            onClick={addColumn}
                            className="w-full gap-2 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 h-12 text-slate-600 hover:text-blue-700"
                        >
                            <Plus className="h-5 w-5" />
                            Add Column
                        </Button>
                    </div>
                </div>

                <DialogFooter className="gap-2 pt-4 border-t flex-shrink-0">
                    <Button variant="ghost" onClick={handleCancel} className="min-w-[100px]">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={hasInvalidColumns || hasInvalidTable} className="min-w-[100px] bg-blue-600 hover:bg-blue-700">
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}