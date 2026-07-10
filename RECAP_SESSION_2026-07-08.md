# Récap session — 8 juillet 2026

## 1. GreenFlame Delivery — finalisation (Task #305)

### Fichiers créés
- `app/admin/delivery/page.tsx` — page admin supervision livraisons
  - KPIs : escrow total, commandes sans livreur, livreurs actifs, total livraisons
  - Tableau escrows actifs avec alerte rouge si expiration < 6h
  - Tableau des 20 dernières commandes (statut coloré, marchand, acheteur, livreur)
  - Registre complet des prestataires (badge Vérifié / Actif / Inactif)

- `app/delivery/providers/page.tsx` — marketplace publique des livreurs
  - Liste triée par note, filtre recherche libre
  - Bouton "Choisir" → assigne `provider_id` sur `delivery_orders` via `?order=xxx`
  - WhatsApp direct, tarifs, zone de couverture
  - CTA inscription livreur → `/merchant/activate?service=delivery`

### Fichiers modifiés
- `app/admin/layout.tsx` — ajout lien "Delivery" dans NAV_LINKS
- `app/merchant/tools/page.tsx` — ajout carte 🚴 Livraisons dans section "Gestion d'activité"

---

## 2. PWA — Progressive Web App (Task #306)

### Fichiers créés
- `public/sw.js` — Service Worker complet
  - Précache : `/`, `/manifest.json`, icônes
  - Navigation : network-first + fallback offline
  - Images/fonts : cache-first
  - API + Supabase : network-only (jamais en cache)
  - Push notifications câblées (prêt pour Wasender)

- `components/ServiceWorkerRegister.tsx` — composant client d'enregistrement
  - Polling de mise à jour toutes les heures

### Fichiers modifiés
- `app/layout.tsx` — ajout `<ServiceWorkerRegister />` dans le body
- `public/manifest.json` — enrichi :
  - `shortcuts` : Marketplace, Wallet, Payer
  - Icons `maskable` (requis Android)
  - `scope`, `lang: "fr"`

### Résultat
Le site est installable sur Android (prompt natif Chrome) et iOS (Ajouter à l'écran d'accueil).

---

## 3. Marketplace — navigation grille + filtres (Task #307)

### Fichiers créés
- `app/(consumer)/marketplace/MarketplaceClient.tsx` — composant client
  - **Tabs** : Tout / Mon réseau / VIP / 🔥 Tendances / ✨ Nouveaux
  - **Tri** : Pertinence / Prix ↑ / Prix ↓ / Récent
  - **Filtres avancés** (expandable) : catégorie (pills) + fourchette de prix min/max
  - Compteur de résultats dynamique, "Tout effacer"
  - Grille `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` — fini le scroll horizontal

### Fichiers modifiés
- `app/(consumer)/marketplace/page.tsx`
  - Les 5 sections scroll horizontal (réseau, VIP, tendances, nouveautés, tous) sont remplacées par `<MarketplaceClient />`
  - La `CategoryGrid` des 14 catégories reste en haut, inchangée
  - Enrichissement communautaire (`boostMap`) conservé, passé au client comme props

---

## 4. Suivi commandes marchand (Task #308)

### Fichiers modifiés
- `app/merchant/history/page.tsx` — entièrement réécrit
  - **3 sections** : À traiter / En cours / Terminées
  - **Tracker pipeline visuel** 4 étapes (Payé → Préparation → En route → Livré)
  - Jointure `delivery_orders` + `delivery_providers` dans la requête
  - Badge escrow avec date d'expiration
  - Bouton "Assigner livreur" quand `pending_assignment`
  - Lien "Contacter client" (ContactButton)

---

## 5. Suivi commandes acheteur (Task #309)

### Fichiers modifiés
- `app/(consumer)/mes-achats/page.tsx`
  - Ajout de la jointure `delivery_orders` (statut, adresse, livreur, timestamps)
  - Prop `userId` passée au client

- `app/(consumer)/mes-achats/MesAchatsClient.tsx` — entièrement réécrit
  - **Tracker visuel par commande** : cercles + barre de progression colorée
    - Livraison : Payé → Préparation → En route → Livré (4 étapes)
    - Retrait/POS : Payé → Préparation → Récupéré (3 étapes)
  - Infos livreur en temps réel (nom + téléphone cliquable)
  - Adresse de livraison
  - Info escrow (date de libération automatique)
  - **Bouton "J'ai bien reçu ma commande"** → appelle `/api/transactions/[id]/confirm-delivery`, affiche cashback crédité
  - Lien "Signaler un problème" → `/delivery/confirm/[id]`
  - Badge visuel Livraison 🚴 / Retrait 🏪

---

## 6. APK TWA — décision et procédure (hors code)

Pour distribuer GreenFlame comme une vraie app Android sans passer par le Play Store :

1. Aller sur **pwabuilder.com**
2. Entrer l'URL **`https://greenflameafrica.com`** (domaine de production, pas l'URL Vercel)
3. Choisir Android → APK
4. Package ID suggéré : `app.greenflame.africa`
5. Générer et **conserver précieusement le fichier `.jks`** (keystore de signature)
6. Héberger `greenflame.apk` dans `public/`
7. Créer une page `/telecharger` avec les instructions d'installation

> ⚠️ L'APK est liée au domaine. Générer avec le bon domaine dès le départ.

---

## Fichiers créés ce soir

| Fichier | Type |
|---------|------|
| `public/sw.js` | Nouveau |
| `components/ServiceWorkerRegister.tsx` | Nouveau |
| `public/manifest.json` | Modifié |
| `app/layout.tsx` | Modifié |
| `app/(consumer)/marketplace/MarketplaceClient.tsx` | Nouveau |
| `app/(consumer)/marketplace/page.tsx` | Modifié |
| `app/merchant/history/page.tsx` | Réécrit |
| `app/(consumer)/mes-achats/page.tsx` | Modifié |
| `app/(consumer)/mes-achats/MesAchatsClient.tsx` | Réécrit |
| `app/admin/delivery/page.tsx` | Nouveau |
| `app/delivery/providers/page.tsx` | Nouveau |
| `app/merchant/tools/page.tsx` | Modifié |
| `app/admin/layout.tsx` | Modifié |
