'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/business/dashboard', label: 'Tableau de bord', icon: '◈' },
  { href: '/business/stock',     label: 'Stock',           icon: '◫' },
  { href: '/business/ventes',    label: 'Ventes',          icon: '◧' },
  { href: '/business/caisse',    label: 'Caisse',          icon: '◩' },
  { href: '/business/clients',   label: 'Clients',         icon: '◎' },
]

const NAV_SOON = [
  { label: 'Achats',        icon: '◪' },
  { label: 'Comptabilité',  icon: '◬' },
  { label: 'Communauté GF', icon: '◉' },
]

export default function BizSidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      <style>{`
        .biz-nav-link { color: #94A3B8; text-decoration: none; }
        .biz-nav-link:hover { background: #1E293B !important; color: #F1F5F9 !important; }
        .biz-nav-link.active { background: #1E293B; color: #22C55E; }
        .biz-back:hover { color: #22C55E !important; }
      `}</style>

      <aside style={{
        width: 220, flexShrink: 0,
        background: '#0F172A', display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1E293B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#22C55E', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#000',
            }}>GF</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>GreenFlame</div>
              <div style={{ fontSize: 10, color: '#475569', letterSpacing: '.05em', textTransform: 'uppercase' }}>Business</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px 8px' }}>
            Modules
          </div>
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`biz-nav-link${isActive(item.href) ? ' active' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, marginBottom: 2,
                fontSize: 13, fontWeight: 500, transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <div style={{ fontSize: 10, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '.08em', padding: '16px 8px 8px' }}>
            Bientôt
          </div>
          {NAV_SOON.map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8, marginBottom: 2,
              color: '#334155', fontSize: 13,
            }}>
              <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1E293B' }}>
          <a href="https://greenflameafrica.com/merchant/dashboard" className="biz-back" style={{ fontSize: 11, color: '#475569', textDecoration: 'none', transition: 'color .15s' }}>
            ← GreenFlame
          </a>
        </div>
      </aside>
    </>
  )
}
