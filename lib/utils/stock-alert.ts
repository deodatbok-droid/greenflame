import { createServiceClient } from '@/lib/supabase/server'
import { sendStockAlertEmail } from '@/lib/email'

export async function checkAndAlertStock(
  productId: string,
  merchantId: string
): Promise<void> {
  try {
    const svc = createServiceClient()

    const { data: product } = await svc
      .from('products')
      .select('name, emoji, stock_quantity, stock_alert_threshold')
      .eq('id', productId)
      .single()

    if (!product || product.stock_quantity === null) return

    const threshold = product.stock_alert_threshold ?? 5
    if (product.stock_quantity > threshold) return

    const { data: merchant } = await svc
      .from('merchants')
      .select('business_name, users(email, full_name)')
      .eq('id', merchantId)
      .single()

    if (!merchant) return
    const userInfo = merchant.users as unknown as { email: string; full_name: string } | null
    if (!userInfo?.email) return

    await sendStockAlertEmail({
      productName:    product.name,
      productEmoji:   product.emoji ?? '📦',
      stockQuantity:  product.stock_quantity,
      threshold,
      merchantName:   merchant.business_name,
      merchantEmail:  userInfo.email,
      fullName:       userInfo.full_name ?? 'marchand',
    })
  } catch (err) {
    console.error('[stock-alert] Erreur envoi alerte:', err)
  }
}
