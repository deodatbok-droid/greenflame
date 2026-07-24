'use client'

import { useState, useEffect } from 'react'
import Logo from '@/components/Logo'

export default function AdminVerifyPage() {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'loading' | 'verify' | 'set'>('loading')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  // Au chargement : vérifier si déjà connecté ou si PIN pas encore défini
  useEffect(() => {
    fetch('/api/admin/verify-pin')
      .then(r => r.json())
      .then(d => {
        if (d.alreadyVerified) {
          window.location.replace('/admin/dashboard')
        } else if (!d.hasPin) {
          setMode('set')
        } else {
          setMode('verify')
        }
      })
      .catch(() => setMode('verify'))
  }, [router])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4) { setError('PIN trop court (4 chiffres minimum)'); return }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (data.needsSetup) { setMode('set'); return }
      setError(data.error ?? 'PIN incorrect')
      return
    }

    window.location.replace('/admin/dashboard')
  }

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault()
    if (newPin.length < 4) { setError('PIN trop court (4 chiffres minimum)'); return }
    if (newPin !== confirmPin) { setError('Les PIN ne correspondent pas'); return }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/admin/set-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'Erreur'); return }

    // PIN défini + cookie posé → redirect direct
    window.location.replace('/admin/dashboard')
  }

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Logo size={48} className="w-12 h-12" />
          <div>
            <p className="font-bold text-white text-lg leading-tight">GreenFlame</p>
            <p className="text-gray-400 text-xs">Espace Admin</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          {mode === 'verify' ? (
            <>
              <h1 className="text-white font-bold text-xl mb-1">🔐 Accès admin</h1>
              <p className="text-gray-400 text-sm mb-5">Entrez votre PIN admin pour continuer.</p>

              <form onSubmit={handleVerify} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-gray-700 text-white text-2xl text-center tracking-widest px-4 py-4 rounded-xl border border-gray-600 focus:border-brand-500 focus:outline-none"
                  autoFocus
                />

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || pin.length < 4}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  {loading ? 'Vérification...' : 'Entrer'}
                </button>

                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="w-full text-gray-400 text-sm py-2 hover:text-white transition-colors"
                >
                  ← Annuler
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-white font-bold text-xl mb-1">🔑 Définir un PIN admin</h1>
              <p className="text-gray-400 text-sm mb-5">
                Choisissez un PIN de 4 à 8 chiffres. Il vous sera demandé à chaque accès à l&apos;espace admin.
              </p>

              <form onSubmit={handleSetPin} className="space-y-4">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Nouveau PIN (4–8 chiffres)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full bg-gray-700 text-white text-xl text-center tracking-widest px-4 py-3 rounded-xl border border-gray-600 focus:border-brand-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Confirmer le PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full bg-gray-700 text-white text-xl text-center tracking-widest px-4 py-3 rounded-xl border border-gray-600 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || newPin.length < 4 || newPin !== confirmPin}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  {loading ? 'Enregistrement...' : 'Définir le PIN et accéder →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
