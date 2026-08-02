import { getBizSession } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import VisitRowActions from './VisitRowActions'

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  planifiee: { label: 'Planifiée', bg: '#EFF6FF', color: '#3B82F6' },
  effectuee: { label: 'Effectuée', bg: '#F0FDF4', color: '#16A34A' },
  annulee:   { label: 'Annulée',   bg: '#F1F5F9', color: '#64748B' },
}

async function getVisits(businessId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_property_visits')
    .select('id, scheduled_at, status, notes, biz_properties(title), biz_customers(name, phone)')
    .eq('business_id', businessId)
    .order('scheduled_at', { ascending: false })
  return (data ?? []) as unknown as Array<{
    id: string; scheduled_at: string; status: string; notes: string | null
    biz_properties: { title: string } | null
    biz_customers: { name: string; phone: string | null } | null
  }>
}

export default async function VisitesPage() {
  const session = await getBizSession()
  const visits  = await getVisits(session.account.id)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Immobilier</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Visites</h1>
        </div>
        <Link href="/business/immobilier/visites/nouveau" style={{
          padding: '10px 18px', borderRadius: 10, background: '#22C55E',
          fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none',
        }}>
          + Planifier une visite
        </Link>
      </div>

      {visits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94A3B8' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗓️</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Aucune visite planifiée</p>
          <p style={{ fontSize: 13, marginBottom: 24 }}>Planifiez vos visites pour vos biens et suivez leur statut.</p>
          <Link href="/business/immobilier/visites/nouveau" style={{
            display: 'inline-block', padding: '12px 24px', borderRadius: 10,
            background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Planifier une visite →
          </Link>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={th}>Bien</th>
                <th style={th}>Client</th>
                <th style={th}>Date</th>
                <th style={{ ...th, textAlign: 'center' }}>Statut</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visits.map(v => {
                const badge = STATUS_BADGE[v.status] ?? STATUS_BADGE.planifiee
                return (
                  <tr key={v.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '11px 18px', fontWeight: 600, color: '#0F172A' }}>
                      {v.biz_properties?.title ?? '—'}
                    </td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>
                      {v.biz_customers ? (
                        <>
                          <div>{v.biz_customers.name}</div>
                          {v.biz_customers.phone && <div style={{ fontSize: 11, color: '#94A3B8' }}>{v.biz_customers.phone}</div>}
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>
                      {new Date(v.scheduled_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>
                        {badge.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}>
                      <VisitRowActions id={v.id} status={v.status} />
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
