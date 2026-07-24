import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { DEMO_PHONE } from '@/lib/demo/data'

export async function GET() {
  const supabase = createServiceClient()

  // Tentative 1 : Storage (le plus fiable, pas de race condition)
  const { data: storageFile } = await supabase.storage
    .from('kyc-documents')
    .download('_demo/otp.json')

  if (storageFile) {
    try {
      const json = await storageFile.text()
      const { otp } = JSON.parse(json)
      if (otp && String(otp).length === 6) {
        return NextResponse.json({ otp: String(otp) })
      }
    } catch { /* fallback */ }
  }

  // Tentative 2 : app_metadata (fallback)
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return NextResponse.json({ otp: null })

  const bare = DEMO_PHONE.replace(/^\+/, '')
  const demoUser = users.find(u => {
    const p = u.phone ?? ''
    return p === DEMO_PHONE || p === bare
  })
  const otp = (demoUser?.app_metadata as Record<string, string | undefined> | undefined)?.demo_otp ?? null

  return NextResponse.json({ otp })
}
