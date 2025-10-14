import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const blogSlug = searchParams.get('blogSlug')

    if (!blogSlug) {
      return NextResponse.json(
        { error: 'Blog slug is required' },
        { status: 400 }
      )
    }

    // Check if blog exists and user is the author
    const blog = await prisma.blog.findUnique({
      where: { slug: blogSlug },
      select: { 
        id: true, 
        authorId: true,
        blogAccess: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        }
      }
    })

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      )
    }

    if (blog.authorId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the author can manage blog access' },
        { status: 403 }
      )
    }

    return NextResponse.json(blog.blogAccess)
  } catch (error) {
    console.error('Error fetching blog access:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blog access' },
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
    const { blogSlug, userId } = body

    if (!blogSlug || !userId) {
      return NextResponse.json(
        { error: 'Blog slug and user ID are required' },
        { status: 400 }
      )
    }

    // Check if blog exists and user is the author
    const blog = await prisma.blog.findUnique({
      where: { slug: blogSlug },
      select: { id: true, authorId: true }
    })

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      )
    }

    if (blog.authorId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the author can manage blog access' },
        { status: 403 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if access already exists
    const existingAccess = await prisma.blogAccess.findUnique({
      where: {
        userId_blogId: {
          userId,
          blogId: blog.id
        }
      }
    })

    if (existingAccess) {
      return NextResponse.json(
        { error: 'User already has access to this blog' },
        { status: 400 }
      )
    }

    const blogAccess = await prisma.blogAccess.create({
      data: {
        userId,
        blogId: blog.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json(blogAccess, { status: 201 })
  } catch (error) {
    console.error('Error creating blog access:', error)
    return NextResponse.json(
      { error: 'Failed to create blog access' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const blogSlug = searchParams.get('blogSlug')
    const userId = searchParams.get('userId')

    if (!blogSlug || !userId) {
      return NextResponse.json(
        { error: 'Blog slug and user ID are required' },
        { status: 400 }
      )
    }

    // Check if blog exists and user is the author
    const blog = await prisma.blog.findUnique({
      where: { slug: blogSlug },
      select: { id: true, authorId: true }
    })

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      )
    }

    if (blog.authorId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the author can manage blog access' },
        { status: 403 }
      )
    }

    await prisma.blogAccess.deleteMany({
      where: {
        userId,
        blogId: blog.id
      }
    })

    return NextResponse.json({ message: 'Blog access removed successfully' })
  } catch (error) {
    console.error('Error removing blog access:', error)
    return NextResponse.json(
      { error: 'Failed to remove blog access' },
      { status: 500 }
    )
  }
}
