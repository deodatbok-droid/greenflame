# GreenFlame — Journal des mises à jour

> Généré le 24 mai 2026  
> Session de développement : Système freemium, analytics & gestion de stock

---

## Vue d'ensemble

Cette session a introduit le **système d'abonnement marchand** (free / pro / vip), la **gestion de stock avec limite de tier**, et un **dashboard analytics Pro complet**. Toutes les modifications sont dans `app/merchant/` et `components/merchant/`.

---

## 1. Migration SQL — `supabase/migrations/005_merchant_tiers.sql`

**À appliquer manuellement dans le SQL Editor de Supabase.**

### Colonnes ajoutées à `merchants`
```sql
subscription_tier TEXT DEFAULT 'free' CHECK (IN 'free', 'pro', 'vip')
subscription_expires_at TIMESTAMPTZ
```

### Nouvelle table `merchant_subscriptions`
Audit trail append-only de chaque paiement d'abonnement. RLS activée (lecture seule pour le marchand propriétaire).

### Fonctions SQL
- **`activate_merchant_subscription(p_merchant_id, p_tier, p_amount_fcfa, p_payment_ref, p_method)`**  
  Crée l'entrée dans `merchant_subscriptions`, met à jour `merchants.subscription_tier` et `subscription_expires_at` (renouvellement : extend depuis l'expiry actuel ; nouvelle souscription : +30 jours).
- **`merchant_active_tier(p_merchant_id)`**  
  Retourne `'free'` si l'abonnement est expiré, le tier réel sinon.

### Vue `merchant_tier_stats`
Agrège tier actif, date d'expiration et total dépensé par marchand.

---

## 2. Composant ProGate — `components/merchant/ProGate.tsx`

Composant réutilisable à trois exports :

| Export | Usage |
|--------|-------|
| `default ProGate` | Wrapper avec overlay flou + cadenas si tier insuffisant |
| `ProBadge` | Badge inline amber (PRO) ou violet (VIP) |
| `UpgradeBanner` | Bannière pleine largeur — visible uniquement pour le tier free |

**Logique de tier :**
```ts
const isPro = tier !== 'free' && expires !== null && expires > new Date()
```

---

## 3. Page d'upgrade — `app/merchant/upgrade/page.tsx`

Flow client en 4 étapes : `plans → payment → processing → success`

- Carte **Pro** : 10 000 FCFA/mois, 6 fonctionnalités listées
- Carte **VIP** : désactivée, badge "Bientôt"
- Sélecteur opérateur : MTN MoMo / Moov Money
- Champ numéro de téléphone + validation format Bénin
- Appel `POST /api/merchants/upgrade` avec `{ tier, operator, phone }`

---

## 4. API route upgrade — `app/api/merchants/upgrade/route.ts`

