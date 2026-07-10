'use client'

import { createClient } from '@/lib/supabase/client'

interface Props {
  /** onDark : texte clair pour fond vert (page profil)
   *  onLight : texte visible pour fond blanc (dashboard) */
  variant?: 'onDark' | 'onLight'
}

export default function SignOutButton({ variant = 'onDark' }: Props) {
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const cls =
    variant === 'onLight'
      ? 'text-xs font-medium text-gray-500 border border-gray-200 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors px-3 py-1.5 rounded-lg'
      : 'text-xs text-brand-200 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10'

  return (
    <button onClick={handleSignOut} className={cls}>
      Déconnexion
    </button>
  )
}
