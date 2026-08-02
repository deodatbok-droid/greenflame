import { getBizSession, formatBizAmount } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'

async function getReportData(businessId: string) {
  const svc = createServiceClient()
  const now = new Date()
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30)
  const d7  = new Date(now); d7.setDate(d7.getDate() - 7)
  const som = new Date(now.getFullYear(), now.getMonth(), 1)

  const [dailyRes, invoicesRes, topProductsRes, stockValRes] = await Promise.all([
    svc.from('biz_pos_transactions')
      .select('total, created_at, payment_method')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', d30.toISOString())
      .order('created_at'),

    svc.from('biz_invoices')
      .select('total, paid_amount, status, created_at')
      .eq('business_id', businessId)
      .gte('created_at', som.toISOString()),

    svc.from('biz_inventory_moves')
      .select('product_id, quantity, move_type, biz_products(name)')
      .eq('business_id', businessId)
      .eq('move_type', 'out')
      .gte('created_at', d30.toISOString()),

    svc.from('biz_v_stock_value')
      .select('total_value, product_count')
      .eq('business_id', businessId)
      .maybeSingle(),
  ])

  const txs = dailyRes.data ?? []
  const invs = invoicesRes.data ?? []
  const moves = topProductsRes.data ?? []

  // Daily sales map
  const byDay: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    byDay[key] = 0
  }
  for (const tx of txs) {
    const key = tx.created_at.slice(0, 10)
    if (key in byDay) byDay[key] += tx.total ?? 0
  }

  const caTotal30j = txs.reduce((s, t) => s + (t.total ?? 0), 0)
  const ca7j = txs.filter(t => t.created_at >= d7.toISOString()).reduce((s, t) => s + (t.total ?? 0), 0)
  const caMois = invs.reduce((s, i) => s + (i.total ?? 0), 0)
  const encaisse = invs.reduce((s, i) => s + (i.paid_amount ?? 0), 0)
  const impayees = caMois - encaisse

  // Top produits vendus
  const prodMap: Record<string, { name: string; qty: number }> = {}
  for (const m of moves) {
    const pid = m.product_id
    const name = (m.biz_products as unknown as { name: string } | null)?.name ?? 'Inconnu'
    if (!prodMap[pid]) prodMap[pid] = { name, qty: 0 }
    prodMap[pid].qty += Number(m.quantity)
  }
  const topProducts = Object.values(prodMap).sort((a, b) => b.qty - a.qty).slice(0, 5)

  // Payment methods
  const byMethod: Record<string, number> = { cash: 0, momo: 0, card: 0 }
  for (const tx of txs) {
    const m = tx.payment_method as string
    if (m in byMethod) byMethod[m] += tx.total ?? 0
  }

  return {
    caTotal30j, ca7j, caMois, encaisse, impayees,
    byDay, topProducts, byMethod,
    stockValue: stockValRes.data?.total_value ?? 0,
    productCount: stockValRes.data?.product_count ?? 0,
    txCount: txs.length,
  }
}

export default async function RapportsPage() {
  const session = await getBizSession()
  const data = await getReportData(session.account.id)
  const fmt = (n: number) => formatBizAmount(n, session.account.currency)

  const days = Object.entries(data.byDay)
  const maxDay = Math.max(...days.map(([, v]) => v), 1)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Analytique</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Rapports</h1>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'CA 30 derniers jours', value: fmt(data.caTotal30j), sub: `${data.txCount} ventes`, color: '#22C55E' },
          { label: 'CA 7 derniers jours',  value: fmt(data.ca7j), sub: 'tendance récente', color: '#3B82F6' },
          { label: 'Factures ce mois',     value: fmt(data.caMois), sub: `${fmt(data.encaisse)} encaissé`, color: '#8B5CF6' },
          { label: 'Créances ouvertes',    value: fmt(data.impayees), sub: 'à encaisser', color: data.impayees > 0 ? '#F59E0B' : '#22C55E' },
          { label: 'Valeur stock',         value: fmt(data.stockValue), sub: `${data.productCount} références`, color: '#64748B' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '14px 16px', borderLeft: `3px solid ${k.color}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums', marginBottom: 2 }}>{k.value}</p>
            <p style={{ fontSize: 10, color: '#94A3B8' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="biz-rapports-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }}>
        {/* Graphique CA 30j */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 20px 12px' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>CA journalier — 30 derniers jours</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
            {days.map(([date, val]) => {
              const pct = maxDay > 0 ? (val / maxDay) * 100 : 0
              const d = new Date(date)
              const isToday = date === new Date().toISOString().slice(0, 10)
              return (
                <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }} title={`${date} : ${fmt(val)}`}>
                  <div style={{
                    width: '100%', borderRadius: '3px 3px 0 0',
                    background: isToday ? '#22C55E' : pct > 0 ? '#BFDBFE' : '#F1F5F9',
                    height: `${Math.max(pct, pct > 0 ? 4 : 2)}%`,
                    transition: 'height .3s',
                  }} />
                  {d.getDate() % 7 === 1 && (
                    <span style={{ fontSize: 8, color: '#CBD5E1', marginTop: 2 }}>{d.getDate()}/{d.getMonth() + 1}</span>
                  )}
                </div>
              )
            })}
          </div>
          {maxDay > 0 && (
            <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 8, textAlign: 'right' }}>
              Pic : {fmt(maxDay)}
            </p>
          )}
          {maxDay === 1 && <p style={{ fontSize: 12, color: '#CBD5E1', textAlign: 'center', marginTop: 8 }}>Aucune vente enregistrée</p>}
        </div>

        {/* Répartition paiements */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Modes de paiement</h2>
          {[
            { key: 'cash', label: 'Espèces', color: '#22C55E' },
            { key: 'momo', label: 'Mobile Money', color: '#F59E0B' },
            { key: 'card', label: 'Carte', color: '#3B82F6' },
          ].map(({ key, label, color }) => {
            const val = data.byMethod[key] ?? 0
            const total = data.caTotal30j || 1
            const pct = Math.round((val / total) * 100)
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                </div>
                <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .3s' }} />
                </div>
                <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{fmt(val)}</p>
              </div>
            )
          })}
          {data.caTotal30j === 0 && <p style={{ fontSize: 12, color: '#CBD5E1', textAlign: 'center', marginTop: 20 }}>Aucune vente</p>}
        </div>
      </div>

      {/* Top produits */}
      {data.topProducts.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px', marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Top 5 produits vendus (30j)</h2>
          {data.topProducts.map((p, i) => {
            const maxQty = data.topProducts[0]?.qty ?? 1
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', width: 16, flexShrink: 0 }}>#{i + 1}</span>
                <span style={{ fontSize: 13, color: '#374151', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <div style={{ width: 120, height: 6, background: '#F1F5F9', borderRadius: 3, flexShrink: 0 }}>
                  <div style={{ height: '100%', width: `${(p.qty / maxQty) * 100}%`, background: '#22C55E', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', width: 40, textAlign: 'right', flexShrink: 0 }}>{p.qty}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
