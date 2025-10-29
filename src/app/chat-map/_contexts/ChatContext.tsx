'use client'

import { createContext, ReactNode, useState, useCallback, Dispatch, SetStateAction, useEffect, useMemo } from "react"
import { toast } from "sonner"
import useSWR from 'swr'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { fromLonLat } from 'ol/proj'
import { Style, Stroke, Fill } from 'ol/style'
import { processZipFile, addShapefileToMap, ShapefileData } from '../_utils/shapefile-utils'
import type { SearchRequest } from "@/app/api/ai/search/_utils/types"

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  projectId?: string
  sqlQuery?: string
  ragDocuments?: Array<{
    id: string
    tableName: string
    text: string
    similarity: number
    documentType: string
  }>
  data?: Array<Record<string, any>>
}

interface SearchResponse {
  success: boolean
  query: string
  sqlQuery?: string
  answer: string
  data: any[]
  chatHistory: ChatMessage[]
  relevantDocuments?: Array<{
    id: string
    tableName: string
    text: string
    similarity: number
    documentType: string
  }>
  searchStats?: {
    totalDocumentsFound: number
    minCosineThreshold: number
    topK: number
  }
}

interface ClearResponse {
  success: boolean
  message: string
  deletedCount: number
  projectId: string
}

type ChatContextProps = {
  messages: ChatMessage[]
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  isLoading: boolean
  isSearching: boolean
  sendMessage: (query: string, projectId: string, location?: { district: string[], province: string[] }) => Promise<void>
  clearChatHistory: (projectId?: string) => Promise<void>
  chatHistory: ChatMessage[]
  error: string | null

  map: Map | null
  vectorSource: VectorSource | null
  isMapLoading: boolean
  handleFileUpload: (file: File) => Promise<void>
  fitToData: () => void

  // Chat Sidebar Logic
  inputValue: string
  setInputValue: Dispatch<SetStateAction<string>>
  currentLocation: { district: string[], province: string[] }
  setCurrentLocation: Dispatch<SetStateAction<{ district: string[], province: string[] }>>
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleSendMessage: () => Promise<void>
  handleClearLocation: () => void
  handleClearChat: () => Promise<void>
  handleKeyDown: React.KeyboardEventHandler<HTMLInputElement>

  // Data Popover Logic
  getDataColumns: (data?: Array<Record<string, any>>) => string[]
  hasData: (data?: Array<Record<string, any>>) => boolean

  // RAG Popover Logic
  hasRagDocuments: (ragDocuments?: Array<{ id: string, tableName: string, text: string, similarity: number, documentType: string }>) => boolean

  // SQL Popover Logic
  copyToClipboard: (text: string) => void
}

export const ChatContext = createContext<ChatContextProps>({
  messages: [],
  setMessages: () => { },
  isLoading: false,
  isSearching: false,
  sendMessage: async () => { },
  clearChatHistory: async () => { },
  chatHistory: [],
  error: null,

  map: null,
  vectorSource: null,
  isMapLoading: false,
  handleFileUpload: async () => { },
  fitToData: () => { },

  // Chat Sidebar Logic
  inputValue: '',
  setInputValue: () => { },
  currentLocation: { district: [], province: [] },
  setCurrentLocation: () => { },
  handleFileSelect: async () => { },
  handleSendMessage: async () => { },
  handleClearLocation: () => { },
  handleClearChat: async () => { },
  handleKeyDown: () => { },

  // Data Popover Logic
  getDataColumns: () => [],
  hasData: () => false,

  // RAG Popover Logic
  hasRagDocuments: () => false,

  // SQL Popover Logic
  copyToClipboard: () => { },
})

