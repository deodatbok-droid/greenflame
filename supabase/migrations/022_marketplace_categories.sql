-- ============================================================
-- 022_marketplace_categories.sql
-- Architecture complète des catégories marketplace GreenFlame
-- 14 catégories · 78 sous-catégories · score de classement
-- ============================================================

-- ─── Table principale ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  description   TEXT,
  icon          TEXT,                          -- nom icône Tabler (ex: 'droplet')
  color_bg      TEXT        DEFAULT '#F1EFE8', -- fond de la tuile
  color_icon    TEXT        DEFAULT '#5F5E5A', -- couleur de l'icône
  sort_order    INTEGER     DEFAULT 99,
  parent_id     UUID        REFERENCES public.marketplace_categories(id) ON DELETE CASCADE,
  is_active     BOOLEAN     DEFAULT true,
  image_url     TEXT,                          -- image générée par IA (ajoutée après)
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mktcat_parent   ON public.marketplace_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_mktcat_slug     ON public.marketplace_categories(slug);
CREATE INDEX IF NOT EXISTS idx_mktcat_active   ON public.marketplace_categories(is_active);

-- ─── Colonnes sur products ───────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS marketplace_category_id    UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marketplace_subcategory_id UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_mktcat    ON public.products(marketplace_category_id);
CREATE INDEX IF NOT EXISTS idx_products_mktsub    ON public.products(marketplace_subcategory_id);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecture publique catégories" ON public.marketplace_categories;
CREATE POLICY "lecture publique catégories"
  ON public.marketplace_categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "admin gère les catégories" ON public.marketplace_categories;
CREATE POLICY "admin gère les catégories"
  ON public.marketplace_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role::text ILIKE '%admin%'
    )
  );

-- ─── Seed catégories racines ──────────────────────────────────
INSERT INTO public.marketplace_categories
  (slug, name, description, icon, color_bg, color_icon, sort_order)
VALUES
  ('eau-boissons',           'Eau & Boissons',          'Eau minérale, jus, boissons locales',                'droplet',               '#E1F5EE','#0F6E56', 1),
  ('alimentation',           'Alimentation',            'Épicerie, céréales, fruits, légumes, viandes',       'basket',                '#FAEEDA','#854F0B', 2),
  ('hygiene-beaute',         'Hygiène & Beauté',        'Soins du corps, cosmétiques, hygiène quotidienne',   'sparkles',              '#EEEDFE','#3C3489', 3),
  ('mode-vetements',         'Mode & Vêtements',        'Vêtements, chaussures, pagnes, accessoires',         'shirt',                 '#E6F1FB','#185FA5', 4),
  ('maison-menage',          'Maison & Ménage',         'Entretien, ustensiles, mobilier, décoration',        'home',                  '#FAECE7','#993C1D', 5),
  ('telephonie-electronique','Téléphonie & Électronique','Téléphones, électroménager, informatique',           'device-mobile',         '#EAF3DE','#3B6D11', 6),
  ('services',               'Services',                'Coiffure, couture, réparation, formation',           'tools',                 '#FBEAF0','#72243E', 7),
  ('agriculture-elevage',    'Agriculture & Élevage',   'Semences, outils, animaux, produits fermiers',       'leaf',                  '#E1F5EE','#0F6E56', 8),
  ('bebe-enfant-ecole',      'Bébé, Enfant & École',    'Puériculture, jouets, fournitures scolaires',        'school',                '#FAEEDA','#854F0B', 9),
  ('artisanat-culture',      'Artisanat & Culture',     'Art local, bijoux, pagnes, instruments de musique',  'palette',               '#EEEDFE','#3C3489',10),
  ('sante-bien-etre',        'Santé & Bien-être',       'Compléments, tisanes, matériel médical de base',     'heart-rate-monitor',    '#FCEBEB','#A32D2D',11),
  ('construction-bricolage', 'Construction & Bricolage','Matériaux, outillage, quincaillerie',                'building-store',        '#E6F1FB','#185FA5',12),
  ('energie-solaire',        'Énergie & Solaire',       'Panneaux solaires, batteries, éclairage, groupes',   'solar-panel',           '#FAEEDA','#854F0B',13),
  ('immobilier-location',    'Immobilier & Location',   'Maisons, appartements, terrains, locaux commerciaux','building',              '#E1F5EE','#0F6E56',14)
ON CONFLICT (slug) DO NOTHING;

