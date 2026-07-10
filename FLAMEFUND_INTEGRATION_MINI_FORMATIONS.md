# Brief d'intégration — Mini-formations comme lot de consolation FlameFund

## Contexte

Le mécanisme **FlameFund / Cagnotte Flamme** fonctionne ainsi : chaque mois, les
50 premiers FCFA de cashback reçus par un utilisateur sont redirigés vers une
cagnotte commune. Un (ou plusieurs) tirage(s) au sort a/ont lieu parmi les
contributeurs du mois pour désigner un gagnant, qui remporte un montant
aléatoire entre 10 000 et 100 000 FCFA.

**Les utilisateurs qui ne remportent pas le tirage reçoivent en compensation
l'accès à une mini-formation GreenFlame (valeur marchande réelle : 200 FCFA,
soit 4x leur "mise" de 50 FCFA).** Ce lot tourne chaque mois — jamais la même
formation deux mois de suite pour un même utilisateur (idéalement).

Point clé : la valeur de 200 FCFA n'est PAS un chiffre inventé pour cette
promotion — c'est le prix marchand réel et vérifiable de ces mêmes formations,
déjà en vente sur le Hub GreenFlame. Ça rend la promesse "tout le monde gagne"
vérifiable et imbattable, en cohérence avec le principe de transparence totale
de GreenFlame.

## Ce qui existe déjà (ne pas recréer)

Trois mini-formations sont déjà produites, déployées et référencées comme
produits marchands sur le GreenFlame Hub :

| # | Fichier HTML | Titre produit | Prix | Emoji | Thème |
|---|---|---|---|---|---|
| 1 | `public/formations/gestion-argent-quotidien.html` | Gestion d'argent au quotidien (mini-formation) | 200 FCFA | 💰 | Les 5 règles pour savoir où part son argent + plan d'action |
| 2 | `public/formations/transformer-savoir-faire-en-revenu.html` | Transformer ce que tu sais déjà faire en revenu (mini-formation) | 200 FCFA | 🚀 | Repérer ses ressources (savoir-faire, réseau, temps) et faire un premier pas concret |
| 3 | `public/formations/epargner-enfin.html` | Pourquoi tu n'arrives jamais à épargner (mini-formation) | 200 FCFA | 🐷 | Déconstruire les pièges classiques + objectif d'épargne réaliste |

Détails techniques :
- Chaque module fait ~420-450 lignes HTML, autonome (quiz interactif + certificat à la fin)
- Enregistrés comme produits via `supabase/migrations/031_mini_formations_seed.sql`
  (catégorie Services > Enseignement & formation, marchand = GreenFlame Hub / `is_platform_hub = true`)
- Champ `digital_url` ajouté aux produits via `032_digital_url.sql` — c'est le lien
  vers le fichier HTML pour les produits numériques
- Composant d'affichage existant : `components/dashboard/FormationsTicker.tsx`
  (carrousel avec rotation automatique toutes les 6 secondes, dégradés de marque par index)

## Ce qu'il reste à construire

1. **Logique de sélection rotative pour le lot de consolation FlameFund**
   - Décider : rotation séquentielle (formation 1 → 2 → 3 → 1…) ou aléatoire ?
   - Décider : faut-il éviter qu'un même utilisateur reçoive deux fois la même
     formation sur des mois consécutifs (ou jamais) ? Si oui, il faut tracer
     quelle formation chaque utilisateur a déjà reçue via FlameFund.

2. **Mécanisme d'attribution / déblocage**
   - Quand un utilisateur ne remporte pas le tirage du mois, comment reçoit-il
     l'accès ? (Notification + lien direct ? Ajout automatique à "mes achats" /
     "ma bibliothèque" sans passage par le paiement ? Entrée spéciale dans
     `digital_url` ou table dédiée `flamefund_rewards` ?)
   - Faut-il distinguer dans la base "formation obtenue par achat" vs "formation
     reçue comme lot de consolation FlameFund" (pour les stats, les relances,
     etc.) ?

3. **Notification / mise en scène du lot**
   - Concevoir l'écran ou la notification qui annonce : "Tu n'as pas remporté
     la Cagnotte ce mois-ci, mais voici ton module [X] (valeur 200 FCFA) —
     gratuit, pour t'aider à gagner encore plus avec GreenFlame."
   - Réutiliser le ton/visuel du `FormationsTicker` existant pour la cohérence
     de marque.

4. **Lien avec le tirage et la cagnotte visible**
   - Le lot de consolation doit s'intégrer dans le même flux que l'annonce du
     gagnant du tirage et l'affichage du compteur en temps réel de la cagnotte
     (fonctionnalités FlameFund encore à construire séparément — voir le
     reste du brief FlameFund pour le contexte du compteur live et du tirage).

## Questions ouvertes pour Claude / l'agent qui intègre

- [ ] Rotation séquentielle ou aléatoire, et faut-il éviter les répétitions par utilisateur ?
- [ ] Faut-il une nouvelle table (`flamefund_rewards` ou équivalent) pour tracer
      qui a reçu quoi et quand, séparément des achats classiques de produits ?
- [ ] L'accès à la formation doit-il rester permanent une fois attribué (comme
      un achat classique), ou est-ce un accès limité dans le temps ?
- [ ] Faut-il prévoir, dès maintenant, un suivi de l'effet réel de ces
      formations sur le cashback ultérieur des utilisateurs (pour pouvoir un
      jour démontrer empiriquement la valeur du lot) ?

---
*Document de brief — à compléter/annoter directement dans ce fichier avant de
lancer l'intégration technique.*
