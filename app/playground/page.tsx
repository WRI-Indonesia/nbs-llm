'use client'

import Flow from "@/components/Flow"
import Link from "next/link"
import { Home, Database, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import AuthButton from "@/components/AuthButton"
import '@xyflow/react/dist/style.css'
import { Toaster } from "@/components/ui/sonner"

export default function PlaygroundPage() {
  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[1000] bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 backdrop-blur-sm border-b border-purple-200/50 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-sm">
              <Database className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Flow Schema Designer - Playground</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 hover:bg-purple-100 hover:text-purple-700 transition-colors">
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <Link href="/schemas">
              <Button variant="ghost" size="sm" className="gap-2 hover:bg-purple-100 hover:text-purple-700 transition-colors">
                <FolderOpen className="h-4 w-4" />
                Schemas
              </Button>
            </Link>
            <AuthButton />
          </div>
        </div>
      </div>
      <div className="pt-[60px] w-screen h-screen">
        <Flow />
      </div>
      <Toaster 
        position="bottom-right"
        expand={true}
        richColors={true}
        closeButton={true}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          },
        }}
      />
    </>
  )
}

