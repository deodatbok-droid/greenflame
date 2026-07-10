# Outils Sectoriels — Architecture & État du système

> Dernière mise à jour : 13 juin 2026  
> Auteur : GreenFlame Engineering

---

## Vue d'ensemble

Le système d'outils sectoriels permet à GreenFlame de proposer à chaque marchand Pro un outil professionnel taillé sur mesure pour son secteur d'activité — sans construire un nouveau composant par secteur.

**Principe** : un composant unique (`UniversalDevisClient`) paramétré par une configuration (`SectorConfig`) couvre tous les secteurs. Ajouter un secteur = 20 lignes de config + une page de 10 lignes.

---

## Fichiers produits

### 1. Configuration des secteurs
```
lib/tools/sector-configs.ts
```
Registre central de tous les secteurs. Interfaces TypeScript, configs pour 8 secteurs + helper `getSectorConfig()`.

**Secteurs disponibles :**
| Clé | Secteur | Icône |
|-----|---------|-------|
| `consultant` | Consultant / Solopreneur | 💼 |
| `avocat` | Avocat / Juriste | ⚖️ |
| `photographe` | Photographe / Vidéaste | 📸 |
| `transporteur` | Transport / Livraison | 🚛 |
| `medecin` | Médecin / Clinique | 🏥 |
| `coach` | Coach / Formateur | 🎯 |
| `evenement` | Événementiel / Déco | 🎉 |
| `imprimerie` | Imprimerie / Comm visuelle | 🖨️ |

**Interface SectorConfig :**
```typescript
interface SectorConfig {
  id: string
  toolName: string
  icon: string
  documentTitle: string     // Ex : "Devis de Mission"
  documentPrefix: string    // Ex : "MISS-"
  clientLabel: string       // Ex : "Client" / "Patient" / "Mandant"
  clientPlaceholder: string
  units: string[]           // Ex : ["heure", "demi-journée", "jour"]
  defaultLineItems: DefaultLineItem[]
  extraFields: ExtraField[] // Champs spécifiques au secteur
  generateBtnLabel: string
  footerNote: string
  docType: 'devis' | 'facture'
  accentColor?: string
}
```

---

### 2. Composant universel
```
components/tools/UniversalDevisClient.tsx
```
Composant React client. Reçoit `config: SectorConfig`, `businessName: string`, `isPro: boolean`.

**Fonctionnalités :**
- Lignes dynamiques avec sélecteur d'unité par ligne
- Champs extra configurables (text / date / number / textarea / select)
- Génération PDF avec branding sectoriel
- Historique devis/factures avec gestion de statut
- Conversion devis → facture
- Limite free (5/mois via localStorage) avec wall Pro
- Sauvegarde vers `/api/documents`, log vers `user_events`

---

### 3. Pages outils (pattern)
```
app/merchant/tools/[secteur]/page.tsx
```
Server Component, 10 lignes. Cherche le merchant, vérifie le tier, instancie UniversalDevisClient.

**Exemple — Consultant :**
```tsx
// app/merchant/tools/consultant/page.tsx
export default async function ConsultantToolPage() {
  const session = await getServerSession(authOptions)
  const merchant = await db.merchant.findUnique({ ... })
  const isPro = ['pro', 'vip'].includes(merchant.subscription_tier)
  return (
    <UniversalDevisClient
      config={SECTOR_CONFIGS.consultant}
      businessName={merchant.business_name}
      isPro={isPro}
    />
  )
}
```

**Pour créer un nouveau secteur :**
1. Ajouter une entrée dans `lib/tools/sector-configs.ts`
2. Copier `app/merchant/tools/consultant/page.tsx` → changer la clé de config
3. C'est tout.

---

### 4. Flow d'activation sectorielle
```
app/merchant/tools/activer/
  ├── page.tsx                   ← Server component (guard + redirect)
  └── SectorOnboardingClient.tsx ← Flow multi-étapes (client)
```

**Étapes du flow :**
```
Étape 0 → Écran "Offre de lancement"
           (Pro benefits + personnalisation offerte valeur 5 000 FCFA)
Étape 1 → Q1 : Secteur d'activité (cards avec icônes)
Étape 2 → Q2 : Type de clientèle (B2C / B2B / Mixte)
Étape 3 → Q3 : Panier moyen (4 tranches FCFA)
Étape 4 → Q4 : Volume mensuel (4 tranches)
Étape 5 → Q5 : Défis principaux (multi-select, max 2)
Étape 6 → Q6 : Ancienneté (4 tranches)
Étape 7 → Aperçu de l'outil configuré (preview avec les vraies données)
Étape 8 → Confirmation d'activation ✓
```

