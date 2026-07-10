/**
 * GreenFlame — Système de configurations sectorielles
 *
 * Chaque SectorConfig transforme UniversalDevisClient en un outil
 * ultra-spécialisé pour un secteur d'activité.
 *
 * Pour créer un nouvel outil sectoriel :
 *   1. Ajouter une entrée dans SECTOR_CONFIGS
 *   2. Créer une page app/merchant/tools/[sector]/page.tsx
 *   3. Importer UniversalDevisClient avec la config correspondante
 *   → Aucune modification du composant, aucune nouvelle API, aucune migration.
 */

export interface DefaultLineItem {
  description: string
  qty: number
  unit: string
  unitPrice: number
}

export interface ExtraField {
  key: string
  label: string
  type: 'text' | 'date' | 'number' | 'textarea' | 'select'
  placeholder?: string
  options?: string[]   // pour type 'select'
  required?: boolean
  span?: 'full' | 'half'  // largeur dans la grille
}

export interface SectorConfig {
  /** Identifiant unique du secteur */
  id: string

  /** Nom affiché de l'outil */
  toolName: string

  /** Icône emoji du secteur */
  icon: string

  /** Titre du document généré */
  documentTitle: string

  /** Préfixe du numéro de document (ex: "BTP" → "BTP-XXXXXX") */
  documentPrefix: string

  /** Label du champ client */
  clientLabel: string

  /** Placeholder nom client */
  clientPlaceholder: string

  /** Unités disponibles pour les lignes */
  units: string[]

  /** Lignes pré-remplies au chargement */
  defaultLineItems: DefaultLineItem[]

  /** Champs spécifiques au secteur (affichés entre client et lignes) */
  extraFields: ExtraField[]

  /** Texte du bouton de génération */
  generateBtnLabel: string

  /** Mention légale / pied de document */
  footerNote: string

  /** Type de document enregistré en base */
  docType: 'devis' | 'facture'

