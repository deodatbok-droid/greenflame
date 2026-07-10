# Tontine-Produit — Récap d'implémentation
> Session du 4 juillet 2026

---

## Vue d'ensemble

Feature permettant à des utilisateurs de s'organiser en tontine pour acheter collectivement un produit marchand, ou au marchand de proposer ses produits en mode tontine (paiement échelonné communautaire). À chaque cycle, le gagnant (tiré au sort à la constitution) repart avec le produit.

Architecture **3 couches** sur le moteur tontine existant — aucun code existant cassé :

```
Moteur tontine (inchangé)
    └── Couche produit        → tontine_products (1:1 avec tontines)
         └── Couche livraison → tontine_delivery_orders (1 par cycle)
```

---

## Fichiers créés / modifiés

### 🆕 Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/062_tontine_products.sql` | Schéma SQL complet (tables + RLS + indexes) |
| `app/api/tontines/[id]/product/route.ts` | GET overlay · POST créer · PATCH valider/livraison |
| `app/api/merchant/tontines/route.ts` | GET liste tontines-produit pour ce marchand |
| `app/merchant/tontines/page.tsx` | Dashboard marchand : validation + suivi livraisons |

### ✏️ Fichiers modifiés

| Fichier | Ce qui change |
|---|---|
| `app/api/tontines/route.ts` | Ajout champ `type?: 'cash' \| 'produit'` dans l'insert |
| `app/api/tontines/[id]/membres/[membreId]/route.ts` | Auto-création bon de livraison quand `has_received_pot` → true |
| `app/(consumer)/marketplace/produit/[id]/page.tsx` | Bouton "Organiser une tontine pour ce produit" dans le CTA fixe |
| `app/(consumer)/tontine/page.tsx` | Mode produit complet (URL params, form, aperçu overlay) |
| `app/merchant/tools/page.tsx` | Lien vers `/merchant/tontines` dans la grille outils |

---

## Schéma SQL (migration 062)

```sql
-- Colonne type sur tontines (DEFAULT 'cash' = rétrocompatible)
ALTER TABLE public.tontines
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'cash'
    CHECK (type IN ('cash', 'produit'));

-- Overlay produit (1:1)
CREATE TABLE public.tontine_products (
  id              UUID PRIMARY KEY,
  tontine_id      UUID UNIQUE REFERENCES tontines ON DELETE CASCADE,
  product_id      UUID REFERENCES products ON DELETE RESTRICT,
  merchant_id     UUID REFERENCES merchants ON DELETE RESTRICT,
  product_name    TEXT NOT NULL,
  unit_price_fcfa INTEGER CHECK (unit_price_fcfa > 0),
  validated_at    TIMESTAMPTZ,        -- NULL = en attente marchand
  stock_committed BOOLEAN DEFAULT false,
  created_at / updated_at TIMESTAMPTZ
);

-- Bons de livraison (1 par cycle)
CREATE TABLE public.tontine_delivery_orders (
  id           UUID PRIMARY KEY,
  tontine_id   UUID REFERENCES tontines ON DELETE CASCADE,
  membre_id    UUID REFERENCES tontine_membres ON DELETE CASCADE,
  cycle_number INTEGER CHECK (cycle_number >= 1),
  status       TEXT DEFAULT 'en_attente'
               CHECK (status IN ('en_attente', 'prepare', 'livre', 'annule')),
  notified_at  TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes        TEXT,
  UNIQUE (tontine_id, cycle_number)   -- un seul bon par cycle
);
```

**RLS** : membres + marchand → SELECT ; créateur → INSERT ; créateur ou marchand → UPDATE.

---

## Flux utilisateur (côté consumer)

1. **Depuis la fiche produit** — bouton "🤝 Organiser une tontine pour ce produit" → redirige vers `/tontine?product_id=...&merchant_id=...&price=...&product_name=...`
2. **Formulaire tontine** — en mode produit, un bandeau affiche le produit + slider `nbParticipants` qui calcule automatiquement la cotisation par cycle (`ceil(prix / n)`)
3. **Création** — tontine créée avec `type: 'produit'`, puis overlay `tontine_products` attaché via POST
4. **Toast** — "Tontine-produit créée — le marchand va valider la disponibilité du stock."
5. **Aperçu** — dans l'onglet aperçu, un card affiche le statut de validation marchand + la liste des bons de livraison par cycle

---

## Flux marchand (`/merchant/tontines`)

### Validation en attente
- Liste des tontines-produit non encore validées (bordure amber)
- Bouton "Valider" → PATCH `action: 'validate'` → `validated_at` + `stock_committed = true`

### Suivi livraisons
- Par tontine validée : liste des membres, bons de livraison triés par `cycle_number`
- Cliquer le badge de statut fait avancer le bon : `en_attente → prepare → livre`
- States : `⏳ En attente` / `📦 Préparé` / `✅ Livré` / `🚫 Annulé`

---

## Auto-création du bon de livraison

Dans `app/api/tontines/[id]/membres/[membreId]/route.ts`, lorsque `has_received_pot` passe **false → true** sur une tontine de type `produit` :

```typescript
// Calculer le cycle = nb de membres qui ont déjà reçu leur produit (this member included)
const { count } = await svc.from('tontine_membres')
  .select('id', { count: 'exact', head: true })
  .eq('tontine_id', id)
  .eq('has_received_pot', true)

await svc.from('tontine_delivery_orders').upsert(
  { tontine_id: id, membre_id: membreId, cycle_number: count, status: 'en_attente' },
  { onConflict: 'tontine_id,cycle_number', ignoreDuplicates: true }
)
```

L'`upsert` + `ignoreDuplicates` protège contre les double-clics ou PATCH rejoués.

---

## Points de sécurité

- Le marchand ne peut valider que les tontines liées à **ses propres produits** (vérification `merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())`)
- Le créateur ne peut attacher un overlay que sur **sa propre tontine** (vérification `creator_id = auth.uid()`)
- Pas de frais d'adhésion : le champ `type` n'affecte pas les règles de commission existantes
- `WASENDER_API_KEY` reste lu depuis `.env.local` uniquement, jamais hardcodé

---

## À faire avant mise en prod

- [ ] Appliquer la migration `062_tontine_products.sql` en base Supabase
- [ ] Vérifier que la fonction `set_updated_at()` existe déjà (utilisée par le trigger)
- [ ] Tester le flux complet : fiche produit → création tontine → validation marchand → bon livraison

---

## Prochaines évolutions possibles (non implémentées)

- Notification WhatsApp au marchand quand une tontine-produit est créée pour son produit
- Tirage aléatoire automatique à la constitution (actuellement, le créateur assigne les positions)
- Assurance tontine étendue aux tontines-produit (liste d'attente remplaçant, garant Leader communautaire)
- Escrow GreenFlame : blocage de la cotisation agrégée jusqu'à livraison confirmée
