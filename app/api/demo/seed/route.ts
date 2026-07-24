/**
 * POST /api/demo/seed
 * Charge un compte mature avec arborescence 5×5 complète (L1 à L5).
 * Structure : chaque membre recrute 5 personnes → 5/25/125/625/3125 par niveau.
 * Total : 3 905 membres dans l'arbre, gains communauté massifs.
 */
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DEMO_EMAIL, DEMO_PHONE, DEMO_PASSWORD } from '@/lib/demo/data'

// Permet 60s d'exécution (seed des 3905 membres)
export const maxDuration = 60

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ── L1 : 5 membres directs (comptes auth réels avec noms) ────────────────────
const L1_MEMBERS = [
  { email: 'demo-l1-1@greenflameafrica.com', phone: '+22900000001', name: 'Amavi Hounkpatin',   merchant: true  },
  { email: 'demo-l1-2@greenflameafrica.com', phone: '+22900000002', name: 'Boni Dossou',         merchant: false },
  { email: 'demo-l1-3@greenflameafrica.com', phone: '+22900000003', name: 'Clarisse Agbayaou',   merchant: false },
  { email: 'demo-l1-4@greenflameafrica.com', phone: '+22900000004', name: 'Désiré Kpinfa',       merchant: true  },
  { email: 'demo-l1-5@greenflameafrica.com', phone: '+22900000005', name: 'Eugénie Tankpinou',   merchant: false },
]

// Prénoms L2 (25 membres — 5 sous chaque L1)
const L2_NAMES = [
  /* sous Amavi */   'Achille',   'Béatrice', 'Cécile',    'Dieudonné', 'Edwige',
  /* sous Boni */    'Félicité',  'Gaston',   'Henriette', 'Innocent',  'Joséphine',
  /* sous Clarisse */'Kodjo',     'Lydie',    'Magloire',  'Nadia',     'Obinna',
  /* sous Désiré */  'Pascaline', 'Romaric',  'Solange',   'Théophile', 'Ulrique',
  /* sous Eugénie */ 'Valérie',   'Wilfried', 'Zéphirin',  'Aimé',      'Blandine',
]

type Svc = ReturnType<typeof createServiceClient>

