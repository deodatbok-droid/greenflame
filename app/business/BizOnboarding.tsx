'use client'

import { useState, useEffect } from 'react'

interface Step {
  id: string
  label: string
  description: string
  icon: string
  href: string
}

const STEPS: Step[] = [
  { id: 'add_product',    label: 'Ajouter votre premier produit', description: 'Créez votre catalogue pour la caisse et le stock',  icon: '📦', href: '/business/stock/ajouter' },
  { id: 'make_sale',      label: 'Faire une première vente',      description: 'Essayez la caisse pour enregistrer une transaction', icon: '💰', href: '/business/caisse' },
  { id: 'create_invoice', label: 'Créer une facture client',      description: 'Facturez un client avec suivi du paiement',          icon: '🧾', href: '/business/ventes/nouveau' },
  { id: 'add_supplier',   label: 'Ajouter un fournisseur',        description: 'Gérez vos approvisionnements',                       icon: '🏭', href: '/business/fournisseurs' },
  { id: 'invite_team',    label: 'Inviter un membre d\'équipe',   description: 'Donnez accès à vos collaborateurs',                  icon: '👥', href: '/business/equipe' },
  { id: 'setup_settings', label: 'Configurer l\'entreprise',      description: 'NIF, devise, mentions légales sur factures',          icon: '⚙️', href: '/business/parametres' },
]

interface BizOnboardingProps {
  businessId: string
}

export default function BizOnboarding({ businessId }: BizOnboardingProps) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const storageKey = `biz_onboard_${businessId}`

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved === 'dismissed') { setDismissed(true); return }
      const parsed: string[] = saved ? JSON.parse(saved) : []
      setDone(new Set(parsed))
      if (parsed.length === 0) setExpanded(true)
    } catch {}
  }, [storageKey])

  const markDone = (id: string) => {
    const next = new Set([...done, id])
    setDone(next)
    localStorage.setItem(storageKey, JSON.stringify([...next]))
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(storageKey, 'dismissed')
  }

  if (dismissed) return null

  const remaining = STEPS.filter(s => !done.has(s.id))
  const pct = Math.round((done.size / STEPS.length) * 100)
  const allDone = done.size === STEPS.length

  if (allDone) {
    return (
      <div className="biz-onboard-widget" style={{ right: 20, bottom: 20 }}>
        <div style={{
          background: '#0D1117', borderRadius: 14, padding: '14px 18px',
          boxShadow: '0 8px 24px rgba(0,0,0,.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#22C55E', margin: 0 }}>Configuration terminée !</p>
            <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>GreenFlame Business est prêt</p>
          </div>
          <button onClick={dismiss} style={{ border: 'none', background: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: '0 0 0 8px' }}>×</button>
        </div>
      </div>
    )
  }

  return (
    <div className="biz-onboard-widget">
      {expanded ? (
        <div style={{
          background: '#fff', borderRadius: 16,
          boxShadow: '0 12px 32px rgba(0,0,0,.15)',
          width: 320, border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #0D1117 0%, #0F2420 100%)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', margin: 0 }}>Configuration</p>
                <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>{done.size}/{STEPS.length} étapes</p>
              </div>
              <button onClick={() => setExpanded(false)} style={{ border: 'none', background: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>−</button>
            </div>
            <div style={{ height: 5, background: '#1A2232', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #22C55E, #16A34A)', borderRadius: 999, transition: 'width .4s ease' }} />
            </div>
            <p style={{ fontSize: 10, color: '#22C55E', margin: '4px 0 0', fontWeight: 700 }}>{pct}% complété</p>
          </div>

          {/* Steps */}
          <div style={{ padding: '8px 8px', maxHeight: 340, overflowY: 'auto' }}>
            {STEPS.map(step => {
              const isDone = done.has(step.id)
              return (
                <div key={step.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 10px', borderRadius: 10,
                  background: isDone ? '#F0FDF4' : 'transparent',
                  marginBottom: 4,
                  opacity: isDone ? 0.7 : 1,
                }}>
                  <button
                    onClick={() => markDone(step.id)}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      border: isDone ? 'none' : '2px solid #CBD5E1',
                      background: isDone ? '#22C55E' : 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff', transition: 'all .15s',
                    }}
                  >
                    {isDone ? '✓' : ''}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: isDone ? 400 : 600, color: isDone ? '#94A3B8' : '#0F172A', margin: 0, textDecoration: isDone ? 'line-through' : 'none' }}>
                      {step.icon} {step.label}
                    </p>
                    {!isDone && <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{step.description}</p>}
                  </div>
                  {!isDone && (
                    <a href={step.href} style={{ fontSize: 11, color: '#22C55E', textDecoration: 'none', fontWeight: 700, flexShrink: 0, paddingTop: 2 }}>
                      Faire →
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 16px 12px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={dismiss} style={{ fontSize: 11, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Ignorer
            </button>
            {remaining.length > 0 && (
              <a href={remaining[0].href} style={{
                padding: '7px 14px', borderRadius: 8,
                background: '#22C55E', color: '#fff',
                fontSize: 12, fontWeight: 700, textDecoration: 'none',
              }}>
                Continuer →
              </a>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', borderRadius: 12,
            background: '#0D1117', boxShadow: '0 8px 24px rgba(0,0,0,.2)',
            border: 'none', cursor: 'pointer', color: '#fff',
          }}
        >
          <div style={{ position: 'relative', width: 32, height: 32 }}>
            <svg width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" fill="none" stroke="#1A2232" strokeWidth="3"/>
              <circle cx="16" cy="16" r="14" fill="none" stroke="#22C55E" strokeWidth="3"
                strokeDasharray={`${pct * 0.879} 100`} strokeLinecap="round"
                transform="rotate(-90 16 16)"
                style={{ transition: 'stroke-dasharray .4s ease' }}
              />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#22C55E' }}>
              {pct}%
            </span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Configuration</p>
            <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>{STEPS.length - done.size} étapes restantes</p>
          </div>
        </button>
      )}
    </div>
  )
}
