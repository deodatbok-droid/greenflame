'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { href: '/business/dashboard', label: 'Tableau de bord', icon: '▦' },
      { href: '/business/rapports',  label: 'Rapports',        icon: '▲' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/business/caisse',         label: 'Caisse',         icon: '◩' },
      { href: '/business/ventes',         label: 'Factures',       icon: '◧' },
      { href: '/business/devis',          label: 'Devis',          icon: '◫' },
      { href: '/business/clients',        label: 'Clients',        icon: '◎' },
    ],
  },
  {
    label: 'Inventaire',
    items: [
      { href: '/business/stock',           label: 'Produits',       icon: '▣' },
      { href: '/business/stock/mouvement', label: 'Mouvements',     icon: '⇄' },
      { href: '/business/fournisseurs',    label: 'Fournisseurs',   icon: '◉' },
      { href: '/business/achats',          label: 'Achats',         icon: '◪' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/business/equipe',      label: 'Équipe',         icon: '◐' },
      { href: '/business/parametres', label: 'Paramètres',      icon: '◌' },
    ],
  },
]

export default function BizSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  function isActive(href: string) {
    if (href === '/business/dashboard') return pathname === '/business/dashboard' || pathname === '/business'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      <style>{`
        .biz-link { color:#94A3B8; text-decoration:none; transition:background .12s,color .12s; }
        .biz-link:hover { background:#1E293B !important; color:#F1F5F9 !important; }
        .biz-link.on { background:#1E293B; color:#22C55E; font-weight:600; }
        .biz-collapse:hover { color:#94A3B8 !important; }
        .biz-back:hover { color:#22C55E !important; }
      `}</style>

      <aside style={{
        width: collapsed ? 64 : 220, flexShrink: 0, transition: 'width .2s',
        background: '#0F172A', display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: collapsed ? '16px 0' : '18px 16px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#000', flexShrink: 0 }}>GF</div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap' }}>GreenFlame</div>
              <div style={{ fontSize: 9, color: '#475569', letterSpacing: '.06em', textTransform: 'uppercase' }}>Business</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              {!collapsed && (
                <div style={{ fontSize: 9, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.1em', padding: '8px 8px 4px' }}>
                  {group.label}
                </div>
              )}
              {collapsed && <div style={{ height: 1, background: '#1E293B', margin: '8px 6px 4px' }} />}
              {group.items.map(item => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`biz-link${active ? ' on' : ''}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9,
                      padding: collapsed ? '9px 0' : '8px 10px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      borderRadius: 8, marginBottom: 1, fontSize: 13,
                    }}
                  >
                    <span style={{ fontSize: 14, width: collapsed ? 'auto' : 18, textAlign: 'center', flexShrink: 0, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                    {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #1E293B', padding: '8px 8px' }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="biz-collapse"
            title={collapsed ? 'Déplier' : 'Réduire'}
            style={{ width: '100%', padding: '7px', borderRadius: 8, border: 'none', background: 'transparent', color: '#334155', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8 }}
          >
            <span style={{ fontSize: 12, transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>◂</span>
            {!collapsed && <span style={{ fontSize: 11 }}>Réduire</span>}
          </button>
          <a
            href="https://greenflameafrica.com/merchant/dashboard"
            className="biz-back"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px', borderRadius: 8, fontSize: 11, color: '#475569', textDecoration: 'none', justifyContent: collapsed ? 'center' : 'flex-start' }}
            title={collapsed ? '← GreenFlame' : undefined}
          >
            <span>←</span>
            {!collapsed && <span>GreenFlame</span>}
          </a>
        </div>
      </aside>
    </>
  )
}
