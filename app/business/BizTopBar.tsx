'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface BizTopBarProps {
  accountName: string
  userInitials: string
  userRole: string
}

const BREADCRUMBS: Record<string, { title: string; crumbs: string[] }> = {
  '/business/dashboard':       { title: 'Tableau de bord',     crumbs: [] },
  '/business/rapports':        { title: 'Rapports',            crumbs: ['Analytique'] },
  '/business/caisse':          { title: 'Caisse',              crumbs: ['Commerce'] },
  '/business/ventes':          { title: 'Factures',            crumbs: ['Commerce'] },
  '/business/ventes/nouveau':  { title: 'Nouvelle facture',    crumbs: ['Commerce', 'Factures'] },
  '/business/devis':           { title: 'Devis',               crumbs: ['Commerce'] },
  '/business/devis/nouveau':   { title: 'Nouveau devis',       crumbs: ['Commerce', 'Devis'] },
  '/business/clients':         { title: 'Clients',             crumbs: ['Commerce'] },
  '/business/stock':           { title: 'Produits',            crumbs: ['Inventaire'] },
  '/business/stock/ajouter':   { title: 'Ajouter un produit',  crumbs: ['Inventaire', 'Produits'] },
  '/business/stock/mouvement': { title: 'Mouvement de stock',  crumbs: ['Inventaire'] },
  '/business/fournisseurs':    { title: 'Fournisseurs',        crumbs: ['Inventaire'] },
  '/business/achats':          { title: 'Bons de commande',    crumbs: ['Inventaire'] },
  '/business/achats/nouveau':  { title: 'Nouvelle commande',   crumbs: ['Inventaire', 'Achats'] },
  '/business/equipe':          { title: 'Équipe',              crumbs: ['Gestion'] },
  '/business/parametres':      { title: 'Paramètres',          crumbs: ['Gestion'] },
}

const ROLE_LABEL: Record<string, string> = { owner: 'Propriétaire', manager: 'Manager', staff: 'Employé' }

export default function BizTopBar({ accountName, userInitials, userRole }: BizTopBarProps) {
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  const page = BREADCRUMBS[pathname] ?? { title: 'Business', crumbs: [] }

  const openCommandBar = () => {
    window.dispatchEvent(new CustomEvent('biz:openCommandBar'))
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: '#fff', borderBottom: '1px solid #F1F5F9',
      boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '0 20px', height: 52, flexShrink: 0,
    }}>
      {/* Breadcrumb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {page.crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>{c}</span>
            <span style={{ fontSize: 11, color: '#CBD5E1' }}>›</span>
          </span>
        ))}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {page.title}
        </span>
      </div>

      {/* Search / Command bar trigger */}
      <button
        onClick={openCommandBar}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 8,
          border: '1px solid #E2E8F0', background: '#F8FAFC',
          color: '#94A3B8', fontSize: 12, cursor: 'pointer',
          transition: 'all .12s', marginRight: 12, whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#22C55E'; e.currentTarget.style.color = '#22C55E' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8' }}
      >
        <span style={{ fontSize: 13 }}>🔍</span>
        <span>Rechercher…</span>
        <kbd style={{
          padding: '2px 6px', borderRadius: 4,
          background: '#F1F5F9', border: '1px solid #E2E8F0',
          fontSize: 10, fontFamily: 'monospace', color: '#94A3B8',
        }}>⌘K</kbd>
      </button>

      {/* Actions rapides */}
      <button
        onClick={openCommandBar}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8,
          background: '#22C55E', color: '#fff',
          fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
          transition: 'background .12s', marginRight: 12,
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#16A34A')}
        onMouseLeave={e => (e.currentTarget.style.background = '#22C55E')}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
        <span>Nouveau</span>
      </button>

      {/* User menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowMenu(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px 5px 5px', borderRadius: 10,
            border: '1px solid transparent', background: 'transparent',
            cursor: 'pointer', transition: 'all .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0,
          }}>
            {userInitials}
          </div>
          <div style={{ textAlign: 'left', display: 'none' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>{accountName}</p>
            <p style={{ fontSize: 10, color: '#94A3B8', margin: 0 }}>{ROLE_LABEL[userRole] ?? userRole}</p>
          </div>
          <span style={{ fontSize: 10, color: '#94A3B8' }}>▾</span>
        </button>

        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
              boxShadow: '0 8px 24px rgba(0,0,0,.1)',
              padding: '6px', minWidth: 200, zIndex: 20,
              animation: 'biz-slide-down .12s ease',
            }}>
              <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid #F1F5F9', marginBottom: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{accountName}</p>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{ROLE_LABEL[userRole] ?? userRole}</p>
              </div>
              {[
                { href: '/business/parametres', label: '⚙️ Paramètres', },
                { href: '/business/equipe', label: '👥 Équipe', },
              ].map(item => (
                <a key={item.href} href={item.href} onClick={() => setShowMenu(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#374151', textDecoration: 'none', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {item.label}
                </a>
              ))}
              <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 4, paddingTop: 4 }}>
                <a href="https://greenflameafrica.com/merchant/dashboard" style={{ display: 'block', padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#94A3B8', textDecoration: 'none', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  ← Retour à GreenFlame
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
