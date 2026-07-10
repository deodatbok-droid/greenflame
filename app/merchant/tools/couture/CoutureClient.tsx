'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'
import AvatarTryOn from './AvatarTryOn'
import type { AvatarGarment } from './AvatarTryOn'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'

// ── Types ──────────────────────────────────────────────────────────────────

type CoutureClientRecord = {
  id: string
  full_name: string
  phone: string | null
  tour_poitrine: number | null
  tour_taille: number | null
  tour_hanches: number | null
  longueur_dos: number | null
  longueur_robe: number | null
  longueur_pantalon: number | null
  epaules: number | null
  longueur_manche: number | null
  tour_cou: number | null
  notes: string | null
}

type CoutureAccessoire = {
  id: string
  name: string
  unit: string
  price_per_unit_fcfa: number
}

type CoutureCommandeAccessoireItem = {
  id: string
  accessoire_id: string | null
  name_snapshot: string
  prix_unitaire_snapshot: number
  quantite: number
}

type EtapeKey = 'mesures' | 'coupe' | 'couture' | 'finitions'

type CoutureRetouche = {
  id: string
  commande_id: string
  description: string
  demandeur: string
  implications: string | null
  cout_supplementaire_fcfa: number
  statut: 'en_cours' | 'faite'
  created_at: string
}

type CoutureCommande = {
  id: string
  client_id: string | null
  client_name_snapshot: string
  modele_description: string
  tissu_metres: number
  tissu_prix_metre: number
  accessoires_fcfa: number
  main_oeuvre_fcfa: number
  prix_total_fcfa: number
  avance_versee_fcfa: number
  date_livraison: string | null
  status: 'en_cours' | 'pret' | 'livre' | 'annule'
  notes: string | null
  urgent: boolean
  etape: EtapeKey | null
  couture_clients: { full_name: string; phone: string | null } | null
  couture_commande_accessoires: CoutureCommandeAccessoireItem[]
  couture_retouches: CoutureRetouche[]
}

type Tab = 'clients' | 'commandes' | 'atelier' | 'accessoires'
type StatusFilter = 'all' | 'en_cours' | 'pret' | 'livre'
type GarmentType = AvatarGarment
type MissingKey = 'dress' | 'back' | 'pants'

// ── Status colors ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  en_cours: 'bg-blue-100 text-blue-700',
  pret: 'bg-green-100 text-green-700',
  livre: 'bg-gray-100 text-gray-600',
  annule: 'bg-red-100 text-red-500',
}

const ETAPE_STEPS: EtapeKey[] = ['mesures', 'coupe', 'couture', 'finitions']

// ── Calculs commande ───────────────────────────────────────────────────────

function calcCoutCout(cmd: CoutureCommande): number {
  return cmd.tissu_metres * cmd.tissu_prix_metre + cmd.accessoires_fcfa + cmd.main_oeuvre_fcfa
}

function calcSolde(cmd: CoutureCommande): number {
  return cmd.prix_total_fcfa - cmd.avance_versee_fcfa
}

// ── Calculateur tissu ──────────────────────────────────────────────────────

const DEFAULTS = {
  longueur_robe: 120,
  longueur_dos: 40,
  longueur_pantalon: 100,
}

function calcTissu(garment: GarmentType, client: CoutureClientRecord | null): { metres: number; missingKey: MissingKey | null } {
  const lr = client?.longueur_robe ?? DEFAULTS.longueur_robe
  const ld = client?.longueur_dos ?? DEFAULTS.longueur_dos
  const lp = client?.longueur_pantalon ?? DEFAULTS.longueur_pantalon

  let metres: number
  let missingKey: MissingKey | null = null

  if (garment === 'robe_simple') {
    if (client && !client.longueur_robe) missingKey = 'dress'
    metres = Math.max((lr * 2 + 30) / 100, 2.5)
  } else if (garment === 'robe_soiree') {
    if (client && !client.longueur_robe) missingKey = 'dress'
    metres = Math.max((lr * 2 + 50) / 100, 3)
  } else if (garment === 'haut') {
    if (client && !client.longueur_dos) missingKey = 'back'
    metres = Math.max((ld * 2 + 50) / 100, 1.5)
  } else if (garment === 'pantalon') {
    if (client && !client.longueur_pantalon) missingKey = 'pants'
    metres = Math.max((lp * 2 + 30) / 100, 2)
  } else if (garment === 'complet') {
    if (client && !client.longueur_dos) missingKey = 'back'
    if (client && !client.longueur_pantalon && !missingKey) missingKey = 'pants'
    metres = Math.max((ld * 3 + lp * 2 + 80) / 100, 4)
  } else if (garment === 'boubou') {
    if (client && !client.longueur_robe) missingKey = 'dress'
    metres = Math.max((lr * 4 + 60) / 100, 5)
  } else {
    if (client && !client.longueur_robe) missingKey = 'dress'
    metres = Math.max((lr + 30) / 100, 1.2)
  }

  return { metres: Math.round(metres * 10) / 10, missingKey }
}

// ── Props ──────────────────────────────────────────────────────────────────

type Props = {
  merchantId: string
  businessName: string
  initialClients: CoutureClientRecord[]
  initialCommandes: CoutureCommande[]
  initialAccessoires: CoutureAccessoire[]
}

// ── Formulaire mesures ─────────────────────────────────────────────────────

type MeasureForm = {
  full_name: string
  phone: string
  tour_poitrine: string
  tour_taille: string
  tour_hanches: string
  longueur_dos: string
  longueur_robe: string
  longueur_pantalon: string
  epaules: string
  longueur_manche: string
  tour_cou: string
  notes: string
}

function emptyMeasureForm(): MeasureForm {
  return {
    full_name: '', phone: '', tour_poitrine: '', tour_taille: '', tour_hanches: '',
    longueur_dos: '', longueur_robe: '', longueur_pantalon: '', epaules: '',
    longueur_manche: '', tour_cou: '', notes: '',
  }
}

function clientToForm(c: CoutureClientRecord): MeasureForm {
  return {
    full_name: c.full_name,
    phone: c.phone ?? '',
    tour_poitrine: c.tour_poitrine != null ? String(c.tour_poitrine) : '',
    tour_taille: c.tour_taille != null ? String(c.tour_taille) : '',
    tour_hanches: c.tour_hanches != null ? String(c.tour_hanches) : '',
    longueur_dos: c.longueur_dos != null ? String(c.longueur_dos) : '',
    longueur_robe: c.longueur_robe != null ? String(c.longueur_robe) : '',
    longueur_pantalon: c.longueur_pantalon != null ? String(c.longueur_pantalon) : '',
    epaules: c.epaules != null ? String(c.epaules) : '',
    longueur_manche: c.longueur_manche != null ? String(c.longueur_manche) : '',
    tour_cou: c.tour_cou != null ? String(c.tour_cou) : '',
    notes: c.notes ?? '',
  }
}

function formToPayload(f: MeasureForm) {
  return {
    full_name: f.full_name.trim(),
    phone: f.phone.trim() || null,
    tour_poitrine: f.tour_poitrine ? parseFloat(f.tour_poitrine) : null,
    tour_taille: f.tour_taille ? parseFloat(f.tour_taille) : null,
    tour_hanches: f.tour_hanches ? parseFloat(f.tour_hanches) : null,
    longueur_dos: f.longueur_dos ? parseFloat(f.longueur_dos) : null,
    longueur_robe: f.longueur_robe ? parseFloat(f.longueur_robe) : null,
    longueur_pantalon: f.longueur_pantalon ? parseFloat(f.longueur_pantalon) : null,
    epaules: f.epaules ? parseFloat(f.epaules) : null,
    longueur_manche: f.longueur_manche ? parseFloat(f.longueur_manche) : null,
    tour_cou: f.tour_cou ? parseFloat(f.tour_cou) : null,
    notes: f.notes.trim() || null,
  }
}