-- ─── Seed sous-catégories ─────────────────────────────────────
-- Eau & Boissons
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='eau-boissons')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'droplet','#E1F5EE','#1D9E75',s.ord,parent.id FROM parent, (VALUES
  ('eau-minerale','Eau minérale & eau de source',1),
  ('jus-fruits','Jus de fruits naturels',2),
  ('boissons-gazeuses','Boissons gazeuses',3),
  ('boissons-locales','Boissons locales traditionnelles',4),
  ('lait-boissons-lactees','Lait & boissons lactées',5),
  ('the-cafe-infusions','Thé, café & infusions',6)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Alimentation
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='alimentation')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'basket','#FAEEDA','#BA7517',s.ord,parent.id FROM parent, (VALUES
  ('cereales-riz','Céréales, riz & féculents',1),
  ('huiles-condiments','Huiles & condiments',2),
  ('legumes-tubercules','Légumes & tubercules',3),
  ('fruits-frais','Fruits frais',4),
  ('viandes-poissons','Viandes & poissons',5),
  ('produits-transformes','Produits transformés locaux',6),
  ('epices-aromates','Épices & aromates',7),
  ('snacks-confiseries','Snacks & confiseries',8)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Hygiène & Beauté
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='hygiene-beaute')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'sparkles','#EEEDFE','#534AB7',s.ord,parent.id FROM parent, (VALUES
  ('soins-corps-savons','Soins du corps & savons',1),
  ('soins-capillaires','Soins capillaires',2),
  ('hygiene-bucco-dentaire','Hygiène bucco-dentaire',3),
  ('parfums-deodorants','Parfums & déodorants',4),
  ('cosmetiques-maquillage','Cosmétiques & maquillage',5),
  ('hygiene-feminine','Hygiène féminine',6),
  ('soins-bebe-enfant','Soins bébé & enfant',7)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Mode & Vêtements
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='mode-vetements')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'shirt','#E6F1FB','#185FA5',s.ord,parent.id FROM parent, (VALUES
  ('vetements-homme','Vêtements homme',1),
  ('vetements-femme','Vêtements femme',2),
  ('vetements-enfant','Vêtements enfant',3),
  ('chaussures-sandales','Chaussures & sandales',4),
  ('accessoires-mode','Accessoires (sacs, ceintures…)',5),
  ('tissus-pagnes-wax','Tissus, pagnes & wax',6)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Maison & Ménage
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='maison-menage')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'home','#FAECE7','#993C1D',s.ord,parent.id FROM parent, (VALUES
  ('produits-entretien','Produits d''entretien & nettoyage',1),
  ('vaisselle-ustensiles','Vaisselle & ustensiles de cuisine',2),
  ('linge-maison','Linge de maison',3),
  ('mobilier-decoration','Mobilier & décoration',4),
  ('materiel-cuisine','Matériel de cuisine',5),
  ('eclairage-electricite','Éclairage & électricité',6)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Téléphonie & Électronique
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='telephonie-electronique')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'device-mobile','#EAF3DE','#3B6D11',s.ord,parent.id FROM parent, (VALUES
  ('telephones-smartphones','Téléphones & smartphones',1),
  ('accessoires-telephone','Accessoires téléphone',2),
  ('electromenager','Électroménager',3),
  ('audio-tv-image','Audio, TV & image',4),
  ('informatique-tablettes','Informatique & tablettes',5)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Services
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='services')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'tools','#FBEAF0','#72243E',s.ord,parent.id FROM parent, (VALUES
  ('coiffure-esthetique','Coiffure & esthétique',1),
  ('couture-retouches','Couture & retouches',2),
  ('reparation-maintenance','Réparation & maintenance',3),
  ('transport-livraison','Transport & livraison',4),
  ('traiteur-cuisine','Traiteur & cuisine à domicile',5),
  ('enseignement-formation','Enseignement & formation',6),
  ('informatique-impression','Informatique & impression',7),
  ('evenements-animation','Événements & animation',8)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Agriculture & Élevage
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='agriculture-elevage')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'leaf','#E1F5EE','#0F6E56',s.ord,parent.id FROM parent, (VALUES
  ('semences-plants','Semences & plants',1),
  ('outils-agricoles','Outils agricoles',2),
  ('animaux-elevage','Animaux d''élevage',3),
  ('produits-fermiers','Produits fermiers directs',4),
  ('intrants-naturels','Intrants agricoles naturels',5)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Bébé, Enfant & École
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='bebe-enfant-ecole')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'school','#FAEEDA','#854F0B',s.ord,parent.id FROM parent, (VALUES
  ('alimentation-bebe','Alimentation bébé',1),
  ('puericulture-soins','Puériculture & soins bébé',2),
  ('jouets-jeux','Jouets & jeux',3),
  ('fournitures-scolaires','Fournitures scolaires',4),
  ('livres-cahiers','Livres & cahiers',5)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Artisanat & Culture
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='artisanat-culture')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'palette','#EEEDFE','#534AB7',s.ord,parent.id FROM parent, (VALUES
  ('art-objets-decoratifs','Art & objets décoratifs',1),
  ('bijoux-traditionnels','Bijoux & accessoires traditionnels',2),
  ('maroquinerie-locale','Maroquinerie locale',3),
  ('musique-instruments','Musique & instruments',4),
  ('livres-medias-culture','Livres, médias & culture',5)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Santé & Bien-être
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='sante-bien-etre')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'heart-rate-monitor','#FCEBEB','#A32D2D',s.ord,parent.id FROM parent, (VALUES
  ('complements-alimentaires','Compléments alimentaires',1),
  ('tisanes-medecines-naturelles','Tisanes & médecines naturelles',2),
  ('materiel-medical-base','Matériel médical de base',3),
  ('sport-fitness','Sport & fitness',4)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Construction & Bricolage
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='construction-bricolage')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'building-store','#E6F1FB','#185FA5',s.ord,parent.id FROM parent, (VALUES
  ('materiaux-construction','Matériaux de construction',1),
  ('outillage-quincaillerie','Outillage & quincaillerie',2),
  ('peinture-finition','Peinture & finition',3),
  ('plomberie-sanitaire','Plomberie & sanitaire',4)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Énergie & Solaire
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='energie-solaire')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'solar-panel','#FAEEDA','#854F0B',s.ord,parent.id FROM parent, (VALUES
  ('panneaux-solaires','Panneaux solaires & kits',1),
  ('batteries-stockage','Batteries & stockage',2),
  ('lampes-solaires','Lampes solaires & éclairage',3),
  ('groupes-electrogenes','Groupes électrogènes',4),
  ('accessoires-cablage','Accessoires & câblage',5),
  ('chargeurs-onduleurs','Chargeurs & onduleurs',6)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- Immobilier & Location
WITH parent AS (SELECT id FROM public.marketplace_categories WHERE slug='immobilier-location')
INSERT INTO public.marketplace_categories (slug,name,icon,color_bg,color_icon,sort_order,parent_id)
SELECT s.slug,s.name,'building','#E1F5EE','#0F6E56',s.ord,parent.id FROM parent, (VALUES
  ('maisons-villas','Maisons & villas à louer',1),
  ('appartements-studios','Appartements & studios',2),
  ('terrains-parcelles','Terrains & parcelles',3),
  ('locaux-commerciaux','Locaux commerciaux',4),
  ('vente-proprietes','Vente de propriétés',5)
) AS s(slug,name,ord)
ON CONFLICT (slug) DO NOTHING;

-- ─── Vue ranking marketplace ──────────────────────────────────
-- Score simplifié phase 1 : tier marchand + popularité + fraîcheur
DROP VIEW IF EXISTS public.v_marketplace_products CASCADE;
CREATE OR REPLACE VIEW public.v_marketplace_products AS
SELECT
  p.id,
  p.name,
  p.description,
  p.price_fcfa,
  p.emoji,
  p.image_url,
  p.category,
  p.stock_quantity,
  p.is_available,
  p.created_at                                          AS product_created_at,
  p.marketplace_category_id,
  p.marketplace_subcategory_id,
  mc.slug                                               AS category_slug,
  mc.name                                               AS category_name,
  mc.color_bg                                           AS category_color_bg,
  mc.color_icon                                         AS category_color_icon,
  msc.slug                                              AS subcategory_slug,
  msc.name                                              AS subcategory_name,
  m.id                                                  AS merchant_id,
  m.business_name,
  m.subscription_tier,
  m.subscription_expires_at,
  m.is_active                                           AS merchant_active,
  m.user_id                                             AS merchant_user_id,
  -- Score de classement phase 1
  (
    CASE m.subscription_tier
      WHEN 'vip' THEN
        CASE WHEN m.subscription_expires_at > now() THEN 30 ELSE 0 END
      WHEN 'pro' THEN 15
      ELSE 0
    END
    + COALESCE((
        SELECT COUNT(*)::int * 2
        FROM public.transactions t
        WHERE t.product_id = p.id
          AND t.status = 'completed'
          AND t.created_at > now() - INTERVAL '30 days'
      ), 0)
    + CASE
        WHEN p.created_at > now() - INTERVAL '7 days'  THEN 10
        WHEN p.created_at > now() - INTERVAL '14 days' THEN 5
        ELSE 0
      END
  )                                                     AS ranking_score
FROM public.products p
JOIN public.merchants m ON m.id = p.merchant_id
LEFT JOIN public.marketplace_categories mc  ON mc.id = p.marketplace_category_id
LEFT JOIN public.marketplace_categories msc ON msc.id = p.marketplace_subcategory_id
WHERE p.is_available = true
  AND m.is_active = true
  AND (p.subscription_trigger IS NULL);

COMMENT ON VIEW public.v_marketplace_products IS
  'Produits marketplace avec score de classement. Phase 2 : ajouter réseau (network_tree) et géolocalisation.';
