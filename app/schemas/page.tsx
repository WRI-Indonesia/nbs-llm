'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Database, Calendar, Trash2, Play, FileText, Sparkles, Globe, Users, Lock } from "lucide-react"
import { toast } from 'sonner'
import Link from 'next/link'
import Header from "@/components/Header"
import { dummySchema } from '@/lib/dummy-schema'

// Sample data for new schemas
const SAMPLE_SCHEMA_DATA = dummySchema

interface Schema {
  id: string
  name: string
  description: string | null
  version: number
  currentVersion: number
  isActive: boolean
  visibility: 'PUBLIC' | 'INTERNAL' | 'PRIVATE'
  createdAt: string
  updatedAt: string
  _count: {
    versions: number
  }
  user: {
    id: string
    name: string | null
    email: string
  }
  organization: {
    id: string
    name: string
    slug: string
    ownerId: string
  } | null
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null
}

interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  createdAt: string
  role: string
}

export default function SchemaSelectionPage() {
  const [schemas, setSchemas] = useState<Schema[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newSchemaName, setNewSchemaName] = useState('')
  const [newSchemaDescription, setNewSchemaDescription] = useState('')
  const [schemaTemplate, setSchemaTemplate] = useState<'blank' | 'sample'>('blank')
  const [schemaVisibility, setSchemaVisibility] = useState<'PUBLIC' | 'INTERNAL' | 'PRIVATE'>('PRIVATE')
  const [creating, setCreating] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('')
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)

  useEffect(() => {
    fetchSchemas()
    fetchUserOrganizations()
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

  const fetchUserOrganizations = async () => {
    try {
      setLoadingOrganizations(true)
      const response = await fetch('/api/user/organization', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setUserOrganizations(data.organizations || [])
      } else {
        console.error('Failed to fetch organizations')
      }
    } catch (error) {
      console.error('Error fetching user organizations:', error)
    } finally {
      setLoadingOrganizations(false)
    }
  }

  const canDeleteSchema = (schema: Schema) => {
    // User can delete their own schemas
    if (!schema.organization) {
      return true
    }
    
    // For organization schemas, only OWNER and ADMIN can delete
    return schema.userRole === 'OWNER' || schema.userRole === 'ADMIN'
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

    // Validate organization selection for INTERNAL visibility
    if (schemaVisibility === 'INTERNAL' && !selectedOrganizationId) {
      toast.error('Please select an organization for internal schemas')
      return
    }

    setCreating(true)
    try {
      const graphJson = schemaTemplate === 'sample' ? SAMPLE_SCHEMA_DATA : { nodes: [], edges: [] }
      
      const requestBody: any = {
        name: newSchemaName.trim(),
        description: newSchemaDescription.trim() || null,
        graphJson: graphJson,
        visibility: schemaVisibility
      }

      // Include organizationId for INTERNAL schemas
      if (schemaVisibility === 'INTERNAL' && selectedOrganizationId) {
        requestBody.organizationId = selectedOrganizationId
      }
      
      const response = await fetch('/api/schemas/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
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
        let error
        try {
          error = await response.json()
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          error = { error: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('Schema creation error:', error)
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
      setSchemaVisibility('PRIVATE')
      setSelectedOrganizationId('')
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
          <DialogContent className="sm:max-w-lg">
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
                <label className="text-sm font-medium block mb-1.5">Visibility</label>
                <Select value={schemaVisibility} onValueChange={(value: any) => setSchemaVisibility(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIVATE">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Private - Only you can see this schema
                      </div>
                    </SelectItem>
                    <SelectItem value="INTERNAL">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Internal - Only organization members can see this schema
                      </div>
                    </SelectItem>
                    <SelectItem value="PUBLIC">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Public - Anyone can see this schema
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {schemaVisibility === 'PRIVATE' && 'Only you can access this schema'}
                  {schemaVisibility === 'INTERNAL' && 'Members of your organization can access this schema'}
                  {schemaVisibility === 'PUBLIC' && 'Anyone can view this schema'}
                </p>
              </div>

              {/* Organization Selection - Only show for INTERNAL visibility */}
              <div className={schemaVisibility === 'INTERNAL' ? 'block' : 'hidden'}>
                <label className="text-sm font-medium block mb-1.5">Organization</label>
                <Select 
                  value={selectedOrganizationId} 
                  onValueChange={(value) => setSelectedOrganizationId(value)}
                  disabled={loadingOrganizations}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingOrganizations ? "Loading organizations..." : "Select an organization"} />
                  </SelectTrigger>
                  <SelectContent>
                    {userOrganizations.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500 text-center">
                        No organizations available. Create an organization first.
                      </div>
                    ) : (
                      userOrganizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{org.name}</span>
                            <span className="text-xs text-gray-500">({org.role})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Select which organization can access this schema
                </p>
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
                      <span className="text-xs text-gray-500">Administrative, People, Nature</span>
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

        {/* Schema Grouping */}
        {schemas.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Your Schemas</h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {schemas.filter(s => !s.organization).length} Personal
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  {schemas.filter(s => s.organization).length} Organization
                </span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  {schemas.filter(s => s.visibility === 'PUBLIC').length} Public
                </span>
              </div>
            </div>
          </div>
        )}

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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {schema.name}
                        </h3>
                        {/* Visibility Badge */}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          schema.visibility === 'PUBLIC' 
                            ? 'bg-green-100 text-green-800' 
                            : schema.visibility === 'INTERNAL'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {schema.visibility === 'PUBLIC' && <Globe className="w-3 h-3 inline mr-1" />}
                          {schema.visibility === 'INTERNAL' && <Users className="w-3 h-3 inline mr-1" />}
                          {schema.visibility === 'PRIVATE' && <Lock className="w-3 h-3 inline mr-1" />}
                          {schema.visibility}
                        </span>
                      </div>
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
                      {/* Owner/Organization Info */}
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        {schema.organization ? (
                          <>
                            <Users className="w-3 h-3" />
                            <span>{schema.organization.name}</span>
                            {schema.userRole && (
                              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                                schema.userRole === 'OWNER' 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : schema.userRole === 'ADMIN'
                                  ? 'bg-blue-100 text-blue-700'
                                  : schema.userRole === 'MEMBER'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {schema.userRole}
                              </span>
                            )}
                            <span>•</span>
                            <span>by {schema.user?.name || schema.user?.email || 'Unknown'}</span>
                          </>
                        ) : (
                          <>
                            <span>Personal schema</span>
                            <span>•</span>
                            <span>by {schema.user?.name || schema.user?.email || 'Unknown'}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {canDeleteSchema(schema) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSchema(schema.id, schema.name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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