// ── Formulaire commande ────────────────────────────────────────────────────

type CmdForm = {
  selected_client_id: string
  client_name_snapshot: string
  modele_description: string
  tissu_metres: string
  tissu_prix_metre: string
  accessoires_fcfa: string
  main_oeuvre_fcfa: string
  prix_total_fcfa: string
  avance_versee_fcfa: string
  date_livraison: string
  notes: string
  urgent: boolean
  etape: EtapeKey | ''
}

function emptyCmdForm(): CmdForm {
  return {
    selected_client_id: '', client_name_snapshot: '', modele_description: '',
    tissu_metres: '', tissu_prix_metre: '', accessoires_fcfa: '',
    main_oeuvre_fcfa: '', prix_total_fcfa: '', avance_versee_fcfa: '',
    date_livraison: '', notes: '', urgent: false, etape: '',
  }
}

type AccFormItem = {
  accessoire_id: string
  name_snapshot: string
  prix_unitaire_snapshot: number
  quantite: number
}

// ── Composant principal ────────────────────────────────────────────────────

export default function CoutureWorkshop({
  merchantId: _merchantId,
  businessName,
  initialClients,
  initialCommandes,
  initialAccessoires,
}: Props) {
  const { t } = useLocale()

  const STATUS_LABELS: Record<string, string> = {
    en_cours: t('merchant.couture.statusEnCours'),
    pret:     t('merchant.couture.statusPret'),
    livre:    t('merchant.couture.statusLivre'),
    annule:   t('merchant.couture.statusAnnule'),
  }

  const GARMENT_LABELS: Record<GarmentType, string> = {
    robe_simple: t('merchant.couture.garmentRobeSimple'),
    robe_soiree: t('merchant.couture.garmentRobeSoiree'),
    haut:        t('merchant.couture.garmentHaut'),
    pantalon:    t('merchant.couture.garmentPantalon'),
    complet:     t('merchant.couture.garmentComplet'),
    boubou:      t('merchant.couture.garmentBoubou'),
    jupe:        t('merchant.couture.garmentJupe'),
  }

  const TAB_LABELS: Record<Tab, string> = {
    clients:     t('merchant.couture.tabClients'),
    commandes:   t('merchant.couture.tabCommandes'),
    atelier:     t('merchant.couture.tabAtelier'),
    accessoires: t('merchant.couture.tabAccessoires'),
  }

  const FILTER_LABELS: Record<StatusFilter, string> = {
    all:      t('merchant.couture.filterAll'),
    en_cours: t('merchant.couture.filterEnCours'),
    pret:     t('merchant.couture.filterPret'),
    livre:    t('merchant.couture.filterLivre'),
  }

  const MISSING_LABELS: Record<MissingKey, string> = {
    dress: t('merchant.couture.measureMissingDress'),
    back:  t('merchant.couture.measureMissingBack'),
    pants: t('merchant.couture.measureMissingPants'),
  }

  const ETAPE_LABELS: Record<EtapeKey, string> = {
    mesures:   t('merchant.couture.etapeMesures'),
    coupe:     t('merchant.couture.etapeCoupe'),
    couture:   t('merchant.couture.etapeCouture'),
    finitions: t('merchant.couture.etapeFinitions'),
  }

  function measureSummary(c: CoutureClientRecord): string {
    const parts: string[] = []
    if (c.tour_poitrine) parts.push(t('merchant.couture.summaryChest').replace('{n}', String(c.tour_poitrine)))
    if (c.tour_taille) parts.push(t('merchant.couture.summaryWaist').replace('{n}', String(c.tour_taille)))
    if (c.tour_hanches) parts.push(t('merchant.couture.summaryHips').replace('{n}', String(c.tour_hanches)))
    if (c.longueur_robe) parts.push(t('merchant.couture.summaryDress').replace('{n}', String(c.longueur_robe)))
    if (c.longueur_pantalon) parts.push(t('merchant.couture.summaryPants').replace('{n}', String(c.longueur_pantalon)))
    return parts.join(' · ') || t('merchant.couture.noMeasures')
  }

  function MeasureField({
    label, fieldKey, form, onChange,
  }: {
    label: string
    fieldKey: keyof MeasureForm
    form: MeasureForm
    onChange: (key: keyof MeasureForm, value: string) => void
  }) {
    return (
      <div>
        <label className="label">{label}</label>
        <input
          className="input"
          type="number"
          min="0"
          step="0.5"
          placeholder="cm"
          value={form[fieldKey]}
          onChange={(e) => onChange(fieldKey, e.target.value)}
        />
      </div>
    )
  }

  function renderMeasureGrid(form: MeasureForm, onChange: (key: keyof MeasureForm, value: string) => void) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <MeasureField label={t('merchant.couture.measureChest')} fieldKey="tour_poitrine" form={form} onChange={onChange} />
        <MeasureField label={t('merchant.couture.measureWaist')} fieldKey="tour_taille" form={form} onChange={onChange} />
        <MeasureField label={t('merchant.couture.measureHips')} fieldKey="tour_hanches" form={form} onChange={onChange} />
        <MeasureField label={t('merchant.couture.measureBack')} fieldKey="longueur_dos" form={form} onChange={onChange} />
        <MeasureField label={t('merchant.couture.measureDress')} fieldKey="longueur_robe" form={form} onChange={onChange} />
        <MeasureField label={t('merchant.couture.measurePants')} fieldKey="longueur_pantalon" form={form} onChange={onChange} />
        <MeasureField label={t('merchant.couture.measureShoulders')} fieldKey="epaules" form={form} onChange={onChange} />
        <MeasureField label={t('merchant.couture.measureSleeve')} fieldKey="longueur_manche" form={form} onChange={onChange} />
        <MeasureField label={t('merchant.couture.measureNeck')} fieldKey="tour_cou" form={form} onChange={onChange} />
      </div>
    )
  }

  // ── State ──────────────────────────────────────────────────────────────

  const [tab, setTab] = useState<Tab>('clients')
  const [clients, setClients] = useState<CoutureClientRecord[]>(initialClients)
  const [commandes, setCommandes] = useState<CoutureCommande[]>(initialCommandes)
  const [accessoires, setAccessoires] = useState<CoutureAccessoire[]>(initialAccessoires)

  // ── Onglet Clients ─────────────────────────────────────────────────────

  const [showAddClient, setShowAddClient] = useState(false)
  const [addClientForm, setAddClientForm] = useState<MeasureForm>(emptyMeasureForm())
  const [savingClient, setSavingClient] = useState(false)
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)
  const [editClientForm, setEditClientForm] = useState<MeasureForm>(emptyMeasureForm())
  const [savingEditClient, setSavingEditClient] = useState(false)

  function openEditClient(c: CoutureClientRecord) {
    setExpandedClientId(c.id)
    setEditClientForm(clientToForm(c))
  }

  function closeEditClient() {
    setExpandedClientId(null)
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault()
    setSavingClient(true)
    try {
      const res = await fetch('/api/couture/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(addClientForm)),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? t('common.error'))
        return
      }
      const newClient = await res.json() as CoutureClientRecord
      setClients((prev) => [...prev, newClient].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setAddClientForm(emptyMeasureForm())
      setShowAddClient(false)
    } finally {
      setSavingClient(false)
    }
  }

  async function handleSaveEditClient(clientId: string) {
    setSavingEditClient(true)
    try {
      const res = await fetch(`/api/couture/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(editClientForm)),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? t('common.error'))
        return
      }
      const updated = await res.json() as CoutureClientRecord
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? updated : c)).sort((a, b) => a.full_name.localeCompare(b.full_name))
      )
      setExpandedClientId(null)
    } finally {
      setSavingEditClient(false)
    }
  }

  async function handleDeleteClient(id: string) {
    if (!confirm(t('merchant.couture.deleteClientConfirm'))) return
    const res = await fetch(`/api/couture/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== id))
      if (expandedClientId === id) setExpandedClientId(null)
    }
  }

  // ── Onglet Accessoires ─────────────────────────────────────────────────

  const [showAddAccessoire, setShowAddAccessoire] = useState(false)
  const [accForm, setAccForm] = useState({ name: '', unit: '', price_per_unit_fcfa: '' })
  const [savingAcc, setSavingAcc] = useState(false)

  async function handleAddAccessoire(e: React.FormEvent) {
    e.preventDefault()
    setSavingAcc(true)
    try {
      const res = await fetch('/api/couture/accessoires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: accForm.name.trim(),
          unit: accForm.unit.trim() || 'pièce',
          price_per_unit_fcfa: parseInt(accForm.price_per_unit_fcfa || '0', 10),
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? t('common.error'))
        return
      }
      const newAcc = await res.json() as CoutureAccessoire
      setAccessoires((prev) => [...prev, newAcc].sort((a, b) => a.name.localeCompare(b.name)))
      setAccForm({ name: '', unit: '', price_per_unit_fcfa: '' })
      setShowAddAccessoire(false)
    } finally {
      setSavingAcc(false)
    }
  }

  async function handleDeleteAccessoire(id: string) {
    if (!confirm(t('merchant.couture.deleteAccConfirm'))) return
    const res = await fetch(`/api/couture/accessoires/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAccessoires((prev) => prev.filter((a) => a.id !== id))
    }
  }

  // ── Onglet Commandes ───────────────────────────────────────────────────

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showAddCommande, setShowAddCommande] = useState(false)
  const [savingCommande, setSavingCommande] = useState(false)
  const [editingCommande, setEditingCommande] = useState<CoutureCommande | null>(null)

  const [commandeSearch, setCommandeSearch] = useState('')
  const [urgentFirst, setUrgentFirst] = useState(false)
  const [sortByDelivery, setSortByDelivery] = useState(false)
  const [showUrgentOnly, setShowUrgentOnly] = useState(false)

  const [cmdForm, setCmdForm] = useState<CmdForm>(emptyCmdForm())
  const [cmdAccItems, setCmdAccItems] = useState<AccFormItem[]>([])
  const [cmdManualAcc, setCmdManualAcc] = useState('')

  const accItemsTotal = cmdAccItems.reduce((s, i) => s + i.prix_unitaire_snapshot * i.quantite, 0)
  const accManualVal = parseInt(cmdManualAcc || '0', 10)
  const totalAccessoires = accessoires.length > 0
    ? accItemsTotal + accManualVal
    : parseInt(cmdForm.accessoires_fcfa || '0', 10)

  const estimatedCost =
    (parseFloat(cmdForm.tissu_metres || '0') * parseFloat(cmdForm.tissu_prix_metre || '0')) +
    totalAccessoires +
    parseFloat(cmdForm.main_oeuvre_fcfa || '0')

  function openEditCommande(cmd: CoutureCommande) {
    setEditingCommande(cmd)
    setCmdForm({
      selected_client_id: cmd.client_id ?? '',
      client_name_snapshot: cmd.client_name_snapshot,
      modele_description: cmd.modele_description,
      tissu_metres: String(cmd.tissu_metres || ''),
      tissu_prix_metre: String(cmd.tissu_prix_metre || ''),
      accessoires_fcfa: String(cmd.accessoires_fcfa || ''),
      main_oeuvre_fcfa: String(cmd.main_oeuvre_fcfa || ''),
      prix_total_fcfa: String(cmd.prix_total_fcfa || ''),
      avance_versee_fcfa: String(cmd.avance_versee_fcfa || ''),
      date_livraison: cmd.date_livraison ?? '',
      notes: cmd.notes ?? '',
      urgent: cmd.urgent,
      etape: cmd.etape ?? '',
    })
    if (cmd.couture_commande_accessoires && cmd.couture_commande_accessoires.length > 0) {
      setCmdAccItems(cmd.couture_commande_accessoires.map((a) => ({
        accessoire_id: a.accessoire_id ?? '',
        name_snapshot: a.name_snapshot,
        prix_unitaire_snapshot: a.prix_unitaire_snapshot,
        quantite: a.quantite,
      })))
      setCmdManualAcc('0')
    } else {
      setCmdAccItems([])
      setCmdManualAcc(String(cmd.accessoires_fcfa || ''))
    }
    setShowAddCommande(true)
  }

  function closeCommandeForm() {
    setShowAddCommande(false)
    setEditingCommande(null)
    setCmdAccItems([])
    setCmdManualAcc('')
    setCmdForm(emptyCmdForm())
  }

  function onSelectClient(clientId: string) {
    const found = clients.find((c) => c.id === clientId)
    setCmdForm((f) => ({
      ...f,
      selected_client_id: clientId,
      client_name_snapshot: found ? found.full_name : f.client_name_snapshot,
    }))
  }

  async function handleAddCommande(e: React.FormEvent) {
    e.preventDefault()
    setSavingCommande(true)
    try {
      const totalAcc = accessoires.length > 0
        ? accItemsTotal + accManualVal
        : parseInt(cmdForm.accessoires_fcfa || '0', 10)

      const payload = {
        client_id: cmdForm.selected_client_id || null,
        client_name_snapshot: cmdForm.client_name_snapshot.trim(),
        modele_description: cmdForm.modele_description.trim(),
        tissu_metres: parseFloat(cmdForm.tissu_metres || '0'),
        tissu_prix_metre: parseInt(cmdForm.tissu_prix_metre || '0', 10),
        accessoires_fcfa: totalAcc,
        main_oeuvre_fcfa: parseInt(cmdForm.main_oeuvre_fcfa || '0', 10),
        prix_total_fcfa: parseInt(cmdForm.prix_total_fcfa || '0', 10),
        avance_versee_fcfa: parseInt(cmdForm.avance_versee_fcfa || '0', 10),
        date_livraison: cmdForm.date_livraison || null,
        notes: cmdForm.notes.trim() || null,
        urgent: cmdForm.urgent,
        etape: (cmdForm.etape as EtapeKey) || null,
        accessoires_items: accessoires.length > 0 ? cmdAccItems : [],
      }

      const url = editingCommande
        ? `/api/couture/commandes/${editingCommande.id}`
        : '/api/couture/commandes'
      const method = editingCommande ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? t('common.error'))
        return
      }
      const saved = await res.json() as CoutureCommande
      if (editingCommande) {
        setCommandes((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
        toast.success(t('merchant.couture.commandeUpdated'))
      } else {
        setCommandes((prev) => [saved, ...prev])
        toast.success(t('merchant.couture.commandeCreated'))
      }
      closeCommandeForm()
    } finally {
      setSavingCommande(false)
    }
  }

  async function handleStatusChange(cmd: CoutureCommande, newStatus: 'en_cours' | 'pret' | 'livre' | 'annule') {
    const res = await fetch(`/api/couture/commandes/${cmd.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json() as CoutureCommande
      setCommandes((prev) => prev.map((c) => (c.id === cmd.id ? updated : c)))
    }
  }

  async function handleToggleUrgent(cmd: CoutureCommande) {
    const res = await fetch(`/api/couture/commandes/${cmd.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urgent: !cmd.urgent }),
    })
    if (res.ok) {
      const updated = await res.json() as CoutureCommande
      setCommandes((prev) => prev.map((c) => (c.id === cmd.id ? updated : c)))
      toast.success(updated.urgent
        ? t('merchant.couture.toggledUrgent')
        : t('merchant.couture.toggledNormal')
      )
    }
  }

  async function handleUpdateEtape(cmdId: string, etape: EtapeKey | null) {
    const res = await fetch(`/api/couture/commandes/${cmdId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etape }),
    })
    if (res.ok) {
      const updated = await res.json() as CoutureCommande
      setCommandes((prev) => prev.map((c) => (c.id === cmdId ? updated : c)))
      toast.success(t('merchant.couture.etapeUpdated'))
    }
  }

  async function handleDeleteCommande(id: string) {
    if (!confirm(t('merchant.couture.deleteCommandeConfirm'))) return
    const res = await fetch(`/api/couture/commandes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCommandes((prev) => prev.filter((c) => c.id !== id))
    }
  }

  // ── Retouches ─────────────────────────────────────────────────────────────

  const [expandedRetouchesId, setExpandedRetouchesId] = useState<string | null>(null)
  const [retoucheForm, setRetoucheForm] = useState({
    description: '', demandeur: 'client', implications: '', cout_supplementaire_fcfa: '',
  })
  const [savingRetouche, setSavingRetouche] = useState(false)

  function openRetouches(cmdId: string) {
    setExpandedRetouchesId((prev) => (prev === cmdId ? null : cmdId))
    setRetoucheForm({ description: '', demandeur: 'client', implications: '', cout_supplementaire_fcfa: '' })
  }

  function updateCmdRetouches(cmdId: string, updater: (prev: CoutureRetouche[]) => CoutureRetouche[]) {
    setCommandes((prev) =>
      prev.map((c) => c.id === cmdId ? { ...c, couture_retouches: updater(c.couture_retouches ?? []) } : c)
    )
  }

  async function handleAddRetouche(cmdId: string, e: React.FormEvent) {
    e.preventDefault()
    if (!retoucheForm.description.trim()) return
    setSavingRetouche(true)
    try {
      const res = await fetch('/api/couture/retouches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commande_id: cmdId,
          description: retoucheForm.description,
          demandeur: retoucheForm.demandeur,
          implications: retoucheForm.implications || null,
          cout_supplementaire_fcfa: parseInt(retoucheForm.cout_supplementaire_fcfa, 10) || 0,
        }),
      })
      if (!res.ok) { toast.error(t('common.error')); return }
      const saved = await res.json() as CoutureRetouche
      updateCmdRetouches(cmdId, (prev) => [saved, ...prev])
      setRetoucheForm({ description: '', demandeur: 'client', implications: '', cout_supplementaire_fcfa: '' })
      toast.success(t('merchant.couture.retoucheSaved'))
    } finally { setSavingRetouche(false) }
  }

  async function handleToggleRetouche(cmdId: string, retouche: CoutureRetouche) {
    const newStatut = retouche.statut === 'en_cours' ? 'faite' : 'en_cours'
    const res = await fetch(`/api/couture/retouches/${retouche.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: newStatut }),
    })
    if (!res.ok) return
    const updated = await res.json() as CoutureRetouche
    updateCmdRetouches(cmdId, (prev) => prev.map((r) => r.id === updated.id ? updated : r))
  }

  async function handleDeleteRetouche(cmdId: string, retoucheId: string) {
    const res = await fetch(`/api/couture/retouches/${retoucheId}`, { method: 'DELETE' })
    if (res.ok) {
      updateCmdRetouches(cmdId, (prev) => prev.filter((r) => r.id !== retoucheId))
      toast.success(t('merchant.couture.retoucheDeleted'))
    }
  }

  const filteredCommandes = useMemo(() => {
    let result = commandes.filter((cmd) => {
      if (statusFilter !== 'all' && cmd.status !== statusFilter) return false
      if (showUrgentOnly && !cmd.urgent) return false
      if (commandeSearch.trim()) {
        const q = commandeSearch.toLowerCase()
        if (!cmd.client_name_snapshot.toLowerCase().includes(q)) return false
      }
      return true
    })

    if (urgentFirst || sortByDelivery) {
      result = [...result].sort((a, b) => {
        if (urgentFirst && a.urgent !== b.urgent) return a.urgent ? -1 : 1
        if (sortByDelivery) {
          if (!a.date_livraison && !b.date_livraison) return 0
          if (!a.date_livraison) return 1
          if (!b.date_livraison) return -1
          return new Date(a.date_livraison).getTime() - new Date(b.date_livraison).getTime()
        }
        return 0
      })
    }

    return result
  }, [commandes, statusFilter, showUrgentOnly, commandeSearch, urgentFirst, sortByDelivery])

  // ── Onglet Atelier ─────────────────────────────────────────────────────

  const [atelierClientId, setAtelierClientId] = useState<string>('')
  const [garmentType, setGarmentType] = useState<GarmentType>('robe_simple')
  const [bonCommandeId, setBonCommandeId] = useState<string>('')

  const atelierClient = clients.find((c) => c.id === atelierClientId) ?? null
  const { metres: suggestedMetres, missingKey } = calcTissu(garmentType, atelierClient)

  function printBonCommande() {
    const cmd = commandes.find((c) => c.id === bonCommandeId)
    if (!cmd) return

    const date = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
    const livraison = cmd.date_livraison
      ? new Date(cmd.date_livraison).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
      : '—'
    const tissuTotal = Math.round(cmd.tissu_metres * cmd.tissu_prix_metre)
    const solde = calcSolde(cmd)
    const soldeColor = solde > 0 ? '#dc2626' : '#166534'

    const hasAccItems = cmd.couture_commande_accessoires && cmd.couture_commande_accessoires.length > 0
    const accRows = hasAccItems
      ? cmd.couture_commande_accessoires.map((item) =>
          `<tr>
            <td>${item.name_snapshot}${item.quantite > 1 ? ` × ${item.quantite}` : ''}</td>
            <td>${Math.round(item.prix_unitaire_snapshot * item.quantite).toLocaleString()} FCFA</td>
          </tr>`
        ).join('')
      : cmd.accessoires_fcfa > 0
        ? `<tr><td>${t('merchant.couture.bonAccessoires')}</td><td>${cmd.accessoires_fcfa.toLocaleString()} FCFA</td></tr>`
        : ''

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>${t('merchant.couture.bonCommandeTitle')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; color: #1a1a1a; padding: 40px; max-width: 480px; margin: auto; }
  .header { text-align: center; border-bottom: 2px solid #166534; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 24px; color: #166534; font-weight: bold; }
  .header .subtitle { font-size: 13px; color: #555; margin-top: 4px; letter-spacing: 0.08em; text-transform: uppercase; }
  .header .date { font-size: 11px; color: #888; margin-top: 6px; }
  .section { margin-bottom: 20px; }
  .label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.05em; }
  .value { font-size: 15px; color: #1a1a1a; margin-top: 2px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; color: #888; padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
  td { font-size: 14px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  td:last-child { text-align: right; font-weight: 600; }
  .separator { border-top: 2px solid #166534; margin: 4px 0; }
  .total-row td { font-weight: bold; font-size: 15px; }
  .solde-row td { font-weight: bold; font-size: 16px; color: ${soldeColor}; }
  .signature { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  .signature p { font-size: 13px; color: #555; }
  .sig-line { margin-top: 40px; border-top: 1px solid #1a1a1a; width: 60%; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #aaa; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${businessName}</h1>
    <div class="subtitle">${t('merchant.couture.bonSubtitle')}</div>
    <div class="date">${t('merchant.couture.bonIssuedOn').replace('{date}', date)}</div>
  </div>

  <div class="section">
    <div class="label">${t('merchant.couture.bonClientLabel')}</div>
    <div class="value">${cmd.client_name_snapshot}${cmd.couture_clients?.phone ? ` · ${cmd.couture_clients.phone}` : ''}</div>

    <div class="label">${t('merchant.couture.bonModeleLabel')}</div>
    <div class="value" style="font-style:italic;">${cmd.modele_description}</div>

    <div class="label">${t('merchant.couture.bonDeliveryLabel')}</div>
    <div class="value">${livraison}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${t('merchant.couture.bonTableDesig')}</th>
        <th style="text-align:right;">${t('merchant.couture.bonTableAmount')}</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${t('merchant.couture.bonTissu').replace('{metres}', String(cmd.tissu_metres)).replace('{price}', cmd.tissu_prix_metre.toLocaleString())}</td>
        <td>${tissuTotal.toLocaleString()} FCFA</td>
      </tr>
      ${accRows}
      <tr>
        <td>${t('merchant.couture.bonMainOeuvre')}</td>
        <td>${cmd.main_oeuvre_fcfa.toLocaleString()} FCFA</td>
      </tr>
      <tr class="separator"><td colspan="2" style="padding:0; border:none;"><div class="separator"></div></td></tr>
      <tr class="total-row">
        <td>${t('merchant.couture.bonTotalConvenu')}</td>
        <td>${cmd.prix_total_fcfa.toLocaleString()} FCFA</td>
      </tr>
      <tr>
        <td>${t('merchant.couture.bonAvance')}</td>
        <td>− ${cmd.avance_versee_fcfa.toLocaleString()} FCFA</td>
      </tr>
      <tr class="solde-row">
        <td>${t('merchant.couture.bonSolde')}</td>
        <td>${solde.toLocaleString()} FCFA</td>
      </tr>
    </tbody>
  </table>

  ${cmd.notes ? `<div class="section" style="margin-top:20px;"><div class="label">${t('merchant.couture.bonNotesLabel')}</div><div class="value" style="font-size:13px;">${cmd.notes}</div></div>` : ''}

  <div class="signature">
    <p>${t('merchant.couture.bonSignature')}</p>
    <div class="sig-line"></div>
  </div>

  <div class="footer">
    ${t('merchant.couture.bonFooter')}
  </div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=560,height=800')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.onload = () => win.print()
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('merchant.couture.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('merchant.couture.subtitle')}</p>
        </div>
        <Link href="/merchant/tools" className="text-brand-600 text-sm">{t('merchant.couture.backToTools')}</Link>
      </div>

      {/* Onglets */}
      <div className="grid grid-cols-4 gap-1 bg-gray-100 rounded-xl p-1">
        {(['clients', 'commandes', 'atelier', 'accessoires'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === tabKey ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[tabKey]}
          </button>
        ))}
      </div>

      {/* ── TAB: Clients ───────────────────────────────────────────────── */}
      {tab === 'clients' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.couture.clientsTitle')}</h2>
            {!showAddClient && (
              <button onClick={() => setShowAddClient(true)} className="btn-primary text-sm py-2 px-3">
                {t('merchant.couture.addClientBtn')}
              </button>
            )}
          </div>

          {showAddClient && (
            <form onSubmit={handleAddClient} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-gray-800 text-sm">{t('merchant.couture.newClientTitle')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">{t('merchant.couture.clientFullName')}</label>
                  <input
                    className="input"
                    placeholder={t('merchant.couture.clientFullNamePlaceholder')}
                    value={addClientForm.full_name}
                    onChange={(e) => setAddClientForm((f) => ({ ...f, full_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">{t('merchant.couture.clientPhone')}</label>
                  <PhoneInput
                    value={addClientForm.phone}
                    onChange={(v) => setAddClientForm((f) => ({ ...f, phone: v }))}
                    placeholder="97 00 00 00"
                  />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-600 mt-2">{t('merchant.couture.measuresTitle')}</p>
              {renderMeasureGrid(addClientForm, (key, val) => setAddClientForm((f) => ({ ...f, [key]: val })))}
              <div>
                <label className="label">{t('merchant.couture.clientNotes')}</label>
                <textarea
                  className="input min-h-[60px] resize-none"
                  placeholder={t('merchant.couture.clientNotesPlaceholder')}
                  value={addClientForm.notes}
                  onChange={(e) => setAddClientForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingClient} className="btn-primary flex-1">
                  {savingClient ? '...' : t('merchant.couture.saveClientBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddClient(false); setAddClientForm(emptyMeasureForm()) }}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          {clients.length === 0 && !showAddClient && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">👗</p>
              <p className="text-gray-500 text-sm">{t('merchant.couture.clientsEmpty')}</p>
              <button onClick={() => setShowAddClient(true)} className="btn-primary mt-4 text-sm py-2 px-4">
                {t('merchant.couture.addClientBtn')}
              </button>
            </div>
          )}

          {clients.map((client) => (
            <div key={client.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{client.full_name}</p>
                  {client.phone && <p className="text-xs text-gray-400">{client.phone}</p>}
                  <p className="text-xs text-gray-500 mt-1">{measureSummary(client)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => expandedClientId === client.id ? closeEditClient() : openEditClient(client)}
                    className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 rounded-lg border border-brand-200 bg-brand-50"
                  >
                    {expandedClientId === client.id ? t('merchant.couture.closeBtn') : t('merchant.couture.editClientBtn')}
                  </button>
                  <button
                    onClick={() => handleDeleteClient(client.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg border border-red-100 bg-red-50"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>

              {expandedClientId === client.id && (
                <div className="border-t border-gray-100 pt-3 space-y-3">
                  <p className="text-xs font-medium text-gray-600">{t('merchant.couture.editClientTitle')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="label">{t('merchant.couture.clientFullName')}</label>
                      <input
                        className="input"
                        value={editClientForm.full_name}
                        onChange={(e) => setEditClientForm((f) => ({ ...f, full_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="label">{t('merchant.couture.clientPhone')}</label>
                      <PhoneInput
                        value={editClientForm.phone}
                        onChange={(v) => setEditClientForm((f) => ({ ...f, phone: v }))}
                        placeholder="97 00 00 00"
                      />
                    </div>
                  </div>
                  {renderMeasureGrid(editClientForm, (key, val) => setEditClientForm((f) => ({ ...f, [key]: val })))}
                  <div>
                    <label className="label">{t('merchant.couture.clientNotes')}</label>
                    <textarea
                      className="input min-h-[60px] resize-none"
                      value={editClientForm.notes}
                      onChange={(e) => setEditClientForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={savingEditClient}
                      onClick={() => handleSaveEditClient(client.id)}
                      className="btn-primary flex-1"
                    >
                      {savingEditClient ? '...' : t('merchant.couture.saveChangesBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={closeEditClient}
                      className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Commandes ─────────────────────────────────────────────── */}
      {tab === 'commandes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.couture.commandesTitle')}</h2>
            {!showAddCommande && (
              <button onClick={() => setShowAddCommande(true)} className="btn-primary text-sm py-2 px-3">
                {t('merchant.couture.addCommandeBtn')}
              </button>
            )}
          </div>

          {/* Barre de recherche */}
          <input
            className="input text-sm"
            placeholder={t('merchant.couture.searchPlaceholder')}
            value={commandeSearch}
            onChange={(e) => setCommandeSearch(e.target.value)}
          />

          {/* Filtres statut + urgence + tri */}
          <div className="flex gap-1 flex-wrap">
            {(['all', 'en_cours', 'pret', 'livre'] as StatusFilter[]).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setStatusFilter(filterKey)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  statusFilter === filterKey
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {FILTER_LABELS[filterKey]}
              </button>
            ))}
            <button
              onClick={() => setShowUrgentOnly((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                showUrgentOnly ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('merchant.couture.urgentFilterBtn')}
            </button>
          </div>

          {/* Options de tri */}
          <div className="flex gap-2">
            <button
              onClick={() => { setUrgentFirst((v) => !v); setSortByDelivery(false) }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                urgentFirst ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
            >
              ↑ {t('merchant.couture.sortByUrgentBtn')}
            </button>
            <button
              onClick={() => { setSortByDelivery((v) => !v); setUrgentFirst(false) }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                sortByDelivery ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
            >
              📅 {t('merchant.couture.sortByDeliveryBtn')}
            </button>
          </div>

          {/* Formulaire nouvelle commande / édition */}
          {showAddCommande && (
            <form onSubmit={handleAddCommande} className="card space-y-3 border-brand-200 bg-brand-50">
              <p className="font-medium text-gray-800 text-sm">
                {editingCommande ? t('merchant.couture.editCommandeTitle') : t('merchant.couture.newCommandeTitle')}
              </p>

              <div>
                <label className="label">{t('merchant.couture.cmdRegisteredClient')}</label>
                <select
                  className="input"
                  value={cmdForm.selected_client_id}
                  onChange={(e) => onSelectClient(e.target.value)}
                >
                  <option value="">{t('merchant.couture.cmdNewClient')}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t('merchant.couture.cmdClientName')}</label>
                <input
                  className="input"
                  placeholder={t('merchant.couture.cmdClientNamePlaceholder')}
                  value={cmdForm.client_name_snapshot}
                  onChange={(e) => setCmdForm((f) => ({ ...f, client_name_snapshot: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label">{t('merchant.couture.cmdModele')}</label>
                <textarea
                  className="input min-h-[70px] resize-none"
                  placeholder={t('merchant.couture.cmdModelePlaceholder')}
                  value={cmdForm.modele_description}
                  onChange={(e) => setCmdForm((f) => ({ ...f, modele_description: e.target.value }))}
                  required
                />
              </div>

              {/* Tissu */}
              <div>
                <p className="label mb-1">{t('merchant.couture.cmdTissu')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t('merchant.couture.cmdTissuMetres')}</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder={t('merchant.couture.cmdTissuMetresPlaceholder')}
                      value={cmdForm.tissu_metres}
                      onChange={(e) => setCmdForm((f) => ({ ...f, tissu_metres: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">{t('merchant.couture.cmdTissuPrix')}</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      placeholder="Ex: 2500"
                      value={cmdForm.tissu_prix_metre}
                      onChange={(e) => setCmdForm((f) => ({ ...f, tissu_prix_metre: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Accessoires */}
              {accessoires.length > 0 ? (
                <div className="space-y-2">
                  <p className="label">{t('merchant.couture.cmdAccSection')}</p>

                  {cmdAccItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                      <span className="flex-1 text-sm text-gray-700 truncate">{item.name_snapshot}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatFcfa(item.prix_unitaire_snapshot)}/u</span>
                      <input
                        type="number"
                        min="1"
                        className="w-14 text-center text-sm border border-gray-200 rounded-lg py-0.5"
                        value={item.quantite}
                        onChange={(e) => {
                          const q = Math.max(1, parseInt(e.target.value, 10) || 1)
                          setCmdAccItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantite: q } : it))
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setCmdAccItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 font-bold text-lg leading-none"
                      >×</button>
                    </div>
                  ))}

                  <select
                    className="input text-sm text-gray-400"
                    value=""
                    onChange={(e) => {
                      const acc = accessoires.find((a) => a.id === e.target.value)
                      if (!acc) return
                      const exists = cmdAccItems.find((i) => i.accessoire_id === acc.id)
                      if (exists) {
                        setCmdAccItems((prev) => prev.map((i) => i.accessoire_id === acc.id ? { ...i, quantite: i.quantite + 1 } : i))
                      } else {
                        setCmdAccItems((prev) => [...prev, {
                          accessoire_id: acc.id,
                          name_snapshot: acc.name,
                          prix_unitaire_snapshot: acc.price_per_unit_fcfa,
                          quantite: 1,
                        }])
                      }
                    }}
                  >
                    <option value="">{t('merchant.couture.cmdAccAdd')}</option>
                    {accessoires.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} — {formatFcfa(acc.price_per_unit_fcfa)}/{acc.unit}
                      </option>
                    ))}
                  </select>

                  <div>
                    <label className="label">{t('merchant.couture.cmdManualAcc')}</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={cmdManualAcc}
                      onChange={(e) => setCmdManualAcc(e.target.value)}
                    />
                  </div>

                  {(accItemsTotal + accManualVal) > 0 && (
                    <p className="text-xs text-gray-500 text-right">
                      {t('merchant.couture.cmdAccTotal')} : <span className="font-semibold text-gray-800">{formatFcfa(accItemsTotal + accManualVal)}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="label">{t('merchant.couture.cmdAccessoires')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder={t('merchant.couture.cmdAccessoiresPlaceholder')}
                    value={cmdForm.accessoires_fcfa}
                    onChange={(e) => setCmdForm((f) => ({ ...f, accessoires_fcfa: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label className="label">{t('merchant.couture.cmdMainOeuvre')}</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder="Ex: 15000"
                  value={cmdForm.main_oeuvre_fcfa}
                  onChange={(e) => setCmdForm((f) => ({ ...f, main_oeuvre_fcfa: e.target.value }))}
                />
              </div>

              {/* Coût estimé */}
              {estimatedCost > 0 && (
                <div className="bg-white rounded-xl px-3 py-2 border border-brand-100">
                  <p className="text-xs text-gray-500">{t('merchant.couture.cmdEstimatedCost')}</p>
                  <p className="font-bold text-brand-700">{formatFcfa(Math.round(estimatedCost))}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.couture.cmdTotalPrice')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder={t('merchant.couture.cmdTotalPricePlaceholder')}
                    value={cmdForm.prix_total_fcfa}
                    onChange={(e) => setCmdForm((f) => ({ ...f, prix_total_fcfa: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">{t('merchant.couture.cmdAdvance')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={cmdForm.avance_versee_fcfa}
                    onChange={(e) => setCmdForm((f) => ({ ...f, avance_versee_fcfa: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('merchant.couture.cmdDelivery')}</label>
                <input
                  className="input"
                  type="date"
                  value={cmdForm.date_livraison}
                  onChange={(e) => setCmdForm((f) => ({ ...f, date_livraison: e.target.value }))}
                />
              </div>

              {/* Urgence */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-red-500"
                  checked={cmdForm.urgent}
                  onChange={(e) => setCmdForm((f) => ({ ...f, urgent: e.target.checked }))}
                />
                <span className="text-sm text-gray-700">{t('merchant.couture.cmdUrgent')}</span>
              </label>

              {/* Étape */}
              <div>
                <label className="label">{t('merchant.couture.etapeTitle')}</label>
                <select
                  className="input"
                  value={cmdForm.etape}
                  onChange={(e) => setCmdForm((f) => ({ ...f, etape: e.target.value as EtapeKey | '' }))}
                >
                  <option value="">—</option>
                  {ETAPE_STEPS.map((s) => (
                    <option key={s} value={s}>{ETAPE_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t('merchant.couture.cmdNotes')}</label>
                <textarea
                  className="input min-h-[60px] resize-none"
                  placeholder={t('merchant.couture.cmdNotesPlaceholder')}
                  value={cmdForm.notes}
                  onChange={(e) => setCmdForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={savingCommande} className="btn-primary flex-1">
                  {savingCommande ? '...' : t('merchant.couture.saveCommandeBtn')}
                </button>
                <button
                  type="button"
                  onClick={closeCommandeForm}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Liste commandes */}
          {filteredCommandes.length === 0 && !showAddCommande && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-gray-500 text-sm">
                {statusFilter === 'all' && !commandeSearch && !showUrgentOnly
                  ? t('merchant.couture.commandesEmpty')
                  : t('merchant.couture.commandesFilterEmpty')}
              </p>
              {statusFilter === 'all' && !commandeSearch && !showUrgentOnly && (
                <button onClick={() => setShowAddCommande(true)} className="btn-primary mt-4 text-sm py-2 px-4">
                  {t('merchant.couture.addCommandeBtn')}
                </button>
              )}
            </div>
          )}

          {filteredCommandes.map((cmd) => {
            const solde = calcSolde(cmd)
            const cout = Math.round(calcCoutCout(cmd))
            const isOverdue =
              cmd.status === 'en_cours' &&
              cmd.date_livraison &&
              new Date(cmd.date_livraison) < new Date()
            const etapeIdx = ETAPE_STEPS.indexOf(cmd.etape ?? '' as EtapeKey)

            return (
              <div key={cmd.id} className={`card space-y-2 ${cmd.urgent ? 'border-l-4 border-red-400' : ''}`}>
                {/* Ligne titre */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{cmd.client_name_snapshot}</p>
                      {cmd.urgent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-bold flex-shrink-0">
                          {t('merchant.couture.urgentBadge')}
                        </span>
                      )}
                    </div>
                    {cout > 0 && (
                      <p className="text-[10px] text-gray-400">{t('merchant.couture.costLabel')} {formatFcfa(cout)}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[cmd.status]}`}>
                    {STATUS_LABELS[cmd.status]}
                  </span>
                </div>

                {/* Description modèle */}
                <p className="text-sm text-gray-500 italic">{cmd.modele_description}</p>

                {/* Date livraison */}
                {cmd.date_livraison && (
                  <p className={`text-xs font-medium ${isOverdue ? 'text-orange-500' : 'text-gray-400'}`}>
                    {isOverdue ? '⚠️ ' : ''}{t('merchant.couture.deliveryLabel')}{' '}
                    {new Date(cmd.date_livraison).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                )}

                {/* Étape stepper (commandes en cours) */}
                {cmd.status === 'en_cours' && (
                  <div className="pt-1">
                    <p className="text-[10px] text-gray-400 mb-1">{t('merchant.couture.etapeTitle')}</p>
                    <div className="grid grid-cols-4 gap-1">
                      {ETAPE_STEPS.map((step, idx) => {
                        const isDone = etapeIdx >= idx
                        const isCurrent = cmd.etape === step
                        return (
                          <button
                            key={step}
                            type="button"
                            onClick={() => handleUpdateEtape(cmd.id, isCurrent ? null : step)}
                            className={`py-1 rounded text-[9px] font-medium text-center transition-colors ${
                              isCurrent
                                ? 'bg-brand-600 text-white'
                                : isDone
                                  ? 'bg-brand-100 text-brand-700'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {isDone && !isCurrent ? '✓ ' : `${idx + 1}. `}{ETAPE_LABELS[step]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Finances */}
                {(() => {
                  const retouches = cmd.couture_retouches ?? []
                  const extraCout = retouches.reduce((s, r) => s + r.cout_supplementaire_fcfa, 0)
                  return (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                      <span className="text-gray-600">{t('merchant.couture.totalLabel')} {formatFcfa(cmd.prix_total_fcfa)}</span>
                      {extraCout > 0 && (
                        <span className="text-orange-600 font-medium">{t('merchant.couture.retoucheCoutBadge').replace('{amount}', formatFcfa(extraCout))}</span>
                      )}
                      <span className="text-gray-500">{t('merchant.couture.advanceLabel')} {formatFcfa(cmd.avance_versee_fcfa)}</span>
                      <span className={`font-bold ${solde > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {t('merchant.couture.soldeLabel')} {formatFcfa(solde + extraCout)}
                      </span>
                    </div>
                  )
                })()}

                {/* Retouches */}
                {(() => {
                  const retouches = cmd.couture_retouches ?? []
                  const isOpen = expandedRetouchesId === cmd.id
                  const DEMANDEUR_LABELS: Record<string, string> = {
                    client: t('merchant.couture.demandeurClient'),
                    tailleur: t('merchant.couture.demandeurTailleur'),
                    necessaire: t('merchant.couture.demandeurNecessaire'),
                  }
                  return (
                    <div className="border-t border-gray-100 pt-2">
                      <button
                        type="button"
                        onClick={() => openRetouches(cmd.id)}
                        className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        <span>✂️ {t('merchant.couture.retouchesSection')}</span>
                        {retouches.length > 0 && (
                          <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                            {t('merchant.couture.retouchesCountBadge').replace('{count}', String(retouches.length))}
                          </span>
                        )}
                        <span className="text-gray-300">{isOpen ? '▲' : '▼'}</span>
                      </button>

                      {isOpen && (
                        <div className="mt-2 space-y-2">
                          {retouches.length === 0 && (
                            <p className="text-xs text-gray-400 italic">{t('merchant.couture.retouchesEmpty')}</p>
                          )}
                          {retouches.map((r) => (
                            <div
                              key={r.id}
                              className={`rounded-xl border p-3 text-xs space-y-1 ${
                                r.statut === 'faite' ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className={`font-medium leading-snug ${r.statut === 'faite' ? 'text-green-800 line-through' : 'text-gray-800'}`}>
                                  {r.description}
                                </p>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => handleToggleRetouche(cmd.id, r)}
                                    className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
                                      r.statut === 'faite'
                                        ? 'bg-green-200 text-green-800 hover:bg-green-300'
                                        : 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                                    }`}
                                  >
                                    {r.statut === 'faite' ? t('merchant.couture.retoucheStatutFaite') : t('merchant.couture.retoucheStatutEnCours')}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRetouche(cmd.id, r.id)}
                                    className="text-red-400 hover:text-red-600 px-1"
                                    title={t('common.delete')}
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-gray-500">
                                <span>{DEMANDEUR_LABELS[r.demandeur] ?? r.demandeur}</span>
                                {r.cout_supplementaire_fcfa > 0 && (
                                  <span className="text-orange-600 font-medium">+{formatFcfa(r.cout_supplementaire_fcfa)}</span>
                                )}
                                {r.implications && <span className="italic">{r.implications}</span>}
                              </div>
                            </div>
                          ))}

                          {/* Formulaire ajout */}
                          <form onSubmit={(e) => handleAddRetouche(cmd.id, e)} className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2 mt-1">
                            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
                              {t('merchant.couture.addRetoucheBtn')}
                            </p>
                            <input
                              className="input text-xs py-1.5"
                              placeholder={t('merchant.couture.retoucheDescPlaceholder')}
                              value={retoucheForm.description}
                              onChange={(e) => setRetoucheForm((f) => ({ ...f, description: e.target.value }))}
                              required
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                className="input text-xs py-1.5"
                                value={retoucheForm.demandeur}
                                onChange={(e) => setRetoucheForm((f) => ({ ...f, demandeur: e.target.value }))}
                              >
                                <option value="client">{t('merchant.couture.demandeurClient')}</option>
                                <option value="tailleur">{t('merchant.couture.demandeurTailleur')}</option>
                                <option value="necessaire">{t('merchant.couture.demandeurNecessaire')}</option>
                              </select>
                              <input
                                type="number"
                                min="0"
                                className="input text-xs py-1.5"
                                placeholder={t('merchant.couture.retoucheCoutLabel')}
                                value={retoucheForm.cout_supplementaire_fcfa}
                                onChange={(e) => setRetoucheForm((f) => ({ ...f, cout_supplementaire_fcfa: e.target.value }))}
                              />
                            </div>
                            <input
                              className="input text-xs py-1.5"
                              placeholder={t('merchant.couture.retoucheImplicationsPlaceholder')}
                              value={retoucheForm.implications}
                              onChange={(e) => setRetoucheForm((f) => ({ ...f, implications: e.target.value }))}
                            />
                            <button
                              type="submit"
                              disabled={savingRetouche || !retoucheForm.description.trim()}
                              className="btn-primary w-full text-xs py-1.5 disabled:opacity-50"
                            >
                              {savingRetouche ? '...' : t('merchant.couture.retoucheSaveBtn')}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {cmd.status === 'en_cours' && (
                    <button
                      onClick={() => handleStatusChange(cmd, 'pret')}
                      className="text-xs text-green-700 font-medium px-2 py-1 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100"
                    >
                      {t('merchant.couture.markPretBtn')}
                    </button>
                  )}
                  {cmd.status === 'pret' && (
                    <button
                      onClick={() => handleStatusChange(cmd, 'livre')}
                      className="text-xs text-gray-700 font-medium px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100"
                    >
                      {t('merchant.couture.markLivreBtn')}
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleUrgent(cmd)}
                    className={`text-xs font-medium px-2 py-1 rounded-lg border transition-colors ${
                      cmd.urgent
                        ? 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100'
                        : 'text-red-600 border-red-100 bg-red-50 hover:bg-red-100'
                    }`}
                  >
                    {cmd.urgent ? t('merchant.couture.toggleNormal') : t('merchant.couture.toggleUrgent')}
                  </button>
                  <button
                    onClick={() => openEditCommande(cmd)}
                    className="text-xs text-brand-600 font-medium px-2 py-1 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100"
                  >
                    {t('merchant.couture.editCommandeBtn')}
                  </button>
                  <button
                    onClick={() => handleDeleteCommande(cmd.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg border border-red-100 bg-red-50"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: Accessoires ───────────────────────────────────────────── */}
      {tab === 'accessoires' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('merchant.couture.accessoiresTitle')}</h2>
            {!showAddAccessoire && (
              <button onClick={() => setShowAddAccessoire(true)} className="btn-primary text-sm py-2 px-3">
                {t('merchant.couture.addAccessoireBtn')}
              </button>
            )}
          </div>

          {showAddAccessoire && (
            <form onSubmit={handleAddAccessoire} className="card space-y-3 border-brand-200 bg-brand-50">
              <div>
                <label className="label">{t('merchant.couture.accName')}</label>
                <input
                  className="input"
                  placeholder={t('merchant.couture.accNamePlaceholder')}
                  value={accForm.name}
                  onChange={(e) => setAccForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('merchant.couture.accUnit')}</label>
                  <input
                    className="input"
                    placeholder={t('merchant.couture.accUnitPlaceholder')}
                    value={accForm.unit}
                    onChange={(e) => setAccForm((f) => ({ ...f, unit: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">{t('merchant.couture.accPrice')}</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={accForm.price_per_unit_fcfa}
                    onChange={(e) => setAccForm((f) => ({ ...f, price_per_unit_fcfa: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingAcc} className="btn-primary flex-1">
                  {savingAcc ? '...' : t('merchant.couture.saveAccBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddAccessoire(false); setAccForm({ name: '', unit: '', price_per_unit_fcfa: '' }) }}
                  className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          {accessoires.length === 0 && !showAddAccessoire && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-3">🧵</p>
              <p className="text-gray-500 text-sm">{t('merchant.couture.accessoiresEmpty')}</p>
              <button onClick={() => setShowAddAccessoire(true)} className="btn-primary mt-4 text-sm py-2 px-4">
                {t('merchant.couture.addAccessoireBtn')}
              </button>
            </div>
          )}

          {accessoires.map((acc) => (
            <div key={acc.id} className="card flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{acc.name}</p>
                <p className="text-xs text-gray-400">{acc.unit} · {formatFcfa(acc.price_per_unit_fcfa)}</p>
              </div>
              <button
                onClick={() => handleDeleteAccessoire(acc.id)}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg border border-red-100 bg-red-50 flex-shrink-0"
              >
                {t('common.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Atelier ───────────────────────────────────────────────── */}
      {tab === 'atelier' && (
        <div className="space-y-5">
          <h2 className="font-semibold text-gray-900">{t('merchant.couture.atelierTitle')}</h2>

          {/* Section A — Calculateur de tissu */}
          <div className="card space-y-3">
            <p className="font-semibold text-gray-900 text-sm">{t('merchant.couture.fabricCalcTitle')}</p>

            <div>
              <label className="label">{t('merchant.couture.clientOptional')}</label>
              <select
                className="input"
                value={atelierClientId}
                onChange={(e) => setAtelierClientId(e.target.value)}
              >
                <option value="">{t('merchant.couture.standardSize')}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{t('merchant.couture.garmentType')}</label>
              <select
                className="input"
                value={garmentType}
                onChange={(e) => setGarmentType(e.target.value as GarmentType)}
              >
                {(Object.keys(GARMENT_LABELS) as GarmentType[]).map((g) => (
                  <option key={g} value={g}>{GARMENT_LABELS[g]}</option>
                ))}
              </select>
            </div>

            <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{t('merchant.couture.fabricResult')}</p>
              <p className="text-3xl font-bold text-brand-700">{suggestedMetres} m</p>
              <p className="text-xs text-gray-400 mt-1">{t('merchant.couture.fabricMargin')}</p>
            </div>

            {missingKey && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                <p className="text-xs text-orange-700">
                  {t('merchant.couture.missingMeasure').replace('{field}', MISSING_LABELS[missingKey])}{' '}
                  <button
                    onClick={() => setTab('clients')}
                    className="underline hover:no-underline"
                  >
                    {t('merchant.couture.updateMeasureBtn')}
                  </button>
                </p>
              </div>
            )}
          </div>

          {/* Section B — Essayage virtuel */}
          <div className="card space-y-3">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{t('merchant.couture.virtualTryOnTitle')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('merchant.couture.virtualTryOnDesc')}</p>
            </div>
            <AvatarTryOn
              clients={clients}
              selectedClientId={atelierClientId}
              selectedGarment={garmentType}
            />
          </div>

          {/* Section C — Bon de commande */}
          <div className="card space-y-3">
            <p className="font-semibold text-gray-900 text-sm">{t('merchant.couture.bonCommandeTitle')}</p>

            {commandes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {t('merchant.couture.noOrderYet')}
              </p>
            ) : (
              <>
                <div>
                  <label className="label">{t('merchant.couture.selectOrder')}</label>
                  <select
                    className="input"
                    value={bonCommandeId}
                    onChange={(e) => setBonCommandeId(e.target.value)}
                  >
                    <option value="">{t('merchant.couture.chooseOrder')}</option>
                    {commandes.map((cmd) => (
                      <option key={cmd.id} value={cmd.id}>
                        {cmd.urgent ? '🔴 ' : ''}{cmd.client_name_snapshot} — {cmd.modele_description.slice(0, 40)}{cmd.modele_description.length > 40 ? '…' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {bonCommandeId && (
                  <button
                    onClick={printBonCommande}
                    className="w-full btn-primary py-3 text-sm"
                  >
                    {t('merchant.couture.printBonBtn')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
