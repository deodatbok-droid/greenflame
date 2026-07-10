# GreenFlame — Guide de démarrage rapide

## Prérequis

1. **Node.js 18+** — https://nodejs.org (télécharger LTS)
2. **Compte Supabase** — https://supabase.com (gratuit)
3. **Supabase CLI** — `npm install -g supabase`

---

## Étape 1 — Installer les dépendances

```bash
cd C:\Users\finen\greenflame
npm install
```

---

## Étape 2 — Créer le projet Supabase

1. Aller sur https://supabase.com
2. Créer un nouveau projet (région : eu-west ou us-east)
3. Récupérer dans Settings > API :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secret, jamais côté client)

---

## Étape 3 — Configurer l'environnement

```bash
# Copier le fichier d'exemple
cp .env.local.example .env.local

# Éditer .env.local et remplir les variables Supabase
```

---

## Étape 4 — Créer le bucket Storage pour les QR codes

Dans le dashboard Supabase :
1. Storage > New bucket : `merchant-qrcodes`
2. Cocher "Public bucket"

---

## Étape 5 — Appliquer les migrations SQL

Dans le dashboard Supabase, aller dans SQL Editor et exécuter dans l'ordre :

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_seed_categories.sql
```

Ou via CLI :
```bash
supabase login
supabase link --project-ref <votre-project-ref>
supabase db push
```

---

## Étape 6 — Configurer l'Auth Supabase (OTP SMS)

Dans Dashboard Supabase > Authentication > Providers :
1. Activer **Phone** provider
2. Configurer Africa's Talking ou Twilio pour les SMS
3. Pour le développement, activer "OTP via email" comme fallback

> **Dev tip** : En mode `PAYMENT_MODE=mock`, les OTP apparaissent dans les logs Supabase Auth.

---

## Étape 7 — Initialiser le compte Déodat (platform_upline)

Après que Déodat se connecte pour la première fois :

```sql
-- Remplacer [DEODATS_UUID] par son auth.uid() réel
-- Visible dans Authentication > Users dans le dashboard Supabase

UPDATE public.users
SET role = ARRAY['consumer','kingmaker','platform_upline']
WHERE id = '[DEODATS_UUID]';

INSERT INTO public.network_tree (user_id, depth, tree_path)
VALUES ('[DEODATS_UUID]'::uuid, 0, ARRAY['[DEODATS_UUID]'::uuid])
ON CONFLICT (user_id) DO UPDATE SET
  l1_upline = NULL, l2_upline = NULL, l3_upline = NULL,
  l4_upline = NULL, l5_upline = NULL, depth = 0,
  tree_path = ARRAY['[DEODATS_UUID]'::uuid];
```

---

## Étape 8 — Déployer les Edge Functions

```bash
supabase functions deploy process-transaction
supabase functions deploy momo-webhook
supabase functions deploy send-otp
supabase functions deploy distribute-commissions

# Configurer les secrets des Edge Functions
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set PAYMENT_MODE=mock
supabase secrets set AT_API_KEY=...
supabase secrets set AT_USERNAME=sandbox
```

---

## Étape 9 — Lancer le projet

```bash
npm run dev
```

Ouvrir http://localhost:3000

---

## Étape 10 — Lancer les tests

```bash
npm test
```

Les tests du scénario Kofi doivent tous passer à 100%.

---

## Structure du projet

```
greenflame/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login / Register
│   ├── (consumer)/         # Dashboard, Pay, History, Network, Wallet
│   ├── (merchant)/         # Dashboard Marchand, Receive, History
│   ├── (admin)/            # Admin Dashboard, Merchants, Transactions
│   └── api/                # API Routes
├── lib/
│   ├── commission-engine/  # Moteur de commissions (CRITIQUE)
│   ├── mobile-money/       # Adaptateurs MTN MoMo + Moov
│   ├── supabase/           # Client Supabase
│   └── utils/              # Fonctions utilitaires
├── components/             # Composants React
├── hooks/                  # Hooks React personnalisés
├── supabase/
│   ├── migrations/         # SQL migrations
│   └── functions/          # Edge Functions Deno
└── __tests__/              # Tests automatisés
```

---

## Déploiement sur Vercel

```bash
npm install -g vercel
vercel

# Dans le dashboard Vercel, ajouter les variables d'environnement :
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# NEXT_PUBLIC_APP_URL = https://votre-domaine.vercel.app
# PAYMENT_MODE = mock (puis live en production)
```

---

## MTN MoMo — Passer en production

1. S'inscrire sur https://momodeveloper.mtn.com
2. Créer une application (Collection + Disbursement)
3. Remplir dans .env.local :
   - `MTN_MOMO_SUBSCRIPTION_KEY`
   - `MTN_MOMO_API_USER`
   - `MTN_MOMO_API_KEY`
   - `MTN_MOMO_ENVIRONMENT=production`
4. Mettre `PAYMENT_MODE=live`

---

## Checklist avant 1ère transaction réelle

- [ ] Migrations SQL appliquées
- [ ] RLS activé et testé
- [ ] Compte Déodat initialisé (platform_upline)
- [ ] 5 premiers marchands enrôlés
- [ ] Edge Function process-transaction déployée
- [ ] Tests `npm test` → 100% pass
- [ ] MTN MoMo sandbox validé end-to-end
- [ ] SMS OTP fonctionnel sur numéros béninois
- [ ] Dashboard marchand : alerte crédit client visible

---

*GreenFlame Holdings · Cotonou, Bénin · 2026*
*"Built by Africans. For Africa. For the world."*
