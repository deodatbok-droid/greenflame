import { createServiceClient } from '@/lib/supabase/server'

/**
 * Décrémente le stock des produits liés à une transaction complétée.
 * Priorise transaction_items (panier multi-produits), tombe back sur
 * le product_id unique si aucun item trouvé.
 * Non-bloquant par design : à appeler avec .catch(() => {}).
 */
export async function decrementStockFromTransaction(
  transactionId: string,
  merchantId: string,
  singleProductId?: string | null,
): Promise<void> {
  try {
    const svc = createServiceClient()

    type Item = { product_id: string; quantity: number }
    const items: Item[] = []

    // 1. Panier multi-produits (transaction_items)
    const { data: txItems } = await svc
      .from('transaction_items')
      .select('product_id, quantity')
      .eq('transaction_id', transactionId)
      .not('product_id', 'is', null)

    if (txItems && txItems.length > 0) {
      items.push(...txItems.map(i => ({ product_id: i.product_id as string, quantity: i.quantity })))
    } else if (singleProductId) {
      // 2. Produit unique sur la transaction (qté = 1)
      items.push({ product_id: singleProductId, quantity: 1 })
    }

    if (items.length === 0) return

    for (const item of items) {
      const { data: product } = await svc
        .from('products')
        .select('stock_quantity')
        .eq('id', item.product_id)
        .single()

      // stock_quantity NULL = stock non suivi pour ce produit → skip
      if (!product || product.stock_quantity === null) continue

      const newStock = Math.max(0, product.stock_quantity - item.quantity)

      await svc.from('products')
        .update({ stock_quantity: newStock })
        .eq('id', item.product_id)

      await svc.from('stock_movements').insert({
        product_id:     item.product_id,
        merchant_id:    merchantId,
        type:           'out',
        quantity:       -item.quantity,
        stock_after:    newStock,
        reason:         'Vente GreenFlame',
        transaction_id: transactionId,
      })
    }
  } catch (err) {
    console.error('[stock-transaction] Erreur décrémentation stock:', err)
  }
}
