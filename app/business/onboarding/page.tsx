'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BizOnboardingPage() {
  const router = useRouter()
  const [name, setName]       = useState('')
  const [country, setCountry] = useState('BJ')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function create() {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/business/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), country }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Erreur lors de la création')
      setLoading(false)
      return
    }
    router.push('/business/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0', padding: '36px 32px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#22C55E' }}>GF</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>GreenFlame Business</span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Créez votre espace</h1>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 28 }}>Opérationnel en 2 minutes. Essai gratuit 30 jours.</p>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Nom de votre entreprise *</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Ex : Boutique Chez Marie"
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 10,
              border: '1px solid #CBD5E1', fontSize: 14, color: '#0F172A',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Pays</span>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 10,
              border: '1px solid #CBD5E1', fontSize: 14, color: '#0F172A',
              background: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
          >
            <option value="BJ">🇧🇯 Bénin</option>
            <option value="SN">🇸🇳 Sénégal</option>
            <option value="CI">🇨🇮 Côte d&apos;Ivoire</option>
            <option value="TG">🇹🇬 Togo</option>
            <option value="GH">🇬🇭 Ghana</option>
            <option value="NG">🇳🇬 Nigéria</option>
            <option value="RW">🇷🇼 Rwanda</option>
            <option value="ML">🇲🇱 Mali</option>
            <option value="BF">🇧🇫 Burkina Faso</option>
            <option value="CM">🇨🇲 Cameroun</option>
          </select>
        </label>

        {error && (
          <p style={{ fontSize: 13, color: '#EF4444', marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8 }}>
            {error}
          </p>
        )}

        <button
          onClick={create}
          disabled={!name.trim() || loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 10,
            background: loading || !name.trim() ? '#94A3B8' : '#22C55E',
            color: '#fff', fontWeight: 700, fontSize: 14,
            border: 'none', cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Création…' : 'Créer mon espace →'}
        </button>

        <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 16 }}>
          Sans engagement · Sans carte bancaire · 30 jours offerts
        </p>
      </div>
    </div>
  )
}
