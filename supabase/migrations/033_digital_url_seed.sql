-- 033_digital_url_seed.sql
-- Renseigne digital_url sur les 3 mini-formations GreenFlame Hub
-- Les fichiers HTML sont dans /public/formations/ → servis statiquement par Next.js

UPDATE public.products
SET digital_url = 'https://greenflameafrica.com/formations/gestion-argent-quotidien.html'
WHERE name ILIKE '%Gestion d''argent au quotidien%'
  AND merchant_id = (SELECT id FROM public.merchants WHERE is_platform_hub = TRUE LIMIT 1);

UPDATE public.products
SET digital_url = 'https://greenflameafrica.com/formations/transformer-savoir-faire-en-revenu.html'
WHERE name ILIKE '%Transformer ce que tu sais%'
  AND merchant_id = (SELECT id FROM public.merchants WHERE is_platform_hub = TRUE LIMIT 1);

UPDATE public.products
SET digital_url = 'https://greenflameafrica.com/formations/epargner-enfin.html'
WHERE name ILIKE '%pargner%'
  AND merchant_id = (SELECT id FROM public.merchants WHERE is_platform_hub = TRUE LIMIT 1);
