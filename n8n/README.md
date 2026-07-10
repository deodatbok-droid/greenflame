# n8n — Automatisations GreenFlame

n8n est le moteur d'automatisation de GreenFlame. Il orchestre les rappels d'abonnement,
les relances d'inactivité, et tous les workflows qui ne nécessitent pas de logique métier complexe.

---

## 1. Installation (self-hosted avec Docker)

### Prérequis
- VPS Ubuntu 22.04 (minimum 1 vCPU / 1 Go RAM) — même serveur que l'app si possible
- Docker + Docker Compose installés
- Domaine ou sous-domaine dédié (ex: n8n.greenflame.app)

### Lancer n8n

```bash
mkdir -p ~/n8n-data
docker run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -e N8N_HOST=n8n.greenflame.app \
  -e N8N_PORT=5678 \
  -e N8N_PROTOCOL=https \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=MotDePasseFort \
  -e WEBHOOK_URL=https://n8n.greenflame.app/ \
  -e GENERIC_TIMEZONE=Africa/Porto-Novo \
  -v ~/n8n-data:/home/node/.n8n \
  n8nio/n8n
```

Accès : https://n8n.greenflame.app (ou http://localhost:5678 en local)

---

## 2. Configuration des variables globales

Dans n8n → Settings → Variables, créer :

| Variable              | Valeur exemple                          |
|-----------------------|-----------------------------------------|
| GREENFLAME_URL        | https://greenflame.app                  |
| INTERNAL_API_SECRET   | (copier depuis .env.local)              |

---

## 3. Import du workflow de rappels d'expiration

1. Ouvrir n8n → Workflows → Import from file
2. Sélectionner `n8n/workflows/subscription-expiry-reminders.json`
3. Vérifier que les variables GREENFLAME_URL et INTERNAL_API_SECRET sont bien renseignées
4. Activer le workflow (toggle en haut à droite)

### Ce que fait le workflow

Chaque jour à 8h (heure de Porto-Novo, UTC+1) :

```
[Cron 8h]
  → [Split: fenêtres 7j, 3j, 1j]
    → [GET /api/internal/expiring-subscriptions?days=N]
      → [Si count > 0]
        → [Split par marchand]
          → [POST /api/internal/expiring-subscriptions]
            → SMS Africa's Talking + Notification in-app
```

---

## 4. Générer la clé secrète

```bash
openssl rand -hex 32
# Exemple : a3f8d2e1c4b7a9f0e8d3c6b5a4f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4
```

Copier cette valeur dans :
- `.env.local` → `INTERNAL_API_SECRET=...`
- `.env.production` → `INTERNAL_API_SECRET=...`
- n8n → Settings → Variables → `INTERNAL_API_SECRET`

---

## 5. Test manuel

Pour tester sans attendre le cron :

```bash
# Tester le GET (remplacer TOKEN et URL)
curl -H "Authorization: Bearer TOKEN" \
  "https://greenflame.app/api/internal/expiring-subscriptions?days=7"

# Tester le POST (notification pour un marchand spécifique)
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"merchant_id":"UUID_ICI","days_remaining":7}' \
  "https://greenflame.app/api/internal/expiring-subscriptions"
```

Dans n8n : ouvrir le workflow → cliquer "Test workflow" (exécution manuelle immédiate).

---

## 6. Autres workflows à ajouter (feuille de route)

| Workflow                         | Déclencheur         | Canal         | Priorité |
|----------------------------------|---------------------|---------------|----------|
| Relance membre inactif (30j)     | Cron hebdo          | SMS + notif   | Haute    |
| Résumé hebdo marchand            | Cron lundi 9h       | SMS + email   | Moyenne  |
| Alerte fraude (score > 80)       | Webhook Supabase    | Notif admin   | Haute    |
| Onboarding J+1 (nouveau membre)  | Webhook inscription | SMS           | Haute    |
| Rapport admin mensuel            | Cron 1er du mois    | Email         | Basse    |

---

## 7. Monitoring

n8n conserve les logs d'exécution dans Settings → Executions.
Pour chaque run quotidien, vérifier :
- Statut : Success / Error
- Nombre de marchands traités
- SMS envoyés vs échoués

En cas d'erreur persistante, configurer un workflow "error handler" dans
Settings → General → Error workflow.
