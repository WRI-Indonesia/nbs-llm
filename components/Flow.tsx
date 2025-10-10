'use client'

import * as React from 'react'
import dagre from '@dagrejs/dagre'
import {
    ReactFlow,
    Controls,
    Background,
    Panel,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
} from '@xyflow/react'
import type { Connection } from '@xyflow/react'
import TableNode from './TableNode'
import type { TableNodeData, Column, HistoryItem } from '@/types'
import { toast } from 'sonner'
import SidebarChat from './SidebarChat'
import { saveSchema, loadSchema, setStorageMode, type StorageMode, saveToLocal, loadFromLocal, getLocalVersionHistory } from '@/lib/schema-storage'
import { GitBranch, MessageSquare } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

/* -------------------------- Handle / Edge helpers ------------------------- */

const safeId = (table: string, col: string, suffix: 'in' | 'out') =>
    `${table}__${col.replace(/\s+/g, '_').toLowerCase()}__${suffix}`

const byTable = (nodes: Node<TableNodeData>[], table: string) =>
    nodes.find((n) => n.data.table.toLowerCase() === table.toLowerCase())

const getPK = (cols: Column[], preferred?: string) =>
    preferred ? cols.find((c) => c.name === preferred && c.isPrimaryKey) : cols.find((c) => c.isPrimaryKey)

function buildEdgesFromRefs(nodes: Node<TableNodeData>[]): Edge[] {
    const edges: Edge[] = []
    for (const src of nodes) {
        for (const col of src.data.columns) {
            if (!col.isForeignKey || !col.references) continue
            const dst = byTable(nodes, col.references.table)
            if (!dst) continue
            const pk = getPK(dst.data.columns, col.references.column)
            if (!pk) continue
            edges.push({
                id: `${src.id}.${col.name}-->${dst.id}.${pk.name}`,
                source: src.id,
                target: dst.id,
                sourceHandle: safeId(src.data.table, col.name, 'out'),
                targetHandle: safeId(dst.data.table, pk.name, 'in'),
                type: 'smoothstep',
            })
        }
    }
    return edges
}

/* --------------------------------- Layout -------------------------------- */

const layoutNodes = (nodes: Node<TableNodeData>[], edges: Edge[]) => {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))

    const nodeHeights = nodes.map((n) => 80 + n.data.columns.length * 35)
    const maxHeight = Math.max(...nodeHeights, 100)

    g.setGraph({
        rankdir: 'LR',
        nodesep: 160,
        ranksep: Math.max(250, maxHeight * 0.9),
    })

    nodes.forEach((n, i) => {
        g.setNode(n.id, { width: 260, height: nodeHeights[i] })
    })

    edges.forEach((e) => g.setEdge(e.source, e.target))
    dagre.layout(g)

    let laid = nodes.map((n) => {
        const pos = g.node(n.id)
        return {
            ...n,
            position: {
                x: (pos?.x ?? 0) - 130,
                y: (pos?.y ?? 0) - nodeHeights[nodes.indexOf(n)] / 2,
            },
        }
    })

    // small collision-avoidance post pass
    laid = laid.sort((a, b) => a.position.y - b.position.y)
    for (let i = 1; i < laid.length; i++) {
        const prev = laid[i - 1]
        const curr = laid[i]
        const prevBottom = prev.position.y + nodeHeights[nodes.indexOf(prev)] / 2
        const currTop = curr.position.y - nodeHeights[nodes.indexOf(curr)] / 2
        const overlap = prevBottom - currTop
        if (overlap > -60) {
            laid[i].position.y += overlap + 60
        }
    }

    return laid
}

const nodeTypes = { table: TableNode }

/* ------------------------------ UI Helpers ------------------------------- */

function FullscreenLoader({ visible, label = 'Loading…' }: { visible: boolean; label?: string }) {
    if (!visible) return null
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="fixed inset-0 bg-gray-900/45 backdrop-blur-sm grid place-items-center z-[1000]"
        >
            <div className="grid gap-3 place-items-center p-5 bg-white/95 rounded-xl shadow-2xl min-w-40">
                <div className="w-8 h-8 rounded-full border-4 border-black/15 border-t-gray-900 animate-spin" />
                <span className="text-sm font-semibold text-gray-900">{label}</span>
            </div>
        </div>
    )
}

/* ------------------------------ Sample Data ------------------------------ */

