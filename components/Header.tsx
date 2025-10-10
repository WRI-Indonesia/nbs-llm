'use client'

import Link from "next/link"
import { useState, useEffect } from 'react'
import { ArrowRight, Database, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import AuthButton from "@/components/AuthButton"

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        setIsLoggedIn(!!data.user)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setIsLoggedIn(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <header className="border-b border-purple-200/50 bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-sm">
            <Database className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Flow Schema Designer</h1>
        </div>
        <nav className="flex gap-2 items-center">
          <Link href="/">
            <Button variant="ghost" className="hover:bg-purple-100 hover:text-purple-700 transition-colors">Home</Button>
          </Link>
          <Link href="/docs">
            <Button variant="ghost" className="gap-2 hover:bg-blue-100 hover:text-blue-700 transition-colors">
              <BookOpen className="h-4 w-4" />
              Docs
            </Button>
          </Link>
          {/* Only show Playground button for non-authenticated users */}
          {!isLoading && !isLoggedIn && (
            <Link href="/playground">
              <Button className="gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all">
                Playground <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          )}
          {/* Only show Schemas link for authenticated users */}
          {!isLoading && isLoggedIn && (
            <Link href="/schemas">
              <Button className="gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all">
                <Database className="h-4 w-4" />
                Schemas
              </Button>
            </Link>
          )}
          <AuthButton />
        </nav>
      </div>
    </header>
  )
}
