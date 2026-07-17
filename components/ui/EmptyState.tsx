/**
 * components/ui/EmptyState.tsx
 *
 * États vides illustrés réutilisables.
 *
 * Usage :
 *   <EmptyState.Cart />
 *   <EmptyState.Messages />
 *   <EmptyState.Products />
 *   <EmptyState icon="🔍" title="Aucun résultat" desc="..." action={...} />
 */

import type { ReactNode } from 'react'
import Link from 'next/link'

// ─── SVG ILLUSTRATIONS LÉGÈRES ────────────────────────────────────────────────

function Circle({ children, color = 'bg-gray-100' }: { children: ReactNode; color?: string }) {
  return (
    <div className={`w-20 h-20 mx-auto mb-4 rounded-full ${color} flex items-center justify-center`}>
      <span className="text-4xl leading-none">{children}</span>
    </div>
  )
}

interface EmptyProps {
  icon: string
  iconBg?: string
  title: string
  desc?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export function EmptyState({ icon, iconBg, title, desc, action }: EmptyProps) {
  return (
    <div className="text-center py-14 px-4">
      <Circle color={iconBg}>{icon}</Circle>
      <p className="font-bold text-gray-700 text-lg">{title}</p>
      {desc && <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">{desc}</p>}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-block bg-brand-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-brand-700 transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="bg-brand-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-brand-700 transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ÉTATS PRÉDÉFINIS ─────────────────────────────────────────────────────────

EmptyState.Cart = function EmptyCart() {
  return (
    <EmptyState
      icon="🛒"
      iconBg="bg-brand-50"
      title="Panier vide"
      desc="Ajoutez des produits depuis le Marché pour les retrouver ici."
      action={{ label: 'Découvrir le Marché →', href: '/marketplace' }}
    />
  )
}

EmptyState.Messages = function EmptyMessages() {
  return (
    <EmptyState
      icon="💬"
      iconBg="bg-blue-50"
      title="Aucune conversation"
      desc="Rejoignez votre cercle communautaire ou contactez un membre de la plateforme."
    />
  )
}

EmptyState.Products = function EmptyProducts() {
  return (
    <EmptyState
      icon="🛍️"
      iconBg="bg-brand-50"
      title="Aucun produit disponible"
      desc="Cette boutique n'a pas encore ajouté de produits."
    />
  )
}

EmptyState.Orders = function EmptyOrders() {
  return (
    <EmptyState
      icon="📦"
      iconBg="bg-amber-50"
      title="Aucune commande"
      desc="Vos achats apparaîtront ici une fois validés."
      action={{ label: 'Faire mes premiers achats →', href: '/marketplace' }}
    />
  )
}

EmptyState.Search = function EmptySearch({ query }: { query?: string }) {
  return (
    <EmptyState
      icon="🔍"
      iconBg="bg-gray-100"
      title={query ? `Aucun résultat pour « ${query} »` : 'Aucun résultat'}
      desc="Essayez un autre terme ou vérifiez l'orthographe."
    />
  )
}

EmptyState.Network = function EmptyNetwork() {
  return (
    <EmptyState
      icon="👥"
      iconBg="bg-green-50"
      title="Ta communauté t'attend"
      desc="Ta communauté se construit dès le premier onboarding que tu fais. Partage ton lien d'invitation."
    />
  )
}

EmptyState.Budget = function EmptyBudget() {
  return (
    <EmptyState
      icon="📊"
      iconBg="bg-emerald-50"
      title="Aucune dépense ce mois"
      desc="Appuie sur ⊕ pour enregistrer une dépense ou un revenu. Ton bilan se met à jour en temps réel."
    />
  )
}

EmptyState.Goals = function EmptyGoals() {
  return (
    <EmptyState
      icon="🎯"
      iconBg="bg-amber-50"
      title="Pas encore d'objectif d'épargne"
      desc="Crée un objectif — scolarité, logement, fonds d'urgence — et suis ta progression mois par mois."
    />
  )
}

EmptyState.Tontines = function EmptyTontines() {
  return (
    <EmptyState
      icon="🤝"
      iconBg="bg-brand-50"
      title="Aucune tontine active"
      desc="Une tontine, c'est un groupe d'épargne rotatif : chaque mois, un membre reçoit la mise collective. Crée le tien ou rejoins un groupe existant."
      action={{ label: 'Créer une tontine', href: '/tontine' }}
    />
  )
}

EmptyState.Transactions = function EmptyTransactions() {
  return (
    <EmptyState
      icon="💳"
      iconBg="bg-blue-50"
      title="Aucune transaction"
      desc="Tes paiements chez les marchands GreenFlame apparaîtront ici, avec ton cashback associé."
      action={{ label: 'Payer chez un marchand', href: '/pay' }}
    />
  )
}

EmptyState.Flammes = function EmptyFlammes() {
  return (
    <EmptyState
      icon="🔥"
      iconBg="bg-orange-50"
      title="Pas encore de Flammes"
      desc="Effectuez votre premier achat pour commencer à accumuler des Flammes."
      action={{ label: 'Faire un achat →', href: '/marketplace' }}
    />
  )
}

export default EmptyState
