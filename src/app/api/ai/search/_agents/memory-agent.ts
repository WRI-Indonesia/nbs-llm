import { prisma } from "@/lib/prisma"
import { BaseAgent } from "./base-agent"
import { EmbeddingAgent } from "./embedding-agent"

export type SemanticMemoryParams = {
  userId: string
  projectId: string
  content: string
  tags?: string[]
}

export type RetrieveSemanticMemoryParams = {
  projectId: string
  embedding: number[]
  topK?: number
}

export type RetrieveEpisodicMemoryParams = {
  userId: string
  projectId: string
  topK?: number
}

export type LogProcedureParams = {
  userId: string
  projectId: string
  name: string
  details: Record<string, unknown>
}

/**
 * Memory Agent
 * Manages three types of memory:
 * - Semantic Memory: Stores and retrieves semantic facts from past queries
 * - Episodic Memory: Retrieves recent chat history snippets
 * - Procedural Memory: Logs pipeline execution details
 */
export class MemoryAgent extends BaseAgent {
  private embeddingAgent: EmbeddingAgent

  constructor() {
    super('MemoryAgent')
    this.embeddingAgent = new EmbeddingAgent()
  }

  /**
   * Execute method required by BaseAgent
   * MemoryAgent has multiple operations, so this is a generic entry point
   * For specific operations, use the dedicated methods directly
   */
  async execute(operation: 'saveSemantic' | 'retrieveSemantic' | 'retrieveEpisodic' | 'logProcedure', ...args: any[]): Promise<any> {
    switch (operation) {
      case 'saveSemantic':
        return this.saveSemanticMemory(args[0] as SemanticMemoryParams)
      case 'retrieveSemantic':
        return this.retrieveSemanticMemory(args[0] as RetrieveSemanticMemoryParams)
      case 'retrieveEpisodic':
        return this.retrieveEpisodicMemory(args[0] as RetrieveEpisodicMemoryParams)
      case 'logProcedure':
        return this.logProcedure(args[0] as LogProcedureParams)
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  /**
   * Saves semantic memory (fact) to the database
   * @param params - Parameters for saving semantic memory
   */
  async saveSemanticMemory(params: SemanticMemoryParams): Promise<void> {
    const { userId, projectId, content, tags = [] } = params

    const embedding = await this.embeddingAgent.generateQueryEmbedding(content)
    
    await prisma.$executeRawUnsafe(
      `INSERT INTO "mem_semantic" (user_id, project_id, content, embedding, tags)
       VALUES ($1, $2, $3, ($4)::vector(3072), $5)`,
      userId,
      projectId,
      content,
      JSON.stringify(embedding),
      tags
    )
  }

  /**
   * Retrieves semantic memory based on embedding similarity
   * @param params - Parameters for retrieving semantic memory
   * @returns Array of semantic memory content strings
   */
  async retrieveSemanticMemory(params: RetrieveSemanticMemoryParams): Promise<string[]> {
    const { projectId, embedding, topK = 8 } = params
    try {
      const rows = await prisma.$queryRawUnsafe<{ content: string }[]>(
        `SELECT content FROM "mem_semantic" 
         WHERE project_id = $1 
         ORDER BY embedding <-> ($2)::vector(3072) 
         LIMIT ${topK}`,
        projectId,
        JSON.stringify(embedding)
      )
      return rows.map(r => r.content)
    } catch (error) {
      console.error(`[${this.agentName}] Error retrieving semantic memory:`, error)
      return []
    }
  }

  /**
   * Retrieves episodic memory (recent chat history)
   * @param params - Parameters for retrieving episodic memory
   * @returns Array of chat history snippets as strings
   */
  async retrieveEpisodicMemory(params: RetrieveEpisodicMemoryParams): Promise<string[]> {
    const { userId, projectId, topK = 6 } = params
    try {
      const rows = await prisma.chatHistory.findMany({
        where: { userId, projectId },
        orderBy: { timestamp: 'desc' },
        take: topK
      })
      // Return compact message summaries
      return rows
        .map(r => `${r.role}: ${r.content}`)
        .reverse()
    } catch (error) {
      console.error(`[${this.agentName}] Error retrieving episodic memory:`, error)
      return []
    }
  }

  /**
   * Logs procedural memory (pipeline execution details)
   * @param params - Parameters for logging procedure
   */
  async logProcedure(params: LogProcedureParams): Promise<void> {
    const { userId, projectId, name, details } = params
    const payload = `[PROCEDURE:${name}] ${JSON.stringify(details)}`
    // Store as semantic memory with a tag so it's searchable and auditable
    await this.saveSemanticMemory({
      userId,
      projectId,
      content: payload,
      tags: ['procedure']
    })
  }
}

