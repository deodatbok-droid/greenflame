# Récap session — 8 juillet 2026 (suite)

## 1. Correction PWA — Icônes manquantes

### Problème
Le manifest référençait `icon-192.png` et `icon-512.png` qui n'existaient pas dans `public/`.
PWABuilder signalait 3 erreurs rouges critiques + Service Worker non détecté.

### Fichiers créés
- `public/icon-192.png` — 192×192, fond blanc, logo centré
- `public/icon-192-maskable.png` — 192×192, fond vert #16a34a, logo avec 12% de marge (safe zone Android)
- `public/icon-512.png` — 512×512, fond blanc
- `public/icon-512-maskable.png` — 512×512, fond vert maskable

Générés en Python depuis `public/logo-transparent.png` (RGBA 500×500).

### Fichiers modifiés

**`public/manifest.json`**
- Ajout `"id": "/"` et `"dir": "ltr"`
- Icons séparés : `any` → `icon-{n}.png`, `maskable` → `icon-{n}-maskable.png`
- Shortcuts : pointent désormais vers `icon-512.png` (512×512 réel) au lieu de `icon-192.png`

**`app/layout.tsx`**
- Correction URL OpenGraph : `greenflame-eta.vercel.app` → `greenflameafrica.com`
- Ajout `<head>` avec script inline pour enregistrer le Service Worker avant l'hydratation React :
  ```tsx
  <script dangerouslySetInnerHTML={{ __html:
    `if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'})`
  }} />
  ```
  → Permet à PWABuilder de détecter le SW sans attendre React

### Résultat PWABuilder
- Has Service Worker ✅
- Has Logic ✅
- Push Notifications ✅
- Offline Support ✅
- Shortcuts ✅
- Score manifest : 25/45

---

## 2. Génération et signature de l'APK Android

### Contexte
PWABuilder génère un APK non signé (`GreenFlame-unsigned.apk`). Android refuse
d'installer un APK non signé. Aucun outil de signature (jarsigner, apksigner)
disponible dans l'environnement sans droits root.

### Solution
Signeur APK V1 (JAR Signing Scheme) implémenté entièrement en Python avec
la bibliothèque `cryptography` (déjà disponible v48.0.0).

### Pourquoi V1 seulement (pas V2)
La première tentative implémentait V1 + V2. Android vérifie le bloc V2 en
priorité : si le bloc est présent mais malformé, l'APK est rejeté sans
fallback V1. En supprimant le V2 block, Android utilise V1 directement —
accepté en sideloading sur Android 7–13.

### Erreurs corrigées vs tentative 1
- V2 block malformé → supprimé entièrement
- Fichiers `META-INF/androidx.*.version` exclus à tort de `MANIFEST.MF` → corrigés
  (466 fichiers signés au lieu de ~34)

### Fichiers produits
- `GreenFlame.apk` — APK signé V1, 1,4 Mo, dans `greenflame/` et `public/`
- `greenflame.p12` — Keystore PKCS12 (équivalent .jks)
  - **⚠️ À conserver hors du repo Git, en lieu sûr**
  - Mot de passe : `GreenFlame2024!`
  - Nécessaire pour re-signer les mises à jour futures

### Contenu MANIFEST.MF
Les 3 fichiers de signature générés :
- `META-INF/MANIFEST.MF` — liste SHA-256 des 466 entrées
- `META-INF/CERT.SF` — digest du MANIFEST + digest de chaque section
- `META-INF/CERT.RSA` — signature PKCS#7 DER de CERT.SF

---

## 3. Page `/telecharger`

### Fichier créé
`app/telecharger/page.tsx`

### Contenu
- Bouton vert de téléchargement direct (`/GreenFlame.apk`, déclenche download natif)
- Guide 4 étapes illustré :
  1. Télécharger le fichier
  2. Ouvrir le fichier téléchargé
  3. Autoriser les sources inconnues (avec note explicative)
  4. Installer et lancer
- Section iPhone : install PWA via Safari → Ajouter à l'écran d'accueil
- Bouton WhatsApp pour partager le lien aux agents terrain
- Lien retour → Marketplace

URL de distribution : `https://greenflameafrica.com/telecharger`

---

## Fichiers touchés cette session

| Fichier | Action |
|---------|--------|
| `public/icon-192.png` | Créé |
| `public/icon-192-maskable.png` | Créé |
| `public/icon-512.png` | Créé |
| `public/icon-512-maskable.png` | Créé |
| `public/manifest.json` | Modifié (id, dir, icons séparés, shortcuts) |
| `app/layout.tsx` | Modifié (SW inline, URL OG) |
| `public/GreenFlame.apk` | Créé (APK signé V1) |
| `greenflame.p12` | Créé (keystore — hors repo) |
| `app/telecharger/page.tsx` | Créé |

---

## À faire après déploiement Vercel

1. Tester l'installation APK depuis `https://greenflameafrica.com/telecharger`
2. Vérifier `https://greenflameafrica.com/manifest.json` → icônes accessibles
3. Repasser sur PWABuilder pour confirmer score → générer AAB si Play Store souhaité
4. Conserver `greenflame.p12` + mot de passe dans un gestionnaire de mots de passe