### POST — Déclencher un paiement d'abonnement
1. Authentifie l'utilisateur via Supabase
2. Valide tier (`'pro'` uniquement pour l'instant) et opérateur
3. Appelle `getMoMoAdapter(operator).requestToPay({ amount: 10000, payerMsisdn, ... })`
4. **Mode mock** : attend 3s, vérifie le statut, appelle le RPC SQL `activate_merchant_subscription` si `SUCCESSFUL`
5. **Mode live** : retourne `{ pending: true, referenceId }`, le webhook `/api/webhooks/momo` confirme

### GET — Vérifier le statut d'un paiement en attente
Paramètres : `?ref=<referenceId>&op=<operator>`

> **Correction appliquée** : le champ MoMo s'appelle `payerMsisdn` (string), pas `payer: { partyIdType, partyId }` — corrigé après vérification de `lib/mobile-money/types.ts`.

---

## 5. Gating des outils Pro

### Devis — `app/merchant/tools/devis/page.tsx` (server wrapper)
```ts
if (!isPro) redirect('/merchant/upgrade')
return <DevisClient businessName={merchant.business_name} />
```
La logique formulaire a été extraite dans `DevisClient.tsx` (client component).

### Facture — `app/merchant/tools/facture/page.tsx` (même pattern)
```ts
if (!isPro) redirect('/merchant/upgrade')
return <FactureClient businessName={merchant.business_name} />
```
La logique formulaire a été extraite dans `FactureClient.tsx`. La numérotation séquentielle des factures reste en localStorage.

---

## 6. Dashboard marchand — `app/merchant/dashboard/`

### `page.tsx`
Nouvelles props passées au client :
```ts
subscription_tier: merchant.subscription_tier ?? 'free'
subscription_expires_at: merchant.subscription_expires_at
```

### `MerchantDashboardClient.tsx`
- Interface `Props.merchant` étendue avec `subscription_tier` et `subscription_expires_at`
- `<UpgradeBanner tier={...} />` ajouté en haut de l'onglet Dashboard (visible uniquement pour free)

---

## 7. Limite de produits — `app/merchant/products/`

### `page.tsx` (nouveau server wrapper)
Récupère le tier actif, calcule `productLimit = tier === 'free' ? 10 : Infinity`, passe tout à `ProductsClient`.

### `ProductsClient.tsx` (renommé depuis `page.tsx`)
Nouvelles props : `tier: 'free' | 'pro' | 'vip'`, `productLimit: number`

Comportement :
| Produits | Comportement |
|----------|-------------|
| ≥ 8 (FREE_LIMIT − 2) | Bannière d'avertissement orange |
| ≥ 10 | Bouton "Ajouter" désactivé + CTA upgrade |
| Pro/VIP | Aucune limite, aucun avertissement |

Compteur visible : `(X restant(s))` dans le bouton d'ajout.

---

## 8. Analytics Pro — `app/merchant/analytics/`

### `page.tsx` (server component, Pro-gated)
Redirige vers `/merchant/upgrade` si tier free.

**Données calculées :**
- Agrégats : aujourd'hui, hier, cette semaine, semaine précédente, ce mois, mois précédent
- Comparaisons `%` : `pct(current, previous)` → delta affiché en vert/rouge
- 6 mois de données mensuelles (GMV, net, count)
- 30 jours de données journalières
- Moyennes par jour de la semaine (lun–dim)
- Activité par heure (6h–22h)
- Top 5 clients par GMV
- Clients uniques : total et ce mois

**KpiCard component** (inline dans `page.tsx`) :
- Variante accent `brand-700` (fond sombre) pour les métriques clés
- Delta `%` coloré + sous-texte

### `AnalyticsCharts.tsx` (client component)
- `BarChart` réutilisable : hover tooltip, couleur configurable, formatValue custom
- **4 graphiques interactifs** avec toggles de vue :
  - 6 mois → GMV / Net / Nombre de ventes
  - 30 jours → GMV / Nombre de ventes
  - Par jour de la semaine (moyenne GMV)
  - Par heure de la journée (GMV total)
- Résumé 3 derniers mois sous le graphique 6 mois
- Aucune lib externe (barres Tailwind pures)

---

## 9. Navigation & Outils — intégration finale

### `app/merchant/layout.tsx`
Lien **Analytics** ajouté dans la nav entre "Outils" et "Historique" :
```tsx
<Link href="/merchant/analytics" ...>Analytics</Link>
```

### `app/merchant/tools/page.tsx`
Carte 📊 **Analytics** ajoutée dans la grille d'actions rapides :
- Marchand **Pro** → lien vers `/merchant/analytics`
- Marchand **free** → lien vers `/merchant/upgrade` + `<ProBadge />` + opacité réduite

---

## Récapitulatif des fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/005_merchant_tiers.sql` | Créé |
| `components/merchant/ProGate.tsx` | Créé |
| `app/merchant/upgrade/page.tsx` | Créé |
| `app/api/merchants/upgrade/route.ts` | Créé |
| `app/merchant/tools/devis/page.tsx` | Réécrit (server wrapper) |
| `app/merchant/tools/devis/DevisClient.tsx` | Créé (extrait) |
| `app/merchant/tools/facture/page.tsx` | Réécrit (server wrapper) |
| `app/merchant/tools/facture/FactureClient.tsx` | Créé (extrait) |
| `app/merchant/tools/page.tsx` | Modifié (KPIs, graphique, bannière, grille Pro) |
| `app/merchant/dashboard/page.tsx` | Modifié (props tier) |
| `app/merchant/dashboard/MerchantDashboardClient.tsx` | Modifié (UpgradeBanner + interface) |
| `app/merchant/products/page.tsx` | Créé (server wrapper) |
| `app/merchant/products/ProductsClient.tsx` | Renommé + modifié (limite + avertissements) |
| `app/merchant/analytics/page.tsx` | Créé (Pro-gated, calculs complets) |
| `app/merchant/analytics/AnalyticsCharts.tsx` | Créé (4 graphiques interactifs) |
| `app/merchant/layout.tsx` | Modifié (lien Analytics) |

---

## Étape manuelle requise

```sql
-- À coller dans Supabase → SQL Editor → New Query
-- Fichier : supabase/migrations/005_merchant_tiers.sql
```

Sans cette migration, les colonnes `subscription_tier` et `subscription_expires_at` n'existent pas en base et toutes les pages merchant retourneront des erreurs.

---

## Variables d'environnement à vérifier

| Variable | Valeur dev | Description |
|----------|-----------|-------------|
| `PAYMENT_MODE` | _(absent ou `mock`)_ | Mode mock : confirmation auto après 3s |
| `PAYMENT_MODE` | `live` | Mode prod : webhook MoMo confirme |