const SAMPLE_NODES: Node<TableNodeData>[] = [
    {
        id: 'table-1',
        type: 'table',
        position: { x: 100, y: 100 },
        data: {
            table: 'users',
            description: 'User accounts and profiles',
            columns: [
                { name: 'id', type: 'number', isPrimaryKey: true, description: 'Unique user identifier' },
                { name: 'username', type: 'text', description: 'User login name' },
                { name: 'email', type: 'text', description: 'User email address' },
                { name: 'created_at', type: 'text', description: 'Account creation timestamp' },
            ],
        },
    },
    {
        id: 'table-2',
        type: 'table',
        position: { x: 500, y: 100 },
        data: {
            table: 'posts',
            description: 'Blog posts and articles',
            columns: [
                { name: 'id', type: 'number', isPrimaryKey: true, description: 'Unique post identifier' },
                { name: 'title', type: 'text', description: 'Post title' },
                { name: 'content', type: 'text', description: 'Post content' },
                { name: 'user_id', type: 'number', isForeignKey: true, references: { table: 'users', column: 'id' }, description: 'Author user ID' },
                { name: 'published', type: 'boolean', description: 'Publication status' },
            ],
        },
    },
    {
        id: 'table-3',
        type: 'table',
        position: { x: 900, y: 100 },
        data: {
            table: 'comments',
            description: 'User comments on posts',
            columns: [
                { name: 'id', type: 'number', isPrimaryKey: true, description: 'Unique comment identifier' },
                { name: 'post_id', type: 'number', isForeignKey: true, references: { table: 'posts', column: 'id' }, description: 'Related post ID' },
                { name: 'user_id', type: 'number', isForeignKey: true, references: { table: 'users', column: 'id' }, description: 'Commenter user ID' },
                { name: 'text', type: 'text', description: 'Comment text' },
                { name: 'created_at', type: 'text', description: 'Comment timestamp' },
            ],
        },
    },
]

/* --------------------------------- App ----------------------------------- */

