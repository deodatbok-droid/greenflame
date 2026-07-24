'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import LangToggle from '@/components/ui/LangToggle'

/* ── Navigation ──────────────────────────────────────────────────────────── */

interface NavItem  { href: string; label: string; icon: string }
interface NavGroup { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Gestion',
    items: [
      { href: '/admin/dashboard',    label: 'Dashboard',      icon: '🏠' },
      { href: '/admin/merchants',    label: 'Marchands',      icon: '🏪' },
      { href: '/admin/users',        label: 'Membres',        icon: '👥' },
      { href: '/admin/transactions', label: 'Transactions',   icon: '💸' },
      { href: '/admin/withdrawals',  label: 'Retraits',       icon: '🏧' },
      { href: '/admin/kyc',          label: 'KYC',            icon: '🪪' },
      { href: '/admin/fieldagents',  label: 'Agents terrain', icon: '🧑‍💼' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/admin/reconciliation', label: 'Réconciliation',    icon: '⚖️' },
      { href: '/admin/float',          label: 'Float agents',      icon: '💵' },
      { href: '/admin/revenue',        label: 'Revenus',           icon: '📈' },
      { href: '/admin/tresorerie',     label: 'Trésorerie',        icon: '💰' },
      { href: '/admin/rewards-fund',   label: 'Fonds récompenses', icon: '🎁' },
    ],
  },
  {
    title: 'Plateforme',
    items: [
      { href: '/admin/marketplace', label: 'Marketplace',    icon: '🛒' },
      { href: '/admin/delivery',    label: 'Delivery',       icon: '🚴' },
      { href: '/admin/matrix',      label: 'Matrice réseau', icon: '🕸️' },
      { href: '/admin/leaders',     label: 'Leaders',        icon: '👑' },
      { href: '/admin/ucp',         label: 'Registre UCP',   icon: '🔑' },
      { href: '/admin/waitlist',    label: "Liste d'attente", icon: '⏳' },
      { href: '/admin/flamme',      label: 'Flamme & Rangs', icon: '🔥' },
    ],
  },
  {
    title: 'Analytique',
    items: [
      { href: '/admin/analytics/platform',  label: 'Analytics plateforme', icon: '📊' },
      { href: '/admin/analytics/merchants', label: 'Analytics marchands',  icon: '📉' },
      { href: '/admin/exports',             label: 'Exports',              icon: '📤' },
    ],
  },
]

/* ── Icônes SVG ──────────────────────────────────────────────────────────── */

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  userName: string
  ready: boolean
  mobile?: boolean
  onClose?: () => void
  onReturnToApp: () => void
}

