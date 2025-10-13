'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { User, LogOut, Settings, ChevronDown, Mail, CheckCircle } from "lucide-react"
import { useRouter } from 'next/navigation'

interface UserData {
  id: string
  name?: string
  email?: string
  image?: string
  emailVerified?: string
}

export default function UserDropdown() {
  const [user, setUser] = useState<UserData | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setUser(data.user)
        }
      }
    } catch (error) {
      console.error('Session check failed:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout failed:', error)
    }
    
    localStorage.removeItem('etl-ai-sessionId')
    setIsOpen(false)
    window.location.reload()
  }

  const handleViewProfile = () => {
    setIsOpen(false)
    router.push('/profile')
  }

  if (!user) return null

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 hover:text-purple-700 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
          {user.image ? (
            <Image 
              src={user.image} 
              alt={user.name || user.email || 'User'} 
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <User className="h-4 w-4 text-white" />
          )}
        </div>
        <span className="text-sm font-medium text-gray-700 hidden sm:block">
          {user.name || user.email}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  {user.image ? (
                    <Image 
                      src={user.image} 
                      alt={user.name || user.email || 'User'} 
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {user.emailVerified ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-xs text-green-600">Verified</span>
                      </>
                    ) : (
                      <>
                        <Mail className="h-3 w-3 text-yellow-500" />
                        <span className="text-xs text-yellow-600">Unverified</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                onClick={handleViewProfile}
              >
                <Settings className="h-4 w-4" />
                View Profile
              </Button>
              
              {!user.emailVerified && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => {
                    setIsOpen(false)
                    router.push('/auth/verify-email')
                  }}
                >
                  <Mail className="h-4 w-4" />
                  Verify Email
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