export default function Flow() {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([])
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

    // single busy flag + label for any work
    const [isBusy, setIsBusy] = React.useState(false)
    const [busyLabel, setBusyLabel] = React.useState<string>('Loading…')
    const saving = React.useRef(false)

    // versioning UI state
    const [showVersions, setShowVersions] = React.useState(false)
    const [history, setHistory] = React.useState<HistoryItem[]>([])
    const [latestVersion, setLatestVersion] = React.useState<number | null>(null)

    const [showChat, setShowChat] = React.useState(false)
    
    // Storage mode state - Default to database mode, but fallback to local for non-logged users
    const [storageMode, setStorageModeState] = React.useState<StorageMode>('database')
    const [currentSchemaId, setCurrentSchemaId] = React.useState<string | undefined>(undefined)
    const [isLoggedIn, setIsLoggedIn] = React.useState<boolean>(false)
    const [sessionId, setSessionId] = React.useState<string | null>(null)
    const [currentVersionId, setCurrentVersionId] = React.useState<string | null>(null)

    // inject callbacks so TableNode can call them
    const refetchRef = React.useRef<() => Promise<void>>(() => Promise.resolve())
    const withInjected = React.useCallback(
        (arr: Node<TableNodeData>[]) => {
            const reserved = arr.map((n) => n.data.table)
            return arr.map((n) =>
                n.type === 'table'
                    ? {
                        ...n,
                        data: {
                            ...n.data,
                            reservedTableNames: reserved,
                            onEditColumns: handleEditColumns,
                            onEditTableMeta: handleEditMeta,
                            onRefresh: () => refetchRef.current(),
                        },
                    }
                    : n
            )
        },
        // deps intentionally empty to keep a stable mapper
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    const fetchHistory = React.useCallback(async () => {
        // Always try to load version history from database using sessionId
        try {
            const currentSessionId = sessionId || localStorage.getItem('etl-ai-sessionId')
            if (currentSessionId) {
                const response = await fetch(`/api/schemas?sessionId=${currentSessionId}`)
                if (response.ok) {
                    const { schemas } = await response.json()
                    const defaultSchema = schemas.find((s: any) => s.name === 'default')
                    if (defaultSchema) {
                        // Fetch all versions for this schema
                        const versionsResponse = await fetch(`/api/schemas/${defaultSchema.id}`)
                        if (versionsResponse.ok) {
                            const { schema: schemaWithVersions } = await versionsResponse.json()
                            if (schemaWithVersions.versions) {
                                const historyItems = schemaWithVersions.versions.map((v: any) => ({
                                    version: v.version,
                                    created_at: v.createdAt,
                                    restored_from: v.restoredFrom
                                })).sort((a: any, b: any) => b.version - a.version) // Sort by version desc
                                
                                setHistory(historyItems)
                                // Use currentVersion from database
                                setLatestVersion(defaultSchema.currentVersion || defaultSchema.version)
                                return
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch history from database:', err)
        }
        
        // Fallback to local mock history
        const items: HistoryItem[] = [
            { version: 1, created_at: new Date().toISOString(), restored_from: null }
        ]
        setHistory(items)
        if (items.length > 0) setLatestVersion(items[0].version)
    }, [sessionId])

    const fetchGraph = React.useCallback(async () => {
        setBusyLabel('Initializing session…')
        setIsBusy(true)
        
        try {
            // Check if user is logged in first
            let isAuthenticated = false
            let userId = null
            let currentSessionId: string = ''
            
            try {
                // Try to get session info from auth endpoint (reads from cookies)
                const authResponse = await fetch('/api/auth/session')
                if (authResponse.ok) {
                    const authData = await authResponse.json()
                    if (authData.user) {
                        isAuthenticated = true
                        userId = authData.user.id
                        currentSessionId = userId // Use userId as sessionId for logged-in users
                    }
                }
            } catch (err) {
                // User not logged in, continue with guest session
            }
            
            if (isAuthenticated && userId) {
                // User is logged in - use userId as sessionId
                setBusyLabel('Loading from database…')
            } else {
                // User not logged in - generate UUID sessionId for guest
                currentSessionId = localStorage.getItem('etl-ai-sessionId') || uuidv4()
                if (!localStorage.getItem('etl-ai-sessionId')) {
                    localStorage.setItem('etl-ai-sessionId', currentSessionId)
                }
                setBusyLabel('Loading from database…')
            }
            
            setSessionId(currentSessionId)
            setIsLoggedIn(isAuthenticated)
            
            // Schema ID will be determined from database query
            
            // Version will be loaded from database currentVersion field
            
            // Try to load from database with sessionId
            try {
                const response = await fetch(`/api/schemas?sessionId=${currentSessionId}`)
                
                if (response.ok) {
                    const { schemas } = await response.json()
                    const defaultSchema = schemas.find((s: any) => s.name === 'default')
                    
                    if (defaultSchema) {
                        // Load existing schema from database
                        setCurrentSchemaId(defaultSchema.id)
                        
                        // Use currentVersion from database
                        const targetVersion = defaultSchema.currentVersion || defaultSchema.version
                        setLatestVersion(targetVersion)
                        
                        // Load the specific version's graph data if needed
                        let graphData = defaultSchema.graphJson
                        if (targetVersion !== defaultSchema.version) {
                            // Load specific version from database
                            try {
                                const versionsResponse = await fetch(`/api/schemas/${defaultSchema.id}`)
                                if (versionsResponse.ok) {
                                    const { schema: schemaWithVersions } = await versionsResponse.json()
                                    const versionData = schemaWithVersions.versions.find((v: any) => v.version === targetVersion)
                                    if (versionData) {
                                        graphData = versionData.graphJson
                                    }
                                }
                            } catch (err) {
                                console.log('Failed to load specific version, using latest')
                            }
                        }
                        
                        const injected = withInjected(graphData.nodes as Node<TableNodeData>[])
                        const rebuiltEdges = buildEdgesFromRefs(injected)
                        const laid = layoutNodes(injected, rebuiltEdges)
                        setNodes(laid)
                        setEdges(rebuiltEdges)
                        
                        // Show toast for database load
                        toast.success('Schema loaded from database', {
                            description: `Version: ${targetVersion}`,
                            duration: 3000,
                        })
                        
                        await fetchHistory()
                        return
                    }
                }
            } catch (dbError) {
                console.log('Database not available or no schema found, creating sample schema')
            }
            
            // No schema found - create version 1 from sample data
            try {
                const dataToSave = {
                    nodes: SAMPLE_NODES,
                    edges: []
                }
                
                const versionId = `v_${uuidv4()}`
                
                // Create new schema with sample data
                const response = await fetch('/api/schemas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: currentSessionId,
                        versionId,
                        graphJson: dataToSave
                    })
                })
                
                if (response.ok) {
                    const { schema } = await response.json()
                    setCurrentSchemaId(schema.id)
                    setLatestVersion(1)
                    
                    const injected = withInjected(SAMPLE_NODES)
                    const rebuiltEdges = buildEdgesFromRefs(injected)
                    const laid = layoutNodes(injected, rebuiltEdges)
                    setNodes(laid)
                    setEdges(rebuiltEdges)
                    
                    // Show toast for sample schema creation
                    toast.success('Sample schema created', {
                        description: 'Version 1 created from sample data',
                        duration: 3000,
                    })
                    
                    await fetchHistory()
                    return
                }
            } catch (createError) {
                console.error('Failed to create sample schema:', createError)
            }
            
            // Fallback to sample data if schema creation fails
            const injected = withInjected(SAMPLE_NODES)
            const rebuiltEdges = buildEdgesFromRefs(injected)
            const laid = layoutNodes(injected, rebuiltEdges)
            setNodes(laid)
            setEdges(rebuiltEdges)
            
            // Show toast for fallback
            toast.info('Using sample data', {
                description: 'Schema creation failed, using fallback',
                duration: 3000,
            })
            
            await fetchHistory()
        } catch (err: any) {
            console.error('Error loading schema:', err)
            
            // Fallback to sample data on error
            const injected = withInjected(SAMPLE_NODES)
            const rebuiltEdges = buildEdgesFromRefs(injected)
            const laid = layoutNodes(injected, rebuiltEdges)
            setNodes(laid)
            setEdges(rebuiltEdges)
            
            toast.error('Failed to load schema', {
                description: 'Using sample data as fallback',
                duration: 4000,
            })
        } finally {
            setIsBusy(false)
            // Reset loading state after a delay
            setTimeout(() => {
            }, 2000)
        }
    }, [fetchHistory, setEdges, setNodes, withInjected])

    // keep ref in sync with latest fetchGraph
    React.useEffect(() => {
        refetchRef.current = fetchGraph
    }, [fetchGraph])

    const saveGraph = React.useCallback(
        async (nextNodes: Node<TableNodeData>[], nextEdges: Edge[]) => {
            if (saving.current) return
            saving.current = true
            setBusyLabel('Saving…')
            setIsBusy(true)
            try {
                const dataToSave = {
                    nodes: nextNodes,
                    edges: nextEdges
                }
                
                const currentSessionId = sessionId || localStorage.getItem('etl-ai-sessionId') || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                // Auto-generate UUID versionId for every save
                const versionId = `v_${uuidv4()}`
                setCurrentVersionId(versionId)
                
                // Save to database using sessionId (works for both logged-in and guest users)
                const url = currentSchemaId ? `/api/schemas/${currentSchemaId}` : '/api/schemas'
                const method = currentSchemaId ? 'PUT' : 'POST'
                
                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: currentSessionId,
                        versionId,
                        graphJson: dataToSave
                    })
                })
                
                if (!response.ok) {
                    const error = await response.json()
                    throw new Error(error.error || 'Failed to save')
                }
                
                const { schema, version: newVersion } = await response.json()
                
                // Update schema ID if this was first save
                if (!currentSchemaId && schema.id) {
                    setCurrentSchemaId(schema.id)
                }
                
                // Update version
                const versionNum = newVersion ?? schema.version ?? (latestVersion ?? 0) + 1
                setLatestVersion(versionNum)
                
                // Auto-switch to new version after save
                if (schema.id) {
                    try {
                        await fetch(`/api/schemas/${schema.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ currentVersion: versionNum })
                        })
                    } catch (err) {
                        console.error('Failed to update currentVersion:', err)
                    }
                }
                
                // Refresh history from database to avoid duplicates
                await fetchHistory()
                
                toast.success('Schema saved successfully', {
                    description: `Version: ${versionNum}`,
                    duration: 3000,
                })
            } catch (err: any) {
                console.error('Save error:', err)
                toast.error('Failed to save schema', {
                    description: err.message || 'Unknown error',
                    duration: 4000,
                })
            } finally {
                saving.current = false
                setIsBusy(false)
            }
        },
        [latestVersion, currentSchemaId, isLoggedIn, sessionId]
    )

    // Initialize history on mount
    React.useEffect(() => {
        fetchHistory()
    }, [fetchHistory])
    
    // load once
    React.useEffect(() => {
        ; (async () => {
            await fetchGraph()
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    
    // Database mode only - no toggle needed

    // edit helpers
    const applyUpdate = React.useCallback(
        (updater: (prev: Node<TableNodeData>[]) => Node<TableNodeData>[]) => {
            setNodes((prev) => {
                const updated = updater(prev)
                const edges2 = buildEdgesFromRefs(updated)
                const laid = layoutNodes(updated, edges2)
                queueMicrotask(() => {
                    setEdges(edges2)
                    saveGraph(laid, edges2)
                })
                return laid
            })
        },
        [saveGraph, setEdges, setNodes]
    )

    const handleEditColumns = React.useCallback(
        (nodeId: string, nextCols: Column[]) =>
            applyUpdate((prev) =>
                withInjected(prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, columns: nextCols } } : n)))
            ),
        [applyUpdate, withInjected]
    )

    const handleEditMeta = React.useCallback(
        (nodeId: string, next: { table: string; description?: string }) =>
            applyUpdate((prev) => {
                // rename table and update FK references pointing to it
                const me = prev.find((n) => n.id === nodeId)
                if (!me) return prev
                const oldName = me.data.table
                const renamed = prev.map((n) =>
                    n.id === nodeId ? { ...n, data: { ...n.data, table: next.table, description: next.description } } : n
                )
                const fixedRefs = renamed.map((n) => {
                    if (n.id === nodeId) return n
                    const cols = n.data.columns.map((c) =>
                        c.isForeignKey && c.references && c.references.table.toLowerCase() === oldName.toLowerCase()
                            ? { ...c, references: { ...c.references, table: next.table } }
                            : c
                    )
                    return { ...n, data: { ...n.data, columns: cols } }
                })
                return withInjected(fixedRefs)
            }),
        [applyUpdate, withInjected]
    )

    // connect FK → PK
    const parseHandleId = (h?: string) => {
        if (!h) return null
        const parts = h.split('__')
        if (parts.length < 3) return null
        const [table, col, suffix] = [parts[0], parts.slice(1, -1).join('__'), parts[parts.length - 1]]
        return { table, column: col, suffix: suffix as 'in' | 'out' }
    }

    const onConnect = React.useCallback(
        (c: Connection) => {
            const src = nodes.find((n) => n.id === c.source)
            const dst = nodes.find((n) => n.id === c.target)
            if (!src || !dst) return

            const srcH = parseHandleId(c.sourceHandle ?? undefined)
            const dstH = parseHandleId(c.targetHandle ?? undefined)
            if (!srcH || !dstH) return

            // only allow FK (source out) -> PK (target in)
            const srcCol = src.data.columns.find((col) => safeId(src.data.table, col.name, 'out') === c.sourceHandle)
            const dstCol = dst.data.columns.find((col) => safeId(dst.data.table, col.name, 'in') === c.targetHandle)
            if (!srcCol?.isForeignKey || !dstCol?.isPrimaryKey) return

            applyUpdate((prev) =>
                withInjected(
                    prev.map((n) => {
                        if (n.id !== src.id) return n
                        const nextCols = n.data.columns.map((col) =>
                            safeId(n.data.table, col.name, 'out') === c.sourceHandle
                                ? { ...col, isForeignKey: true, references: { table: dst.data.table, column: dstH.column } }
                                : col
                        )
                        return { ...n, data: { ...n.data, columns: nextCols } }
                    })
                )
            )
        },
        [nodes, applyUpdate, withInjected]
    )

    /* ---------------------------- Restore actions --------------------------- */

    const handleOpenVersions = async () => {
        setShowVersions(true)
        await fetchHistory()
    }

    const handleRestore = async (version: number) => {
        setBusyLabel(`Restoring v${version}…`)
        setIsBusy(true)
        try {
            // Get the current session ID
            const currentSessionId = sessionId || localStorage.getItem('etl-ai-sessionId')
            if (!currentSessionId) {
                throw new Error('No session found')
            }

            // Find the schema for this session
            const response = await fetch(`/api/schemas?sessionId=${currentSessionId}`)
            if (!response.ok) {
                throw new Error('Failed to fetch schema')
            }

            const { schemas } = await response.json()
            const defaultSchema = schemas.find((s: any) => s.name === 'default')
            if (!defaultSchema) {
                throw new Error('Schema not found')
            }

            // Get all versions for this schema
            const versionsResponse = await fetch(`/api/schemas/${defaultSchema.id}`)
            if (!versionsResponse.ok) {
                throw new Error('Failed to fetch versions')
            }

            const { schema: schemaWithVersions } = await versionsResponse.json()
            const targetVersion = schemaWithVersions.versions.find((v: any) => v.version === version)
            if (!targetVersion) {
                throw new Error(`Version ${version} not found`)
            }

            // Restore the target version's graph
            const raw = targetVersion.graphJson
            const injected = withInjected(raw.nodes as Node<TableNodeData>[])
            const rebuiltEdges = buildEdgesFromRefs(injected)
            const laid = layoutNodes(injected, rebuiltEdges)
            
            setNodes(laid)
            setEdges(rebuiltEdges)
            setLatestVersion(version)
            
            // Update currentVersion in database
            if (currentSchemaId) {
                try {
                    await fetch(`/api/schemas/${currentSchemaId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentVersion: version })
                    })
                } catch (err) {
                    console.error('Failed to update currentVersion in database:', err)
                }
            }
            
            // Refresh history to show current state
            await fetchHistory()

            toast.success(`Restored to version ${version}`)
            setShowVersions(false)
        } catch (err: any) {
            console.error('Restore error:', err)
            toast.error(`Failed to restore version ${version}: ${err.message}`)
        } finally {
            setIsBusy(false)
        }
    }

    /* --------------------------------- Render ------------------------------- */

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
            >
                <Background />
                <Controls />
            </ReactFlow>

            {showChat && (
                <SidebarChat
                    onClose={() => setShowChat(false)}
                />
            )}

            {/* Action buttons panel */}
            <Panel position="top-left" className="mt-20 ml-3">
                <div className="flex gap-2 flex-wrap bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-white/20">
                    <button
                        onClick={handleOpenVersions}
                        className="px-3 py-2 rounded-xl border border-indigo-200/50 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-all duration-200 hover:from-indigo-600 hover:to-indigo-700 hover:-translate-y-0.5 hover:shadow-lg backdrop-blur-sm"
                        title={`View ${history.length} versions`}
                    >
                        <GitBranch className="w-4 h-4" />
                        Versions ({history.length})
                    </button>

                    <button
                        onClick={() => setShowChat((v) => !v)}
                        className="px-3 py-2 rounded-xl border border-purple-200/50 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-all duration-200 hover:from-purple-600 hover:to-purple-700 hover:-translate-y-0.5 hover:shadow-lg backdrop-blur-sm"
                        title="Open AI Assistant"
                    >
                        <MessageSquare className="w-4 h-4" />
                        Ask AI
                    </button>
                </div>
            </Panel>

            {/* versions modal */}
            {showVersions && (
                <div
                    onClick={() => setShowVersions(false)}
                    className="fixed inset-0 z-[950] bg-gray-900/45 backdrop-blur-sm grid place-items-center"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-[min(680px,92vw)] max-h-[80vh] overflow-auto bg-white rounded-2xl shadow-2xl p-5 grid gap-3"
                    >
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-base">Version History</div>
                            <button
                                onClick={() => setShowVersions(false)}
                                className="border border-black/8 bg-white rounded-lg px-2.5 py-1.5 cursor-pointer font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>

                        <div className="text-xs text-gray-500">
                            {latestVersion ? `Latest is v${latestVersion}.` : 'No versions yet.'}
                        </div>

                        <div className="grid gap-2">
                            {history.map((h) => {
                                const dateStr = new Date(h.created_at).toLocaleString()
                                const isLatest = h.version === latestVersion
                                return (
                                    <div
                                        key={h.version}
                                        className={`flex items-center justify-between p-3 rounded-xl border border-black/6 ${
                                            isLatest ? 'bg-emerald-50' : 'bg-white'
                                        }`}
                                    >
                                        <div className="grid gap-0.5">
                                            <div className="font-bold text-sm">
                                                v{h.version} {isLatest && <span className="font-semibold text-emerald-600">(latest)</span>}
                                            </div>
                                            <div className="text-xs text-gray-500">{dateStr}</div>
                                            {h.restored_from != null && (
                                                <div className="text-xs text-gray-500">restored from v{h.restored_from}</div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleRestore(h.version)}
                                                className="border border-black/10 bg-white rounded-lg px-2.5 py-1.5 cursor-pointer font-semibold hover:bg-gray-50 transition-colors"
                                            >
                                                Restore
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* blocks all interaction during any work */}
            <FullscreenLoader visible={isBusy} label={busyLabel} />
        </div>
    )
}
