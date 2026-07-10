'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'

interface CommissionNotification {
  id: string
  amount_fcfa: number
  level: number
  distribution_type: string
  created_at: string
}

export function useRealtimeCommissions(walletId: string | null) {
  const [notifications, setNotifications] = useState<CommissionNotification[]>([])
  const supabase = createClient()

  const addNotification = useCallback((n: CommissionNotification) => {
    setNotifications(prev => [n, ...prev].slice(0, 20))
  }, [])

  useEffect(() => {
    if (!walletId) return

    // Écouter les nouvelles entrées du ledger (commissions réseau)
    const channel = supabase
      .channel(`wallet-${walletId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wallet_ledger',
          filter: `wallet_id=eq.${walletId}`,
        },
        (payload) => {
          const entry = payload.new as {
            id: string
            amount: number
            transaction_type: string
            created_at: string
          }

          if (entry.amount > 0) {
            const label =
              entry.transaction_type === 'commission_network' ? '🌐 Dividende communauté' :
              entry.transaction_type === 'cashback' ? '💚 Cashback' :
              '💰 Crédit'

            toast.success(`${label} : +${formatFcfa(entry.amount)} FCFA`, {
              duration: 5000,
              icon: '🔥',
            })

            addNotification({
              id: entry.id,
              amount_fcfa: entry.amount,
              level: 0,
              distribution_type: entry.transaction_type,
              created_at: entry.created_at,
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [walletId, supabase, addNotification])

  return { notifications }
}
