export const DEMO_PHONE    = '+22900000000'
export const DEMO_PIN      = '000000'
export const DEMO_EMAIL    = 'demo@greenflameafrica.com'
export const DEMO_PASSWORD = 'GF!Demo_2026@Afrika'

export const DEMO_PROFILE = {
  fullName:   'GreenFlame Demo',
  email:      'demo@greenflameafrica.com',
  pin:        DEMO_PIN,
  pinConfirm: DEMO_PIN,
}

export const DEMO_MERCHANT = {
  shopName:    'Boutique GreenFlame Demo',
  description: 'Produits locaux de qualité à prix juste — boutique de démonstration.',
  category:    'Alimentation',
  city:        'Cotonou',
  address:     'Avenue Steinmetz, Cadjehoun, Cotonou',
  momoNumber:  DEMO_PHONE,
}

export const DEMO_PRODUCT = {
  name:        'Huile de palme rouge 5L',
  description: 'Huile de palme rouge naturelle, production locale du Bénin.',
  price:       4500,
  stock:       50,
  category:    'Alimentation',
}

export type DemoStepId =
  | 'inscription'
  | 'profil'
  | 'kyc'
  | 'premier_achat'
  | 'boutique'
  | 'produits'
  | 'abonnements'
  | 'outils'
  | 'communaute'
  | 'analytics'
  | 'wallet'

export interface DemoStep {
  id:          DemoStepId
  label:       string
  icon:        string
  path:        string
  description: string
}

export const DEMO_STEPS: DemoStep[] = [
  { id: 'inscription',   label: 'Inscription',         icon: '📝', path: '/login?demo=true',    description: 'Créer un compte' },
  { id: 'profil',        label: 'Compléter le profil', icon: '👤', path: '/complete-profile',   description: 'Nom, PIN, parrainage' },
  { id: 'kyc',           label: 'Vérification KYC',    icon: '🪪', path: '/kyc',               description: 'Identité & validation' },
  { id: 'premier_achat', label: '1er achat',           icon: '🛍️', path: '/marketplace',       description: 'Activer son compte' },
  { id: 'boutique',      label: 'Ouvrir sa boutique',  icon: '🏪', path: '/merchant/activate', description: 'Devenir marchand' },
  { id: 'produits',      label: 'Produits & Stock',    icon: '📦', path: '/merchant/products', description: 'Gérer son catalogue' },
  { id: 'abonnements',   label: 'Abonnements VIP',     icon: '⭐', path: '/merchant/upgrade',  description: 'Comparer les offres' },
  { id: 'outils',        label: 'Outils marchands',    icon: '🛠️', path: '/merchant/tools',   description: 'Factures, devis, promo…' },
  { id: 'communaute',    label: 'Communauté',          icon: '🌐', path: '/network',            description: 'Arborescence & commissions' },
  { id: 'analytics',     label: 'Analytics & IA',      icon: '📊', path: '/merchant/analytics',description: 'Rapport sur 3 mois' },
  { id: 'wallet',        label: 'Wallet & Gains',      icon: '💰', path: '/wallet',             description: 'Solde et historique' },
]
