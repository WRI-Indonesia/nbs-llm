import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id ?? ''
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    const cfg = (user?.config as any) || {}
    return NextResponse.json({
      chunkSize: cfg?.chunkSize ?? 1000,
      overlap: cfg?.overlap ?? 200,
      topK: cfg?.topK ?? 10,
      minCos: cfg?.minCos ?? 0.2,
      cacheEnabled: cfg?.cacheEnabled ?? true,
      semanticTopK: cfg?.semanticTopK ?? 10,
      cacheTtlSemretr: cfg?.cacheTtlSemretr ?? 1800,
      useHybridSearch: cfg?.useHybridSearch ?? true,
      hybridMinCosine: cfg?.hybridMinCosine ?? 0.2,
      hybridTopK: cfg?.hybridTopK ?? 5,
      hybridAlpha: cfg?.hybridAlpha ?? 0.7,
      rerankEnabled: cfg?.rerankEnabled ?? true,
      rerankTopN: cfg?.rerankTopN ?? 20,
      rerankModelName: cfg?.rerankModelName ?? 'cross-encoder/ms-marco-MiniLM-L-6-v2',
      repromptAgentModel: cfg?.repromptAgentModel ?? 'gpt-4o-mini',
      sqlGeneratorAgentModel: cfg?.sqlGeneratorAgentModel ?? 'gpt-4o',
      embeddingAgentModel: cfg?.embeddingAgentModel ?? 'text-embedding-3-large',
      summarizationModelEndpoint: cfg?.summarizationModelEndpoint ?? 'https://seallm.wri-indonesia.or.id/v1/chat/completions',
      summarizationModel: cfg?.summarizationModel ?? 'SeaLLMs/SeaLLM-7B-v2.5',
    })
  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id ?? ''
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    
    // Get existing config to merge with new values
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const existingConfig = (user?.config as any) || {}

    // Validate and process numeric fields
    const rawChunkSize = Number(body.chunkSize ?? existingConfig.chunkSize ?? 1000)
    const rawOverlap = Number(body.overlap ?? existingConfig.overlap ?? 200)
    const rawTopK = Number(body.topK ?? existingConfig.topK ?? 10)
    const rawMinCos = Number(body.minCos ?? existingConfig.minCos ?? 0.2)
    const rawSemanticTopK = Number(body.semanticTopK ?? existingConfig.semanticTopK ?? 10)
    const rawCacheTtlSemretr = Number(body.cacheTtlSemretr ?? existingConfig.cacheTtlSemretr ?? 1800)
    const rawHybridMinCosine = Number(body.hybridMinCosine ?? existingConfig.hybridMinCosine ?? 0.2)
    const rawHybridTopK = Number(body.hybridTopK ?? existingConfig.hybridTopK ?? 5)
    const rawHybridAlpha = Number(body.hybridAlpha ?? existingConfig.hybridAlpha ?? 0.7)
    const rawRerankTopN = Number(body.rerankTopN ?? existingConfig.rerankTopN ?? 20)

    // Validate required numeric fields
    if (!Number.isFinite(rawChunkSize) || !Number.isFinite(rawOverlap) || 
        !Number.isFinite(rawTopK) || !Number.isFinite(rawMinCos)) {
      return NextResponse.json({ error: 'Invalid payload: missing required numeric fields' }, { status: 400 })
    }

    // Clamp and validate numeric values
    const chunkSize = Math.max(200, Math.min(8000, Math.floor(rawChunkSize)))
    const overlap = Math.max(0, Math.min(chunkSize - 1, Math.floor(rawOverlap)))
    const topK = Math.max(1, Math.min(20, Math.floor(rawTopK)))
    const minCos = Math.max(0, Math.min(1, Number(rawMinCos)))
    const semanticTopK = Math.max(1, Math.min(100, Math.floor(rawSemanticTopK)))
    const cacheTtlSemretr = Math.max(0, Math.floor(rawCacheTtlSemretr))
    const hybridMinCosine = Math.max(0, Math.min(1, Number(rawHybridMinCosine)))
    const hybridTopK = Math.max(1, Math.min(100, Math.floor(rawHybridTopK)))
    const hybridAlpha = Math.max(0, Math.min(1, Number(rawHybridAlpha)))
    const rerankTopN = Math.max(1, Math.min(100, Math.floor(rawRerankTopN)))

    // Process boolean fields
    const cacheEnabled = typeof body.cacheEnabled === 'boolean' ? body.cacheEnabled : (existingConfig.cacheEnabled ?? true)
    const useHybridSearch = typeof body.useHybridSearch === 'boolean' ? body.useHybridSearch : (existingConfig.useHybridSearch ?? true)
    const rerankEnabled = typeof body.rerankEnabled === 'boolean' ? body.rerankEnabled : (existingConfig.rerankEnabled ?? true)

    // Process string fields
    const rerankModelName = typeof body.rerankModelName === 'string' ? body.rerankModelName : (existingConfig.rerankModelName ?? 'cross-encoder/ms-marco-MiniLM-L-6-v2')
    const repromptAgentModel = typeof body.repromptAgentModel === 'string' ? body.repromptAgentModel : (existingConfig.repromptAgentModel ?? 'gpt-4o-mini')
    const sqlGeneratorAgentModel = typeof body.sqlGeneratorAgentModel === 'string' ? body.sqlGeneratorAgentModel : (existingConfig.sqlGeneratorAgentModel ?? 'gpt-4o')
    const embeddingAgentModel = typeof body.embeddingAgentModel === 'string' ? body.embeddingAgentModel : (existingConfig.embeddingAgentModel ?? 'text-embedding-3-large')
    const summarizationModelEndpoint = typeof body.summarizationModelEndpoint === 'string' ? body.summarizationModelEndpoint : (existingConfig.summarizationModelEndpoint ?? 'https://seallm.wri-indonesia.or.id/v1/chat/completions')
    const summarizationModel = typeof body.summarizationModel === 'string' ? body.summarizationModel : (existingConfig.summarizationModel ?? 'SeaLLMs/SeaLLM-7B-v2.5')

    // Merge all config values
    const config = {
      ...existingConfig,
      chunkSize,
      overlap,
      topK,
      minCos,
      cacheEnabled,
      semanticTopK,
      cacheTtlSemretr,
      useHybridSearch,
      hybridMinCosine,
      hybridTopK,
      hybridAlpha,
      rerankEnabled,
      rerankTopN,
      rerankModelName,
      repromptAgentModel,
      sqlGeneratorAgentModel,
      embeddingAgentModel,
      summarizationModelEndpoint,
      summarizationModel,
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { config },
    })

    const updatedConfig = (updated.config as any) || {}
    return NextResponse.json({
      chunkSize: updatedConfig.chunkSize ?? chunkSize,
      overlap: updatedConfig.overlap ?? overlap,
      topK: updatedConfig.topK ?? topK,
      minCos: updatedConfig.minCos ?? minCos,
      cacheEnabled: updatedConfig.cacheEnabled ?? cacheEnabled,
      semanticTopK: updatedConfig.semanticTopK ?? semanticTopK,
      cacheTtlSemretr: updatedConfig.cacheTtlSemretr ?? cacheTtlSemretr,
      useHybridSearch: updatedConfig.useHybridSearch ?? useHybridSearch,
      hybridMinCosine: updatedConfig.hybridMinCosine ?? hybridMinCosine,
      hybridTopK: updatedConfig.hybridTopK ?? hybridTopK,
      hybridAlpha: updatedConfig.hybridAlpha ?? hybridAlpha,
      rerankEnabled: updatedConfig.rerankEnabled ?? rerankEnabled,
      rerankTopN: updatedConfig.rerankTopN ?? rerankTopN,
      rerankModelName: updatedConfig.rerankModelName ?? rerankModelName,
      repromptAgentModel: updatedConfig.repromptAgentModel ?? repromptAgentModel,
      sqlGeneratorAgentModel: updatedConfig.sqlGeneratorAgentModel ?? sqlGeneratorAgentModel,
      embeddingAgentModel: updatedConfig.embeddingAgentModel ?? embeddingAgentModel,
      summarizationModelEndpoint: updatedConfig.summarizationModelEndpoint ?? summarizationModelEndpoint,
      summarizationModel: updatedConfig.summarizationModel ?? summarizationModel,
    })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}


