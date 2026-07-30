'use client'

import { useState, useEffect, useCallback } from 'react'

interface Member {
  id: string
  user_id: string
  role: 'owner' | 'manager' | 'staff'
  created_at: string
  profiles?: { full_name: string | null; phone: string | null }
}

const ROLE_LABEL: Record<string, string> = { owner: 'Propriétaire', manager: 'Manager', staff: 'Employé' }
const ROLE_COLOR: Record<string, string> = { owner: '#8B5CF6', manager: '#3B82F6', staff: '#22C55E' }

export default function EquipePage() {
  const [members, setMembers] = useState<Member[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'manager' | 'staff'>('staff')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(() => {
    fetch('/api/business/equipe').then(r => r.json()).then(d => setMembers(d.members ?? []))
  }, [])
  useEffect(() => { load() }, [load])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setErr(''); setSuccess('')
    const res = await fetch('/api/business/equipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, role }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Erreur'); setLoading(false); return }
    setSuccess('Membre ajouté avec succès')
    setPhone(''); setShowInvite(false)
    load()
    setLoading(false)
  }

  const handleRemove = async (memberId: string, memberRole: string) => {
    if (memberRole === 'owner') return
    if (!confirm('Retirer ce membre de l\'équipe ?')) return
    await fetch(`/api/business/equipe?member_id=${memberId}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Gestion</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Gestion du Personnel</h1>
        </div>
        <button onClick={() => { setShowInvite(s => !s); setErr(''); setSuccess('') }}
          style={{ padding: '9px 20px', borderRadius: 8, background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          {showInvite ? '× Annuler' : '+ Ajouter un membre'}
        </button>
      </div>

      {success && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
          {success}
        </div>
      )}

      {showInvite && (
        <form onSubmit={handleInvite} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Ajouter un membre par téléphone</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Numéro de téléphone GreenFlame *</label>
              <input style={inp} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+22901234567" required />
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Le compte doit déjà exister sur GreenFlame</p>
            </div>
            <div>
              <label style={lbl}>Rôle</label>
              <select style={inp} value={role} onChange={e => setRole(e.target.value as 'manager' | 'staff')}>
                <option value="staff">Employé — Caisse uniquement</option>
                <option value="manager">Manager — Gestion stock + rapports</option>
              </select>
            </div>
          </div>
          {err && <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 10 }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setShowInvite(false)}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
              Annuler
            </button>
            <button type="submit" disabled={loading}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      )}

      {/* Permissions info */}
      <div style={{ background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', padding: '12px 16px', marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Niveaux d&apos;accès</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { role: 'staff', desc: 'Caisse, consultation stock' },
            { role: 'manager', desc: 'Tout sauf paramètres & équipe' },
            { role: 'owner', desc: 'Accès complet' },
          ].map(r => (
            <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: ROLE_COLOR[r.role] + '20', color: ROLE_COLOR[r.role] }}>{ROLE_LABEL[r.role]}</span>
              <span style={{ fontSize: 11, color: '#64748B' }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Liste membres */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 130px 80px', padding: '10px 20px', borderBottom: '1px solid #F1F5F9', gap: 12 }}>
          {['Membre', 'Rôle', 'Depuis', ''].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
          ))}
        </div>
        {members.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>👥</p>
            <p style={{ fontSize: 14, color: '#94A3B8' }}>Aucun membre dans l&apos;équipe</p>
          </div>
        ) : members.map((m, idx) => (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 130px 80px', padding: '12px 20px', borderBottom: idx < members.length - 1 ? '1px solid #F8FAFC' : 'none', alignItems: 'center', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', margin: 0 }}>{m.profiles?.full_name ?? 'Utilisateur'}</p>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{m.profiles?.phone ?? m.user_id.slice(0, 12) + '…'}</p>
            </div>
            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: ROLE_COLOR[m.role] + '20', color: ROLE_COLOR[m.role], display: 'inline-block' }}>
              {ROLE_LABEL[m.role]}
            </span>
            <span style={{ fontSize: 12, color: '#64748B' }}>{new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
            <div>
              {m.role !== 'owner' && (
                <button onClick={() => handleRemove(m.id, m.role)}
                  style={{ fontSize: 11, color: '#EF4444', background: 'none', border: '1px solid #FEE2E2', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                  Retirer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', outline: 'none', background: '#fff' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }
