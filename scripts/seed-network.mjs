/**
 * Full 5-level network seeder
 * Creates L3 (27), L4 (81), L5 (243) users under existing L2 buyers.
 * Run: node scripts/seed-network.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://osuldrlwrzzdfwzesoke.supabase.co'
const SERVICE_KEY  = 'process.env.SUPABASE_SERVICE_KEY'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let phoneCounter = 20000   // high offset to avoid collisions

function nextPhone(prefix = '229700') {
  return `+${prefix}${(phoneCounter++).toString().padStart(5, '0')}`
}

async function cleanupOrphans() {
  console.log('Cleaning up any orphaned auth users from previous runs...')
  let page = 1
  let deleted = 0
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (!data?.users?.length) break

    // Find users with our seed phone prefixes who have no public user record
    const seedPhones = data.users.filter(u =>
      u.phone && (
        u.phone.startsWith('+229700') ||
        u.phone.startsWith('+229710') ||
        u.phone.startsWith('+229720')
      )
    )

    for (const u of seedPhones) {
      // Check if public user record exists
      const { data: pub } = await supabase
        .from('users')
        .select('id')
        .eq('id', u.id)
        .single()

      if (!pub) {
        await supabase.auth.admin.deleteUser(u.id)
        deleted++
      }
    }

    if (data.users.length < 100) break
    page++
  }
  console.log(`Cleaned up ${deleted} orphaned auth users.\n`)
}

async function createMember(phone, name, uplineId) {
  const { data, error } = await supabase.auth.admin.createUser({
    phone,
    phone_confirm: true,
    user_metadata: {},
  })

  if (error) {
    if (error.message?.toLowerCase().includes('already')) {
      // Orphan that survived cleanup — skip
      return null
    }
    console.error(`  Auth error for ${phone}: ${error.message}`)
    return null
  }

  const userId = data.user.id
  const refCode = 'GF-' + userId.replace(/-/g, '').substring(0, 8).toUpperCase()

  const { error: ue } = await supabase.from('users').insert({
    id: userId,
    phone,
    full_name: name,
    referral_code: refCode,
    upline_id: uplineId,
    role: ['consumer'],        // valid_roles constraint: consumer|merchant|kingmaker|admin|platform_upline
  })

  if (ue) {
    console.error(`  User insert error for ${phone}: ${ue.message}`)
    // Rollback the auth user so we don't leave orphans
    await supabase.auth.admin.deleteUser(userId)
    return null
  }

  await supabase.from('wallets').insert({
    user_id: userId,
    balance_fcfa: 0,
    balance_pgf: 0,
    total_earned_fcfa: 0,
    total_cashback_fcfa: 0,
  })

  return userId
}

async function batchCreate(parents, levelLabel, phonePrefix) {
  const results = []
  let done = 0
  const total = parents.length * 3

  const tasks = parents.flatMap(parentId =>
    [1, 2, 3].map(() => async () => {
      const phone = nextPhone(phonePrefix)
      const name  = `${levelLabel} Partner ${phoneCounter - 20000}`
      const id = await createMember(phone, name, parentId)
      done++
      if (done % 9 === 0 || done === total) {
        process.stdout.write(`  ${done}/${total} done\n`)
      }
      return id
    })
  )

  // Run in chunks of 9 parallel requests (rate-limit safe)
  for (let i = 0; i < tasks.length; i += 9) {
    const chunk = tasks.slice(i, i + 9)
    const ids = await Promise.all(chunk.map(fn => fn()))
    results.push(...ids.filter(Boolean))
  }
  return results
}

async function main() {
  await cleanupOrphans()

  console.log('Fetching existing L2 users...')
  const { data: l2rows, error } = await supabase
    .from('network_tree')
    .select('user_id')
    .not('l1_upline', 'is', null)
    .not('l2_upline', 'is', null)
    .is('l3_upline', null)

  if (error) { console.error('Error fetching L2:', error.message); return }
  if (!l2rows?.length) { console.error('No L2 users found. Run base seed first.'); return }

  const l2Ids = l2rows.map(r => r.user_id)
  console.log(`Found ${l2Ids.length} L2 users.\n`)

  console.log(`Creating L3 users (${l2Ids.length * 3} total)...`)
  const l3Ids = await batchCreate(l2Ids, 'L3', '229700')
  console.log(`✓ Created ${l3Ids.length} L3 users\n`)

  if (!l3Ids.length) { console.error('No L3 users created — aborting.'); return }

  console.log(`Creating L4 users (${l3Ids.length * 3} total)...`)
  const l4Ids = await batchCreate(l3Ids, 'L4', '229710')
  console.log(`✓ Created ${l4Ids.length} L4 users\n`)

  console.log(`Creating L5 users (${l4Ids.length * 3} total)...`)
  const l5Ids = await batchCreate(l4Ids, 'L5', '229720')
  console.log(`✓ Created ${l5Ids.length} L5 users\n`)

  const total = l3Ids.length + l4Ids.length + l5Ids.length
  console.log(`Done! Created ${total} total users across L3/L4/L5.`)
  console.log(`Network tree populated automatically via DB trigger.`)
}

main().catch(console.error)
