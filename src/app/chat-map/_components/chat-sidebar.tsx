'use client'

import { useState, useRef } from 'react'
import { Plus, MessageCircle, MapPin, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useChat } from '../_hooks/useChat'
import { SqlPopover } from './sql-popover'
import { RagPopover } from './rag-popover'

export function ChatSidebar() {
  const { messages, sendMessage, clearChatHistory, isSearching, handleFileUpload, isMapLoading } = useChat()
  const [inputValue, setInputValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    const isZip = file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip')
    if (!isZip) {
      toast.error('Please select a ZIP file containing shapefiles')
      return
    }

    try {
      await handleFileUpload(file)
      toast.success(`Successfully processed ${file.name}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process the uploaded file'
      toast.error(`Error: ${errorMessage}`)
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const query = inputValue.trim()
    setInputValue('')

    try {
      await sendMessage(query, 'DEFAULT')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleClearChat = async () => {
    try {
      await clearChatHistory('DEFAULT')
    } catch (error) {
      console.error('Error clearing chat:', error)
    }
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Chat Map
        </h2>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearChat}
            disabled={isSearching}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Start a conversation about your data now!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id || `message-${index}-${message.timestamp}`}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                className={`max-w-[80%] p-3 ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
              >
                <p className="text-sm">{message.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                  {message.role === 'assistant' && (
                    <div className="flex items-center">
                      <SqlPopover sqlQuery={message.sqlQuery} />
                      <RagPopover ragDocuments={message.ragDocuments} />
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ))
        )}
      </div>

      {/* Chat Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2 items-center">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isMapLoading}
              title="Upload shapefile (.zip)"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your map data..."
            disabled={isMapLoading || isSearching}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isMapLoading || isSearching}
          >
            {isSearching ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}
