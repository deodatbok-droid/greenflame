'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'

// ── Types ──────────────────────────────────────────────────────────────────

type RestoIngredient = {
  id: string
  name: string
  unit: string
  price_per_unit_fcfa: number
}

type RecetteIngredientItem = {
  quantity_used: number
  resto_ingredients: RestoIngredient
}

type RestoRecette = {
  id: string
  name: string
  portions: number
  selling_price_per_portion_fcfa: number
  category: string
  notes: string | null
  resto_recette_ingredients: RecetteIngredientItem[]
}

type RestoMenuPlat = {
  id: string
  menu_id: string
  nom_plat: string
  description: string | null
  categorie: string
  prix_vente_fcfa: number
  recette_id: string | null
  disponible: boolean
  position: number
}

type RestoMenu = {
  id: string
  date: string
  titre: string | null
  statut: 'brouillon' | 'publié' | 'archivé'
  notes: string | null
  resto_menu_plats: RestoMenuPlat[]
}

type RestoClientType = {
  id: string
  nom: string
  téléphone: string | null
  email: string | null
  notes: string | null
  preferences: string | null
  nb_visites: number
  total_depenses_fcfa: number
}

type RestoCommandePlat = {
  id: string
  nom_plat: string
  prix_unitaire_fcfa: number
  quantite: number
  notes: string | null
}

type RestoCommande = {
  id: string
  client_id: string | null
  nom_client: string | null
  table_num: string | null
  nb_couverts: number
  statut: 'en_cours' | 'servi' | 'payé' | 'annulé'
  notes: string | null
  total_fcfa: number
  created_at: string
  resto_commande_plats: RestoCommandePlat[]
}

type Tab = 'stocks' | 'recettes' | 'menu' | 'clients' | 'commandes' | 'traiteur'
type CommandeFilter = 'en_cours' | 'servi' | 'payé' | 'toutes'

type TraiteurLine = {
  recetteId: string
  convives: number
}

// ── Constantes (visual-only, no translation needed) ─────────────────────────

const UNITS = ['kg', 'L', 'g', 'mL', 'pièce', 'sachet', 'botte']
const CATEGORIES = ['plat', 'sauce', 'accompagnement', 'boisson', 'dessert', 'autre']

const STATUT_BADGE: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  publié:    'bg-green-100 text-green-700',
  archivé:   'bg-orange-100 text-orange-600',
}

const COMMANDE_BADGE: Record<string, string> = {
  en_cours: 'bg-blue-100 text-blue-700',
  servi:    'bg-orange-100 text-orange-700',
  payé:     'bg-green-100 text-green-700',
  annulé:   'bg-gray-100 text-gray-500',
}

// ── Calculs ─────────────────────────────────────────────────────────────────

function calcRecetteCost(r: RestoRecette) {
  return r.resto_recette_ingredients.reduce((acc, i) => acc + i.resto_ingredients.price_per_unit_fcfa * i.quantity_used, 0)
}
function calcCostPerPortion(r: RestoRecette) {
  return r.portions <= 0 ? 0 : calcRecetteCost(r) / r.portions
}
function calcMarginPerPortion(r: RestoRecette) {
  return r.selling_price_per_portion_fcfa - calcCostPerPortion(r)
}
function calcMarginPct(r: RestoRecette) {
  if (r.selling_price_per_portion_fcfa <= 0) return 0
  return Math.round((calcMarginPerPortion(r) / r.selling_price_per_portion_fcfa) * 100)
}
function marginColor(pct: number) {
  if (pct >= 40) return 'text-green-600'
  if (pct >= 20) return 'text-orange-500'
  return 'text-red-500'
}
function marginBgColor(pct: number) {
  if (pct >= 40) return 'bg-green-50'
  if (pct >= 20) return 'bg-orange-50'
  return 'bg-red-50'
}

// ── Props ───────────────────────────────────────────────────────────────────

type Props = {
  merchantId: string
  businessName: string
  initialIngredients: RestoIngredient[]
  initialRecettes: RestoRecette[]
  initialMenus: RestoMenu[]
  initialClients: RestoClientType[]
  initialCommandes: RestoCommande[]
}

// ── Composant principal ─────────────────────────────────────────────────────

