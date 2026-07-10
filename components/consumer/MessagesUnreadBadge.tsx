'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MessagesUnreadBadge() {
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Conversations où last_message_at > last_read_at (ou jamais lues)
      const { data } = await supabase
        .from('conversation_participants')
        .select('last_read_at, conversations(last_message_at)')
        .eq('user_id', user.id)

      const unread = (data ?? []).some(p => {
        const conv = p.conversations as unknown as { last_message_at: string } | null
        if (!conv?.last_message_at) return false
        if (!p.last_read_at) return true
        return conv.last_message_at > p.last_read_at
      })
      setHasUnread(unread)
    }
    check()
  }, [])

  if (!hasUnread) return null
  return (
    <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />
  )
}
