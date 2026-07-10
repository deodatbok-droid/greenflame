import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ConversationThread from '@/components/messaging/ConversationThread'

/**
 * app/messages/[conversationId]/page.tsx
 *
 * Vue de fil unique, partagée par toutes les portées de messagerie et par
 * les deux espaces consumer/merchant — volontairement placée hors des
 * groupes de routes (consumer)/merchant pour rester un point d'entrée
 * unique quel que soit le côté de la conversation depuis lequel on arrive.
 * Le layout racine minimal (app/layout.tsx) suffit ici, pas besoin de la
 * nav consumer/merchant pour un fil de discussion plein écran.
 */
export default async function ConversationPage({
  params,
}: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Lecture RLS-bound : is_conversation_member() (migration 057) renvoie
  // zéro ligne si l'utilisateur n'est pas membre — pas de fuite d'info sur
  // l'existence de la conversation à quelqu'un qui n'y a pas accès.
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, type, reference_id')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conversation) redirect('/dashboard')

  const svc = createServiceClient()
  let title = 'Conversation'
  let backHref = '/messages'

  if (conversation.type === 'marchand_client') {
    const { data: participants } = await svc
      .from('conversation_participants')
      .select('user_id, users(full_name)')
      .eq('conversation_id', conversationId)

    const other = (participants ?? []).find(p => p.user_id !== user.id)
    const otherUser = other?.users as unknown as { full_name: string } | null

    // Si l'autre partie a un profil marchand, on préfère le nom commercial
    // (utile côté acheteur) ; sinon on retombe sur le nom personnel (utile
    // côté marchand, qui voit le client).
    const { data: otherMerchant } = other?.user_id
      ? await svc.from('merchants').select('business_name').eq('user_id', other.user_id).maybeSingle()
      : { data: null }

    title = otherMerchant?.business_name ?? otherUser?.full_name ?? 'Conversation'
  } else if (conversation.type === 'tontine') {
    const { data: tontine } = await svc
      .from('tontines')
      .select('name')
      .eq('id', conversation.reference_id)
      .maybeSingle()
    title = tontine?.name ? `Tontine — ${tontine.name}` : 'Tontine'
  } else if (conversation.type === 'cercle_upline') {
    title = 'Cercle de mon leader'
  } else if (conversation.type === 'palier2') {
    const { data: participants } = await svc
      .from('conversation_participants')
      .select('user_id, users(full_name)')
      .eq('conversation_id', conversationId)
    const other = (participants ?? []).find(p => p.user_id !== user.id)
    const otherUser = other?.users as unknown as { full_name: string } | null
    title = otherUser?.full_name ?? 'Conversation'
  }

  return (
    <div className="max-w-xl mx-auto h-[100dvh] flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-white flex-shrink-0">
        <Link href={backHref} className="text-gray-500 hover:text-gray-700 text-sm">←</Link>
        <h1 className="font-semibold text-gray-900 text-sm truncate">{title}</h1>
      </div>
      <ConversationThread conversationId={conversationId} currentUserId={user.id} />
    </div>
  )
}
