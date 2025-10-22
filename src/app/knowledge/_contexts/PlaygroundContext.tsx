'use client'

import { createContext, ReactNode, useState, useCallback, Dispatch, SetStateAction, useEffect, useMemo } from "react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { useEdgesState, useNodesState, type Node, type Edge } from "@xyflow/react"
import type { TableNodeData, Column } from "@/types/table-nodes"
import { safeId } from "../utils"
import { type FlowProject, type FlowProjectResponse } from "@/types/flow-project"
import useSWR from 'swr'

type PlaygroundContextProps = {
    handleDownloadSample: () => void
    nodes: Node<TableNodeData>[]
    setNodes: Dispatch<SetStateAction<Node<TableNodeData>[]>>
    edges: Edge[]
    setEdges: Dispatch<SetStateAction<Edge[]>>
    currentProject: FlowProject | null
    saveProject: () => Promise<void>
    isLoading: boolean
    isDataLoading: boolean
}

export const PlaygroundContext = createContext<PlaygroundContextProps>({
    handleDownloadSample: () => { },
    nodes: [],
    setNodes: () => { },
    edges: [],
    setEdges: () => { },
    currentProject: null,
    saveProject: async () => { },
    isLoading: false,
    isDataLoading: false,
})

// Fetcher function for SWR
const fetcher = async (url: string): Promise<FlowProjectResponse> => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error('Failed to fetch project')
    }
    return response.json()
}

export const PlaygroundProvider = ({ children }: { children: ReactNode }) => {
    const [nodes, setNodes] = useNodesState<Node<TableNodeData>>([])
    const [edges, setEdges] = useEdgesState<Edge>([])
    const [isLoading, setIsLoading] = useState(false)

    // Use SWR to fetch project data
    const { data: projectData, error, isLoading: isDataLoading, mutate } = useSWR<FlowProjectResponse>('/api/flow-projects/DEFAULT',
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 60000, // Cache for 1 minute
        }
    )

    const currentProject = projectData?.project || null

    const normalize = useCallback((v: string) => v.trim().toLowerCase(), [])

    const findTableNode = useCallback(
        (arr: Node<TableNodeData>[], tableName: string) =>
            arr.find((n) => normalize(n.data.table) === normalize(tableName)),
        [normalize]
    )

    const pickPrimaryKey = useCallback(
        (cols: Column[], preferred?: string) =>
            preferred
                ? cols.find((c) => c.name === preferred && c.isPrimaryKey)
                : cols.find((c) => c.isPrimaryKey),
        []
    )

    const buildEdgesFromReferences = useCallback(
        (arr: Node<TableNodeData>[]): Edge[] => {
            const out: Edge[] = []
            for (const src of arr) {
                for (const col of src.data.columns) {
                    if (!col.isForeignKey || !col.references) continue
                    const dst = findTableNode(arr, col.references.table)
                    if (!dst) continue
                    const pk = pickPrimaryKey(dst.data.columns, col.references.column)
                    if (!pk) continue
                    out.push({
                        id: `${src.id}.${col.name}-->${dst.id}.${pk.name}`,
                        source: src.id,
                        target: dst.id,
                        sourceHandle: safeId(src.data.table, col.name, "out"),
                        targetHandle: safeId(dst.data.table, pk.name, "in"),
                        type: "smoothstep",
                    })
                }
            }
            return out
        },
        [findTableNode, pickPrimaryKey]
    )


    const injectNodeData = useCallback((arr: Node<TableNodeData>[]) => {
        const reserved = arr.map((n) => n.data.table)
        return arr.map((n) =>
            n.type === "table"
                ? {
                    ...n,
                    data: {
                        ...n.data,
                        reservedTableNames: reserved,
                        otherTables: arr
                            .filter((m) => m.id !== n.id && m.type === "table")
                            .map((m) => ({ table: m.data.table, columns: m.data.columns })),
                        onEditTableMeta: n.data.onEditTableMeta,
                        onAfterImport: n.data.onAfterImport,
                    },
                }
                : n
        )
    }, [])

    // Database operations
    const saveProject = useCallback(async () => {
        if (!currentProject) {
            toast.error('No project to save')
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch(`/api/flow-projects/${currentProject.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nodes,
                    edges,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to save project')
            }
            await mutate(undefined, { revalidate: true })

            toast.success('Project saved successfully')
        } catch (error) {
            console.error('Error saving project:', error)
            toast.error('Failed to save project')
        } finally {
            setIsLoading(false)
        }
    }, [currentProject, nodes, edges, mutate])

    // Process project data when it loads from SWR
    useEffect(() => {
        if (projectData) {
            const injected = injectNodeData(projectData.nodes)
            const nextEdges = buildEdgesFromReferences(injected)
            setNodes(injected)
            setEdges(nextEdges)
        }
    }, [projectData, buildEdgesFromReferences, injectNodeData, setEdges, setNodes])

    // Handle errors from SWR
    useEffect(() => {
        if (error) {
            console.error('Error loading project from database:', error)
            toast.error('Error loading project from database!')
        }
    }, [error])

    const handleDownloadSample = useCallback(() => {
        const cols: Column[] = [
            { name: "id", type: "number", isPrimaryKey: true, description: "Unique identifier" },
            { name: "name", type: "text", description: "Item name" },
            { name: "price", type: "number", description: "Item price" },
            { name: "active", type: "boolean", description: "Is item active" },
        ]

        const rows = [
            { id: 1, name: "Sample Item 1", price: 29.99, active: true },
            { id: 2, name: "Sample Item 2", price: 49.99, active: false },
            { id: 3, name: "Sample Item 3", price: 19.99, active: true },
        ]

        const wb = XLSX.utils.book_new()

        const metaAoa = [
            ["Table Name", "sample_table"],
            ["Description", "Sample table for import demonstration"],
            [""],
            ["Column Name", "Data Type", "Description", "Primary Key", "Foreign Key", "References Table"],
            ...cols.map((c) => [
                c.name,
                c.type,
                c.description || "",
                c.isPrimaryKey ? "Yes" : "No",
                c.isForeignKey ? "Yes" : "No",
                c.references?.table || "",
            ]),
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaAoa), "Metadata")

        const headers = cols.map((c) => c.name)
        const dataAoa = [headers, ...rows.map((r) => headers.map((h) => (r as any)[h] ?? ""))]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataAoa), "Data")

        XLSX.writeFile(wb, "sample_table_import.xlsx")
        toast.success("Sample Downloaded", {
            description: "Sample Excel file downloaded. Use this as a template for your imports.",
            duration: 3000,
        })
    }, [])

    const value = useMemo<PlaygroundContextProps>(
        () => ({
            handleDownloadSample,
            nodes,
            setNodes,
            edges,
            setEdges,
            currentProject,
            saveProject,
            isLoading,
            isDataLoading,
        }),
        [edges, handleDownloadSample, nodes, setEdges, setNodes, currentProject, saveProject, isLoading, isDataLoading]
    )

    return <PlaygroundContext.Provider value={value}>{children}</PlaygroundContext.Provider>
}
