export interface BizNavItem {
  href: string
  label: string
  icon: string
}

export interface BizNavGroup {
  label: string
  items: BizNavItem[]
}

export const NAV_GROUPS: BizNavGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/business/dashboard', label: 'Tableau de bord', icon: '⊞' },
      { href: '/business/rapports',  label: 'Rapports',        icon: '📊' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/business/caisse',  label: 'Caisse',   icon: '🖥️' },
      { href: '/business/ventes',  label: 'Factures', icon: '🧾' },
      { href: '/business/devis',   label: 'Devis',    icon: '📋' },
      { href: '/business/clients', label: 'Clients',  icon: '👤' },
    ],
  },
  {
    label: 'Inventaire',
    items: [
      { href: '/business/stock',           label: 'Produits',     icon: '📦' },
      { href: '/business/stock/mouvement', label: 'Mouvements',   icon: '↕️' },
      { href: '/business/fournisseurs',    label: 'Fournisseurs', icon: '🏭' },
      { href: '/business/achats',          label: 'Achats',       icon: '🛒' },
    ],
  },
  {
    label: 'Immobilier',
    items: [
      { href: '/business/immobilier',         label: 'Mes biens', icon: '⌂' },
      { href: '/business/immobilier/mandats',  label: 'Mandats',   icon: '📜' },
      { href: '/business/immobilier/visites',  label: 'Visites',   icon: '🗓️' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/business/equipe',     label: 'Gestion du Personnel', icon: '👥' },
      { href: '/business/parametres', label: 'Paramètres',           icon: '⚙️' },
    ],
  },
]

// Onglets principaux de la barre mobile — les actions les plus fréquentes au quotidien.
export const MOBILE_PRIMARY_HREFS = [
  '/business/dashboard',
  '/business/caisse',
  '/business/ventes',
  '/business/stock',
]
