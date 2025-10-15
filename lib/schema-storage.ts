/**
 * Schema Storage Service
 * Handles saving and loading schemas from either localStorage or Prisma API
 */

import type { Node, Edge } from '@xyflow/react'
import type { TableNodeData } from '@/types'

export type StorageMode = 'local' | 'database'

export interface SchemaData {
  nodes: Node<TableNodeData>[]
  edges: Edge[]
}

export interface SavedSchema {
  id?: string
  name: string
  description?: string
  graphJson: SchemaData
  version?: number
  createdAt?: string
  updatedAt?: string
}

/**
 * Check if database is configured
 */
export function isDatabaseConfigured(): boolean {
  // In client-side, we can't directly check env vars
  // We'll detect by trying to fetch from API
  return typeof window !== 'undefined'
}

/**
 * Get storage mode preference
 */
export function getStorageMode(): StorageMode {
  if (typeof window === 'undefined') return 'local'
  
  const saved = localStorage.getItem('storage-mode')
  return (saved as StorageMode) || 'local'
}

/**
 * Set storage mode preference
 */
export function setStorageMode(mode: StorageMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('storage-mode', mode)
}

/**
 * Save schema to localStorage with sessionId
 */
export function saveToLocal(schemaData: SchemaData, sessionId: string, versionId?: string): void {
  if (typeof window === 'undefined') return
  
  const dataToSave = {
    nodes: schemaData.nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        // Remove callbacks before saving
        onEditColumns: undefined,
        onEditTableMeta: undefined,
        onAfterImport: undefined,
        onRefresh: undefined,
      }
    })),
    edges: schemaData.edges,
    versionId: versionId || `v_${Date.now()}`,
    savedAt: new Date().toISOString()
  }
  
  localStorage.setItem(`flow-graph-${sessionId}`, JSON.stringify(dataToSave))
  localStorage.setItem(`flow-graph-${sessionId}-updated`, new Date().toISOString())
}

/**
 * Load schema from localStorage with sessionId
 */
export function loadFromLocal(sessionId: string): SchemaData | null {
  if (typeof window === 'undefined') return null
  
  const saved = localStorage.getItem(`flow-graph-${sessionId}`)
  if (!saved) return null
  
  try {
    const data = JSON.parse(saved)
    return {
      nodes: data.nodes,
      edges: data.edges
    }
  } catch (error) {
    console.error('Error parsing saved schema:', error)
    return null
  }
}

/**
 * Get version history from localStorage
 */
export function getLocalVersionHistory(sessionId: string): Array<{versionId: string, savedAt: string}> {
  if (typeof window === 'undefined') return []
  
  const saved = localStorage.getItem(`flow-graph-${sessionId}`)
  if (!saved) return []
  
  try {
    const data = JSON.parse(saved)
    return [{
      versionId: data.versionId || `v_${Date.now()}`,
      savedAt: data.savedAt || new Date().toISOString()
    }]
  } catch (error) {
    console.error('Error parsing version history:', error)
    return []
  }
}

/**
 * Save schema to database via API with sessionId
 */
export async function saveToDatabase(
  schemaData: SchemaData,
  sessionId: string,
  versionId?: string,
  schemaId?: string
): Promise<SavedSchema> {
  const url = schemaId ? `/api/schemas/${schemaId}` : '/api/schemas'
  const method = schemaId ? 'PUT' : 'POST'
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `playground-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: 'Flow schema design',
      graphJson: schemaData,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to save schema')
  }
  
  const data = await response.json()
  return data.schema
}

/**
 * Load schema from database via API with sessionId
 */
export async function loadFromDatabase(sessionId: string, schemaId?: string): Promise<SavedSchema> {
  const url = schemaId ? `/api/schemas/${schemaId}` : `/api/schemas/session/${sessionId}`
  const response = await fetch(url)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to load schema')
  }
  
  const data = await response.json()
  return data.schema
}

/**
 * List all schemas from database for a session
 */
export async function listSchemasFromDatabase(sessionId: string): Promise<SavedSchema[]> {
  const response = await fetch(`/api/schemas/session/${sessionId}`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to list schemas')
  }
  
  const data = await response.json()
  return data.schemas
}

/**
 * Delete schema from database
 */
export async function deleteFromDatabase(schemaId: string): Promise<void> {
  const response = await fetch(`/api/schemas/${schemaId}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete schema')
  }
}

/**
 * Universal save function - saves to configured storage with sessionId
 */
export async function saveSchema(
  schemaData: SchemaData,
  sessionId: string,
  options: {
    versionId?: string
    schemaId?: string
    mode?: StorageMode
  } = {}
): Promise<SavedSchema | null> {
  const {
    versionId,
    schemaId,
    mode = getStorageMode()
  } = options
  
  if (mode === 'database') {
    try {
      return await saveToDatabase(schemaData, sessionId, versionId, schemaId)
    } catch (error) {
      console.error('Failed to save to database, falling back to local:', error)
      saveToLocal(schemaData, sessionId, versionId)
      return null
    }
  } else {
    saveToLocal(schemaData, sessionId, versionId)
    return {
      id: schemaId,
      name: 'default',
      description: 'Flow schema design',
      graphJson: schemaData,
      version: 1,
    }
  }
}

/**
 * Universal load function - loads from configured storage with sessionId
 */
export async function loadSchema(
  sessionId: string,
  options: {
    schemaId?: string
    mode?: StorageMode
  } = {}
): Promise<SchemaData | null> {
  const {
    schemaId,
    mode = getStorageMode()
  } = options
  
  if (mode === 'database') {
    try {
      const saved = await loadFromDatabase(sessionId, schemaId)
      return saved.graphJson
    } catch (error) {
      console.error('Failed to load from database, falling back to local:', error)
      return loadFromLocal(sessionId)
    }
  } else {
    return loadFromLocal(sessionId)
  }
}

