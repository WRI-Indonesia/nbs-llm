import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

interface NotebookCell {
  cell_type: string
  source: string | string[]
  metadata?: any
  outputs?: any[]
  execution_count?: number
}

interface NotebookData {
  cells: NotebookCell[]
  metadata: any
  nbformat: number
  nbformat_minor: number
}

function convertNotebookToMarkdown(notebookData: NotebookData): string {
  let markdown = ''
  
  for (const cell of notebookData.cells) {
    if (cell.cell_type === 'markdown') {
      const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source
      markdown += source + '\n\n'
    } else if (cell.cell_type === 'code') {
      const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source
      
      // Add code block
      markdown += '```python\n' + source + '\n```\n\n'
      
      // Add outputs if they exist
      if (cell.outputs && cell.outputs.length > 0) {
        markdown += '**Output:**\n\n'
        for (const output of cell.outputs) {
          if (output.output_type === 'stream') {
            markdown += '```\n' + (output.text || '') + '\n```\n\n'
          } else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
            if (output.data && output.data['text/plain']) {
              markdown += '```\n' + output.data['text/plain'] + '\n```\n\n'
            }
          } else if (output.output_type === 'error') {
            markdown += '```\nError: ' + (output.ename || 'Unknown error') + '\n' + (output.evalue || '') + '\n```\n\n'
          }
        }
      }
    } else if (cell.cell_type === 'raw') {
      const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source
      markdown += source + '\n\n'
    }
  }
  
  return markdown.trim()
}

function extractTitleFromNotebook(notebookData: NotebookData): string {
  // Try to find title in metadata
  if (notebookData.metadata?.title) {
    return notebookData.metadata.title
  }
  
  // Try to find title in first markdown cell
  for (const cell of notebookData.cells) {
    if (cell.cell_type === 'markdown') {
      const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source
      const titleMatch = source.match(/^#\s+(.+)$/m)
      if (titleMatch) {
        return titleMatch[1]
      }
    }
  }
  
  return 'Imported Jupyter Notebook'
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const visibility = formData.get('visibility') as string || 'PUBLIC'
    const organizationId = formData.get('organizationId') as string || null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!file.name.endsWith('.ipynb')) {
      return NextResponse.json(
        { error: 'File must be a Jupyter notebook (.ipynb)' },
        { status: 400 }
      )
    }

    // Read and parse the notebook file
    const fileContent = await file.text()
    let notebookData: NotebookData

    try {
      notebookData = JSON.parse(fileContent)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid notebook file format' },
        { status: 400 }
      )
    }

    // Validate notebook structure
    if (!notebookData.cells || !Array.isArray(notebookData.cells)) {
      return NextResponse.json(
        { error: 'Invalid notebook structure' },
        { status: 400 }
      )
    }

    // Convert notebook to markdown
    const markdownContent = convertNotebookToMarkdown(notebookData)
    const title = extractTitleFromNotebook(notebookData)

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

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true }
    })

    // Create blog from notebook
    const blog = await prisma.blog.create({
      data: {
        title,
        slug: finalSlug,
        content: markdownContent,
        excerpt: markdownContent.substring(0, 200) + '...',
        visibility: visibility as any,
        publishedAt: visibility === 'PUBLIC' ? new Date() : null,
        authorId: session.user.id,
        organizationId: organizationId || user?.organizationId,
        isNotebook: true,
        notebookData: notebookData as any,
        tags: ['jupyter', 'notebook']
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
    console.error('Error importing notebook:', error)
    return NextResponse.json(
      { error: 'Failed to import notebook' },
      { status: 500 }
    )
  }
}
