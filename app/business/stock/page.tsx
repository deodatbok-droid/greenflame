import { getBizSession, formatBizAmount } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

async function getStock(businessId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_inventory')
    .select(`
      id, quantity, cmup, alert_threshold,
      product:biz_products(id, name, sku, barcode, unit_price, tax_rate, gf_listed,
        category:biz_categories(name))
    `)
    .eq('business_id', businessId)
    .order('quantity', { ascending: true })

  return data ?? []
}

export default async function StockPage() {
  const session = await getBizSession()
  const stock   = await getStock(session.account.id)
  const fmt     = (n: number) => formatBizAmount(n, session.account.currency)

  const ruptures = stock.filter(s => s.quantity <= 0)
  const alertes  = stock.filter(s => s.quantity > 0 && s.quantity <= (s.alert_threshold ?? 0))
  const ok       = stock.filter(s => s.quantity > (s.alert_threshold ?? 0) || s.alert_threshold == null)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Stock</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Inventaire</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/business/stock/mouvement" style={{
            padding: '10px 16px', borderRadius: 10, border: '1px solid #E2E8F0',
            fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none', background: '#fff',
          }}>
            Mouvement de stock
          </Link>
          <Link href="/business/stock/ajouter" style={{
            padding: '10px 18px', borderRadius: 10, background: '#22C55E',
            fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none',
          }}>
            + Nouveau produit
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Références', value: String(stock.length), color: '#3B82F6' },
          { label: 'Ruptures',   value: String(ruptures.length), color: '#EF4444' },
          { label: 'Alertes',    value: String(alertes.length),  color: '#F59E0B' },
          { label: 'Valeur totale', value: fmt(stock.reduce((s, r) => s + (r.quantity * (r.cmup ?? 0)), 0)), color: '#22C55E' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
            padding: '14px 16px', borderLeft: `3px solid ${s.color}`,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {stock.length === 0 ? (
        <EmptyStock />
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={th}>Produit</th>
                <th style={th}>Catégorie</th>
                <th style={{ ...th, textAlign: 'right' }}>Prix vente</th>
                <th style={{ ...th, textAlign: 'right' }}>CMUP</th>
                <th style={{ ...th, textAlign: 'right' }}>Stock</th>
                <th style={{ ...th, textAlign: 'center' }}>Statut</th>
                <th style={{ ...th, textAlign: 'center' }}>GF</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...ruptures, ...alertes, ...ok].map(row => {
                const p = row.product as unknown as {
                  id: string; name: string; sku?: string; barcode?: string
                  unit_price?: number; tax_rate?: number; gf_listed?: boolean
                  category?: { name: string }
                }
                const isRupture = row.quantity <= 0
                const isAlerte  = !isRupture && row.quantity <= (row.alert_threshold ?? 0)
                return (
                  <tr key={row.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '11px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{p?.name}</div>
                      {p?.sku && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>SKU: {p.sku}</div>}
                    </td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>
                      {(p?.category as { name?: string } | undefined)?.name ?? '—'}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0F172A', fontWeight: 600 }}>
                      {p?.unit_price != null ? fmt(p.unit_price) : '—'}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748B' }}>
                      {row.cmup != null ? fmt(row.cmup) : '—'}
                    </td>
                    <td style={{
                      padding: '11px 18px', textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums', fontWeight: 700,
                      color: isRupture ? '#EF4444' : isAlerte ? '#F59E0B' : '#22C55E',
                    }}>
                      {row.quantity}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'center' }}>
                      {isRupture ? (
                        <Badge text="RUPTURE" bg="#FEF2F2" color="#EF4444" />
                      ) : isAlerte ? (
                        <Badge text="ALERTE" bg="#FFFBEB" color="#F59E0B" />
                      ) : (
                        <Badge text="OK" bg="#F0FDF4" color="#16A34A" />
                      )}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'center' }}>
                      {p?.gf_listed ? (
                        <span title="Listé sur GreenFlame" style={{ fontSize: 16 }}>✅</span>
                      ) : (
                        <span style={{ color: '#CBD5E1' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Link href={`/business/stock/${p?.id}/mouvement`} style={actionBtn}>
                          Entrée
                        </Link>
                        <Link href={`/business/stock/${p?.id}`} style={{ ...actionBtn, color: '#3B82F6', borderColor: '#BFDBFE', background: '#EFF6FF' }}>
                          Détail
                        </Link>
                      </div>
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

const actionBtn: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
  border: '1px solid #D1FAE5', background: '#ECFDF5', color: '#16A34A',
  textDecoration: 'none',
}

function Badge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: bg, color }}>
      {text}
    </span>
  )
}

function EmptyStock() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94A3B8' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>◫</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Aucun produit en stock</p>
      <p style={{ fontSize: 13, marginBottom: 24 }}>Ajoutez vos premiers produits pour suivre votre inventaire.</p>
      <Link href="/business/stock/ajouter" style={{
        display: 'inline-block', padding: '12px 24px', borderRadius: 10,
        background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
      }}>
        Ajouter un produit →
      </Link>
    </div>
  )
}
