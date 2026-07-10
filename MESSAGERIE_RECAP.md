# 💬 Messagerie in-app GreenFlame — Récapitulatif

Système de messagerie à 4 portées, construit sur Supabase Realtime (pas de Pusher/Stream/Twilio). Tâches #146 à #150. Architecture complète dans la mémoire `greenflame-messaging-chatbot-architecture`.

## Les 4 portées

| Portée | Type (`conversations.type`) | Gate d'accès | Appartenance |
|---|---|---|---|
| Marchand ↔ client | `marchand_client` | Aucun (commande déjà passée) | `conversation_participants` explicite |
| Tontine | `tontine` | Membre de la tontine | `conversation_participants` synchronisé sur `tontine_membres` |
| Cercle de l'upline (Palier 1) | `cercle_upline` | Achat seul, **pas de KYC** | Calculée — `reference_id = upline_id` ou soi-même, jamais de ligne participant créée |
| Recherche + invitation (Palier 2) | `palier2` | Achat **ET** `kyc_level >= 1` | `conversation_participants`, créée uniquement à l'acceptation d'une invitation |

## Migrations SQL

**`supabase/migrations/057_messaging.sql`** — fondation des 4 portées.

Tables créées :

| Table | Description |
|---|---|
| `conversations` | `type`, `reference_id`, `created_by` — index unique `(type, reference_id)` (sauf palier2, toujours NULL) |
| `conversation_participants` | `conversation_id`, `user_id`, `last_read_at` |
| `messages` | `conversation_id`, `sender_id`, `content`, `deleted_at` |
| `conversation_invitations` | `from_user_id`, `to_user_id`, `status` (`en_attente`/`acceptee`/`refusee`), `conversation_id` — palier2 uniquement |
| `message_reports` | `message_id`, `reporter_id`, `reason`, `status` |

Fonctions :
- `is_conversation_member(p_conversation_id)` — SECURITY DEFINER, seule source d'autorisation pour conversations/messages. Vérifie l'appartenance explicite (`conversation_participants`) OU, pour `cercle_upline`, le graphe `users.upline_id` directement.
- `bump_conversation_last_message()` — trigger `AFTER INSERT` sur `messages`.

RLS complet sur les 5 tables. La policy `conversation_invitations_insert` encode déjà tout le verrou achat+KYC du palier 2 — aucune logique dupliquée côté TypeScript pour la création d'invitation.

**`supabase/migrations/056_chatbot_messages.sql`** — historique du chatbot (système séparé, voir plus bas). Table `chatbot_messages` (`user_id`, `channel` `app|whatsapp`, `role` `user|assistant`, `content`).

## `lib/messaging/conversations.ts`

Helpers serveur, toujours appelés avec un client `service_role` (`createServiceClient()`) car la création de conversation/l'ajout de participants doit pouvoir s'exécuter pour le compte des deux parties, pas seulement l'appelant :

- `getOrCreateOrderConversation(svc, transactionId, requestingUserId)` — marchand↔client, vérifie que l'appelant est bien acheteur ou marchand de la commande.
- `getOrCreateTontineConversation(svc, tontineId, requestingUserId)` — tontine, synchronise les participants avec `tontine_membres`.
- `getOrCreateCercleUplineConversation(svc, kingmakerId)` — palier 1, aucune ligne participant créée (appartenance calculée en lecture).
- `acceptInvitation(svc, invitationId, requestingUserId)` — palier 2, crée la conversation + les deux participants à l'acceptation. Idempotent (double-clic), vérifie strictement que `requestingUserId` est bien le destinataire et que l'invitation est encore `en_attente`.

## Routes API

| Route | Méthodes | Rôle |
|---|---|---|
| `app/api/messages/[conversationId]/route.ts` | GET, POST | Liste paginée + marquage lu, envoi de message — générique pour les 4 portées |
| `app/api/messages/conversations/order/[transactionId]/route.ts` | POST | Ouvre/crée le fil marchand↔client d'une commande |
| `app/api/messages/conversations/tontine/[tontineId]/route.ts` | POST | Ouvre/crée le fil de groupe d'une tontine |
| `app/api/messages/conversations/cercle-upline/route.ts` | POST | Ouvre/crée le cercle upline (gate achat seul) |
| `app/api/messages/search/route.ts` | GET | Recherche exacte palier2 (téléphone, code parrainage, nom) — gate achat+KYC, **numéro jamais renvoyé** |
| `app/api/messages/invitations/route.ts` | GET, POST | Liste mes invitations (envoyées+reçues) / crée une invitation (RLS pure) |
| `app/api/messages/invitations/[id]/route.ts` | PATCH | Accepter (service_role) ou refuser (RLS) une invitation |

