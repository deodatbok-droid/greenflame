import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  // Referral code optionally passed in the redirectTo URL via register page
  const ref  = searchParams.get('ref') ?? ''

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Check if the user already has a profile in our users table
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (!profile) {
          // New user via Google — redirect to profile completion page
          const completeParams = new URLSearchParams()
          if (ref) completeParams.set('ref', ref)
          if (next !== '/dashboard') completeParams.set('next', next)
          const qs = completeParams.toString()
          return NextResponse.redirect(`${origin}/complete-profile${qs ? `?${qs}` : ''}`)
        }
      }
      // Existing user — go to intended destination
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}
