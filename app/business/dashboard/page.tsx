import { getBizSession, formatBizAmount } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import QuickAction from './QuickAction'

async function getBizKPIs(businessId: string) {
  const svc = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const [salesRes, salesYestRes, lowStockRes, invoicesRes, stockValueRes] = await Promise.all([
    svc.from('biz_pos_transactions')
      .select('total, payment_method')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`),

    svc.from('biz_pos_transactions')
      .select('total')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', `${yesterday}T00:00:00`)
      .lte('created_at', `${yesterday}T23:59:59`),

    svc.from('biz_v_low_stock')
      .select('product_id, product_name, quantity, alert_threshold, stock_status')
      .eq('business_id', businessId)
      .order('quantity')
      .limit(8),

    svc.from('biz_invoices')
      .select('id, number, total, paid_amount, status, due_date, biz_customers(name)')
      .eq('business_id', businessId)
      .in('status', ['sent', 'partial', 'overdue'])
      .order('created_at', { ascending: false })
      .limit(5),

    svc.from('biz_v_stock_value')
      .select('total_value, product_count')
      .eq('business_id', businessId)
      .maybeSingle(),
  ])

  const caDuJour  = (salesRes.data ?? []).reduce((s, r) => s + (r.total ?? 0), 0)
  const caHier    = (salesYestRes.data ?? []).reduce((s, r) => s + (r.total ?? 0), 0)
  const ventes    = salesRes.data ?? []
  const ruptures  = (lowStockRes.data ?? []).filter(r => r.stock_status === 'rupture')
  const alertes   = (lowStockRes.data ?? []).filter(r => r.stock_status === 'alerte')
  const impayees  = invoicesRes.data ?? []
  const totalDu   = impayees.reduce((s, r) => s + ((r.total ?? 0) - (r.paid_amount ?? 0)), 0)
  const stockVal  = stockValueRes.data?.total_value ?? 0
  const productCount = stockValueRes.data?.product_count ?? 0
  const trend = caHier > 0 ? Math.round(((caDuJour - caHier) / caHier) * 100) : null

  return { caDuJour, caHier, trend, ventes, ruptures, alertes, impayees, totalDu, stockVal, productCount }
}

export default async function BizDashboardPage() {
  const session = await getBizSession()
  const kpi     = await getBizKPIs(session.account.id)
  const { currency } = session.account
  const fmt = (n: number) => formatBizAmount(n, currency)

  const now    = new Date()
  const hour   = now.getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const isEmpty = kpi.caDuJour === 0 && kpi.stockVal === 0 && kpi.impayees.length === 0

  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    sent:    { bg: '#FFFBEB', color: '#D97706', label: 'Envoyée' },
    partial: { bg: '#FFF7ED', color: '#EA580C', label: 'Partiel' },
    overdue: { bg: '#FEF2F2', color: '#EF4444', label: 'En retard' },
  }

  return (
    <div style={{ padding: '0 0 40px' }}>

      {/* ── Hero banner ───────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0D1117 0%, #0B1A0F 60%, #0D1117 100%)',
        padding: '28px 32px 24px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Décoration */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, left: 120, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>
            {dateStr}
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F1F5F9', margin: '0 0 20px' }}>
            {greeting}, {session.account.name} 👋
          </h1>

          {/* Mini KPIs dans le hero */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              {
                label: "CA aujourd'hui",
                value: fmt(kpi.caDuJour),
                trend: kpi.trend,
                icon: '💰',
              },
              {
                label: 'Valeur du stock',
                value: fmt(kpi.stockVal),
                sub: `${kpi.productCount} références`,
                icon: '📦',
              },
              {
                label: 'Créances ouvertes',
                value: fmt(kpi.totalDu),
                sub: `${kpi.impayees.length} facture${kpi.impayees.length !== 1 ? 's' : ''}`,
                icon: '🧾',
                urgent: kpi.totalDu > 0,
              },
              {
                label: 'Alertes stock',
                value: String(kpi.ruptures.length),
                sub: `${kpi.alertes.length} en alerte`,
                icon: '⚠️',
                urgent: kpi.ruptures.length > 0,
              },
            ].map(k => (
              <div key={k.label} style={{
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 12, padding: '12px 16px',
                minWidth: 140, flex: '1 1 140px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.label}</span>
                  <span style={{ fontSize: 14 }}>{k.icon}</span>
                </div>
                <p style={{ fontSize: 20, fontWeight: 800, color: k.urgent ? '#FBBF24' : '#F1F5F9', fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                  {k.value}
                </p>
                {k.trend !== undefined && k.trend !== null && (
                  <p style={{ fontSize: 10, color: k.trend >= 0 ? '#22C55E' : '#EF4444', margin: '3px 0 0', fontWeight: 700 }}>
                    {k.trend >= 0 ? '↑' : '↓'} {Math.abs(k.trend)}% vs hier
                  </p>
                )}
                {k.sub && <p style={{ fontSize: 10, color: '#475569', margin: '3px 0 0' }}>{k.sub}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px 0' }}>

        {/* ── Actions rapides ─────────────────────────────────────── */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>
            Actions rapides
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { href: '/business/caisse',         icon: '🖥️', label: 'Ouvrir la caisse',    desc: 'Enregistrer une vente',     accent: '#22C55E' },
              { href: '/business/ventes/nouveau',  icon: '🧾', label: 'Nouvelle facture',    desc: 'Facturer un client',        accent: '#3B82F6' },
              { href: '/business/devis/nouveau',   icon: '📋', label: 'Nouveau devis',       desc: 'Créer une offre de prix',   accent: '#8B5CF6' },
              { href: '/business/stock/ajouter',   icon: '📦', label: 'Ajouter un produit',  desc: 'Référencer un article',     accent: '#F59E0B' },
              { href: '/business/stock/mouvement', icon: '↕️', label: 'Entrée de stock',     desc: 'Réceptionner marchandise',  accent: '#14B8A6' },
              { href: '/business/rapports',        icon: '📊', label: 'Voir les rapports',   desc: 'Tendances & analyses',      accent: '#EF4444' },
            ].map(a => (
              <QuickAction key={a.href} {...a} />
            ))}
          </div>
        </section>

        {/* ── Empty state ─────────────────────────────────────────── */}
        {isEmpty && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px dashed #E2E8F0', padding: '48px 32px', textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌿</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Bienvenue sur GreenFlame Business</h2>
            <p style={{ fontSize: 14, color: '#64748B', maxWidth: 420, margin: '0 auto 24px' }}>
              Votre espace business est prêt. Commencez par ajouter vos produits pour activer la caisse et l&apos;inventaire.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/business/stock/ajouter" style={{ padding: '10px 22px', borderRadius: 10, background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                Ajouter mon premier produit →
              </Link>
              <Link href="/business/caisse" style={{ padding: '10px 22px', borderRadius: 10, background: '#F0FDF4', color: '#16A34A', fontWeight: 700, fontSize: 14, textDecoration: 'none', border: '1px solid #BBF7D0' }}>
                Essayer la caisse
              </Link>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: kpi.impayees.length > 0 && (kpi.ruptures.length > 0 || kpi.alertes.length > 0) ? '1fr 1fr' : '1fr', gap: 16 }}>

          {/* ── Factures en attente ──────────────────────────────── */}
          {kpi.impayees.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🧾</span>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Factures en attente</h2>
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#D97706', padding: '2px 7px', borderRadius: 20 }}>
                    {fmt(kpi.totalDu)}
                  </span>
                </div>
                <Link href="/business/ventes" style={{ fontSize: 12, color: '#22C55E', textDecoration: 'none', fontWeight: 600 }}>Tout voir →</Link>
              </div>
              <div>
                {kpi.impayees.map((inv, i) => {
                  const s = STATUS_STYLE[inv.status] ?? STATUS_STYLE.sent
                  const restant = (inv.total ?? 0) - (inv.paid_amount ?? 0)
                  return (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: i < kpi.impayees.length - 1 ? '1px solid #F8FAFC' : 'none', gap: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: s.bg, color: s.color, flexShrink: 0 }}>{s.label}</span>
                      <span style={{ fontSize: 13, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(inv.biz_customers as { name?: string } | null)?.name ?? 'Client anonyme'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {fmt(restant)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Alertes stock ────────────────────────────────────── */}
          {(kpi.ruptures.length > 0 || kpi.alertes.length > 0) && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Stock à réapprovisionner</h2>
                  {kpi.ruptures.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF2F2', color: '#EF4444', padding: '2px 7px', borderRadius: 20 }}>
                      {kpi.ruptures.length} rupture{kpi.ruptures.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <Link href="/business/stock" style={{ fontSize: 12, color: '#22C55E', textDecoration: 'none', fontWeight: 600 }}>Voir stock →</Link>
              </div>
              <div>
                {[...kpi.ruptures, ...kpi.alertes].slice(0, 6).map((r, i) => (
                  <div key={r.product_id} style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderBottom: i < Math.min(kpi.ruptures.length + kpi.alertes.length, 6) - 1 ? '1px solid #F8FAFC' : 'none', gap: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      background: r.stock_status === 'rupture' ? '#FEF2F2' : '#FFFBEB',
                      color: r.stock_status === 'rupture' ? '#EF4444' : '#F59E0B',
                      flexShrink: 0,
                    }}>
                      {r.stock_status === 'rupture' ? 'RUPTURE' : 'ALERTE'}
                    </span>
                    <span style={{ fontSize: 13, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product_name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.stock_status === 'rupture' ? '#EF4444' : '#F59E0B', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {r.quantity} / {r.alert_threshold}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 18px', borderTop: '1px solid #F8FAFC' }}>
                <Link href="/business/stock/mouvement" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8,
                  background: '#F0FDF4', color: '#16A34A',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                }}>
                  ↕️ Enregistrer une entrée de stock
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Lien rapide vers rapports ──────────────────────────── */}
        {!isEmpty && (
          <div style={{ marginTop: 16, background: 'linear-gradient(135deg, #0D1117 0%, #0B1A0F 100%)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>📊 Voir l&apos;analyse complète</p>
              <p style={{ fontSize: 11, color: '#475569', margin: '3px 0 0' }}>CA 30j, marges, top produits, modes de paiement</p>
            </div>
            <Link href="/business/rapports" style={{ padding: '8px 18px', borderRadius: 8, background: '#22C55E', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              Rapports →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