## Composants `components/messaging/`

- **`ConversationThread.tsx`** — fil de discussion générique réutilisable pour les 4 portées, Realtime via `supabase.channel().on('postgres_changes', ...)`.
- **`ContactButton.tsx`** — bouton « Contacter » qui résout/crée la conversation marchand↔client liée à une commande.
- **`CercleUplineCard.tsx`** — point d'entrée palier 1, carte dégradé indigo.
- **`Palier2Messaging.tsx`** — recherche exacte (debounce 400ms) + invitations reçues/historique pour le palier 2.

## Intégration UI

| Page | Intégration |
|---|---|
| `app/(consumer)/network/page.tsx` | `CercleUplineCard` + `Palier2Messaging` (affiché seulement si `kyc_level >= 1` et au moins un achat complété) |
| `app/(consumer)/tontine/page.tsx` | Bouton « 💬 Discussion du groupe » dans la fiche détail d'une tontine |
| `app/merchant/history/page.tsx` | `ContactButton` (« Contacter le client ») |
| `app/(consumer)/mes-achats/MesAchatsClient.tsx` | `ContactButton` |
| `app/messages/[conversationId]/page.tsx` | Page de fil unique, hors groupes `(consumer)`/`merchant` — résout le titre et le `backHref` selon le `type`, rend `ConversationThread` |

## Sécurité — points clés

- **RLS comme seule autorisation** sur conversations/messages (`is_conversation_member()`), pas de double logique côté API.
- **Palier 2** : jamais de message ouvert sans invitation acceptée ; recherche en correspondance exacte uniquement (jamais de liste partielle/autocomplétion) ; numéro de téléphone jamais affiché dans les résultats — anti-fraude dès la conception.
- **`conversation_participants`** n'a aucune policy INSERT pour `authenticated` → l'acceptation d'invitation passe obligatoirement par `service_role` (`acceptInvitation`).
- **Marchand↔client** : volontairement **aucun verrou KYC** — choix confirmé, relation déjà établie par la commande.

## Système chatbot (séparé, lié)

- `app/api/chat/route.ts` — endpoint unique multi-rôles, rôle déterminé par contexte (page/onboarding/secteur), pas de routage en dur.
- `lib/chat/core.ts` (`getChatReply()`) — logique partagée entre le widget in-app et le webhook WhatsApp (`app/api/chat/whatsapp/route.ts`, Wasender).
- Garde-fou non négociable : aucune action irréversible déclenchée par le bot (retrait, reset PIN, validation KYC) — reste derrière les endpoints admin existants.

## Structure des fichiers créés/modifiés

```
supabase/migrations/
  057_messaging.sql                                    ← conversations/participants/messages/invitations/reports + RLS

lib/messaging/
  conversations.ts                                      ← 4 helpers service_role

app/api/messages/
  [conversationId]/route.ts                             ← GET/POST messages
  conversations/order/[transactionId]/route.ts           ← POST marchand_client
  conversations/tontine/[tontineId]/route.ts              ← POST tontine
  conversations/cercle-upline/route.ts                    ← POST palier 1
  search/route.ts                                         ← GET recherche palier 2
  invitations/route.ts                                    ← GET/POST invitations
  invitations/[id]/route.ts                               ← PATCH accept/refuse

components/messaging/
  ConversationThread.tsx                                  ← fil générique Realtime
  ContactButton.tsx                                       ← entrée marchand↔client
  CercleUplineCard.tsx                                    ← entrée palier 1
  Palier2Messaging.tsx                                    ← recherche + invitations palier 2

app/messages/[conversationId]/page.tsx                    ← vue de fil unique (4 types)
app/(consumer)/network/page.tsx                           ← intègre palier 1 + palier 2
app/(consumer)/tontine/page.tsx                           ← bouton discussion tontine
```

## Statut

Les 4 portées sont terminées et câblées (tâches #146–#150, complétées). Aucune action de suivi identifiée — si une nouvelle portée ou règle de gate est demandée plus tard, partir de ce document plutôt que de re-creuser l'architecture depuis zéro.
