'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import { useDemo } from '@/lib/demo/DemoContext'
import { DEMO_STEPS, DemoStep } from '@/lib/demo/data'

export default function DemoRemote() {
  const { isDemo, completedSteps, markStepComplete, resetDemo, resetting, seedDemo, seeding } = useDemo()
  const [expanded, setExpanded] = useState(true)
  const router   = useRouter()
  const pathname = usePathname()

  if (!isDemo) return null

  function currentStep(): DemoStep | undefined {
    return DEMO_STEPS.find(s => pathname.startsWith(s.path.split('?')[0]))
  }

  function goToStep(step: DemoStep) {
    router.push(step.path)
  }

  const active = currentStep()

  return (
    <div className="fixed bottom-24 left-4 z-[9999] select-none" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Pill réduite */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl text-white text-sm font-bold"
          style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 8px 32px rgba(22,163,74,0.4)' }}
        >
          🎬
          <span>MODE DÉMO</span>
          <span className="text-[11px] bg-white/20 rounded-full px-2 py-0.5">
            {completedSteps.size}/{DEMO_STEPS.length}
          </span>
        </button>
      )}

      {/* Panneau étendu */}
      {expanded && (
        <div
          className="rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{
            width: 252,
            maxHeight: 'calc(100dvh - 180px)',
            background: '#0c1018',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}
        >
          {/* En-tête */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🎬</span>
              <div>
                <p className="text-white font-bold text-sm leading-tight">MODE DÉMO</p>
                <p className="text-green-200 text-[10px]">
                  {completedSteps.size}/{DEMO_STEPS.length} étapes · GreenFlame Africa
                </p>
              </div>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-white/60 hover:text-white text-xl leading-none transition-colors"
              title="Réduire"
            >
              ×
            </button>
          </div>

          {/* Liste des étapes */}
          <div className="overflow-y-auto flex-1 scrollbar-dark">
            {DEMO_STEPS.map((step, idx) => {
              const done    = completedSteps.has(step.id)
              const isActive = active?.id === step.id
              return (
                <button
                  key={step.id}
                  onClick={() => goToStep(step)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:brightness-110"
                  style={{
                    background: isActive ? 'rgba(22,163,74,0.12)' : 'transparent',
                    borderLeft: isActive ? '3px solid #22c55e' : '3px solid transparent',
                  }}
                >
                  <span className="text-base shrink-0">{done ? '✅' : step.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[13px] font-medium truncate leading-tight"
                      style={{ color: done ? '#4ade80' : isActive ? '#fff' : '#9ca3af' }}
                    >
                      {step.label}
                    </p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: '#374151' }}>
                      {step.description}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-mono shrink-0"
                    style={{ color: isActive ? '#4ade80' : '#2d3748' }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Bouton marquer étape */}
          {active && !completedSteps.has(active.id) && (
            <div className="px-3 pt-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => markStepComplete(active.id)}
                className="w-full py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={{
                  background: 'rgba(22,163,74,0.15)',
                  color: '#4ade80',
                  border: '1px solid rgba(34,197,94,0.2)',
                }}
              >
                ✓ Marquer «{active.label}» comme fait
              </button>
            </div>
          )}

          {/* Footer actions */}
          <div className="px-3 py-3 shrink-0 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={async () => {
                try {
                  await seedDemo()
                  toast.success('Compte mature chargé — 3 mois de données')
                } catch {
                  toast.error('Erreur lors du chargement des données')
                }
              }}
              disabled={seeding}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={{
                background: seeding ? 'rgba(255,255,255,0.03)' : 'rgba(22,163,74,0.1)',
                color:      seeding ? '#4b5563' : '#4ade80',
                border:     '1px solid rgba(22,163,74,0.2)',
              }}
            >
              {seeding ? '⏳ Chargement…' : '📊 Charger compte mature'}
            </button>
            <button
              onClick={resetDemo}
              disabled={resetting}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={{
                background: resetting ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.08)',
                color:      resetting ? '#4b5563' : '#f87171',
                border:     '1px solid rgba(239,68,68,0.15)',
              }}
            >
              {resetting ? '⏳ Remise à zéro…' : '🔄 Reset démo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
