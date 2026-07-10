import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MerchantActivateForm from './MerchantActivateForm'

export default async function MerchantActivatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', user.id)
    .eq('status', 'completed')

  const isActivated = (count ?? 0) > 0

  if (!isActivated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex flex-col items-center justify-center p-6">
        <div className="card w-full max-w-sm text-center space-y-5">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">🔒</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Compte non encore activé</h2>
            <p className="text-gray-500 text-sm mt-2">
              Pour ouvrir une boutique GreenFlame, vous devez d&apos;abord effectuer votre premier achat sur la plateforme.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
            <p className="text-amber-800 text-sm font-semibold">Pourquoi ?</p>
            <p className="text-amber-700 text-xs mt-1">
              Seul un membre actif de la communauté peut devenir marchand. Votre premier achat active votre compte et vous intègre dans la communauté GreenFlame.
            </p>
          </div>
          <Link href="/marketplace">
            <button className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition-colors">
              Faire mon premier achat 🛍️
            </button>
          </Link>
          <Link href="/dashboard" className="block text-center text-sm text-gray-700 hover:text-gray-900 font-medium">
            ← Retour au dashboard
          </Link>
        </div>
      </div>
    )
  }

  return <MerchantActivateForm />
}
