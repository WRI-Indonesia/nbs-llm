import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }
    
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit
    })
    
    return NextResponse.json({
      messages: messages.map(msg => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata,
        createdAt: msg.createdAt.getTime()
      }))
    })
    
  } catch (error: any) {
    console.error('Get chat history error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, role, content, metadata } = body
    
    if (!sessionId || !role || !content) {
      return NextResponse.json(
        { error: 'sessionId, role, and content are required' },
        { status: 400 }
      )
    }
    
    if (!['user', 'assistant'].includes(role)) {
      return NextResponse.json(
        { error: 'role must be either "user" or "assistant"' },
        { status: 400 }
      )
    }
    
    const message = await prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
        metadata: metadata ? JSON.stringify(metadata) : undefined
      }
    })
    
    return NextResponse.json({
      message: {
        id: message.id.toString(),
        role: message.role,
        content: message.content,
        metadata: message.metadata,
        createdAt: message.createdAt.getTime()
      }
    })
    
  } catch (error: any) {
    console.error('Create chat message error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }
    
    await prisma.chatMessage.deleteMany({
      where: { sessionId }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Chat history cleared'
    })
    
  } catch (error: any) {
    console.error('Clear chat history error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
