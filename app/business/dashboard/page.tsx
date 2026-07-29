import { getBizSession, formatBizAmount } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'

async function getBizKPIs(businessId: string) {
  const svc = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const [salesRes, lowStockRes, invoicesRes, stockValueRes] = await Promise.all([
    svc.from('biz_pos_transactions')
      .select('total')
      .eq('business_id', businessId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`),

    svc.from('biz_v_low_stock')
      .select('product_id, product_name, quantity, alert_threshold, stock_status')
      .eq('business_id', businessId)
      .order('quantity'),

    svc.from('biz_invoices')
      .select('id, total, paid_amount, status, customer_id')
      .eq('business_id', businessId)
      .in('status', ['sent', 'partial', 'overdue'])
      .order('created_at', { ascending: false })
      .limit(5),

    svc.from('biz_v_stock_value')
      .select('total_value, product_count')
      .eq('business_id', businessId)
      .maybeSingle(),
  ])

  const caDuJour = (salesRes.data ?? []).reduce((s, r) => s + (r.total ?? 0), 0)
  const ruptures = (lowStockRes.data ?? []).filter(r => r.stock_status === 'rupture')
  const alertes  = (lowStockRes.data ?? []).filter(r => r.stock_status === 'alerte')
  const impayees = invoicesRes.data ?? []
  const totalDu  = impayees.reduce((s, r) => s + ((r.total ?? 0) - (r.paid_amount ?? 0)), 0)
  const stockVal = stockValueRes.data?.total_value ?? 0
  const productCount = stockValueRes.data?.product_count ?? 0

  return { caDuJour, ruptures, alertes, impayees, totalDu, stockVal, productCount }
}

export default async function BizDashboardPage() {
  const session = await getBizSession()
  const kpi     = await getBizKPIs(session.account.id)
  const { currency } = session.account

  const fmt = (n: number) => formatBizAmount(n, currency)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
          {session.account.name}
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Tableau de bord
        </h1>
        <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 32 }}>

        <KpiCard
          label="CA aujourd'hui"
          value={fmt(kpi.caDuJour)}
          sub={`${kpi.impayees.length} ventes enregistrées`}
          accent="#22C55E"
        />
        <KpiCard
          label="Valeur du stock"
          value={fmt(kpi.stockVal)}
          sub={`${kpi.productCount} références`}
          accent="#3B82F6"
        />
        <KpiCard
          label="Ruptures"
          value={String(kpi.ruptures.length)}
          sub={`${kpi.alertes.length} en alerte faible`}
          accent={kpi.ruptures.length > 0 ? '#EF4444' : '#22C55E'}
        />
        <KpiCard
          label="Factures impayées"
          value={fmt(kpi.totalDu)}
          sub={`${kpi.impayees.length} facture${kpi.impayees.length !== 1 ? 's' : ''} en attente`}
          accent={kpi.totalDu > 0 ? '#F59E0B' : '#22C55E'}
        />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
          Actions rapides
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { href: '/business/caisse', label: 'Ouvrir la caisse', icon: '◩', color: '#22C55E' },
            { href: '/business/ventes/nouveau', label: 'Nouvelle facture', icon: '◧', color: '#3B82F6' },
            { href: '/business/stock/ajouter', label: 'Ajouter un produit', icon: '◫', color: '#8B5CF6' },
            { href: '/business/clients/nouveau', label: 'Nouveau client', icon: '◎', color: '#F59E0B' },
          ].map(a => (
            <a key={a.href} href={a.href} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 10, background: '#fff',
              border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 600,
              color: '#0F172A', textDecoration: 'none',
            }}>
              <span style={{ color: a.color, fontSize: 16 }}>{a.icon}</span>
              {a.label}
            </a>
          ))}
        </div>
      </div>

      {/* Stock alertes */}
      {(kpi.ruptures.length > 0 || kpi.alertes.length > 0) && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Stock à réapprovisionner
            </h2>
            <a href="/business/stock" style={{ fontSize: 12, color: '#22C55E', textDecoration: 'none', fontWeight: 600 }}>Voir tout →</a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ textAlign: 'left', padding: '8px 18px', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Produit</th>
                <th style={{ textAlign: 'right', padding: '8px 18px', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Stock</th>
                <th style={{ textAlign: 'right', padding: '8px 18px', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Seuil</th>
                <th style={{ textAlign: 'center', padding: '8px 18px', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {[...kpi.ruptures, ...kpi.alertes].slice(0, 8).map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 18px', color: '#0F172A', fontWeight: 500 }}>{r.product_name}</td>
                  <td style={{ padding: '10px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.stock_status === 'rupture' ? '#EF4444' : '#F59E0B', fontWeight: 700 }}>
                    {r.quantity}
                  </td>
                  <td style={{ padding: '10px 18px', textAlign: 'right', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>{r.alert_threshold}</td>
                  <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      background: r.stock_status === 'rupture' ? '#FEF2F2' : '#FFFBEB',
                      color:      r.stock_status === 'rupture' ? '#EF4444'  : '#F59E0B',
                    }}>
                      {r.stock_status === 'rupture' ? 'RUPTURE' : 'ALERTE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Factures récentes */}
      {kpi.impayees.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Factures en attente</h2>
            <a href="/business/ventes" style={{ fontSize: 12, color: '#22C55E', textDecoration: 'none', fontWeight: 600 }}>Voir tout →</a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ textAlign: 'left', padding: '8px 18px', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Statut</th>
                <th style={{ textAlign: 'right', padding: '8px 18px', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Total</th>
                <th style={{ textAlign: 'right', padding: '8px 18px', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Restant dû</th>
              </tr>
            </thead>
            <tbody>
              {kpi.impayees.map((inv, i) => (
                <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 18px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      background: inv.status === 'overdue' ? '#FEF2F2' : '#FFFBEB',
                      color:      inv.status === 'overdue' ? '#EF4444'  : '#F59E0B',
                    }}>
                      {inv.status === 'overdue' ? 'EN RETARD' : inv.status === 'partial' ? 'PARTIEL' : 'ENVOYÉE'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0F172A' }}>
                    {fmt(inv.total ?? 0)}
                  </td>
                  <td style={{ padding: '10px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#EF4444', fontWeight: 700 }}>
                    {fmt((inv.total ?? 0) - (inv.paid_amount ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state si aucune donnée */}
      {kpi.caDuJour === 0 && kpi.stockVal === 0 && kpi.impayees.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>◈</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Bienvenue sur GreenFlame Business</p>
          <p style={{ fontSize: 13, marginBottom: 24 }}>Commencez par ajouter vos produits et configurer votre caisse.</p>
          <a href="/business/stock/ajouter" style={{
            display: 'inline-block', padding: '12px 24px', borderRadius: 10,
            background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Ajouter mon premier produit →
          </a>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
      padding: '16px 18px', borderLeft: `3px solid ${accent}`,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</p>
    </div>
  )
}
