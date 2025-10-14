import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

interface NotebookData {
  cells: Array<{
    cell_type: string
    source: string | string[]
    outputs?: any[]
    execution_count?: number
  }>
  metadata: any
}

function convertNotebookToHTML(notebookData: NotebookData): string {
  let html = ''
  
  for (const cell of notebookData.cells) {
    if (cell.cell_type === 'markdown') {
      const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source
      html += convertMarkdownToHTML(source) + '\n'
    } else if (cell.cell_type === 'code') {
      const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source
      
      // Add code block
      html += `<div class="code-block">
        <div class="code-header">
          <span class="code-language">Python</span>
          <span class="code-execution-count">In [${cell.execution_count || ' '}]:</span>
        </div>
        <pre><code class="language-python">${escapeHtml(source)}</code></pre>
      </div>`
      
      // Add outputs if they exist
      if (cell.outputs && cell.outputs.length > 0) {
        html += '<div class="output-block">'
        for (const output of cell.outputs) {
          if (output.output_type === 'stream') {
            html += `<div class="output-stream">
              <div class="output-header">Output</div>
              <pre><code>${escapeHtml(output.text || '')}</code></pre>
            </div>`
          } else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
            if (output.data && output.data['text/plain']) {
              html += `<div class="output-result">
                <div class="output-header">Out [${output.execution_count || ' '}]:</div>
                <pre><code>${escapeHtml(output.data['text/plain'])}</code></pre>
              </div>`
            }
          } else if (output.output_type === 'error') {
            html += `<div class="output-error">
              <div class="output-header">Error</div>
              <pre><code>Error: ${escapeHtml(output.ename || 'Unknown error')}
${escapeHtml(output.evalue || '')}</code></pre>
            </div>`
          }
        }
        html += '</div>'
      }
    } else if (cell.cell_type === 'raw') {
      const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source
      html += `<div class="raw-cell">${convertMarkdownToHTML(source)}</div>`
    }
  }
  
  return html
}

function convertMarkdownToHTML(markdown: string): string {
  return markdown
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^\- (.*$)/gm, '<li>• $1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|l|p])(.*$)/gm, '<p>$1</p>')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extractTitleFromNotebook(notebookData: NotebookData): string {
  if (notebookData.metadata?.title) {
    return notebookData.metadata.title
  }
  
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
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    console.log('Token check:', {
      hasToken: !!token,
      userId: token?.sub,
      userEmail: token?.email,
      tokenKeys: token ? Object.keys(token) : []
    })
    
    if (!token?.sub) {
      console.log('No token found for notebook import')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('Token found for user:', token.email)

    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Convert GitHub URL to raw URL
    let rawUrl = url
    if (url.includes('github.com')) {
      rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
    }

    console.log('Fetching notebook from:', rawUrl)

    // Fetch the notebook from GitHub
    const response = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Blog-Notebook-Importer/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch notebook: ${response.status} ${response.statusText}`)
    }

    const notebookData: NotebookData = await response.json()
    
    // Validate notebook structure
    if (!notebookData.cells || !Array.isArray(notebookData.cells)) {
      throw new Error('Invalid notebook structure')
    }

    // Convert notebook to HTML
    const htmlContent = convertNotebookToHTML(notebookData)
    const title = extractTitleFromNotebook(notebookData)

    console.log('Successfully imported notebook:', title)

    return NextResponse.json({
      title,
      content: htmlContent,
      success: true
    })
  } catch (error) {
    console.error('Error importing notebook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import notebook' },
      { status: 500 }
    )
  }
}