function Sidebar({ collapsed, onToggle, userName, ready, mobile, onClose, onReturnToApp }: SidebarProps) {
  const pathname = usePathname()
  const navRef   = useRef<HTMLDivElement>(null)
  const [fadeTop, setFadeTop]       = useState(false)
  const [fadeBottom, setFadeBottom] = useState(false)

  const narrow = collapsed && !mobile

  const checkScroll = useCallback(() => {
    const el = navRef.current
    if (!el) return
    setFadeTop(el.scrollTop > 8)
    setFadeBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 8)
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [checkScroll])

  function isActive(href: string) {
    if (href === '/admin/dashboard') return pathname === '/admin' || pathname === '/admin/dashboard'
    return pathname.startsWith(href)
  }

  const initial = (userName || 'A').charAt(0).toUpperCase()

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        width: narrow ? 72 : 260,
        flexShrink: 0,
        background: 'linear-gradient(180deg,#080b12 0%,#0c1018 50%,#0e1320 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        transition: ready ? 'width 300ms ease-in-out' : 'none',
      }}
    >
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', height:64, padding:'0 12px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
        <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', background:'rgba(22,163,74,0.12)', border:'1px solid rgba(34,197,94,0.2)' }}>
          <Logo size={26} className="w-[26px] h-[26px]" />
          <span style={{ position:'absolute', bottom:-4, right:-4, fontSize:10 }}>🔥</span>
        </div>
        <div style={{ marginLeft:12, overflow:'hidden', maxWidth: narrow ? 0 : 140, opacity: narrow ? 0 : 1, transition:'max-width 300ms,opacity 300ms' }}>
          <p style={{ color:'#fff', fontWeight:700, fontSize:14, lineHeight:'1.2', whiteSpace:'nowrap', letterSpacing:'-0.02em' }}>GreenFlame</p>
          <p style={{ color:'#4ade80', fontSize:9, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', whiteSpace:'nowrap' }}>Admin</p>
        </div>
        {mobile && (
          <button onClick={onClose} style={{ marginLeft:'auto', width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', border:'none', background:'transparent', color:'#6b7280', cursor:'pointer', fontSize:18 }}>✕</button>
        )}
      </div>

      {/* Nav scrollable */}
      <div style={{ position:'relative', flex:1, overflow:'hidden' }}>
        {/* Fade top */}
        <div style={{ pointerEvents:'none', position:'absolute', inset:'0 0 auto 0', height:32, background:'linear-gradient(to bottom,#080b12,transparent)', opacity: fadeTop ? 1 : 0, transition:'opacity 300ms', zIndex:10 }} />

        <nav ref={navRef} style={{ height:'100%', overflowY:'auto', padding:'12px 8px', scrollbarWidth:'thin', scrollbarColor:'#1e2940 transparent' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title}>
              <div style={{ padding: narrow ? '8px 12px 6px' : (gi === 0 ? '0 12px 6px' : '16px 12px 6px') }}>
                {narrow
                  ? <div style={{ height:1, background:'rgba(255,255,255,0.06)' }} />
                  : <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', color:'#3a4d6a' }}>{group.title}</p>
                }
              </div>
              {group.items.map(item => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    title={narrow ? item.label : undefined}
                    style={{
                      position:'relative',
                      display:'flex',
                      alignItems:'center',
                      borderRadius:12,
                      padding: narrow ? '9px 0' : '9px 12px',
                      gap: narrow ? 0 : 10,
                      justifyContent: narrow ? 'center' : 'flex-start',
                      marginBottom:2,
                      background: active ? 'rgba(22,163,74,0.08)' : 'transparent',
                      boxShadow: active ? 'inset 0 0 0 1px rgba(34,197,94,0.14)' : 'none',
                      color: active ? '#4ade80' : '#6b7280',
                      textDecoration:'none',
                      transition:'background 150ms,color 150ms,transform 150ms',
                    }}
                    onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLAnchorElement; el.style.background='rgba(255,255,255,0.045)'; el.style.color='#e5e7eb'; el.style.transform='translateX(2px)' } }}
                    onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLAnchorElement; el.style.background='transparent'; el.style.color='#6b7280'; el.style.transform='translateX(0)' } }}
                  >
                    {active && !narrow && (
                      <span style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:3, height:20, borderRadius:'0 4px 4px 0', background:'#22c55e', boxShadow:'0 0 10px rgba(34,197,94,0.7)' }} />
                    )}
                    <span style={{ fontSize:18, lineHeight:1, flexShrink:0, filter: active && narrow ? 'drop-shadow(0 0 6px rgba(34,197,94,0.9))' : 'none' }}>
                      {item.icon}
                    </span>
                    <span style={{ fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', maxWidth: narrow ? 0 : 160, opacity: narrow ? 0 : 1, transition:'max-width 300ms,opacity 300ms' }}>
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
          <div style={{ height:16 }} />
        </nav>

        {/* Fade bottom */}
        <div style={{ pointerEvents:'none', position:'absolute', inset:'auto 0 0 0', height:32, background:'linear-gradient(to top,#0e1320,transparent)', opacity: fadeBottom ? 1 : 0, transition:'opacity 300ms', zIndex:10 }} />
      </div>

      {/* Footer */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
        {!mobile && (
          <div style={{ padding:'8px 8px 0' }}>
            <button
              onClick={onToggle}
              title={narrow ? 'Déplier le menu' : 'Réduire le menu'}
              style={{ width:'100%', display:'flex', alignItems:'center', gap: narrow ? 0 : 8, justifyContent: narrow ? 'center' : 'flex-start', padding:'8px 12px', borderRadius:12, border:'none', background:'rgba(255,255,255,0.025)', color:'#4b5563', cursor:'pointer', transition:'background 200ms,color 200ms' }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.color='#9ca3af'; b.style.background='rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.color='#4b5563'; b.style.background='rgba(255,255,255,0.025)' }}
            >
              <span style={{ transform: narrow ? 'rotate(180deg)' : 'none', transition:'transform 300ms', flexShrink:0, display:'flex' }}>
                <ChevronLeftIcon />
              </span>
              <span style={{ fontSize:12, fontWeight:500, overflow:'hidden', whiteSpace:'nowrap', maxWidth: narrow ? 0 : 100, opacity: narrow ? 0 : 1, transition:'max-width 300ms,opacity 300ms' }}>Réduire</span>
            </button>
          </div>
        )}

        <div style={{ padding:'6px 8px 0' }}>
          <button
            onClick={() => { onReturnToApp(); onClose?.() }}
            title={narrow ? "Retour à l'app" : undefined}
            style={{ width:'100%', display:'flex', alignItems:'center', gap: narrow ? 0 : 7, justifyContent: narrow ? 'center' : 'flex-start', padding:'8px 12px', borderRadius:12, border:'none', background:'transparent', color:'#4b5563', cursor:'pointer', transition:'color 200ms' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#4ade80' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4b5563' }}
          >
            <span style={{ fontSize:14, flexShrink:0, transition:'transform 200ms' }}>←</span>
            <span style={{ fontSize:12, fontWeight:500, overflow:'hidden', whiteSpace:'nowrap', maxWidth: narrow ? 0 : 120, opacity: narrow ? 0 : 1, transition:'max-width 300ms,opacity 300ms' }}>Retour à l&apos;app</span>
          </button>
        </div>

        <div style={{ display:'flex', alignItems:'center', margin:8, borderRadius:12, padding:'10px 12px', background:'rgba(255,255,255,0.025)', gap: narrow ? 0 : 10, justifyContent: narrow ? 'center' : 'flex-start' }}>
          <div title={narrow ? userName : undefined} style={{ width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0, background:'rgba(22,163,74,0.15)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.2)', boxShadow:'0 0 12px rgba(34,197,94,0.1)' }}>
            {initial}
          </div>
          <div style={{ overflow:'hidden', maxWidth: narrow ? 0 : 150, opacity: narrow ? 0 : 1, transition:'max-width 300ms,opacity 300ms', minWidth:0 }}>
            <p style={{ fontSize:12, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:'1.2' }}>{userName || 'Administrateur'}</p>
            <p style={{ fontSize:10, fontWeight:500, color:'#4ade80', whiteSpace:'nowrap' }}>Platform Admin</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

/* ── AdminShell ──────────────────────────────────────────────────────────── */

export default function AdminShell({ children, userName }: { children: React.ReactNode; userName: string }) {
  const [collapsed,   setCollapsed]   = useState(false)
  const [ready,       setReady]       = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const router = useRouter()

  useEffect(() => {
    setCollapsed(localStorage.getItem('gf-admin-sidebar') === '1')
    setReady(true)
  }, [])

  const logoutAdmin = useCallback(async (dest: string) => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push(dest)
  }, [router])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(() => logoutAdmin('/admin/verify'), 30 * 60 * 1000)
    }
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)) }
  }, [logoutAdmin])

  function toggle() {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('gf-admin-sidebar', next ? '1' : '0')
      return next
    })
  }

  return (
    <>
      {/* CSS media-query natif — évite toute dépendance aux classes Tailwind pour la visibilité */}
      <style>{`
        .gf-sidebar-desktop { display: none !important; }
        @media (min-width: 768px) { .gf-sidebar-desktop { display: flex !important; } }
        .gf-topbar-mobile { display: flex !important; }
        @media (min-width: 768px) { .gf-topbar-mobile { display: none !important; } }
        .gf-drawer-backdrop { display: none; }
        @media (max-width: 767px) { .gf-drawer-backdrop { display: block; } }
      `}</style>

      <div style={{ position:'fixed', inset:0, display:'flex', overflow:'hidden', background:'#0c1018' }}>

        {/* ── Sidebar desktop ── */}
        <div className="gf-sidebar-desktop" style={{ flexShrink:0 }}>
          <Sidebar collapsed={collapsed} onToggle={toggle} userName={userName} ready={ready} onReturnToApp={() => logoutAdmin('/dashboard')} />
        </div>

        {/* ── Drawer mobile ── */}
        {mobileOpen && (
          <div style={{ position:'fixed', inset:0, zIndex:40 }}>
            <div className="gf-drawer-backdrop" style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }} onClick={() => setMobileOpen(false)} />
            <div style={{ position:'absolute', inset:'0 auto 0 0', display:'flex', animation:'gf-slideIn 0.25s cubic-bezier(0.22,1,0.36,1)', zIndex:50 }}>
              <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} userName={userName} ready={ready} mobile onClose={() => setMobileOpen(false)} onReturnToApp={() => logoutAdmin('/dashboard')} />
            </div>
          </div>
        )}

        <style>{`@keyframes gf-slideIn { from { transform:translateX(-100%) } to { transform:translateX(0) } }`}</style>

        {/* ── Contenu principal ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

          {/* Top bar mobile */}
          <div className="gf-topbar-mobile" style={{ alignItems:'center', gap:12, padding:'0 16px', height:56, flexShrink:0, background:'#080b12', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Menu"
              style={{ padding:8, borderRadius:8, border:'none', background:'transparent', color:'#6b7280', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.color='#fff'; b.style.background='rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.color='#6b7280'; b.style.background='transparent' }}
            >
              <MenuIcon />
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, background:'rgba(22,163,74,0.15)', border:'1px solid rgba(34,197,94,0.2)' }}>🔥</div>
              <span style={{ fontWeight:700, color:'#fff', fontSize:14 }}>Admin</span>
            </div>
            <div style={{ marginLeft:'auto' }}>
              <LangToggle className="text-gray-500" />
            </div>
          </div>

          {/* Main */}
          <main style={{ flex:1, overflowY:'auto' }}>
            <div style={{ padding:16 }} className="lg:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
