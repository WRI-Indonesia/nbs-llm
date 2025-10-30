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

    const cfg = await prisma.config.findUnique({ where: { userId } })
    return NextResponse.json({
      chunkSize: cfg?.chunkSize ?? 1000,
      overlap: cfg?.overlap ?? 200,
      topK: cfg?.topK ?? 10,
      minCos: cfg?.minCos ?? 0.2,
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
    const rawChunkSize = Number(body.chunkSize)
    const rawOverlap = Number(body.overlap)
    const rawTopK = Number(body.topK)
    const rawMinCos = Number(body.minCos)

    if (!Number.isFinite(rawChunkSize) || !Number.isFinite(rawOverlap)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    if (!Number.isFinite(rawTopK) || !Number.isFinite(rawMinCos)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const chunkSize = Math.max(200, Math.min(8000, Math.floor(rawChunkSize)))
    const overlap = Math.max(0, Math.min(chunkSize - 1, Math.floor(rawOverlap)))
    const topK = Math.max(1, Math.min(20, Math.floor(rawTopK)))
    const minCos = Math.max(0, Math.min(1, Number(rawMinCos)))

    const updated = await prisma.config.upsert({
      where: { userId },
      update: { chunkSize, overlap, topK, minCos },
      create: { userId, chunkSize, overlap, topK, minCos },
    })

    return NextResponse.json({
      chunkSize: updated.chunkSize,
      overlap: updated.overlap,
      topK: updated.topK,
      minCos: updated.minCos,
    })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}


