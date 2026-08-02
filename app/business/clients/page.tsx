import { getBizSession } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

async function getClients(businessId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_customers')
    .select('id, name, phone, email, gf_user_id, total_spent, last_purchase_at, created_at')
    .eq('business_id', businessId)
    .order('last_purchase_at', { ascending: false, nullsFirst: false })
  return data ?? []
}

export default async function ClientsPage() {
  const session = await getBizSession()
  const clients = await getClients(session.account.id)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>CRM</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Clients</h1>
        </div>
        <Link href="/business/clients/nouveau" style={{
          padding: '10px 18px', borderRadius: 10, background: '#22C55E',
          fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none',
        }}>
          + Nouveau client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94A3B8' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Aucun client enregistré</p>
          <p style={{ fontSize: 13, marginBottom: 24 }}>Ajoutez vos clients pour suivre leurs achats et leur fidélité.</p>
          <Link href="/business/clients/nouveau" style={{
            display: 'inline-block', padding: '12px 24px', borderRadius: 10,
            background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Ajouter un client →
          </Link>
        </div>
      ) : (
        <div className="biz-table-scroll" style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={th}>Client</th>
                <th style={th}>Contact</th>
                <th style={{ ...th, textAlign: 'center' }}>GreenFlame</th>
                <th style={{ ...th, textAlign: 'right' }}>Total dépensé</th>
                <th style={{ ...th, textAlign: 'right' }}>Dernier achat</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{c.name}</div>
                  </td>
                  <td style={{ padding: '12px 18px', color: '#64748B' }}>
                    {c.phone && <div>{c.phone}</div>}
                    {c.email && <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.email}</div>}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                    {c.gf_user_id ? (
                      <span title="Membre GreenFlame" style={{ fontSize: 16 }}>✅</span>
                    ) : (
                      <span style={{ color: '#CBD5E1' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0F172A', fontWeight: 600 }}>
                    {c.total_spent != null
                      ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: session.account.currency ?? 'XOF', maximumFractionDigits: 0 }).format(c.total_spent)
                      : '—'}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748B' }}>
                    {c.last_purchase_at
                      ? new Date(c.last_purchase_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                </tr>
              ))}
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
