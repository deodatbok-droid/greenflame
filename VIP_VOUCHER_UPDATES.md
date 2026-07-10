# GreenFlame — Mise à jour VIP + Bons de Retrait

> Session du 27 mai 2026 — Auteur : Déodat BOKONONHOUI  
> Modèle : Claude Sonnet 4.6

---

## Résumé des changements

Cette session a ajouté le **tier VIP marchand**, enrichi le système de **Bons de Retrait** avec restrictions de sécurité + frais de service, et rendu les **revenus GreenFlame** visibles depuis l'admin.

---

## 1. Migration SQL — `supabase/migrations/017_vip_voucher_fees.sql`

**À exécuter dans Supabase Dashboard > SQL Editor.**

### Colonnes ajoutées sur `withdrawal_vouchers`

| Colonne | Type | Description |
|---|---|---|
| `recipient_phone` | `VARCHAR(20)` | Téléphone du destinataire — doit être membre GreenFlame |
| `fee_fcfa` | `BIGINT DEFAULT 0` | Frais totaux 1% prélevés à l'encaissement |
| `merchant_fee_fcfa` | `BIGINT DEFAULT 0` | Part marchand (0,5% du bon) |
| `greenflame_fee_fcfa` | `BIGINT DEFAULT 0` | Part GreenFlame (0,5% du bon) |

### Nouvelles tables

- **`platform_revenue_ledger`** : journal append-only des revenus GreenFlame
  - Colonnes : `source_type` (transaction_platform_fee / voucher_fee / subscription), `source_id`, `amount_fcfa`, `description`, `created_at`
  - Protégé par RLS : lecture réservée aux admins

### Nouvelles vues

- **`v_platform_revenue`** : agrégation mensuelle par source de revenus
- **`v_platform_revenue_summary`** : totaux all-time par source

### Fonction mise à jour : `activate_merchant_subscription`

- Accepte désormais `'vip'` comme tier en plus de `'pro'`
- Insère automatiquement dans `platform_revenue_ledger` à chaque activation
- Validation explicite : lève une exception si le tier n'est pas `pro` ou `vip`

### Extension `wallet_ledger.transaction_type`

Deux nouveaux types ajoutés :
- `voucher_fee_merchant` — commission marchand sur encaissement
- `voucher_fee_platform` — commission GreenFlame sur encaissement

---

## 2. Tier VIP Marchand

### Tarif et conditions

- **Prix** : 10 000 FCFA/mois (identique au Pro)
- **Renouvellement** : mensuel, sans engagement
- **Gestion** : même compte admin que Pro et Free

### Avantages VIP (en plus des avantages Pro)

| Avantage | Description |
|---|---|
| 🎟️ Réseau Bons de Retrait | Seuls les marchands VIP peuvent encaisser des bons |
| 💰 Commission 0,5% | Gagnez 0,5% sur chaque bon encaissé |
| ⭐ Mise en avant Marketplace | Priorité d'affichage |
| 🎨 Page boutique personnalisée | Profil enrichi |

### Fichiers modifiés

- **`app/api/merchants/upgrade/route.ts`**
  - Ajout de `vip: 10000` dans `TIER_PRICES`
  - Validation : `['pro', 'vip'].includes(tier)`

- **`app/merchant/upgrade/page.tsx`**
  - Carte VIP activée (suppression du badge "Bientôt")
  - Gradient purple/amber pour différencier visuellement
  - Bloc mise en avant : "Bons de Retrait — 0,5% de commission"
  - Sélecteur de tier : `selectedTier: 'pro' | 'vip'`
  - Message de succès et redirection adaptés au tier choisi

---

## 3. Bons de Retrait — Nouvelles règles

### Restriction destinataire (membres GreenFlame uniquement)

**Pourquoi** : Levier d'acquisition — impossible de recevoir un bon sans être inscrit sur GreenFlame.

**Implémentation** :

- **Création** (`app/api/vouchers/create/route.ts`) :
  - Paramètre obligatoire : `recipientPhone`
  - Validation en temps réel : `GET /api/vouchers/create?phone=XXXXXXXX`
  - Vérification en base : `users.phone` doit correspondre à un compte existant
  - Erreur explicite : *"Ce numéro n'est pas inscrit sur GreenFlame. Invitez votre destinataire à s'inscrire d'abord."*
  - Interdiction : le créateur ne peut pas se faire un bon à lui-même

- **Interface consommateur** (`app/(consumer)/voucher/page.tsx`) :
  - Nouveau champ "Téléphone du destinataire" (obligatoire)
  - Lookup debounced 600ms → affichage du nom du membre confirmé
  - Indicateur visuel : ✓ vert / ✗ rouge / spinner pendant la vérification
  - Bouton "Créer" désactivé tant que le numéro n'est pas validé

### Frais de service : 1%

**Répartition** :

| Destinataire | Part | Calcul |
|---|---|---|
| Marchand (bonus) | 0,5% | `Math.floor(totalFee * 0.5)` |
| GreenFlame | 0,5% | `totalFee - merchantFee` |

**Flux financier** :
1. Bon de 10 000 FCFA créé — 10 000 FCFA débités du wallet émetteur
2. Encaissement : frais totaux = 100 FCFA (1%)
3. Marchand reçoit : 9 950 FCFA sur son wallet (10 000 - 50 FCFA GreenFlame)
4. Porteur reçoit : 9 900 FCFA en espèces (le marchand déduit sa part de 50 FCFA)
5. GreenFlame : 50 FCFA → `platform_revenue_ledger`

