/**
 * lib/budget/categories.ts
 *
 * Catégories de budget — revenus et dépenses du quotidien.
 * gfPath : si présent, lien vers la section GreenFlame correspondante
 *          ("Voir sur GreenFlame" dans la barre de catégorie).
 */

export type BudgetCategory = {
  key:     string
  label:   string
  icon:    string
  gfPath?: string   // route GreenFlame pour acheter dans cette catégorie
}

export const INCOME_CATEGORIES: BudgetCategory[] = [
  { key: 'salaire',            label: 'Salaire / Traitement',    icon: '💰' },
  { key: 'gf_commissions',     label: 'Commissions GreenFlame',  icon: '🌱', gfPath: '/wallet' },
  { key: 'activite_secondaire',label: 'Activité secondaire',     icon: '💼' },
  { key: 'commerce',           label: 'Commerce / Ventes',       icon: '🏪' },
  { key: 'transferts_recus',   label: 'Transferts reçus',        icon: '📲' },
  { key: 'loyers_recus',       label: 'Loyers reçus',            icon: '🏘️' },
  { key: 'dons_cadeaux',       label: 'Dons & Cadeaux',          icon: '🎁' },
  { key: 'autres_revenus',     label: 'Autres revenus',          icon: '📦' },
]

export const EXPENSE_CATEGORIES: BudgetCategory[] = [
  { key: 'logement',     label: 'Logement',       icon: '🏠' },
  { key: 'alimentation', label: 'Alimentation',   icon: '🍽️', gfPath: '/marketplace?cat=alimentation' },
  { key: 'transport',    label: 'Transport',       icon: '🚗' },
  { key: 'telecoms',     label: 'Télécoms',        icon: '📱' },
  { key: 'famille',      label: 'Famille',         icon: '👶' },
  { key: 'scolarite',    label: 'Scolarité',       icon: '📚', gfPath: '/academie' },
  { key: 'sante',        label: 'Santé',           icon: '💊', gfPath: '/marketplace?cat=sante' },
  { key: 'solidarite',   label: 'Solidarité',      icon: '🤝', gfPath: '/tontines' },
  { key: 'vestimentaire',label: 'Vestimentaire',   icon: '👕', gfPath: '/marketplace?cat=mode' },
  { key: 'loisirs',      label: 'Loisirs',         icon: '🎉' },
  { key: 'epargne',      label: 'Épargne',         icon: '🏦' },
  { key: 'divers',       label: 'Divers',           icon: '📦' },
]

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]

export function getCategoryMeta(key: string): BudgetCategory {
  return ALL_CATEGORIES.find(c => c.key === key) ?? { key, label: key, icon: '📦' }
}

/** Icônes suggérées pour les objectifs d'épargne */
export const GOAL_ICONS = [
  '🎯','🏠','🚗','✈️','📚','💊','👶','💍','📱','🛋️','🌱','💻','🏋️','🎓','🏦'
]

/** Catégories pour filtrage des tontines depuis les objectifs */
export const GOAL_CATEGORIES = [
  { key: 'logement',      label: 'Logement',        icon: '🏠' },
  { key: 'education',     label: 'Éducation',       icon: '📚' },
  { key: 'sante',         label: 'Santé',           icon: '💊' },
  { key: 'voyage',        label: 'Voyage',          icon: '✈️' },
  { key: 'equipement',    label: 'Équipement',      icon: '🛋️' },
  { key: 'urgence',       label: 'Fonds d\'urgence',icon: '🏦' },
  { key: 'evenement',     label: 'Événement',       icon: '💍' },
  { key: 'investissement',label: 'Investissement',  icon: '🌱' },
  { key: 'autre',         label: 'Autre',           icon: '🎯' },
]
