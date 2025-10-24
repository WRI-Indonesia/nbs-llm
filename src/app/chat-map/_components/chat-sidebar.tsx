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
import { DataPopover } from './data-popover'

export function ChatSidebar() {
  const { messages, sendMessage, clearChatHistory, isSearching, handleFileUpload, isMapLoading } = useChat()
  const [inputValue, setInputValue] = useState('')
  const [currentLocation, setCurrentLocation] = useState<{district: string[], province: string[]}>({district: [], province: []})
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const searchGeoDataFromZip = async (file: File) => {
    try {
      // Create FormData to send the file to geo search API
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/geo/search', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to search geo data from ZIP')
      }

      const data = await response.json()
      if (data.success && data.data.length > 0) {
        // Extract districts and provinces from the results
        const districts = data.data.map((location: {district: string, province: string}) => location.district).filter(Boolean) as string[]
        const provinces = data.data.map((location: {district: string, province: string}) => location.province).filter(Boolean) as string[]
        
        // Remove duplicates
        const uniqueDistricts = [...new Set(districts)]
        const uniqueProvinces = [...new Set(provinces)]
        
        // Set the current location
        setCurrentLocation({
          district: uniqueDistricts,
          province: uniqueProvinces
        })
        
        toast.success(`Found ${data.count} matching locations. Location data is now active for your queries.`)
      } else {
        toast.info('No matching locations found in geo database')
        setCurrentLocation({district: [], province: []})
      }
    } catch (error) {
      console.error('Error searching geo data:', error)
      toast.error('Failed to search geo locations')
      setCurrentLocation({district: [], province: []})
    }
  }

  // Centralized file processor for both click-upload and drag-and-drop
  const processFile = async (file: File) => {
    // Reset file input (so selecting the same file again triggers onChange)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    const lower = file.name.toLowerCase()
    const isZip = file.type === 'application/zip' || lower.endsWith('.zip')
    const isGeoJSON = lower.endsWith('.geojson') || (file.type === 'application/geo+json') || (file.type === 'application/json' && lower.includes('geojson'))
    const isKML = lower.endsWith('.kml') || lower.endsWith('.kmz') || file.type === 'application/vnd.google-earth.kml+xml'

    if (!(isZip || isGeoJSON || isKML)) {
      toast.error('Unsupported file. Use .zip (shapefile), .geojson, .kml, or .kmz')
      return
    }

    try {
      // Upload/process the file server-side
      await handleFileUpload(file)

      // Only run geo search enrichment for ZIP shapefiles (backend expects a zip)
      if (isZip) {
        await searchGeoDataFromZip(file)
      } else {
        toast.info('Uploaded successfully. Location lookup runs for shapefile ZIPs only.')
      }

      toast.success(`Successfully processed ${file.name}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process the uploaded file'
      toast.error(`Error: ${errorMessage}`)
    }
  }

  // Drag and Drop handlers
  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    await processFile(file)
  }


  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const query = inputValue.trim()
    setInputValue('')

    try {
      await sendMessage(query, 'DEFAULT', currentLocation)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleClearLocation = () => {
    setCurrentLocation({district: [], province: []})
    toast.success('Location cleared')
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
      <div 
        className={`flex-1 overflow-y-auto p-4 space-y-3 relative ${isDragging ? 'bg-blue-50' : ''}`}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/90 border-2 border-dashed border-blue-400 pointer-events-none">
            <div className="text-center">
              <div className="text-blue-700 text-lg font-semibold mb-2">Drop file here to upload</div>
              <div className="text-blue-600 text-sm">Supported: .zip, .geojson, .kml, .kmz</div>
            </div>
          </div>
        )}
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
      {(currentLocation.district.length > 0 || currentLocation.province.length > 0) && (
        <div className="p-4 border-t border-gray-200 bg-green-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-green-700">Active Location Data</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLocation}
              className="text-green-600 hover:text-green-700"
            >
              Clear
            </Button>
          </div>
          <div className="space-y-1">
            {currentLocation.district.map((district, index) => (
              <div key={`district-${index}`} className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                District: {district}
              </div>
            ))}
            {currentLocation.province.map((province, index) => (
              <div key={`province-${index}`} className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                Province: {province}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2 items-center">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.geojson,.json,.kml,.kmz"
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
