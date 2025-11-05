'use client'

import { useRef, useState, DragEvent, useEffect } from 'react'
import { Plus, MessageCircle, MapPin, Trash2, ChevronDown, ChevronRight, Send, UploadCloud, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { useChat } from '../_hooks/useChat'
import { SqlPopover } from './sql-popover'
import { TokenUsagePopover } from './token-usage-popover'
import { RagNodePopover } from './rag-node-popover'
import { DataPopover } from './data-popover'
import { RagMinioPopover } from './rag-minio-popover'
import { toast } from 'sonner'

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
  const [isDragging, setIsDragging] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Initialize Speech Recognition if available
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i]
        if (result.isFinal) finalTranscript += result[0].transcript
      }
      if (finalTranscript) {
        setInputValue((prev) => (prev ? prev + ' ' : '') + finalTranscript.trim())
      }
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognitionRef.current = recognition
    return () => {
      try { recognition.stop() } catch {}
    }
  }, [setInputValue])

  const toggleMic = () => {
    const recognition = recognitionRef.current
    if (!recognition) {
      toast.error('Voice input is not supported in this browser')
      return
    }
    try {
      if (isListening) {
        recognition.stop()
        setIsListening(false)
      } else {
        recognition.start()
        setIsListening(true)
      }
    } catch {
      setIsListening(false)
    }
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!isDragging) setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (isMapLoading) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const isZip = file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip')
    if (!isZip) return
    const syntheticEvent = { target: { files: [file], value: '' } } as any
    await handleFileSelect(syntheticEvent)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-white to-slate-50/60">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Chat Map
        </h2>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              disabled={isSearching}
              className="text-red-600 hover:text-red-700 border-red-200/70 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Start a conversation about your data now!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-gray-900 border border-slate-200'}
                  `}
              >
                <p className="text-sm">{message.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className={`text-[11px] ${message.role === 'user' ? 'text-blue-100' : 'text-slate-500'}`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                  {message.role === 'assistant' && (
                    <div className="flex items-center">
                      <SqlPopover id={message.id} />
                      <RagNodePopover id={message.id} />
                      <RagMinioPopover id={message.id} />
                      <DataPopover id={message.id} />
                      <TokenUsagePopover id={message.id} />
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
          <div className="flex items-center justify-between pt-2 pb-2 pe-3 ps-1">
            <Button
              variant="ghost"
              onClick={() => setIsLocationExpanded(!isLocationExpanded)}
              className="flex items-center gap-2 p-0 h-auto text-green-700 hover:text-green-800 hover:bg-transparent"
            >
              <span className="text-sm font-medium">District of Project Location</span>
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

      {/* Chat Input + Dropzone */}
      <div className="px-4 py-4 border-t border-gray-200 bg-white">
        <div
          className={`transition-colors ${isDragging ? 'ring-2 ring-blue-400 bg-blue-50/60' : 'ring-1 ring-slate-200 hover:ring-slate-300'} rounded-full px-3 py-2.5 shadow-sm flex items-center gap-3`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {/* Left: Upload ZIP */}
          <div className="flex items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isMapLoading}
              title="Upload shapefile (.zip) and find matching locations"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Middle: Input area */}
          <div className="flex-1 min-w-0">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isDragging ? 'Drop ZIP file here…' : 'Ask anything'}
              disabled={isMapLoading || isSearching}
              rows={1}
              className="w-full border focus-visible:ring-0 px-2 py-2 min-h-[24px] max-h-40 resize-none bg-transparent placeholder:text-slate-400"
            />
          </div>

          {/* Right: Mic and Send */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              title={isListening ? 'Stop voice input' : 'Start voice input'}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-slate-100 ${isListening ? 'bg-red-50 ring-1 ring-red-300' : ''}`}
              disabled={isSearching}
              onClick={toggleMic}
            >
              <Mic className={`w-4.5 h-4.5 ${isListening ? 'text-red-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isMapLoading || isSearching}
              className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
              title="Send"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
        <div className="px-2 pt-2 text-xs text-slate-500 flex items-center gap-2">
          <UploadCloud className="w-3.5 h-3.5" /> Drag and drop a .zip shapefile to detect locations.
        </div>
      </div>
    </div>
  )
}