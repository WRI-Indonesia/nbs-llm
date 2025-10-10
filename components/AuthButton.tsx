'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { User, LogIn, UserPlus, LogOut } from "lucide-react"
import { SignInModal, SignUpModal } from './AuthModals'

export default function AuthButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    // Check for existing sessionId in localStorage
    const storedSessionId = localStorage.getItem('etl-ai-sessionId')
    const storedUser = localStorage.getItem('user')
    
    if (storedSessionId && storedUser) {
      setSessionId(storedSessionId)
      setUser(JSON.parse(storedUser))
      setIsLoggedIn(true)
      
      // Verify session with server
      verifySession(storedSessionId)
    }
  }, [])

  const verifySession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/auth/session?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setUser(data.user)
          setIsLoggedIn(true)
        } else {
          // Session expired, clear localStorage
          localStorage.removeItem('etl-ai-sessionId')
          localStorage.removeItem('user')
          setIsLoggedIn(false)
          setUser(null)
          setSessionId(null)
        }
      }
    } catch (error) {
      console.error('Session verification failed:', error)
    }
  }

  const handleAuthSuccess = (newSessionId: string, userData: { name?: string; email?: string }) => {
    setSessionId(newSessionId)
    setUser(userData)
    setIsLoggedIn(true)
    setShowSignIn(false)
    setShowSignUp(false)
  }

  const handleSignOut = () => {
    localStorage.removeItem('etl-ai-sessionId')
    localStorage.removeItem('etl-ai-schemaId')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setUser(null)
    setSessionId(null)
  }

  const handleSignInClick = () => {
    setShowSignIn(true)
    setShowSignUp(false)
  }

  const handleSignUpClick = () => {
    setShowSignUp(true)
    setShowSignIn(false)
  }

  if (isLoggedIn && user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm">
          <User className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">
            {user.name || user.email}
          </span>
        </div>
        <Button variant="outline" size="sm" className="gap-2 border-purple-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 transition-colors" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2 border-purple-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 transition-colors" onClick={handleSignInClick}>
          <LogIn className="h-4 w-4" />
          Sign In
        </Button>
        <Button size="sm" className="gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all" onClick={handleSignUpClick}>
          <UserPlus className="h-4 w-4" />
          Sign Up
        </Button>
      </div>

      <SignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSuccess={handleAuthSuccess}
      />

      <SignUpModal
        isOpen={showSignUp}
        onClose={() => setShowSignUp(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  )
}
