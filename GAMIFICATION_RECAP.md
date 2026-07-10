# 🔥 Implémentation Gamification GreenFlame — Récap

**Date** : 15 juin 2026  
**Systèmes** : Flamme + Rang · Cagnotte Communautaire · Pack Mystère

---

## Migrations SQL (à appliquer dans Supabase)

```
supabase/migrations/050_flamme_rang.sql
supabase/migrations/051_cagnotte_communautaire.sql
supabase/migrations/052_pack_mystere.sql
```

**Ordre d'exécution** : 050 → 051 → 052 (dépendances dans cet ordre)

### Tables créées

| Table | Système | Description |
|-------|---------|-------------|
| `user_flammes` | Flamme | Agrégat courant FA / FAU / score / rang par user |
| `flamme_events` | Flamme | Journal immuable de chaque flamme attribuée |
| `rang_history` | Flamme | Historique des changements de rang (promotions + descentes) |
| `fau_milestones_granted` | Flamme | Déduplication des FAU one-shot par palier de vie |
| `community_pot` | Cagnotte | Singleton balance cagnotte (ligne UUID fixe initialisée) |
| `pot_contributions` | Cagnotte | 50 F retenus par membre par mois (unique user_id+period) |
| `pot_draws` | Cagnotte | Chaque tirage admin |
| `pot_winners` | Cagnotte | Gagnant + date re-éligibilité (+6 mois) |
| `pot_consolations` | Cagnotte | Cadeau digital pour les non-gagnants |
| `pack_catalog` | Pack | 3 tiers Bronze/Argent/Or (seeded) |
| `pack_item_catalog` | Pack | 16 items sur 4 raretés (seeded) |
| `mystery_pack_purchases` | Pack | Achat + boost ×2 actif |
| `mystery_pack_items` | Pack | Items révélés par achat |
| `merchant_bons` | Pack | Bons marchands dans le pool de tirage |

### Vues créées

- `flamme_community_stats` — compteurs par rang (public)
- `flamme_rang_summary` — vue admin détaillée
- `pot_eligible_members` — membres éligibles au prochain tirage
- `community_pot_public` — balance cagnotte pour affichage consumer

---

## Moteurs TypeScript

### `lib/flamme/engine.ts`

```
Score = flammes_activite + (flammes_autonomie × 0.5)
```

**Rangs** :
| Rang | Score min | Gate objectifs de vie |
|------|-----------|----------------------|
| Étincelle ✨ | 0 | — |
| Flamme 🔥 | 50 | — |
| Brasier 🌋 | 150 | ≥ 1 objectif couvert |
| Étoile ⭐ | 350 | ≥ 3 objectifs couverts |
| Soleil ☀️ | 700 | Autonomie totale (258 500 F/mois) |

**FAU milestones** (one-shot, permanents) :
| Palier | Cible mensuelle | FAU accordés |
|--------|-----------------|--------------|
| 1 | 10 000 F | +10 |
| 2 | 15 000 F | +20 |
| 3 | 20 000 F | +30 |
| 4 | 23 500 F | +40 |
| 5 | 30 000 F | +50 |
| 6 | 40 000 F | +60 |
| 7 | 50 000 F | +70 |
| 8 | 70 000 F | +80 |
| 9 | 258 500 F | +100 |
| **Total** | | **460 FAU = 230 pts score** |

**Règle inactivité** : 60 jours sans transaction ET sans connexion → descente 1 rang (FAU intacts)

**Fonctions exportées** :
- `recordFlammeEvent(input)` — enregistre un FA ou FAU + met à jour user_flammes + rang
- `updateLifeGoals(userId, monthlyIncomeFcfa)` — détecte les nouveaux paliers FAU franchis
- `recordConnection(userId)` — mise à jour last_connection_at
- `applyInactivityCheck(userId)` — appelé par cron quotidien
- `getFlammeState(userId)` — lecture état courant (initialise si absent)
- `getCommunityStats()` — compteurs Étoile/Soleil pour affichage public

---

### `lib/cagnotte/engine.ts`

- `getPotState()` — balance + stats globales
- `retainMonthlyContribution(userId, period, cashbackDistId?)` — idempotent, 50 F/mois
- `triggerDraw(triggeredBy, amountFcfa?)` — tirage aléatoire, consolations auto
- `getUserConsolations(userId)` — cadeaux non livrés
- `deliverConsolation(consolationId)` — marquer livré
- `getUserEligibility(userId)` — contributedThisMonth + blockedUntil

**Consolations disponibles** :
`academie_module_unlock` · `pack_mystere_bronze` · `boost_cashback_7d` · `fa_bonus_5` · `gfp_bonus_100`

---

### `lib/pack-mystere/engine.ts`

**Poids de rareté** :
| Rareté | Poids | Tiers accessibles |
|--------|-------|-------------------|
| Commun | 60 | Bronze, Argent, Or |
| Rare | 25 | Bronze, Argent, Or |
| Épique | 12 | Argent, Or |
| Légendaire | 3 | Or uniquement |

- `purchasePack(userId, tier)` — débit wallet + FA garantis + tirage item + boost
- `getActiveBoost(userId)` — vérifie boost actif avant calcul cashback
- `consumeBoost(purchaseId, txId)` — marque boost consommé après transaction
- `getPackHistory(userId)` — historique des achats

---

