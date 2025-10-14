'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'
import CKEditor from '@/components/CKEditor'
import Header from '@/components/Header'

interface Blog {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  visibility: 'PUBLIC' | 'INTERNAL' | 'PRIVATE'
  publishedAt: string | null
  createdAt: string
  author: {
    id: string
    name: string
    email: string
    image: string | null
  }
  tags: string[]
  isNotebook: boolean
}

export default function EditBlogPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [blog, setBlog] = useState<Blog | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'INTERNAL' | 'PRIVATE'>('PUBLIC')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  const slug = params.slug as string

  useEffect(() => {
    fetchBlog()
  }, [slug])

  const fetchBlog = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/blogs/${slug}`)
      if (response.ok) {
        const data = await response.json()
        setBlog(data)
        setTitle(data.title)
        setContent(data.content)
        setExcerpt(data.excerpt || '')
        setVisibility(data.visibility)
        setTags(data.tags || [])
      } else if (response.status === 404) {
        router.push('/blogs')
      }
    } catch (error) {
      console.error('Error fetching blog:', error)
    } finally {
      setLoading(false)
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required')
      return
    }

    setSaving(true)
    
    try {
      const response = await fetch(`/api/blogs/${slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          content,
          excerpt,
          visibility,
          tags
        })
      })

      if (response.ok) {
        const updatedBlog = await response.json()
        toast.success('Blog updated successfully!')
        router.push(`/blogs/${updatedBlog.slug}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update blog')
      }
    } catch (error) {
      console.error('Error updating blog:', error)
      toast.error('Failed to update blog')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Blog not found</h3>
              <p className="text-gray-600 mb-4">The blog post you're looking for doesn't exist.</p>
              <Button onClick={() => router.push('/blogs')}>
                Back to Blogs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!session || session.user.id !== blog.author.id) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-gray-600 mb-4">You can only edit your own blog posts.</p>
              <Button onClick={() => router.push('/blogs')}>
                Back to Blogs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Blog Post</h1>
          <p className="text-gray-600 mt-2">Update your blog post content and settings</p>
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

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
      </div>
    </div>
  )
}
