'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Command {
  id: string
  group: string
  label: string
  description?: string
  icon: string
  href?: string
  action?: () => void
  shortcut?: string
}

const NAV_COMMANDS: Command[] = [
  { id: 'dashboard',  group: 'Navigation', label: 'Tableau de bord', icon: '⊞',  href: '/business/dashboard' },
  { id: 'rapports',   group: 'Navigation', label: 'Rapports',        icon: '📊', href: '/business/rapports', description: 'CA, stock, tendances' },
  { id: 'caisse',     group: 'Navigation', label: 'Caisse',          icon: '🖥️', href: '/business/caisse', description: 'Point de vente' },
  { id: 'factures',   group: 'Navigation', label: 'Factures',        icon: '🧾', href: '/business/ventes' },
  { id: 'devis',      group: 'Navigation', label: 'Devis',           icon: '📋', href: '/business/devis' },
  { id: 'clients',    group: 'Navigation', label: 'Clients',         icon: '👤', href: '/business/clients' },
  { id: 'produits',   group: 'Navigation', label: 'Produits',        icon: '📦', href: '/business/stock', description: 'Inventaire' },
  { id: 'mouvements', group: 'Navigation', label: 'Mouvements stock',icon: '↕️', href: '/business/stock/mouvement' },
  { id: 'fournisseurs',group: 'Navigation',label: 'Fournisseurs',    icon: '🏭', href: '/business/fournisseurs' },
  { id: 'achats',     group: 'Navigation', label: 'Bons de commande',icon: '🛒', href: '/business/achats' },
  { id: 'equipe',     group: 'Navigation', label: 'Équipe',          icon: '👥', href: '/business/equipe' },
  { id: 'parametres', group: 'Navigation', label: 'Paramètres',      icon: '⚙️', href: '/business/parametres' },
]

const ACTION_COMMANDS: Command[] = [
  { id: 'new-facture',     group: 'Créer',  label: 'Nouvelle facture',     icon: '➕', href: '/business/ventes/nouveau',  description: 'Facturer un client' },
  { id: 'new-devis',       group: 'Créer',  label: 'Nouveau devis',        icon: '➕', href: '/business/devis/nouveau',   description: 'Créer une offre' },
  { id: 'new-produit',     group: 'Créer',  label: 'Ajouter un produit',   icon: '➕', href: '/business/stock/ajouter',  description: 'Référence stock' },
  { id: 'new-mouvement',   group: 'Créer',  label: 'Entrée de stock',      icon: '➕', href: '/business/stock/mouvement', description: 'Réception marchandise' },
  { id: 'new-fournisseur', group: 'Créer',  label: 'Nouveau fournisseur',  icon: '➕', href: '/business/fournisseurs',   description: 'Ajouter un partenaire' },
  { id: 'ouvrir-caisse',   group: 'Action', label: 'Ouvrir la caisse',     icon: '💰', href: '/business/caisse',         description: 'Enregistrer une vente' },
]

const ALL_COMMANDS = [...ACTION_COMMANDS, ...NAV_COMMANDS]

function highlight(text: string, query: string) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return text
  return text.slice(0, idx) + '«' + text.slice(idx, idx + query.length) + '»' + text.slice(idx + query.length)
}

export default function BizCommandBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const close = useCallback(() => { setOpen(false); setQuery(''); setSelected(0) }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') close()
    }
    const handleOpen = () => setOpen(true)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('biz:openCommandBar', handleOpen)
    return () => {
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('biz:openCommandBar', handleOpen)
    }
  }, [close])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = query
    ? ALL_COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description?.toLowerCase().includes(query.toLowerCase()) ||
        c.group.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_COMMANDS

  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = []
    acc[cmd.group].push(cmd)
    return acc
  }, {})

  const flat = Object.values(grouped).flat()

  const execute = useCallback((cmd: Command) => {
    close()
    if (cmd.action) cmd.action()
    else if (cmd.href) router.push(cmd.href)
  }, [close, router])

  useEffect(() => {
    if (!open) return
    const handleArrow = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && flat[selected]) execute(flat[selected])
    }
    document.addEventListener('keydown', handleArrow)
    return () => document.removeEventListener('keydown', handleArrow)
  }, [open, flat, selected, execute])

  if (!open) return null

  let itemIdx = 0

  return (
    <div
      className="biz-cmd-backdrop"
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className="biz-cmd-panel">
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
          <span style={{ fontSize: 16, color: '#94A3B8', flexShrink: 0 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Rechercher ou taper une action…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#0F172A', background: 'transparent' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
          )}
          <kbd style={{ padding: '3px 7px', borderRadius: 5, background: '#F1F5F9', border: '1px solid #E2E8F0', fontSize: 11, color: '#94A3B8', cursor: 'pointer' }}
            onClick={close}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: '6px' }}>
          {flat.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8', fontSize: 13 }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>🔍</p>
              Aucun résultat pour « {query} »
            </div>
          ) : (
            Object.entries(grouped).map(([groupName, cmds]) => (
              <div key={groupName} style={{ marginBottom: 4 }}>
                <div style={{ padding: '6px 10px 3px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {groupName}
                </div>
                {cmds.map(cmd => {
                  const isSelected = flat.indexOf(cmd) === selected
                  itemIdx++
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => execute(cmd)}
                      onMouseEnter={() => setSelected(flat.indexOf(cmd))}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8, border: 'none', textAlign: 'left',
                        background: isSelected ? '#F0FDF4' : 'transparent',
                        cursor: 'pointer', transition: 'background .08s',
                      }}
                    >
                      <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0, lineHeight: 1 }}>{cmd.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#16A34A' : '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {highlight(cmd.label, query)}
                        </p>
                        {cmd.description && (
                          <p style={{ fontSize: 11, color: '#94A3B8', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cmd.description}
                          </p>
                        )}
                      </div>
                      {isSelected && <span style={{ fontSize: 11, color: '#22C55E', flexShrink: 0 }}>↵ Ouvrir</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 16, alignItems: 'center' }}>
          {[['↑↓', 'Naviguer'], ['↵', 'Ouvrir'], ['Esc', 'Fermer']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{ padding: '2px 6px', borderRadius: 4, background: '#F1F5F9', border: '1px solid #E2E8F0', fontSize: 10, fontFamily: 'monospace', color: '#64748B' }}>{key}</kbd>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{label}</span>
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#CBD5E1' }}>{flat.length} résultat{flat.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}