export default function RestoClient({
  merchantId: _merchantId,
  businessName,
  initialIngredients,
  initialRecettes,
  initialMenus,
  initialClients,
  initialCommandes,
}: Props) {
  const { t } = useLocale()
  const [tab, setTab] = useState<Tab>('stocks')

  const CATEGORY_LABELS: Record<string, string> = {
    plat: t('merchant.resto.catPlat'),
    sauce: t('merchant.resto.catSauce'),
    accompagnement: t('merchant.resto.catAccomp'),
    boisson: t('merchant.resto.catBoisson'),
    dessert: t('merchant.resto.catDessert'),
    autre: t('merchant.resto.catAutre'),
  }

  const TAB_LABELS: Record<Tab, string> = {
    stocks: t('merchant.resto.tabStocks'),
    recettes: t('merchant.resto.tabRecettes'),
    menu: t('merchant.resto.tabMenu'),
    clients: t('merchant.resto.tabClients'),
    commandes: t('merchant.resto.tabCommandes'),
    traiteur: t('merchant.resto.tabTraiteur'),
  }

  const MENU_STATUT_LABELS: Record<string, string> = {
    brouillon: t('merchant.resto.menuStatutBrouillon'),
    publié: t('merchant.resto.menuStatutPublie'),
    archivé: t('merchant.resto.menuStatutArchive'),
  }

  const CMD_STATUT_LABELS: Record<string, string> = {
    en_cours: t('merchant.resto.cmdStatutEnCours'),
    servi: t('merchant.resto.cmdStatutServi'),
    payé: t('merchant.resto.cmdStatutPaye'),
    annulé: t('merchant.resto.cmdStatutAnnule'),
  }

  // ── État global ──────────────────────────────────────────────────────────
  const [ingredients, setIngredients] = useState<RestoIngredient[]>(initialIngredients)
  const [recettes, setRecettes] = useState<RestoRecette[]>(initialRecettes)
  const [menus, setMenus] = useState<RestoMenu[]>(initialMenus)
  const [clients, setClients] = useState<RestoClientType[]>(initialClients)
  const [commandes, setCommandes] = useState<RestoCommande[]>(initialCommandes)

  // ══════════════════════════════════════════════════════════════════════════
  // TAB STOCKS
  // ══════════════════════════════════════════════════════════════════════════

  const [showAddIngredient, setShowAddIngredient] = useState(false)
  const [ingForm, setIngForm] = useState({ name: '', unit: 'kg', price_per_unit_fcfa: '' })
  const [savingIng, setSavingIng] = useState(false)

  async function handleAddIngredient(e: React.FormEvent) {
    e.preventDefault()
    setSavingIng(true)
    try {
      const res = await fetch('/api/resto/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ingForm.name, unit: ingForm.unit,
          price_per_unit_fcfa: parseFloat(ingForm.price_per_unit_fcfa),
        }),
      })
      if (!res.ok) { const e = await res.json() as { error: string }; toast.error(e.error ?? t('common.error')); return }
      const newIng = await res.json() as RestoIngredient
      setIngredients((p) => [...p, newIng].sort((a, b) => a.name.localeCompare(b.name)))
      setIngForm({ name: '', unit: 'kg', price_per_unit_fcfa: '' })
      setShowAddIngredient(false)
      toast.success(t('merchant.resto.ingAdded'))
    } finally { setSavingIng(false) }
  }

  async function handleDeleteIngredient(id: string) {
    if (!confirm(t('merchant.resto.deleteIngredientConfirm'))) return
    const res = await fetch(`/api/resto/ingredients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setIngredients((p) => p.filter((i) => i.id !== id))
      setRecettes((p) => p.map((r) => ({
        ...r,
        resto_recette_ingredients: r.resto_recette_ingredients.filter((i) => i.resto_ingredients.id !== id),
      })))
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB RECETTES
  // ══════════════════════════════════════════════════════════════════════════

  const [showAddRecette, setShowAddRecette] = useState(false)
  const [editingRecette, setEditingRecette] = useState<RestoRecette | null>(null)
  const [recForm, setRecForm] = useState({
    name: '', category: 'plat', portions: '4', selling_price_per_portion_fcfa: '', notes: '',
  })
  const [recItems, setRecItems] = useState<{ ingredient_id: string; quantity_used: string }[]>([
    { ingredient_id: '', quantity_used: '' },
  ])
  const [savingRec, setSavingRec] = useState(false)

  function openAddRecette() {
    setEditingRecette(null)
    setRecForm({ name: '', category: 'plat', portions: '4', selling_price_per_portion_fcfa: '', notes: '' })
    setRecItems([{ ingredient_id: '', quantity_used: '' }])
    setShowAddRecette(true)
  }

  function openEditRecette(r: RestoRecette) {
    setEditingRecette(r)
    setRecForm({
      name: r.name, category: r.category, portions: String(r.portions),
      selling_price_per_portion_fcfa: r.selling_price_per_portion_fcfa > 0 ? String(r.selling_price_per_portion_fcfa) : '',
      notes: r.notes ?? '',
    })
    setRecItems(r.resto_recette_ingredients.length > 0
      ? r.resto_recette_ingredients.map((i) => ({ ingredient_id: i.resto_ingredients.id, quantity_used: String(i.quantity_used) }))
      : [{ ingredient_id: '', quantity_used: '' }])
    setShowAddRecette(true)
  }

  async function handleSaveRecette(e: React.FormEvent) {
    e.preventDefault()
    setSavingRec(true)
    const items = recItems
      .filter((i) => i.ingredient_id && i.quantity_used)
      .map((i) => ({ ingredient_id: i.ingredient_id, quantity_used: parseFloat(i.quantity_used) }))
    const payload = {
      name: recForm.name, category: recForm.category,
      portions: parseInt(recForm.portions, 10) || 1,
      selling_price_per_portion_fcfa: recForm.selling_price_per_portion_fcfa ? parseInt(recForm.selling_price_per_portion_fcfa, 10) : 0,
      notes: recForm.notes || null, items,
    }
    try {
      const url = editingRecette ? `/api/resto/recettes/${editingRecette.id}` : '/api/resto/recettes'
      const method = editingRecette ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json() as { error: string }; toast.error(err.error ?? t('common.error')); return }
      const saved = await res.json() as RestoRecette
      if (editingRecette) setRecettes((p) => p.map((r) => r.id === saved.id ? saved : r))
      else setRecettes((p) => [...p, saved])
      setShowAddRecette(false); setEditingRecette(null)
      toast.success(editingRecette ? t('merchant.resto.recUpdated') : t('merchant.resto.recSaved'))
    } finally { setSavingRec(false) }
  }

  async function handleDeleteRecette(id: string) {
    if (!confirm(t('merchant.resto.deleteRecetteConfirm'))) return
    const res = await fetch(`/api/resto/recettes/${id}`, { method: 'DELETE' })
    if (res.ok) setRecettes((p) => p.filter((r) => r.id !== id))
  }

  const formRecetteCost = recItems.reduce((total, item) => {
    if (!item.ingredient_id || !item.quantity_used) return total
    const ing = ingredients.find((i) => i.id === item.ingredient_id)
    return ing ? total + ing.price_per_unit_fcfa * parseFloat(item.quantity_used || '0') : total
  }, 0)
  const formPortions = parseInt(recForm.portions, 10) || 1
  const formCostPerPortion = formPortions > 0 ? formRecetteCost / formPortions : 0

  // ══════════════════════════════════════════════════════════════════════════
  // TAB MENU DU JOUR
  // ══════════════════════════════════════════════════════════════════════════

  const todayStr = new Date().toISOString().slice(0, 10)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [menuForm, setMenuForm] = useState({ date: todayStr, titre: '', notes: '' })
  const [savingMenu, setSavingMenu] = useState(false)
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null)
  const [addingPlatTo, setAddingPlatTo] = useState<string | null>(null)
  const [platForm, setPlatForm] = useState({
    nom_plat: '', categorie: 'plat', prix_vente_fcfa: '', description: '', disponible: true, recette_id: '',
  })
  const [savingPlat, setSavingPlat] = useState(false)

  async function handleCreateMenu(e: React.FormEvent) {
    e.preventDefault()
    setSavingMenu(true)
    try {
      const res = await fetch('/api/resto/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: menuForm.date, titre: menuForm.titre || null, notes: menuForm.notes || null }),
      })
      if (!res.ok) { const err = await res.json() as { error: string }; toast.error(err.error ?? t('common.error')); return }
      const menu = await res.json() as RestoMenu
      setMenus((p) => [menu, ...p])
      setMenuForm({ date: todayStr, titre: '', notes: '' })
      setShowCreateMenu(false)
      setExpandedMenuId(menu.id)
      toast.success(t('merchant.resto.menuCreated'))
    } finally { setSavingMenu(false) }
  }

  async function handleMenuStatut(menu: RestoMenu, statut: RestoMenu['statut']) {
    const res = await fetch(`/api/resto/menus/${menu.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    })
    if (!res.ok) { toast.error(t('common.error')); return }
    const updated = await res.json() as RestoMenu
    setMenus((p) => p.map((m) => m.id === menu.id ? updated : m))
    toast.success(
      statut === 'publié' ? t('merchant.resto.menuPublished')
        : statut === 'archivé' ? t('merchant.resto.menuArchived')
        : t('merchant.resto.menuBackToDraft')
    )
  }

  async function handleAddPlat(menuId: string) {
    if (!platForm.nom_plat.trim()) { toast.error(t('merchant.resto.platNameRequired')); return }
    setSavingPlat(true)
    const menu = menus.find((m) => m.id === menuId)!
    const existingPlats = menu.resto_menu_plats.map((p, i) => ({
      nom_plat: p.nom_plat, description: p.description, categorie: p.categorie,
      prix_vente_fcfa: p.prix_vente_fcfa, recette_id: p.recette_id, disponible: p.disponible, position: i,
    }))
    const newPlat = {
      nom_plat: platForm.nom_plat.trim(),
      description: platForm.description || null,
      categorie: platForm.categorie,
      prix_vente_fcfa: parseInt(platForm.prix_vente_fcfa, 10) || 0,
      recette_id: platForm.recette_id || null,
      disponible: platForm.disponible,
      position: existingPlats.length,
    }
    try {
      const res = await fetch(`/api/resto/menus/${menuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plats: [...existingPlats, newPlat] }),
      })
      if (!res.ok) { const err = await res.json() as { error: string }; toast.error(err.error ?? t('common.error')); return }
      const updated = await res.json() as RestoMenu
      setMenus((p) => p.map((m) => m.id === menuId ? updated : m))
      setPlatForm({ nom_plat: '', categorie: 'plat', prix_vente_fcfa: '', description: '', disponible: true, recette_id: '' })
      setAddingPlatTo(null)
      toast.success(t('merchant.resto.platAdded'))
    } finally { setSavingPlat(false) }
  }

  async function handleRemovePlat(menuId: string, platId: string) {
    const menu = menus.find((m) => m.id === menuId)!
    const remaining = menu.resto_menu_plats.filter((p) => p.id !== platId).map((p, i) => ({
      nom_plat: p.nom_plat, description: p.description, categorie: p.categorie,
      prix_vente_fcfa: p.prix_vente_fcfa, recette_id: p.recette_id, disponible: p.disponible, position: i,
    }))
    const res = await fetch(`/api/resto/menus/${menuId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plats: remaining }),
    })
    if (!res.ok) { toast.error(t('common.error')); return }
    const updated = await res.json() as RestoMenu
    setMenus((p) => p.map((m) => m.id === menuId ? updated : m))
  }

  async function handleTogglePlatDisponible(menuId: string, platId: string) {
    const menu = menus.find((m) => m.id === menuId)!
    const updatedPlats = menu.resto_menu_plats.map((p, i) => ({
      nom_plat: p.nom_plat, description: p.description, categorie: p.categorie,
      prix_vente_fcfa: p.prix_vente_fcfa, recette_id: p.recette_id,
      disponible: p.id === platId ? !p.disponible : p.disponible, position: i,
    }))
    const res = await fetch(`/api/resto/menus/${menuId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plats: updatedPlats }),
    })
    if (res.ok) {
      const updated = await res.json() as RestoMenu
      setMenus((p) => p.map((m) => m.id === menuId ? updated : m))
    }
  }

  async function handleDeleteMenu(id: string) {
    if (!confirm(t('merchant.resto.deleteMenuConfirm'))) return
    const res = await fetch(`/api/resto/menus/${id}`, { method: 'DELETE' })
    if (res.ok) setMenus((p) => p.filter((m) => m.id !== id))
    else toast.error(t('merchant.resto.deletionError'))
  }

  function prefillPlatFromRecette(recetteId: string) {
    const r = recettes.find((rec) => rec.id === recetteId)
    if (!r) return
    setPlatForm((f) => ({
      ...f,
      recette_id: recetteId,
      nom_plat: r.name,
      categorie: r.category,
      prix_vente_fcfa: r.selling_price_per_portion_fcfa > 0 ? String(r.selling_price_per_portion_fcfa) : f.prix_vente_fcfa,
    }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB CLIENTS
  // ══════════════════════════════════════════════════════════════════════════

  const [clientSearch, setClientSearch] = useState('')
  const [showAddClient, setShowAddClient] = useState(false)
  const [editingClient, setEditingClient] = useState<RestoClientType | null>(null)
  const [clientForm, setClientForm] = useState({ nom: '', téléphone: '', email: '', notes: '', preferences: '' })
  const [savingClient, setSavingClient] = useState(false)

  const filteredClients = clients.filter((c) =>
    c.nom.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.téléphone ?? '').includes(clientSearch)
  )

  function openAddClient() {
    setEditingClient(null)
    setClientForm({ nom: '', téléphone: '', email: '', notes: '', preferences: '' })
    setShowAddClient(true)
  }

  function openEditClient(c: RestoClientType) {
    setEditingClient(c)
    setClientForm({ nom: c.nom, téléphone: c.téléphone ?? '', email: c.email ?? '', notes: c.notes ?? '', preferences: c.preferences ?? '' })
    setShowAddClient(true)
  }

  async function handleSaveClient(e: React.FormEvent) {
    e.preventDefault()
    if (!clientForm.nom.trim()) { toast.error(t('merchant.resto.clientNameRequired')); return }
    setSavingClient(true)
    try {
      const payload = {
        nom: clientForm.nom.trim(),
        téléphone: clientForm.téléphone || null,
        email: clientForm.email || null,
        notes: clientForm.notes || null,
        preferences: clientForm.preferences || null,
      }
      if (editingClient) {
        const res = await fetch(`/api/resto/clients/${editingClient.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) { const err = await res.json() as { error: string }; toast.error(err.error ?? t('common.error')); return }
        const saved = await res.json() as RestoClientType
        setClients((p) => p.map((c) => c.id === saved.id ? saved : c))
        toast.success(t('merchant.resto.clientUpdated'))
      } else {
        const res = await fetch('/api/resto/clients', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) { const err = await res.json() as { error: string }; toast.error(err.error ?? t('common.error')); return }
        const saved = await res.json() as RestoClientType
        setClients((p) => [...p, saved].sort((a, b) => a.nom.localeCompare(b.nom)))
        toast.success(t('merchant.resto.clientAdded'))
      }
      setShowAddClient(false); setEditingClient(null)
    } finally { setSavingClient(false) }
  }

  async function handleDeleteClient(id: string) {
    if (!confirm(t('merchant.resto.deleteClientConfirm'))) return
    const res = await fetch(`/api/resto/clients/${id}`, { method: 'DELETE' })
    if (res.ok) setClients((p) => p.filter((c) => c.id !== id))
    else toast.error(t('merchant.resto.deletionError'))
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB COMMANDES
  // ══════════════════════════════════════════════════════════════════════════

  const [commandeFilter, setCommandeFilter] = useState<CommandeFilter>('en_cours')
  const [showNewCommande, setShowNewCommande] = useState(false)
  const [commandeForm, setCommandeForm] = useState({
    table_num: '', nb_couverts: '1', nom_client: '', client_id: '', notes: '',
  })
  const [commandeItems, setCommandeItems] = useState<{ nom_plat: string; prix_unitaire_fcfa: string; quantite: string }[]>([
    { nom_plat: '', prix_unitaire_fcfa: '', quantite: '1' },
  ])
  const [savingCommande, setSavingCommande] = useState(false)

  const todayMenu = menus.find((m) => m.date === todayStr && m.statut === 'publié')

  const filteredCommandes = commandes.filter((c) =>
    commandeFilter === 'toutes' || c.statut === commandeFilter
  )

  function addCommandeItem() {
    setCommandeItems((p) => [...p, { nom_plat: '', prix_unitaire_fcfa: '', quantite: '1' }])
  }

  function removeCommandeItem(idx: number) {
    setCommandeItems((p) => p.filter((_, i) => i !== idx))
  }

  function updateCommandeItem(idx: number, patch: Partial<typeof commandeItems[0]>) {
    setCommandeItems((p) => p.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  function addFromMenu(plat: RestoMenuPlat) {
    setCommandeItems((p) => {
      const empty = p.findIndex((i) => !i.nom_plat)
      const newItem = { nom_plat: plat.nom_plat, prix_unitaire_fcfa: String(plat.prix_vente_fcfa), quantite: '1' }
      if (empty >= 0) return p.map((i, idx) => idx === empty ? newItem : i)
      return [...p, newItem]
    })
  }

  const commandeTotal = commandeItems.reduce((s, i) => {
    const price = parseInt(i.prix_unitaire_fcfa, 10) || 0
    const qty = parseInt(i.quantite, 10) || 1
    return s + price * qty
  }, 0)

  async function handleCreateCommande(e: React.FormEvent) {
    e.preventDefault()
    const validItems = commandeItems.filter((i) => i.nom_plat.trim())
    if (validItems.length === 0) { toast.error(t('merchant.resto.cmdAtLeastOnePlat')); return }
    setSavingCommande(true)
    try {
      const payload = {
        table_num: commandeForm.table_num || null,
        nb_couverts: parseInt(commandeForm.nb_couverts, 10) || 1,
        nom_client: commandeForm.nom_client || null,
        client_id: commandeForm.client_id || null,
        notes: commandeForm.notes || null,
        plats: validItems.map((i) => ({
          nom_plat: i.nom_plat.trim(),
          prix_unitaire_fcfa: parseInt(i.prix_unitaire_fcfa, 10) || 0,
          quantite: parseInt(i.quantite, 10) || 1,
        })),
      }
      const res = await fetch('/api/resto/commandes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!res.ok) { const err = await res.json() as { error: string }; toast.error(err.error ?? t('common.error')); return }
      const cmd = await res.json() as RestoCommande
      setCommandes((p) => [cmd, ...p])
      setShowNewCommande(false)
      setCommandeForm({ table_num: '', nb_couverts: '1', nom_client: '', client_id: '', notes: '' })
      setCommandeItems([{ nom_plat: '', prix_unitaire_fcfa: '', quantite: '1' }])
      setCommandeFilter('en_cours')
      toast.success(t('merchant.resto.cmdCreated'))
    } finally { setSavingCommande(false) }
  }

  async function handleCommandeStatut(id: string, statut: RestoCommande['statut']) {
    const res = await fetch(`/api/resto/commandes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut }),
    })
    if (!res.ok) { toast.error(t('common.error')); return }
    const updated = await res.json() as RestoCommande
    setCommandes((p) => p.map((c) => c.id === id ? updated : c))
    if (statut === 'payé') {
      const cmd = commandes.find((c) => c.id === id)
      if (cmd?.client_id) {
        const c = clients.find((cl) => cl.id === cmd.client_id)
        if (c) {
          setClients((p) => p.map((cl) => cl.id === c.id
            ? { ...cl, nb_visites: cl.nb_visites + 1, total_depenses_fcfa: cl.total_depenses_fcfa + cmd.total_fcfa }
            : cl
          ))
        }
      }
    }
    toast.success(
      statut === 'payé' ? t('merchant.resto.cmdPaidToast')
        : statut === 'servi' ? t('merchant.resto.cmdServedToast')
        : t('merchant.resto.cmdCancelledToast')
    )
  }

  async function handleDeleteCommande(id: string) {
    if (!confirm(t('merchant.resto.deleteCommandeConfirm'))) return
    const res = await fetch(`/api/resto/commandes/${id}`, { method: 'DELETE' })
    if (res.ok) setCommandes((p) => p.filter((c) => c.id !== id))
    else toast.error(t('merchant.resto.deletionError'))
  }

  function printTicket(cmd: RestoCommande) {
    const lignes = cmd.resto_commande_plats.map((p) =>
      `<tr><td style="padding:4px 8px;">${p.nom_plat}</td><td style="padding:4px 8px;text-align:center;">${p.quantite}</td><td style="padding:4px 8px;text-align:right;">${(p.prix_unitaire_fcfa * p.quantite).toLocaleString()} F</td></tr>`
    ).join('')
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Ticket</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:monospace;font-size:12px;width:280px;padding:12px;}
h2{text-align:center;font-size:14px;margin-bottom:4px;}p{text-align:center;font-size:10px;color:#555;}
hr{border:none;border-top:1px dashed #999;margin:8px 0;}
table{width:100%;border-collapse:collapse;}th{font-size:10px;color:#888;padding:4px 8px;}
.total{font-weight:bold;font-size:13px;text-align:right;padding:8px;}
</style></head><body>
<h2>${businessName}</h2>
<p>${new Date().toLocaleString()}</p>
<hr/>
${cmd.table_num ? `<p><strong>${t('merchant.resto.ticketTable')}</strong> ${cmd.table_num}</p>` : ''}
${cmd.nom_client ? `<p><strong>${t('merchant.resto.ticketClient')}</strong> ${cmd.nom_client}</p>` : ''}
<hr/>
<table><thead><tr><th style="text-align:left;">${t('merchant.resto.ticketPlat')}</th><th>${t('merchant.resto.ticketQty')}</th><th style="text-align:right;">${t('merchant.resto.ticketPrice')}</th></tr></thead>
<tbody>${lignes}</tbody></table>
<hr/>
<div class="total">${t('merchant.resto.ticketTotal')} ${cmd.total_fcfa.toLocaleString()} FCFA</div>
<hr/>
<p>${t('merchant.resto.ticketThanks')}</p>
</body></html>`
    const w = window.open('', '_blank', 'width=320,height=500')
    if (!w) return
    w.document.write(html); w.document.close(); w.onload = () => w.print()
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB TRAITEUR
  // ══════════════════════════════════════════════════════════════════════════

  const [lines, setLines] = useState<TraiteurLine[]>([{ recetteId: '', convives: 1 }])
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [clientName, setClientName] = useState('')
  const [quotePrice, setQuotePrice] = useState<number>(0)

  function addLine() { setLines((p) => [...p, { recetteId: '', convives: 1 }]) }
  function removeLine(idx: number) { setLines((p) => p.filter((_, i) => i !== idx)) }
  function updateLine(idx: number, patch: Partial<TraiteurLine>) {
    setLines((p) => p.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }

  type IngredientAggregate = { name: string; unit: string; totalQty: number; totalCost: number }
  const activeLines = lines.filter((l) => l.recetteId !== '')
  const aggregatedIngredients: Record<string, IngredientAggregate> = {}
  let totalBrutIngredients = 0
  for (const line of activeLines) {
    const recette = recettes.find((r) => r.id === line.recetteId)
    if (!recette) continue
    const costPerPortion = calcCostPerPortion(recette)
    totalBrutIngredients += costPerPortion * line.convives
    for (const item of recette.resto_recette_ingredients) {
      const qtyNeeded = (item.quantity_used / recette.portions) * line.convives
      const cost = item.resto_ingredients.price_per_unit_fcfa * qtyNeeded
      const key = item.resto_ingredients.id
      if (aggregatedIngredients[key]) {
        aggregatedIngredients[key].totalQty += qtyNeeded
        aggregatedIngredients[key].totalCost += cost
      } else {
        aggregatedIngredients[key] = { name: item.resto_ingredients.name, unit: item.resto_ingredients.unit, totalQty: qtyNeeded, totalCost: cost }
      }
    }
  }
  const totalBrutRounded = Math.round(totalBrutIngredients)
  const suggestedQuotePrice = totalBrutRounded > 0 ? Math.round((totalBrutRounded / 0.5) / 100) * 100 : 0

  function generateDevis() {
    const now = new Date()
    const dateStr = now.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
    const seqKey = 'gf_dt_seq'
    const seq = parseInt(localStorage.getItem(seqKey) ?? '0', 10) + 1
    localStorage.setItem(seqKey, String(seq))
    const devisNum = `DT-${now.getFullYear()}-${String(seq).padStart(3, '0')}`
    const linesHtml = activeLines.map((line) => {
      const recette = recettes.find((r) => r.id === line.recetteId)
      if (!recette) return ''
      const sousTotal = recette.selling_price_per_portion_fcfa > 0
        ? recette.selling_price_per_portion_fcfa * line.convives
        : Math.round(calcCostPerPortion(recette) * line.convives * 2)
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${recette.name}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${line.convives}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${recette.selling_price_per_portion_fcfa > 0 ? recette.selling_price_per_portion_fcfa.toLocaleString() + ' FCFA' : '—'}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${sousTotal.toLocaleString()} FCFA</td></tr>`
    }).join('')
    const ingredientsHtml = Object.values(aggregatedIngredients).map((agg) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${agg.name}</td><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">${agg.totalQty < 1 ? agg.totalQty.toFixed(3) : agg.totalQty.toFixed(2)} ${agg.unit}</td><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">${Math.round(agg.totalCost).toLocaleString()} FCFA</td></tr>`).join('')
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Devis Traiteur ${devisNum}</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Georgia',serif;color:#1a1a1a;padding:40px;max-width:680px;margin:auto;font-size:13px;}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #166534;padding-bottom:20px;margin-bottom:28px;}.header h1{font-size:22px;color:#166534;font-weight:bold;}.header p{font-size:11px;color:#555;margin-top:4px;}.devis-title{font-size:18px;font-weight:bold;text-transform:uppercase;color:#166534;text-align:right;}.devis-num{font-size:12px;color:#888;text-align:right;margin-top:4px;}.section{margin:20px 0;}.section-title{font-size:13px;text-transform:uppercase;color:#888;letter-spacing:0.05em;margin-bottom:10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;}table{width:100%;border-collapse:collapse;}th{background:#f9fafb;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.04em;border-bottom:2px solid #e5e7eb;}.total-row{background:#f0fdf4;font-size:15px;}.total-row td{padding:12px;font-weight:bold;color:#166534;}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;}.sig-zone{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:24px;}.sig-box{border-top:1px solid #9ca3af;padding-top:8px;font-size:11px;color:#888;}.page-break{page-break-before:always;}.internal{background:#fffbeb;border:1px dashed #d97706;border-radius:8px;padding:16px;margin-bottom:16px;}.internal p{font-size:11px;color:#92400e;font-weight:bold;margin-bottom:4px;}@media print{body{padding:20px;}.page-break{page-break-before:always;}}</style></head><body>
<div class="header"><div><h1>${businessName}</h1><p>Service Traiteur</p></div><div><div class="devis-title">Devis Traiteur</div><div class="devis-num">N° ${devisNum}</div><div class="devis-num">Émis le ${dateStr}</div></div></div>
<div class="section"><div class="section-title">Informations client</div><p><strong>Client :</strong> ${clientName || '—'}</p>${eventName ? `<p style="margin-top:6px;"><strong>Événement :</strong> ${eventName}</p>` : ''}${eventDate ? `<p style="margin-top:6px;"><strong>Date :</strong> ${new Date(eventDate).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>` : ''}</div>
<div class="section"><div class="section-title">Plats commandés</div><table><thead><tr><th>Plat</th><th style="text-align:center;">Convives</th><th style="text-align:right;">Prix/portion</th><th style="text-align:right;">Sous-total</th></tr></thead><tbody>${linesHtml}<tr class="total-row"><td colspan="3">Total devis</td><td style="text-align:right;">${(quotePrice || suggestedQuotePrice).toLocaleString()} FCFA</td></tr></tbody></table></div>
<div class="section"><div class="section-title">Conditions de paiement</div><p>50% d&apos;avance à la signature du devis, solde à la livraison.</p><p style="margin-top:6px;">Ce devis est valable 15 jours à compter de la date d&apos;émission.</p></div>
<div class="footer"><div class="sig-zone"><div><div class="sig-box">Signature du client</div></div><div><div class="sig-box">Signature ${businessName}</div></div></div><p style="text-align:center;font-size:10px;color:#aaa;margin-top:32px;">${t('merchant.resto.traiteurFooter')}</p></div>
<div class="page-break"></div>
<div class="internal"><p>Usage interne — Ne pas remettre au client</p><span style="font-size:11px;color:#92400e;">Liste des courses pour ${eventName || "l'événement"}</span></div>
<div class="section"><div class="section-title">Liste des courses (${activeLines.length} plat${activeLines.length > 1 ? 's' : ''})</div><table><thead><tr><th>Ingrédient</th><th style="text-align:center;">Quantité totale</th><th style="text-align:right;">Coût estimé</th></tr></thead><tbody>${ingredientsHtml}<tr class="total-row"><td colspan="2">Total brut ingrédients</td><td style="text-align:right;">${totalBrutRounded.toLocaleString()} FCFA</td></tr></tbody></table></div>
<div class="section"><p style="font-size:12px;color:#555;"><strong>Prix devis :</strong> ${(quotePrice || suggestedQuotePrice).toLocaleString()} FCFA</p><p style="font-size:12px;color:#555;margin-top:4px;"><strong>Marge brute estimée :</strong> ${((quotePrice || suggestedQuotePrice) - totalBrutRounded).toLocaleString()} FCFA</p></div>
<p style="text-align:center;font-size:10px;color:#aaa;margin-top:32px;">${t('merchant.resto.traiteurFooter')}</p>
</body></html>`
    const win = window.open('', '_blank', 'width=750,height=900')
    if (!win) return
    win.document.write(html); win.document.close(); win.onload = () => win.print()
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('merchant.resto.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('merchant.resto.subtitle')}</p>
        </div>
        <Link href="/merchant/tools" className="text-brand-600 text-sm">{t('merchant.resto.backToTools')}</Link>
      </div>

      {/* Onglets (scrollable) */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {(['stocks', 'recettes', 'menu', 'clients', 'commandes', 'traiteur'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`shrink-0 py-2 px-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              tab === tabKey ? 'bg-brand-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[tabKey]}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB STOCKS                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'stocks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.resto.stocksTitle')}</h2>
            {!showAddIngredient && (
              <button onClick={() => setShowAddIngredient(true)} className="btn-primary text-sm py-2 px-3">
                {t('merchant.resto.addIngredientBtn')}
              </button>
            )}
          </div>

          {showAddIngredient && (
            <form onSubmit={handleAddIngredient} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-gray-800 text-sm">{t('merchant.resto.newIngredientTitle')}</p>
              <div>
                <label className="label">{t('merchant.resto.ingName')}</label>
                <input className="input" placeholder={t('merchant.resto.ingNamePlaceholder')} value={ingForm.name}
                  onChange={(e) => setIngForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.resto.ingUnit')}</label>
                  <select className="input" value={ingForm.unit} onChange={(e) => setIngForm((f) => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('merchant.resto.ingPrice').replace('{unit}', ingForm.unit)}</label>
                  <input className="input" type="number" min="0" step="1" placeholder="Ex: 450"
                    value={ingForm.price_per_unit_fcfa} onChange={(e) => setIngForm((f) => ({ ...f, price_per_unit_fcfa: e.target.value }))} required />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingIng} className="btn-primary flex-1">{savingIng ? t('common.loading') : t('common.add')}</button>
                <button type="button" onClick={() => setShowAddIngredient(false)} className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">{t('common.cancel')}</button>
              </div>
            </form>
          )}

          {ingredients.length === 0 && !showAddIngredient && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">🧅</p>
              <p className="text-gray-500 text-sm">{t('merchant.resto.stocksEmpty')}</p>
              <button onClick={() => setShowAddIngredient(true)} className="btn-primary mt-4 text-sm py-2 px-4">{t('merchant.resto.addIngredientBtn')}</button>
            </div>
          )}

          {ingredients.map((ing) => (
            <div key={ing.id} className="card flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{ing.name}</p>
                <p className="text-xs text-brand-600 font-medium mt-0.5">{ing.price_per_unit_fcfa.toLocaleString()} FCFA/{ing.unit}</p>
              </div>
              <button onClick={() => handleDeleteIngredient(ing.id)} className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0" title={t('common.delete')}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB RECETTES                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'recettes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.resto.recettesTitle')}</h2>
            {!showAddRecette && (
              <button onClick={openAddRecette} className="btn-primary text-sm py-2 px-3">{t('merchant.resto.addRecetteBtn')}</button>
            )}
          </div>

          {showAddRecette && (
            <form onSubmit={handleSaveRecette} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-gray-800 text-sm">{editingRecette ? t('merchant.resto.editRecetteTitle') : t('merchant.resto.newRecetteTitle')}</p>
              <div>
                <label className="label">{t('merchant.resto.recName')}</label>
                <input className="input" placeholder={t('merchant.resto.recNamePlaceholder')} value={recForm.name}
                  onChange={(e) => setRecForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.resto.recCategory')}</label>
                  <select className="input" value={recForm.category} onChange={(e) => setRecForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('merchant.resto.recPortions')}</label>
                  <input className="input" type="number" min="1" placeholder="4" value={recForm.portions}
                    onChange={(e) => setRecForm((f) => ({ ...f, portions: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">{t('merchant.resto.recSellingPrice')}</label>
                <input className="input" type="number" min="0" placeholder="0 = non défini" value={recForm.selling_price_per_portion_fcfa}
                  onChange={(e) => setRecForm((f) => ({ ...f, selling_price_per_portion_fcfa: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('merchant.resto.recNotes')}</label>
                <textarea className="input min-h-[60px] resize-none" placeholder={t('merchant.resto.recNotesPlaceholder')} value={recForm.notes}
                  onChange={(e) => setRecForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label className="label mb-2 block">{t('merchant.resto.recIngredients')}</label>
                {ingredients.length === 0 && <p className="text-xs text-orange-500">{t('merchant.resto.recIngNoStocks')}</p>}
                <div className="space-y-2">
                  {recItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select className="input flex-1 text-sm" value={item.ingredient_id}
                        onChange={(e) => setRecItems((p) => p.map((it, i) => i === idx ? { ...it, ingredient_id: e.target.value } : it))}>
                        <option value="">{t('merchant.resto.recChooseIng')}</option>
                        {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                      </select>
                      <input className="input w-24 text-sm" type="number" min="0.001" step="0.001" placeholder="Qté"
                        value={item.quantity_used}
                        onChange={(e) => setRecItems((p) => p.map((it, i) => i === idx ? { ...it, quantity_used: e.target.value } : it))} />
                      {item.ingredient_id && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {ingredients.find((i) => i.id === item.ingredient_id)?.unit}
                        </span>
                      )}
                      <button type="button" onClick={() => setRecItems((p) => p.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setRecItems((p) => [...p, { ingredient_id: '', quantity_used: '' }])}
                  className="mt-2 text-xs text-brand-600 hover:text-brand-800 font-medium">{t('merchant.resto.recAddIng')}</button>
                {formRecetteCost > 0 && (
                  <div className="mt-3 bg-white rounded-xl px-3 py-2 border border-brand-100">
                    <p className="text-xs text-gray-500">{t('merchant.resto.recTotalCost')}</p>
                    <p className="font-bold text-brand-700">{formatFcfa(Math.round(formRecetteCost))} ({formatFcfa(Math.round(formCostPerPortion))}/portion)</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingRec} className="btn-primary flex-1">{savingRec ? t('common.loading') : t('merchant.resto.recSaveBtn')}</button>
                <button type="button" onClick={() => { setShowAddRecette(false); setEditingRecette(null) }}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">{t('common.cancel')}</button>
              </div>
            </form>
          )}

          {recettes.length === 0 && !showAddRecette && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">👨‍🍳</p>
              <p className="text-gray-500 text-sm">{t('merchant.resto.recettesEmpty')}</p>
              <button onClick={openAddRecette} className="btn-primary mt-4 text-sm py-2 px-4">{t('merchant.resto.addRecetteBtn')}</button>
            </div>
          )}

          {CATEGORIES.map((cat) => {
            const catRec = recettes.filter((r) => r.category === cat)
            if (catRec.length === 0) return null
            return (
              <div key={cat} className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{CATEGORY_LABELS[cat]}</p>
                {catRec.map((recette) => {
                  const cost = Math.round(calcRecetteCost(recette))
                  const cpp = Math.round(calcCostPerPortion(recette))
                  const margin = Math.round(calcMarginPerPortion(recette))
                  const marginPct = calcMarginPct(recette)
                  return (
                    <div key={recette.id} className="card space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{recette.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {t('merchant.resto.recPortionCount')
                              .replace('{n}', String(recette.portions))
                              .replace('{s}', recette.portions > 1 ? 's' : '')}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => openEditRecette(recette)} className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 rounded-lg border border-brand-200 bg-brand-50">{t('common.edit')}</button>
                          <button onClick={() => handleDeleteRecette(recette.id)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg border border-red-100 bg-red-50">{t('common.delete')}</button>
                        </div>
                      </div>
                      {recette.resto_recette_ingredients.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {recette.resto_recette_ingredients.map((item, i) => (
                            <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {item.resto_ingredients.name} · {item.quantity_used} {item.resto_ingredients.unit}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-500">{t('merchant.resto.recTotalCostLabel')} <span className="font-medium text-gray-800">{formatFcfa(cost)}</span></p>
                        <p className="text-gray-500">{t('merchant.resto.recCostPerPortionLabel')} <span className="font-medium text-gray-800">{formatFcfa(cpp)}</span></p>
                        {recette.selling_price_per_portion_fcfa > 0 && (
                          <div className={`rounded-lg px-3 py-2 ${marginBgColor(marginPct)}`}>
                            <p className={`text-sm font-medium ${marginColor(marginPct)}`}>
                              {t('merchant.resto.recPriceMarginLabel')
                                .replace('{price}', formatFcfa(recette.selling_price_per_portion_fcfa))
                                .replace('{margin}', formatFcfa(margin))
                                .replace('{pct}', String(marginPct))}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB MENU DU JOUR                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'menu' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.resto.menuTitle')}</h2>
            {!showCreateMenu && (
              <button onClick={() => setShowCreateMenu(true)} className="btn-primary text-sm py-2 px-3">{t('merchant.resto.addMenuBtn')}</button>
            )}
          </div>

          {showCreateMenu && (
            <form onSubmit={handleCreateMenu} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-gray-800 text-sm">{t('merchant.resto.newMenuTitle')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.resto.menuDate')}</label>
                  <input className="input" type="date" value={menuForm.date}
                    onChange={(e) => setMenuForm((f) => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">{t('merchant.resto.menuTitre')}</label>
                  <input className="input" placeholder={t('merchant.resto.menuTitrePlaceholder')} value={menuForm.titre}
                    onChange={(e) => setMenuForm((f) => ({ ...f, titre: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">{t('merchant.resto.menuNotes')}</label>
                <input className="input" placeholder={t('merchant.resto.menuNotesPlaceholder')} value={menuForm.notes}
                  onChange={(e) => setMenuForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingMenu} className="btn-primary flex-1">{savingMenu ? t('common.loading') : t('merchant.resto.menuCreateBtn')}</button>
                <button type="button" onClick={() => setShowCreateMenu(false)} className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">{t('common.cancel')}</button>
              </div>
            </form>
          )}

          {menus.length === 0 && !showCreateMenu && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-gray-500 text-sm">{t('merchant.resto.menuEmpty')}</p>
              <button onClick={() => setShowCreateMenu(true)} className="btn-primary mt-4 text-sm py-2 px-4">{t('merchant.resto.addMenuBtn')}</button>
            </div>
          )}

          {menus.map((menu) => {
            const isExpanded = expandedMenuId === menu.id
            const isToday = menu.date === todayStr
            return (
              <div key={menu.id} className="card space-y-3">
                {/* En-tête du menu */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">
                        {isToday ? t('merchant.resto.menuToday') : new Date(menu.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' })}
                      </p>
                      {menu.titre && <p className="text-xs text-gray-500">· {menu.titre}</p>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_BADGE[menu.statut]}`}>
                        {MENU_STATUT_LABELS[menu.statut] ?? menu.statut}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t('merchant.resto.menuPlatCount')
                        .replace('{n}', String(menu.resto_menu_plats.length))
                        .replace('{s}', menu.resto_menu_plats.length !== 1 ? 's' : '')}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setExpandedMenuId(isExpanded ? null : menu.id)}
                      className="text-xs text-brand-600 font-medium px-2 py-1 rounded-lg bg-brand-50 border border-brand-200">
                      {isExpanded ? '▲' : '▼'}
                    </button>
                    <button onClick={() => handleDeleteMenu(menu.id)}
                      className="text-xs text-red-500 font-medium px-2 py-1 rounded-lg bg-red-50 border border-red-100">×</button>
                  </div>
                </div>

                {/* Boutons de statut */}
                <div className="flex gap-2 flex-wrap">
                  {menu.statut !== 'publié' && (
                    <button onClick={() => handleMenuStatut(menu, 'publié')}
                      className="text-xs text-green-700 font-medium px-3 py-1.5 rounded-xl bg-green-50 border border-green-200">
                      {t('merchant.resto.menuPublierBtn')}
                    </button>
                  )}
                  {menu.statut === 'publié' && (
                    <button onClick={() => handleMenuStatut(menu, 'brouillon')}
                      className="text-xs text-gray-600 font-medium px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
                      {t('merchant.resto.menuBrouillonBtn')}
                    </button>
                  )}
                  {menu.statut !== 'archivé' && (
                    <button onClick={() => handleMenuStatut(menu, 'archivé')}
                      className="text-xs text-orange-600 font-medium px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200">
                      {t('merchant.resto.menuArchiverBtn')}
                    </button>
                  )}
                </div>

                {/* Plats (si expanded) */}
                {isExpanded && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    {menu.resto_menu_plats.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">{t('merchant.resto.noPlatYet')}</p>
                    )}
                    {menu.resto_menu_plats
                      .slice()
                      .sort((a, b) => a.position - b.position)
                      .map((plat) => (
                        <div key={plat.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button
                              onClick={() => handleTogglePlatDisponible(menu.id, plat.id)}
                              className={`shrink-0 w-4 h-4 rounded-full border-2 transition-colors ${plat.disponible ? 'bg-green-400 border-green-400' : 'bg-white border-gray-300'}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${plat.disponible ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{plat.nom_plat}</p>
                              <p className="text-[10px] text-gray-400">{CATEGORY_LABELS[plat.categorie] ?? plat.categorie}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <p className="text-sm font-semibold text-brand-600">{formatFcfa(plat.prix_vente_fcfa)}</p>
                            <button onClick={() => handleRemovePlat(menu.id, plat.id)} className="text-red-400 hover:text-red-600 text-base leading-none">×</button>
                          </div>
                        </div>
                      ))}

                    {/* Formulaire ajout plat */}
                    {addingPlatTo === menu.id ? (
                      <div className="bg-brand-50 rounded-xl p-3 space-y-2 border border-brand-100">
                        <p className="text-xs font-medium text-gray-700">{t('merchant.resto.addPlatTitle')}</p>
                        {recettes.length > 0 && (
                          <div>
                            <label className="label">{t('merchant.resto.addPlatFromRecette')}</label>
                            <select className="input text-sm" value={platForm.recette_id}
                              onChange={(e) => { setPlatForm((f) => ({ ...f, recette_id: e.target.value })); prefillPlatFromRecette(e.target.value) }}>
                              <option value="">{t('merchant.resto.addPlatFromRecettePlaceholder')}</option>
                              {recettes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="label">{t('merchant.resto.platName')}</label>
                            <input className="input text-sm" placeholder={t('merchant.resto.platNamePlaceholder')} value={platForm.nom_plat}
                              onChange={(e) => setPlatForm((f) => ({ ...f, nom_plat: e.target.value }))} />
                          </div>
                          <div>
                            <label className="label">{t('merchant.resto.platCategory')}</label>
                            <select className="input text-sm" value={platForm.categorie}
                              onChange={(e) => setPlatForm((f) => ({ ...f, categorie: e.target.value }))}>
                              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="label">{t('merchant.resto.platPrice')}</label>
                            <input className="input text-sm" type="number" min="0" placeholder="1 000"
                              value={platForm.prix_vente_fcfa} onChange={(e) => setPlatForm((f) => ({ ...f, prix_vente_fcfa: e.target.value }))} />
                          </div>
                          <div>
                            <label className="label">{t('merchant.resto.platDesc')}</label>
                            <input className="input text-sm" placeholder={t('merchant.resto.platDescPlaceholder')}
                              value={platForm.description} onChange={(e) => setPlatForm((f) => ({ ...f, description: e.target.value }))} />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input type="checkbox" checked={platForm.disponible}
                            onChange={(e) => setPlatForm((f) => ({ ...f, disponible: e.target.checked }))} className="rounded" />
                          {t('merchant.resto.platDisponible')}
                        </label>
                        <div className="flex gap-2">
                          <button onClick={() => handleAddPlat(menu.id)} disabled={savingPlat}
                            className="btn-primary flex-1 text-xs py-2">{savingPlat ? t('common.loading') : t('merchant.resto.platAddBtn')}</button>
                          <button onClick={() => setAddingPlatTo(null)}
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium">{t('common.cancel')}</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingPlatTo(menu.id); setPlatForm({ nom_plat: '', categorie: 'plat', prix_vente_fcfa: '', description: '', disponible: true, recette_id: '' }) }}
                        className="w-full text-xs text-brand-600 hover:text-brand-800 font-medium py-2 border border-dashed border-brand-200 rounded-xl">
                        {t('merchant.resto.addPlatToMenu')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB CLIENTS                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'clients' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.resto.clientsTitle')}</h2>
            {!showAddClient && (
              <button onClick={openAddClient} className="btn-primary text-sm py-2 px-3">{t('merchant.resto.addClientBtn')}</button>
            )}
          </div>

          {showAddClient && (
            <form onSubmit={handleSaveClient} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-gray-800 text-sm">{editingClient ? t('merchant.resto.editClientTitle') : t('merchant.resto.newClientTitle')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.resto.clientNom')}</label>
                  <input className="input" placeholder={t('merchant.resto.clientNomPlaceholder')} value={clientForm.nom}
                    onChange={(e) => setClientForm((f) => ({ ...f, nom: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">{t('merchant.resto.clientTel')}</label>
                  <PhoneInput
                    value={clientForm.téléphone}
                    onChange={(v) => setClientForm((f) => ({ ...f, téléphone: v }))}
                    placeholder="97 00 00 00"
                  />
                </div>
              </div>
              <div>
                <label className="label">{t('merchant.resto.clientEmail')}</label>
                <input className="input" type="email" placeholder="ex@email.com" value={clientForm.email}
                  onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('merchant.resto.clientPrefs')}</label>
                <input className="input" placeholder={t('merchant.resto.clientPrefsPlaceholder')} value={clientForm.preferences}
                  onChange={(e) => setClientForm((f) => ({ ...f, preferences: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('merchant.resto.clientNotes')}</label>
                <textarea className="input min-h-[60px] resize-none" placeholder={t('merchant.resto.clientNotesPlaceholder')} value={clientForm.notes}
                  onChange={(e) => setClientForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingClient} className="btn-primary flex-1">{savingClient ? t('common.loading') : t('common.save')}</button>
                <button type="button" onClick={() => { setShowAddClient(false); setEditingClient(null) }}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">{t('common.cancel')}</button>
              </div>
            </form>
          )}

          {/* Recherche */}
          {clients.length > 0 && (
            <input className="input" placeholder={t('merchant.resto.clientSearch')} value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)} />
          )}

          {clients.length === 0 && !showAddClient && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">👤</p>
              <p className="text-gray-500 text-sm">{t('merchant.resto.clientsEmpty')}</p>
              <button onClick={openAddClient} className="btn-primary mt-4 text-sm py-2 px-4">{t('merchant.resto.addClientBtn')}</button>
            </div>
          )}

          {filteredClients.map((client) => (
            <div key={client.id} className="card space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{client.nom}</p>
                  {client.téléphone && <p className="text-xs text-gray-500 mt-0.5">{client.téléphone}</p>}
                  {client.preferences && (
                    <p className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full inline-block mt-1">
                      {client.preferences}
                    </p>
                  )}
                  {client.notes && <p className="text-xs text-gray-400 mt-1 italic">{client.notes}</p>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openEditClient(client)} className="text-xs text-brand-600 font-medium px-2 py-1 rounded-lg border border-brand-200 bg-brand-50">{t('common.edit')}</button>
                  <button onClick={() => handleDeleteClient(client.id)} className="text-xs text-red-500 font-medium px-2 py-1 rounded-lg border border-red-100 bg-red-50">×</button>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-center">
                  <p className="text-xs text-gray-400">{t('merchant.resto.clientVisites')}</p>
                  <p className="font-bold text-gray-800 text-sm">{client.nb_visites}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">{t('merchant.resto.clientTotalSpent')}</p>
                  <p className="font-bold text-brand-600 text-sm">{formatFcfa(client.total_depenses_fcfa)}</p>
                </div>
              </div>
            </div>
          ))}

          {clients.length > 0 && filteredClients.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">Aucun résultat pour &quot;{clientSearch}&quot;</p>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB COMMANDES                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'commandes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.resto.commandesTitle')}</h2>
            <button onClick={() => setShowNewCommande(true)} className="btn-primary text-sm py-2 px-3">{t('merchant.resto.addCommandeBtn')}</button>
          </div>

          {/* Formulaire nouvelle commande */}
          {showNewCommande && (
            <form onSubmit={handleCreateCommande} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-gray-800 text-sm">{t('merchant.resto.newCommandeTitle')}</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.resto.cmdTable')}</label>
                  <input className="input" placeholder={t('merchant.resto.cmdTablePlaceholder')}
                    value={commandeForm.table_num} onChange={(e) => setCommandeForm((f) => ({ ...f, table_num: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{t('merchant.resto.cmdCouvertsLabel2')}</label>
                  <input className="input" type="number" min="1" value={commandeForm.nb_couverts}
                    onChange={(e) => setCommandeForm((f) => ({ ...f, nb_couverts: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.resto.cmdClientLabel')}</label>
                  <select className="input text-sm" value={commandeForm.client_id}
                    onChange={(e) => {
                      const c = clients.find((cl) => cl.id === e.target.value)
                      setCommandeForm((f) => ({ ...f, client_id: e.target.value, nom_client: c?.nom ?? f.nom_client }))
                    }}>
                    <option value="">{t('merchant.resto.cmdClientNoReg')}</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('merchant.resto.cmdClientNom')}</label>
                  <input className="input" placeholder={t('merchant.resto.cmdClientNomPlaceholder')}
                    value={commandeForm.nom_client} onChange={(e) => setCommandeForm((f) => ({ ...f, nom_client: e.target.value }))} />
                </div>
              </div>

              {/* Ajout depuis le menu du jour */}
              {todayMenu && todayMenu.resto_menu_plats.filter((p) => p.disponible).length > 0 && (
                <div>
                  <label className="label">{t('merchant.resto.cmdFromMenu')}</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {todayMenu.resto_menu_plats.filter((p) => p.disponible).map((p) => (
                      <button key={p.id} type="button" onClick={() => addFromMenu(p)}
                        className="text-xs bg-white border border-brand-200 text-brand-700 px-2 py-1 rounded-xl hover:bg-brand-50">
                        {p.nom_plat} · {formatFcfa(p.prix_vente_fcfa)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lignes de plats */}
              <div>
                <label className="label mb-1 block">{t('merchant.resto.cmdPlatsLabel')}</label>
                <div className="space-y-2">
                  {commandeItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input className="input flex-1 text-sm" placeholder="Nom du plat" value={item.nom_plat}
                        onChange={(e) => updateCommandeItem(idx, { nom_plat: e.target.value })} />
                      <input className="input w-24 text-sm" type="number" min="0" placeholder="Prix" value={item.prix_unitaire_fcfa}
                        onChange={(e) => updateCommandeItem(idx, { prix_unitaire_fcfa: e.target.value })} />
                      <input className="input w-16 text-sm" type="number" min="1" placeholder="Qté" value={item.quantite}
                        onChange={(e) => updateCommandeItem(idx, { quantite: e.target.value })} />
                      {commandeItems.length > 1 && (
                        <button type="button" onClick={() => removeCommandeItem(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addCommandeItem} className="mt-2 text-xs text-brand-600 hover:text-brand-800 font-medium">{t('merchant.resto.cmdAddPlat')}</button>
              </div>

              {commandeTotal > 0 && (
                <div className="bg-brand-50 rounded-xl px-3 py-2 border border-brand-100">
                  <p className="text-xs text-gray-500">{t('merchant.resto.cmdTotal')}</p>
                  <p className="font-bold text-brand-700 text-lg">{formatFcfa(commandeTotal)}</p>
                </div>
              )}

              <div>
                <label className="label">{t('merchant.resto.cmdNotes')}</label>
                <input className="input" placeholder={t('merchant.resto.cmdNotesPlaceholder')}
                  value={commandeForm.notes} onChange={(e) => setCommandeForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={savingCommande} className="btn-primary flex-1">{savingCommande ? t('common.loading') : t('merchant.resto.cmdCreateBtn')}</button>
                <button type="button" onClick={() => setShowNewCommande(false)}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">{t('common.cancel')}</button>
              </div>
            </form>
          )}

          {/* Filtres */}
          <div className="flex gap-1">
            {(['en_cours', 'servi', 'payé', 'toutes'] as CommandeFilter[]).map((filterKey) => (
              <button key={filterKey} onClick={() => setCommandeFilter(filterKey)}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  commandeFilter === filterKey ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}>
                {filterKey === 'en_cours' ? t('merchant.resto.cmdFilterEnCours')
                  : filterKey === 'servi' ? t('merchant.resto.cmdFilterServi')
                  : filterKey === 'payé' ? t('merchant.resto.cmdFilterPaye')
                  : t('merchant.resto.cmdFilterToutes')}
                {filterKey !== 'toutes' && <span className="ml-1 font-bold">({commandes.filter((c) => c.statut === filterKey).length})</span>}
              </button>
            ))}
          </div>

          {filteredCommandes.length === 0 && !showNewCommande && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">🧾</p>
              <p className="text-gray-500 text-sm">
                {commandeFilter === 'en_cours' ? t('merchant.resto.cmdEmptyEnCours') : `${t('merchant.resto.cmdFilterToutes')} (0)`}
              </p>
            </div>
          )}

          {filteredCommandes.map((cmd) => (
            <div key={cmd.id} className={`card space-y-2 ${cmd.statut === 'en_cours' ? 'border-blue-200 bg-blue-50/30' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {cmd.table_num && <p className="font-semibold text-gray-900 text-sm">{cmd.table_num}</p>}
                    {cmd.nom_client && <p className="text-xs text-gray-600">· {cmd.nom_client}</p>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${COMMANDE_BADGE[cmd.statut]}`}>
                      {CMD_STATUT_LABELS[cmd.statut] ?? cmd.statut}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t('merchant.resto.cmdCouvertsLabel')
                      .replace('{n}', String(cmd.nb_couverts))
                      .replace('{s}', cmd.nb_couverts > 1 ? 's' : '')}
                    {' · '}
                    {new Date(cmd.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <p className="font-bold text-brand-600 text-sm flex-shrink-0">{formatFcfa(cmd.total_fcfa)}</p>
              </div>

              {/* Liste des plats */}
              <div className="space-y-0.5">
                {cmd.resto_commande_plats.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                    <span>{p.quantite > 1 ? `${p.quantite}× ` : ''}{p.nom_plat}</span>
                    <span>{formatFcfa(p.prix_unitaire_fcfa * p.quantite)}</span>
                  </div>
                ))}
              </div>

              {cmd.notes && <p className="text-xs text-orange-600 italic">{cmd.notes}</p>}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap pt-1">
                {cmd.statut === 'en_cours' && (
                  <button onClick={() => handleCommandeStatut(cmd.id, 'servi')}
                    className="text-xs text-orange-700 font-medium px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200">
                    {t('merchant.resto.cmdMarkServi')}
                  </button>
                )}
                {cmd.statut === 'servi' && (
                  <button onClick={() => handleCommandeStatut(cmd.id, 'payé')}
                    className="text-xs text-green-700 font-medium px-3 py-1.5 rounded-xl bg-green-50 border border-green-200">
                    {t('merchant.resto.cmdMarkPaye')}
                  </button>
                )}
                {(cmd.statut === 'en_cours' || cmd.statut === 'servi') && (
                  <button onClick={() => handleCommandeStatut(cmd.id, 'annulé')}
                    className="text-xs text-red-500 font-medium px-3 py-1.5 rounded-xl bg-red-50 border border-red-100">
                    {t('merchant.resto.cmdAnnulerBtn')}
                  </button>
                )}
                <button onClick={() => printTicket(cmd)}
                  className="text-xs text-gray-600 font-medium px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
                  {t('merchant.resto.cmdPrintTicket')}
                </button>
                {(cmd.statut === 'annulé' || cmd.statut === 'payé') && (
                  <button onClick={() => handleDeleteCommande(cmd.id)}
                    className="text-xs text-red-400 font-medium px-3 py-1.5 rounded-xl bg-red-50 border border-red-100">
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB TRAITEUR                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'traiteur' && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">{t('merchant.resto.traiteurTitle')}</h2>

          {recettes.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">🍽️</p>
              <p className="text-gray-500 text-sm">{t('merchant.resto.traiteurNoRecettes')}</p>
              <button onClick={() => setTab('recettes')} className="btn-primary mt-4 text-sm py-2 px-4">{t('merchant.resto.traiteurCreateRecetteBtn')}</button>
            </div>
          ) : (
            <>
              <div className="card space-y-3">
                <p className="font-medium text-gray-800 text-sm">{t('merchant.resto.eventTitle')}</p>
                <div>
                  <label className="label">{t('merchant.resto.eventClientName')}</label>
                  <input className="input" placeholder={t('merchant.resto.eventClientNamePlaceholder')} value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t('merchant.resto.eventName')}</label>
                    <input className="input" placeholder={t('merchant.resto.eventNamePlaceholder')} value={eventName} onChange={(e) => setEventName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{t('merchant.resto.eventDate')}</label>
                    <input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="card space-y-3">
                <p className="font-medium text-gray-800 text-sm">{t('merchant.resto.traiteurDishesTitle')}</p>
                <div className="space-y-2">
                  {lines.map((line, idx) => {
                    const recette = recettes.find((r) => r.id === line.recetteId)
                    const lineCost = recette ? Math.round(calcCostPerPortion(recette) * line.convives) : 0
                    return (
                      <div key={idx} className="flex gap-2 items-center">
                        <select className="input flex-1 text-sm" value={line.recetteId} onChange={(e) => updateLine(idx, { recetteId: e.target.value })}>
                          <option value="">{t('merchant.resto.traiteurChooseDish')}</option>
                          {recettes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <input className="input w-24 text-sm" type="number" min="1" placeholder="Convives" value={line.convives}
                          onChange={(e) => updateLine(idx, { convives: parseInt(e.target.value, 10) || 1 })} />
                        <span className="text-xs text-gray-400 whitespace-nowrap">{t('merchant.resto.traiteurConvives')}</span>
                        {recette && <span className="text-xs text-brand-600 font-medium whitespace-nowrap">≈ {formatFcfa(lineCost)}</span>}
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0">×</button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button type="button" onClick={addLine} className="text-xs text-brand-600 hover:text-brand-800 font-medium">{t('merchant.resto.traiteurAddPlat')}</button>
              </div>

              {activeLines.length > 0 && (
                <>
                  <div className="card">
                    <p className="font-medium text-gray-800 text-sm mb-3">{t('merchant.resto.traiteurSummaryTitle')}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs text-gray-400 py-2 font-medium">{t('merchant.resto.traiteurIngHeader')}</th>
                            <th className="text-center text-xs text-gray-400 py-2 font-medium">{t('merchant.resto.traiteurQtyHeader')}</th>
                            <th className="text-right text-xs text-gray-400 py-2 font-medium">{t('merchant.resto.traiteurCostHeader')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {Object.values(aggregatedIngredients).map((agg, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="py-2 text-gray-700">{agg.name}</td>
                              <td className="py-2 text-center text-gray-600">{agg.totalQty < 1 ? agg.totalQty.toFixed(3) : agg.totalQty.toFixed(2)} {agg.unit}</td>
                              <td className="py-2 text-right font-medium">{formatFcfa(Math.round(agg.totalCost))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200">
                            <td colSpan={2} className="py-3 font-bold text-gray-700">{t('merchant.resto.traiteurTotalBrut')}</td>
                            <td className="py-3 text-right font-bold text-gray-900">{formatFcfa(totalBrutRounded)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div className="card space-y-3">
                    <p className="font-medium text-gray-800 text-sm">{t('merchant.resto.traiteurQuoteTitle')}</p>
                    {suggestedQuotePrice > 0 && (
                      <p className="text-xs text-gray-500">
                        {t('merchant.resto.traiteurMarginSugg')}{' '}
                        <button type="button" onClick={() => setQuotePrice(suggestedQuotePrice)} className="text-brand-600 font-medium underline">
                          {formatFcfa(suggestedQuotePrice)}
                        </button>
                      </p>
                    )}
                    <input className="input" type="number" min="0" step="500"
                      placeholder={`Ex: ${suggestedQuotePrice.toLocaleString()}`}
                      value={quotePrice || ''} onChange={(e) => setQuotePrice(parseInt(e.target.value, 10) || 0)} />
                    {quotePrice > 0 && (
                      <div className={`rounded-lg px-3 py-2 ${marginBgColor(Math.round(((quotePrice - totalBrutRounded) / quotePrice) * 100))}`}>
                        <p className={`text-sm font-medium ${marginColor(Math.round(((quotePrice - totalBrutRounded) / quotePrice) * 100))}`}>
                          {t('merchant.resto.traiteurGrossMargin')
                            .replace('{amount}', formatFcfa(quotePrice - totalBrutRounded))
                            .replace('{pct}', String(Math.round(((quotePrice - totalBrutRounded) / quotePrice) * 100)))}
                        </p>
                      </div>
                    )}
                  </div>

                  <button onClick={generateDevis} className="w-full btn-primary py-3 text-sm">
                    {t('merchant.resto.traiteurGenerateBtn')}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
