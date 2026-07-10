# GreenFlame — Récap i18n FR/EN

> **Date** : juin 2026  
> **Statut** : Infrastructure complète · Pages critiques traduites · Reste de l'app à couvrir

---

## 1. Décisions prises

| Choix | Décision |
|-------|----------|
| Structure URL | `/fr/...` et `/en/...` (préfixe locale dans le path) |
| Contenu traduit | Interface uniquement — le contenu marchand reste en français |
| Toggle | Bouton `FR \| EN` dans l'UI (coin supérieur droit des pages auth) |
| Couverture | Option C — app entière, commencé par les pages critiques |
| Locale par défaut | `fr` (aucun préfixe dans les URLs française) |

---

## 2. Architecture — fichiers créés

### Fichiers JSON de traduction

```
messages/
  fr.json     ← source de vérité (français)
  en.json     ← traduction anglaise (miroir de fr.json)
```

**Sections couvertes dans les deux JSONs :**
- `nav` — labels de navigation (Accueil, Marché, Payer, Wallet…)
- `common` — mots communs (Charger, Envoyer, Annuler, ou…)
- `login` — page de connexion complète
- `register` — inscription complète (4 étapes : phone → OTP → profil → KYC)
- `dashboard` — tableau de bord consommateur
- `wallet` — portefeuille (ledger, breakdown par niveau)
- `pay` — flux de paiement multi-étapes
- `marketplace` — marketplace produits

### Moteur de traduction

**`lib/i18n/index.ts`**
```ts
export type Locale = 'fr' | 'en'
export const locales: Locale[] = ['fr', 'en']
export const defaultLocale: Locale = 'fr'

// Type Flatten<T> — génère l'union de toutes les clés dot-notation
// ex: 'login.title' | 'wallet.ledger.cashback' | ...
export type TranslationKey = Flatten<typeof fr>

export function getTranslations(locale: Locale): (key: TranslationKey) => string
```

**`lib/i18n/server.ts`**
```ts
// Pour les Server Components — lit le header x-locale injecté par le middleware
export async function getServerT(): Promise<{ t: (key) => string; locale: Locale }>
```

### Provider React (côté client)

**`components/providers/LocaleProvider.tsx`**
```tsx
// Wrap de toute l'app dans app/layout.tsx
<LocaleProvider locale={locale}>
  {children}
</LocaleProvider>

// Hook dans n'importe quel Client Component
const { t, locale } = useLocale()
```

### Composant toggle

**`components/ui/LangToggle.tsx`**
```tsx
// Usage : <LangToggle className="text-white/80" />
// Affiche : FR | EN (locale active en gras brand-600)
// Navigue vers /{newLocale}{pathname} via router.push()
```

---

## 3. Middleware — réécriture des URLs

**`middleware.ts`** — logique ajoutée au middleware existant (Supabase auth) :

```
/en/dashboard  →  interne /dashboard  +  header x-locale: en
/fr/wallet     →  interne /wallet     +  header x-locale: fr
/dashboard     →  interne /dashboard  +  header x-locale: fr (défaut)
```

- `NextResponse.rewrite()` si préfixe locale présent
- `NextResponse.next()` sinon
- Redirections auth respectent la locale (`/en/login`, `/en/dashboard`)
- Header `x-pathname` transmis pour la navigation

---

## 4. Root Layout

**`app/layout.tsx`** — async, lit le header `x-locale` :
```tsx
export default async function RootLayout({ children }) {
  const headersList = await headers()
  const locale = (headersList.get('x-locale') ?? 'fr') as Locale
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          {children}
          <Toaster />
          <Analytics />
        </LocaleProvider>
      </body>
    </html>
  )
}
```

---

## 5. Pages critiques traduites ✅

### Pattern — Client Components
```tsx
import { useLocale } from '@/components/providers/LocaleProvider'
const { t } = useLocale()
// Puis dans le JSX : {t('login.title')}
```

### Pattern — Server Components
```tsx
import { getServerT } from '@/lib/i18n/server'
const { t } = await getServerT()
```

| Fichier | Type | Statut | Notes |
|---------|------|--------|-------|
| `app/(auth)/login/page.tsx` | Client | ✅ Complet | LangToggle ajouté (coin haut droit) |
| `app/(auth)/register/page.tsx` | Client | ✅ Complet | 4 étapes traduites + LangToggle |
| `app/(consumer)/dashboard/page.tsx` | Server | ✅ Complet | `getServerT()`, greeting, activation, stats, wallet |
| `app/(consumer)/wallet/page.tsx` | Server | ✅ Complet | LEDGER_LABELS + BREAKDOWN_SEGMENTS déplacés dans le composant |
| `app/(consumer)/pay/page.tsx` | Client | ✅ Complet | PAYMENT_OPTIONS + STEP_LABELS déplacés dans le composant |

### Navbars
| Fichier | Statut | Notes |
|---------|--------|-------|
| `components/consumer/BottomNav.tsx` | ✅ Traduit | `labelKey: TranslationKey` au lieu de `label: string` |
| `components/merchant/MerchantBottomNav.tsx` | ✅ Traduit | Même pattern |

---

## 6. Pages et composants restants (non encore traduits)

> À faire dans la prochaine session. Pattern identique à appliquer.

### Consommateur
- `app/(consumer)/marketplace/page.tsx` — Client (clés `marketplace.*` déjà dans les JSON)
- `app/(consumer)/network/page.tsx`
- `app/(consumer)/profile/page.tsx`
- `app/(consumer)/voucher/page.tsx`
- `app/(consumer)/tontine/page.tsx`
- `app/(consumer)/history/page.tsx`

### Auth / Onboarding
- `app/(auth)/complete-profile/page.tsx`
- `app/onboarding/page.tsx`

### Marchand
- `app/merchant/dashboard/MerchantDashboardClient.tsx`
- `app/merchant/tools/` — toutes les pages outils (couture, BTP, resto, devis, facture…)
- `app/merchant/receive/page.tsx`
- `app/merchant/products/` 

### Admin
- Pages admin — bas priorité (panel interne)

---

## 7. Comment ajouter la traduction à une nouvelle page

### Client Component
```tsx
import { useLocale } from '@/components/providers/LocaleProvider'

export default function MaPage() {
  const { t } = useLocale()
  return <h1>{t('nav.home')}</h1>
}
```

### Server Component
```tsx
import { getServerT } from '@/lib/i18n/server'

export default async function MaPage() {
  const { t } = await getServerT()
  return <h1>{t('nav.home')}</h1>
}
```

### Ajouter une nouvelle clé
1. Ajouter la clé dans `messages/fr.json`
2. Ajouter la traduction dans `messages/en.json`
3. TypeScript recompile automatiquement `TranslationKey` — les typos sont détectées à la compilation

---

## 8. Points techniques à retenir

**`usePathname()` après réécriture middleware**  
Retourne le chemin interne (`/dashboard`), pas le chemin préfixé (`/en/dashboard`).  
→ `LangToggle` construit `/${newLocale}${pathname}` — correct.

**`LEDGER_LABELS` / `PAYMENT_OPTIONS` dynamiques**  
Ces constantes utilisent `t()`, donc elles doivent être définies *à l'intérieur* du composant (pas au module level). Déjà fait pour `wallet` et `pay`.

**Type-safety des clés**  
`TranslationKey` est un union type généré par `Flatten<typeof fr>`. Toute clé inconnue produit une erreur TypeScript à la compilation.

**Locale par défaut = `fr`**  
Les URLs sans préfixe (`/dashboard`) sont servies en français. Seule `/en/dashboard` charge l'anglais.
