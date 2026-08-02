import { getBizSession, formatBizAmount } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

async function getVentes(businessId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_invoices')
    .select('id, number, status, total, paid_amount, due_date, created_at, biz_customers(name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  draft:   { text: 'BROUILLON', bg: '#F8FAFC', color: '#64748B' },
  sent:    { text: 'ENVOYÉE',   bg: '#FFFBEB', color: '#F59E0B' },
  partial: { text: 'PARTIEL',   bg: '#FFF7ED', color: '#EA580C' },
  paid:    { text: 'PAYÉE',     bg: '#F0FDF4', color: '#16A34A' },
  overdue: { text: 'EN RETARD', bg: '#FEF2F2', color: '#EF4444' },
  cancelled:{ text: 'ANNULÉE',  bg: '#F8FAFC', color: '#94A3B8' },
}

export default async function VentesPage() {
  const session = await getBizSession()
  const ventes  = await getVentes(session.account.id)
  const fmt     = (n: number) => formatBizAmount(n, session.account.currency)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Ventes</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Factures</h1>
        </div>
        <Link href="/business/ventes/nouveau" style={{
          padding: '10px 18px', borderRadius: 10, background: '#22C55E',
          fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none',
        }}>
          + Nouvelle facture
        </Link>
      </div>

      {ventes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94A3B8' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>◧</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Aucune facture</p>
          <p style={{ fontSize: 13, marginBottom: 24 }}>Créez votre première facture ou passez par la caisse pour enregistrer des ventes.</p>
          <Link href="/business/ventes/nouveau" style={{
            display: 'inline-block', padding: '12px 24px', borderRadius: 10,
            background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Créer une facture →
          </Link>
        </div>
      ) : (
        <div className="biz-table-scroll" style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={th}>N° Facture</th>
                <th style={th}>Client</th>
                <th style={{ ...th, textAlign: 'center' }}>Statut</th>
                <th style={{ ...th, textAlign: 'right' }}>Total</th>
                <th style={{ ...th, textAlign: 'right' }}>Restant</th>
                <th style={{ ...th, textAlign: 'right' }}>Échéance</th>
              </tr>
            </thead>
            <tbody>
              {ventes.map(v => {
                const s = STATUS_LABEL[v.status] ?? STATUS_LABEL.draft
                const restant = (v.total ?? 0) - (v.paid_amount ?? 0)
                return (
                  <tr key={v.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '11px 18px' }}>
                      <Link href={`/business/ventes/${v.id}`} style={{ fontWeight: 700, color: '#3B82F6', textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>
                        #{v.number ?? v.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td style={{ padding: '11px 18px', color: '#374151' }}>
                      {(v.biz_customers as { name?: string } | null)?.name ?? 'Client anonyme'}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: s.bg, color: s.color }}>{s.text}</span>
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#0F172A' }}>
                      {fmt(v.total ?? 0)}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: restant > 0 ? '#EF4444' : '#94A3B8', fontWeight: restant > 0 ? 700 : 400 }}>
                      {restant > 0 ? fmt(restant) : '—'}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right', color: '#64748B' }}>
                      {v.due_date ? new Date(v.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
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