## API Routes

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/flamme` | GET | État Flamme+Rang + historique + milestones FAU |
| `/api/flamme` | POST | Enregistre un événement FA/FAU |
| `/api/flamme/events` | GET | Journal des événements (paginé) |
| `/api/cagnotte` | GET | État pot + éligibilité + consolations |
| `/api/cagnotte/draw` | POST | Déclenche un tirage (admin only) |
| `/api/pack-mystere` | GET | Catalogue + historique + boost actif |
| `/api/pack-mystere/acheter` | POST | Achète un pack `{ tier }` |

---

## UI Consumer

### `components/consumer/FlammeWidget.tsx`
Intégré dans le dashboard **après** la section Objectifs de vie.
- Badge rang + score
- Barre de progression vers le rang suivant
- Gate spéciale si objectifs de vie requis
- 9 pastilles FAU (doré = acquis, gris = verrouillé)
- Compteur Étoile/Soleil de la communauté
- CTA vers `/pack-mystere`

### `components/consumer/CagnotteWidget.tsx`
Intégré dans le dashboard **après** `FlammeWidget`.
- Balance en temps réel
- Nombre de contributeurs actifs
- Indicateur éligibilité
- Consolations non livrées

### `app/(consumer)/pack-mystere/page.tsx` + `PackMystereClient.tsx`
- Catalogue 3 tiers avec prix, FA garantis, raretés disponibles
- Animation de révélation
- Affichage item avec rareté colorée
- Code bon marchand si applicable

---

## Hooks sur actions existantes

### `supabase/functions/process-transaction/index.ts` (Deno)
Après `status = 'completed'` :
- `+1 FA` acheteur (fa_purchase)
- `+1 FA` par kingmaker ayant reçu une commission réseau (fa_network_commission)
- Inline Supabase — non bloquant (try/catch)

### `app/api/academie/progress/route.ts`
Après `quiz_score ≥ 3` ET première certification :
- `+2 FA` (fa_academie_module)
- Anti-doublon : vérifie `${module}_cert_at` existant

### `app/api/tontines/[id]/cotisations/route.ts`
Quand cotisation `status = 'paye'` ou `'partiel'` :
- `+1 FA` au membre tontine si `user_id` présent (fa_tontine_cotisation)

---

## Page Admin

### `app/admin/flamme/page.tsx` + `AdminFlammeClient.tsx`
Accessible via `/admin/flamme` (lien ajouté dans le dashboard admin).

**3 onglets** :
1. **Vue d'ensemble** — distribution des rangs en barres + highlight Étoile/Soleil
2. **Cagnotte & Tirage** — balance, bouton tirage avec montant optionnel, historique gains
3. **Top membres** — classement score Flamme avec rang + FA + FAU + objectifs

---

## Points d'attention pour la mise en production

### 1. Cron inactivité (à créer)
```
POST /api/cron/flamme-inactivity
→ parcourt user_flammes où dernière activité > 60j
→ appelle applyInactivityCheck(userId) pour chacun
```
Planifier quotidiennement via n8n ou Supabase pg_cron.

### 2. Hook cashback mensuel → Cagnotte
Quand le cron mensuel distribue les cashbacks, appeler :
```typescript
import { retainMonthlyContribution } from '@/lib/cagnotte/engine'
await retainMonthlyContribution(userId, 'YYYY-MM', cashbackDistId)
```

### 3. Hook cashback mensuel → FAU life goals
Après distribution cashback, appeler :
```typescript
import { updateLifeGoals } from '@/lib/flamme/engine'
await updateLifeGoals(userId, monthlyIncomeFcfa)
```

### 4. Boost Pack Mystère dans le calcul cashback
Dans la transaction, avant de calculer le cashback :
```typescript
import { getActiveBoost, consumeBoost } from '@/lib/pack-mystere/engine'
const boost = await getActiveBoost(buyerId)
const finalCashback = Math.floor(cashbackAmount * boost.multiplier)
if (boost.hasBoost) await consumeBoost(boost.purchaseId!, transaction.id)
```

### 5. Célébration Étoile/Soleil
Dans `recordFlammeEvent`, quand `celebrationRequired = true` :
- Envoyer notification WhatsApp/push à l'utilisateur
- Logger dans `rang_history.celebrated = true`
- Poster dans le feed communautaire (à créer)

---

## Structure des fichiers créés

```
supabase/migrations/
  050_flamme_rang.sql
  051_cagnotte_communautaire.sql
  052_pack_mystere.sql

lib/
  flamme/
    engine.ts
  cagnotte/
    engine.ts
  pack-mystere/
    engine.ts

app/api/
  flamme/
    route.ts
    events/route.ts
  cagnotte/
    route.ts
    draw/route.ts
  pack-mystere/
    route.ts
    acheter/route.ts

app/(consumer)/
  dashboard/page.tsx         ← FlammeWidget + CagnotteWidget intégrés
  pack-mystere/
    page.tsx
    PackMystereClient.tsx

app/admin/
  flamme/
    page.tsx
    AdminFlammeClient.tsx
  dashboard/page.tsx         ← lien /admin/flamme ajouté

components/consumer/
  FlammeWidget.tsx
  CagnotteWidget.tsx

supabase/functions/
  process-transaction/index.ts   ← hook FA achat + réseau

app/api/
  academie/progress/route.ts     ← hook FA certification
  tontines/[id]/cotisations/route.ts  ← hook FA cotisation
```
