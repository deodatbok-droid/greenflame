'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface Props {
  currentUrl: string | null
  shopName:   string
}

export default function BannerUpload({ currentUrl, shopName }: Props) {
  const [preview,   setPreview]   = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  async function handleFile(file: File) {
    if (!file) return
    setError(null)
    setSuccess(false)
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)

    const form = new FormData()
    form.append('banner', file)

    const res  = await fetch('/api/merchants/banner', { method: 'POST', body: form })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      setError(data.error ?? 'Erreur lors de l\'upload')
      setPreview(currentUrl)
      return
    }

    setSuccess(true)
    setPreview(data.bannerUrl + '?t=' + Date.now())
    setTimeout(() => setSuccess(false), 3000)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div
        className="relative w-full h-32 rounded-2xl overflow-hidden cursor-pointer group border-2 border-dashed border-gray-200 hover:border-brand-400 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <Image src={preview} alt="Bannière boutique" fill className="object-cover" unoptimized />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center">
            <p className="text-white/60 text-sm font-medium">{shopName}</p>
          </div>
        )}

        {/* Overlay au survol */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
            {uploading ? '⏳ Upload…' : '📷 Changer la bannière'}
          </span>
        </div>
      </div>

      {/* Input caché */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* Messages */}
      {error   && <p className="text-xs text-red-500">{error}</p>}
      {success && <p className="text-xs text-brand-600 font-semibold">✅ Bannière mise à jour !</p>}
      <p className="text-xs text-gray-400">JPG, PNG ou WebP · Max 8 MB · Ratio 3:1 recommandé</p>
    </div>
  )
}
