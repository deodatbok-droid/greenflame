/**
 * components/ui/SectionHeader.tsx
 *
 * Titre de section + sous-titre éducatif optionnel + action optionnelle.
 *
 * Usage :
 *   <SectionHeader title="Mes Flammes" hint="Chaque achat t'en rapporte." />
 *   <SectionHeader title="Objectifs" hint="…" action={{ label: '+ Nouveau', onClick: openModal }} />
 */

interface SectionHeaderAction {
  label: string
  onClick?: () => void
  href?: string
}

interface SectionHeaderProps {
  title: string
  hint?: string
  action?: SectionHeaderAction
  className?: string
}

import Link from 'next/link'

export function SectionHeader({ title, hint, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-2 ${className}`}>
      <div className="flex-1 min-w-0">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none">
          {title}
        </h2>
        {hint && (
          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{hint}</p>
        )}
      </div>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="text-xs font-semibold text-brand-600 flex-shrink-0 hover:text-brand-700 transition-colors"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="text-xs font-semibold text-brand-600 flex-shrink-0 hover:text-brand-700 transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}

export default SectionHeader
