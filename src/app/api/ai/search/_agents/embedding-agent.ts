import OpenAI from 'openai'
import { BaseAgent } from './base-agent'

export type EmbeddingResult = {
  embedding: number[]
  model: string
}

/**
 * Embedding Agent
 * Generates vector embeddings for queries using OpenAI embedding models
 * Used for semantic similarity search in the database
 */
export class EmbeddingAgent extends BaseAgent {
  private openai: OpenAI

  constructor() {
    super('EmbeddingAgent')
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  /**
   * Generates embedding for the search query using OpenAI
   * @param query - The user query to embed
   * @param model - Optional model name (defaults to env var or text-embedding-3-large)
   * @returns EmbeddingResult with embedding vector and model name
   */
  async execute(query: string, model?: string): Promise<EmbeddingResult> {
    try {
      const embeddingModel = model ?? process.env.EMBEDDING_AGENT_MODEL ?? "text-embedding-3-large"
      const response = await this.openai.embeddings.create({
        model: embeddingModel,
        input: query,
      })

      return {
        embedding: response.data[0].embedding,
        model: embeddingModel
      }
    } catch (error) {
      console.error(`[${this.agentName}] Error generating query embedding:`, error)
      throw new Error('Failed to generate query embedding')
    }
  }

  /**
   * Alias for execute that returns just the embedding array
   * Maintains backward compatibility with existing code
   */
  async generateQueryEmbedding(query: string, model?: string): Promise<number[]> {
    const result = await this.execute(query, model)
    return result.embedding
  }
}

