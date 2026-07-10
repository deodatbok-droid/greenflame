# GreenFlame — Guide Claude Code

## Projet
Commerce communautaire pan-africain (Cotonou, Bénin). Chaque transaction génère automatiquement cashback + commissions multi-niveaux.

**Co-fondateur Tech :** Aurel DOSSA (aurelioteam229@gmail.com)
**Deadline MVP :** 31 juillet 2026 — première vraie transaction avant cette date.

## Stack
- Next.js 15 (App Router, TypeScript, TailwindCSS) — PWA
- Supabase (PostgreSQL + Auth OTP + Realtime + Storage + Edge Functions)
- Mobile Money : MTN MoMo + Moov Money (mock en dev, live en prod)
- SMS OTP : Africa's Talking

## Invariants de gouvernance (NE JAMAIS MODIFIER)
```
Plateforme       : 45%
Cashback         : 12%
Pool Récompenses : 3%
Communauté       : 40% → L1=12% L2=10% L3=8% L4=6% L5=4%
```
Ces valeurs sont dans `lib/commission-engine/constants.ts` → `GOVERNANCE`.
Toute tentative de modification est loggée dans `governance_audit`.

## Règles métier critiques
- **PGF** : cashback < 50 FCFA → crédité en Points GreenFlame (1 PGF = 1 FCFA, min retrait 5 000 PGF)
- **Spillover** : niveau réseau sans upline, ou Kingmaker inactif >90 jours → vers `spillover_fund`
- **wallet_ledger** : append-only — RLS interdit UPDATE et DELETE
- **Idempotency** : `UNIQUE` sur `transactions.idempotency_key` — clé = `${buyerId}-${merchantId}-${timestamp}`
- **Network tree** : table dénormalisée (l1_upline…l5_upline), maintenue par trigger DB

## Structure des routes
- `/` → affiche toujours la landing page (avec bouton "Mon tableau de bord" si connecté)
- `/(auth)/login` et `/(auth)/register` — OTP téléphone Béninois (+229)
- `/(consumer)/dashboard`, `/pay`, `/network`, `/wallet`, `/history`
- `/(merchant)/dashboard`, `/receive`, `/history`
- `/(admin)/dashboard`, `/merchants`, `/transactions`
- `/api/transactions`, `/api/merchants`, `/api/wallets`, `/api/webhooks/momo`

## Supabase
- URL : `https://osuldrlwrzzdfwzesoke.supabase.co`
- Migrations dans `supabase/migrations/` (3 fichiers, appliquer dans l'ordre)
- Edge Functions dans `supabase/functions/` : `process-transaction`, `momo-webhook`, `send-otp`
- Storage bucket requis : `merchant-qrcodes` (public)

## Commandes
```bash
npm run dev          # Démarrer le serveur local
npm test             # 26 tests (moteur de commission)
npm run build        # Build production
```

## Ce qui reste à faire pour le MVP
1. Appliquer les migrations SQL dans le dashboard Supabase (001, 002, 003 dans l'ordre)
2. Créer le bucket Storage `merchant-qrcodes` (public)
3. Activer Phone OTP dans Supabase Auth (provider SMS)
4. Déployer les 3 Edge Functions via `supabase functions deploy`
5. Créer manuellement le compte platform_upline (Déodat) après son inscription
6. Tester le flux complet avec PAYMENT_MODE=mock
7. Configurer MTN MoMo sandbox credentials dans .env.local quand disponibles

## Notes importantes
- `createClient()` (server) est async dans Next.js 15 → toujours `await createClient()`
- `createServiceClient()` reste synchrone (pas de cookies)
- Les pages 'use client' utilisent `@/lib/supabase/client` (browser)
- Les Server Components et API routes utilisent `@/lib/supabase/server`
