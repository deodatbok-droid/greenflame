# GreenFlame — Gestion de stock marchand

> Fichier : `app/merchant/products/ProductsClient.tsx`  
> Accès : `/merchant/products`  
> Tier requis : Free (limité) · Pro / VIP (illimité)

---

## Architecture

La gestion de stock est intégrée directement dans la page Produits, sans page dédiée séparée. Elle fonctionne en deux couches :

1. **`app/merchant/products/page.tsx`** — server component : récupère le tier du marchand, calcule la limite, passe les props
2. **`app/merchant/products/ProductsClient.tsx`** — client component : toute la logique d'affichage, de création, d'édition et d'ajustement du stock en temps réel

---

## Modèle de données

### Colonne `products.stock_quantity`

| Valeur | Signification |
|--------|--------------|
| `NULL` | Stock illimité — aucun suivi |
| `0` | Rupture de stock |
| `> 0` | Quantité disponible |

### Colonne `products.commission_rate`

| Valeur | Signification |
|--------|--------------|
| `NULL` | Utilise le taux par défaut de la boutique (`merchants.commission_rate`) |
| `0.05` | Taux spécifique à ce produit (ici 5%) |

### Autres colonnes liées
```sql
is_available   BOOLEAN   -- masque/affiche le produit à la vente
sort_order     INTEGER   -- ordre d'affichage dans la boutique
```

---

## Fonctionnalités implémentées

### 1. Création de produit — flow en 2 étapes

**Étape 1 — Sélection de catégorie**
8 catégories disponibles avec emoji et sous-catégories :

| Code | Label | Sous-catégories |
|------|-------|-----------------|
| `ALIMENTATION` | Alimentation | Épicerie, Fruits & Légumes, Viandes, Boissons... |
| `RESTAURANT` | Restauration | Repas complets, Petit-déjeuner, Grillades... |
| `BEAUTE` | Beauté & Mode | Cosmétiques, Soin visage, Capillaire, Bijoux... |
| `PHARMACIE` | Santé | Médicaments, Vitamines, Hygiène, Matériel... |
| `ELECTRONIQUE` | Électronique | Téléphones, Informatique, Accessoires, TV... |
| `VETEMENTS` | Vêtements | Femme, Homme, Enfant, Chaussures, Sacs... |
| `SERVICES` | Services | Réparation, Coiffure, Livraison, Formation... |
| `TRANSPORT_SMALL` | Carburant & Crédit | Carburant, Crédit téléphone, Transport... |

**Étape 2 — Formulaire produit**
- Nom (requis), description (optionnel)
- Prix en FCFA (requis)
- Type de stock : **Illimité** ou **Quantité** (champ numérique)
- Commission : **Défaut boutique** ou **Personnalisée** (0–50%)
- Icône emoji : palette contextuelle selon la catégorie

### 2. Affichage du stock en temps réel

Chaque produit affiche son état stock avec code couleur :

| Badge | Condition | Style |
|-------|-----------|-------|
| `∞ Illimité` | `stock_quantity === null` | Vert |
| `N en stock` | `stock_quantity > 5` | Vert |
| `N en stock ⚠️` | `0 < stock_quantity <= 5` | Amber (alerte faible stock) |
| `Rupture de stock` | `stock_quantity === 0` | Rouge |

La **bordure de la carte produit** change aussi :
- Stock normal → `border-gray-100`
- Faible stock → `border-amber-200`
- Rupture / masqué → `border-gray-100 opacity-60`

### 3. Ajustement rapide du stock (boutons + / −)

Disponible directement sur la carte produit pour les produits avec quantité définie :

```tsx
async function adjustStock(p: Product, delta: number) {
  if (p.stock_quantity === null) return
  const next = Math.max(0, p.stock_quantity + delta)     // jamais en dessous de 0
  await supabase.from('products').update({ stock_quantity: next }).eq('id', p.id)
  setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock_quantity: next } : x))
}
```

Mise à jour **optimiste** : l'UI change immédiatement, Supabase confirme en arrière-plan.

### 4. Toggle disponibilité

