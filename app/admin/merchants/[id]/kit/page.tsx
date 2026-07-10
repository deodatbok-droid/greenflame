import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/utils/admin-guard'
import MerchantKitClient from './MerchantKitClient'

export default async function MerchantKitPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const supabase = await createClient()
  const { id } = await params

  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('id, business_name, business_category, qr_code_url, public_slug, is_active')
    .eq('id', id)
    .single()

  if (error || !merchant) notFound()
  if (!merchant.is_active) redirect(`/admin/merchants/${id}`)

  // URL de paiement encodée dans le QR (ce que le client scan)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'
  const payUrl = `${appUrl}/pay?merchant_id=${merchant.id}`

  return (
    <MerchantKitClient
      merchantName={merchant.business_name}
      merchantCategory={merchant.business_category}
      qrCodeUrl={merchant.qr_code_url ?? null}
      payUrl={payUrl}
      publicSlug={merchant.public_slug ?? null}
    />
  )
}