// Fetcher function for SWR
const chatHistoryFetcher = async (url: string): Promise<{ success: boolean; chatHistory: ChatMessage[] }> => {
  const response = await fetch(url, {
    credentials: 'include',
  })
  if (!response.ok) {
    toast.error('Failed to fetch chat history')
    return { success: false, chatHistory: [] }
  }
  return response.json()
}

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [map, setMap] = useState<Map | null>(null)
  const [vectorSource, setVectorSource] = useState<VectorSource | null>(null)
  const [isMapLoading, setIsMapLoading] = useState(false)

  // Chat Sidebar State
  const [inputValue, setInputValue] = useState('')
  const [currentLocation, setCurrentLocation] = useState<{ district: string[], province: string[] }>({ district: [], province: [] })

  const { data: chatHistoryData, error: chatHistoryError, mutate: mutateChatHistory } = useSWR<{ success: boolean; chatHistory: ChatMessage[] }>(
    '/api/chat-history?projectId=DEFAULT',
    chatHistoryFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
    }
  )

  const chatHistory = useMemo(() => {
    return chatHistoryData?.chatHistory || []
  }, [chatHistoryData?.chatHistory])

  useEffect(() => {
    const vectorSrc = new VectorSource()
    const vectorLayer = new VectorLayer({
      source: vectorSrc,
      style: new Style({
        stroke: new Stroke({
          color: '#3388ff',
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(51, 136, 255, 0.1)',
        }),
      }),
    })

    const mapInstance = new Map({
      target: 'map',
      layers: [new TileLayer({ source: new OSM() }), vectorLayer],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    })

    setMap(mapInstance)
    setVectorSource(vectorSrc)

    return () => {
      mapInstance.setTarget(undefined)
    }
  }, [])

  useEffect(() => {
    if (chatHistoryData?.chatHistory) {
      setMessages(chatHistoryData.chatHistory)
    }
  }, [chatHistoryData])

  useEffect(() => {
    if (chatHistoryError) {
      console.error('Error loading chat history:', chatHistoryError)
      setError('Failed to load chat history')
      toast.error('Failed to load chat history')
    }
  }, [chatHistoryError])

  const sendMessage = useCallback(async (query: string, projectId: string, location?: { district: string[], province: string[] }) => {
    if (!query.trim()) return

    setIsSearching(true)
    setError(null)

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      projectId
    }

    setMessages(prev => [...prev, userMessage])

    try {
      const searchRequest: SearchRequest = {
        query,
        min_cosine: 0.2,
        top_k: 10,
        projectId,
        chatHistory: messages,
        location
      }

      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(searchRequest),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to send message')
        return
      }

      const data: SearchResponse = await response.json()

      if (data.success) {
        setMessages(data.chatHistory)
        await mutateChatHistory()
      } else {
        toast.error('Search request failed')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          projectId,
        },
      ])
      toast.error('Failed to send message')
    } finally {
      setIsSearching(false)
    }
  }, [messages, mutateChatHistory])

  const clearChatHistory = useCallback(async (projectId?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat-history/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId: projectId || 'DEFAULT' }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to clear chat history')
        return
      }

      const data: ClearResponse = await response.json()

      if (data.success) {
        setMessages([])
        await mutateChatHistory()
        toast.success('Successfully cleared chat history')
      } else {
        toast.error('Clear request failed')
      }
    } catch (error) {
      console.error('Error clearing chat history:', error)
      toast.error('Failed to clear chat history')
    } finally {
      setIsLoading(false)
    }
  }, [mutateChatHistory])

  const fitToData = useCallback(() => {
    if (!map || !vectorSource) return
    const features = vectorSource.getFeatures()
    if (!features.length) return
    const extent = vectorSource.getExtent()
    const isValid = extent.every(n => Number.isFinite(n))
    if (!isValid) return
    map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 16 })
  }, [map, vectorSource])

  const handleFileUpload = useCallback(async (file: File): Promise<void> => {
    if (!vectorSource) {
      toast.error('Map is not ready. Please try again.')
      return
    }

    setIsMapLoading(true)
    try {
      const shapefileData: ShapefileData[] = await processZipFile(file)

      if (!shapefileData || shapefileData.length === 0) {
        toast.error('No valid shapefiles found in the ZIP file')
        return
      }

      for (const data of shapefileData) {
        try {
          addShapefileToMap(vectorSource, data)
        } catch {
          toast.error('Failed to load one of the shapefiles')
        }
      }

      fitToData()
    } catch {
      toast.error('Failed to process shapefile')
    } finally {
      setIsMapLoading(false)
    }
  }, [vectorSource, fitToData])

  // Chat Sidebar Functions
  const searchGeoDataFromZip = useCallback(async (file: File) => {
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
        const districts = data.data.map((location: { district: string, province: string }) => location.district).filter(Boolean) as string[]
        const provinces = data.data.map((location: { district: string, province: string }) => location.province).filter(Boolean) as string[]

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
        setCurrentLocation({ district: [], province: [] })
      }
    } catch (error) {
      console.error('Error searching geo data:', error)
      toast.error('Failed to search geo locations')
      setCurrentLocation({ district: [], province: [] })
    }
  }, [])

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Reset file input
    event.target.value = ''

    const isZip = file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip')
    if (!isZip) {
      toast.error('Please select a ZIP file containing shapefiles')
      return
    }

    try {
      // First upload and process the file
      await handleFileUpload(file)

      // Then extract geo data and search for matching locations
      await searchGeoDataFromZip(file)

      toast.success(`Successfully processed ${file.name}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process the uploaded file'
      toast.error(`Error: ${errorMessage}`)
    }
  }, [handleFileUpload, searchGeoDataFromZip])

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return

    const query = inputValue.trim()
    setInputValue('')

    try {
      await sendMessage(query, 'DEFAULT', currentLocation)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }, [inputValue, sendMessage, currentLocation])

  const handleClearLocation = useCallback(() => {
    setCurrentLocation({ district: [], province: [] })
    // Clear map data
    if (vectorSource) {
      vectorSource.clear()
    }
    toast.success('Location and map cleared')
  }, [vectorSource])

  const handleClearChat = useCallback(async () => {
    try {
      await clearChatHistory('DEFAULT')
    } catch (error) {
      console.error('Error clearing chat:', error)
    }
  }, [clearChatHistory])

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  // Data Popover Functions
  const getDataColumns = useCallback((data?: Array<Record<string, any>>) => {
    if (!data || data.length === 0) return []
    const allKeys = new Set<string>()
    data.forEach(row => {
      Object.keys(row).forEach(key => allKeys.add(key))
    })
    return Array.from(allKeys)
  }, [])

  const hasData = useCallback((data?: Array<Record<string, any>>) => {
    return Boolean(data && data.length > 0)
  }, [])

  // RAG Popover Functions
  const hasRagDocuments = useCallback((ragDocuments?: Array<{ id: string, tableName: string, text: string, similarity: number, documentType: string }>) => {
    return Boolean(ragDocuments && ragDocuments.length > 0)
  }, [])

  // SQL Popover Functions
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
  }, [])

  const value = useMemo<ChatContextProps>(
    () => ({
      messages,
      setMessages,
      isLoading,
      isSearching,
      sendMessage,
      clearChatHistory,
      chatHistory,
      error,
      map,
      vectorSource,
      isMapLoading,
      handleFileUpload,
      fitToData,

      // Chat Sidebar Logic
      inputValue,
      setInputValue,
      currentLocation,
      setCurrentLocation,
      handleFileSelect,
      handleSendMessage,
      handleClearLocation,
      handleClearChat,
      handleKeyDown,

      // Data Popover Logic
      getDataColumns,
      hasData,

      // RAG Popover Logic
      hasRagDocuments,

      // SQL Popover Logic
      copyToClipboard,
    }),
    [messages, isLoading, isSearching, sendMessage, clearChatHistory, chatHistory, error, map, vectorSource, isMapLoading, handleFileUpload, fitToData, inputValue, setInputValue, currentLocation, setCurrentLocation, handleFileSelect, handleSendMessage, handleClearLocation, handleClearChat, handleKeyDown, getDataColumns, hasData, hasRagDocuments, copyToClipboard]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
