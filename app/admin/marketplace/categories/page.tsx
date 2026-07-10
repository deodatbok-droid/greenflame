'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Image from 'next/image'

interface Category {
  id: string
  slug: string
  name: string
  icon: string | null
  color_bg: string
  color_icon: string
  is_active: boolean
  sort_order: number
  image_url: string | null
  parent_id: string | null
  sub_count?: number
}

export default function AdminMarketplaceCategoriesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    async function load() {
      const { data: all } = await supabase
        .from('marketplace_categories')
        .select('id, slug, name, icon, color_bg, color_icon, is_active, sort_order, image_url, parent_id')
        .order('sort_order')
      const cats = all ?? []
      const roots = cats.filter((c: Category) => !c.parent_id)
      const withCount = roots.map((r: Category) => ({
        ...r,
        sub_count: cats.filter((c: Category) => c.parent_id === r.id).length,
      }))
      setCategories(withCount)
      setLoading(false)
    }
    load()
  }, [supabase])

  async function toggleActive(cat: Category) {
    const res = await fetch('/api/admin/marketplace/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cat.id, is_active: !cat.is_active }),
    })
    if (res.ok) {
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c))
      toast.success(cat.is_active ? 'Catégorie désactivée' : 'Catégorie activée')
    }
  }

  async function saveImageUrl(id: string) {
    if (!imageUrl.trim()) return
    const res = await fetch('/api/admin/marketplace/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, image_url: imageUrl.trim() }),
    })
    if (res.ok) {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, image_url: imageUrl.trim() } : c))
      toast.success('Image mise à jour')
      setEditing(null)
      setImageUrl('')
    } else {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  async function uploadImage(id: string, file: File) {
    setUploading(id)
    try {
      const ext = file.name.split('.').pop()
      const path = `categories/${id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('marketplace-categories')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('marketplace-categories')
        .getPublicUrl(path)

      const res = await fetch('/api/admin/marketplace/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, image_url: publicUrl }),
      })
      if (res.ok) {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, image_url: publicUrl } : c))
        toast.success('Image uploadée avec succès !')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur upload')
    } finally {
      setUploading(null)
    }
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Chargement…</div>

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Catégories Marketplace</h1>
          <p className="text-gray-400 text-sm mt-0.5">{categories.length} catégories · Cliquez sur une image pour la remplacer</p>
        </div>
        <Link href="/admin/marketplace" className="text-gray-400 text-sm hover:text-white">
          ← Produits
        </Link>
      </div>

      {/* Note upload */}
      <div className="bg-blue-900/40 border border-blue-700 rounded-xl p-3 text-sm text-blue-300">
        <strong>Comment ajouter une image :</strong> Uploadez un fichier depuis votre ordinateur (WebP ou PNG, 400×400 px recommandé),
        ou collez directement l&apos;URL générée par Midjourney / DALL-E.
        Le bucket Supabase requis est <code className="bg-blue-900 px-1 rounded">marketplace-categories</code> (public).
      </div>

      {/* Grille catégories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div
            key={cat.id}
            className={`bg-gray-800 rounded-2xl border overflow-hidden transition-all ${cat.is_active ? 'border-gray-700' : 'border-gray-600 opacity-60'}`}
          >
            {/* Image + upload zone */}
            <div
              className="relative h-32 flex items-center justify-center overflow-hidden cursor-pointer group"
              style={{ background: cat.color_bg }}
              onClick={() => document.getElementById(`upload-${cat.id}`)?.click()}
            >
              {cat.image_url ? (
                <Image
                  src={cat.image_url}
                  alt={cat.name}
                  fill
                  className="object-cover"
                  sizes="300px"
                />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <i
                    className={`ti ti-${cat.icon ?? 'shopping-bag'}`}
                    style={{ fontSize: 36, color: cat.color_icon }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium" style={{ color: cat.color_icon }}>Aucune image</span>
                </div>
              )}
              {/* Overlay upload */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-3 py-1 rounded-full">
                  {uploading === cat.id ? 'Upload…' : '+ Changer l\'image'}
                </span>
              </div>
              <input
                id={`upload-${cat.id}`}
                type="file"
                accept="image/webp,image/png,image/jpeg"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) uploadImage(cat.id, file)
                  e.target.value = ''
                }}
              />
            </div>

            {/* Info */}
            <div className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-white font-semibold text-sm">{cat.name}</p>
                  <p className="text-gray-400 text-xs">{cat.sub_count} sous-catégorie(s) · slug: {cat.slug}</p>
                </div>
                <button
                  onClick={() => toggleActive(cat)}
                  className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${cat.is_active ? 'bg-green-900 text-green-300 hover:bg-red-900 hover:text-red-300' : 'bg-gray-700 text-gray-400 hover:bg-green-900 hover:text-green-300'}`}
                >
                  {cat.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>

              {/* URL manuelle */}
              {editing === cat.id ? (
                <div className="flex gap-2">
                  <input
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="flex-1 bg-gray-700 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-brand-400"
                    autoFocus
                  />
                  <button onClick={() => saveImageUrl(cat.id)} className="text-xs bg-brand-600 text-white px-2 py-1.5 rounded-lg hover:bg-brand-700">
                    OK
                  </button>
                  <button onClick={() => { setEditing(null); setImageUrl('') }} className="text-xs bg-gray-700 text-gray-400 px-2 py-1.5 rounded-lg">
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditing(cat.id); setImageUrl(cat.image_url ?? '') }}
                  className="w-full text-xs text-gray-400 hover:text-gray-200 text-left py-1 border-t border-gray-700 mt-1 pt-2"
                >
                  {cat.image_url ? '✏️ Modifier l\'URL' : '🔗 Coller une URL'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
