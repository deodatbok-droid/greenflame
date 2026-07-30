'use client'

import { useEffect } from 'react'

export default function BizError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GreenFlame Business] Server error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#EFF3F8', padding: 24,
    }}>
      <div style={{
        maxWidth: 480, width: '100%', background: '#fff', borderRadius: 16,
        border: '1px solid #E2E8F0', padding: '32px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚠</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>GreenFlame Business</p>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>Erreur serveur</p>
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
          Une erreur s&apos;est produite
        </h2>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 20 }}>
          {error.message || 'Erreur inattendue côté serveur.'}
        </p>

        {error.digest && (
          <p style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', marginBottom: 20 }}>
            Digest : {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          style={{
            width: '100%', padding: '12px', borderRadius: 10,
            background: '#22C55E', color: '#fff', fontWeight: 700,
            fontSize: 14, border: 'none', cursor: 'pointer',
          }}
        >
          Réessayer
        </button>
      </div>
    </div>
  )
}
