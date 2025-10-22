'use client'

import { ChatSidebar } from './_components/chat-sidebar'
import { MapComponent } from './_components/map-component'
import { ChatProvider } from './_contexts/ChatContext'
import { useChat } from './_hooks/useChat'

function ChatMapContent() {
  const { map } = useChat()

  return (
    <div className="flex h-screen pt-14">
      {/* Chat Sidebar */}
      <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col">
        <ChatSidebar />
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapComponent map={map} />
      </div>
    </div>
  )
}

export default function ChatMapPage() {
  return (
    <ChatProvider>
      <ChatMapContent />
    </ChatProvider>
  )
}
