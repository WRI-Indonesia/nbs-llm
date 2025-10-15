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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { saveSchema, loadSchema, setStorageMode, type StorageMode, saveToLocal, loadFromLocal, getLocalVersionHistory } from '@/lib/schema-storage'
import { GitBranch, MessageSquare, Plus, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'
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
            const sourceHandleId = safeId(src.data.table, col.name, 'out')
            const targetHandleId = safeId(dst.data.table, pk.name, 'in')
            
            
            edges.push({
                id: `${src.id}.${col.name}-->${dst.id}.${pk.name}`,
                source: src.id,
                target: dst.id,
                sourceHandle: sourceHandleId,
                targetHandle: targetHandleId,
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
            data: [
                { id: 1, username: 'john_doe', email: 'john@example.com', created_at: '2024-01-15' },
                { id: 2, username: 'jane_smith', email: 'jane@example.com', created_at: '2024-01-16' },
                { id: 3, username: 'bob_wilson', email: 'bob@example.com', created_at: '2024-01-17' },
                { id: 4, username: 'alice_brown', email: 'alice@example.com', created_at: '2024-01-18' },
                { id: 5, username: 'charlie_davis', email: 'charlie@example.com', created_at: '2024-01-19' },
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
            data: [
                { id: 1, title: 'Getting Started with React', content: 'Learn the basics of React development...', user_id: 1, published: true },
                { id: 2, title: 'Advanced SQL Techniques', content: 'Master complex SQL queries and optimization...', user_id: 2, published: true },
                { id: 3, title: 'Draft: Future of AI', content: 'Exploring the potential of artificial intelligence...', user_id: 3, published: false },
                { id: 4, title: 'Database Design Best Practices', content: 'Essential principles for designing robust databases...', user_id: 1, published: true },
                { id: 5, title: 'Draft: Web Security Guide', content: 'Comprehensive guide to web application security...', user_id: 4, published: false },
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
            data: [
                { id: 1, post_id: 1, user_id: 2, text: 'Great tutorial! Very helpful.', created_at: '2024-01-20' },
                { id: 2, post_id: 1, user_id: 3, text: 'Thanks for sharing this.', created_at: '2024-01-21' },
                { id: 3, post_id: 2, user_id: 1, text: 'Excellent SQL examples.', created_at: '2024-01-22' },
                { id: 4, post_id: 4, user_id: 5, text: 'Very informative post.', created_at: '2024-01-23' },
                { id: 5, post_id: 2, user_id: 4, text: 'Learned a lot from this.', created_at: '2024-01-24' },
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
    const fkChanged = React.useRef(false)

    // versioning UI state
    const [showVersions, setShowVersions] = React.useState(false)
    const [history, setHistory] = React.useState<HistoryItem[]>([])
    const [latestVersion, setLatestVersion] = React.useState<number | null>(null)

    const [showChat, setShowChat] = React.useState(false)
    
    // Add node modal state
    const [showAddNodeModal, setShowAddNodeModal] = React.useState(false)
    const [newTableName, setNewTableName] = React.useState('')
    const [newTableDescription, setNewTableDescription] = React.useState('')
    
    // Storage mode state - Default to database mode, but fallback to local for non-logged users
    const [storageMode, setStorageModeState] = React.useState<StorageMode>('database')
    const [currentSchemaId, setCurrentSchemaId] = React.useState<string | undefined>(undefined)
    const [isLoggedIn, setIsLoggedIn] = React.useState<boolean>(false)
    const [sessionId, setSessionId] = React.useState<string | null>(null)
    const [currentVersionId, setCurrentVersionId] = React.useState<string | null>(null)
    const [refreshKey, setRefreshKey] = React.useState(0)

    // inject callbacks so TableNode can call them
    const refetchRef = React.useRef<() => Promise<void>>(() => Promise.resolve())
    
    // Create refs to store handlers to avoid circular dependencies
    const handleEditColumnsRef = React.useRef<((nodeId: string, nextCols: Column[]) => void) | null>(null)
    const handleEditMetaRef = React.useRef<((nodeId: string, next: { table: string; description?: string }) => void) | null>(null)
    const handleAfterImportRef = React.useRef<((nodeId: string, payload: { columns: Column[]; data: any[]; metadata: { table: string; description?: string } }) => void) | null>(null)
    
    // Create a refresh function to update handles and edges
    const refreshFlow = React.useCallback(() => {
        // Force React Flow to update by triggering a re-render
        setNodes(currentNodes => {
            // Rebuild edges to ensure they match the current handles
            const newEdges = buildEdgesFromRefs(currentNodes)
            const laid = layoutNodes(currentNodes, newEdges)
            
            // Update edges immediately
            setEdges(newEdges)
            
            // Force React Flow to re-render by updating the key
            setRefreshKey(prev => prev + 1)
            
            // Return the laid out nodes to trigger React Flow update
            return laid
        })
    }, [setNodes, setEdges])

    const fetchHistory = React.useCallback(async () => {
        // Always try to load version history from database using currentSchemaId
        try {
            if (currentSchemaId) {
                // Fetch all versions for the current schema
                const versionsResponse = await fetch(`/api/schemas/${currentSchemaId}`)
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
                        setLatestVersion(schemaWithVersions.currentVersion || schemaWithVersions.version)
                        return
                    }
                }
            }
            
            // Fallback: try to load version history from database using sessionId
            const currentSessionId = sessionId || localStorage.getItem('etl-ai-sessionId')
            if (currentSessionId) {
                const response = await fetch(`/api/schemas?sessionId=${currentSessionId}`)
                if (response.ok) {
                    const { schemas } = await response.json()
                    const defaultSchema = schemas.find((s: any) => s.name.startsWith('playground-'))
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
    }, [currentSchemaId, sessionId])

    const fetchGraph = React.useCallback(async () => {
        setBusyLabel('Initializing session…')
        setIsBusy(true)
        
        try {
            // Check if user is logged in first
            let isAuthenticated = false
            let userId = null
            let currentSessionId: string = ''
            let schemaId: string | null = null
            
            // Check for schemaId in URL parameters (for logged-in users)
            const urlParams = new URLSearchParams(window.location.search)
            schemaId = urlParams.get('schemaId')
            
            try {
                // Try to get session info from auth endpoint (reads from cookies)
                const authResponse = await fetch('/api/auth/session')
                if (authResponse.ok) {
                    const authData = await authResponse.json()
                    if (authData.user) {
                        isAuthenticated = true
                        userId = authData.user.id
                        
                        if (schemaId) {
                            // Logged-in user with specific schemaId
                            currentSessionId = schemaId
                        } else {
                            // Logged-in user without schemaId - redirect to schema selection
                            window.location.href = '/schemas'
                            return
                        }
                    }
                }
            } catch (err) {
                // User not logged in, continue with guest session
            }
            
            if (isAuthenticated && userId) {
                // User is logged in - use schemaId as sessionId
                setBusyLabel('Loading schema from database…')
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
                let response: Response
                
                if (isAuthenticated && schemaId) {
                    // For logged-in users, fetch specific schema by ID
                    response = await fetch(`/api/schemas/${schemaId}`)
                } else {
                    // For guest users, fetch by sessionId
                    response = await fetch(`/api/schemas?sessionId=${currentSessionId}`)
                }
                
                if (response.ok) {
                    let defaultSchema: any
                    
                    if (isAuthenticated && schemaId) {
                        // For logged-in users, we get the schema directly
                        const { schema } = await response.json()
                        defaultSchema = schema
                    } else {
                        // For guest users, find the playground schema
                        const { schemas } = await response.json()
                        defaultSchema = schemas.find((s: any) => s.name.startsWith('playground-'))
                    }
                    
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
            
            // No schema found - handle based on user type
            if (isAuthenticated) {
                // Logged-in user without schemaId should not be here (redirected earlier)
                // But if they are, redirect to schema selection
                window.location.href = '/schemas'
                return
            } else {
                // Guest user - create version 1 from sample data
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
                            name: `playground-${uuidv4()}`,
                            description: 'Sample schema for playground',
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
            }
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
        }
    }, [fetchHistory, setEdges, setNodes])

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
                        name: `playground-${uuidv4()}`,
                        description: 'Flow schema design',
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
    }, [])
    
    // Database mode only - no toggle needed

    // edit helpers
    const applyUpdate = React.useCallback(
        (updater: (prev: Node<TableNodeData>[]) => Node<TableNodeData>[]) => {
            setNodes((prev) => {
                const updated = updater(prev)
                return updated
            })
        },
        [setNodes]
    )

    // Define withInjected using refs to avoid circular dependencies
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
                            otherTables: arr
                                .filter(node => node.id !== n.id && node.type === 'table')
                                .map(node => ({
                                    table: node.data.table,
                                    columns: node.data.columns
                                })),
                            onEditColumns: (nodeId: string, nextCols: Column[]) => handleEditColumnsRef.current?.(nodeId, nextCols),
                            onEditTableMeta: (nodeId: string, next: { table: string; description?: string }) => handleEditMetaRef.current?.(nodeId, next),
                            onAfterImport: (nodeId: string, payload: { columns: Column[]; data: any[]; metadata: { table: string; description?: string } }) => handleAfterImportRef.current?.(nodeId, payload),
                            onRefresh: refreshFlow,
                        },
                    }
                    : n
            )
        },
        [refreshFlow]
    )

    // Rebuild edges only when FK references change
    React.useEffect(() => {
        if (nodes.length > 0 && fkChanged.current) {
            // Immediately rebuild edges and update handles
            const edges2 = buildEdgesFromRefs(nodes)
            const laid = layoutNodes(nodes, edges2)
            setEdges(edges2)
            saveGraph(laid, edges2)
            
            // Reset the flag after processing
            fkChanged.current = false
        }
    }, [nodes, setEdges, saveGraph])

    const handleEditColumns = React.useCallback(
        (nodeId: string, nextCols: Column[]) => {
            
            // Set flag to indicate FK changes
            fkChanged.current = true
            
            applyUpdate((prev) => {
                const updated = prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, columns: nextCols } } : n))
                return withInjected(updated)
            })
            
            // Refresh needed when creating/removing foreign keys via modal
            refreshFlow()
        },
        [applyUpdate, withInjected, refreshFlow]
    )

    // Store the handler in the ref
    React.useEffect(() => {
        handleEditColumnsRef.current = handleEditColumns
    }, [handleEditColumns])

    const handleEditMeta = React.useCallback(
        (nodeId: string, next: { table: string; description?: string }) => {
            // Set flag to indicate FK changes
            fkChanged.current = true
            
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
            })
            
            // No refresh needed for metadata edits - only rebuild edges
        },
        [applyUpdate, withInjected]
    )

    // Store the handler in the ref
    React.useEffect(() => {
        handleEditMetaRef.current = handleEditMeta
    }, [handleEditMeta])

    const handleAfterImport = React.useCallback(
        (nodeId: string, payload: { columns: Column[]; data: any[]; metadata: { table: string; description?: string } }) => {
            // Set flag to indicate FK changes
            fkChanged.current = true
            
            applyUpdate((prev) => {
                const updated = prev.map((n) => {
                    if (n.id === nodeId) {
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                table: payload.metadata.table,
                                description: payload.metadata.description || n.data.description,
                                columns: payload.columns,
                                data: payload.data
                            }
                        }
                    }
                    return n
                })
                return withInjected(updated)
            })
            
            // Refresh needed for Excel import - this changes table structure significantly
            refreshFlow()
        },
        [applyUpdate, withInjected, refreshFlow]
    )

    // Store the handler in the ref
    React.useEffect(() => {
        handleAfterImportRef.current = handleAfterImport
    }, [handleAfterImport])





    const handleAddNode = React.useCallback(() => {
        if (!newTableName.trim() || !newTableDescription.trim()) {
            toast.error('Validation Error', {
                description: 'Please provide both table name and description.',
                duration: 3000,
            })
            return
        }

        // Check if table name already exists
        const existingTable = nodes.find(n => n.data.table.toLowerCase() === newTableName.trim().toLowerCase())
        if (existingTable) {
            toast.error('Table Name Exists', {
                description: `A table with the name "${newTableName.trim()}" already exists.`,
                duration: 3000,
            })
            return
        }

        const newNode: Node<TableNodeData> = {
            id: `table-${uuidv4()}`,
            type: 'table',
            position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
            data: {
                table: newTableName.trim(),
                description: newTableDescription.trim(),
                columns: [
                    { name: 'id', type: 'number', isPrimaryKey: true, description: 'Unique identifier' }
                ],
                data: []
            }
        }

        applyUpdate((prev) => {
            const updated = [...prev, newNode]
            return withInjected(updated)
        })

        // Refresh needed when adding a new node
        refreshFlow()

        // Save the new table to database immediately
        setNodes(currentNodes => {
            setEdges(currentEdges => {
                saveGraph(currentNodes, currentEdges)
                return currentEdges
            })
            return currentNodes
        })

        // Reset form and close modal
        setNewTableName('')
        setNewTableDescription('')
        setShowAddNodeModal(false)

        toast.success('Table Created', {
            description: `Table "${newTableName.trim()}" has been created successfully.`,
            duration: 3000,
        })
    }, [newTableName, newTableDescription, nodes, applyUpdate, withInjected, refreshFlow, saveGraph])

    // Handle node changes and save to database only on deletions
    const handleNodesChange = React.useCallback((changes: any[]) => {
        // Check if any nodes are being deleted
        const hasDeletions = changes.some(change => change.type === 'remove')
        
        onNodesChange(changes)
        
        // Only save if there are deletions and not already saving
        if (hasDeletions && !saving.current) {
            // Set flag to indicate FK changes
            fkChanged.current = true
            
            // Refresh needed when deleting nodes
            refreshFlow()
            
            // Immediately save with current state
            setNodes(currentNodes => {
                setEdges(currentEdges => {
                    saveGraph(currentNodes, currentEdges)
                    return currentEdges
                })
                return currentNodes
            })
        }
    }, [onNodesChange, saveGraph, refreshFlow])

    // Handle manual connections (drag and drop)
    const handleConnect = React.useCallback((connection: Connection) => {
        if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
            return
        }
        
        // Parse handle IDs to get table and column information
        const sourceHandleId = connection.sourceHandle
        const targetHandleId = connection.targetHandle
        
        // Extract table and column from handle IDs (format: table__column__out/in)
        const sourceMatch = sourceHandleId.match(/^(.+)__(.+)__out$/)
        const targetMatch = targetHandleId.match(/^(.+)__(.+)__in$/)
        
        if (!sourceMatch || !targetMatch) {
            return
        }
        
        const [, sourceTable, sourceColumn] = sourceMatch
        const [, targetTable, targetColumn] = targetMatch
        
        // Set flag to indicate FK changes
        fkChanged.current = true
        
        // Find the source node and update its FK reference
        setNodes((currentNodes) => {
            const updatedNodes = currentNodes.map(node => {
                if (node.id === connection.source) {
                    const updatedColumns = node.data.columns.map(col => {
                        if (col.name === sourceColumn) {
                            return {
                                ...col,
                                isForeignKey: true,
                                references: { table: targetTable, column: targetColumn }
                            }
                        }
                        return col
                    })
                    return { ...node, data: { ...node.data, columns: updatedColumns } }
                }
                return node
            })
            
            return updatedNodes
        })
    }, [applyUpdate])

    // Handle edge changes and save to database only on deletions
    const handleEdgesChange = React.useCallback((changes: any[]) => {
        // Check if any edges are being deleted
        const hasDeletions = changes.some(change => change.type === 'remove')
        
        onEdgesChange(changes)
        
        // Only save if there are deletions and not already saving
        if (hasDeletions && !saving.current) {
            // Set flag to indicate FK changes
            fkChanged.current = true
            
            // Refresh needed when deleting edges
            refreshFlow()
            
            // Immediately update nodes to remove FK references for deleted edges
            setNodes(currentNodes => {
                const updatedNodes = currentNodes.map(node => {
                    const updatedColumns = node.data.columns.map(col => {
                        if (col.isForeignKey && col.references) {
                            // Check if this FK reference corresponds to a deleted edge
                            const targetNode = byTable(currentNodes, col.references.table)
                            if (targetNode) {
                                const pkCol = getPK(targetNode.data.columns, col.references.column)
                                if (pkCol) {
                                    const edgeId = `${node.id}.${col.name}-->${targetNode.id}.${pkCol.name}`
                                    const isDeleted = changes.some(change => change.type === 'remove' && change.id === edgeId)
                                    if (isDeleted) {
                                        // Remove the FK reference
                                        return { ...col, isForeignKey: false, references: undefined }
                                    }
                                }
                            }
                        }
                        return col
                    })
                    return { ...node, data: { ...node.data, columns: updatedColumns } }
                })
                
                return updatedNodes
            })
        }
    }, [onEdgesChange, applyUpdate, refreshFlow])

    // Sample download function
    const handleDownloadSample = React.useCallback(() => {
        // Create sample data for demonstration
        const sampleColumns: Column[] = [
            { name: 'id', type: 'number', isPrimaryKey: true, description: 'Unique identifier' },
            { name: 'name', type: 'text', description: 'Item name' },
            { name: 'price', type: 'number', description: 'Item price' },
            { name: 'active', type: 'boolean', description: 'Is item active' },
        ]
        
        const sampleData = [
            { id: 1, name: 'Sample Item 1', price: 29.99, active: true },
            { id: 2, name: 'Sample Item 2', price: 49.99, active: false },
            { id: 3, name: 'Sample Item 3', price: 19.99, active: true },
        ]
        
        // Create Excel file
        const workbook = XLSX.utils.book_new()
        
        // Create metadata sheet
        const metadataSheet = [
            ['Table Name', 'sample_table'],
            ['Description', 'Sample table for import demonstration'],
            [''],
            ['Column Name', 'Data Type', 'Description', 'Primary Key', 'Foreign Key', 'References Table'],
            ...sampleColumns.map(col => [
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
        const headers = sampleColumns.map(col => col.name)
        const dataSheet = [headers, ...sampleData.map(row => headers.map(header => (row as any)[header] || ''))]
        const dataWS = XLSX.utils.aoa_to_sheet(dataSheet)
        XLSX.utils.book_append_sheet(workbook, dataWS, 'Data')
        
        // Download the file
        XLSX.writeFile(workbook, 'sample_table_import.xlsx')
        
        toast.success('Sample Downloaded', {
            description: 'Sample Excel file downloaded. Use this as a template for your imports.',
            duration: 3000,
        })
    }, [])

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
            const defaultSchema = schemas.find((s: any) => s.name.startsWith('playground-'))
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
                key={refreshKey}
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                nodeTypes={{ table: TableNode }}
                fitView
                fitViewOptions={{ padding: 0.3 }}
            >
                <Background />
                <Controls />
            </ReactFlow>

            {showChat && (
                <SidebarChat
                    onClose={() => setShowChat(false)}
                    currentSchemaId={currentSchemaId}
                    sessionId={sessionId}
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

                    <button
                        onClick={() => setShowAddNodeModal(true)}
                        className="px-3 py-2 rounded-xl border border-green-200/50 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-all duration-200 hover:from-green-600 hover:to-green-700 hover:-translate-y-0.5 hover:shadow-lg backdrop-blur-sm"
                        title="Add new table"
                    >
                        <Plus className="w-4 h-4" />
                        Add Table
                    </button>

                    <button
                        onClick={handleDownloadSample}
                        className="px-3 py-2 rounded-xl border border-orange-200/50 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-all duration-200 hover:from-orange-600 hover:to-orange-700 hover:-translate-y-0.5 hover:shadow-lg backdrop-blur-sm"
                        title="Download sample Excel template"
                    >
                        <FileText className="w-4 h-4" />
                        Sample Excel
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

            {/* Add Table Modal */}
            <Dialog open={showAddNodeModal} onOpenChange={setShowAddNodeModal}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <Plus className="h-6 w-6 text-green-600" />
                            Add New Table
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                                Table Name <span className="text-red-500">*</span>
                            </label>
                            <Input 
                                value={newTableName} 
                                onChange={(e) => setNewTableName(e.target.value)} 
                                placeholder="e.g., products, orders, customers"
                                className="h-10"
                            />
                        </div>
                        
                        <div>
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                                Description <span className="text-red-500">*</span>
                            </label>
                            <Textarea 
                                value={newTableDescription} 
                                onChange={(e) => setNewTableDescription(e.target.value)} 
                                placeholder="Brief description of what this table stores"
                                className="min-h-[80px]"
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button 
                            variant="ghost" 
                            onClick={() => {
                                setShowAddNodeModal(false)
                                setNewTableName('')
                                setNewTableDescription('')
                            }}
                            className="min-w-[100px]"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAddNode}
                            disabled={!newTableName.trim() || !newTableDescription.trim()}
                            className="min-w-[100px] bg-green-600 hover:bg-green-700"
                        >
                            Create Table
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* blocks all interaction during any work */}
            <FullscreenLoader visible={isBusy} label={busyLabel} />
        </div>
    )
}
