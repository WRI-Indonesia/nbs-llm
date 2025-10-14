import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { BlogVisibility } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const visibility = searchParams.get('visibility') as BlogVisibility | null
    const organizationId = searchParams.get('organizationId')
    const authorId = searchParams.get('authorId')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    // Build where clause based on user's access
    let whereClause: any = {}

    if (session?.user?.id) {
      // Get user's organization for filtering
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { organizationId: true }
      })

      // Authenticated user can see:
      // - PUBLIC blogs
      // - INTERNAL blogs from their organization
      // - PRIVATE blogs they have access to
      whereClause = {
        OR: [
          { visibility: 'PUBLIC' },
          {
            AND: [
              { visibility: 'INTERNAL' },
              {
                OR: [
                  { organizationId: user?.organizationId },
                  { authorId: session.user.id }
                ]
              }
            ]
          },
          {
            AND: [
              { visibility: 'PRIVATE' },
              {
                OR: [
                  { authorId: session.user.id },
                  { blogAccess: { some: { userId: session.user.id } } }
                ]
              }
            ]
          }
        ]
      }
    } else {
      // Non-authenticated users can only see PUBLIC blogs
      whereClause = { visibility: 'PUBLIC' }
    }

    // Add additional filters
    if (visibility) {
      whereClause.visibility = visibility
    }
    if (organizationId) {
      whereClause.organizationId = organizationId
    }
    if (authorId) {
      whereClause.authorId = authorId
    }
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } }
      ]
    }

    const blogs = await prisma.blog.findMany({
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
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        _count: {
          select: {
            comments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.blog.count({ where: whereClause })

    return NextResponse.json({
      blogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching blogs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blogs' },
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

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true }
    })

    const body = await request.json()
    const { title, content, excerpt, visibility, organizationId, tags, isNotebook, notebookData } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50)

    // Ensure slug is unique
    let finalSlug = slug
    let counter = 1
    while (await prisma.blog.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`
      counter++
    }

    const blog = await prisma.blog.create({
      data: {
        title,
        slug: finalSlug,
        content,
        excerpt,
        visibility: visibility || 'PUBLIC',
        publishedAt: visibility === 'PUBLIC' ? new Date() : null,
        authorId: session.user.id,
        organizationId: organizationId || user?.organizationId,
        tags: tags || [],
        isNotebook: isNotebook || false,
        notebookData: notebookData || null
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })

    return NextResponse.json(blog, { status: 201 })
  } catch (error) {
    console.error('Error creating blog:', error)
    return NextResponse.json(
      { error: 'Failed to create blog' },
      { status: 500 }
    )
  }
}
