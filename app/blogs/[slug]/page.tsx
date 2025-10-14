'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { 
  Edit, 
  Trash2, 
  MessageCircle, 
  Users, 
  Lock, 
  FileText, 
  Calendar,
  User,
  Reply,
  MoreHorizontal
} from 'lucide-react'
import { toast } from 'sonner'
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
  organization: {
    id: string
    name: string
    slug: string
  } | null
  comments: Comment[]
  blogAccess: Array<{
    user: {
      id: string
      name: string
      email: string
      image: string | null
    }
  }>
  tags: string[]
  isNotebook: boolean
}

interface Comment {
  id: string
  content: string
  createdAt: string
  author: {
    id: string
    name: string
    email: string
    image: string | null
  }
  replies: Comment[]
}

export default function BlogPostPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const [blog, setBlog] = useState<Blog | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentContent, setCommentContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showAccessDialog, setShowAccessDialog] = useState(false)
  const [accessEmail, setAccessEmail] = useState('')

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
      } else if (response.status === 404) {
        router.push('/blogs')
      }
    } catch (error) {
      console.error('Error fetching blog:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!commentContent.trim()) {
      toast.error('Comment cannot be empty')
      return
    }

    setSubmittingComment(true)
    
    try {
      const response = await fetch('/api/blogs/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: commentContent,
          blogSlug: slug
        })
      })

      if (response.ok) {
        setCommentContent('')
        toast.success('Comment added successfully!')
        fetchBlog() // Refresh to show new comment
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add comment')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleReplySubmit = async (parentId: string) => {
    if (!replyContent.trim()) {
      toast.error('Reply cannot be empty')
      return
    }

    setSubmittingComment(true)
    
    try {
      const response = await fetch('/api/blogs/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: replyContent,
          blogSlug: slug,
          parentId
        })
      })

      if (response.ok) {
        setReplyContent('')
        setReplyingTo(null)
        toast.success('Reply added successfully!')
        fetchBlog() // Refresh to show new reply
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add reply')
      }
    } catch (error) {
      console.error('Error adding reply:', error)
      toast.error('Failed to add reply')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteBlog = async () => {
    if (!confirm('Are you sure you want to delete this blog post?')) {
      return
    }

    try {
      const response = await fetch(`/api/blogs/${slug}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Blog post deleted successfully!')
        router.push('/blogs')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete blog post')
      }
    } catch (error) {
      console.error('Error deleting blog:', error)
      toast.error('Failed to delete blog post')
    }
  }

  const handleAddAccess = async () => {
    if (!accessEmail.trim()) {
      toast.error('Email is required')
      return
    }

    try {
      // First, find user by email
      const userResponse = await fetch(`/api/user/profile?email=${accessEmail}`)
      if (!userResponse.ok) {
        toast.error('User not found')
        return
      }

      const user = await userResponse.json()
      
      const response = await fetch('/api/blogs/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          blogSlug: slug,
          userId: user.id
        })
      })

      if (response.ok) {
        setAccessEmail('')
        setShowAccessDialog(false)
        toast.success('Access granted successfully!')
        fetchBlog() // Refresh to show new access
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to grant access')
      }
    } catch (error) {
      console.error('Error adding access:', error)
      toast.error('Failed to grant access')
    }
  }

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return <FileText className="h-4 w-4 text-green-600" />
      case 'INTERNAL':
        return <Users className="h-4 w-4 text-blue-600" />
      case 'PRIVATE':
        return <Lock className="h-4 w-4 text-red-600" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return 'Public'
      case 'INTERNAL':
        return 'Internal'
      case 'PRIVATE':
        return 'Private'
      default:
        return visibility
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
              <Link href="/blogs">
                <Button>Back to Blogs</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const isAuthor = session?.user?.id === blog.author.id
  const canEdit = isAuthor

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
            <h1 className="text-4xl font-bold mb-4">{blog.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{blog.author.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(blog.publishedAt || blog.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>{blog.comments.length} comments</span>
              </div>
              {blog.isNotebook && (
                <Badge variant="secondary">Jupyter Notebook</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getVisibilityIcon(blog.visibility)}
            <Badge variant="outline">
              {getVisibilityLabel(blog.visibility)}
            </Badge>
            {canEdit && (
              <div className="flex gap-2">
                <Link href={`/blogs/${blog.slug}/edit`}>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDeleteBlog}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {blog.visibility === 'PRIVATE' && (
                  <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Users className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Manage Blog Access</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Grant access to user
                          </label>
                          <div className="flex gap-2">
                            <Input
                              value={accessEmail}
                              onChange={(e) => setAccessEmail(e.target.value)}
                              placeholder="Enter user email..."
                              type="email"
                            />
                            <Button onClick={handleAddAccess}>
                              Add
                            </Button>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Current Access</h4>
                          <div className="space-y-2">
                            {blog.blogAccess.map((access) => (
                              <div key={access.user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span>{access.user.name} ({access.user.email})</span>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await fetch('/api/blogs/access', {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          blogSlug: slug,
                                          userId: access.user.id
                                        })
                                      })
                                      fetchBlog()
                                    } catch (error) {
                                      console.error('Error removing access:', error)
                                    }
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {blog.tags.length > 0 && (
          <div className="flex gap-2 mb-6">
            {blog.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <Card className="mb-8">
        <CardContent className="prose max-w-none py-8">
          <div 
            dangerouslySetInnerHTML={{ 
              __html: blog.content
            }}
          />
        </CardContent>
      </Card>

      {/* Custom CSS for notebook rendering */}
      <style jsx global>{`
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

      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Comments ({blog.comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Add Comment Form */}
          {session ? (
            <form onSubmit={handleCommentSubmit} className="mb-6">
              <Textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="mb-4"
              />
              <Button type="submit" disabled={submittingComment}>
                {submittingComment ? 'Posting...' : 'Post Comment'}
              </Button>
            </form>
          ) : (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-gray-600">Please sign in to leave a comment.</p>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-6">
            {blog.comments.map((comment) => (
              <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{comment.author.name}</span>
                    <span className="text-sm text-gray-500">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                </div>
                <p className="text-gray-700 mb-3">{comment.content}</p>
                
                {/* Reply Button */}
                {session && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                )}

                {/* Reply Form */}
                {replyingTo === comment.id && (
                  <div className="mt-3 ml-4">
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write a reply..."
                      rows={2}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleReplySubmit(comment.id)}
                        disabled={submittingComment}
                      >
                        {submittingComment ? 'Posting...' : 'Post Reply'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReplyingTo(null)
                          setReplyContent('')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {comment.replies.length > 0 && (
                  <div className="mt-4 ml-4 space-y-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="border-l-2 border-gray-100 pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">{reply.author.name}</span>
                          <span className="text-xs text-gray-500">
                            {formatDate(reply.createdAt)}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {blog.comments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No comments yet. Be the first to comment!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
