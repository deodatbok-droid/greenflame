# 🔥 Deploy Recap — Session 09 juillet 2026

## Résumé des changements

### 1. Forced Matrix 5×5 — implémentation complète

**Migration SQL** `supabase/migrations/072_forced_matrix.sql`
- Colonnes ajoutées sur `users` : `enrolled_by_id UUID` (qui a recruté physiquement) + `max_direct_slots INTEGER DEFAULT 5`
- Table `spillover_queue` : file d'attente des recrues non placées par BFS
- Vue `matrix_slot_view` : slots utilisés / disponibles / enrolled_count / rang par utilisateur
- Fonction SQL `direct_affiliates_count(p_user_id UUID)`
- RLS : admin voit tout, l'enrolleur voit ses propres entrées de file

**BFS Spillover** `lib/network/spillover.ts` (212 lignes)
- `resolveSpilloverPlacement(enrollerId, newUserId, service)` → placement direct si slot dispo, sinon BFS 5 niveaux
- BFS : requêtes par lot par niveau, nœud éligible = slot dispo + `last_active_at >= 30j` + `enrolled_count >= 2`
- Si aucun nœud trouvé : inscription en `spillover_queue`, fallback enrolleur
- `resolveQueueEntry(queueId, placedUnderId, service)` : résolution manuelle admin

**Inscription** `app/api/auth/complete-profile/route.ts`
- `enrolled_by_id` vs `upline_id` : distinction enrolleur (fixe) vs placement arbre (BFS)
- Insert en 2 étapes : `upline_id: null` → BFS → `UPDATE users SET upline_id = placement`
- Le trigger `network_tree` se déclenche sur l'UPDATE

**Career Engine** `lib/career/engine.ts`
- Constantes `SLOT_BY_RANK` : R0-2→5, R3-4→6, R5-6→8, R7-8→10
- `SLOT_GATE_PCT = 0.60` : 60% des directs actuels doivent être "vivants" avant déblocage
- `checkSlotGate(userId, currentSlots, svc)` : validation en batch
- `reevaluateMaxSlots(userId)` : réévaluation manuelle ou cron

**Admin Matrix** `app/admin/matrix/page.tsx` (327 lignes)
- Onglet "Disponibilité des slots" : KPIs + barres visuelles SlotBar par nœud
- Onglet "File d'attente" : spillover_queue + bouton "Forcer sous enrolleur"
- `isAlive(row)` : `last_active_at >= 30j && enrolled_count >= 2`

**API admin** `app/api/admin/matrix/resolve-queue/route.ts`
- POST admin-only → `resolveQueueEntry(queueId, placedUnderId, service)`

**Nav admin** `app/admin/layout.tsx`
- Lien `{ href: '/admin/matrix', label: 'Matrice réseau' }` ajouté

---

### 2. Fix APK — "There was a problem parsing the package"

**Cause** : l'ancien `sign_apk.py` réécrivait `MANIFEST.MF`, `CERT.SF`, `CERT.RSA` sans supprimer les originaux → ZIP avec entrées META-INF dupliquées → Android refuse l'install.

**Fix** :
- Extraction du ZIP en filtrant les entrées `META-INF/` existantes
- Reconstruction ZIP propre (466 entrées, 0 doublon)
- Re-signature avec le même keystore (`/tmp/gf_key.pem` / `/tmp/gf_cert.pem`)
- Résultat : 469 entrées (466 + 3 META-INF), 1 669 Ko

**Fichiers remplacés** :
- `public/GreenFlame.apk`
- `GreenFlame.apk` (racine)

---

### 3. Fix notifications spillover

**Avant** : notification `waNewFilleul` envoyée uniquement à l'enrolleur.

**Après** `app/api/auth/complete-profile/route.ts` :
```typescript
const notifyIds = new Set<string>()
if (enrollerId) notifyIds.add(enrollerId)
if (uplineId && uplineId !== enrollerId) notifyIds.add(uplineId)
for (const notifyId of notifyIds) { /* waNewFilleul */ }
```
- Si placement direct (enrolleur = upline) : 1 seule notification (dédupliquée par Set)
- Si spillover : 2 notifications — enrolleur physique + nœud de placement effectif

---

### 4. Fix emoji LandingPage

`components/LandingPage.tsx` — 3 occurrences :
- Ligne ~170 : `<span>🤖</span>` → `<span>🔥</span>` (hero section)
- Ligne ~357 : `<span>🤖</span>` → `<span>🔥</span>` (CTA final)
- Ligne ~379 : `🤖 App Android` → `🔥 App Android` (footer)

---

## Commandes de déploiement

```bash
# 1. Migration Supabase
supabase db push

# 2. Déployer sur Vercel
vercel --prod

# 3. Tester l'APK
# → Aller sur greenflameafrica.com/telecharger
# → Télécharger GreenFlame.apk
# → Installer (plus d'erreur "parsing the package")
```

---

## Checklist post-deploy

- [ ] `supabase db push` appliqué (migrations 066-072)
- [ ] APK réinstallé depuis `/telecharger` (fix confirmé)
- [ ] Test inscription avec parrainage → vérifier `enrolled_by_id` vs `upline_id`
- [ ] Test spillover → vérifier les 2 notifications WhatsApp
- [ ] Admin `/admin/matrix` → onglets slots + file d'attente
- [ ] Landing page → emoji 🔥 visible sur les 3 CTAs Android

---

## Points en attente (prochaines sessions)

- USSD dialer : boutons `tel:*880*41*CODE*MONTANT%23` dans le flux de paiement
- APK version check : endpoint `/api/app-version` + banner dashboard
- Tâches #105 (Chronogramme HTML) et #106 (Word expansion) — in_progress
- EDP Bénin point 3 (agrément BCEAO)
- lexifranco.com (noté 21 juin, sans contexte)
- Tontine / Marchand / Produit (3 sujets noté 4 juillet)

---

### 5. Fix APK — "App not installed" (session 2)

**Cause identifiée** : le `sign_apk.py` v2 utilisait `openssl smime -sign -noattr` pour le V1 JAR signing. L'option `-noattr` supprime les `SignedAttributes` obligatoires (contentType + messageDigest) requis par la vérification JAR. Android 7+ tente V2 d'abord, puis fallback V1 si V2 échoue — si les deux sont invalides → "App not installed".

**Fix (sign_apk.py v3)** :
- Réécriture complète avec la lib Python `cryptography`
- V1 : `PKCS7SignatureBuilder.sign(DER, [NoCapabilities])` → génère un SignedData avec `SignedAttributes` corrects
- V2 : même algorithme, signature RSA-PKCS1v15-SHA256 directe sans subprocess OpenSSL
- **Clés persistées dans `certs/gf_key.pem` + `certs/gf_cert.pem`** (plus de dépendance à `/tmp`)
- `certs/` ajouté au `.gitignore`

**Résultat** : 1 460 Ko, 469 entrées, 0 doublon, V2 block présent

**⚠️ IMPORTANT** : nouvelles clés générées → les utilisateurs ayant une version précédente installée doivent **désinstaller d'abord** avant d'installer la nouvelle.

**Déploiement** :
```bash
vercel --prod
```
