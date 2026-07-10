# Marketplace GreenFlame — Guide de déploiement

## Fichiers créés / modifiés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/022_marketplace_categories.sql` | NOUVEAU — table + seed 14 catégories + 78 sous-catégories + vue ranking |
| `app/(consumer)/marketplace/page.tsx` | MODIFIÉ — nouvelle page avec catégories + 5 sections |
| `app/(consumer)/marketplace/categorie/[slug]/page.tsx` | NOUVEAU — page par catégorie + sous-catégories |
| `components/marketplace/CategoryGrid.tsx` | NOUVEAU — grille des 14 catégories |
| `components/marketplace/ProductCard.tsx` | NOUVEAU — carte produit + badges confiance + section scrollable |

---

## Étape 1 — Appliquer la migration SQL

Dans le dashboard Supabase → SQL Editor, coller et exécuter :

```
supabase/migrations/022_marketplace_categories.sql
```

Ou via CLI :
```bash
supabase db push
```

Vérifier que la table `marketplace_categories` contient bien 92 lignes (14 + 78).

---

## Étape 2 — Lier les produits existants aux catégories

Dans Supabase SQL Editor, exécuter ce mapping pour les produits existants :

```sql
-- Exemple : lier un produit "Eau Fifa" à la catégorie eau-boissons
UPDATE products
SET marketplace_category_id = (
  SELECT id FROM marketplace_categories WHERE slug = 'eau-boissons'
)
WHERE name ILIKE '%fifa%' OR name ILIKE '%eau%';

-- Lier les produits d'hygiène
UPDATE products
SET marketplace_category_id = (
  SELECT id FROM marketplace_categories WHERE slug = 'hygiene-beaute'
)
WHERE category IN ('BEAUTE') OR name ILIKE '%savon%' OR name ILIKE '%hygiène%';

-- Adapter selon vos produits existants
```

---

## Étape 3 — Ajouter les images de catégories

Pour chaque catégorie, générer l'image avec les prompts ci-dessous,
uploader dans Supabase Storage (bucket `marketplace-categories`),
puis mettre à jour `image_url` :

```sql
UPDATE marketplace_categories
SET image_url = 'https://[project].supabase.co/storage/v1/object/public/marketplace-categories/eau-boissons.webp'
WHERE slug = 'eau-boissons';
```

---

## Étape 4 — Vérifier l'affichage

Lancer le projet en local :
```bash
npm run dev
```

Aller sur : http://localhost:3000/marketplace

Vérifier :
- [ ] Les 14 catégories s'affichent en grille
- [ ] Cliquer sur une catégorie → page `/marketplace/categorie/[slug]`
- [ ] Les sous-catégories s'affichent comme filtres pills
- [ ] Les sections "Tendances" et "Nouveautés" affichent des produits
- [ ] La section "Dans votre réseau" apparaît quand connecté avec un réseau

---

## Étape 5 — Déployer en production

```bash
git add .
git commit -m "feat: marketplace categories + ranking + discovery sections"
git push
```

---

## Prompts d'images pour les 14 catégories

Utiliser ces prompts avec Midjourney, DALL-E 3, ou Stable Diffusion.
Format cible : 400×400 px, WebP, fond coloré non blanc.

---

### 1. Eau & Boissons — `eau-boissons`
**Prompt :**
> Flat design illustration of cold refreshing water bottles and natural fruit juices arranged neatly on a light teal/mint background. Include a Fiji-style water bottle, glass of orange juice, and traditional African bissap drink in a clay cup. Vibrant, clean, modern style. No text. Square format 400x400px.

---

### 2. Alimentation — `alimentation`
**Prompt :**
> Flat design top-down view of fresh West African market ingredients: rice, palm oil bottle, yams, plantains, tomatoes, onions, dried fish, scattered on a warm amber/orange background. Colorful, abundant, market atmosphere. No text. Square 400x400px.

---

