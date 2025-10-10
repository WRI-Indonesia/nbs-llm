'use client'

import * as React from 'react'
import dagre from '@dagrejs/dagre'
import {
    ReactFlow,
    Controls,
    Background,
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
import { Database, GitBranch, MessageSquare, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
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
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(17, 24, 39, 0.45)',
                backdropFilter: 'blur(3px)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gap: 12,
                    placeItems: 'center',
                    padding: '18px 22px',
                    background: 'rgba(255,255,255,0.95)',
                    borderRadius: 12,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                    minWidth: 160,
                }}
            >
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: '9999px',
                        border: '4px solid rgba(0,0,0,0.15)',
                        borderTopColor: '#111827',
                        animation: 'spin 0.9s linear infinite',
                    }}
                />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{label}</span>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    const [loadingState, setLoadingState] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [lastAction, setLastAction] = React.useState<string>('')
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
        setLoadingState('loading')
        setLastAction('Initializing')
        
        try {
            // Generate UUID for sessionId if not logged in, or use DB sessionId if logged in
            let currentSessionId: string = localStorage.getItem('etl-ai-sessionId') || ''
            
            // Check if user is logged in first
            let isAuthenticated = false
            let userId = null
            
            try {
                // Try to get session info from auth endpoint
                const authResponse = await fetch('/api/auth/session')
                if (authResponse.ok) {
                    const authData = await authResponse.json()
                    if (authData.user) {
                        isAuthenticated = true
                        userId = authData.user.id
                    }
                }
            } catch (err) {
                // User not logged in, continue with localStorage
            }
            
            if (isAuthenticated && userId) {
                // User is logged in - use userId as sessionId
                currentSessionId = userId
                localStorage.setItem('etl-ai-sessionId', currentSessionId)
                setBusyLabel('Loading from database…')
                setLastAction('Loading from database')
            } else {
                // User not logged in - generate UUID sessionId
                if (!currentSessionId) {
                    currentSessionId = uuidv4()
                    localStorage.setItem('etl-ai-sessionId', currentSessionId)
                }
                setBusyLabel('Loading from database…')
                setLastAction('Loading from database')
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
                        setLoadingState('success')
                        setLastAction('Loaded from database')
                        
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
                    setLoadingState('success')
                    setLastAction('Created sample schema')
                    
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
            setLoadingState('success')
            setLastAction('Using sample data (fallback)')
            
            // Show toast for fallback
            toast.info('Using sample data', {
                description: 'Schema creation failed, using fallback',
                duration: 3000,
            })
            
            await fetchHistory()
        } catch (err: any) {
            console.error('Error loading schema:', err)
            setLoadingState('error')
            setLastAction('Error loading')
            
            // Fallback to sample data on error
            const injected = withInjected(SAMPLE_NODES)
            const rebuiltEdges = buildEdgesFromRefs(injected)
            const laid = layoutNodes(injected, rebuiltEdges)
            setNodes(laid)
            setEdges(rebuiltEdges)
            setLoadingState('success')
            setLastAction('Fallback to sample data')
            
            toast.error('Failed to load schema', {
                description: 'Using sample data as fallback',
                duration: 4000,
            })
        } finally {
            setIsBusy(false)
            // Reset loading state after a delay
            setTimeout(() => {
                setLoadingState('idle')
                setLastAction('')
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

            {/* floating action buttons */}
            <div style={{ 
                position: 'fixed', 
                top: 80, // Moved down to avoid header overlap
                left: 12, 
                zIndex: 900, 
                display: 'flex', 
                gap: 8, 
                flexWrap: 'wrap',
                backgroundColor: 'rgba(255,255,255,0.95)', // More opaque background
                backdropFilter: 'blur(10px)', // Modern glass effect
                padding: '8px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)', // Modern shadow
                border: '1px solid rgba(255,255,255,0.2)' // Subtle border
            }}>
                
                {/* Modern Loading Status Indicator */}
                {loadingState !== 'idle' && (
                    <div
                        style={{
                            padding: '8px 12px',
                            borderRadius: 12,
                            border: `1px solid ${
                                loadingState === 'loading' ? 'rgba(59,130,246,0.2)' :
                                loadingState === 'success' ? 'rgba(34,197,94,0.2)' :
                                'rgba(239,68,68,0.2)'
                            }`,
                            background: `linear-gradient(135deg, ${
                                loadingState === 'loading' ? '#3b82f6, #2563eb' :
                                loadingState === 'success' ? '#22c55e, #16a34a' :
                                '#ef4444, #dc2626'
                            })`,
                            color: 'white',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            fontSize: 13,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            backdropFilter: 'blur(10px)',
                            animation: loadingState === 'loading' ? 'pulse 2s infinite' : 'none'
                        }}
                        title={lastAction}
                    >
                        {loadingState === 'loading' && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                        {loadingState === 'success' && <CheckCircle style={{ width: 16, height: 16 }} />}
                        {loadingState === 'error' && <AlertCircle style={{ width: 16, height: 16 }} />}
                        {lastAction}
                    </div>
                )}
                
                <button
                    onClick={handleOpenVersions}
                    style={{
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(99,102,241,0.2)',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backdropFilter: 'blur(10px)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #4f46e5, #4338ca)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    title={`View ${history.length} versions`}
                >
                    <GitBranch style={{ width: 16, height: 16 }} />
                    Versions ({history.length})
                </button>


                <button
                    onClick={() => setShowChat((v) => !v)}
                    style={{
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(168,85,247,0.2)',
                        background: 'linear-gradient(135deg, #a855f7, #9333ea)',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backdropFilter: 'blur(10px)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #9333ea, #7c3aed)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #a855f7, #9333ea)'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    title="Open AI Assistant"
                >
                    <MessageSquare style={{ width: 16, height: 16 }} />
                    Ask AI
                </button>
            </div>

            {/* versions modal */}
            {showVersions && (
                <div
                    onClick={() => setShowVersions(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 950,
                        background: 'rgba(17,24,39,0.45)',
                        backdropFilter: 'blur(2px)',
                        display: 'grid',
                        placeItems: 'center',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(680px, 92vw)',
                            maxHeight: '80vh',
                            overflow: 'auto',
                            background: 'white',
                            borderRadius: 14,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                            padding: 18,
                            display: 'grid',
                            gap: 12,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>Version History</div>
                            <button
                                onClick={() => setShowVersions(false)}
                                style={{
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    background: 'white',
                                    borderRadius: 8,
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Close
                            </button>
                        </div>

                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {latestVersion ? `Latest is v${latestVersion}.` : 'No versions yet.'}
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            {history.map((h) => {
                                const dateStr = new Date(h.created_at).toLocaleString()
                                const isLatest = h.version === latestVersion
                                return (
                                    <div
                                        key={h.version}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            border: '1px solid rgba(0,0,0,0.06)',
                                            background: isLatest ? 'rgba(16,185,129,0.06)' : 'white',
                                        }}
                                    >
                                        <div style={{ display: 'grid', gap: 2 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14 }}>
                                                v{h.version} {isLatest && <span style={{ fontWeight: 600, color: '#10b981' }}>(latest)</span>}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>{dateStr}</div>
                                            {h.restored_from != null && (
                                                <div style={{ fontSize: 12, color: '#6b7280' }}>restored from v{h.restored_from}</div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => handleRestore(h.version)}
                                                style={{
                                                    border: '1px solid rgba(0,0,0,0.1)',
                                                    background: 'white',
                                                    borderRadius: 8,
                                                    padding: '6px 10px',
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                }}
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
