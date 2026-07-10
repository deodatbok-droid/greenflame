# GreenFlame — Intégration USSD & Canal Offline

> Généré le 27 mai 2026  
> Session : Architecture USSD, redistribution automatique, canal sans internet

---

## Résumé exécutif

GreenFlame dispose désormais de **deux canaux de transaction parallèles** qui partagent exactement le même moteur de paiement et le même système de redistribution :

| Canal | Prérequis utilisateur | Fonctionne sans internet |
|-------|-----------------------|--------------------------|
| Web / App | Smartphone + connexion | ✗ |
| USSD (`*XXX#`) | N'importe quel téléphone | ✓ |

La redistribution L1→L5 est **100% automatique** sur les deux canaux — même Edge Function, même audit trail, même wallet.

---

## Ce qui a été découvert : la redistribution était déjà complète

L'Edge Function `supabase/functions/process-transaction/index.ts` implémente déjà intégralement :

### Flux atomique par transaction
```
Acheteur paie X FCFA
  │
  ├─ 45% → GreenFlame platform (commission_distributions level 0)
  ├─ 12% → Wallet acheteur (cashback FCFA ou PGF si < 50 FCFA)
  ├─ 3%  → Pool Récompenses/Événements (rewards_fund_ledger)
  └─ 40% → Communauté
       ├─ L1 (parrain direct) : 12% si actif, sinon → spillover_fund
       ├─ L2 : 10%
       ├─ L3 : 8%
       ├─ L4 : 6%
       └─ L5 : 4%
```

### Règles de gouvernance (governance.ts — immuables)
```ts
PLATFORM_SHARE:      0.45   // 45%
CASHBACK_SHARE:      0.12   // 12%
REWARDS_FUND_SHARE:  0.03   // 3% — Pool Récompenses/Événements
NETWORK_POOL_SHARE:  0.40   // 40% — L1+L2+L3+L4+L5
NETWORK_LEVELS: { L1: 0.12, L2: 0.10, L3: 0.08, L4: 0.06, L5: 0.04 }
INACTIVITY_SPILLOVER_DAYS: 90  // upline inactif > 90j → spillover
PGF_CASH_MIN_THRESHOLD: 50     // cashback < 50 FCFA → crédité en PGF
```

### Automatismes déjà en place
- **Idempotence** : clé unique par transaction, impossible de doubler
- **Auto-affiliation** : premier achat d'un utilisateur sans parrain → rattaché automatiquement au marchand comme L1
- **Spillover** : commissions des uplines inactifs vont dans `spillover_fund` (réinvestissable)
- **Wallet ledger** : chaque mouvement de wallet inscrit dans `wallet_ledger` (append-only, immuable)
- **network_tree** : reconstruit automatiquement via trigger PostgreSQL à chaque enrôlement

---

## Nouveaux fichiers créés

### 1. `supabase/migrations/014_ussd_support.sql`

**⚠️ À appliquer manuellement dans Supabase → SQL Editor → New Query**

Ce que fait la migration :

#### Colonne `merchants.short_code`
- Code à 5 chiffres unique (ex: `84521`) attribué à chaque marchand
- Auto-généré à la création via trigger `merchant_assign_short_code`
- **Backfill immédiat** : tous les marchands existants reçoivent un code dès l'exécution
- Index unique pour lookup instantané pendant une session USSD

```sql
-- Vérifier après exécution
SELECT business_name, short_code FROM merchants ORDER BY created_at;
```

#### Colonnes `users.pin_attempts` + `users.pin_locked_until`
Anti-brute-force : après 3 PIN incorrects → compte bloqué 24h + SMS d'alerte automatique.

> La colonne `transaction_pin` (VARCHAR) existait déjà via `add_transaction_pin.sql`.  
> Le hachage scrypt est géré par `lib/utils/pin.ts` (fonctions `hashPin` / `verifyPin`).

#### Table `ussd_sessions`
- Stocke l'état de chaque session USSD active (TTL 3 minutes)
- Sert au rate-limiting et au débogage
- Nettoyable via `SELECT cleanup_expired_ussd_sessions()`
- RLS activée : accessible uniquement via service_role (jamais depuis le client web)

#### Table `ussd_transaction_log`
Audit complet de toutes les opérations USSD : action, statut, montant, marchand, transaction_id, erreur éventuelle.

---

### 2. `lib/ussd/africastalking.ts`

Client Africa's Talking — deux responsabilités :

#### Helpers USSD
```ts
ussdCon(text)  // → "CON texte" : continue la session, affiche un menu
ussdEnd(text)  // → "END texte" : ferme la session, message final
```

#### Envoi SMS (`sendSms`)
- Non-bloquant : une erreur SMS ne fait **jamais** échouer une transaction
- Détecte automatiquement sandbox vs production via `AT_USERNAME`
- Masque les 4 derniers chiffres du numéro acheteur dans le SMS marchand

#### Templates SMS prêts
| Template | Destinataire | Déclencheur |
|----------|-------------|-------------|
| `smsPaiementAcheteur` | Acheteur | Paiement réussi |
| `smsPaiementMarchand` | Marchand | Paiement réussi |
| `smsPinDefini` | Utilisateur | PIN créé/modifié |
| `smsPinBloque` | Utilisateur | 3 tentatives PIN incorrectes |

---

### 3. `app/api/ussd/route.ts`

Route Next.js exposée à Africa's Talking. Machine d'états **stateless** : l'état est dérivé directement du paramètre `text` cumulatif envoyé par AT — pas besoin de session côté serveur pour naviguer dans les menus.

