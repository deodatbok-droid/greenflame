V# DEPLOY_NOW — Récap session 9 juillet 2026

## 1. GIT PUSH (Vercel auto-déploie)

```bash
cd greenflame
git add -A
git commit -m "feat: APK icons + splash vert + CTA téléchargement landing + WhatsApp text"
git push
```

---

## 2. SUPABASE DB PUSH (migrations 066-071)

```bash
supabase db push
```

### Ce que ça applique en prod :

| Migration | Table(s) | Effet |
|-----------|----------|-------|
| **066** `ucp_unit_price` | `ucp_subscriptions` | Colonne `prix_unitaire_fcfa` — prix figé à la souscription ; mise à jour vue `ucp_registry` |
| **067** `tac_columns` | `leader_career_ranks` | Colonnes `tac_actifs_count` + `tac_scope_count` — compteurs percentile pour le Verrou 2 Plan de Carrière |
| **068** `spillover_ledger` | `spillover_ledger` (new) | Table + vue `spillover_summary` — comptabilise les commissions non-attribuées (orphelins, inactifs, arrondis) |
| **069** `stock_movements` | `stock_movements` (new), `products` | Historique mouvements de stock marchand + seuil d'alerte bas |
| **070** `caisse_entries` | `caisse_entries` (new) | Livre de caisse manuel marchand (recettes / dépenses hors plateforme) |
| **071** `escrow_delivery` | 4 tables nouvelles + extensions `transactions` | Escrow paiement + marketplace livreurs (delivery_providers, delivery_orders, delivery_ratings, escrow_notifications) |

---

## 3. CE QUI CHANGE SUR LE SITE (Vercel)

### Splash screen & icône APK
- `public/manifest.json` — `background_color` : `#ffffff` → `#16a34a` (vert brand)
  → splash screen de l'app devient vert au lieu de blanc
- `public/icon-192.png`, `icon-192-maskable.png`, `icon-512.png`, `icon-512-maskable.png`
  → logo remplace 36-39 % de la hauteur par 76-78 %
  → fond blanc remplacé par vert brand (#16a34a) sur toutes les icônes

### APK mis à jour (déjà en place dans le repo)
- `public/GreenFlame.apk` (1,7 Mo, re-signé)
  → 30 fichiers icônes internes remplacés : fond vert, logo agrandi
  → même signature keystore `greenflame.p12` — installation par-dessus l'existant possible
- Page `/telecharger` — taille affichée corrigée : 1,4 Mo → 1,7 Mo
- Page `/telecharger` — texte WhatsApp corrigé :
  `🔥 Télécharge l'app GreenFlame ici : https://greenflameafrica.com/telecharger\nAchète local, gagne du cashback à chaque achat 🔥`

### Landing page — nouveaux CTAs téléchargement APK
Trois points d'entrée ajoutés dans `components/LandingPage.tsx` :
1. **Hero section** — lien discret `🤖 Télécharger l'app Android` sous les deux boutons principaux
2. **CTA final** — lien secondaire `🤖 Télécharger l'app Android (.apk)` sous le bouton "Créer mon compte"
3. **Footer** — lien `🤖 App Android` dans la liste des liens

---

## 4. RÉINSTALLATION APK (à faire manuellement sur ton téléphone)

> ⚠️ Désinstalle l'ancienne APK avant d'installer la nouvelle, OU installe directement par-dessus si Android le permet avec la même signature.

1. Ouvre `greenflameafrica.com/telecharger` sur le téléphone
2. Télécharge la nouvelle APK (1,7 Mo)
3. Installe → tu verras l'icône verte agrandie + le splash screen vert à l'ouverture

---

## 5. VÉRIFICATIONS POST-DÉPLOIEMENT

- [ ] `greenflameafrica.com` — landing page affiche les 3 CTA "App Android"
- [ ] `greenflameafrica.com/telecharger` — taille APK = 1,7 Mo, bouton WhatsApp = bon texte 🔥
- [ ] APK installée — splash screen fond vert, logo bien visible, "GreenFlame" affiché en dessous
- [ ] `supabase db push` — aucune erreur sur les 6 migrations
- [ ] Dashboard admin → section Spillover (migration 068 OK)
- [ ] Dashboard marchand → Stock + Caisse accessibles (migrations 069-070 OK)

---

## 6. PROCHAINS CHANTIERS (pas dans ce déploiement)

- **Forced Matrix 5×5 + spillover conditionnel** — architecture réseau validée en session, à implémenter :
  - `users` : nouveau champ `enrolled_by_id` (distinction enrolleur/sponsor)
  - `direct_affiliates_count` + `max_direct_slots` par utilisateur
  - Logique BFS spillover dans l'API d'inscription/referral
  - Engine carrière : déblocage conditionnel des slots (+1 par palier sous condition d'activation)
- **USSD / dialer** — implémenter les boutons `tel:*880*41*CODE*MONTANT%23` dans le flux de paiement (formats par opérateur à confirmer)
- **Vérification version APK** — endpoint `/api/app-version` + banner "nouvelle version disponible" dans le dashboard
