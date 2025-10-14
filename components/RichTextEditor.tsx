'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Link, 
  Image, 
  Upload,
  ExternalLink,
  FileText,
  X,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

interface NotebookData {
  cells: Array<{
    cell_type: string
    source: string | string[]
    outputs?: any[]
    execution_count?: number
  }>
  metadata: any
}

export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [isPreview, setIsPreview] = useState(false)
  const [showNotebookModal, setShowNotebookModal] = useState(false)
  const [notebookUrl, setNotebookUrl] = useState('')
  const [loadingNotebook, setLoadingNotebook] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end)
    
    onChange(newText)
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newText = value.substring(0, start) + text + value.substring(end)
    
    onChange(newText)
    
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }

  const handleImageUpload = async (file: File) => {
    try {
      toast.loading('Uploading image...')
      
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/blogs/upload-image', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        insertAtCursor(`![${file.name}](${result.url})\n\n`)
        toast.success('Image uploaded successfully!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to upload image')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Failed to upload image')
    }
  }

  const handleNotebookImport = async () => {
    if (!notebookUrl.trim()) {
      toast.error('Please enter a GitHub URL')
      return
    }

    setLoadingNotebook(true)
    try {
      // Convert GitHub URL to raw URL
      let rawUrl = notebookUrl
      if (notebookUrl.includes('github.com')) {
        rawUrl = notebookUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
      }

      const response = await fetch(rawUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch notebook')
      }

      const notebookData: NotebookData = await response.json()
      
      // Convert notebook to markdown
      let markdown = `# ${extractTitleFromNotebook(notebookData)}\n\n`
      
      for (const cell of notebookData.cells) {
        if (cell.cell_type === 'markdown') {
          const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source
          markdown += source + '\n\n'
        } else if (cell.cell_type === 'code') {
          const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source
          markdown += '```python\n' + source + '\n```\n\n'
          
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
        }
      }

      onChange(value + '\n\n' + markdown)
      setShowNotebookModal(false)
      setNotebookUrl('')
      toast.success('Notebook imported successfully!')
    } catch (error) {
      console.error('Error importing notebook:', error)
      toast.error('Failed to import notebook from URL')
    } finally {
      setLoadingNotebook(false)
    }
  }

  const extractTitleFromNotebook = (notebookData: NotebookData): string => {
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

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/```python\n([\s\S]*?)\n```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto"><code class="text-sm">$1</code></pre>')
      .replace(/```\n([\s\S]*?)\n```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto"><code class="text-sm">$1</code></pre>')
      .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4" />')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>')
      .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mb-4">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mb-3">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold mb-2">$1</h3>')
      .replace(/^\- (.*$)/gm, '<li class="ml-4">• $1</li>')
      .replace(/^\d+\. (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/^(?!<[h|l|p|i|a|c|p])(.*$)/gm, '<p class="mb-4">$1</p>')
  }

  return (
    <div className={className}>
      {/* Toolbar */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('**', '**')}
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('*', '*')}
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('`', '`')}
                title="Code"
              >
                <Code className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('# ')}
                title="Heading"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('> ')}
                title="Quote"
              >
                <Quote className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('- ')}
                title="Bullet List"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('1. ')}
                title="Numbered List"
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('[', '](url)')}
                title="Link"
              >
                <Link className="h-4 w-4" />
              </Button>
              <label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageUpload(file)
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title="Upload Image"
                >
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image className="h-4 w-4" />
                </Button>
              </label>
            </div>

            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNotebookModal(true)}
                title="Import Jupyter Notebook"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={isPreview ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
                title="Toggle Preview"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      {isPreview ? (
        <Card>
          <CardContent className="p-6">
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
            />
          </CardContent>
        </Card>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={15}
          className="font-mono text-sm"
        />
      )}

      {/* Notebook Import Modal */}
      {showNotebookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Import Jupyter Notebook</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotebookModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    GitHub URL
                  </label>
                  <input
                    type="url"
                    value={notebookUrl}
                    onChange={(e) => setNotebookUrl(e.target.value)}
                    placeholder="https://github.com/user/repo/blob/main/notebook.ipynb"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleNotebookImport}
                    disabled={loadingNotebook}
                    className="flex-1"
                  >
                    {loadingNotebook ? 'Importing...' : 'Import Notebook'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNotebookModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
