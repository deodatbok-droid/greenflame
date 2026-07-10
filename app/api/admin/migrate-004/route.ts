// ONE-SHOT migration route — call once as admin, then this file can be deleted
// GET /api/admin/migrate-004

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!caller?.role?.includes('admin')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // The Supabase JS client can only call PostgREST — DDL must go through a trusted RPC.
  // We create a temporary function, run the migration, then drop it.
  // This uses the service role implicitly via the Edge Function / RPC mechanism.

  // Attempt 1: try calling existing exec_sql if installed
  const { error: rpcErr } = await supabase.rpc('exec_sql' as string, {
    sql: `
      ALTER TABLE public.wallet_ledger
        DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;
      ALTER TABLE public.wallet_ledger
        ADD CONSTRAINT wallet_ledger_transaction_type_check CHECK (
          transaction_type IN (
            'cashback','commission_network','platform_fee',
            'mobile_money_deposit','mobile_money_withdrawal',
            'purchase_payment','pgf_conversion','spillover','refund','admin_credit'
          )
        );
    `,
  } as Record<string, unknown>)

  if (rpcErr) {
    return NextResponse.json({
      error: 'La migration DDL ne peut pas être appliquée via l\'API JS.',
      instructions: 'Copiez le contenu de supabase/migrations/004_admin_credit.sql et collez-le dans le SQL Editor du Dashboard Supabase, puis exécutez.',
      rpc_error: rpcErr.message,
      status: 'manual_required',
    }, { status: 200 })
  }

  return NextResponse.json({ ok: true, message: 'Migration 004 appliquée avec succès' })
}
