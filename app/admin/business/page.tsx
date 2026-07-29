import { requireAdmin } from '@/lib/utils/admin-guard'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminBusinessPage() {
  await requireAdmin()
  const svc = createServiceClient()

  const { data: accounts } = await svc
    .from('biz_accounts')
    .select(`
      id, name, country, plan, status, created_at,
      biz_members(count),
      biz_subscriptions(status, trial_ends_at, renews_at)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const { count: totalCount } = await svc
    .from('biz_accounts')
    .select('*', { count: 'exact', head: true })

  const { count: trialCount } = await svc
    .from('biz_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'trial')

  const { count: activeCount } = await svc
    .from('biz_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const PLAN_COLOR: Record<string, { bg: string; color: string }> = {
    trial:    { bg: '#FFFBEB', color: '#D97706' },
    starter:  { bg: '#EFF6FF', color: '#3B82F6' },
    business: { bg: '#F0FDF4', color: '#16A34A' },
    pro:      { bg: '#FDF4FF', color: '#9333EA' },
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Comptes Business</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Vue d&apos;ensemble de tous les espaces GreenFlame Business
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total comptes', value: String(totalCount ?? 0), color: '#3B82F6' },
          { label: 'En trial',      value: String(trialCount ?? 0), color: '#D97706' },
          { label: 'Actifs',        value: String(activeCount ?? 0), color: '#22C55E' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px',
            borderLeft: `3px solid ${s.color}`,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        {!accounts?.length ? (
          <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '60px 20px' }}>
            Aucun compte Business créé pour l&apos;instant.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Entreprise', 'Pays', 'Plan', 'Statut', 'Membres', 'Créé le', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#4b5563', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => {
                const sub = (acc.biz_subscriptions as unknown as Array<{ status: string; trial_ends_at: string | null; renews_at: string | null }>)?.[0]
                const pc = PLAN_COLOR[acc.plan] ?? PLAN_COLOR.trial
                const memberCount = (acc.biz_members as unknown as Array<{ count: number }>)?.[0]?.count ?? 0
                return (
                  <tr key={acc.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '11px 16px', color: '#e5e7eb', fontWeight: 600 }}>{acc.name}</td>
                    <td style={{ padding: '11px 16px', color: '#6b7280' }}>{acc.country}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: pc.bg, color: pc.color }}>
                        {acc.plan.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#9ca3af' }}>
                      {sub?.status ?? acc.status}
                      {sub?.trial_ends_at && (
                        <span style={{ fontSize: 10, color: '#6b7280', display: 'block' }}>
                          expire {new Date(sub.trial_ends_at).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                      {memberCount}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#6b7280' }}>
                      {new Date(acc.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <Link
                        href={`/admin/business/${acc.id}`}
                        style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', textDecoration: 'none' }}
                      >
                        Détail →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