> Note : le marchand est économiquement avantageux : il reçoit 9 950 FCFA et ne remet que 9 900 FCFA en espèces. Net marchand = +50 FCFA de profit.

### Notification au créateur lors de l'encaissement

- **In-app** : `insertNotification()` → titre "Votre bon a été encaissé ✅"
- **SMS** : `sendSms()` via Africa's Talking (non-bloquant)
  - Format : *"[GreenFlame] Votre bon de retrait de X FCFA a ete encaisse chez [Marchand]. Code: GF-XXXXXXXX"*

### Gate VIP sur l'encaissement (API + UI)

- **`app/api/vouchers/redeem/route.ts`** : vérifie `subscription_tier === 'vip'` && `subscription_expires_at > now`
  - Erreur 403 avec `upgradeRequired: true` si non-VIP
- **`app/merchant/vouchers/page.tsx`** : affiche un écran "Fonctionnalité réservée VIP" avec CTA upgrade si le marchand n'est pas VIP actif

---

## 4. Interface marchande Bons de Retrait (VIP)

### Écran de confirmation enrichi

Affiche maintenant le détail des frais avant de confirmer :

```
Valeur du bon :     10 000 FCFA
Frais totaux (1%) :  −  100 FCFA
Votre commission :   +   50 FCFA
GreenFlame :         −   50 FCFA
─────────────────────────────────
Crédité wallet :     9 950 FCFA
Cash à remettre :    9 900 FCFA
```

### Écran de succès

- Affiche le montant exact à remettre en espèces
- Badge "Commission VIP gagnée : +X FCFA"

### Historique enrichi

- Colonne "commission gagnée" sur chaque ligne de l'historique
- Montant "net" affiché (montant brut - part GreenFlame)

---

## 5. Revenus GreenFlame — Visibilité admin

### Dashboard admin (`app/admin/dashboard/page.tsx`)

Nouvelle section **"Revenus GreenFlame (total cumulé)"** avec 4 cartes :

| Carte | Contenu |
|---|---|
| Total GreenFlame | Somme des 3 sources, all-time |
| Frais transactions | 45% commissions, ce mois |
| Abonnements Pro + VIP | Total cumulé + comptage actifs |
| Frais bons de retrait | Total cumulé (0,5% par bon) |

Lien "Détail →" vers `/admin/revenue`.

### Page dédiée `/admin/revenue`

Accessible depuis la nav admin (lien "💰 Revenus").

Contenu :
- **Banner total cumulé** + total du mois
- **3 cartes sources** : transactions / abonnements / bons
- **Tableau derniers abonnements** : marchand, tier, montant, méthode, date
- **Tableau derniers frais bons** : code, valeur, frais GF, marchand, date

---

## 6. Checklist d'intégration

### SQL à exécuter

```sql
-- Dans Supabase Dashboard > SQL Editor
-- 1. Migration 017 (nouveau)
\i supabase/migrations/017_vip_voucher_fees.sql
```

### Variables d'environnement (inchangées)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AT_API_KEY=...               # Africa's Talking — SMS
AT_USERNAME=sandbox          # "sandbox" en dev, nom de compte en prod
AT_SENDER_ID=GreenFlame      # optionnel
PAYMENT_MODE=mock            # "mock" en dev, "live" en prod
```

### Test rapide en local

```bash
# Démarrer le serveur
cd greenflame
npm run dev

# Tester la validation membre
curl http://localhost:3000/api/vouchers/create?phone=22991000000

# Tester la création de bon (avec auth token)
curl -X POST http://localhost:3000/api/vouchers/create \
  -H "Content-Type: application/json" \
  -d '{"amountFcfa": 1000, "recipientPhone": "22991000000"}'
```

---

## 7. Architecture globale des revenus GreenFlame

```
GreenFlame Platform Revenue
│
├── 💳 Transactions (45% automatique)
│   └── Edge Function process-transaction
│       └── commission_distributions WHERE distribution_type='platform'
│
├── 👑 Abonnements (10 000 FCFA/mois)
│   └── API /api/merchants/upgrade
│       └── activate_merchant_subscription() → platform_revenue_ledger
│
└── 🎟️ Bons de Retrait (0,5% par encaissement)
    └── API /api/vouchers/redeem
        └── platform_revenue_ledger WHERE source_type='voucher_fee'
```

---

## 8. Fichiers modifiés/créés

| Fichier | Action |
|---|---|
| `supabase/migrations/017_vip_voucher_fees.sql` | ✨ Créé |
| `app/api/merchants/upgrade/route.ts` | 📝 Modifié (VIP activé) |
| `app/merchant/upgrade/page.tsx` | 📝 Modifié (carte VIP active) |
| `app/api/vouchers/create/route.ts` | 📝 Modifié (recipientPhone + lookup GET) |
| `app/api/vouchers/redeem/route.ts` | 📝 Modifié (VIP gate + frais + notification) |
| `app/(consumer)/voucher/page.tsx` | 📝 Modifié (champ phone + validation live) |
| `app/merchant/vouchers/page.tsx` | 📝 Modifié (VIP gate + détail frais) |
| `app/admin/dashboard/page.tsx` | 📝 Modifié (section revenus GreenFlame) |
| `app/admin/revenue/page.tsx` | ✨ Créé |
| `app/admin/layout.tsx` | 📝 Modifié (lien Revenus dans nav) |

---

*Fichier généré automatiquement — à ouvrir dans Visual Studio Code*
