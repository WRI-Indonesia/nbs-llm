'use client'

import { createContext, ReactNode, useState, useCallback, Dispatch, SetStateAction, useEffect, useMemo } from "react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { useEdgesState, useNodesState, applyNodeChanges, applyEdgeChanges, type Node, type Edge, type NodeChange, type EdgeChange } from "@xyflow/react"
import type { TableNodeData, Column } from "@/types/table-nodes"
import { safeId } from "../utils"
import { type FlowProject, type FlowProjectResponse } from "@/types/flow-project"
import useSWR from 'swr'

type KnowledgeContextProps = {
    handleDownloadSample: () => void
    nodes: Node<TableNodeData>[]
    setNodes: Dispatch<SetStateAction<Node<TableNodeData>[]>>
    edges: Edge[]
    setEdges: Dispatch<SetStateAction<Edge[]>>
    currentProject: FlowProject | null
    saveProject: () => Promise<void>
    isLoading: boolean
    isDataLoading: boolean
    handleNodesChange: (changes: NodeChange[]) => void
    handleEdgesChange: (changes: EdgeChange[]) => void
    updateNodeData: (nodeId: string, updates: Partial<TableNodeData>) => void
    addNewTable: () => void
    callGenerateRagDocs: (projectId: string) => Promise<any>
    callGenerateSchema: (projectId: string) => Promise<any>
    handleRefreshIndex: () => Promise<void>
}

export const KnowledgeContext = createContext<KnowledgeContextProps>({
    handleDownloadSample: () => { },
    nodes: [],
    setNodes: () => { },
    edges: [],
    setEdges: () => { },
    currentProject: null,
    saveProject: async () => { },
    isLoading: false,
    isDataLoading: false,
    handleNodesChange: () => { },
    handleEdgesChange: () => { },
    updateNodeData: () => { },
    addNewTable: () => { },
    callGenerateRagDocs: async () => { },
    callGenerateSchema: async () => { },
    handleRefreshIndex: async () => { },
})

// Fetcher function for SWR
const fetcher = async (url: string): Promise<FlowProjectResponse> => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error('Failed to fetch project')
    }
    return response.json()
}

