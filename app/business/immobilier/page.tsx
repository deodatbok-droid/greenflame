import { getBizSession, formatBizAmount } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  appartement:       'Appartement',
  maison_villa:      'Maison / Villa',
  terrain_parcelle:  'Terrain / Parcelle',
  local_commercial:  'Local commercial',
  bureau:            'Bureau',
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  disponible: { label: 'Disponible', bg: '#F0FDF4', color: '#16A34A' },
  loue:       { label: 'Loué',       bg: '#EFF6FF', color: '#3B82F6' },
  vendu:      { label: 'Vendu',      bg: '#EFF6FF', color: '#3B82F6' },
  suspendu:   { label: 'Suspendu',   bg: '#F1F5F9', color: '#64748B' },
}

async function getBiens(businessId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_properties')
    .select('id, title, listing_type, property_type, price_fcfa, price_period, city, neighborhood, status, gf_listed, photos')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function ImmobilierPage() {
  const session = await getBizSession()
  const biens   = await getBiens(session.account.id)
  const fmt     = (n: number) => formatBizAmount(n, session.account.currency)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Immobilier</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Mes biens</h1>
        </div>
        <Link href="/business/immobilier/nouveau" style={{
          padding: '10px 18px', borderRadius: 10, background: '#22C55E',
          fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none',
        }}>
          + Nouveau bien
        </Link>
      </div>

      {biens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94A3B8' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⌂</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Aucun bien enregistré</p>
          <p style={{ fontSize: 13, marginBottom: 24 }}>Ajoutez vos biens à louer ou à vendre pour commencer à gérer votre portefeuille.</p>
          <Link href="/business/immobilier/nouveau" style={{
            display: 'inline-block', padding: '12px 24px', borderRadius: 10,
            background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Ajouter un bien →
          </Link>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={th}>Bien</th>
                <th style={th}>Type</th>
                <th style={th}>Zone</th>
                <th style={{ ...th, textAlign: 'right' }}>Prix</th>
                <th style={{ ...th, textAlign: 'center' }}>Statut</th>
                <th style={{ ...th, textAlign: 'center' }}>GF</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {biens.map(b => {
                const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.disponible
                return (
                  <tr key={b.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '11px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {b.photos?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.photos[0]} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F1F5F9', flexShrink: 0 }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{b.title}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.listing_type === 'location' ? 'À louer' : 'À vendre'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>
                      {PROPERTY_TYPE_LABELS[b.property_type] ?? b.property_type}
                    </td>
                    <td style={{ padding: '11px 18px', color: '#64748B' }}>
                      {[b.neighborhood, b.city].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0F172A', fontWeight: 600 }}>
                      {fmt(b.price_fcfa)}{b.price_period === 'mensuel' ? ' /mois' : ''}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>
                        {badge.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'center' }}>
                      {b.gf_listed ? (
                        <span title="Listé sur le catalogue GreenFlame" style={{ fontSize: 16 }}>✅</span>
                      ) : (
                        <span style={{ color: '#CBD5E1' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}>
                      <Link href={`/business/immobilier/${b.id}`} style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                        border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#3B82F6', textDecoration: 'none',
                      }}>
                        Modifier
                      </Link>
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
