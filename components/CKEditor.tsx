'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Bold, 
  Italic, 
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
  Eye,
  EyeOff,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Save
} from 'lucide-react'
import { toast } from 'sonner'

interface CKEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function CKEditor({ value, onChange, placeholder, className }: CKEditorProps) {
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
        insertAtCursor(`<img src="${result.url}" alt="${file.name}" style="max-width: 100%; height: auto;" />`)
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
      toast.loading('Importing notebook...')
      
      const response = await fetch('/api/blogs/import-notebook-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ url: notebookUrl })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Insert the HTML content into the editor
        const htmlContent = `
<div class="notebook-import">
  <h2>${result.title}</h2>
  ${result.content}
</div>
        `
        
        insertAtCursor(htmlContent)
        setShowNotebookModal(false)
        setNotebookUrl('')
        toast.success(`Notebook "${result.title}" imported successfully!`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to import notebook')
        console.error('Import error:', error)
      }
    } catch (error) {
      console.error('Error importing notebook:', error)
      toast.error('Failed to import notebook from URL. Please check the URL and try again.')
    } finally {
      setLoadingNotebook(false)
    }
  }

  const renderHTML = (html: string) => {
    return html
  }

  return (
    <div className={className}>
      {/* CKEditor-like Toolbar */}
      <Card className="mb-4 border-2">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1 items-center">
            {/* Text Formatting */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<strong>', '</strong>')}
                title="Bold"
                className="h-8 w-8 p-0"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<em>', '</em>')}
                title="Italic"
                className="h-8 w-8 p-0"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<code>', '</code>')}
                title="Code"
                className="h-8 w-8 p-0"
              >
                <Code className="h-4 w-4" />
              </Button>
            </div>

            {/* Headings */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<h1>', '</h1>')}
                title="Heading 1"
                className="h-8 w-8 p-0"
              >
                <Heading1 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<h2>', '</h2>')}
                title="Heading 2"
                className="h-8 w-8 p-0"
              >
                <Heading2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<h3>', '</h3>')}
                title="Heading 3"
                className="h-8 w-8 p-0"
              >
                <Heading3 className="h-4 w-4" />
              </Button>
            </div>

            {/* Lists and Quotes */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<ul><li>', '</li></ul>')}
                title="Bullet List"
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<ol><li>', '</li></ol>')}
                title="Numbered List"
                className="h-8 w-8 p-0"
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<blockquote>', '</blockquote>')}
                title="Quote"
                className="h-8 w-8 p-0"
              >
                <Quote className="h-4 w-4" />
              </Button>
            </div>

            {/* Links and Images */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<a href="url">', '</a>')}
                title="Link"
                className="h-8 w-8 p-0"
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
                  className="h-8 w-8 p-0"
                >
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image className="h-4 w-4" />
                </Button>
              </label>
            </div>

            {/* Special Features */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertText('<p>', '</p>')}
                title="Paragraph"
                className="h-8 w-8 p-0"
              >
                <Type className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNotebookModal(true)}
                title="Import Jupyter Notebook"
                className="h-8 w-8 p-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            {/* Preview Toggle */}
            <div className="flex gap-1">
              <Button
                type="button"
                variant={isPreview ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
                title="Toggle Preview"
                className="h-8 w-8 p-0"
              >
                {isPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor Area */}
      {isPreview ? (
        <Card className="border-2">
          <CardContent className="p-6 min-h-[400px]">
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: renderHTML(value) }}
            />
          </CardContent>
        </Card>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={20}
          className="font-mono text-sm border-2 min-h-[400px]"
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
                  <p className="text-xs text-gray-500 mt-1">
                    Example: https://github.com/jupyter/notebook/blob/main/docs/source/examples/Notebook/Working%20With%20Markdown%20Cells.ipynb
                  </p>
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

      {/* Custom CSS for notebook rendering */}
      <style jsx>{`
        .notebook-import {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          background-color: #f9fafb;
        }
        
        .code-block {
          margin: 16px 0;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .code-header {
          background-color: #f3f4f6;
          padding: 8px 12px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #6b7280;
        }
        
        .code-block pre {
          margin: 0;
          padding: 12px;
          background-color: #1f2937;
          color: #f9fafb;
          overflow-x: auto;
        }
        
        .output-block {
          margin: 8px 0;
        }
        
        .output-header {
          background-color: #f3f4f6;
          padding: 4px 8px;
          font-size: 12px;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .output-stream pre,
        .output-result pre,
        .output-error pre {
          margin: 0;
          padding: 8px;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          overflow-x: auto;
        }
        
        .output-error {
          border-left: 4px solid #ef4444;
        }
        
        .raw-cell {
          background-color: #f9fafb;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          margin: 8px 0;
        }
      `}</style>
    </div>
  )
}
