'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock,
  Crown,
  Shield,
  User,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'
import Header from '@/components/Header'

interface InvitationData {
  id: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  createdAt: string
  expiresAt: string
  organization: {
    id: string
    name: string
    slug: string
  }
  inviter: {
    name: string
    email: string
  }
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

export default function InvitationPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token = params.token as string

  useEffect(() => {
    if (token) {
      fetchInvitationDetails()
    }
  }, [token])

  const fetchInvitationDetails = async () => {
    try {
      const response = await fetch(`/api/organizations/invitations/${token}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const invitationData = await response.json()
        setInvitation(invitationData)
      } else {
        const errorData = await response.json()
        
        // If invitation is invalid (404), redirect to error page immediately
        if (response.status === 404) {
          router.push('/organizations/invite/invalid')
          return
        }
        
        // For other errors, show error message and redirect after delay
        setError(errorData.error || 'Failed to load invitation details')
        setTimeout(() => {
          router.push('/organizations/invite/invalid')
        }, 3000)
      }
    } catch (error) {
      console.error('Error fetching invitation:', error)
      setError('Failed to load invitation details')
      // Redirect to error page on network errors
      setTimeout(() => {
        router.push('/organizations/invite/invalid')
      }, 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvitation = async () => {
    if (!session?.user) {
      toast.error('Please sign in to accept the invitation')
      return
    }

    setProcessing(true)
    try {
      const response = await fetch('/api/organizations/invitations', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || 'Successfully joined the organization!')
        // Redirect to organization management page
        router.push('/organizations/manage')
      } else {
        const error = await response.json()
        
        // Handle specific error cases
        if (response.status === 404) {
          // Invalid token - redirect to error page immediately
          toast.error('Invalid invitation token')
          router.push('/organizations/invite/invalid')
        } else if (response.status === 400) {
          // Expired or already processed
          toast.error(error.error || 'This invitation is no longer valid')
          // Redirect to error page after showing toast
          setTimeout(() => {
            router.push('/organizations/invite/invalid')
          }, 2000)
        } else if (response.status === 403) {
          // Email mismatch
          toast.error(error.error || 'This invitation is not for your email address')
          // Redirect to error page for security
          setTimeout(() => {
            router.push('/organizations/invite/invalid')
          }, 3000)
        } else if (response.status === 401) {
          // Not authenticated
          toast.error('Please sign in to accept the invitation')
          router.push('/login')
        } else {
          // Other errors
          toast.error(error.error || 'Failed to accept invitation')
          // Redirect to error page for unknown errors
          setTimeout(() => {
            router.push('/organizations/invite/invalid')
          }, 3000)
        }
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      toast.error('Failed to accept invitation. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleDeclineInvitation = async () => {
    setProcessing(true)
    try {
      const response = await fetch(`/api/organizations/invitations?token=${token}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        toast.success('Invitation declined')
        router.push('/')
      } else {
        const error = await response.json()
        
        // Handle specific error cases for decline
        if (response.status === 404) {
          // Invalid token - redirect to error page
          toast.error('Invalid invitation token')
          router.push('/organizations/invite/invalid')
        } else if (response.status === 400) {
          // Invalid request
          toast.error(error.error || 'Invalid request')
          router.push('/organizations/invite/invalid')
        } else if (response.status === 403) {
          // Email mismatch
          toast.error(error.error || 'This invitation is not for your email address')
          router.push('/organizations/invite/invalid')
        } else if (response.status === 401) {
          // Not authenticated
          toast.error('Please sign in to decline the invitation')
          router.push('/login')
        } else {
          // Other errors
          toast.error(error.error || 'Failed to decline invitation')
          // Redirect to error page for unknown errors
          setTimeout(() => {
            router.push('/organizations/invite/invalid')
          }, 3000)
        }
      }
    } catch (error) {
      console.error('Error declining invitation:', error)
      toast.error('Failed to decline invitation')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="text-center py-12">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invalid Invitation</h3>
              <p className="text-gray-600 mb-4">
                {error || 'This invitation link is invalid or has expired.'}
              </p>
              <Button onClick={() => router.push('/')}>
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const isExpired = new Date(invitation.expiresAt) < new Date()
  const isAccepted = invitation.status === 'ACCEPTED'
  const isDeclined = invitation.status === 'DECLINED'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Organization Invitation</CardTitle>
            <p className="text-gray-600">
              You've been invited to join an organization
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Organization Info */}
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">{invitation.organization.name}</h3>
              <p className="text-gray-600 mb-4">
                Invited by <strong>{invitation.inviter.name || invitation.inviter.email}</strong>
              </p>
            </div>

            {/* Role Badge */}
            <div className="flex justify-center">
              <Badge className={`${roleColors[invitation.role]} flex items-center gap-2 px-4 py-2`}>
                {getRoleIcon(invitation.role)}
                {roleLabels[invitation.role]}
              </Badge>
            </div>

            {/* Status Messages */}
            {isExpired && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <Clock className="h-5 w-5 text-red-500 mx-auto mb-2" />
                <p className="text-red-700 font-medium">This invitation has expired</p>
                <p className="text-red-600 text-sm">
                  Expired on {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
            )}

            {isAccepted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 font-medium">Invitation Accepted</p>
                <p className="text-green-600 text-sm">
                  You have successfully joined {invitation.organization.name}
                </p>
              </div>
            )}

            {isDeclined && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <XCircle className="h-5 w-5 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-700 font-medium">Invitation Declined</p>
                <p className="text-gray-600 text-sm">
                  You have declined this invitation
                </p>
              </div>
            )}

            {/* Benefits */}
            {invitation.status === 'PENDING' && !isExpired && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">As a member, you'll be able to:</h4>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• Collaborate on database schemas</li>
                  <li>• Share schemas with other organization members</li>
                  <li>• Access organization-specific resources</li>
                  <li>• Participate in team discussions</li>
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            {invitation.status === 'PENDING' && !isExpired && (
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={processing || status === 'loading'}
                  className="flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Accept Invitation
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeclineInvitation}
                  disabled={processing}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Decline
                </Button>
              </div>
            )}

            {/* Sign In Prompt */}
            {invitation.status === 'PENDING' && !isExpired && !session?.user && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800 font-medium mb-2">Sign in required</p>
                <p className="text-yellow-700 text-sm mb-4">
                  You need to sign in to accept this invitation
                </p>
                <Button onClick={() => router.push('/auth/signin')}>
                  Sign In
                </Button>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-sm text-gray-500 pt-4 border-t">
              <p>
                This invitation expires on {new Date(invitation.expiresAt).toLocaleDateString()}
              </p>
              <p className="mt-1">
                If you don't want to join this organization, you can simply ignore this invitation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
