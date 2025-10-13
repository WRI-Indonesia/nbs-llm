'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import EmailVerification from '@/components/EmailVerification'

export default function VerifyEmailPage() {
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          // If email is already verified, redirect to schemas
          if (data.user.emailVerified) {
            router.push('/schemas')
            return
          }
          setUser(data.user)
        } else {
          // Not authenticated, redirect to home
          router.push('/')
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
      router.push('/')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <EmailVerification userEmail={user.email} userName={user.name} />
}
