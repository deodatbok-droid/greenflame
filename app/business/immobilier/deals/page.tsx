import { getBizSession } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DealRowActions from './DealRowActions'

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  declared: { label: 'Déclaré', bg: '#FFFBEB', color: '#D97706' },
  settled:  { label: 'Réglé',   bg: '#F0FDF4', color: '#16A34A' },
}

const ROLE_LABEL: Record<string, string> = { lister: 'Gestionnaire', closer: 'Apporteur', autre: 'Autre' }

interface Split { business_id: string; role: string; percentage: number; biz_accounts: { name: string } | null }
interface Deal {
  id: string
  business_id: string
  commission_amount_fcfa: number
  gf_fee_fcfa: number
  status: string
  created_at: string
  settled_at: string | null
  biz_properties: { title: string } | null
  biz_property_deal_splits: Split[]
  is_declarant: boolean
}

async function getDeals(businessId: string): Promise<Deal[]> {
  const svc = createServiceClient()

  const { data: participantSplits } = await svc.from('biz_property_deal_splits').select('deal_id').eq('business_id', businessId)
  const participantDealIds = (participantSplits ?? []).map(s => s.deal_id)

  const orFilter = participantDealIds.length > 0
    ? `business_id.eq.${businessId},id.in.(${participantDealIds.join(',')})`
    : `business_id.eq.${businessId}`

  const { data } = await svc
    .from('biz_property_deals')
    .select('id, business_id, commission_amount_fcfa, gf_fee_fcfa, status, created_at, settled_at, biz_properties(title), biz_property_deal_splits(business_id, role, percentage, biz_accounts(name))')
    .or(orFilter)
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as Deal[]).map(d => ({ ...d, is_declarant: d.business_id === businessId }))
}

export default async function DealsPage() {
  const session = await getBizSession()
  const deals   = await getDeals(session.account.id)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Immobilier</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Deals</h1>
        </div>
        <Link href="/business/immobilier/deals/nouveau" style={{
          padding: '10px 18px', borderRadius: 10, background: '#22C55E',
          fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none',
        }}>
          + Déclarer un deal
        </Link>
      </div>

      {deals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94A3B8' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Aucun deal déclaré</p>
          <p style={{ fontSize: 13, marginBottom: 24 }}>Déclarez une commission conclue pour la répartir et la régler via le wallet.</p>
          <Link href="/business/immobilier/deals/nouveau" style={{
            display: 'inline-block', padding: '12px 24px', borderRadius: 10,
            background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Déclarer un deal →
          </Link>
        </div>
      ) : (
        <div className="biz-table-scroll" style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={th}>Bien</th>
                <th style={th}>Commission</th>
                <th style={th}>Répartition</th>
                <th style={{ ...th, textAlign: 'center' }}>Statut</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(d => {
                const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.declared
                return (
                  <tr key={d.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '11px 18px', fontWeight: 600, color: '#0F172A' }}>
                      {d.biz_properties?.title ?? '—'}
                    </td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>
                      {d.commission_amount_fcfa.toLocaleString('fr-FR')} FCFA
                      {d.is_declarant && <div style={{ fontSize: 11, color: '#94A3B8' }}>Forfait plateforme : {d.gf_fee_fcfa.toLocaleString('fr-FR')} FCFA</div>}
                    </td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>
                      {d.biz_property_deal_splits.map((s, i) => (
                        <div key={i} style={{ fontSize: 12 }}>
                          {s.biz_accounts?.name ?? '—'} · {s.percentage}% · {ROLE_LABEL[s.role] ?? s.role}
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>
                        {badge.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}>
                      <DealRowActions id={d.id} status={d.status} isDeclarant={d.is_declarant} />
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
