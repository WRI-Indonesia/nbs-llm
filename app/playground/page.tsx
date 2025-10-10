'use client'

import Flow from "@/components/Flow"
import Header from "@/components/Header"
import '@xyflow/react/dist/style.css'
import { Toaster } from "@/components/ui/sonner"

export default function PlaygroundPage() {
  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[1000]">
        <Header />
      </div>
      <div className="pt-[80px] w-screen h-screen">
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

