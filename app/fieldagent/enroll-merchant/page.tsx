'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import PhoneInput from '@/components/ui/PhoneInput'
import { createClient } from '@/lib/supabase/client'

interface Category { code: string; name_fr: string }

export default function EnrollMerchantPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [step, setStep]             = useState<'phone' | 'form'>('phone')
  const [submitting, setSubmitting] = useState(false)

  const [phone, setPhone]           = useState('')
  const [lookedUp, setLookedUp]     = useState<{ full_name: string; phone: string; kyc_level: number } | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  const [businessName, setBusinessName]         = useState('')
  const [businessCategory, setBusinessCategory] = useState('')
  const [addressText, setAddressText]           = useState('')
  const [city, setCity]                         = useState('')
  const [neighborhood, setNeighborhood]         = useState('')
  const [ifu, setIfu]                           = useState('')
  const [rccm, setRccm]                         = useState('')
  const [ifuDoc, setIfuDoc]                     = useState<File | null>(null)
  const [rccmDoc, setRccmDoc]                   = useState<File | null>(null)

  useEffect(() => {
    supabase.from('merchant_categories').select('code, name_fr').order('name_fr').then(({ data }) => {
      setCategories(data ?? [])
    })
  }, [supabase])

  async function lookupUser() {
    if (!phone) return
    setLookupLoading(true)
    const res  = await fetch('/api/fieldagent/lookup-user', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone }),
    })
    const data = await res.json()
    setLookupLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Utilisateur introuvable'); return }
    if ((data.kyc_level ?? 0) < 1) {
      toast.error("Le KYC de cet utilisateur doit d'abord être validé")
      return
    }
    setLookedUp(data)
    setStep('form')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName || !businessCategory || !addressText) {
      toast.error('Remplissez tous les champs obligatoires')
      return
    }
    setSubmitting(true)
    const fd = new FormData()
    fd.append('phone', phone)
    fd.append('business_name', businessName)
    fd.append('business_category', businessCategory)
    fd.append('address_text', addressText)
    if (city)         fd.append('city', city)
    if (neighborhood) fd.append('neighborhood', neighborhood)
    if (ifu)          fd.append('ifu', ifu)
    if (rccm)         fd.append('rccm', rccm)
    if (ifuDoc)       fd.append('ifu_doc', ifuDoc)
    if (rccmDoc)      fd.append('rccm_doc', rccmDoc)

    const res  = await fetch('/api/fieldagent/enroll-merchant', { method: 'POST', body: fd })
    const data = await res.json()
    setSubmitting(false)
    if (data.ok) {
      toast.success('Dossier marchand soumis — en attente de validation admin')
      router.push('/fieldagent/dashboard')
    } else {
      toast.error(data.error ?? 'Erreur')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Enrôler un marchand</h1>
            <p className="text-gray-400 text-sm mt-0.5">Dossier soumis directement en validation admin</p>
          </div>
          <Link href="/fieldagent/dashboard" className="text-sm text-gray-400 hover:text-white">← Retour</Link>
        </div>

        {step === 'phone' && (
          <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">Numéro du futur marchand</p>
            <PhoneInput value={phone} onChange={setPhone} placeholder="97 00 00 00" />
            <button
              onClick={lookupUser}
              disabled={lookupLoading || !phone}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {lookupLoading ? 'Recherche…' : "Rechercher l'utilisateur"}
            </button>
          </div>
        )}

        {step === 'form' && lookedUp && (
          <form onSubmit={submit} className="space-y-5">

            {/* Utilisateur trouvé */}
            <div className="bg-green-900/20 border border-green-800/40 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{lookedUp.full_name}</p>
                <p className="text-xs text-gray-400">{lookedUp.phone} · KYC vérifié</p>
              </div>
              <button type="button" onClick={() => { setStep('phone'); setLookedUp(null) }}
                className="text-xs text-gray-500 hover:text-white transition-colors">Changer</button>
            </div>

            {/* Infos boutique */}
            <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Informations boutique</p>
              <Field label="Nom de la boutique *">
                <input value={businessName} onChange={e => setBusinessName(e.target.value)}
                  placeholder="Ex : Boutique Kossou" className="input w-full" required />
              </Field>
              <Field label="Catégorie *">
                <select value={businessCategory} onChange={e => setBusinessCategory(e.target.value)}
                  className="input w-full" required>
                  <option value="">Sélectionner…</option>
                  {categories.map(c => <option key={c.code} value={c.code}>{c.name_fr}</option>)}
                </select>
              </Field>
              <Field label="Adresse complète *">
                <input value={addressText} onChange={e => setAddressText(e.target.value)}
                  placeholder="Ex : Marché Dantokpa, Allée B, Stand 12" className="input w-full" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ville">
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Cotonou" className="input w-full" />
                </Field>
                <Field label="Quartier">
                  <input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Cadjehoun" className="input w-full" />
                </Field>
              </div>
            </div>

            {/* Docs fiscaux */}
            <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Documents fiscaux</p>
              <Field label="Numéro IFU">
                <input value={ifu} onChange={e => setIfu(e.target.value)} placeholder="Ex : 12345678A" className="input w-full" />
              </Field>
              <Field label="Document IFU (photo)">
                <FileInput label="Choisir le fichier IFU" onChange={f => setIfuDoc(f)} file={ifuDoc} />
              </Field>
              <Field label="Numéro RCCM (optionnel)">
                <input value={rccm} onChange={e => setRccm(e.target.value)} placeholder="Ex : RB/COT/23B/1234" className="input w-full" />
              </Field>
              {rccm && (
                <Field label="Document RCCM (photo)">
                  <FileInput label="Choisir le fichier RCCM" onChange={f => setRccmDoc(f)} file={rccmDoc} />
                </Field>
              )}
            </div>

            <button type="submit" disabled={submitting}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-60">
              {submitting ? 'Soumission…' : 'Soumettre le dossier marchand'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function FileInput({ label, onChange, file }: { label: string; onChange: (f: File) => void; file: File | null }) {
  return (
    <label className={`flex items-center gap-3 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 cursor-pointer hover:border-brand-500 transition-colors`}>
      <span className="text-sm text-gray-300 flex-1 truncate">{file ? file.name : label}</span>
      <span className="text-xs text-brand-400 shrink-0">Choisir</span>
      <input type="file" accept="image/*,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f) }} />
    </label>
  )
}
