# 🔥 Engagement réel sans promesse — Récap

**Date** : 20 juin 2026
**Chantiers** : Messages système (preuve sociale) · Alerte inactivité Flamme · Nudges IA proactifs

---

## Principe directeur

Trois mécaniques décidées le 20 juin 2026, toutes ancrées sur de l'infrastructure **déjà existante et déjà active** :

- **Pas de chasse externe.** GreenFlame est déjà une communauté de personnes réelles, reliées entre elles (réseau `upline_id`, cercles, tontines). On s'appuie sur ce graphe social réel, pas sur un mécanisme de type indices/influenceurs externes.
- **Aucune promesse.** Chaque message (système ou WhatsApp) décrit un fait déjà acté — un rang déjà atteint, un gain déjà reçu, un solde déjà acquis, un risque réel déjà mesuré. Rien n'annonce un gain futur hypothétique.
- **Non bloquant.** Toute annonce ou notification est encapsulée en try/catch silencieux : un échec d'annonce ne doit jamais faire échouer l'événement métier qui la déclenche.

---

## Migration SQL à appliquer

```
supabase/migrations/059_engagement_system_messages.sql
```

### Changements

| Table | Changement | Raison |
|-------|-----------|--------|
| `messages` | `sender_id` devient nullable | Les messages système n'ont pas d'expéditeur humain |
| `messages` | + colonne `message_type` (`'user'` \| `'system'`) | Distingue message humain / événement métier auto-posté |
| `messages` | + contrainte `messages_sender_type_consistency` | `user` ⟺ `sender_id` requis, `system` ⟺ `sender_id` NULL |
| `user_flammes` | + colonne `last_inactivity_warning_at` | Throttle de l'alerte WhatsApp pré-rupture (1 envoi par fenêtre d'inactivité) |

Aucune nouvelle policy RLS requise pour les écritures `service_role` (bypass RLS au niveau du rôle Postgres — déjà vérifié sur `conversation_participants`/`conversations`).

---

## 1. Messages système — preuve sociale (#160)

### `lib/messaging/conversations.ts` — fondations réutilisables

- `postSystemMessage(svc, conversationId, content)` — insère un message `message_type: 'system'`, `sender_id: null`
- `resolveOwnCircleId(svc, userId)` — résout le cercle propre (`upline_id ?? userId`)
- `announceInOwnCircle(svc, userId, content)` — résout le cercle + poste le message, silencieux en cas d'échec

### Hooks branchés

| Événement | Fichier | Déclencheur | Contenu de l'annonce |
|-----------|---------|-------------|----------------------|
| Promotion de rang | `lib/flamme/engine.ts` → `recordFlammeEvent()` | Montée de rang (pas les descentes) | `🔥 {Nom} vient de passer au rang {emoji} {Label} !` |
| Gain Cagnotte | `lib/cagnotte/engine.ts` → `triggerDraw()` | Tirage gagné | `🎉 {Nom} a remporté {montant} FCFA au tirage de la Cagnotte Communautaire !` |
| Pot de tontine reçu | `app/api/tontines/[id]/membres/[membreId]/route.ts` (PATCH) | Transition `has_received_pot` false→true | `🤝 {Nom} a reçu le pot de ce tour dans la tontine « {nom} » !` |

L'annonce part toujours dans le **cercle propre du bénéficiaire** (pas un fil global) — la Cagnotte est une cagnotte unique globale, mais le gagnant est annoncé uniquement à son entourage direct.

### UI — bulle système

`components/messaging/ConversationThread.tsx` — les messages `message_type === 'system'` s'affichent en bulle centrée ambre, distincte des bulles de conversation normales.

---

## 2. Alerte inactivité Flamme (#156)

Le cliff d'inactivité (60 jours sans FA ni connexion → descente d'un rang) existait déjà silencieusement (`applyInactivityCheck`, cron pg_cron migration 053). Ce qui manquait : le rendre **visible** avant qu'il ne tombe.

### `lib/flamme/engine.ts` — `getInactivityStatus()`

