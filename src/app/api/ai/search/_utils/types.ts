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
}
