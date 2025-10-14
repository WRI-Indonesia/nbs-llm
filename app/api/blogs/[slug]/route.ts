import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { slug } = await params

    const blog = await prisma.blog.findUnique({
      where: { slug },
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
        comments: {
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
            }
          },
          where: { parentId: null },
          orderBy: { createdAt: 'desc' }
        },
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

    // Check access permissions
    if (blog.visibility === 'PUBLIC') {
      // Anyone can see public blogs
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

    return NextResponse.json(blog)
  } catch (error) {
    console.error('Error fetching blog:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blog' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { slug } = await params
    const body = await request.json()
    const { title, content, excerpt, visibility, tags, isNotebook, notebookData } = body

    // Check if blog exists and user has permission to edit
    const existingBlog = await prisma.blog.findUnique({
      where: { slug },
      select: { authorId: true, visibility: true, title: true }
    })

    if (!existingBlog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      )
    }

    if (existingBlog.authorId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the author can edit this blog' },
        { status: 403 }
      )
    }

    // Generate new slug if title changed
    let finalSlug = slug
    if (title && title !== existingBlog.title) {
      const newSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 50)
      
      // Ensure new slug is unique
      let counter = 1
      finalSlug = newSlug
      while (await prisma.blog.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${newSlug}-${counter}`
        counter++
      }
    }

    const updateData: any = {}
    if (title) updateData.title = title
    if (content) updateData.content = content
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (visibility) {
      updateData.visibility = visibility
      // Set publishedAt if changing to public
      if (visibility === 'PUBLIC' && existingBlog.visibility !== 'PUBLIC') {
        updateData.publishedAt = new Date()
      }
    }
    if (tags) updateData.tags = tags
    if (isNotebook !== undefined) updateData.isNotebook = isNotebook
    if (notebookData !== undefined) updateData.notebookData = notebookData
    if (finalSlug !== slug) updateData.slug = finalSlug

    const blog = await prisma.blog.update({
      where: { slug },
      data: updateData,
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

    return NextResponse.json(blog)
  } catch (error) {
    console.error('Error updating blog:', error)
    return NextResponse.json(
      { error: 'Failed to update blog' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { slug } = await params

    // Check if blog exists and user has permission to delete
    const existingBlog = await prisma.blog.findUnique({
      where: { slug },
      select: { authorId: true }
    })

    if (!existingBlog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      )
    }

    if (existingBlog.authorId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the author can delete this blog' },
        { status: 403 }
      )
    }

    await prisma.blog.delete({
      where: { slug }
    })

    return NextResponse.json({ message: 'Blog deleted successfully' })
  } catch (error) {
    console.error('Error deleting blog:', error)
    return NextResponse.json(
      { error: 'Failed to delete blog' },
      { status: 500 }
    )
  }
}
