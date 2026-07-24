import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ExportPanel from './ExportPanel'

export default async function AdminExportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) redirect('/admin/dashboard')

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Exports GreenFlame</h1>
          <p className="text-sm text-gray-400 mt-1">
            Sélectionnez vos datasets, choisissez la période et exportez en CSV ou PDF.
          </p>
        </div>
        <Link href="/admin/dashboard" className="text-brand-600 text-sm hover:text-brand-700">
          ← Dashboard
        </Link>
      </div>

      {/* Info réglementaire */}
      <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-xl p-4">
        <p className="font-semibold text-emerald-400 mb-1 text-sm">📋 Conformité BCEAO</p>
        <ul className="text-xs space-y-1 text-emerald-300">
          <li>· Chaque export est horodaté et inclut les IDs de référence</li>
          <li>· Les fichiers CSV sont encodés UTF-8 avec BOM pour Excel</li>
          <li>· Le PDF est généré côté serveur, aucune donnée ne transite par un service tiers</li>
        </ul>
      </div>

      <ExportPanel />
    </div>
  )
}
