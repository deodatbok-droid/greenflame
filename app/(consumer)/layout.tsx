import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import BottomNav from '@/components/consumer/BottomNav'
import GlobalVoiceNav from '@/components/consumer/GlobalVoiceNav'
import { CartProvider } from '@/context/CartContext'
import CartFab from '@/components/consumer/CartFab'
import ChatWidget from '@/components/ChatWidget'

// Routes within the consumer group that are publicly accessible (no auth required)
const PUBLIC_PATHS = ['/demo', '/marketplace', '/panier']

export default async function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const pathname = h.get('x-pathname') ?? ''

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublic) redirect('/login')

  // Vérifier que l'utilisateur a complété son profil
  if (user && !isPublic) {
    const svc = createServiceClient()
    const { count } = await svc
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('id', user.id)
    if (!count) redirect('/complete-profile')
  }

  const isDemo = pathname.startsWith('/demo')

  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50 pb-20 overflow-x-hidden">
        {children}
        {user && !isDemo && <BottomNav />}
        {user && !isDemo && <CartFab />}
        {user && !isDemo && <GlobalVoiceNav />}
        {user && !isDemo && <ChatWidget />}
      </div>
    </CartProvider>
  )
}
