import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MessagesCompose from '@/components/consumer/MessagesCompose'
import InvitationCard from '@/components/consumer/InvitationCard'

export const revalidate = 0

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  const h    = Math.floor(diff / 3_600_000)
  const d    = Math.floor(diff / 86_400_000)
  if (min < 1)  return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  if (h < 24)   return `il y a ${h}h`
  if (d < 7)    return `il y a ${d}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const TYPE_LABELS: Record<string, string> = {
  marchand_client: 'Commande',
  tontine:         'Tontine',
  cercle_upline:   'Cercle communautaire',
  palier2:         'Contact',
}
const TYPE_ICONS: Record<string, string> = {
  marchand_client: '🛍️',
  tontine:         '🤝',
  cercle_upline:   '👑',
  palier2:         '🌐',
}

export default async function MessagesInboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()

  // RLS is_conversation_member() filtre automatiquement les conversations accessibles
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, type, reference_id, last_message_at, conversation_participants(user_id, last_read_at)')
    .order('last_message_at', { ascending: false })
    .limit(40)

  const convList = conversations ?? []

  if (convList.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Mes conversations</h1>
          <MessagesCompose />
        </div>
        <div className="text-center py-12 space-y-3">
          <p className="text-4xl">💬</p>
          <p className="text-gray-500 font-medium">Aucune conversation pour l&apos;instant</p>
          <p className="text-gray-400 text-sm">
            Utilise le bouton <span className="font-semibold text-brand-600">+</span> pour inviter un membre à discuter, ou ouvre une conversation depuis une commande, une tontine ou ta communauté.
          </p>
          <div className="flex flex-col gap-2 pt-2 max-w-xs mx-auto">
            <Link href="/mes-achats" className="text-brand-600 text-sm font-medium hover:underline">→ Mes achats</Link>
            <Link href="/network"    className="text-brand-600 text-sm font-medium hover:underline">→ Ma communauté</Link>
            <Link href="/tontine"    className="text-brand-600 text-sm font-medium hover:underline">→ Mes tontines</Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Résolution des titres par type ─────────────────────────────────────

  const tontineIds      = convList.filter(c => c.type === 'tontine').map(c => c.reference_id).filter(Boolean) as string[]
  const cercleIds       = convList.filter(c => c.type === 'cercle_upline').map(c => c.reference_id).filter(Boolean) as string[]
  const needParticipant = convList.filter(c => c.type === 'marchand_client' || c.type === 'palier2').map(c => c.id)

  const [tontinesRes, cercleUsersRes, participantsRes] = await Promise.all([
    tontineIds.length > 0
      ? svc.from('tontines').select('id, name').in('id', tontineIds)
      : { data: [] as { id: string; name: string }[] },
    cercleIds.length > 0
      ? svc.from('users').select('id, full_name').in('id', cercleIds)
      : { data: [] as { id: string; full_name: string }[] },
    needParticipant.length > 0
      ? svc.from('conversation_participants')
           .select('conversation_id, user_id, users(full_name)')
           .in('conversation_id', needParticipant)
           .neq('user_id', user.id)
      : { data: [] as { conversation_id: string; user_id: string; users: unknown }[] },
  ])

  const tontineMap  = Object.fromEntries((tontinesRes.data  ?? []).map(t => [t.id, t.name]))
  const cercleMap   = Object.fromEntries((cercleUsersRes.data ?? []).map(u => [u.id, u.full_name]))

  // Pour marchand_client : préférer le nom commercial du marchand
  const otherUserIds = (participantsRes.data ?? []).map(p => p.user_id).filter(Boolean)
  const { data: merchantsData } = otherUserIds.length > 0
    ? await svc.from('merchants').select('user_id, business_name').in('user_id', otherUserIds)
    : { data: [] as { user_id: string; business_name: string }[] }
  const merchantByUser = Object.fromEntries((merchantsData ?? []).map(m => [m.user_id, m.business_name]))

  // Participants de l'autre côté, indexés par conversation_id
  const otherByConv: Record<string, { user_id: string; name: string }> = {}
  for (const p of (participantsRes.data ?? [])) {
    const u = p.users as { full_name?: string } | null
    otherByConv[p.conversation_id] = {
      user_id: p.user_id,
      name: merchantByUser[p.user_id] ?? u?.full_name ?? 'Interlocuteur',
    }
  }

  // ── Invitations reçues en attente ──────────────────────────────────────

  const { data: pendingInvs } = await svc
    .from('conversation_invitations')
    .select('id, from_user_id')
    .eq('to_user_id', user.id)
    .eq('status', 'en_attente')
    .order('created_at', { ascending: false })

  const senderIds = (pendingInvs ?? []).map(i => i.from_user_id as string)
  let senderNames: Record<string, string> = {}
  if (senderIds.length > 0) {
    const { data: senders } = await svc.from('users').select('id, full_name').in('id', senderIds)
    senderNames = Object.fromEntries((senders ?? []).map(u => [u.id as string, u.full_name as string]))
  }

  // ── Construction de la liste enrichie ──────────────────────────────────

  const enriched = convList.map(conv => {
    const myPart = (conv.conversation_participants as { user_id: string; last_read_at: string | null }[])
      .find(p => p.user_id === user.id)
    const lastReadAt      = myPart?.last_read_at ?? null
    const lastMessageAt   = conv.last_message_at as string | null
    const hasUnread       = !!lastMessageAt && (!lastReadAt || lastMessageAt > lastReadAt)

    let title = 'Conversation'
    if (conv.type === 'tontine') {
      title = tontineMap[conv.reference_id!] ? `Tontine — ${tontineMap[conv.reference_id!]}` : 'Tontine'
    } else if (conv.type === 'cercle_upline') {
      title = cercleMap[conv.reference_id!] ? `Cercle de ${cercleMap[conv.reference_id!]}` : 'Cercle communautaire'
    } else if (conv.type === 'marchand_client' || conv.type === 'palier2') {
      title = otherByConv[conv.id]?.name ?? 'Interlocuteur'
    }

    return { ...conv, title, hasUnread, lastMessageAt }
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Mes conversations</h1>
        <MessagesCompose />
      </div>

      {/* Invitations reçues en attente */}
      {(pendingInvs ?? []).length > 0 && (
        <div className="space-y-2">
          {(pendingInvs ?? []).map(inv => (
            <InvitationCard
              key={inv.id as string}
              id={inv.id as string}
              senderName={senderNames[inv.from_user_id as string] ?? 'Membre GreenFlame'}
            />
          ))}
        </div>
      )}

      <div className="divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {enriched.map(conv => (
          <Link
            key={conv.id}
            href={`/messages/${conv.id}`}
            className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors active:bg-gray-100"
          >
            {/* Avatar type */}
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
              conv.type === 'tontine'         ? 'bg-green-100'  :
              conv.type === 'cercle_upline'   ? 'bg-amber-100'  :
              conv.type === 'palier2'         ? 'bg-purple-100' :
                                               'bg-brand-100'
            }`}>
              {TYPE_ICONS[conv.type] ?? '💬'}
            </div>

            {/* Infos */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm truncate ${conv.hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {conv.title}
                </p>
                {conv.lastMessageAt && (
                  <span className="text-xs text-gray-400 flex-shrink-0">{relativeTime(conv.lastMessageAt)}</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{TYPE_LABELS[conv.type] ?? conv.type}</p>
            </div>

            {/* Unread dot */}
            {conv.hasUnread && (
              <span className="w-2.5 h-2.5 bg-brand-500 rounded-full flex-shrink-0" />
            )}
          </Link>
        ))}
      </div>

    </div>
  )
}
