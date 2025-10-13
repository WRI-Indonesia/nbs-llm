'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  User, 
  Settings, 
  Building2, 
  Edit3, 
  Save, 
  X, 
  Mail, 
  Calendar,
  Shield,
  Users,
  Plus
} from "lucide-react"

interface UserData {
  id: string
  name?: string
  email?: string
  image?: string
  createdAt?: string
  organization?: {
    id: string
    name: string
    description?: string
  }
}

interface Organization {
  id: string
  name: string
  description?: string
  slug: string
  logo?: string
  createdAt: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeTab, setActiveTab] = useState<'profile' | 'organization'>('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const router = useRouter()

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organizationId: ''
  })

  const [orgFormData, setOrgFormData] = useState({
    name: '',
    description: ''
  })

  useEffect(() => {
    fetchUserData()
    fetchOrganizations()
  }, [])

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setUser(data.user)
          setFormData({
            name: data.user.name || '',
            email: data.user.email || '',
            organizationId: data.user.organizationId || ''
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations')
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations || [])
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    }
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUser(updatedUser.user)
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateOrganization = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgFormData)
      })

      if (response.ok) {
        await fetchOrganizations()
        setShowCreateOrg(false)
        setOrgFormData({ name: '', description: '' })
      }
    } catch (error) {
      console.error('Failed to create organization:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleJoinOrganization = async (orgId: string) => {
    try {
      const response = await fetch('/api/user/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId })
      })

      if (response.ok) {
        await fetchUserData()
      }
    } catch (error) {
      console.error('Failed to join organization:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    {user.image ? (
                      <Image 
                        src={user.image} 
                        alt={user.name || user.email || 'User'} 
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{user.name || 'User'}</h2>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={activeTab === 'profile' ? 'default' : 'ghost'}
                  className="w-full justify-start gap-2"
                  onClick={() => setActiveTab('profile')}
                >
                  <User className="h-4 w-4" />
                  Profile
                </Button>
                <Button
                  variant={activeTab === 'organization' ? 'default' : 'ghost'}
                  className="w-full justify-start gap-2"
                  onClick={() => setActiveTab('organization')}
                >
                  <Building2 className="h-4 w-4" />
                  Organization
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'profile' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Profile Information
                      </CardTitle>
                      <CardDescription>
                        Manage your personal information and account settings
                      </CardDescription>
                    </div>
                    {!isEditing ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit Profile
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={handleSaveProfile}
                          disabled={isSaving}
                        >
                          <Save className="h-4 w-4" />
                          {isSaving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Full Name
                      </label>
                      {isEditing ? (
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Enter your full name"
                        />
                      ) : (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{user.name || 'Not provided'}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Email Address
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{user.email}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Member Since
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Current Organization
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>{user.organization?.name || 'No organization'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'organization' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          Organization Management
                        </CardTitle>
                        <CardDescription>
                          Create or join organizations to collaborate on schemas
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => setShowCreateOrg(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Create Organization
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {user.organization ? (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-5 w-5 text-green-600" />
                          <h3 className="font-medium text-green-800">Current Organization</h3>
                        </div>
                        <p className="text-green-700 font-medium">{user.organization.name}</p>
                        {user.organization.description && (
                          <p className="text-green-600 text-sm mt-1">{user.organization.description}</p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-5 w-5 text-yellow-600" />
                          <h3 className="font-medium text-yellow-800">No Organization</h3>
                        </div>
                        <p className="text-yellow-700">You're not currently part of any organization.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Available Organizations
                    </CardTitle>
                    <CardDescription>
                      Join an existing organization or create a new one
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {organizations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No organizations available</p>
                        <p className="text-sm">Create the first organization to get started</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {organizations.map((org) => (
                          <div key={org.id} className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-medium text-gray-900">{org.name}</h3>
                              {user.organization?.id === org.id && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                  Current
                                </span>
                              )}
                            </div>
                            {org.description && (
                              <p className="text-sm text-gray-600 mb-3">{org.description}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                Created {new Date(org.createdAt).toLocaleDateString()}
                              </span>
                              {user.organization?.id !== org.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleJoinOrganization(org.id)}
                                >
                                  Join
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Organization Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Create New Organization</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Organization Name
                </label>
                <Input
                  value={orgFormData.name}
                  onChange={(e) => setOrgFormData({ ...orgFormData, name: e.target.value })}
                  placeholder="Enter organization name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Description (Optional)
                </label>
                <Textarea
                  value={orgFormData.description}
                  onChange={(e) => setOrgFormData({ ...orgFormData, description: e.target.value })}
                  placeholder="Enter organization description"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowCreateOrg(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrganization}
                disabled={isSaving || !orgFormData.name.trim()}
                className="flex-1"
              >
                {isSaving ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