#### Paramètres reçus d'Africa's Talking (POST form-data)
```
sessionId    → identifiant unique AT de la session
phoneNumber  → +22997XXXXXX
networkCode  → 62001 (MTN) | 62002 (Moov)
serviceCode  → *384*36387# (shortcode GreenFlame)
text         → saisies cumulées : "1*84521*5000*1234"
```

#### Arbre de navigation complet
```
*XXX#
├── [vide]           → Menu principal (CON)
├── 1                → Payer : demander code marchand (CON)
│   └── 1*{code}     → Vérifier marchand, demander montant (CON)
│       └── 1*{code}*{mt}     → Récapitulatif + demander PIN (CON)
│           └── 1*{code}*{mt}*{pin} → Traiter transaction (END)
├── 2                → Solde FCFA + PGF + total gagné (END)
├── 3                → 3 dernières transactions (END)
└── 4                → PIN : entrer nouveau code (CON)
    └── 4*{pin}      → Confirmer PIN (CON)
        └── 4*{pin}*{confirm} → Sauvegarder PIN (END)
```

#### Sécurité intégrée
- PIN vérifié via `verifyPin()` (comparaison timing-safe, scrypt)
- Blocage après 3 tentatives incorrectes + SMS d'alerte
- Vérification `merchant.is_active` avant tout paiement
- Impossible de payer sa propre boutique
- Minimum 100 FCFA par transaction

#### Lien avec le canal web
Le paiement USSD appelle **exactement la même Edge Function** que le canal web :
```ts
fetch(`${SUPABASE_URL}/functions/v1/process-transaction`, {
  body: JSON.stringify({ merchantId, buyerId, amountFcfa, paymentMethod: 'wallet_gf', ... })
})
```
→ Même redistribution L1→L5, même `commission_distributions`, même `wallet_ledger`.

---

## Configuration requise

### Variables d'environnement

Ajouter dans `.env.local` (dev) et dans les variables d'environnement Vercel (prod) :

```env
# Africa's Talking — Sandbox (développement)
AT_API_KEY=<clé sandbox depuis dashboard.africastalking.com>
AT_USERNAME=sandbox
AT_SENDER_ID=GreenFlame

# Africa's Talking — Production (après obtention du shortcode)
# AT_API_KEY=<clé production>
# AT_USERNAME=greenflame
# AT_SENDER_ID=GreenFlame
```

### URL à configurer dans Africa's Talking
Dans le dashboard AT → USSD → shortcode → Callback URL :
```
https://greenflame-eta.vercel.app/api/ussd
```
Shortcode obtenu : **`*384*36387#`** (canal partagé AT sandbox)

---

## Étapes pour tester en sandbox (gratuit, maintenant)

### 1. Créer un compte Africa's Talking
→ [africastalking.com](https://africastalking.com) → Sign up → Create App (sandbox)

### 2. Récupérer la clé API sandbox
Dashboard AT → Settings → API Key → copier dans `.env.local`

### 3. Appliquer la migration 014
Supabase → SQL Editor → coller `014_ussd_support.sql` → Run

### 4. Simuler une session USSD
AT Dashboard → USSD → Sandbox → Launch Simulator
- Entrer un numéro de téléphone de test
- Composer `*384#` (ou le code de test AT)
- Naviguer dans les menus → vérifier les wallets en base

### 5. Tester les SMS
AT Dashboard → SMS → Sandbox → les SMS sont visibles dans les logs sans être envoyés réellement

---

## Étapes pour passer en production

| Étape | Action | Délai estimé |
|-------|--------|-------------|
| 1 | Contacter MTN Bénin — demander shortcode USSD | 4–8 semaines |
| 2 | Contacter Moov Africa Bénin — même démarche | 4–8 semaines |
| 3 | Changer `AT_USERNAME` → `greenflame` et `AT_API_KEY` → clé prod | Immédiat |
| 4 | Configurer callback URL prod dans AT dashboard | 30 min |
| 5 | Tester avec de vrais numéros sur le réseau | 1 jour |

---

## Schéma final des tables ajoutées

```sql
-- merchants (colonne ajoutée)
short_code VARCHAR(6) UNIQUE   -- ex: "84521"

-- users (colonnes ajoutées)
pin_attempts      SMALLINT     -- tentatives PIN incorrectes (reset à 0 si OK)
pin_locked_until  TIMESTAMPTZ  -- bloqué jusqu'à cette date (NULL = pas bloqué)
-- (transaction_pin existait déjà)

-- nouvelle table
ussd_sessions (
  session_id     TEXT PRIMARY KEY,
  phone_number   TEXT,
  user_id        UUID → users,
  state          TEXT,          -- état dérivé (MAIN, PAY_CODE, etc.)
  context        JSONB,
  request_count  SMALLINT,
  created_at     TIMESTAMPTZ,
  last_seen_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ    -- TTL 3 minutes
)

-- nouvelle table
ussd_transaction_log (
  id                  UUID PRIMARY KEY,
  session_id          TEXT,
  phone_number        TEXT,
  action              TEXT,     -- 'payment' | 'balance' | 'history' | 'set_pin'
  status              TEXT,     -- 'success' | 'failed' | 'cancelled'
  amount_fcfa         BIGINT,
  merchant_short_code VARCHAR(6),
  transaction_id      UUID → transactions,
  error_message       TEXT,
  created_at          TIMESTAMPTZ
)
```

---

## Récapitulatif des fichiers touchés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/014_ussd_support.sql` | Créé — ⚠️ à appliquer manuellement |
| `lib/ussd/africastalking.ts` | Créé |
| `app/api/ussd/route.ts` | Créé |
| `supabase/functions/process-transaction/index.ts` | **Non modifié** — déjà complet |
| `supabase/functions/_shared/governance.ts` | **Non modifié** — déjà complet |
