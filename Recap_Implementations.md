# GreenFlame — Récapitulatif des Implémentations

> Dernière mise à jour : 5 juillet 2026  
> Ce fichier liste toutes les fonctionnalités et corrections implémentées dans le codebase GreenFlame par session de travail.

---

## Session — Gouvernance & Finances (corrections #276–278)

### Constantes de gouvernance
- **`lib/commission-engine/constants.ts`** — `CASHBACK_SHARE` : 15 % → **12 %**, ajout `REWARDS_FUND_SHARE: 0.03`, `validateGovernanceConstants()` mis à jour
- **`supabase/functions/_shared/governance.ts`** — synchronisé avec les mêmes valeurs (dual-file pattern)
- **`lib/commission-engine/types.ts`** — `distributionType` inclut `'rewards_fund'`, `CommissionResult` inclut `rewardsFundAmount`

### Moteur de calcul
- **`lib/commission-engine/calculate.ts`** — `rewardsFundAmount` calculé (3 % de la commission marchande), allocation au level 8
- **`lib/commission-engine/distribute.ts`** — crédite `rewards_fund_ledger` avant la boucle wallet

### Migration SQL
- **`supabase/migrations/063_rewards_fund_career.sql`**
  - Table `rewards_fund_ledger` (accumulation 3 % / transaction)
  - Table `rewards_fund_distributions` (sorties récompenses / événements)
  - Vue `rewards_fund_summary` (solde global, split 30 % récompenses / 70 % événements)
  - Table `leader_career_ranks` (rangs actuels des Leaders)
  - Table `leader_career_history` (historique des passages de rang)
  - RLS complet sur toutes les tables

---

## Session — Fonctionnalités UI (corrections #279–286)

### #279 — Admin : Panneau Fonds Récompenses/Événements
- **`messages/fr.json`** — clé `admin.nav.rewardsFund: "🎁 Fonds Récomp."`
- **`messages/en.json`** — clé `admin.nav.rewardsFund: "🎁 Rewards Fund"`
- **`app/admin/layout.tsx`** — lien `/admin/rewards-fund` ajouté dans `NAV_LINKS`
- **`app/admin/rewards-fund/page.tsx`** — CRÉÉ (client component)
  - 4 KPI cards : Solde global, Pool Récompenses 30 %, Pool Événements 70 %, Nb transactions
  - 3 onglets : Aperçu / Crédits reçus / Distributions
  - Formulaire de distribution (pool_type, montant, bénéficiaire, description)

### #280–281 — Plan de Carrière Leader (engine)
- **`lib/career/engine.ts`** — CRÉÉ
  - Constante `CAREER_RANKS` : 8 rangs (R0 Visiteur → R8 Elder)
  - `getCareerRankState(userId)` : lecture Supabase du rang actuel + historique
  - `checkEligibility(state)` : triple verrou (structure réseau / volume moyen / marchands actifs)
  - `updateCareerMetrics(userId)` : recalcul et mise à jour automatique du rang
- **`app/api/career/route.ts`** — CRÉÉ (GET — intermédiaire serveur pour le widget client)

### #282 — Plan de Carrière dans le Profil
- **`components/consumer/CareerPlanWidget.tsx`** — CRÉÉ (client component)
  - Badge rang actuel avec couleur dynamique
  - 3 `VerrouRow` (structure / volume / marchands) avec barres de progression
  - Accordéon historique des rangs
  - Skeleton loading
  - Fix mobile : `min-w-0 shrink truncate flex-shrink-0` sur les labels
- **`app/(consumer)/profile/page.tsx`** — `<CareerPlanWidget />` ajouté après `<FlammeWidget />`

### #283 — Page FAQ dédiée + Support refactorisé
- **`lib/faq/content.ts`** — CRÉÉ (source unique de vérité FAQ)
  - `FAQ_GROUPS` : 8 catégories consommateur
  - `MERCHANT_FAQ_GROUPS` : 3 catégories marchands (12 % corrigé)
- **`components/consumer/FaqAccordion.tsx`** — CRÉÉ (accordéon client réutilisable, `isMerchant` prop)
- **`app/(consumer)/faq/page.tsx`** — CRÉÉ (page serveur avec auth + rôle marchand)
- **`components/consumer/ProfileSettings.tsx`** — Section Support remplacée par 2 boutons côte à côte :
  - 💬 WhatsApp (fond vert)
  - 📋 FAQ → `/faq` (fond brand)
  - Suppression de l'accordéon inline (~200 lignes éliminées)

