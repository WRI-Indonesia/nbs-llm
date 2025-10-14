'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Users, 
  UserPlus, 
  Mail, 
  Crown, 
  Shield, 
  User, 
  Eye,
  MoreHorizontal,
  Trash2,
  Edit,
  Plus,
  X,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import Header from '@/components/Header'

interface OrganizationMember {
  id: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  joinedAt: string
  user: {
    id: string
    name: string
    email: string
    image: string
  }
}

interface OrganizationInvitation {
  id: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  createdAt: string
  expiresAt: string
  inviter: {
    name: string
    email: string
  }
}

interface OrganizationData {
  members: OrganizationMember[]
  invitations: OrganizationInvitation[]
}

const roleLabels = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer'
}

const roleColors = {
  OWNER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-blue-100 text-blue-800',
  MEMBER: 'bg-green-100 text-green-800',
  VIEWER: 'bg-gray-100 text-gray-800'
}

export default function OrganizationManagementPage() {
  const { data: session } = useSession()
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingOrganizations, setLoadingOrganizations] = useState(true)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDescription, setNewOrgDescription] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  // Get organization ID from URL or user's organization
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [userOrganizations, setUserOrganizations] = useState<any[]>([])
  const [selectedOrg, setSelectedOrg] = useState<any>(null)

  useEffect(() => {
    if (session?.user) {
      fetchUserOrganizations()
    } else if (session === null) {
      // Session is loaded but user is not authenticated
      setLoading(false)
    }
  }, [session])

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
        // Auto-select first organization if user has one
        if (data.organizations && data.organizations.length > 0) {
          setSelectedOrg(data.organizations[0])
          setOrganizationId(data.organizations[0].id)
        } else {
          // No organizations found, set loading to false
          setLoading(false)
        }
      } else {
        const errorData = await response.json()
        console.error('Failed to fetch organizations:', errorData)
        toast.error(errorData.error || 'Failed to fetch organizations')
        // Set loading to false even on error
        setLoading(false)
      }
    } catch (error) {
      console.error('Error fetching user organizations:', error)
      toast.error('Failed to fetch organizations')
      // Set loading to false even on error
      setLoading(false)
    } finally {
      setLoadingOrganizations(false)
    }
  }

  useEffect(() => {
    if (organizationId && session?.user) {
      fetchOrganizationData()
    }
  }, [organizationId, session])

  const fetchOrganizationData = async () => {
    if (!organizationId) return

    try {
      setLoading(true) // Set loading when fetching organization data
      const response = await fetch(`/api/organizations/members?organizationId=${organizationId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setOrganizationData(data)
      } else {
        toast.error('Failed to fetch organization data')
      }
    } catch (error) {
      console.error('Error fetching organization data:', error)
      toast.error('Failed to fetch organization data')
    } finally {
      setLoading(false)
    }
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !organizationId) return

    setInviteLoading(true)
    try {
      const response = await fetch('/api/organizations/members', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId,
          email: inviteEmail,
          role: inviteRole
        })
      })

      if (response.ok) {
        toast.success('Invitation sent successfully!')
        setInviteEmail('')
        setInviteRole('MEMBER')
        setShowInviteDialog(false)
        fetchOrganizationData() // Refresh data
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast.error('Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    if (!organizationId) return

    try {
      const response = await fetch('/api/organizations/members', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId,
          userId,
          role: newRole,
          action: 'update'
        })
      })

      if (response.ok) {
        toast.success('Member role updated successfully!')
        fetchOrganizationData() // Refresh data
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update member role')
      }
    } catch (error) {
      console.error('Error updating member role:', error)
      toast.error('Failed to update member role')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!organizationId) return

    try {
      const response = await fetch('/api/organizations/members', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId,
          userId,
          action: 'remove'
        })
      })

      if (response.ok) {
        toast.success('Member removed successfully!')
        fetchOrganizationData() // Refresh data
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to remove member')
      }
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error('Failed to remove member')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/organizations/invitations/manage?invitationId=${invitationId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        toast.success('Invitation cancelled successfully!')
        fetchOrganizationData() // Refresh data
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to cancel invitation')
      }
    } catch (error) {
      console.error('Error cancelling invitation:', error)
      toast.error('Failed to cancel invitation')
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch('/api/organizations/invitations/manage', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invitationId
        })
      })

      if (response.ok) {
        toast.success('Invitation resent successfully!')
        fetchOrganizationData() // Refresh data
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to resend invitation')
      }
    } catch (error) {
      console.error('Error resending invitation:', error)
      toast.error('Failed to resend invitation')
    }
  }

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast.error('Organization name is required')
      return
    }

    setCreatingOrg(true)
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newOrgName.trim(),
          description: newOrgDescription.trim() || null
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Organization created successfully!')
        setNewOrgName('')
        setNewOrgDescription('')
        setShowCreateOrgDialog(false)
        fetchUserOrganizations() // Refresh organizations list
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create organization')
      }
    } catch (error) {
      console.error('Error creating organization:', error)
      toast.error('Failed to create organization')
    } finally {
      setCreatingOrg(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-4 w-4" />
      case 'ADMIN':
        return <Shield className="h-4 w-4" />
      case 'MEMBER':
        return <User className="h-4 w-4" />
      case 'VIEWER':
        return <Eye className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  // Show loading skeleton when we're still fetching initial data or organization data
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="grid gap-6">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
              <p className="text-gray-600 mb-4">Please sign in to manage your organization.</p>
              <p className="text-sm text-gray-500">Session status: {session ? 'Loading...' : 'Not logged in'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Organization Management</h1>
          <p className="text-gray-600">Manage members, roles, and invitations for your organization</p>
          
          {/* Organization Selection */}
          {loadingOrganizations ? (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-10 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          ) : userOrganizations.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Select Organization</label>
              <Select 
                value={selectedOrg?.id || ''} 
                onValueChange={(orgId) => {
                  const org = userOrganizations.find(o => o.id === orgId)
                  setSelectedOrg(org)
                  setOrganizationId(orgId)
                }}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Choose an organization" />
                </SelectTrigger>
                <SelectContent>
                  {userOrganizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center">
                          <Users className="h-3 w-3 text-purple-600" />
                        </div>
                        <span>{org.name}</span>
                        {org.role === 'OWNER' && (
                          <Badge className="bg-purple-100 text-purple-800 text-xs">
                            Owner
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {!loadingOrganizations && userOrganizations.length === 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 mb-4">
                <strong>No organizations found.</strong> You need to be a member of an organization to manage members.
              </p>
              <Dialog open={showCreateOrgDialog} onOpenChange={setShowCreateOrgDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Organization
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Organization Name
                      </label>
                      <Input
                        type="text"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="My Organization"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Description (Optional)
                      </label>
                      <Input
                        type="text"
                        value={newOrgDescription}
                        onChange={(e) => setNewOrgDescription(e.target.value)}
                        placeholder="Brief description of your organization"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateOrganization}
                        disabled={creatingOrg || !newOrgName.trim()}
                      >
                        {creatingOrg ? 'Creating...' : 'Create Organization'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateOrgDialog(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Invite Member Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Role
                </label>
                <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleInviteMember}
                  disabled={inviteLoading || !inviteEmail.trim()}
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </Button>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-6">
          {/* Members Section - only show when organization is selected */}
          {organizationId && (
            <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Members ({organizationData?.members.length || 0})
                </CardTitle>
                {organizationId && (
                  <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {organizationData?.members.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No members yet. Invite someone to get started!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {organizationData?.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          {member.user.image ? (
                            <Image 
                              src={member.user.image} 
                              alt={member.user.name || member.user.email}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <User className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">
                            {member.user.name || member.user.email}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.user.email}
                          </div>
                          <div className="text-xs text-gray-400">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${roleColors[member.role]} flex items-center gap-1`}>
                          {getRoleIcon(member.role)}
                          {roleLabels[member.role]}
                        </Badge>
                        {member.role !== 'OWNER' && (
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleUpdateMemberRole(member.userId, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="MEMBER">Member</SelectItem>
                              <SelectItem value="VIEWER">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {member.role !== 'OWNER' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveMember(member.userId)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Pending Invitations */}
          {organizationData?.invitations && organizationData.invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Pending Invitations ({organizationData.invitations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {organizationData.invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <Mail className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium">{invitation.email}</div>
                          <div className="text-sm text-gray-500">
                            Invited by {invitation.inviter.name || invitation.inviter.email}
                          </div>
                          <div className="text-xs text-gray-400">
                            Sent {new Date(invitation.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${roleColors[invitation.role]} flex items-center gap-1`}>
                          {getRoleIcon(invitation.role)}
                          {roleLabels[invitation.role]}
                        </Badge>
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          Pending
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvitation(invitation.id)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Resend invitation"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Cancel invitation"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
