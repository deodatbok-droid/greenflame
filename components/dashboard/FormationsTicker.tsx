'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

export interface MiniFormation {
  id: string
  name: string
  description: string
  price_fcfa: number
  emoji: string
  href?: string
  badge?: string
  ctaLabel?: string
}

// Gradients sombres par index — adapté marque GreenFlame
const CARD_GRADIENTS = [
  'linear-gradient(145deg, #14532d 0%, #166534 60%, #15803d 100%)',
  'linear-gradient(145deg, #7c2d12 0%, #9a3412 60%, #c2410c 100%)',
  'linear-gradient(145deg, #1e3a5f 0%, #1d4ed8 60%, #2563eb 100%)',
  'linear-gradient(145deg, #4a1d96 0%, #6d28d9 60%, #7c3aed 100%)',
]

interface FormationsTickerProps {
  products: MiniFormation[]
}

export default function FormationsTicker({ products }: FormationsTickerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)
  const startTimeRef = useRef(Date.now())
  const DURATION = 6000

  const goTo = useCallback(
    (index: number) => {
      if (index === activeIndex || isTransitioning) return
      setIsTransitioning(true)
      setProgress(0)
      startTimeRef.current = Date.now()
      setTimeout(() => {
        setActiveIndex(index)
        setIsTransitioning(false)
      }, 280)
    },
    [activeIndex, isTransitioning],
  )

  const next = useCallback(
    () => goTo((activeIndex + 1) % products.length),
    [activeIndex, goTo, products.length],
  )
  const prev = useCallback(
    () => goTo((activeIndex - 1 + products.length) % products.length),
    [activeIndex, goTo, products.length],
  )

  // Barre de progression + avance automatique
  useEffect(() => {
    if (products.length <= 1) return
    startTimeRef.current = Date.now()

    const id = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const pct = Math.min((elapsed / DURATION) * 100, 100)
      setProgress(pct)

      if (elapsed >= DURATION) {
        startTimeRef.current = Date.now()
        setProgress(0)
        setIsTransitioning(true)
        setTimeout(() => {
          setActiveIndex(prev => (prev + 1) % products.length)
          setIsTransitioning(false)
        }, 280)
      }
    }, 50)

    return () => clearInterval(id)
  }, [products.length])

  if (products.length === 0) return null

  const current = products[activeIndex]
  const gradient = CARD_GRADIENTS[activeIndex % CARD_GRADIENTS.length]
  const isReversed = activeIndex % 2 === 1

  return (
    <div
      className="card-dark rounded-2xl overflow-hidden"
      style={{ background: gradient }}
    >
      {/* Barre de progression */}
      <div className="h-0.5 bg-white/20">
        <div
          className="h-full bg-white/50 rounded-full"
          style={{ width: `${progress}%`, transition: 'width 50ms linear' }}
        />
      </div>

      {/* Corps — layout horizontal 1/3 icône + 2/3 texte, alternance gauche/droite */}
      <div
        className="p-4 transition-opacity duration-300"
        style={{ opacity: isTransitioning ? 0 : 1 }}
      >
        <div className={`flex items-center gap-4 ${isReversed ? 'flex-row-reverse' : ''}`}>

          {/* Icône — 1/3 */}
          <div className="w-1/3 flex-shrink-0 flex items-center justify-center py-3">
            <span className="text-6xl leading-none select-none" aria-hidden>
              {current.emoji}
            </span>
          </div>

          {/* Texte — 2/3 */}
          <div className="flex-1 min-w-0 py-1">
            <span className="text-[9px] font-bold tracking-widest uppercase text-white/55 block mb-1">
              {current.badge ?? '✨ Mini-formation'}
            </span>
            <h3 className="text-white font-bold text-sm leading-snug mb-1.5">
              {current.name}
            </h3>
            <p
              className="text-white/65 text-[11px] leading-relaxed mb-3"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {current.description}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="bg-white/15 text-white text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                {current.price_fcfa.toLocaleString('fr-FR')} F
              </span>
              <Link href={current.href ?? `/marketplace/produit/${current.id}`} className="flex-1">
                <span className="block text-center w-full bg-white text-gray-900 text-[10px] font-bold py-1.5 px-2 rounded-xl hover:bg-white/90 active:scale-95 transition-all cursor-pointer">
                  {current.ctaLabel ?? 'Découvrir →'}
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Compteur + flèches navigation */}
        {products.length > 1 && (
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/10">
            <span className="text-[10px] font-semibold text-white/45 tabular-nums">
              {activeIndex + 1}&thinsp;/&thinsp;{products.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={prev}
                aria-label="Précédent"
                className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/28 text-white flex items-center justify-center text-base transition-colors leading-none"
              >
                ‹
              </button>
              <button
                onClick={next}
                aria-label="Suivant"
                className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/28 text-white flex items-center justify-center text-base transition-colors leading-none"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