**Logique `page.tsx` :**
- Non authentifié → `/login`
- Pas Pro → `/merchant/upgrade?reason=sector_tool`
- Déjà activé → `/merchant/tools/[sector]` (direct)
- Sinon → affiche le flow

---

### 5. API onboarding sectoriel
```
app/api/merchant/onboarding/route.ts
```

**GET** `/api/merchant/onboarding`
```json
{
  "merchant": { "id", "subscription_tier", "sector", "sector_activated_at" },
  "onboarding": { ...réponses... } | null
}
```

**POST** `/api/merchant/onboarding`
```json
{
  "sector": "consultant",
  "client_type": "B2B",
  "avg_basket": "50k-200k",
  "monthly_volume": "10-30",
  "main_challenges": ["clients", "paiement"],
  "seniority": "2y-5y"
}
```
- Vérifie tier Pro (403 sinon)
- Valide tous les champs
- Upsert `merchant_onboarding_responses`
- Met à jour `merchants.sector`, `sector_client_type`, `sector_activated_at`
- Log événement IA `feature_used / sector_tool_activated` (non bloquant)

---

### 6. Migration SQL
```
supabase/migrations/049_merchant_sector_onboarding.sql
```

**Ce que ça fait :**
- Ajoute 3 colonnes à `merchants` : `sector`, `sector_client_type`, `sector_activated_at`
- Crée `merchant_onboarding_responses` (UNIQUE sur `merchant_id` → upsertable)
- 4 index analytiques
- Trigger `updated_at`
- Vue `v_sector_analytics` : distribution, taux activation, B2C/B2B, basket/volume/seniority modaux
- Vue `v_challenges_analytics` : fréquence des défis + % marchands
- RLS : marchand voit ses propres données, `service_role` voit tout

---

### 7. Dashboard analytics admin
```
app/admin/analytics/merchants/
  ├── page.tsx                    ← Server component (données SQL + auth admin)
  └── MerchantAnalyticsClient.tsx ← Dashboard 3 onglets
```

**Onglet 1 — Vue d'ensemble :**
- 5 KPIs : total marchands, Pro, outil activé, questionnaires, taux activation
- Classement des défis terrain avec barre de progression
- Mini-répartition sectorielle

**Onglet 2 — Par secteur :**
- Cards par secteur : total réponses, taux activation, B2C/B2B/mixte, panier modal, volume modal, ancienneté

**Onglet 3 — Marchands :**
- Tableau filtrable par secteur + recherche texte
- Colonnes : Marchand, Plan, Secteur, Type client, Panier, Volume, Défis, Date activation

---

## À faire (Prisma schema)

Ajouter dans `schema.prisma` :

```prisma
model Merchant {
  // ... champs existants ...
  sector               String?
  sector_client_type   String?
  sector_activated_at  DateTime?
  onboarding_response  MerchantOnboardingResponse?
}

model MerchantOnboardingResponse {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  merchant_id      String    @unique @db.Uuid
  sector           String
  client_type      String
  avg_basket       String
  monthly_volume   String
  main_challenges  String[]
  seniority        String
  tool_activated   Boolean   @default(false)
  activated_at     DateTime?
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

  merchant         Merchant  @relation(fields: [merchant_id], references: [id], onDelete: Cascade)

  @@map("merchant_onboarding_responses")
}
```

Ensuite :
```bash
npx prisma generate
npx prisma migrate deploy  # ou supabase db push
```

---

## Mécanique business

| Élément | Détail |
|---------|--------|
| Déclencheur | Marchand Pro → onglet "Outils" → bannière "Personnaliser mon outil" |
| Valeur proposée | Personnalisation sectorielle offerte (normalement +5 000 FCFA/mois) |
| Contrepartie | Remplissage du questionnaire 6 questions (~2 min) |
| Ce que GreenFlame gagne | Données terrain : secteur, panier, volume, défis — alimentation profil IA |
| Après activation | Redirection directe vers `/merchant/tools/[sector]` — outil déjà configuré |
| Période de lancement | Offre gratuite jusqu'à date à définir |

---

## Flux de données dual-purpose

```
Questionnaire marchand (6 questions)
        │
        ├──► merchant_onboarding_responses (config outil)
        │         │
        │         └──► UniversalDevisClient reçoit SectorConfig adapté
        │
        └──► user_events (profil IA)
                  │
                  └──► /api/internal/compute-ai-profiles (scoring quotidien)
```

---

## Outils existants (non touchés)

Les outils spécialisés construits précédemment (Coiffure, Couture, Restauration, BTP, Tontines) restent **exactement tels quels** dans leurs routes respectives. Le système universel s'applique uniquement aux nouveaux secteurs.
