import { createServiceClient } from '@/lib/supabase/server'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import { requireAdmin } from '@/lib/utils/admin-guard'

export default async function AdminExportsPage() {
  await requireAdmin()
  const svc = createServiceClient()
  const now = new Date()

  const { count: txTotal } = await svc
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const { count: txMonth } = await svc
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('created_at', startOfMonth.toISOString())

  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
  const { count: txDay } = await svc
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('created_at', startOfDay.toISOString())

  const dateLabel = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const monthLabel = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })

  const EXPORTS = [
    {
      id: 'day',
      label: 'Export journalier',
      desc: `Toutes les transactions du ${dateLabel}`,
      count: txDay ?? 0,
      href: `/api/admin/exports?period=day`,
      icon: '📅',
    },
    {
      id: 'month',
      label: 'Export mensuel',
      desc: `Rapport complet — ${monthLabel}`,
      count: txMonth ?? 0,
      href: `/api/admin/exports?period=month`,
      icon: '📆',
    },
    {
      id: 'all',
      label: 'Export complet',
      desc: 'Toutes les transactions depuis le lancement',
      count: txTotal ?? 0,
      href: `/api/admin/exports?period=all`,
      icon: '📁',
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Export réglementaire BCEAO</h1>
        <p className="text-gray-400 text-sm mt-1">
          Exports horodatés et immuables pour la supervision réglementaire.
          Conforme aux exigences BCEAO pour les plateformes de paiement numérique.
        </p>
      </div>

      {/* Info réglementaire */}
      <div className="bg-green-900/20 border border-green-800/30 rounded-xl p-4 text-sm text-green-400">
        <p className="font-semibold mb-1">📋 Garanties de conformité</p>
        <ul className="text-xs space-y-1 text-green-300">
          <li>· Chaque export est signé cryptographiquement (SHA-256)</li>
          <li>· Les exports sont enregistrés dans le journal d&apos;audit immuable</li>
          <li>· Format CSV/JSON compatible avec les systèmes BCEAO</li>
          <li>· Données incluent : ID transaction, montant, commission, date, marchand, acheteur anonymisé</li>
        </ul>
      </div>

      {/* Options d'export */}
      <div className="space-y-3">
        {EXPORTS.map(e => (
          <div key={e.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{e.icon}</span>
                <div>
                  <p className="font-semibold text-white">{e.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{e.desc}</p>
                  <p className="text-xs text-brand-400 mt-1">{e.count.toLocaleString('fr-FR')} transaction(s)</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a
                  href={`${e.href}&format=csv`}
                  className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  ↓ CSV
                </a>
                <a
                  href={`${e.href}&format=json`}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg transition-colors"
                >
                  ↓ JSON
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Export sur période personnalisée */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <p className="font-semibold text-white mb-1">📊 Export sur période personnalisée</p>
        <p className="text-xs text-gray-400 mb-4">Sélectionner une plage de dates</p>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-gray-400 block mb-1">Date début</label>
            <input
              type="date"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-500 focus:outline-none"
              defaultValue={startOfMonth.toISOString().split('T')[0]}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-gray-400 block mb-1">Date fin</label>
            <input
              type="date"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-500 focus:outline-none"
              defaultValue={now.toISOString().split('T')[0]}
            />
          </div>
          <div className="flex items-end gap-2">
            <button className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              ↓ CSV
            </button>
            <button className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors">
              ↓ JSON
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3">
          Note : l&apos;API d&apos;export sur période (<code className="text-gray-500">/api/admin/exports?period=range</code>) est en cours d&apos;implémentation.
        </p>
      </div>

      {/* Journal des exports */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <p className="font-semibold text-white mb-3">Journal des exports récents</p>
        <p className="text-xs text-gray-500 italic">Aucun export généré pour le moment.</p>
      </div>

      <Link href="/admin/dashboard" className="inline-block text-xs text-gray-400 hover:text-gray-200">
        ← Retour au dashboard
      </Link>
    </div>
  )
}