Bouton **"En vente" / "Masqué"** sur chaque produit :
- `is_available = true` → produit visible dans la boutique, badge vert
- `is_available = false` → produit masqué pour les clients, opacité réduite

```tsx
async function toggleAvailable(p: Product) {
  await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id)
  setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: !x.is_available } : x))
}
```

### 5. Regroupement par catégorie

Les produits sont affichés groupés par catégorie avec header emoji + compteur :

```tsx
const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
  if (!acc[p.category]) acc[p.category] = []
  acc[p.category].push(p)
  return acc
}, {})
```

---

## Système de limite par tier

### Calcul de la limite (`page.tsx`)
```ts
const productLimit = activeTier === 'free' ? 10 : Infinity
```

### Comportements selon le nombre de produits (tier FREE)

| Produits | Comportement |
|----------|-------------|
| 0 – 7 | Normal, compteur dans le bouton |
| 8 – 9 | Bannière amber d'avertissement + CTA upgrade |
| 10 | Bouton désactivé, bloc upgrade Pro affiché |

### Bannière d'avertissement (≥ 8 produits)
```tsx
{isFree && products.length >= FREE_LIMIT - 2 && products.length < FREE_LIMIT && (
  <div className="bg-amber-50 border border-amber-200 ...">
    {FREE_LIMIT - products.length} emplacement(s) restant(s)
    → CTA "Passer Pro"
  </div>
)}
```

### Bloc de blocage (≥ 10 produits)
```tsx
{isFree && products.length >= FREE_LIMIT ? (
  <div className="bg-gradient-to-r from-brand-700 ...">
    🔒 Limite de 10 produits atteinte
    → CTA "Passer en Pro — 10 000 FCFA/mois"
  </div>
) : (
  <button onClick={openNew}>+ Ajouter un produit ({FREE_LIMIT - products.length} restant(s))</button>
)}
```

---

## Flux de données

```
page.tsx (server)
  ├── supabase.auth.getUser()
  ├── merchants → subscription_tier, subscription_expires_at
  ├── calcule isPro, productLimit
  └── <ProductsClient tier={...} productLimit={...} />

ProductsClient.tsx (client, useEffect)
  ├── supabase.auth.getUser()
  ├── merchants → id
  └── products → id, name, price_fcfa, stock_quantity, is_available, ...
        ↓
      State local : products[], showForm, step, editId
        ↓
      Actions : save(), toggleAvailable(), adjustStock(), deleteProduct()
        ↓
      Supabase update temps réel + état optimiste local
```

---

## Points d'extension futurs

| Feature | Complexité | Notes |
|---------|-----------|-------|
| Alerte stock bas par notification | Moyenne | Supabase pg_notify ou cron job |
| Historique des mouvements de stock | Moyenne | Nouvelle table `stock_movements` |
| Import CSV produits en masse | Moyenne | Papa Parse + insert batch |
| Variantes produit (taille, couleur) | Haute | Table `product_variants` séparée |
| Code-barres / QR par produit | Haute | Lib QR + champ `barcode` |
| Réapprovisionnement automatique | Haute | Webhook fournisseur ou saisie manuelle |

---

## Requêtes SQL directes utiles

```sql
-- Produits en rupture de stock par marchand
SELECT m.business_name, p.name, p.stock_quantity
FROM products p
JOIN merchants m ON m.id = p.merchant_id
WHERE p.stock_quantity = 0
ORDER BY m.business_name;

-- Produits faible stock (≤ 5 unités)
SELECT m.business_name, p.name, p.stock_quantity
FROM products p
JOIN merchants m ON m.id = p.merchant_id
WHERE p.stock_quantity IS NOT NULL AND p.stock_quantity <= 5 AND p.stock_quantity > 0
ORDER BY p.stock_quantity ASC;

-- Marchands free ayant atteint la limite de 10 produits
SELECT m.business_name, COUNT(p.id) as nb_produits
FROM products p
JOIN merchants m ON m.id = p.merchant_id
WHERE m.subscription_tier = 'free'
GROUP BY m.id, m.business_name
HAVING COUNT(p.id) >= 10;
```
