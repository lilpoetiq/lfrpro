import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  const cfRay = request.headers.get('cf-ray') // Cloudflare request ID
  const isCloudflare = !!cfRay || request.headers.get('cf-connecting-ip') || request.headers.get('cf-visitor')
  
  // Check if request is from localhost (even without origin header)
  const isLocalhost = host && (
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    host.includes('0.0.0.0') ||
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:')
  )
  
  // Allow origins from lfrpro.com (with or without Cloudflare), localhost, and Cloudflare domains
  const isAllowedOrigin = origin && (
    origin.includes('lfrpro.com') || 
    origin.includes('localhost') || 
    origin.includes('127.0.0.1') ||
    origin.includes('0.0.0.0') ||
    origin.includes('cloudflare') ||
    origin.includes('workers.dev') ||
    // Allow same-origin requests (when origin matches host)
    (host && origin.includes(host.split(':')[0]))
  )
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 })
    if (isAllowedOrigin || isCloudflare || isLocalhost) {
      // Use origin if provided, otherwise use host for localhost, or allow Cloudflare origin
      const allowOrigin = origin || (isLocalhost ? `http://${host}` : (isCloudflare ? '*' : null))
      if (allowOrigin) {
        response.headers.set('Access-Control-Allow-Origin', allowOrigin === '*' ? '*' : allowOrigin)
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, CF-Ray, CF-Connecting-IP')
        response.headers.set('Access-Control-Allow-Credentials', allowOrigin === '*' ? 'false' : 'true')
        response.headers.set('Access-Control-Max-Age', '86400')
      }
    }
    return response
  }
  
  // Skip processing for static files and Next.js internal routes (but still add CORS if needed)
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/__nextjs') ||
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/maintenance')
  ) {
    const response = NextResponse.next()
    // Add CORS headers for Next.js devtools routes
    if (request.nextUrl.pathname.startsWith('/__nextjs')) {
      if (isAllowedOrigin || isCloudflare || isLocalhost) {
        const allowOrigin = origin || (isLocalhost ? `http://${host}` : (isCloudflare ? '*' : null))
        if (allowOrigin) {
          response.headers.set('Access-Control-Allow-Origin', allowOrigin === '*' ? '*' : allowOrigin)
          response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
          response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        }
      }
    }
    // Add Cloudflare headers for static files too
    if (isCloudflare) {
      response.headers.set('CF-Cache-Status', 'DYNAMIC')
    }
    return response
  }

  // Temporarily disabled maintenance check to avoid fetch issues
  // Maintenance mode can still be enabled manually by redirecting users
  // TODO: Implement maintenance check using a different method (e.g., environment variable or header)
  
  const response = NextResponse.next()
  
  // Add CORS headers for all routes (including API routes)
  if (isAllowedOrigin || isCloudflare || isLocalhost) {
    // Use origin if provided, otherwise use host for localhost, or allow Cloudflare origin
    const allowOrigin = origin || (isLocalhost ? `http://${host}` : (isCloudflare ? '*' : null))
    if (allowOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowOrigin === '*' ? '*' : allowOrigin)
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, CF-Ray, CF-Connecting-IP')
      response.headers.set('Access-Control-Allow-Credentials', allowOrigin === '*' ? 'false' : 'true')
    }
  }
  
  // Preserve Cloudflare headers
  if (isCloudflare) {
    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    if (cfConnectingIP) {
      response.headers.set('X-Forwarded-For', cfConnectingIP)
    }
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - maintenance (maintenance page itself)
     * Note: API routes and __nextjs routes are included to handle CORS
     */
    '/((?!_next/static|_next/image|favicon.ico|maintenance).*)',
  ],
}

