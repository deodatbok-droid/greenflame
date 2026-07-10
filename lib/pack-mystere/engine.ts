import { createServiceClient } from '@/lib/supabase/server'
import { recordFlammeEvent } from '@/lib/flamme/engine'

export type PackTier = 'bronze' | 'argent' | 'or'
type Rarity = 'commun' | 'rare' | 'épique' | 'légendaire'

const RARITY_WEIGHTS: Record<Rarity, number> = {
  commun: 60, rare: 25, 'épique': 12, 'légendaire': 3,
}

const TIER_RARITY_ACCESS: Record<PackTier, Rarity[]> = {
  bronze: ['commun', 'rare'],
  argent: ['commun', 'rare', 'épique'],
  or:     ['commun', 'rare', 'épique', 'légendaire'],
}

function weightedPick(allowed: Rarity[]): Rarity {
  const total = allowed.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0)
  let rand = Math.random() * total
  for (const rarity of allowed) {
    rand -= RARITY_WEIGHTS[rarity]
    if (rand <= 0) return rarity
  }
  return allowed[0]
}

export async function purchasePack(userId: string, tier: PackTier): Promise<{
  purchaseId: string
  item: { name: string; rarity: string; description: string }
  faGranted: number
}> {
  const svc = createServiceClient()

  const { data: catalog } = await svc
    .from('pack_catalog')
    .select('*')
    .eq('tier', tier)
    .single()

  if (!catalog) throw new Error(`Pack ${tier} introuvable`)
  const pack = catalog as { id: string; price_fcfa: number; fa_guaranteed: number }

  const { data: wallet } = await svc
    .from('wallets')
    .select('id, balance_fcfa')
    .eq('user_id', userId)
    .single()

  if (!wallet) throw new Error('Portefeuille introuvable')
  const w = wallet as { id: string; balance_fcfa: number }
  if (w.balance_fcfa < pack.price_fcfa) throw new Error('Solde insuffisant')

  const newBalance = w.balance_fcfa - pack.price_fcfa

  await svc.from('wallets').update({
    balance_fcfa: newBalance,
    updated_at: new Date().toISOString(),
  }).eq('id', w.id)

  await svc.from('wallet_ledger').insert({
    wallet_id: w.id,
    amount: -pack.price_fcfa,
    currency_type: 'fcfa',
    transaction_type: 'purchase_payment',
    balance_after: newBalance,
    reference_id: null,
  })

  const allowed = TIER_RARITY_ACCESS[tier]
  const pickedRarity = weightedPick(allowed)

  const { data: itemCatalog } = await svc
    .from('pack_item_catalog')
    .select('id, name_fr, rarity, description_fr')
    .eq('rarity', pickedRarity)
    .eq('is_active', true)

  if (!itemCatalog || itemCatalog.length === 0) throw new Error('Aucun item disponible pour cette rareté')

  type ItemRow = { id: string; name_fr: string; rarity: string; description_fr: string }
  const randomItem = (itemCatalog as ItemRow[])[Math.floor(Math.random() * itemCatalog.length)]

  const { data: purchase } = await svc.from('mystery_pack_purchases').insert({
    user_id: userId,
    pack_tier: tier,
    price_paid_fcfa: pack.price_fcfa,
    fa_granted: pack.fa_guaranteed,
    boost_active: false,
    status: 'opened',
    opened_at: new Date().toISOString(),
  }).select().single()

  if (!purchase) throw new Error('Erreur création achat')
  const p = purchase as { id: string }

  await svc.from('mystery_pack_items').insert({
    purchase_id: p.id,
    catalog_item_id: randomItem.id,
    delivered: false,
  })

  await recordFlammeEvent({
    userId,
    eventType: 'fa_purchase',
    faDelta: pack.fa_guaranteed,
    referenceId: p.id,
    metadata: { source: 'pack_mystere', pack_tier: tier, item_name: randomItem.name_fr, rarity: pickedRarity },
  })

  return {
    purchaseId: p.id,
    item: {
      name: randomItem.name_fr,
      rarity: randomItem.rarity,
      description: randomItem.description_fr,
    },
    faGranted: pack.fa_guaranteed,
  }
}

export async function getPackHistory(userId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('mystery_pack_purchases')
    .select(`
      id, pack_tier, price_paid_fcfa, fa_granted, status, created_at,
      mystery_pack_items (
        id, delivered, delivered_at,
        pack_item_catalog:catalog_item_id (name_fr, rarity, description_fr)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  return data ?? []
}
