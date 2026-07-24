'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import LangToggle from '@/components/ui/LangToggle'

/* ── Données de navigation ───────────────────────────────────────────────── */

interface NavItem { href: string; label: string; icon: string }
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
      { href: '/admin/float',           label: 'Float agents',      icon: '💵' },
      { href: '/admin/revenue',         label: 'Revenus',           icon: '📈' },
      { href: '/admin/tresorerie',      label: 'Trésorerie',        icon: '💰' },
      { href: '/admin/rewards-fund',    label: 'Fonds récompenses', icon: '🎁' },
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
    ],
  },
  {
    title: 'Analytique',
    items: [
      { href: '/admin/analytics/platform', label: 'Analytics', icon: '📊' },
      { href: '/admin/exports',            label: 'Exports',    icon: '📤' },
    ],
  },
]

/* ── Icône chevron SVG ───────────────────────────────────────────────────── */

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  )
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  userName: string
  ready?: boolean
  mobile?: boolean
  onClose?: () => void
  onReturnToApp: () => void
}

function Sidebar({ collapsed, onToggle, userName, ready, mobile, onClose, onReturnToApp }: SidebarProps) {
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop]     = useState(false)
  const [scrollBottom, setScrollBottom] = useState(false)

  const narrow = collapsed && !mobile

  const updateScroll = useCallback(() => {
    const el = navRef.current
    if (!el) return
    setScrollTop(el.scrollTop > 8)
    setScrollBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 8)
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    updateScroll()
    el.addEventListener('scroll', updateScroll, { passive: true })
    const ro = new ResizeObserver(updateScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateScroll); ro.disconnect() }
  }, [updateScroll])

  function isActive(href: string) {
    if (href === '/admin/dashboard') return pathname === '/admin' || pathname === '/admin/dashboard'
    return pathname.startsWith(href)
  }

  const initial = (userName || 'A').charAt(0).toUpperCase()

  return (
    <aside
      className={`flex flex-col h-full overflow-hidden${ready ? ' transition-[width] duration-300 ease-in-out will-change-transform' : ''}`}
      style={{
        width: narrow ? 72 : 260,
        background: 'linear-gradient(180deg, #080b12 0%, #0c1018 50%, #0e1320 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* ─ Logo ─ */}
      <div
        className="flex items-center h-16 px-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
          style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <Logo size={26} className="w-[26px] h-[26px]" />
          <span className="absolute -bottom-1 -right-1 text-[10px]">🔥</span>
        </div>

        <div className={`ml-3 overflow-hidden transition-all duration-300 ${narrow ? 'w-0 opacity-0' : 'w-40 opacity-100'}`}>
          <p className="text-white font-bold text-sm leading-tight whitespace-nowrap tracking-tight">GreenFlame</p>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] whitespace-nowrap" style={{ color: '#4ade80' }}>
            Admin
          </p>
        </div>

        {mobile && (
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#6b7280' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          >
            ✕
          </button>
        )}
      </div>

      {/* ─ Nav scrollable ─ */}
      <div className="relative flex-1 overflow-hidden">

        {/* Fade top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-8 z-10 transition-opacity duration-300"
          style={{
            background: 'linear-gradient(to bottom, #080b12, transparent)',
            opacity: scrollTop ? 1 : 0,
          }}
        />

        <nav
          ref={navRef}
          className="h-full overflow-y-auto py-3 px-2 space-y-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e2940 transparent' }}
        >
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title}>
              {/* Separator / group label */}
              {gi > 0 && (
                <div className={`transition-all duration-300 ${narrow ? 'px-3 mt-2 mb-2' : 'px-3 mt-4 mb-1.5'}`}>
                  {narrow ? (
                    <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  ) : (
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#3a4d6a' }}>
                      {group.title}
                    </p>
                  )}
                </div>
              )}
              {gi === 0 && !narrow && (
                <div className="px-3 mb-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#3a4d6a' }}>
                    {group.title}
                  </p>
                </div>
              )}

              {group.items.map(item => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    title={narrow ? item.label : undefined}
                    className="relative flex items-center rounded-xl transition-all duration-150 active:scale-[0.96] group"
                    style={{
                      gap: narrow ? 0 : 10,
                      padding: narrow ? '9px 0' : '9px 12px',
                      justifyContent: narrow ? 'center' : 'flex-start',
                      background: active ? 'rgba(22,163,74,0.08)' : 'transparent',
                      boxShadow: active ? 'inset 0 0 0 1px rgba(34,197,94,0.14)' : 'none',
                      color: active ? '#4ade80' : '#6b7280',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.045)'
                        e.currentTarget.style.color = '#e5e7eb'
                        e.currentTarget.style.transform = 'translateX(2px)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#6b7280'
                        e.currentTarget.style.transform = 'translateX(0)'
                      }
                    }}
                  >
                    {/* Active left bar */}
                    {active && !narrow && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                        style={{
                          width: 3,
                          height: 20,
                          background: '#22c55e',
                          boxShadow: '0 0 10px rgba(34,197,94,0.7)',
                        }}
                      />
                    )}

                    {/* Icon */}
                    <span
                      className="text-[18px] leading-none flex-shrink-0 transition-transform duration-150 group-active:scale-90"
                      style={{
                        filter: active && narrow ? 'drop-shadow(0 0 6px rgba(34,197,94,0.9))' : 'none',
                      }}
                    >
                      {item.icon}
                    </span>

                    {/* Label */}
                    <span
                      className="text-[13px] font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
                      style={{
                        maxWidth: narrow ? 0 : 160,
                        opacity: narrow ? 0 : 1,
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}

          <div className="h-4" />
        </nav>

        {/* Fade bottom */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 z-10 transition-opacity duration-300"
          style={{
            background: 'linear-gradient(to top, #0e1320, transparent)',
            opacity: scrollBottom ? 1 : 0,
          }}
        />
      </div>

      {/* ─ Footer ─ */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="shrink-0">

        {/* Collapse toggle — desktop only */}
        {!mobile && (
          <div className="px-2 pt-2">
            <button
              onClick={onToggle}
              className="w-full flex items-center rounded-xl px-3 py-2 transition-all duration-200 group"
              style={{
                gap: narrow ? 0 : 8,
                justifyContent: narrow ? 'center' : 'flex-start',
                color: '#4b5563',
                background: 'rgba(255,255,255,0.025)',
              }}
              title={narrow ? 'Déplier le menu' : 'Réduire le menu'}
              onMouseEnter={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
            >
              <span
                className="flex-shrink-0 transition-transform duration-300"
                style={{ transform: narrow ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <ChevronLeft />
              </span>
              <span
                className="text-xs font-medium overflow-hidden whitespace-nowrap transition-all duration-300"
                style={{ maxWidth: narrow ? 0 : 100, opacity: narrow ? 0 : 1 }}
              >
                Réduire
              </span>
            </button>
          </div>
        )}

        {/* Back to app */}
        <div className="px-2 pt-1.5">
          <button
            onClick={() => { onReturnToApp(); onClose?.() }}
            title={narrow ? "Retour à l'app" : undefined}
            className="w-full flex items-center rounded-xl px-3 py-2 transition-all duration-200 group"
            style={{
              gap: narrow ? 0 : 7,
              justifyContent: narrow ? 'center' : 'flex-start',
              color: '#4b5563',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#4ade80' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4b5563' }}
          >
            <span className="text-sm flex-shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            <span
              className="text-xs font-medium overflow-hidden whitespace-nowrap transition-all duration-300"
              style={{ maxWidth: narrow ? 0 : 120, opacity: narrow ? 0 : 1 }}
            >
              Retour à l&apos;app
            </span>
          </button>
        </div>

        {/* User card */}
        <div
          className="flex items-center m-2 rounded-xl px-3 py-2.5 transition-colors duration-200"
          style={{
            gap: narrow ? 0 : 10,
            justifyContent: narrow ? 'center' : 'flex-start',
            background: 'rgba(255,255,255,0.025)',
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
            style={{
              background: 'rgba(22,163,74,0.15)',
              color: '#4ade80',
              border: '1px solid rgba(34,197,94,0.2)',
              boxShadow: '0 0 12px rgba(34,197,94,0.1)',
            }}
            title={narrow ? userName : undefined}
          >
            {initial}
          </div>
          <div
            className="overflow-hidden transition-all duration-300 min-w-0"
            style={{ maxWidth: narrow ? 0 : 150, opacity: narrow ? 0 : 1 }}
          >
            <p className="text-xs font-semibold text-white truncate whitespace-nowrap leading-tight">
              {userName || 'Administrateur'}
            </p>
            <p className="text-[10px] font-medium whitespace-nowrap" style={{ color: '#4ade80' }}>
              Platform Admin
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

/* ── AdminShell (shell principal) ────────────────────────────────────────── */

interface AdminShellProps {
  children: React.ReactNode
  userName: string
}

export default function AdminShell({ children, userName }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setCollapsed(localStorage.getItem('gf-admin-sidebar') === '1')
    setReady(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check, { passive: true })
    return () => window.removeEventListener('resize', check)
  }, [])

  const logoutAdmin = useCallback(async (destination: string) => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push(destination)
  }, [router])

  // Déconnexion automatique après 30s d'inactivité
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function reset() {
      clearTimeout(timer)
      timer = setTimeout(() => { logoutAdmin('/admin/verify') }, 30 * 60 * 1000)
    }

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [logoutAdmin])

  function toggle() {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('gf-admin-sidebar', next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden" style={{ background: '#0c1018' }}>

      {/* Sidebar desktop — visible dès que isMobile=false (détecté via window.innerWidth) */}
      {!isMobile && (
        <div className="flex shrink-0">
          <Sidebar collapsed={collapsed} onToggle={toggle} userName={userName} ready={ready} onReturnToApp={() => logoutAdmin('/dashboard')} />
        </div>
      )}

      {/* Drawer mobile */}
      {mobileOpen && isMobile && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="fixed inset-y-0 left-0 z-50 flex"
            style={{ animation: 'slideIn 0.25s cubic-bezier(0.22,1,0.36,1)' }}
          >
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              userName={userName}
              mobile
              onClose={() => setMobileOpen(false)}
              onReturnToApp={() => logoutAdmin('/dashboard')}
            />
          </div>
          <style>{`@keyframes slideIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }`}</style>
        </>
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar mobile — visible uniquement si isMobile */}
        <div
          className="flex items-center gap-3 px-4 h-14 shrink-0"
          style={{
            display: isMobile ? 'flex' : 'none',
            background: '#080b12',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#6b7280' }}
            aria-label="Menu"
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent' }}
          >
            <MenuIcon />
          </button>

          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
              style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              🔥
            </div>
            <span className="font-bold text-white text-sm">Admin</span>
          </div>

          <div className="ml-auto">
            <LangToggle className="text-gray-500" />
          </div>
        </div>

        {/* Main scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
