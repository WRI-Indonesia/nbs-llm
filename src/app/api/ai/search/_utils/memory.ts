import { prisma } from "@/lib/prisma";
import { generateQueryEmbedding } from "./generate-embedding-agent";

export async function saveSemanticMemory(params: {
    userId: string;
    projectId: string;
    content: string;
    tags?: string[];
}) {
    const { userId, projectId, content, tags = [] } = params

    const embedding = await generateQueryEmbedding(content) // return numbers
    
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

export async function retrieveSemanticMemory(params: {
    projectId: string;
    embedding: number[];
    topK?: number;
}): Promise<string[]> {
    const { projectId, embedding, topK = 8 } = params
    try {
        const rows = await prisma.$queryRawUnsafe<{ content: string }[]>(
            `SELECT content FROM "mem_semantic" WHERE project_id = $1 ORDER BY embedding <-> ($2)::vector(3072) LIMIT ${topK}`,
            projectId,
            JSON.stringify(embedding)
        )
        return rows.map(r => r.content)
    } catch {
        return []
    }
}

export async function retrieveEpisodicMemory(params: {
    userId: string;
    projectId: string;
    topK?: number;
}): Promise<string[]> {
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
    } catch {
        return []
    }
}

export async function logProcedure(params: {
    userId: string;
    projectId: string;
    name: string;
    details: Record<string, unknown>;
}) {
    const { userId, projectId, name, details } = params
    const payload = `[PROCEDURE:${name}] ${JSON.stringify(details)}`
    // Store as semantic memory with a tag so it’s searchable and auditable
    await saveSemanticMemory({
        userId,
        projectId,
        content: payload,
        tags: ['procedure']
    })
}