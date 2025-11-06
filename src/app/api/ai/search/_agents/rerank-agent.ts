import { BaseAgent } from './base-agent'

type RerankInput = {
  id: string
  text: string
}

export type RerankResult = {
  id: string
  text: string
  score: number
}

type RerankOptions = {
  topN?: number
  model?: string
}

const DEFAULT_MODEL = process.env.RERANK_MODEL_NAME || 'cross-encoder/ms-marco-MiniLM-L-6-v2'

/**
 * Rerank Agent
 * Reranks retrieved documents using cross-encoder models (HuggingFace)
 * Improves document relevance after initial retrieval
 */
export class RerankAgent extends BaseAgent {
  constructor() {
    super('RerankAgent')
  }

  /**
   * Scores a single query-document pair using HuggingFace API
   */
  private async scorePair(query: string, doc: string, hfApiToken: string, model: string): Promise<number> {
    const endpoint = `https://router.huggingface.co/hf-inference/models/${model}`
    const payload = { inputs: { source_sentence: query, sentences: [doc] } }

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hfApiToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      let errorMessage = `HF rerank request failed (${resp.status}): ${errText}`
      
      // Provide helpful error messages for common issues
      if (resp.status === 401) {
        errorMessage += '. Check that HF_API_TOKEN is valid and has not expired. Get a new token at https://huggingface.co/settings/tokens'
      } else if (resp.status === 403) {
        errorMessage += '. Token may not have permission to access this model'
      } else if (resp.status === 404) {
        errorMessage += '. Model not found or endpoint changed'
      }
      
      throw new Error(errorMessage)
    }

    const data = await resp.json()
    // Model returns an array of scores corresponding to sentences
    // For single sentence, pick index 0
    if (Array.isArray(data) && typeof data[0] === 'number') return data[0]
    if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === 'number') return data[0][0]
    if (typeof data?.score === 'number') return data.score
    // Fallback conservative score
    return 0
  }

  /**
   * Reranks documents based on query relevance
   * @param query - The user query
   * @param documents - Array of documents to rerank
   * @param options - Optional rerank configuration
   * @returns Array of reranked documents with scores
   */
  async execute(
    query: string,
    documents: RerankInput[],
    options?: RerankOptions
  ): Promise<RerankResult[]> {
    const enabled = (process.env.RERANK_ENABLED ?? 'true').toLowerCase() !== 'false'
    if (!enabled || documents.length === 0) {
      return documents.map(d => ({ ...d, score: 0 }))
    }

    const hfApiToken = (process.env.HF_API_TOKEN || '').trim()
    if (!hfApiToken) {
      // If token missing, skip reranking but keep flow working
      console.warn(`[${this.agentName}] HF_API_TOKEN not set, skipping reranking`)
      return documents.map((d, i) => ({ ...d, score: 0 - i * 1e-6 }))
    }

    // Validate token format (HuggingFace tokens typically start with "hf_")
    if (!hfApiToken.startsWith('hf_') && hfApiToken.length < 10) {
      console.warn(`[${this.agentName}] HF_API_TOKEN appears invalid (should start with "hf_"), skipping reranking`)
      return documents.map((d, i) => ({ ...d, score: 0 - i * 1e-6 }))
    }

    const model = options?.model || process.env.RERANK_MODEL_NAME || DEFAULT_MODEL
    const scored: RerankResult[] = []

    for (const doc of documents) {
      try {
        const score = await this.scorePair(query, doc.text, hfApiToken, model)
        scored.push({ ...doc, score })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`[${this.agentName}] Error scoring document ${doc.id}:`, errorMsg)
        
        // If it's an auth error, skip remaining documents to avoid spam
        if (errorMsg.includes('401') || errorMsg.includes('Invalid credentials')) {
          console.error(`[${this.agentName}] Authentication failed. Skipping reranking for remaining documents. Please check HF_API_TOKEN.`)
          // Return what we have so far with remaining documents having low scores
          const remaining = documents.slice(scored.length).map((d, i) => ({ ...d, score: -1e9 - i }))
          const allScored = [...scored, ...remaining]
          const sorted = allScored.sort((a, b) => b.score - a.score)
          const topN = options?.topN ?? Math.min(20, sorted.length)
          return sorted.slice(0, topN)
        }
        
        // On other failures, push with lowest score but do not break workflow
        scored.push({ ...doc, score: -1e9 })
      }
    }

    const sorted = scored.sort((a, b) => b.score - a.score)
    const topN = options?.topN ?? Math.min(20, sorted.length)
    return sorted.slice(0, topN)
  }

  /**
   * Alias for execute for backward compatibility
   */
  async rerankDocuments(
    query: string,
    documents: RerankInput[],
    options?: RerankOptions
  ): Promise<RerankResult[]> {
    return this.execute(query, documents, options)
  }
}

