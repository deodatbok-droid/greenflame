'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Plan = 'monthly' | 'annual'

type Props = {
  toolSlug: string
  toolName: string
  toolIcon: string
  toolDescription: string
  features: string[]
  monthlyPrice: number
  annualPrice: number
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR')
}

export default function ToolGate({
  toolSlug, toolName, toolIcon, toolDescription, features, monthlyPrice, annualPrice,
}: Props) {
  const [plan, setPlan] = useState<Plan>('monthly')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const savings = monthlyPrice * 12 - annualPrice

  async function handleActivate() {
    setLoading(true)
    try {
      const res = await fetch('/api/tools/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_slug: toolSlug, plan }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        toast.error(err.error ?? 'Erreur lors de l\'activation')
        return
      }
      toast.success(`${toolName} activé — ${plan === 'annual' ? '1 an' : '30 jours'} d'accès !`)
      router.refresh()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-10 flex flex-col items-center text-center gap-5">
      <div className="w-20 h-20 bg-brand-50 border-2 border-brand-100 rounded-3xl flex items-center justify-center text-4xl">
        {toolIcon}
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{toolName}</h1>
        <p className="text-sm text-gray-500 mt-1">{toolDescription}</p>
      </div>

      {/* Sélecteur de plan */}
      <div className="w-full grid grid-cols-2 gap-2">
        {/* Plan mensuel */}
        <button
          onClick={() => setPlan('monthly')}
          className={`rounded-2xl border-2 p-3 text-left transition-all ${
            plan === 'monthly'
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${plan === 'monthly' ? 'text-brand-600' : 'text-gray-500'}`}>Mensuel</p>
          <p className={`text-xl font-bold ${plan === 'monthly' ? 'text-brand-700' : 'text-gray-700'}`}>
            {fmt(monthlyPrice)}
            <span className="text-xs font-normal text-gray-500"> F</span>
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">par mois</p>
        </button>

        {/* Plan annuel */}
        <button
          onClick={() => setPlan('annual')}
          className={`rounded-2xl border-2 p-3 text-left transition-all relative ${
            plan === 'annual'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <span className="absolute -top-2 right-2 text-[10px] bg-green-500 text-white font-bold px-2 py-0.5 rounded-full">
            Économie {fmt(savings)} F
          </span>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${plan === 'annual' ? 'text-green-700' : 'text-gray-500'}`}>Annuel</p>
          <p className={`text-xl font-bold ${plan === 'annual' ? 'text-green-700' : 'text-gray-700'}`}>
            {fmt(annualPrice)}
            <span className="text-xs font-normal text-gray-500"> F</span>
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">par an · {fmt(Math.round(annualPrice / 12))} F/mois</p>
        </button>
      </div>

      <div className="card w-full space-y-3 text-left">
        <ul className="space-y-2">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="text-green-500 mt-0.5 shrink-0">✓</span>
              <span className="text-gray-700">{f}</span>
            </li>
          ))}
          <li className="flex items-start gap-2 text-sm">
            <span className="text-green-500 mt-0.5 shrink-0">✓</span>
            <span className="text-gray-700">
              {plan === 'annual' ? '365 jours d\'accès · renouvelable' : '30 jours · renouvelable'}
            </span>
          </li>
        </ul>

        <p className="text-[10px] text-gray-500 leading-relaxed border-t border-gray-100 pt-2">
          Activation gratuite pendant la phase MVP · La facturation débutera au lancement commercial
        </p>

        <button
          onClick={handleActivate}
          disabled={loading}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
            plan === 'annual'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'btn-primary'
          }`}
        >
          {loading
            ? 'Activation en cours…'
            : `Activer ${plan === 'annual' ? '1 an' : '1 mois'} — ${fmt(plan === 'annual' ? annualPrice : monthlyPrice)} FCFA`}
        </button>
      </div>

      <Link href="/merchant/tools" className="text-sm text-gray-500 hover:text-gray-600">
        ← Retour aux outils
      </Link>
    </div>
  )
}
