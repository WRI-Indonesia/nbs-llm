'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, FileText, Users, Lock } from 'lucide-react'
import Header from '@/components/Header'

interface Blog {
  id: string
  title: string
  slug: string
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
  _count: {
    comments: number
  }
  tags: string[]
  isNotebook: boolean
}

interface BlogsResponse {
  blogs: Blog[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function BlogsPage() {
  const { data: session } = useSession()
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  const fetchBlogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      })
      
      if (search) params.append('search', search)
      if (visibility) params.append('visibility', visibility)
      // Organization filtering is handled server-side based on user's organization

      const response = await fetch(`/api/blogs?${params}`)
      if (response.ok) {
        const data: BlogsResponse = await response.json()
        setBlogs(data.blogs)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching blogs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBlogs()
  }, [page, search, visibility, session])

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
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Blog</h1>
            <p className="text-gray-600 mt-2">Share knowledge and insights with your team</p>
          </div>
        {session && (
          <Link href="/blogs/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Blog Post
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search blogs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={visibility || "all"} onValueChange={(value) => setVisibility(value === "all" ? "" : value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All visibility</SelectItem>
            <SelectItem value="PUBLIC">Public</SelectItem>
            <SelectItem value="INTERNAL">Internal</SelectItem>
            <SelectItem value="PRIVATE">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Blog List */}
      {loading ? (
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : blogs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No blogs found</h3>
            <p className="text-gray-600 mb-4">
              {search ? 'Try adjusting your search criteria' : 'Be the first to create a blog post'}
            </p>
            {session && (
              <Link href="/blogs/create">
                <Button>Create Your First Blog</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {blogs.map((blog) => (
            <Card key={blog.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">
                      <Link 
                        href={`/blogs/${blog.slug}`}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {blog.title}
                      </Link>
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>By {blog.author.name}</span>
                      <span>•</span>
                      <span>{formatDate(blog.publishedAt || blog.createdAt)}</span>
                      <span>•</span>
                      <span>{blog._count.comments} comments</span>
                      {blog.isNotebook && (
                        <>
                          <span>•</span>
                          <Badge variant="secondary">Jupyter</Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getVisibilityIcon(blog.visibility)}
                    <Badge variant="outline">
                      {getVisibilityLabel(blog.visibility)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">{blog.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {blog.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Link href={`/blogs/${blog.slug}`}>
                    <Button variant="outline" size="sm">
                      Read More
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center mt-8">
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="flex items-center px-4">
              Page {page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              disabled={page === pagination.pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
