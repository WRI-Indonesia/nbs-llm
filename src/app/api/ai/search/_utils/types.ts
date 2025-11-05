export type NodeDocMatch = {
    id: number
    node_id: string
    document_text: string
    similarity: number
    vector_score?: number
    keyword_score?: number
}

export type MinioDocMatch = {
    id: number
    file_name: string
    document_text: string
    similarity: number
    vector_score?: number
    keyword_score?: number
}

export interface SearchRequest {
    query: string
    min_cosine?: number
    top_k?: number
    projectId: string
    timestamp: Date
    location?: {
        district: string[]
        province: string[]
    }
    use_hybrid?: boolean  // Enable hybrid search (default: true)
    hybrid_alpha?: number  // Weight for vector search (0.0 = only keyword, 1.0 = only vector, default: 0.7)
}

export type SumUsage = { prompt: number; completion: number; total: number; source: 'measured' | 'estimated' }
export type SumObj = { text: string; usage: SumUsage }