import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { locales, defaultLocale, type Locale } from '@/lib/i18n'

// ─── Configuration des limites par route API ────────────────────────────────
// Format : [limite de requêtes, fenêtre en millisecondes]
const API_RATE_LIMITS: Record<string, [number, number]> = {
  '/api/transactions':     [5,  60_000],  // 5 transactions/min (financier critique)
  '/api/wallets/withdraw': [3,  60_000],  // 3 retraits/min (financier critique)
  '/api/buyer/lookup':     [20, 60_000],  // 20 recherches/min (marchands)
  '/api/wallets':          [30, 60_000],  // 30 lectures wallet/min
  '/api/referral':         [10, 60_000],  // 10 vérifications code/min
  '/api/auth':             [10, 60_000],  // 10 tentatives auth/min
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function middleware(request: NextRequest) {
  const rawPathname = request.nextUrl.pathname

  // ─── Locale extraction ─────────────────────────────────────────────────────
  // Detect locale from URL prefix: /en/... → locale='en', strip prefix internally
  const segments = rawPathname.split('/').filter(Boolean)
  const maybeLocale = segments[0] as Locale
  const hasLocalePrefix = locales.includes(maybeLocale)
  const locale: Locale = hasLocalePrefix ? maybeLocale : defaultLocale
  // Internal pathname used for routing and auth guards (without locale prefix)
  const pathname = hasLocalePrefix
    ? '/' + segments.slice(1).join('/') || '/'
    : rawPathname

  // ─── Rate limiting API (avant toute logique auth) ──────────────────────────
  // Use rawPathname for API routes — locale prefix never appears on /api/ routes
  const matchedRoute = Object.keys(API_RATE_LIMITS).find(p => rawPathname.startsWith(p))
  if (matchedRoute) {
    const [limit, windowMs] = API_RATE_LIMITS[matchedRoute]
    const ip  = getClientIp(request)
    const key = `rl:${ip}:${matchedRoute}`
    const result = checkRateLimit(key, limit, windowMs)

    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
          resetIn: result.resetIn,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.resetIn),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + result.resetIn),
          },
        }
      )
    }
  }

  // Inject pathname + locale into request headers for server components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  requestHeaders.set('x-locale', locale)

  // If there's a locale prefix, we rewrite internally to the prefix-stripped path
  const needsRewrite = hasLocalePrefix && pathname !== rawPathname
  const rewriteUrl = request.nextUrl.clone()
  if (needsRewrite) rewriteUrl.pathname = pathname

  let supabaseResponse = needsRewrite
    ? NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Preserve our custom headers and rewrite when recreating the response
          supabaseResponse = needsRewrite
            ? NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
            : NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Routes protégées
  const protectedPaths = [
    '/dashboard',
    '/pay',
    '/history',
    '/network',
    '/wallet',
    '/merchant',
    '/admin',
  ]

  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = locale === defaultLocale ? '/login' : `/${locale}/login`
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
