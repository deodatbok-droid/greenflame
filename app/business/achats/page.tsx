import { getBizSession, formatBizAmount } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

const STATUS_LABEL: Record<string, string> = {
  draft:     'Brouillon',
  confirmed: 'Confirmé',
  received:  'Reçu',
  cancelled: 'Annulé',
}
const STATUS_COLOR: Record<string, string> = {
  draft:     '#94A3B8',
  confirmed: '#3B82F6',
  received:  '#22C55E',
  cancelled: '#EF4444',
}

export default async function AchatsPage() {
  const session = await getBizSession()
  const svc = createServiceClient()

  const { data: orders } = await svc
    .from('biz_purchase_orders')
    .select('id, order_number, supplier_name, total_amount, status, expected_date, created_at')
    .eq('business_id', session.account.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const fmt = (n: number) => formatBizAmount(n, session.account.currency)
  const list = orders ?? []

  const stats = {
    total:     list.length,
    pending:   list.filter(o => o.status === 'confirmed').length,
    received:  list.filter(o => o.status === 'received').length,
    valeur:    list.filter(o => ['draft','confirmed'].includes(o.status ?? '')).reduce((s, o) => s + (o.total_amount ?? 0), 0),
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Inventaire</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Bons de commande</h1>
        </div>
        <Link href="/business/achats/nouveau"
          style={{ padding: '9px 20px', borderRadius: 8, background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          + Nouvelle commande
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total commandes', value: stats.total, color: '#64748B' },
          { label: 'En attente',      value: stats.pending, color: '#3B82F6' },
          { label: 'Reçues',          value: stats.received, color: '#22C55E' },
          { label: 'Valeur en cours', value: fmt(stats.valeur), color: '#F59E0B', small: true },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '14px 16px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: s.small ? 14 : 22, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1.5fr 150px 130px 100px 80px', padding: '10px 20px', borderBottom: '1px solid #F1F5F9', gap: 12 }}>
          {['N° BC', 'Fournisseur', 'Montant', 'Livraison prévue', 'Statut', ''].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
          ))}
        </div>

        {list.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>📦</p>
            <p style={{ fontSize: 14, color: '#94A3B8' }}>Aucune commande passée</p>
            <Link href="/business/achats/nouveau"
              style={{ display: 'inline-block', marginTop: 14, padding: '9px 20px', borderRadius: 8, background: '#F0FDF4', color: '#22C55E', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Passer la première commande
            </Link>
          </div>
        ) : list.map((o, idx) => {
          const status = o.status ?? 'draft'
          const overdue = o.expected_date && new Date(o.expected_date) < new Date() && status === 'confirmed'
          return (
            <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '140px 1.5fr 150px 130px 100px 80px', padding: '12px 20px', borderBottom: idx < list.length - 1 ? '1px solid #F8FAFC' : 'none', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{o.order_number ?? `#${o.id.slice(0, 8)}`}</span>
              <span style={{ fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.supplier_name ?? '—'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{fmt(o.total_amount ?? 0)}</span>
              <span style={{ fontSize: 12, color: overdue ? '#EF4444' : '#64748B', fontWeight: overdue ? 700 : 400 }}>
                {o.expected_date ? new Date(o.expected_date).toLocaleDateString('fr-FR') : '—'}
                {overdue && ' ⚠'}
              </span>
              <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: STATUS_COLOR[status] + '20', color: STATUS_COLOR[status] }}>
                {STATUS_LABEL[status] ?? status}
              </span>
              <Link href={`/business/achats/${o.id}`} style={{ fontSize: 12, color: '#22C55E', textDecoration: 'none', fontWeight: 600 }}>
                Voir →
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
