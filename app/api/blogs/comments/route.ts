import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const blogSlug = searchParams.get('blogSlug')
    const parentId = searchParams.get('parentId')

    if (!blogSlug) {
      return NextResponse.json(
        { error: 'Blog slug is required' },
        { status: 400 }
      )
    }

    // First check if blog exists and user has access
    const blog = await prisma.blog.findUnique({
      where: { slug: blogSlug },
      select: { 
        id: true, 
        visibility: true, 
        authorId: true, 
        organizationId: true,
        blogAccess: { select: { userId: true } }
      }
    })

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      )
    }

    const session = await getServerSession(authOptions)

    // Check access permissions
    if (blog.visibility === 'PUBLIC') {
      // Anyone can see comments on public blogs
    } else if (blog.visibility === 'INTERNAL') {
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      // Check if user has access to internal blog
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { organizationId: true }
      })
      
      if (user?.organizationId !== blog.organizationId && session.user.id !== blog.authorId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    } else if (blog.visibility === 'PRIVATE') {
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      const hasAccess = session.user.id === blog.authorId || 
                       blog.blogAccess.some(access => access.userId === session.user.id)
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    const whereClause: any = { blogId: blog.id }
    if (parentId) {
      whereClause.parentId = parentId
    } else {
      whereClause.parentId = null
    }

    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            replies: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { content, blogSlug, parentId } = body

    if (!content || !blogSlug) {
      return NextResponse.json(
        { error: 'Content and blog slug are required' },
        { status: 400 }
      )
    }

    // Check if blog exists and user has access
    const blog = await prisma.blog.findUnique({
      where: { slug: blogSlug },
      select: { 
        id: true, 
        visibility: true, 
        authorId: true, 
        organizationId: true,
        blogAccess: { select: { userId: true } }
      }
    })

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      )
    }

    // Check access permissions
    if (blog.visibility === 'PUBLIC') {
      // Anyone can comment on public blogs
    } else if (blog.visibility === 'INTERNAL') {
      // Check if user has access to internal blog
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { organizationId: true }
      })
      
      if (user?.organizationId !== blog.organizationId && session.user.id !== blog.authorId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    } else if (blog.visibility === 'PRIVATE') {
      const hasAccess = session.user.id === blog.authorId || 
                       blog.blogAccess.some(access => access.userId === session.user.id)
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // If parentId is provided, check if parent comment exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, blogId: true }
      })

      if (!parentComment || parentComment.blogId !== blog.id) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        )
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        authorId: session.user.id,
        blogId: blog.id,
        parentId: parentId || null
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}