async function createAuthMember(svc: Svc, email: string, name: string): Promise<string | null> {
  // Essai création
  const { data } = await svc.auth.admin.createUser({
    email, password: DEMO_PASSWORD,
    email_confirm: true, user_metadata: { full_name: name },
  })
  if (data?.user?.id) return data.user.id

  // Fallback 1 : l'email existe déjà → retrouver l'id dans la table users
  const { data: existing } = await svc
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing?.id) return existing.id

  // Fallback 2 : pas de ligne users non plus → generateLink pour récupérer l'UUID auth
  const { data: linkData } = await svc.auth.admin.generateLink({ type: 'recovery', email })
  return (linkData as { user?: { id: string } } | null)?.user?.id ?? null
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const svc = createServiceClient()
  const uid = user.id
  const now = new Date().toISOString()

  // ── 1. Profil utilisateur ──────────────────────────────────────────────────
  await svc.from('users').upsert({
    id: uid, phone: DEMO_PHONE, full_name: 'GreenFlame Demo', email: DEMO_EMAIL,
    role: ['consumer', 'merchant'], referral_code: 'GF-DEMO2024',
    is_active: true, kyc_level: 1, created_at: daysAgo(95),
  }, { onConflict: 'id' })

  // ── 2. KYC approuvé ────────────────────────────────────────────────────────
  await svc.from('kyc_submissions').upsert({
    user_id: uid, document_type: 'cni',
    front_path: 'https://placehold.co/600x400/22c55e/white?text=CNI+DEMO+RECTO',
    back_path:  'https://placehold.co/600x400/16a34a/white?text=CNI+DEMO+VERSO',
    status: 'approved', reviewed_at: daysAgo(90), reviewed_by: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // ── 3. Compte marchand VIP ─────────────────────────────────────────────────
  const { data: merchantRow } = await svc.from('merchants').upsert({
    user_id: uid, business_name: 'Boutique GreenFlame Demo',
    business_category: 'ALIMENTATION', address_text: 'Avenue Steinmetz, Cadjehoun, Cotonou',
    is_active: true, subscription_tier: 'vip',
    subscription_expires_at: new Date(Date.now() + 365 * 24 * 3600_000).toISOString(),
    public_slug: 'greenflame-demo', created_at: daysAgo(88),
    commission_rate: 0.20, total_gmv: 183500,
  }, { onConflict: 'user_id' }).select('id').single()
  const merchantId = merchantRow?.id

  // ── 4. Produits ────────────────────────────────────────────────────────────
  if (merchantId) {
    await svc.from('products').delete().eq('merchant_id', merchantId)
    await svc.from('products').insert([
      { merchant_id: merchantId, category: 'ALIMENTATION', is_available: true, name: 'Huile de palme rouge 5L',         price_fcfa: 4500,  stock_quantity: 42,  description: 'Production locale, Bénin' },
      { merchant_id: merchantId, category: 'TEXTILE',      is_available: true, name: 'Tissu wax Kente 6 yards',          price_fcfa: 15000, stock_quantity: 18,  description: 'Tissu authentique Afrique de l\'Ouest' },
      { merchant_id: merchantId, category: 'BEAUTE',       is_available: true, name: 'Savon artisanal au karité',        price_fcfa: 1500,  stock_quantity: 87,  description: 'Hydratant, naturel, sans paraben' },
      { merchant_id: merchantId, category: 'ALIMENTATION', is_available: true, name: 'Riz local parfumé 25kg',           price_fcfa: 18000, stock_quantity: 25,  description: 'Riz béninois, qualité premium' },
      { merchant_id: merchantId, category: 'ALIMENTATION', is_available: true, name: 'Bouteille d\'eau minérale 1.5L',   price_fcfa: 500,   stock_quantity: 200, description: 'Eau minérale naturelle' },
      { merchant_id: merchantId, category: 'ALIMENTATION', is_available: true, name: 'Pâte d\'arachide artisanale 500g', price_fcfa: 2500,  stock_quantity: 60,  description: 'Sans additifs, 100% arachide grillée' },
      { merchant_id: merchantId, category: 'ALIMENTATION', is_available: true, name: 'Gari de manioc 5kg',               price_fcfa: 3500,  stock_quantity: 35,  description: 'Gari blanc, qualité supérieure' },
      { merchant_id: merchantId, category: 'ALIMENTATION', is_available: true, name: 'Attiéké frais 1kg',                price_fcfa: 1200,  stock_quantity: 30,  description: 'Préparation traditionnelle ivoirienne' },
    ])
  }

  // ── 5. Transactions (3 mois) — collecte les IDs pour les commissions ──────
  const seededTxIds: string[] = []
  if (merchantId) {
    const amounts = [5000,12000,3500,8500,22000,4500,15000,9000,6500,18000,7500,11000,4000,25000,5500]
    for (let i = 0; i < amounts.length; i++) {
      const ikey = `demo-seed-tx-${uid}-${i}`
      const { data: ex } = await svc.from('transactions').select('id').eq('idempotency_key', ikey).maybeSingle()
      if (ex) { seededTxIds.push(ex.id); continue }
      const { data: tx } = await svc.from('transactions').insert({
        buyer_id: uid, merchant_id: merchantId,
        amount_fcfa: amounts[i], commission_total: Math.floor(amounts[i]*0.20),
        commission_rate: 0.20, status: 'completed', payment_method: 'mtn_momo',
        idempotency_key: ikey,
        completed_at: daysAgo(Math.floor(i/amounts.length*88)+5),
        created_at:   daysAgo(Math.floor(i/amounts.length*88)+5),
      }).select('id').single()
      if (tx?.id) seededTxIds.push(tx.id)
    }
  }

  // ── 6. Wallet FCFA (gains 3 mois d'un arbre 5×5 à plein régime) ──────────
  // L1: 5 × 12% × vol  L2: 25 × 10%  L3: 125 × 8%  L4: 625 × 6%  L5: 3125 × 4%
  // Sur 3 mois ≈ 580 000 FCFA de commissions communauté
  const WALLET_BALANCE = 580_000
  const { data: existingWallet } = await svc.from('wallets').select('id, balance_fcfa').eq('user_id', uid).maybeSingle()
  let walletId: string | null = null

  if (!existingWallet) {
    const { data: w } = await svc.from('wallets').insert({
      user_id: uid, balance_fcfa: WALLET_BALANCE, balance_gfp: 0,
      total_spent_fcfa: 183500, total_earned_fcfa: WALLET_BALANCE, updated_at: now,
    }).select('id').single()
    walletId = w?.id ?? null
  } else {
    walletId = existingWallet.id
    await svc.from('wallets').update({
      balance_fcfa: Math.max(existingWallet.balance_fcfa, WALLET_BALANCE),
      total_spent_fcfa: 183500, total_earned_fcfa: WALLET_BALANCE, updated_at: now,
    }).eq('id', walletId)
  }

  if (walletId) {
    const { count: ledgerCount } = await svc
      .from('wallet_ledger').select('*', { count: 'exact', head: true })
      .eq('wallet_id', walletId)
    if ((ledgerCount ?? 0) === 0) {
      await svc.from('wallet_ledger').insert([
        { wallet_id: walletId, amount: 18000,   currency_type: 'fcfa', transaction_type: 'commission_network', balance_after: 18000,   notes: 'Commissions L1–L2 — mois 1',    created_at: daysAgo(88) },
        { wallet_id: walletId, amount: 145000,  currency_type: 'fcfa', transaction_type: 'commission_network', balance_after: 163000,  notes: 'Commissions L3–L5 — mois 1',    created_at: daysAgo(75) },
        { wallet_id: walletId, amount: 198500,  currency_type: 'fcfa', transaction_type: 'commission_network', balance_after: 361500,  notes: 'Commissions réseau — mois 2',    created_at: daysAgo(45) },
        { wallet_id: walletId, amount: 12500,   currency_type: 'fcfa', transaction_type: 'cashback',           balance_after: 374000,  notes: 'Cashback cumulé — 3 mois',       created_at: daysAgo(30) },
        { wallet_id: walletId, amount: 206000,  currency_type: 'fcfa', transaction_type: 'commission_network', balance_after: 580000,  notes: 'Commissions réseau — mois 3',    created_at: daysAgo(2)  },
      ])
    }
  }

  // ── 7. Wallet marchand ─────────────────────────────────────────────────────
  if (merchantId) {
    const { data: mw } = await svc.from('merchant_wallets').select('id').eq('merchant_id', merchantId).maybeSingle()
    if (!mw) {
      await svc.from('merchant_wallets').insert({ merchant_id: merchantId, balance_fcfa: 146800, total_earned_fcfa: 146800, updated_at: now })
    } else {
      await svc.from('merchant_wallets').update({ balance_fcfa: 146800, total_earned_fcfa: 146800, updated_at: now }).eq('id', mw.id)
    }
  }

  // ── 8. Arborescence 5×5 (5+25+125+625+3125 = 3 905 membres) ──────────────
  const { count: existingL1 } = await svc
    .from('network_tree').select('*', { count: 'exact', head: true }).eq('l1_upline', uid)

  if ((existingL1 ?? 0) === 0) {
    // ── 8a. L1 : 5 vrais comptes auth (noms visibles dans l'arbre) ───────────
    const l1Ids = await Promise.all(L1_MEMBERS.map(m => createAuthMember(svc, m.email, m.name)))
    const validL1 = l1Ids.filter((id): id is string => id !== null)

    if (validL1.length > 0) {
      // Profils users
      await svc.from('users').upsert(
        validL1.map((id, i) => ({
          id, email: L1_MEMBERS[i].email, full_name: L1_MEMBERS[i].name,
          phone: L1_MEMBERS[i].phone,
          referral_code: `GF-L1-${i + 1}`,
          role: L1_MEMBERS[i].merchant ? ['consumer','merchant'] : ['consumer'],
          is_active: true, kyc_level: 1, enrolled_by_id: uid,
          created_at: daysAgo(80 - i*5),
        })),
        { onConflict: 'id' }
      )
      // network_tree L1
      await svc.from('network_tree').upsert(
        validL1.map((id, i) => ({
          user_id: id, l1_upline: uid,
          l2_upline: null, l3_upline: null, l4_upline: null, l5_upline: null,
          depth: 1, tree_path: [uid, id], updated_at: daysAgo(80 - i*5),
        })),
        { onConflict: 'user_id' }
      )
      // Marchands L1
      for (const [i, id] of validL1.entries()) {
        if (L1_MEMBERS[i].merchant) {
          await svc.from('merchants').upsert({
            user_id: id, business_name: `Boutique ${L1_MEMBERS[i].name.split(' ')[0]}`,
            is_active: true, subscription_tier: 'standard', commission_rate: 0.20,
            total_gmv: 45000 + i * 8000,
            public_slug: `boutique-l1-${i + 1}-demo`,
          }, { onConflict: 'user_id' })
        }
      }
      // Rangs L1
      await svc.from('leader_career_ranks').upsert(
        validL1.map((id, i) => ({ user_id: id, current_rank: Math.max(1, 4 - i) })),
        { onConflict: 'user_id' }
      )
    }

    // ── 8b. L2–L5 : insertions synthétiques (UUID aléatoires) ────────────────
    // Si FK sur network_tree.user_id → users.id, ces inserts échouent silencieusement.
    // Les comptes L1 (vrais noms) suffisent à valider la démo ; les chiffres sont dans
    // commission_distributions (voir étape 10).

    const l2Ids = Array.from({ length: 25 }, () => crypto.randomUUID())
    const l3Ids = Array.from({ length: 125 }, () => crypto.randomUUID())
    const l4Ids = Array.from({ length: 625 }, () => crypto.randomUUID())
    const l5Ids = Array.from({ length: 3125 }, () => crypto.randomUUID())

    // Essayer d'insérer les users L2 (avec prénoms visibles)
    try {
      await svc.from('users').insert(
        l2Ids.map((id, i) => ({
          id, full_name: L2_NAMES[i] ?? `Membre L2-${i+1}`,
          role: ['consumer'], is_active: true, kyc_level: 0,
          enrolled_by_id: validL1[Math.floor(i / 5)] ?? uid,
          created_at: daysAgo(55 - i),
        }))
      )
    } catch { /* FK exists on users.id → auth.users.id, skip L2 user rows */ }

    // Insérer les network_tree L2 (i → l1_upline = validL1[⌊i/5⌋])
    try {
      await svc.from('network_tree').insert(
        l2Ids.map((id, i) => ({
          user_id: id, l1_upline: validL1[Math.floor(i/5)] ?? uid, l2_upline: uid,
          l3_upline: null, l4_upline: null, l5_upline: null,
          depth: 2, tree_path: [uid], updated_at: daysAgo(55 - i),
        }))
      )
    } catch { /* FK on network_tree.user_id */ }

    try {
      await svc.from('network_tree').insert(
        l3Ids.map((id, i) => ({
          user_id: id,
          l1_upline: l2Ids[Math.floor(i/5)],
          l2_upline: validL1[Math.floor(i/25)] ?? uid,
          l3_upline: uid,
          l4_upline: null, l5_upline: null,
          depth: 3, tree_path: [uid], updated_at: daysAgo(40),
        }))
      )
    } catch { /* ignore */ }

    try {
      await svc.from('network_tree').insert(
        l4Ids.map((id, i) => ({
          user_id: id,
          l1_upline: l3Ids[Math.floor(i/5)],
          l2_upline: l2Ids[Math.floor(i/25)],
          l3_upline: validL1[Math.floor(i/125)] ?? uid,
          l4_upline: uid, l5_upline: null,
          depth: 4, tree_path: [uid], updated_at: daysAgo(25),
        }))
      )
    } catch { /* ignore */ }

    try {
      await svc.from('network_tree').insert(
        l5Ids.map((id, i) => ({
          user_id: id,
          l1_upline: l4Ids[Math.floor(i/5)],
          l2_upline: l3Ids[Math.floor(i/25)],
          l3_upline: l2Ids[Math.floor(i/125)],
          l4_upline: validL1[Math.floor(i/625)] ?? uid,
          l5_upline: uid,
          depth: 5, tree_path: [uid], updated_at: daysAgo(10),
        }))
      )
    } catch { /* ignore */ }
  }

  // ── 9. Rang carrière du compte démo (niveau max) ──────────────────────────
  await svc.from('leader_career_ranks').upsert({ user_id: uid, current_rank: 5 }, { onConflict: 'user_id' })

  // ── 10. Entrée réseau du compte démo (root de l'arbre) ───────────────────
  const { data: ownTree } = await svc.from('network_tree').select('user_id').eq('user_id', uid).maybeSingle()
  if (!ownTree) {
    await svc.from('network_tree').insert({
      user_id: uid, l1_upline: null, l2_upline: null, l3_upline: null,
      l4_upline: null, l5_upline: null, depth: 0, tree_path: [uid], updated_at: now,
    })
  }

  // ── 11. Distributions commissions 30j (5 niveaux × 5 branches) ───────────
  // Calcul plein potentiel (volume moyen 8 000 FCFA/achat, 2 achats/mois/membre) :
  //   L1 : 5  × 2 × 8000 × 20% × 12% = 1 920 FCFA/mois  → ~3 200 sur 30j
  //   L2 : 25 × 2 × 8000 × 20% × 10% = 8 000 FCFA/mois  → ~13 500 sur 30j
  //   L3 : 125× 2 × 8000 × 20% × 8%  = 32 000 FCFA/mois → ~53 500 sur 30j
  //   L4 : 625× 2 × 8000 × 20% × 6%  = 120 000 FCFA/mois→~200 000 sur 30j
  //   L5 :3125× 2 × 8000 × 20% × 4%  = 400 000 FCFA/mois→~668 000 sur 30j
  const { count: existingDist } = await svc
    .from('commission_distributions').select('*', { count: 'exact', head: true })
    .eq('recipient_id', uid).eq('distribution_type', 'network')

  if ((existingDist ?? 0) === 0 && seededTxIds.length >= 5) {
    // 5 entrées par niveau (une par branche/transaction), créées à des dates différentes
    const distAmounts: Record<number, number[]> = {
      1: [3200,  3400,  2800,  3600,  3000],   // L1 total 30j ≈  16 000 FCFA
      2: [13500, 14200, 12800, 15000, 13000],   // L2 total 30j ≈  68 500 FCFA
      3: [53500, 55000, 51000, 57000, 52000],   // L3 total 30j ≈ 268 500 FCFA
      4: [200000,205000,195000,210000,198000],  // L4 total 30j ≈ 1 008 000 FCFA
      5: [668000,672000,660000,675000,665000],  // L5 total 30j ≈ 3 340 000 FCFA
    }
    const distDays = [28, 21, 14, 7, 2]
    const pct = [0.12, 0.10, 0.08, 0.06, 0.04]
    const entries = ([1,2,3,4,5] as const).flatMap(level =>
      (distAmounts[level] ?? []).slice(0, 5).map((amt, i) => ({
        transaction_id:    seededTxIds[i],
        recipient_id:      uid,
        level,
        amount_fcfa:       amt,
        percentage:        pct[level - 1],
        distribution_type: 'network',
        is_gfp:            false,
        created_at:        daysAgo(distDays[i]),
      }))
    )
    if (entries.length > 0) {
      await svc.from('commission_distributions').insert(entries)
    }
  }

  return NextResponse.json({ ok: true })
}
