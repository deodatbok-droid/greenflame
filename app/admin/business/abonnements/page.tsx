import { requireAdmin } from '@/lib/utils/admin-guard'
import { createServiceClient } from '@/lib/supabase/server'

export default async function AdminBizAbonnementsPage() {
  await requireAdmin()
  const svc = createServiceClient()

  const { data: subs } = await svc
    .from('biz_subscriptions')
    .select('id, plan, status, amount_fcfa, trial_ends_at, renews_at, created_at, biz_accounts(name, country)')
    .order('created_at', { ascending: false })
    .limit(100)

  const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
    trial:     { bg: '#FFFBEB', color: '#D97706' },
    active:    { bg: '#F0FDF4', color: '#16A34A' },
    expired:   { bg: '#FEF2F2', color: '#EF4444' },
    cancelled: { bg: '#F8FAFC', color: '#6B7280' },
  }

  const revenue = (subs ?? []).filter(s => s.status === 'active' && s.amount_fcfa).reduce((t, s) => t + (s.amount_fcfa ?? 0), 0)

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Abonnements Business</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>MRR estimé : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(revenue)}</p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        {!subs?.length ? (
          <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '60px 20px' }}>
            Aucun abonnement Business enregistré.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Entreprise', 'Plan', 'Statut', 'Montant', 'Fin trial / Renouvellement', 'Créé le'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#4b5563', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map(sub => {
                const sc = STATUS_COLOR[sub.status] ?? STATUS_COLOR.cancelled
                const acc = sub.biz_accounts as unknown as { name: string; country: string } | null
                const deadline = sub.trial_ends_at ?? sub.renews_at
                return (
                  <tr key={sub.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '11px 16px', color: '#e5e7eb', fontWeight: 600 }}>
                      {acc?.name ?? '—'}
                      {acc?.country && <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6 }}>{acc.country}</span>}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#9ca3af', textTransform: 'capitalize' }}>{sub.plan}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>
                        {sub.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#e5e7eb', fontVariantNumeric: 'tabular-nums' }}>
                      {sub.amount_fcfa
                        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(sub.amount_fcfa)
                        : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#6b7280' }}>
                      {deadline ? new Date(deadline).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#6b7280' }}>
                      {new Date(sub.created_at).toLocaleDateString('fr-FR')}
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
