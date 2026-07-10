'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
  reference_id: string | null
  action_url: string | null
}

function typeIcon(type: string): string {
  if (type.startsWith('withdrawal')) return '💸'
  if (type.startsWith('kyc')) return '🪪'
  if (type === 'cashback') return '🔥'
  if (type === 'commission') return '💰'
  if (type === 'promo') return '🎁'
  return '🔔'
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'À l\'instant'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  return `${Math.floor(diff / 86400)} j`
}

export default function NotificationBell() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifs = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, is_read, created_at, reference_id, action_url')
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs(data ?? [])
    setUnread((data ?? []).filter(n => !n.is_read).length)
  }, [supabase])

  // Initial fetch
  useEffect(() => {
    fetchNotifs()
  }, [fetchNotifs])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        () => { fetchNotifs() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchNotifs])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleOpen() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      // Mark all visible unread as read
      const unreadIds = notifs.filter(n => !n.is_read).map(n => n.id)
      if (unreadIds.length > 0) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .in('id', unreadIds)
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnread(0)
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-flame-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-80 max-w-[calc(100vw-1rem)] max-h-[420px] bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {notifs.length > 0 && (
              <span className="text-xs text-gray-400">{notifs.length} au total</span>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <span className="text-3xl mb-2">🔔</span>
                <p className="text-sm text-gray-500 font-medium">Aucune notification</p>
                <p className="text-xs text-gray-400 mt-1">Vous serez alerté ici lors de vos transactions</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifs.map(n => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 flex gap-3 items-start transition-colors ${
                      !n.is_read ? 'bg-brand-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 truncate">{n.title}</p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                      {n.action_url && (
                        <a
                          href={n.action_url}
                          className="inline-block mt-1.5 text-[10px] font-semibold text-brand-600 hover:text-brand-800"
                          onClick={e => e.stopPropagation()}
                        >
                          Voir la boutique →
                        </a>
                      )}
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
