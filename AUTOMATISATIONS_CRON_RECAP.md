# Automatisations GreenFlame — Migration n8n → Vercel Cron

**Contexte :** deux automatisations étaient prévues pour être pilotées depuis n8n
(rappels d'expiration d'abonnement J-7/J-3/J-1, et calcul nocturne des profils IA).
Plutôt que d'ajouter n8n comme brique externe supplémentaire (compte, hébergement,
interface à apprendre), on les a branchées directement sur **Vercel Cron Jobs**,
déjà inclus dans le plan Pro et déjà utilisé avec succès pour `daily-digest`.

## Ce qui a changé

### 1. `vercel.json`
Ajout de 4 tâches programmées, à côté de `daily-digest` qui existait déjà :

| Tâche | Chemin | Fréquence |
|---|---|---|
| Rappel expiration J-7 | `/api/internal/expiring-subscriptions?days=7` | tous les jours à 8h |
| Rappel expiration J-3 | `/api/internal/expiring-subscriptions?days=3` | tous les jours à 8h |
| Rappel expiration J-1 | `/api/internal/expiring-subscriptions?days=1` | tous les jours à 8h |
| Profils IA (scoring) | `/api/internal/compute-ai-profiles` | tous les jours à 2h |

### 2. `app/api/internal/expiring-subscriptions/route.ts`
La fonction `authorize()` accepte désormais le secret `CRON_SECRET` envoyé
automatiquement par Vercel Cron (`Authorization: Bearer <CRON_SECRET>`),
en plus de l'ancien `INTERNAL_API_SECRET` (conservé pour les tests manuels).

### 3. `app/api/internal/compute-ai-profiles/route.ts`
Même principe : accepte `Authorization: Bearer <CRON_SECRET>` (Vercel Cron)
ou l'ancien header `x-internal-secret` (legacy/manuel).

C'est exactement le même mécanisme d'authentification que `daily-digest`,
qui tourne déjà en production sans souci.

## Ce qu'il reste à faire (côté Aurel)

1. **Vérifier `CRON_SECRET`** dans Vercel → Settings → Environment Variables.
   Comme `daily-digest` fonctionne déjà avec ce secret, il devrait déjà y être.
   - S'il n'y est pas : générer une valeur aléatoire (`openssl rand -hex 32`),
     l'ajouter comme variable d'environnement (Production), puis redéployer.
2. **Pousser le code et redéployer.** Vercel détecte automatiquement les
   nouvelles entrées de `vercel.json` et active les tâches au déploiement
   suivant — aucune configuration manuelle supplémentaire dans le dashboard.
3. **Vérifier dans les Logs Vercel** (onglet Cron Jobs / Runtime Logs) que les
   tâches se déclenchent bien aux horaires prévus, et qu'elles répondent `200`.

## Pourquoi pas n8n ?

- Zéro nouvelle brique à héberger, payer ou apprendre
- Même secret, même schéma d'authentification que ce qui tourne déjà
- Les automatisations prévues sont de simples appels HTTP programmés —
  exactement ce que fait Vercel Cron nativement, gratuitement (inclus au plan Pro)
- n8n garde son intérêt si un jour GreenFlame a besoin d'enchaîner des étapes
  complexes entre plusieurs services avec une logique conditionnelle visuelle —
  ce qui n'est pas le cas de ces deux automatisations

## Fichiers concernés

- `vercel.json`
- `app/api/internal/expiring-subscriptions/route.ts`
- `app/api/internal/compute-ai-profiles/route.ts`
- (référence) `app/api/cron/daily-digest/route.ts` — modèle déjà en prod
