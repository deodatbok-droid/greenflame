'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface AvatarUploadProps {
  currentUrl: string | null
  initials: string
  size?: 'sm' | 'lg'
}

export default function AvatarUpload({ currentUrl, initials, size = 'sm' }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const dim = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-14 h-14 text-xl'

  async function handleFile(file: File) {
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)

    const form = new FormData()
    form.append('avatar', file)

    const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Erreur upload')
      setPreview(currentUrl)
      return
    }

    toast.success('Photo de profil mise à jour !')
    setPreview(data.avatarUrl + '?t=' + Date.now())
    router.refresh()
  }

  return (
    <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
      <div className={`${dim} rounded-full overflow-hidden bg-brand-600 flex items-center justify-center font-bold text-white select-none`}>
        {preview ? (
          <Image
            src={preview}
            alt="Avatar"
            width={size === 'lg' ? 96 : 56}
            height={size === 'lg' ? 96 : 56}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Overlay au survol */}
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        {uploading ? (
          <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
            <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
            <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" clipRule="evenodd"/>
          </svg>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}
