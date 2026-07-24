export type ToolStatus = 'available' | 'coming_soon'

export interface SectoralTool {
  slug: string
  label: string
  icon: string
  description: string
  targetSectors: string[]
  status: ToolStatus
}

export const TOOLS_CATALOG: SectoralTool[] = [
  {
    slug: 'salon',
    label: 'Salon & Beauté',
    icon: '💇',
    description: 'Gestion des rendez-vous, fiches clients et historique des prestations.',
    targetSectors: ['BEAUTE'],
    status: 'available',
  },
  {
    slug: 'couture',
    label: 'Couture & Confection',
    icon: '🧵',
    description: 'Suivi des commandes, prises de mesures et gestion des créations clients.',
    targetSectors: ['VETEMENTS'],
    status: 'available',
  },
  {
    slug: 'btp',
    label: 'BTP & Construction',
    icon: '🏗️',
    description: 'Devis chantiers, suivi des travaux et gestion des approvisionnements.',
    targetSectors: ['SERVICES'],
    status: 'available',
  },
  {
    slug: 'resto',
    label: 'Restaurant & Restauration',
    icon: '🍽️',
    description: 'Gestion des tables, commandes en salle et menu digital.',
    targetSectors: ['RESTAURANT', 'ALIMENTATION'],
    status: 'available',
  },
  {
    slug: 'medecin',
    label: 'Cabinet Médical',
    icon: '🏥',
    description: 'Gestion des consultations, ordonnances et fiches patients.',
    targetSectors: ['PHARMACIE'],
    status: 'coming_soon',
  },
  {
    slug: 'transport',
    label: 'Transport & Logistique',
    icon: '🚚',
    description: 'Suivi de flotte, gestion des courses et livraisons.',
    targetSectors: ['TRANSPORT_SMALL'],
    status: 'coming_soon',
  },
  {
    slug: 'evenement',
    label: 'Événementiel',
    icon: '🎪',
    description: "Organisation d'événements, billetterie et gestion des invités.",
    targetSectors: ['SERVICES'],
    status: 'coming_soon',
  },
  {
    slug: 'consultant',
    label: 'Conseil & Formation',
    icon: '📚',
    description: 'Facturation clients, suivi de missions et gestion des formations.',
    targetSectors: ['SERVICES'],
    status: 'coming_soon',
  },
]

export function getToolBySlug(slug: string): SectoralTool | undefined {
  return TOOLS_CATALOG.find(t => t.slug === slug)
}

export function getAvailableTools(): SectoralTool[] {
  return TOOLS_CATALOG.filter(t => t.status === 'available')
}