export const KnowledgeProvider = ({ children }: { children: ReactNode }) => {
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

    const injectNodeData = useCallback((arr: Node<TableNodeData>[], updateNodeDataFn?: (nodeId: string, updates: Partial<TableNodeData>) => void) => {
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
                        onEditTableMeta: updateNodeDataFn ? (nodeId: string, next: { table: string; description?: string }) => {
                            updateNodeDataFn(nodeId, next)
                        } : n.data.onEditTableMeta,
                        onAfterImport: updateNodeDataFn ? (nodeId: string, payload: { columns: Column[]; data: any[]; metadata: { table: string; description?: string } }) => {
                            updateNodeDataFn(nodeId, {
                                columns: payload.columns,
                                data: payload.data,
                                table: payload.metadata.table,
                                description: payload.metadata.description
                            })
                        } : n.data.onAfterImport,
                    },
                }
                : n
        )
    }, [])

    // Function to update node data (for edit-schema-modal and Excel import)
    const updateNodeData = useCallback((nodeId: string, updates: Partial<TableNodeData>) => {
        setNodes((nds) => {
            // Update the specific node
            const updatedNodes = nds.map((node) => 
                node.id === nodeId 
                    ? { ...node, data: { ...node.data, ...updates } }
                    : node
            )
            
            // Inject node data to update reservedTableNames and otherTables for all nodes
            const injected = injectNodeData(updatedNodes, updateNodeData)
            
            // Rebuild edges based on the updated nodes
            const nextEdges = buildEdgesFromReferences(injected)
            setEdges(nextEdges)
            
            return injected
        })
    }, [setNodes, setEdges, buildEdgesFromReferences, injectNodeData])

    // ReactFlow change handlers
    const handleNodesChange = useCallback((changes: NodeChange[]) => {
        setNodes((nds) => applyNodeChanges(changes, nds) as Node<TableNodeData>[])
    }, [setNodes])

    const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
        setEdges((eds) => applyEdgeChanges(changes, eds))
    }, [setEdges])

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
            const injected = injectNodeData(projectData.nodes, updateNodeData)
            const nextEdges = buildEdgesFromReferences(injected)
            setNodes(injected)
            setEdges(nextEdges)
        }
    }, [projectData, buildEdgesFromReferences, injectNodeData, setEdges, setNodes, updateNodeData])

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

    const addNewTable = useCallback(() => {
        // Generate a random UUID for table name
        const tableName = `table_${crypto.randomUUID().replace(/-/g, '_')}`
        
        // Create a new table node with id column as primary key
        const newNode: Node<TableNodeData> = {
            id: tableName,
            type: 'table',
            position: { x: Math.random() * 400, y: Math.random() * 400 }, // Random position
            data: {
                table: tableName,
                description: 'Lorem ipsum',
                columns: [
                    {
                        name: 'id',
                        type: 'number',
                        isPrimaryKey: true,
                        description: 'Primary key identifier'
                    }
                ],
                reservedTableNames: [],
                otherTables: [],
                onEditTableMeta: (nodeId: string, next: { table: string; description?: string }) => {
                    updateNodeData(nodeId, next)
                },
                onAfterImport: (nodeId: string, payload: { columns: Column[]; data: any[]; metadata: { table: string; description?: string } }) => {
                    updateNodeData(nodeId, {
                        columns: payload.columns,
                        data: payload.data,
                        table: payload.metadata.table,
                        description: payload.metadata.description
                    })
                }
            }
        }

        setNodes((nds) => {
            const updatedNodes = [...nds, newNode]
            const injected = injectNodeData(updatedNodes, updateNodeData)
            const nextEdges = buildEdgesFromReferences(injected)
            setEdges(nextEdges)
            return injected
        })

        toast.success('New table added', {
            description: `Table "${tableName}" has been created successfully.`,
            duration: 3000,
        })
    }, [setNodes, setEdges, injectNodeData, buildEdgesFromReferences, updateNodeData])

    const callGenerateRagDocs = useCallback(async (projectId: string) => {
        if (!projectId) {
            throw new Error("projectId is required")
        }

        const url = `/api/ai/index?projectId=${encodeURIComponent(projectId)}`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}))
            throw new Error(errorBody.error || `Request failed with status ${response.status}`)
        }

        return response.json()
    }, [])

    const callGenerateSchema = useCallback(async (projectId: string) => {
        if (!projectId) {
            throw new Error("projectId is required")
        }

        const url = `/api/ai/generate-schema`

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ projectId })
        })

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}))
            throw new Error(errorBody.error || `Request failed with status ${response.status}`)
        }

        return response.json()
    }, [])

    const handleRefreshIndex = useCallback(async () => {
        try {
            setIsLoading(true)
            await callGenerateRagDocs('DEFAULT')
            await callGenerateSchema('DEFAULT')
            toast.success('Index refreshed successfully')
        } catch (error) {
            console.error('Error refreshing index:', error)
            toast.error('Failed to refresh index')
        } finally {
            setIsLoading(false)
        }
    }, [callGenerateRagDocs, callGenerateSchema])

    const value = useMemo<KnowledgeContextProps>(
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
            handleNodesChange,
            handleEdgesChange,
            updateNodeData,
            addNewTable,
            callGenerateRagDocs,
            callGenerateSchema,
            handleRefreshIndex,
        }),
        [edges, handleDownloadSample, nodes, setEdges, setNodes, currentProject, saveProject, isLoading, isDataLoading, handleNodesChange, handleEdgesChange, updateNodeData, addNewTable, callGenerateRagDocs, callGenerateSchema, handleRefreshIndex]
    )

    return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>
}
