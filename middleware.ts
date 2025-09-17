import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  // Allow access to auth pages for unauthenticated users
  if (!session && !pathname.startsWith('/auth')) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/auth'
    return NextResponse.redirect(redirectUrl)
  }

  // Handle authenticated users
  if (session) {
    // Check if email is confirmed
    const isConfirmed = !!session.user.email_confirmed_at

    if (!isConfirmed) {
      // Allow access to auth pages for unconfirmed users
      if (!pathname.startsWith('/auth')) {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/auth/confirm'
        return NextResponse.redirect(redirectUrl)
      }
      return response
    }

    // For confirmed users, check organization membership
    // Use a simple approach to avoid RLS issues in middleware
    const { data: userOrgs } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .limit(1)

    const hasOrganization = userOrgs && userOrgs.length > 0

    // Confirmed user without organization should go to org creation
    if (!hasOrganization) {
      if (pathname !== '/onboarding/create-organization' && !pathname.startsWith('/auth')) {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/onboarding/create-organization'
        return NextResponse.redirect(redirectUrl)
      }
    }

    // Confirmed user with organization trying to access auth or onboarding
    if (hasOrganization && (pathname.startsWith('/auth') || pathname.startsWith('/onboarding'))) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
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
