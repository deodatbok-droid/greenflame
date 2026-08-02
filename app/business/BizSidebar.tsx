'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { NAV_GROUPS } from './biz-nav-items'

interface BizSidebarProps {
  accountName: string
  plan: string
  userInitials: string
}

const PLAN_BADGE: Record<string, { label: string; color: string }> = {
  trial:    { label: 'Essai',    color: '#F59E0B' },
  starter:  { label: 'Starter', color: '#3B82F6' },
  business: { label: 'Business',color: '#8B5CF6' },
  pro:      { label: 'Pro',     color: '#22C55E' },
}

export default function BizSidebar({ accountName, plan, userInitials }: BizSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const planBadge = PLAN_BADGE[plan] ?? PLAN_BADGE.trial

  function isActive(href: string) {
    if (href === '/business/dashboard') return pathname === '/business/dashboard' || pathname === '/business'
    if (href === '/business/stock') return pathname === '/business/stock' || pathname === '/business/stock/ajouter'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="biz-sidebar" style={{
      width: collapsed ? 60 : 224, flexShrink: 0,
      transition: 'width .22s cubic-bezier(.4,0,.2,1)',
      background: '#0D1117',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh',
      overflowY: 'auto', overflowX: 'hidden',
    }}>

      {/* Logo + Compte */}
      <div style={{
        padding: collapsed ? '14px 0' : '16px 12px',
        borderBottom: '1px solid #1A2232',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        minHeight: 60,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 900, color: '#fff',
          boxShadow: '0 2px 8px rgba(34,197,94,.35)',
        }}>GF</div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
              {accountName}
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.05em',
              color: planBadge.color,
              textTransform: 'uppercase',
            }}>
              {planBadge.label}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ padding: '8px 6px', flex: 1 }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 6 }}>
            {!collapsed ? (
              <div style={{ fontSize: 9, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.1em', padding: '8px 6px 4px' }}>
                {group.label}
              </div>
            ) : (
              <div style={{ height: 1, background: '#1A2232', margin: '8px 6px 6px' }} />
            )}
            {group.items.map(item => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`biz-nav-link${active ? ' active' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: collapsed ? 0 : 9,
                    padding: collapsed ? '7px 0' : '7px 10px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 8, marginBottom: 1, fontSize: 13,
                    color: active ? '#22C55E' : '#64748B',
                    fontWeight: active ? 600 : 400,
                    background: active ? '#1A2232' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all .12s',
                    position: 'relative',
                  }}
                >
                  {active && !collapsed && (
                    <span style={{
                      position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
                      width: 3, height: 16, background: '#22C55E', borderRadius: '0 2px 2px 0',
                    }} />
                  )}
                  <span style={{ fontSize: 15, width: collapsed ? 'auto' : 18, textAlign: 'center', flexShrink: 0, lineHeight: 1 }}>
                    {item.icon}
                  </span>
                  {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #1A2232', padding: '8px 6px' }}>
        {/* User avatar */}
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 4 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff',
            }}>
              {userInitials}
            </div>
            <span style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Mon compte
            </span>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
          style={{
            width: '100%', padding: '7px', borderRadius: 8,
            border: 'none', background: 'transparent', color: '#334155',
            cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start', gap: 8,
            transition: 'color .12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
        >
          <span style={{ fontSize: 11, display: 'inline-block', transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>◂</span>
          {!collapsed && <span style={{ fontSize: 11 }}>Réduire</span>}
        </button>

        {/* Back to GreenFlame */}
        <a
          href="https://greenflameafrica.com/merchant/dashboard"
          title="← Retour à GreenFlame"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px', borderRadius: 8,
            fontSize: 11, color: '#475569', textDecoration: 'none',
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'color .12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#22C55E')}
          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
        >
          <span>←</span>
          {!collapsed && <span>GreenFlame</span>}
        </a>
      </div>
    </aside>
  )
}
