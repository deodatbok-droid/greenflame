'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import PhoneInput from '@/components/ui/PhoneInput'

export default function EnrollUserPage() {
  const router = useRouter()

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState<{ referralCode: string; phone: string } | null>(null)

  const [fullName, setFullName]     = useState('')
  const [phone, setPhone]           = useState('')
  const [frontDoc, setFrontDoc]     = useState<File | null>(null)
  const [backDoc, setBackDoc]       = useState<File | null>(null)
  const [photo, setPhoto]           = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Nom complet requis'); return }
    if (!phone)           { toast.error('Numéro de téléphone requis'); return }
    if (!frontDoc)        { toast.error('Photo CNI recto obligatoire'); return }

    setSubmitting(true)
    const fd = new FormData()
    fd.append('full_name', fullName.trim())
    fd.append('phone', phone)
    fd.append('front_doc', frontDoc)
    if (backDoc) fd.append('back_doc', backDoc)
    if (photo)   fd.append('photo', photo)

    const res  = await fetch('/api/fieldagent/enroll-user', { method: 'POST', body: fd })
    const data = await res.json()
    setSubmitting(false)

    if (data.ok) {
      setDone({ referralCode: data.referralCode, phone })
    } else {
      toast.error(data.error ?? 'Erreur lors de la création du compte')
    }
  }

  if (done) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-gray-800 rounded-2xl p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-green-900/40 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">✅</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Compte créé !</h2>
          <p className="text-gray-400 text-sm mt-2">
            L&apos;utilisateur peut se connecter avec le numéro <span className="text-white font-medium">{done.phone}</span>
          </p>
        </div>
        <div className="bg-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Code de parrainage</p>
          <p className="text-xl font-bold text-brand-400 tracking-widest">{done.referralCode}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setDone(null); setFullName(''); setPhone(''); setFrontDoc(null); setBackDoc(null); setPhoto(null); setPhotoPreview(null) }}
            className="flex-1 bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl hover:bg-gray-600 transition-colors text-sm"
          >
            Nouveau compte
          </button>
          <button
            onClick={() => router.push('/fieldagent/dashboard')}
            className="flex-1 bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 transition-colors text-sm"
          >
            Tableau de bord
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Enrôler un utilisateur</h1>
            <p className="text-gray-400 text-sm mt-0.5">Compte créé avec KYC validé immédiatement</p>
          </div>
          <Link href="/fieldagent/dashboard" className="text-sm text-gray-400 hover:text-white">← Retour</Link>
        </div>

        <form onSubmit={submit} className="space-y-5">

          {/* Identité */}
          <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Identité</p>
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">Nom complet *</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Prénom et nom de famille"
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">Numéro de téléphone *</label>
              <PhoneInput value={phone} onChange={setPhone} placeholder="97 00 00 00" />
            </div>
          </div>

          {/* Documents CNI */}
          <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pièce d&apos;identité (CNI)</p>
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">CNI Recto *</label>
              <FileInput label="Photographier le recto" onChange={f => setFrontDoc(f)} file={frontDoc} capture="environment" />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">CNI Verso</label>
              <FileInput label="Photographier le verso" onChange={f => setBackDoc(f)} file={backDoc} capture="environment" />
            </div>
          </div>

          {/* Photo biométrique */}
          <div className="bg-gray-800 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Photo biométrique</p>
            {photoPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Aperçu" className="w-full h-52 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                  className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80"
                >
                  Retirer
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-36 bg-gray-700/50 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-brand-500 transition-colors">
                <span className="text-3xl">📷</span>
                <span className="text-sm text-gray-400 mt-2">Prendre la photo du visage</span>
                <input type="file" accept="image/*" capture="user" className="sr-only" onChange={handlePhoto} />
              </label>
            )}
            <p className="text-xs text-gray-500">La photo biométrique est facultative mais recommandée</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-60"
          >
            {submitting ? 'Création du compte…' : 'Créer le compte GreenFlame'}
          </button>
        </form>
      </div>
    </div>
  )
}

function FileInput({ label, onChange, file, capture }: {
  label: string; onChange: (f: File) => void; file: File | null; capture?: 'user' | 'environment'
}) {
  return (
    <label className="flex items-center gap-3 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 cursor-pointer hover:border-brand-500 transition-colors">
      <span className="text-sm text-gray-300 flex-1 truncate">{file ? file.name : label}</span>
      <span className="text-xs text-brand-400 shrink-0">{file ? 'Changer' : 'Choisir'}</span>
      <input
        type="file"
        accept="image/*"
        capture={capture}
        className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f) }}
      />
    </label>
  )
}