Fonction pure (pas d'appel réseau), réutilisée à la fois côté UI et côté cron :

```typescript
interface InactivityStatus {
  daysSinceActive: number | null
  daysUntilDemotion: number | null
  isAtRisk: boolean
  inWarningWindow: boolean   // true entre 45 et 59 jours d'inactivité
}
```

- `isAtRisk = false` si déjà au rang le plus bas (rien à perdre) ou aucune activité jamais enregistrée
- `inWarningWindow` : fenêtre volontairement courte (15 jours avant le cliff) — signal ponctuel, pas une pression permanente

### Exposition

- `app/api/flamme/route.ts` (GET) — ajoute `inactivityStatus` à la réponse
- `components/consumer/FlammeWidget.tsx` — bandeau rouge visible si `inWarningWindow`, affiche le nombre de jours restants et le rang en jeu

### Alerte WhatsApp

- `lib/whatsapp/wasender.ts` → `waFlammeInactivityWarning()` — template factuel : « ton rang redescendra dans X jours sans nouvelle activité »
- `app/api/internal/flamme-inactivity-warning/route.ts` (nouvelle route cron) — parcourt `user_flammes`, sélectionne les profils en fenêtre d'alerte, envoie le WhatsApp, marque `last_inactivity_warning_at` pour ne pas répéter l'envoi tant que l'utilisateur reste dans la même fenêtre d'inactivité

---

## 3. Nudges IA proactifs (#158)

Le moteur de scoring comportemental (`user_ai_profile`, migration 029) calculait déjà un `dominant_trigger` par utilisateur (appartenance, statut, sécurité, FOMO, identité, certitude, autonomie) mais ne déclenchait jamais rien. Cette route ferme la boucle.

### `lib/whatsapp/wasender.ts` — 7 templates, un par trigger

| Trigger | Fonction | Fait rapporté (jamais une promesse) |
|---------|----------|--------------------------------------|
| Appartenance | `waNudgeBelonging` | Taille du réseau déjà construit + filleuls directs |
| Statut | `waNudgeStatus` | Rang déjà atteint |
| Sécurité | `waNudgeSecurity` | Solde wallet + total déjà gagné en cashback/commissions |
| FOMO | `waNudgeFomo` | Activité réelle et actuelle dans son propre cercle (pas un compte à rebours fictif) |
| Identité | `waNudgeIdentity` | Impact communautaire réel généré par ses parrainages (narratif Ubuntu) |
| Certitude | `waNudgeCertainty` | Rang + solde — un point de situation clair, sans ambiguïté |
| Autonomie | `waNudgeAutonomy` | Contrôle total et déjà acquis sur son solde |

### `app/api/internal/send-ai-nudges/route.ts` (nouvelle route cron)

Sélection des destinataires :
1. `dominant_trigger != 'unknown'` (signal exploitable)
2. Score actionnable : `churn_score ≥ 0.4` OU `recruitment_score ≥ 0.5` OU `spend_potential_score ≥ 0.6`
3. `message_fatigue_score < 0.7` (pas déjà saturé de messages ignorés)
4. `last_message_sent` absent ou vieux de plus de **4 jours** (`NUDGE_THROTTLE_DAYS`)

Pour chaque utilisateur éligible : récupère solde wallet + rang réel (batch sur `wallets` et `user_flammes`), construit le message selon `dominant_trigger`, envoie via `sendWhatsApp`, puis met à jour `last_message_sent` / `last_message_trigger` (consommé ensuite par `compute-ai-profiles` pour recalculer la fatigue).

Aucune nouvelle migration nécessaire — les colonnes de throttling existaient déjà sur `user_ai_profile` depuis la migration 029, simplement jamais utilisées.

---

## Crons (`vercel.json`)

```jsonc
{
  "crons": [
    { "path": "/api/cron/daily-digest",                  "schedule": "0 7 * * *" },
    { "path": "/api/internal/expiring-subscriptions?days=7", "schedule": "0 8 * * *" },
    { "path": "/api/internal/expiring-subscriptions?days=3", "schedule": "0 8 * * *" },
    { "path": "/api/internal/expiring-subscriptions?days=1", "schedule": "0 8 * * *" },
    { "path": "/api/internal/compute-ai-profiles",        "schedule": "0 2 * * *" },  // calcule les scores/triggers
    { "path": "/api/internal/flamme-inactivity-warning",  "schedule": "0 9 * * *" },  // alerte cliff Flamme
    { "path": "/api/internal/send-ai-nudges",             "schedule": "0 10 * * *" }  // nudges IA
  ]
}
```

Échelonnement volontaire : les scores IA sont recalculés la nuit (2h), puis l'alerte Flamme part à 9h, puis les nudges IA à 10h — chaque étape dispose des données fraîches de la précédente.

---

## Structure des fichiers créés / modifiés

```
supabase/migrations/
  059_engagement_system_messages.sql          ← nouveau

lib/
  messaging/conversations.ts                  ← + postSystemMessage, resolveOwnCircleId, announceInOwnCircle
  flamme/engine.ts                             ← + getInactivityStatus(), hook annonce promotion
  cagnotte/engine.ts                           ← + hook annonce gain
  whatsapp/wasender.ts                         ← + waFlammeInactivityWarning, + 7 templates waNudge*

app/api/
  flamme/route.ts                              ← + inactivityStatus dans la réponse GET
  tontines/[id]/membres/[membreId]/route.ts    ← + hook annonce pot reçu
  messages/[conversationId]/route.ts           ← + message_type dans le SELECT
  internal/
    flamme-inactivity-warning/route.ts         ← nouveau (cron)
    send-ai-nudges/route.ts                    ← nouveau (cron)

components/
  messaging/ConversationThread.tsx             ← + rendu bulle système
  consumer/FlammeWidget.tsx                    ← + bandeau alerte inactivité

vercel.json                                    ← + 2 nouveaux crons
```

---

## Points d'attention pour la mise en production

1. **Appliquer la migration 059** avant déploiement (sinon `message_type`/`last_inactivity_warning_at` n'existent pas en base).
2. **`CRON_SECRET`** doit être configuré dans Vercel (déjà utilisé par `compute-ai-profiles` — les deux nouvelles routes réutilisent la même variable).
3. **Vérifier le volume d'envoi WhatsApp** : `send-ai-nudges` est plafonné à 200 utilisateurs par exécution (paramètre `?limit=`, max 500) pour éviter de saturer le quota Wasender un même jour.
4. **Tester en `x-internal-secret` manuel** avant d'attendre le premier déclenchement cron, pour valider sur un petit échantillon réel que les messages générés sont corrects (noms, montants, rangs).