### 3. Hygiène & Beauté — `hygiene-beaute`
**Prompt :**
> Flat design illustration of personal care products: shea butter jar, natural soap bars, coconut oil, comb, toothbrush, and small perfume bottle arranged elegantly on a soft purple/lavender background. Clean, modern African beauty aesthetic. No text. Square 400x400px.

---

### 4. Mode & Vêtements — `mode-vetements`
**Prompt :**
> Flat design illustration featuring colorful African wax print fabric (pagne), folded clothes, sandals, and a woven bag arranged artfully on a light blue background. Bold African textile patterns, vibrant colors. No text. Square 400x400px.

---

### 5. Maison & Ménage — `maison-menage`
**Prompt :**
> Flat design top-down view of household items: cleaning spray, mop, colorful ceramic bowls, kitchen utensils, folded towels, and a small potted plant on a warm terracotta/peach background. Cozy home atmosphere. No text. Square 400x400px.

---

### 6. Téléphonie & Électronique — `telephonie-electronique`
**Prompt :**
> Flat design illustration of a smartphone, earbuds, charging cable, small electric fan, and a laptop arranged on a fresh green background. Modern tech, minimal style with African market context. No text. Square 400x400px.

---

### 7. Services — `services`
**Prompt :**
> Flat design illustration showing service icons: scissors (coiffure), sewing needle and thread (couture), wrench (réparation), graduation cap (formation), arranged in a friendly collage on a soft pink background. Warm community feel. No text. Square 400x400px.

---

### 8. Agriculture & Élevage — `agriculture-elevage`
**Prompt :**
> Flat design illustration of African farming: a hoe, corn/maize ears, tomato plants, a chicken, and small seedling pots on a rich green background. Rural West African agricultural scene, earthy and vibrant. No text. Square 400x400px.

---

### 9. Bébé, Enfant & École — `bebe-enfant-ecole`
**Prompt :**
> Flat design illustration of baby and school items: baby bottle, colorful wooden toys, school backpack, pencils, exercise books, and alphabet blocks arranged playfully on a warm orange/yellow background. Cheerful, child-friendly. No text. Square 400x400px.

---

### 10. Artisanat & Culture — `artisanat-culture`
**Prompt :**
> Flat design illustration of West African crafts: hand-painted pottery, beaded jewelry, carved wooden mask, woven basket, and a small drum arranged on a deep purple background. Rich African cultural heritage, artisan craft atmosphere. No text. Square 400x400px.

---

### 11. Santé & Bien-être — `sante-bien-etre`
**Prompt :**
> Flat design illustration of natural health products: moringa powder jar, herbal tea cup, ginger roots, aloe vera plant, and a simple blood pressure monitor on a soft red/coral background. Natural wellness, African medicinal plants aesthetic. No text. Square 400x400px.

---

### 12. Construction & Bricolage — `construction-bricolage`
**Prompt :**
> Flat design illustration of construction tools: trowel, paint brush, cement bag, nails, pipe wrench, and a small brick arranged on a light blue background. Clean, professional trades atmosphere. No text. Square 400x400px.

---

### 13. Énergie & Solaire — `energie-solaire`
**Prompt :**
> Flat design illustration of solar energy products: solar panel, rechargeable lantern, battery pack, and a phone charger with sun rays in the background on a warm golden/amber background. Bright, clean energy for Africa. No text. Square 400x400px.

---

### 14. Immobilier & Location — `immobilier-location`
**Prompt :**
> Flat design illustration of a small house with palm trees, a key, a floor plan layout, and a "À louer" (for rent) sign on a fresh mint green background. West African architectural style, warm community neighborhood feel. No text. Square 400x400px.

---

## Notes techniques

- La vue `v_marketplace_products` calcule un score de classement automatique
- Le score phase 1 = tier VIP (+30 pts) / Pro (+15 pts) + popularité 30j + fraîcheur
- Phase 2 à implémenter : +35% poids réseau (via `network_tree`) + géolocalisation
- La section "Dans votre réseau" n'apparaît que si l'utilisateur est connecté et a un réseau
- `revalidate = 60` : la page se rafraîchit toutes les 60 secondes côté Next.js
