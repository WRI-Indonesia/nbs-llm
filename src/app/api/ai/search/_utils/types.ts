export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
    timestamp?: string
    sqlQuery?: string
    ragDocuments?: any[]
    data?: any
}

export interface RelevantDocument {
    id: string
    tableName: string
    text: string
    similarity: number
    documentType: 'column' | 'table'
}

export interface SearchStats {
    totalDocumentsFound: number
    minCosineThreshold: number
    topK: number
}

export interface SearchResponse {
    success: boolean
    query: string
    sqlQuery?: string | null
    answer?: string
    content?: string
    message?: string
    data: any[]
    chatHistory: ChatMessage[]
    relevantDocuments?: RelevantDocument[]
    searchStats?: SearchStats
}

export interface SearchRequest {
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

export type NodeDocMatch = {
    id: number
    node_id: string
    document_text: string
    similarity: number
}

export type MinioDocMatch = {
    id: number
    file_name: string
    document_text: string
    similarity: number
}