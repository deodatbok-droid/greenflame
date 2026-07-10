'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  href?: string       // lien fixe optionnel (sinon router.back())
  label?: string      // texte du bouton
  className?: string
}

export default function BackButton({ href, label = 'Retour', className = '' }: BackButtonProps) {
  const router = useRouter()

  return (
    <button
      onClick={() => href ? router.push(href) : router.back()}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white/80 hover:bg-white rounded-lg px-2.5 py-1.5 transition-colors shadow-sm ${className}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
      </svg>
      {label}
    </button>
  )
}
