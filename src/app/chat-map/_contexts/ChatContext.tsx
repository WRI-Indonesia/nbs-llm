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

interface SearchRequest {
  query: string
  min_cosine?: number
  top_k?: number
  projectId: string
  chatHistory?: ChatMessage[]
  location?: {
    district: string[]
    province: string[]
  }
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
    }),
    [messages, isLoading, isSearching, sendMessage, clearChatHistory, chatHistory, error, map, vectorSource, isMapLoading, handleFileUpload, fitToData]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
