import { NextRequest, NextResponse } from 'next/server'
import { updateRagasScores } from '@/lib/document-processor'
import { isAdmin } from '@/lib/auth'

/**
 * Example API route to update RAGAS evaluation scores
 * POST /api/evaluation/ragas/update-scores?documentId=123
 * Body: { contextPrecision: 0.95, contextRecall: 0.90, faithfulness: 0.88, answerRelevance: 0.92, averageScore: 0.91 }
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { contextPrecision, contextRecall, faithfulness, answerRelevance, averageScore } = body

    // Update the RAGAS scores
    await updateRagasScores(parseInt(documentId), {
      contextPrecision,
      contextRecall,
      faithfulness,
      answerRelevance,
      averageScore,
    })

    return NextResponse.json({
      success: true,
      message: 'RAGAS scores updated successfully',
    })
  } catch (error) {
    console.error('Error updating RAGAS scores:', error)
    return NextResponse.json(
      {
        error: 'Failed to update RAGAS scores',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

