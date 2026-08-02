import { getBizSession } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import MandatRowActions from './MandatRowActions'

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  actif:   { label: 'Actif',   bg: '#F0FDF4', color: '#16A34A' },
  expire:  { label: 'Expiré',  bg: '#FEF2F2', color: '#EF4444' },
  resilie: { label: 'Résilié', bg: '#F1F5F9', color: '#64748B' },
}

const TYPE_LABEL: Record<string, string> = { exclusif: 'Exclusif', simple: 'Simple' }

async function getMandats(businessId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_property_mandats')
    .select('id, owner_name, owner_phone, mandat_type, expires_at, status, biz_properties(title)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Array<{
    id: string; owner_name: string; owner_phone: string | null
    mandat_type: string; expires_at: string | null; status: string
    biz_properties: { title: string } | null
  }>
}

export default async function MandatsPage() {
  const session = await getBizSession()
  const mandats = await getMandats(session.account.id)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Immobilier</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Mandats</h1>
        </div>
        <Link href="/business/immobilier/mandats/nouveau" style={{
          padding: '10px 18px', borderRadius: 10, background: '#22C55E',
          fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none',
        }}>
          + Nouveau mandat
        </Link>
      </div>

      {mandats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94A3B8' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📜</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Aucun mandat enregistré</p>
          <p style={{ fontSize: 13, marginBottom: 24 }}>Enregistrez les mandats confiés par les propriétaires pour vos biens.</p>
          <Link href="/business/immobilier/mandats/nouveau" style={{
            display: 'inline-block', padding: '12px 24px', borderRadius: 10,
            background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Ajouter un mandat →
          </Link>
        </div>
      ) : (
        <div className="biz-table-scroll" style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={th}>Bien</th>
                <th style={th}>Propriétaire</th>
                <th style={th}>Type</th>
                <th style={th}>Échéance</th>
                <th style={{ ...th, textAlign: 'center' }}>Statut</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mandats.map(m => {
                const badge = STATUS_BADGE[m.status] ?? STATUS_BADGE.actif
                return (
                  <tr key={m.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '11px 18px', fontWeight: 600, color: '#0F172A' }}>
                      {m.biz_properties?.title ?? '—'}
                    </td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>
                      <div>{m.owner_name}</div>
                      {m.owner_phone && <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.owner_phone}</div>}
                    </td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>{TYPE_LABEL[m.mandat_type] ?? m.mandat_type}</td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>
                      {m.expires_at ? new Date(m.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>
                        {badge.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}>
                      <MandatRowActions id={m.id} status={m.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 18px',
  color: '#64748B', fontWeight: 600, fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '.06em',
}
