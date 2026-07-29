import { getBizSession, formatBizAmount } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

const STATUS_LABEL: Record<string, string> = {
  draft:    'Brouillon',
  sent:     'Envoyé',
  accepted: 'Accepté',
  declined: 'Refusé',
  expired:  'Expiré',
}
const STATUS_COLOR: Record<string, string> = {
  draft:    '#94A3B8',
  sent:     '#3B82F6',
  accepted: '#22C55E',
  declined: '#EF4444',
  expired:  '#F59E0B',
}

export default async function DevisPage() {
  const session = await getBizSession()
  const svc = createServiceClient()
  const { data: quotes } = await svc
    .from('biz_quotes')
    .select('id, number, total, status, valid_until, created_at, biz_customers(name)')
    .eq('business_id', session.account.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const fmt = (n: number) => formatBizAmount(n, session.account.currency)
  const list = quotes ?? []

  const stats = {
    total:    list.length,
    draft:    list.filter(q => q.status === 'draft').length,
    sent:     list.filter(q => q.status === 'sent').length,
    accepted: list.filter(q => q.status === 'accepted').length,
    valeur:   list.filter(q => q.status === 'sent').reduce((s, q) => s + (q.total ?? 0), 0),
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Commerce</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Devis</h1>
        </div>
        <Link href="/business/devis/nouveau" style={{ padding: '9px 20px', borderRadius: 8, background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          + Nouveau devis
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total devis', value: stats.total, color: '#64748B' },
          { label: 'Envoyés',     value: stats.sent,  color: '#3B82F6' },
          { label: 'Acceptés',    value: stats.accepted, color: '#22C55E' },
          { label: 'En attente',  value: fmt(stats.valeur), color: '#F59E0B', small: true },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '14px 16px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: s.small ? 14 : 22, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px 130px 100px 80px', padding: '10px 20px', borderBottom: '1px solid #F1F5F9', gap: 12 }}>
          {['N° Devis', 'Client', 'Montant', 'Validité', 'Statut', ''].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
          ))}
        </div>

        {list.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
            <p style={{ fontSize: 14, color: '#94A3B8' }}>Aucun devis créé</p>
            <Link href="/business/devis/nouveau" style={{ display: 'inline-block', marginTop: 14, padding: '9px 20px', borderRadius: 8, background: '#F0FDF4', color: '#22C55E', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Créer le premier devis
            </Link>
          </div>
        ) : list.map((q, idx) => {
          const status = q.status ?? 'draft'
          const expired = q.valid_until && new Date(q.valid_until) < new Date() && status === 'sent'
          const displayStatus = expired ? 'expired' : status
          return (
            <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px 130px 100px 80px', padding: '12px 20px', borderBottom: idx < list.length - 1 ? '1px solid #F8FAFC' : 'none', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{q.number ?? `#${q.id.slice(0, 8).toUpperCase()}`}</span>
              <span style={{ fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(q.biz_customers as { name?: string } | null)?.name ?? '—'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{fmt(q.total ?? 0)}</span>
              <span style={{ fontSize: 12, color: '#64748B' }}>{q.valid_until ? new Date(q.valid_until).toLocaleDateString('fr-FR') : '—'}</span>
              <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: STATUS_COLOR[displayStatus] + '20', color: STATUS_COLOR[displayStatus] }}>
                {STATUS_LABEL[displayStatus] ?? status}
              </span>
              <Link href={`/business/devis/${q.id}`} style={{ fontSize: 12, color: '#22C55E', textDecoration: 'none', fontWeight: 600 }}>
                Voir →
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