  /** Couleur accent (classe Tailwind) */
  accentColor?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGS SECTORIELLES
// ─────────────────────────────────────────────────────────────────────────────

export const SECTOR_CONFIGS: Record<string, SectorConfig> = {

  // ── Consultant / Solopreneur généraliste ──────────────────────────────────
  consultant: {
    id: 'consultant',
    toolName: 'Devis Consultant',
    icon: '💼',
    documentTitle: 'Proposition commerciale',
    documentPrefix: 'CONS',
    clientLabel: 'Client / Entreprise',
    clientPlaceholder: 'Nom du client ou de l\'entreprise',
    units: ['heure', 'jour', 'forfait', 'livrable', 'session'],
    defaultLineItems: [
      { description: 'Audit / Diagnostic initial', qty: 1, unit: 'forfait', unitPrice: 0 },
      { description: 'Consulting opérationnel', qty: 0, unit: 'jour', unitPrice: 0 },
      { description: 'Rapport et livrables', qty: 1, unit: 'livrable', unitPrice: 0 },
    ],
    extraFields: [
      { key: 'mission', label: 'Intitulé de la mission', type: 'text', placeholder: 'Ex: Restructuration commerciale Q3', span: 'full' },
      { key: 'start_date', label: 'Date de démarrage', type: 'date', span: 'half' },
      { key: 'duration', label: 'Durée estimée', type: 'text', placeholder: 'Ex: 3 semaines', span: 'half' },
    ],
    generateBtnLabel: 'Générer la proposition',
    footerNote: 'Proposition valable 15 jours · GreenFlame by Bénin',
    docType: 'devis',
  },

  // ── Avocat / Juriste ─────────────────────────────────────────────────────
  avocat: {
    id: 'avocat',
    toolName: 'Note d\'honoraires',
    icon: '⚖️',
    documentTitle: 'Note d\'honoraires',
    documentPrefix: 'HON',
    clientLabel: 'Client / Justiciable',
    clientPlaceholder: 'Nom complet du client',
    units: ['heure', 'forfait', 'acte', 'diligence'],
    defaultLineItems: [
      { description: 'Consultation juridique', qty: 1, unit: 'heure', unitPrice: 0 },
      { description: 'Rédaction d\'acte', qty: 1, unit: 'acte', unitPrice: 0 },
      { description: 'Représentation en audience', qty: 0, unit: 'diligence', unitPrice: 0 },
    ],
    extraFields: [
      { key: 'dossier', label: 'Référence dossier', type: 'text', placeholder: 'Ex: DOS-2026-042', span: 'half' },
      { key: 'matiere', label: 'Matière juridique', type: 'select', options: ['Droit commercial', 'Droit civil', 'Droit du travail', 'Droit pénal', 'Droit immobilier', 'Autre'], span: 'half' },
      { key: 'juridiction', label: 'Juridiction concernée', type: 'text', placeholder: 'Ex: Tribunal de commerce de Cotonou', span: 'full' },
    ],
    generateBtnLabel: 'Émettre la note d\'honoraires',
    footerNote: 'Honoraires soumis aux règles du Barreau · GreenFlame by Bénin',
    docType: 'facture',
  },

  // ── Photographe / Vidéaste ───────────────────────────────────────────────
  photographe: {
    id: 'photographe',
    toolName: 'Devis Photo & Vidéo',
    icon: '📸',
    documentTitle: 'Devis Prestation Photo / Vidéo',
    documentPrefix: 'PHO',
    clientLabel: 'Client',
    clientPlaceholder: 'Nom du client',
    units: ['heure', 'demi-journée', 'journée', 'forfait', 'livrable'],
    defaultLineItems: [
      { description: 'Shooting photo', qty: 0, unit: 'heure', unitPrice: 0 },
      { description: 'Retouche & post-production', qty: 0, unit: 'heure', unitPrice: 0 },
      { description: 'Livraison fichiers HD (galerie privée)', qty: 1, unit: 'forfait', unitPrice: 0 },
    ],
    extraFields: [
      { key: 'event_type', label: 'Type de prestation', type: 'select', options: ['Mariage', 'Portrait / Studio', 'Corporate / Événement entreprise', 'Baptême / Communion', 'Mode / Publicité', 'Immobilier', 'Autre'], span: 'full' },
      { key: 'event_date', label: 'Date de la prestation', type: 'date', span: 'half' },
      { key: 'location', label: 'Lieu', type: 'text', placeholder: 'Adresse ou lieu-dit', span: 'half' },
      { key: 'delivery_delay', label: 'Délai de livraison', type: 'text', placeholder: 'Ex: 10 jours ouvrables', span: 'full' },
    ],
    generateBtnLabel: 'Générer le devis',
    footerNote: 'Droits d\'auteur réservés · Acompte 30% à la signature · GreenFlame by Bénin',
    docType: 'devis',
  },

  // ── Transporteur / Coursier ──────────────────────────────────────────────
  transporteur: {
    id: 'transporteur',
    toolName: 'Bon de Transport',
    icon: '🚛',
    documentTitle: 'Bon de Transport',
    documentPrefix: 'TRS',
    clientLabel: 'Expéditeur',
    clientPlaceholder: 'Nom de l\'expéditeur',
    units: ['trajet', 'km', 'tonne', 'colis', 'voyage', 'forfait'],
    defaultLineItems: [
      { description: 'Transport principal', qty: 1, unit: 'trajet', unitPrice: 0 },
      { description: 'Manutention / Chargement', qty: 1, unit: 'forfait', unitPrice: 0 },
    ],
    extraFields: [
      { key: 'origin', label: 'Point de départ', type: 'text', placeholder: 'Ville / quartier de départ', span: 'half' },
      { key: 'destination', label: 'Destination', type: 'text', placeholder: 'Ville / quartier d\'arrivée', span: 'half' },
      { key: 'transport_date', label: 'Date de transport', type: 'date', span: 'half' },
      { key: 'cargo_type', label: 'Nature du chargement', type: 'text', placeholder: 'Ex: Marchandises, mobilier, équipements...', span: 'half' },
      { key: 'recipient', label: 'Destinataire', type: 'text', placeholder: 'Nom du destinataire', span: 'full' },
    ],
    generateBtnLabel: 'Émettre le bon de transport',
    footerNote: 'Transport sous réserve des conditions générales GreenFlame · Bénin',
    docType: 'facture',
  },

  // ── Médecin / Clinique privée ────────────────────────────────────────────
  medecin: {
    id: 'medecin',
    toolName: 'Fiche de Soins',
    icon: '🏥',
    documentTitle: 'Fiche de Soins / Consultation',
    documentPrefix: 'SOIN',
    clientLabel: 'Patient',
    clientPlaceholder: 'Nom complet du patient',
    units: ['séance', 'consultation', 'forfait', 'acte'],
    defaultLineItems: [
      { description: 'Consultation générale', qty: 1, unit: 'consultation', unitPrice: 0 },
      { description: 'Examen complémentaire', qty: 0, unit: 'acte', unitPrice: 0 },
      { description: 'Soins infirmiers', qty: 0, unit: 'séance', unitPrice: 0 },
    ],
    extraFields: [
      { key: 'consultation_date', label: 'Date de consultation', type: 'date', span: 'half' },
      { key: 'specialty', label: 'Spécialité', type: 'select', options: ['Médecine générale', 'Pédiatrie', 'Gynécologie', 'Dermatologie', 'Dentisterie', 'Ophtalmologie', 'Cardiologie', 'Autre'], span: 'half' },
      { key: 'diagnosis', label: 'Motif de consultation', type: 'text', placeholder: 'Ex: Fièvre, contrôle annuel...', span: 'full' },
    ],
    generateBtnLabel: 'Générer la fiche de soins',
    footerNote: 'Document confidentiel · Usage médical uniquement · GreenFlame by Bénin',
    docType: 'facture',
  },

  // ── Coach / Formateur ────────────────────────────────────────────────────
  coach: {
    id: 'coach',
    toolName: 'Devis Formation / Coaching',
    icon: '🎯',
    documentTitle: 'Proposition de Formation / Coaching',
    documentPrefix: 'FORM',
    clientLabel: 'Participant / Entreprise cliente',
    clientPlaceholder: 'Nom du participant ou de l\'entreprise',
    units: ['heure', 'session', 'journée', 'module', 'forfait'],
    defaultLineItems: [
      { description: 'Session de coaching individuel', qty: 0, unit: 'session', unitPrice: 0 },
      { description: 'Formation en groupe', qty: 0, unit: 'journée', unitPrice: 0 },
      { description: 'Support de cours & ressources', qty: 1, unit: 'forfait', unitPrice: 0 },
    ],
    extraFields: [
      { key: 'program', label: 'Intitulé du programme', type: 'text', placeholder: 'Ex: Leadership & Management d\'équipe', span: 'full' },
      { key: 'participants', label: 'Nombre de participants', type: 'number', placeholder: '1', span: 'half' },
      { key: 'format', label: 'Format', type: 'select', options: ['Présentiel', 'En ligne', 'Hybride'], span: 'half' },
      { key: 'start_date', label: 'Date de début', type: 'date', span: 'half' },
      { key: 'location', label: 'Lieu / Lien visio', type: 'text', placeholder: 'Adresse ou URL', span: 'half' },
    ],
    generateBtnLabel: 'Générer la proposition',
    footerNote: 'Acompte 50% à la signature · Attestation de formation fournie · GreenFlame by Bénin',
    docType: 'devis',
  },

  // ── Décorateur / Organisateur d'événements ───────────────────────────────
  evenement: {
    id: 'evenement',
    toolName: 'Devis Événement',
    icon: '🎉',
    documentTitle: 'Devis Organisation d\'Événement',
    documentPrefix: 'EVT',
    clientLabel: 'Client',
    clientPlaceholder: 'Nom du client',
    units: ['forfait', 'pièce', 'heure', 'table', 'personne', 'lot'],
    defaultLineItems: [
      { description: 'Coordination & organisation', qty: 1, unit: 'forfait', unitPrice: 0 },
      { description: 'Décoration salle', qty: 1, unit: 'forfait', unitPrice: 0 },
      { description: 'Sonorisation / Éclairage', qty: 1, unit: 'forfait', unitPrice: 0 },
      { description: 'Fleurs & arrangements', qty: 0, unit: 'lot', unitPrice: 0 },
    ],
    extraFields: [
      { key: 'event_type', label: 'Type d\'événement', type: 'select', options: ['Mariage', 'Baptême', 'Anniversaire', 'Conférence', 'Gala / Soirée', 'Séminaire entreprise', 'Autre'], span: 'half' },
      { key: 'event_date', label: 'Date de l\'événement', type: 'date', span: 'half' },
      { key: 'venue', label: 'Lieu de l\'événement', type: 'text', placeholder: 'Salle, adresse...', span: 'full' },
      { key: 'guests', label: 'Nombre d\'invités estimé', type: 'number', placeholder: '0', span: 'half' },
      { key: 'theme', label: 'Thème / Couleurs', type: 'text', placeholder: 'Ex: Blanc & Or, Tropicale...', span: 'half' },
    ],
    generateBtnLabel: 'Générer le devis événement',
    footerNote: 'Acompte 40% à la validation · Solde 72h avant l\'événement · GreenFlame by Bénin',
    docType: 'devis',
  },

  // ── Agent immobilier ─────────────────────────────────────────────────────
  immobilier: {
    id: 'immobilier',
    toolName: 'Bon de Visite / Mandat',
    icon: '🏠',
    documentTitle: 'Bon de Visite & Honoraires Agence',
    documentPrefix: 'IMM',
    clientLabel: 'Client acquéreur / locataire',
    clientPlaceholder: 'Nom du client',
    units: ['forfait', '%', 'mois', 'visite'],
    defaultLineItems: [
      { description: 'Honoraires d\'agence (location)', qty: 1, unit: 'forfait', unitPrice: 0 },
      { description: 'Frais de dossier', qty: 1, unit: 'forfait', unitPrice: 0 },
    ],
    extraFields: [
      { key: 'property_ref', label: 'Référence du bien', type: 'text', placeholder: 'Ex: IMM-COTO-042', span: 'half' },
      { key: 'property_type', label: 'Type de bien', type: 'select', options: ['Villa', 'Appartement', 'Studio', 'Local commercial', 'Terrain', 'Entrepôt'], span: 'half' },
      { key: 'address', label: 'Adresse du bien', type: 'text', placeholder: 'Adresse complète', span: 'full' },
      { key: 'transaction', label: 'Type de transaction', type: 'select', options: ['Location', 'Vente', 'Gérance'], span: 'half' },
      { key: 'visit_date', label: 'Date de visite', type: 'date', span: 'half' },
    ],
    generateBtnLabel: 'Émettre le bon de visite',
    footerNote: 'Mandat exclusif · Honoraires TTC à la charge du mandant · GreenFlame by Bénin',
    docType: 'facture',
  },

  // ── Imprimerie / Communication visuelle ──────────────────────────────────
  imprimerie: {
    id: 'imprimerie',
    toolName: 'Devis Impression & Comm',
    icon: '🖨️',
    documentTitle: 'Devis Impression & Communication Visuelle',
    documentPrefix: 'IMP',
    clientLabel: 'Client',
    clientPlaceholder: 'Nom du client',
    units: ['exemplaire', 'feuille', 'lot', 'mètre', 'forfait', 'm²'],
    defaultLineItems: [
      { description: 'Impression flyers A5 (recto/verso)', qty: 0, unit: 'exemplaire', unitPrice: 0 },
      { description: 'Conception graphique', qty: 1, unit: 'forfait', unitPrice: 0 },
      { description: 'Bannière / Bâche', qty: 0, unit: 'm²', unitPrice: 0 },
    ],
    extraFields: [
      { key: 'format', label: 'Format principal', type: 'text', placeholder: 'Ex: A4, A3, A5, 80x120cm...', span: 'half' },
      { key: 'paper', label: 'Support / Grammage', type: 'text', placeholder: 'Ex: Couché 135g, Bâche 510g', span: 'half' },
      { key: 'delivery_date', label: 'Date de livraison souhaitée', type: 'date', span: 'half' },
      { key: 'finishing', label: 'Finitions', type: 'text', placeholder: 'Ex: Pelliculage, découpe, spirale...', span: 'half' },
    ],
    generateBtnLabel: 'Générer le devis imprimerie',
    footerNote: 'BAT (Bon à Tirer) obligatoire avant impression · GreenFlame by Bénin',
    docType: 'devis',
  },

}

/** Helper — récupérer une config par ID, avec fallback consultant */
export function getSectorConfig(id: string): SectorConfig {
  return SECTOR_CONFIGS[id] ?? SECTOR_CONFIGS.consultant
}
