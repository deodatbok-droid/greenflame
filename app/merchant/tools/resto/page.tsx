import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestoClient from './RestoClient'
import ToolGate from '@/components/merchant/ToolGate'

export default async function RestoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, is_platform_hub')
    .eq('user_id', user.id)
    .single()
  if (!merchant) redirect('/merchant/activate')

  const { data: toolSub } = await supabase
    .from('tool_subscriptions')
    .select('expires_at')
    .eq('merchant_id', merchant.id)
    .eq('tool_slug', 'resto')
    .maybeSingle()

  const hasSubscription = merchant.is_platform_hub || (toolSub ? new Date(toolSub.expires_at) > new Date() : false)

  if (!hasSubscription) {
    return (
      <ToolGate
        toolSlug="resto"
        toolName="Restauration"
        toolIcon="🍲"
        toolDescription="Gérez vos recettes, menus du jour, clients et commandes en salle."
        features={[
          'Recettes & calcul de marges',
          'Menu du jour (brouillon / publié)',
          'Gestion des clients fidèles',
          'Prise de commandes en salle',
          'Devis traiteur PDF',
        ]}
        monthlyPrice={25000}
        annualPrice={250000}
      />
    )
  }

  const [ingredientsRes, recettesRes, menusRes, clientsRes, commandesRes] = await Promise.all([
    supabase
      .from('resto_ingredients')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('name'),
    supabase
      .from('resto_recettes')
      .select('*, resto_recette_ingredients(quantity_used, resto_ingredients(id, name, unit, price_per_unit_fcfa))')
      .eq('merchant_id', merchant.id)
      .order('category').order('name'),
    supabase
      .from('resto_menus')
      .select('*, resto_menu_plats(*)')
      .eq('merchant_id', merchant.id)
      .order('date', { ascending: false }),
    supabase
      .from('resto_clients')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('nom'),
    supabase
      .from('resto_commandes')
      .select('*, resto_commande_plats(*)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <RestoClient
      merchantId={merchant.id}
      businessName={merchant.business_name}
      initialIngredients={ingredientsRes.data ?? []}
      initialRecettes={recettesRes.data ?? []}
      initialMenus={menusRes.data ?? []}
      initialClients={clientsRes.data ?? []}
      initialCommandes={commandesRes.data ?? []}
    />
  )
}
