import OpenAI from 'openai'

/**
 * Generates embedding for the search query using OpenAI
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const response = await openai.embeddings.create({
            model: process.env.EMBEDDING_AGENT_MODEL ?? "text-embedding-3-large",
            input: query,
        })

        return response.data[0].embedding
    } catch (error) {
        console.error('Error generating query embedding:', error)
        throw new Error('Failed to generate query embedding')
    }
}