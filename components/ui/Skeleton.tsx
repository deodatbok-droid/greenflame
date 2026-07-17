/**
 * components/ui/Skeleton.tsx
 *
 * Composants de squelette de chargement réutilisables.
 * Usage :
 *   <Skeleton className="h-4 w-1/3" />              — bloc texte
 *   <Skeleton.Card />                                — carte standard
 *   <Skeleton.ProductGrid />                         — grille produits 2 colonnes
 *   <Skeleton.WalletCard />                          — carte portefeuille
 */

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
  )
}

Skeleton.Text = function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-gray-200 rounded-full"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

Skeleton.Card = function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-gray-200 rounded-full w-3/4" />
          <div className="h-2.5 bg-gray-200 rounded-full w-1/2" />
        </div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full w-full" />
      <div className="h-2 bg-gray-200 rounded-full w-4/5" />
    </div>
  )
}

Skeleton.ProductGrid = function SkeletonProductGrid({ cols = 2, rows = 3 }: { cols?: 1 | 2; rows?: number }) {
  return (
    <div className={`grid gap-3 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
          <div className="aspect-square bg-gray-200 sm:aspect-auto sm:h-20" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-gray-200 rounded-full w-4/5" />
            <div className="h-2.5 bg-gray-200 rounded-full w-1/2" />
            <div className="h-8 bg-gray-100 rounded-xl w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

Skeleton.WalletCard = function SkeletonWalletCard() {
  return (
    <div className="rounded-3xl bg-brand-800/50 p-5 space-y-4 animate-pulse">
      <div className="h-3 bg-white/20 rounded-full w-1/3" />
      <div className="h-10 bg-white/20 rounded-full w-2/3" />
      <div className="h-px bg-white/10" />
      <div className="flex gap-2.5">
        <div className="flex-1 h-10 bg-white/15 rounded-2xl" />
        <div className="flex-1 h-10 bg-white/15 rounded-2xl" />
      </div>
    </div>
  )
}

Skeleton.Row = function SkeletonRow({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-50 bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
          <div className="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-gray-200 rounded-full w-3/4" />
            <div className="h-2.5 bg-gray-200 rounded-full w-1/2" />
          </div>
          <div className="w-10 h-3 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export default Skeleton
