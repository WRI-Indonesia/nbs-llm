'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Upload, X, Save, Eye } from 'lucide-react'
import { toast } from 'sonner'
import CKEditor from '@/components/CKEditor'
import Header from '@/components/Header'

export default function CreateBlogPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'INTERNAL' | 'PRIVATE'>('PUBLIC')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [isNotebook, setIsNotebook] = useState(false)
  const [notebookFile, setNotebookFile] = useState<File | null>(null)

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
              <p className="text-gray-600">Please sign in to create a blog post.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleNotebookUpload = async (file: File) => {
    if (!file.name.endsWith('.ipynb')) {
      toast.error('Please select a valid Jupyter notebook file (.ipynb)')
      return
    }

    setNotebookFile(file)
    setIsNotebook(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('visibility', visibility)

      const response = await fetch('/api/blogs/import-notebook', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const blog = await response.json()
        toast.success('Notebook imported successfully!')
        router.push(`/blogs/${blog.slug}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to import notebook')
      }
    } catch (error) {
      console.error('Error importing notebook:', error)
      toast.error('Failed to import notebook')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required')
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/blogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          content,
          excerpt,
          visibility,
          tags,
          isNotebook,
          notebookData: null
        })
      })

      if (response.ok) {
        const blog = await response.json()
        toast.success('Blog created successfully!')
        router.push(`/blogs/${blog.slug}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create blog')
      }
    } catch (error) {
      console.error('Error creating blog:', error)
      toast.error('Failed to create blog')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Create New Blog Post</h1>
          <p className="text-gray-600 mt-2">Share your knowledge and insights</p>
        </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-2">
                  Title *
                </label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter blog title..."
                  required
                />
              </div>

              <div>
                <label htmlFor="excerpt" className="block text-sm font-medium mb-2">
                  Excerpt
                </label>
                <Textarea
                  id="excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Brief description of your blog post..."
                  rows={3}
                />
              </div>

              <div>
                <label htmlFor="visibility" className="block text-sm font-medium mb-2">
                  Visibility
                </label>
                <Select value={visibility} onValueChange={(value: any) => setVisibility(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public - Anyone can see</SelectItem>
                    <SelectItem value="INTERNAL">Internal - Organization members only</SelectItem>
                    <SelectItem value="PRIVATE">Private - Specific users only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent>
              <CKEditor
                value={content}
                onChange={setContent}
                placeholder="Write your blog post content here... (HTML supported)"
              />
            </CardContent>
          </Card>

          {/* Jupyter Notebook Import */}
          <Card>
            <CardHeader>
              <CardTitle>Import Jupyter Notebook</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  Upload a Jupyter notebook (.ipynb) to automatically create a blog post
                </p>
                <input
                  type="file"
                  accept=".ipynb"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleNotebookUpload(file)
                    }
                  }}
                  className="hidden"
                  id="notebook-upload"
                />
                <label htmlFor="notebook-upload">
                  <Button type="button" variant="outline" asChild>
                    <span>Choose Notebook File</span>
                  </Button>
                </label>
              </div>
              {notebookFile && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Selected: {notebookFile.name}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Blog Post'}
            </Button>
          </div>
        </div>
      </form>
      </div>
    </div>
  )
}