### #284 — Repositionnement bouton chatbot
- **`components/ChatWidget.tsx`** — bouton et panneau déplacés :
  - Avant : `fixed bottom-20 left-4` / panneau `fixed bottom-36 left-4`
  - Après : **bouton `fixed bottom-44 right-4`** / **panneau `fixed bottom-60 right-4`**
  - Aligné à droite, au-dessus du bouton commande vocale (`fixed bottom-28 right-4`)

### #285 — Design mobile — zéro chevauchement
- **`app/(consumer)/profile/page.tsx`** — carte identité :
  - `flex items-center gap-3 min-w-0` sur le conteneur
  - `min-w-0 flex-1` sur la div texte
  - `text-base truncate` sur le nom
  - `truncate` sur memberSince
  - `whitespace-nowrap` sur les badges rôle
- **`app/(consumer)/dashboard/page.tsx`** — labels barre de progression niveau :
  - `flex flex-wrap justify-between gap-x-2` + `shrink-0` sur les spans
- Base mobile déjà en place dans `globals.css` : `overflow-x: clip` sur body, `min-width: 0` sur tous les éléments

### #286 — Vérification finale & cohérence chatbot
- **`lib/chat/core.ts`** — corrigé 15 % → **12 %** dans les prompts système FR et EN
  - Ajout de la note sur le Fonds Récompenses/Événements (3 % supplémentaires)
- **`lib/faq/content.ts`** — vérifié : aucune mention de 15 % (12 % correct partout)
- Admin nav : lien `/admin/rewards-fund` confirmé présent

---

## Sessions antérieures — Références rapides

| Fonctionnalité | Fichiers clés |
|---|---|
| Système Flamme + Rang | `lib/flamme/engine.ts`, `app/api/flamme/`, migration 050 |
| Cagnotte Communautaire | `lib/cagnotte/engine.ts`, `app/api/cagnotte/`, migration 051 |
| Pack Mystère | `lib/pack-mystere/engine.ts`, `app/api/pack-mystere/`, migration 052 |
| Chatbot multi-rôles | `lib/chat/core.ts`, `app/api/chat/route.ts`, `components/ChatWidget.tsx` |
| WhatsApp webhook | `app/api/chat/whatsapp/route.ts` (Wasender) |
| Messagerie in-app | migrations conversations/participants/messages, `app/(consumer)/messages/` |
| Tontine + invitations | migration 238, `app/api/tontines/`, `app/(consumer)/tontine/` |
| Plan de carrière (doc) | `greenflame-career-plan.html` |
| Modules sectoriels | Coiffure, Couture, Restauration, BTP — migrations + API + UI |
| Commission engine | `lib/commission-engine/` (constants, types, calculate, distribute) |
| Plafonds retrait KYC | `lib/constants/withdrawal.ts`, migration 188 |
| Documents (devis/factures) | `lib/documents/`, persistance Supabase, migrations 083–086 |
| Admin marketplace | `app/admin/marketplace/`, migration 027–028 |
| Réconciliation float | `app/admin/reconciliation/` |

---

## Architecture — Rappels gouvernance

```
Commission marchande (ex : 1 000 FCFA)
  └─ 45 % → Platform                 (450 FCFA)
  └─ 40 % → Network pool (uplines)   (400 FCFA)
  └─ 12 % → Cashback acheteur        (120 FCFA)
  └─  3 % → Fonds Récompenses/Événements (30 FCFA)
             ├─ 30 % → Pool Récompenses  (9 FCFA)
             └─ 70 % → Pool Événements   (21 FCFA)
```

**Commissions uplines** : paliers C-3 / C-5 / C-10 / C-15 (jamais "10 % flat")  
**Cashback** : ≥ 50 FCFA → crédité en FCFA | < 50 FCFA → crédité en GFP  
**Plan de carrière** : R0 Visiteur → R1 Recrue → R2 Associé → R3 Capitaine → R4 Directeur → R5 Champion → R6 Légende → R7 Kingmaker → R8 Elder

---

## Fichiers à ne pas modifier sans coordination

- `lib/commission-engine/constants.ts` + `supabase/functions/_shared/governance.ts` → **toujours modifier en parallèle**
- `lib/chat/core.ts` → contient les prompts système FR + EN du chatbot, toute donnée business doit y être à jour
- `lib/faq/content.ts` → source unique FAQ, ne pas dupliquer dans les composants
- `supabase/migrations/` → ne jamais modifier une migration existante, toujours créer une nouvelle
