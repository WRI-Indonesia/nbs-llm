import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Protected routes that require authentication
const protectedRoutes = [
  '/schemas',
  '/profile',
  '/blogs',
  '/api/schemas',
  '/api/user',
  '/api/organizations',
  '/api/blogs'
]

// Routes that don't require verification
const publicRoutes = [
  '/',
  '/docs',
  '/playground',
  '/api/auth',
  '/auth'
]

// Blog routes that should be public (viewing public blogs)
const publicBlogRoutes = [
  '/api/blogs$', // GET /api/blogs (list public blogs)
  '/api/blogs/[^/]+$' // GET /api/blogs/[slug] (view specific blog)
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check if it's a public blog route (GET requests to view blogs)
  const isPublicBlogRoute = publicBlogRoutes.some(route => {
    const regex = new RegExp(route.replace(/\[.*?\]/g, '[^/]+'))
    return regex.test(pathname) && request.method === 'GET'
  })

  if (isPublicBlogRoute) {
    return NextResponse.next()
  }

  // Check if it's a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  try {
    // Get token (works in edge runtime)
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.sub) {
      // Redirect to home if not authenticated
      return NextResponse.redirect(new URL('/', request.url))
    }

    // For now, we'll skip email verification check in middleware
    // since we can't access the database in edge runtime
    // Email verification will be handled at the page level
    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}