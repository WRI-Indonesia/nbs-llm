import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // For protected paths (like /schemas), check authentication
  if (pathname.startsWith('/schemas')) {
    // Check if user has a session token
    const sessionToken = request.cookies.get('next-auth.session-token') || 
                        request.cookies.get('__Secure-next-auth.session-token')
    
    if (!sessionToken) {
      // Redirect to home for non-authenticated users
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
