'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Logo from '@/components/Logo'
import BackButton from '@/components/ui/BackButton'
import { useLocale } from '@/components/providers/LocaleProvider'

type KycStatus = 'idle' | 'pending' | 'approved' | 'rejected'

interface ExistingKyc {
  status: KycStatus
  rejection_reason: string | null
  document_type: string
  created_at: string
}

export default function KycPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLocale()

  const [userId, setUserId] = useState<string | null>(null)
  const [existing, setExisting] = useState<ExistingKyc | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [docType, setDocType] = useState<'cni' | 'passport' | 'permis'>('cni')
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const frontRef = useRef<HTMLInputElement>(null)
  const backRef = useRef<HTMLInputElement>(null)

  const DOC_TYPES = [
    { value: 'cni',      label: t('kyc.docCni'),      icon: '🪪' },
    { value: 'passport', label: t('kyc.docPassport'),  icon: '📘' },
    { value: 'permis',   label: t('kyc.docPermis'),    icon: '🚗' },
  ] as const

  const BENEFITS = [
    { icon: '💸', text: t('kyc.benefit1') },
    { icon: '🔒', text: t('kyc.benefit2') },
    { icon: '⚡', text: t('kyc.benefit3') },
  ]

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('kyc_submissions')
        .select('status, rejection_reason, document_type, created_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) setExisting(data as ExistingKyc)
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFileChange(side: 'front' | 'back', file: File | null) {
    if (!file) return
    const url = URL.createObjectURL(file)
    if (side === 'front') { setFrontFile(file); setFrontPreview(url) }
    else { setBackFile(file); setBackPreview(url) }
  }

  async function uploadFile(file: File, path: string): Promise<string> {
    const { error } = await supabase.storage
      .from('kyc-documents')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw new Error(error.message)
    return path
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!frontFile) { toast.error(t('kyc.frontRequired')); return }
    if (!userId) return

    setSubmitting(true)
    setUploadProgress(10)

    try {
      const frontPath = `${userId}/front-${Date.now()}.${frontFile.name.split('.').pop()}`
      await uploadFile(frontFile, frontPath)
      setUploadProgress(50)

      let backPath: string | null = null
      if (backFile) {
        backPath = `${userId}/back-${Date.now()}.${backFile.name.split('.').pop()}`
        await uploadFile(backFile, backPath)
      }
      setUploadProgress(80)

      const res = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontPath, backPath, documentType: docType }),
      })
      const data = await res.json()
      setUploadProgress(100)

      if (!res.ok) {
        toast.error(data.error ?? t('kyc.errorToast'))
        setSubmitting(false)
        return
      }

      toast.success(t('kyc.successToast'))
      setExisting({
        status: 'pending',
        rejection_reason: null,
        document_type: docType,
        created_at: new Date().toISOString(),
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('kyc.errorToast'))
    }

    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-4 pt-8 pb-14">
        <div className="flex items-center justify-between mb-6">
          <BackButton href="/profile" className="text-white/70 hover:text-white" />
          <Logo size={40} className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-white">{t('kyc.title')}</h1>
        <p className="text-brand-200 text-sm mt-1">{t('kyc.subtitle')}</p>
      </div>

      <div className="mx-4 -mt-8 relative z-10 space-y-4">

        {/* Status existing */}
        {existing && (
          <div className={`rounded-2xl p-5 shadow-sm border ${
            existing.status === 'approved'  ? 'bg-green-50 border-green-200' :
            existing.status === 'rejected'  ? 'bg-red-50 border-red-200' :
            'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {existing.status === 'approved' ? '✅' : existing.status === 'rejected' ? '❌' : '⏳'}
              </span>
              <div>
                <p className={`font-bold ${
                  existing.status === 'approved' ? 'text-green-700' :
                  existing.status === 'rejected' ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {existing.status === 'approved' ? t('kyc.statusApproved') :
                   existing.status === 'rejected' ? t('kyc.statusRejected') :
                   t('kyc.statusPending')}
                </p>
                <p className={`text-sm mt-0.5 ${
                  existing.status === 'approved' ? 'text-green-600' :
                  existing.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {existing.status === 'approved'
                    ? t('kyc.approvedDesc')
                    : existing.status === 'rejected'
                    ? `${t('kyc.rejectedPrefix')}${existing.rejection_reason ?? t('kyc.rejectedNoReason')}`
                    : t('kyc.pendingDesc')}
                </p>
              </div>
            </div>
            {existing.status === 'approved' && (
              <Link href="/profile" className="block mt-4 text-center text-brand-600 text-sm font-semibold">
                {t('kyc.backToProfile')}
              </Link>
            )}
          </div>
        )}

        {/* Benefits card */}
        {(!existing || existing.status === 'rejected') && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="font-semibold text-gray-800 mb-3">{t('kyc.whyVerify')}</p>
            <div className="space-y-2">
              {BENEFITS.map(b => (
                <div key={b.text} className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">{b.icon}</span>
                  <p className="text-sm text-gray-600">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        {(!existing || existing.status === 'rejected') && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Document type */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="font-semibold text-gray-800 mb-3">{t('kyc.docType')}</p>
              <div className="grid grid-cols-3 gap-2">
                {DOC_TYPES.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDocType(d.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                      docType === d.value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{d.icon}</span>
                    <span className={`text-xs font-medium text-center leading-tight ${
                      docType === d.value ? 'text-brand-700' : 'text-gray-600'
                    }`}>{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo recto */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div>
                <p className="font-semibold text-gray-800">{t('kyc.frontPhoto')} <span className="text-red-500">*</span></p>
                <p className="text-xs text-gray-400 mt-0.5">{t('kyc.frontDesc')}</p>
              </div>

              <input
                ref={frontRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleFileChange('front', e.target.files?.[0] ?? null)}
              />

              {frontPreview ? (
                <div className="relative">
                  <img src={frontPreview} alt="Front" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => { setFrontFile(null); setFrontPreview(null) }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => frontRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand-400 hover:bg-brand-50/50 transition-colors"
                >
                  <span className="text-3xl">📸</span>
                  <p className="text-sm font-medium text-gray-600">{t('kyc.addPhoto')}</p>
                  <p className="text-xs text-gray-400">{t('kyc.maxSize')}</p>
                </button>
              )}
            </div>

            {/* Photo verso */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div>
                <p className="font-semibold text-gray-800">
                  {t('kyc.backPhoto')}
                  {docType === 'passport' && <span className="ml-2 text-xs text-gray-400 font-normal">{t('kyc.backPassportHint')}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{t('kyc.backDesc')}</p>
              </div>

              <input
                ref={backRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleFileChange('back', e.target.files?.[0] ?? null)}
              />

              {backPreview ? (
                <div className="relative">
                  <img src={backPreview} alt="Back" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => { setBackFile(null); setBackPreview(null) }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => backRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand-400 hover:bg-brand-50/50 transition-colors"
                >
                  <span className="text-3xl">📸</span>
                  <p className="text-sm font-medium text-gray-600">{t('kyc.addPhoto')}</p>
                  <p className="text-xs text-gray-400">{t('kyc.optional')}</p>
                </button>
              )}
            </div>

            {/* Progress bar while submitting */}
            {submitting && uploadProgress < 100 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>{t('kyc.uploading')}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-gradient-to-r from-brand-500 to-orange-400 rounded-full transition-all duration-500"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !frontFile}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-colors shadow-sm"
            >
              {submitting ? t('kyc.uploading') : t('kyc.submit')}
            </button>

            <p className="text-xs text-gray-400 text-center px-4">
              {t('kyc.privacy')}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
