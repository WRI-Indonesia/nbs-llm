'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Database, Calendar, Trash2, Play, FileText, Sparkles } from "lucide-react"
import { toast } from 'sonner'
import Link from 'next/link'
import Header from "@/components/Header"

// Sample data for new schemas
const SAMPLE_SCHEMA_DATA = {
  nodes: [
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
  ],
  edges: [
    {
      id: 'table-2.user_id-->table-1.id',
      source: 'table-2',
      target: 'table-1',
      sourceHandle: 'posts__user_id__out',
      targetHandle: 'users__id__in',
      type: 'smoothstep'
    },
    {
      id: 'table-3.post_id-->table-2.id',
      source: 'table-3',
      target: 'table-2',
      sourceHandle: 'comments__post_id__out',
      targetHandle: 'posts__id__in',
      type: 'smoothstep'
    },
    {
      id: 'table-3.user_id-->table-1.id',
      source: 'table-3',
      target: 'table-1',
      sourceHandle: 'comments__user_id__out',
      targetHandle: 'users__id__in',
      type: 'smoothstep'
    }
  ]
}

interface Schema {
  id: string
  name: string
  description: string | null
  version: number
  currentVersion: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    versions: number
  }
}

export default function SchemaSelectionPage() {
  const [schemas, setSchemas] = useState<Schema[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newSchemaName, setNewSchemaName] = useState('')
  const [newSchemaDescription, setNewSchemaDescription] = useState('')
  const [schemaTemplate, setSchemaTemplate] = useState<'blank' | 'sample'>('blank')
  const [creating, setCreating] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    fetchSchemas()
  }, [])

  const validateSchemaName = (name: string) => {
    if (!name.trim()) {
      setNameError(null)
      return
    }
    
    const trimmedName = name.trim()
    const existingSchema = schemas.find(schema => 
      schema.name.toLowerCase() === trimmedName.toLowerCase()
    )
    
    if (existingSchema) {
      setNameError(`A schema named "${trimmedName}" already exists`)
    } else {
      setNameError(null)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNewSchemaName(value)
    validateSchemaName(value)
  }

  const fetchSchemas = async () => {
    try {
      const response = await fetch('/api/schemas/user')
      if (response.ok) {
        const data = await response.json()
        setSchemas(data.schemas)
      } else {
        toast.error('Failed to load schemas')
      }
    } catch (error) {
      console.error('Error fetching schemas:', error)
      toast.error('Failed to load schemas')
    } finally {
      setLoading(false)
    }
  }

  const createSchema = async () => {
    if (!newSchemaName.trim()) {
      toast.error('Schema name is required')
      return
    }

    if (nameError) {
      toast.error(nameError)
      return
    }

    setCreating(true)
    try {
      const graphJson = schemaTemplate === 'sample' ? SAMPLE_SCHEMA_DATA : { nodes: [], edges: [] }
      
      const response = await fetch('/api/schemas/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSchemaName.trim(),
          description: newSchemaDescription.trim() || null,
          graphJson: graphJson
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSchemas(prev => [data.schema, ...prev])
        setNewSchemaName('')
        setNewSchemaDescription('')
        setSchemaTemplate('blank')
        setNameError(null)
        setShowCreateDialog(false)
        toast.success(`Schema created successfully${schemaTemplate === 'sample' ? ' with sample data' : ''}`)
      } else {
        const error = await response.json()
        if (error.error && error.error.includes('already exists')) {
          setNameError(error.error)
          toast.error(`Schema name already exists: "${newSchemaName.trim()}"`)
        } else {
          toast.error(error.error || 'Failed to create schema')
        }
      }
    } catch (error) {
      console.error('Error creating schema:', error)
      toast.error('Failed to create schema')
    } finally {
      setCreating(false)
    }
  }

  const deleteSchema = async (schemaId: string, schemaName: string) => {
    if (!confirm(`Are you sure you want to delete "${schemaName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/schemas/user?id=${schemaId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSchemas(prev => prev.filter(s => s.id !== schemaId))
        toast.success('Schema deleted successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete schema')
      }
    } catch (error) {
      console.error('Error deleting schema:', error)
      toast.error('Failed to delete schema')
    }
  }

  const handleDialogClose = (open: boolean) => {
    setShowCreateDialog(open)
    if (!open) {
      // Reset form when dialog closes
      setNewSchemaName('')
      setNewSchemaDescription('')
      setSchemaTemplate('blank')
      setNameError(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your schemas...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <Header />

      <div className="container mx-auto px-6 py-8">
        {/* Create Schema Button - Only show if user has schemas */}
        {schemas.length > 0 && (
          <div className="mb-8">
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              Create New Schema
            </Button>
          </div>
        )}

        {/* Create Schema Dialog - Always available */}
        <Dialog open={showCreateDialog} onOpenChange={handleDialogClose}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-purple-600" />
                Create New Schema
              </DialogTitle>
              <DialogDescription>
                Create a new schema template to start designing your database structure
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Schema Name</label>
                <Input
                  type="text"
                  value={newSchemaName}
                  onChange={handleNameChange}
                  placeholder="e.g., E-commerce Database"
                  className={`w-full ${nameError ? 'border-red-500 focus:border-red-500' : ''}`}
                  required
                />
                {nameError && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <span className="text-red-500">⚠</span>
                    {nameError}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Description (Optional)</label>
                <Input
                  type="text"
                  value={newSchemaDescription}
                  onChange={(e) => setNewSchemaDescription(e.target.value)}
                  placeholder="Brief description of this schema"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Template</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSchemaTemplate('blank')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      schemaTemplate === 'blank'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-5 h-5" />
                      <span className="text-sm font-medium">Blank Schema</span>
                      <span className="text-xs text-gray-500">Start from scratch</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchemaTemplate('sample')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      schemaTemplate === 'sample'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      <span className="text-sm font-medium">Sample Schema</span>
                      <span className="text-xs text-gray-500">Users, Posts, Comments</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={createSchema}
                  disabled={creating || !newSchemaName.trim() || !!nameError}
                  className="flex-1"
                >
                  {creating ? 'Creating...' : 'Create Schema'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Schemas Grid */}
        {schemas.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No schemas yet</h3>
            <p className="text-gray-600 mb-6">Create your first schema template to get started</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Create Your First Schema
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schemas.map((schema) => (
              <div
                key={schema.id}
                className="bg-white rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-200 hover:-translate-y-1 min-h-[200px] flex flex-col"
              >
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {schema.name}
                      </h3>
                      <div className="min-h-[20px] mb-2">
                        {schema.description ? (
                          <p className="text-sm text-gray-600">
                            {schema.description}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">
                            No description
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSchema(schema.id, schema.name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Database className="w-4 h-4" />
                      <span>Version {schema.currentVersion}</span>
                      <span className="text-gray-400">•</span>
                      <span>{schema._count.versions} versions</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Updated {formatDate(schema.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <Link
                      href={`/playground?schemaId=${schema.id}`}
                      className="flex-1"
                    >
                      <Button className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white">
                        <Play className="w-4 h-4" />
                        Open
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
