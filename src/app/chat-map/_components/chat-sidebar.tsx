'use client'

import { useRef, useState } from 'react'
import { Plus, MessageCircle, MapPin, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useChat } from '../_hooks/useChat'
import { SqlPopover } from './sql-popover'
import { RagPopover } from './rag-popover'
import { DataPopover } from './data-popover'

export function ChatSidebar() {
  const {
    messages,
    isSearching,
    isMapLoading,
    inputValue,
    setInputValue,
    currentLocation,
    handleFileSelect,
    handleSendMessage,
    handleClearLocation,
    handleClearChat,
    handleKeyDown
  } = useChat()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLocationExpanded, setIsLocationExpanded] = useState(false)

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
                      <DataPopover data={message.data} />
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ))
        )}
      </div>

      {/* Current Location Status */}
      {currentLocation.district.length > 0 && (
        <div className="border-t border-gray-200 bg-green-50">
          <div className="flex items-center justify-between pt-2 pb-3 pe-3 ps-1">
            <Button
              variant="ghost"
              onClick={() => setIsLocationExpanded(!isLocationExpanded)}
              className="flex items-center gap-2 p-0 h-auto text-green-700 hover:text-green-800 hover:bg-transparent"
            >
              <span className="text-sm font-medium">Distrct Project Location</span>
              {isLocationExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLocation}
              className="text-green-600 hover:text-green-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          {isLocationExpanded && (
            <div className="px-3 pb-3 space-y-1">
              {currentLocation.district.map((district, index) => (
                <div key={`district-${index}`} className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                  District: {district}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
              title="Upload shapefile (.zip) and find matching locations"
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