import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/ui/BackButton'
import FaqAccordion from '@/components/consumer/FaqAccordion'

export const metadata = { title: 'FAQ — GreenFlame' }

export default async function FaqPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isMerchant = false
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    isMerchant = !!profile?.role?.includes('merchant')
  }

  const wa = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? '22997025083'

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-5 pt-10 pb-8">
        <div className="flex items-center justify-between mb-4">
          <BackButton href="/profile" className="text-brand-200 hover:text-white" />
          <span className="text-white/80 text-sm font-semibold">Centre d'aide</span>
          <div className="w-8" />
        </div>
        <h1 className="text-white text-2xl font-bold">Questions fréquentes</h1>
        <p className="text-brand-200 text-sm mt-1">Tout ce qu'il faut savoir sur GreenFlame</p>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Bouton WhatsApp compact en haut */}
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
        >
          <span>💬</span> Contacter le support WhatsApp
        </a>

        {/* Accordion FAQ */}
        <FaqAccordion isMerchant={isMerchant} />

        <p className="text-xs text-gray-400 text-center pb-4">
          Vous ne trouvez pas votre réponse ? Contactez-nous sur WhatsApp.
        </p>
      </div>
    </div>
  )
}
