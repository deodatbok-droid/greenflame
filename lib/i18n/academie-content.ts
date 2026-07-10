// ─── Types ────────────────────────────────────────────────────────────────────

export type RichItem = {
  text: string   // supports **bold** markers for inline bold
  sub?: string[] // optional nested sub-list items (also support **bold**)
}

export type ContentBlock =
  | { type: 'p';   text: string }
  | { type: 'h3';  text: string }
  | { type: 'tip'; text: string }
  | { type: 'ul';  items: RichItem[] }
  | { type: 'ol';  items: RichItem[] }

export type Section = {
  title: string
  blocks: ContentBlock[]
}

export type QuizQuestion = {
  q: string
  opts: string[]
  correct: number
}

export type ModuleContent = {
  sections: Section[]
  quiz: QuizQuestion[]
}

export type AcademieContent = {
  f1: ModuleContent
  f2: ModuleContent
  f3: ModuleContent
}

// ─── French content ───────────────────────────────────────────────────────────

const FR: AcademieContent = {

  // Module F1 — Gestion d'argent au quotidien
  f1: {
    sections: [
      {
        title: '1. Pourquoi l\'argent disparaît-il avant la fin du mois ?',
        blocks: [
          { type: 'p', text: 'Tu gagnes de l\'argent — et pourtant il s\'évapore. Ce n\'est pas un problème de volonté ni de revenu insuffisant. C\'est presque toujours un problème de **visibilité** : tu ne sais pas exactement où il va.' },
          { type: 'h3', text: 'Les 5 pièges les plus courants' },
          { type: 'ol', items: [
            { text: '**Les dépenses invisibles** — les petits achats non suivis (eau glacée, zémidjan imprévu, snacks, airtime...) qui semblent minimes mais totalisent parfois 20–30% du budget mensuel.' },
            { text: '**Les achats impulsifs** — "c\'est en promo", "j\'en ai besoin", "ce n\'est pas cher" sont les phrases qui vident un compte.' },
            { text: '**L\'absence de plan** — sans budget même simple, chaque dépense est une décision isolée. Sans plan d\'ensemble, on ne voit jamais la limite approcher.' },
            { text: '**Les dettes informelles** — prêter et oublier de récupérer, emprunter et rembourser par petites tranches non suivies.' },
            { text: '**Les cotisations non budgétées** — tontines, cérémonies, cagnottes familiales entrent souvent de façon imprévue dans le mois.' },
          ]},
          { type: 'tip', text: 'La plupart des gens qui ont du mal avec l\'argent ne gagnent pas moins — ils voient juste moins clairement où il va. La solution commence par regarder.' },
        ],
      },
      {
        title: '2. Les 5 règles des gens qui s\'en sortent',
        blocks: [
          { type: 'p', text: 'Ces règles ne nécessitent ni compte bancaire, ni application complexe. Juste de la méthode.' },
          { type: 'h3', text: 'Règle 1 — Écrire chaque dépense pendant 30 jours' },
          { type: 'p', text: 'Un carnet, un fichier, un message vocal à toi-même — peu importe. L\'objectif : rendre les dépenses invisibles visibles. Au bout d\'un mois, les patterns apparaissent clairement.' },
          { type: 'h3', text: 'Règle 2 — Les 3 enveloppes' },
          { type: 'p', text: 'Dès que tu reçois ton revenu, divise-le mentalement (ou physiquement) en 3 :' },
          { type: 'ul', items: [
            { text: '**Enveloppe Besoins (60-70%)** — loyer, nourriture, transport, santé, scolarité.' },
            { text: '**Enveloppe Épargne (10-20% minimum)** — intouchable sauf urgence vraie.' },
            { text: '**Enveloppe Libre (le reste)** — loisirs, imprévus, cadeaux.' },
          ]},
          { type: 'h3', text: 'Règle 3 — Se payer en premier' },
          { type: 'p', text: 'Mets de côté ta part d\'épargne immédiatement après avoir reçu ton revenu — avant de payer quoi que ce soit d\'autre. L\'épargne qui attend "la fin du mois" n\'existe presque jamais.' },
          { type: 'h3', text: 'Règle 4 — Le test des 24h' },
          { type: 'p', text: 'Avant tout achat non essentiel, attends 24h. Si tu y penses encore le lendemain et que tu le veux toujours, c\'est sans doute utile. Sinon, tu viens d\'économiser.' },
          { type: 'h3', text: 'Règle 5 — Le coussin de sécurité' },
          { type: 'p', text: 'Constitue progressivement un fonds d\'urgence de **1 à 3 mois de dépenses essentielles**. Ce coussin t\'empêche de t\'endetter à la moindre dépense imprévue.' },
          { type: 'tip', text: 'Ces règles sont simples à comprendre et difficiles à maintenir sans habitude. Commence par une seule : tenir le carnet pendant 30 jours.' },
        ],
      },
      {
        title: '3. L\'outil simple : le tableau des 3 colonnes',
        blocks: [
          { type: 'p', text: 'Pas besoin d\'une application complexe. Ce tableau tient sur une feuille ou dans un cahier.' },
          { type: 'h3', text: 'Structure du tableau mensuel' },
          { type: 'ul', items: [
            { text: '**Colonne 1 — Ce qui rentre :** salaire, activités secondaires, remboursements reçus.' },
            { text: '**Colonne 2 — Ce qui sort (fixe) :** loyer, scolarité, abonnements, remboursements de dettes. Ces montants ne changent pas d\'un mois à l\'autre.' },
            { text: '**Colonne 3 — Ce qui sort (variable) :** nourriture, transport, santé, loisirs. Ces montants varient — c\'est ici qu\'on peut agir.' },
          ]},
          { type: 'p', text: 'Le solde = Colonne 1 − Colonne 2 − Colonne 3. Si ce chiffre est positif, tu avances. S\'il est négatif, ton tableau te dit exactement où chercher pour corriger.' },
          { type: 'h3', text: 'La bonne fréquence' },
          { type: 'ul', items: [
            { text: '**En début de mois :** planifie tes dépenses fixes + ton épargne.' },
            { text: '**Chaque semaine :** note les dépenses variables de la semaine (5 min).' },
            { text: '**En fin de mois :** compare prévu vs réel. Où as-tu dépassé ? Pourquoi ?' },
          ]},
          { type: 'tip', text: 'La régularité vaut mieux que la précision. Un suivi approximatif chaque semaine est bien plus utile qu\'un suivi parfait fait une fois par trimestre.' },
        ],
      },
      {
        title: '4. Gérer les dépenses imprévues et les dettes',
        blocks: [
          { type: 'p', text: 'Deux sujets qui font dérailler même les meilleures intentions financières.' },
          { type: 'h3', text: 'Les imprévus — les anticiper avant qu\'ils arrivent' },
          { type: 'p', text: 'Un imprévus n\'est "imprévus" que dans son timing. Tomber malade, devoir réparer quelque chose, une dépense familiale urgente — ces événements sont certains, seule leur date est inconnue.' },
          { type: 'ul', items: [
            { text: 'Intègre une **ligne "imprévus" dans ton budget mensuel** — même si tu n\'y touches pas ce mois-ci, elle sera là le mois suivant.' },
            { text: 'Le montant recommandé : 5 à 10% de tes revenus mensuels.' },
          ]},
          { type: 'h3', text: 'Les dettes — la méthode boule de neige' },
          { type: 'p', text: 'Si tu as plusieurs dettes, utilise la **méthode de la boule de neige** :' },
          { type: 'ol', items: [
            { text: 'Liste toutes tes dettes du plus petit au plus grand montant.' },
            { text: 'Paie le minimum sur toutes, sauf la plus petite.' },
            { text: 'Attaque-toi de toutes tes forces à la plus petite dette d\'abord.' },
            { text: 'Une fois remboursée, reporte l\'effort sur la suivante.' },
          ]},
          { type: 'p', text: 'L\'avantage psychologique : tu vois des dettes disparaître rapidement, ce qui maintient la motivation.' },
          { type: 'tip', text: 'Avant de contracter une nouvelle dette, pose-toi la question : "Est-ce que je peux me permettre les mensualités chaque mois, même en cas de mois difficile ?" Si tu hésites, la réponse est non.' },
        ],
      },
      {
        title: '5. Par où commencer dès aujourd\'hui',
        blocks: [
          { type: 'p', text: 'La meilleure méthode est celle qu\'on applique, pas la plus complexe. Voici les 3 actions à faire dans les prochaines 24h.' },
          { type: 'h3', text: 'Action 1 — Le bilan de ce mois' },
          { type: 'p', text: 'Prends 10 minutes pour lister (de mémoire si nécessaire) ce que tu as dépensé ce mois. Classe en : logement, nourriture, transport, communication, loisirs, imprévus. Quel poste te surprend le plus ?' },
          { type: 'h3', text: 'Action 2 — Fixe un seul objectif d\'épargne' },
          { type: 'p', text: 'Pas 10 objectifs — un seul, petit et atteignable. Par exemple : mettre de côté 2 000 FCFA ce mois-ci. Puis le mois prochain, 3 000. La régularité compte plus que le montant.' },
          { type: 'h3', text: 'Action 3 — Crée ton système de suivi' },
          { type: 'p', text: 'Un carnet, un message WhatsApp à toi-même, une note sur ton téléphone — choisis quelque chose que tu vas réellement utiliser. Pendant 7 jours, note chaque dépense, même les plus petites.' },
          { type: 'tip', text: 'Tu n\'as pas besoin de tout changer en même temps. Une petite habitude maintenue pendant 30 jours vaut mieux qu\'un plan parfait abandonné au bout d\'une semaine.' },
        ],
      },
    ],
    quiz: [
      {
        q: 'Quelle est la première étape pour reprendre le contrôle de son argent ?',
        opts: ['Gagner plus d\'argent', 'Noter toutes ses dépenses pendant 30 jours', 'Ouvrir un compte bancaire', 'Arrêter tout achat non essentiel'],
        correct: 1,
      },
      {
        q: 'Selon la règle des 3 enveloppes, quel est le pourcentage minimum conseillé pour l\'épargne ?',
        opts: ['2%', '5%', '10%', '30%'],
        correct: 2,
      },
      {
        q: 'La règle du "se payer en premier" signifie :',
        opts: ['Payer ses dettes en priorité', 'Dépenser pour ses plaisirs avant les autres obligations', 'Mettre son épargne de côté dès réception du revenu, avant toute autre dépense', 'Augmenter son salaire'],
        correct: 2,
      },
      {
        q: 'Lequel de ces éléments est une "dépense invisible" courante ?',
        opts: ['Le loyer mensuel', 'La scolarité des enfants', 'Les petits achats quotidiens non suivis (eau, snacks, trajets imprévus…)', 'L\'électricité'],
        correct: 2,
      },
      {
        q: 'Le coussin de sécurité idéal correspond à :',
        opts: ['50 000 FCFA fixe', '1 semaine de dépenses', '1 à 3 mois de dépenses essentielles', '1 an de salaire'],
        correct: 2,
      },
    ],
  },

  // Module F2 — Transformer ce que tu sais faire en revenu
  f2: {
    sections: [
      {
        title: '1. Tu as déjà tout ce qu\'il faut',
        blocks: [
          { type: 'p', text: 'Le plus grand mythe de l\'entrepreneuriat : "il faut du capital pour commencer." La réalité dans nos quartiers et nos villes, c\'est que des milliers de gens gagnent leur vie avec ce qu\'ils **savent faire**, pas avec ce qu\'ils ont.' },
          { type: 'h3', text: 'Les 3 capitaux que tu possèdes déjà' },
          { type: 'ul', items: [
            { text: '**Capital humain** — ce que tu sais faire : coudre, cuisiner, enseigner, soigner, réparer, construire, coiffer, photographier, traduire, conduire, vendre...' },
            { text: '**Capital relationnel** — les personnes que tu connais, ton quartier, ta famille, ton école, ton église, ton association.' },
            { text: '**Capital temps** — même avec un emploi, il y a souvent du temps récupérable (week-ends, soirées, pauses) pour démarrer une activité secondaire.' },
          ]},
          { type: 'p', text: 'La question n\'est pas "est-ce que j\'ai les ressources ?" mais "est-ce que je regarde mes ressources existantes de la bonne façon ?"' },
          { type: 'tip', text: 'Pose-toi cette question : "Pour quoi est-ce que les gens me demandent de l\'aide ou me font des compliments ?" La réponse te donne souvent une piste sérieuse.' },
        ],
      },
      {
        title: '2. 7 façons de monétiser sans capital financier',
        blocks: [
          { type: 'p', text: 'Voici 7 modèles qui ont fait leurs preuves et qui ne nécessitent pas d\'investissement initial important.' },
          { type: 'ol', items: [
            { text: '**Service à la personne directe** — coiffure à domicile, cours particuliers, garde d\'enfants, aide aux personnes âgées. Tu vends ton temps et ton savoir-faire.' },
            { text: '**Transformation de produits** — acheter des matières premières et les transformer (pain, gâteaux, jus, fritures) pour les vendre avec une marge.' },
            { text: '**Intermédiaire / Courtage** — connecter des vendeurs et des acheteurs que tu connais, prendre une commission sur la mise en relation.' },
            { text: '**Revente avec valeur ajoutée** — acheter en gros ou en vrac, conditionner différemment, vendre au détail ou en petites portions.' },
            { text: '**Formation et transmission** — si tu maîtrises quelque chose (un logiciel, une langue, un instrument, un métier), tu peux l\'enseigner.' },
            { text: '**Service numérique** — graphisme simple, saisie de texte, traduction, gestion de réseaux sociaux pour commerçants.' },
            { text: '**Prestation physique récurrente** — nettoyage, jardinage, livraison, service de repassage — des besoins permanents dans tout quartier.' },
          ]},
        ],
      },
      {
        title: '3. Comment fixer ton prix (sans te brader ni faire fuir)',
        blocks: [
          { type: 'p', text: 'C\'est la question qui bloque le plus les débutants. "Et si c\'est trop cher ?" "Je ne veux pas faire payer mes proches." "Je ne sais pas combien demander."' },
          { type: 'h3', text: 'La formule de base' },
          { type: 'p', text: '**Prix de vente = Coût des matières + Ton temps (valorisé) + Marge bénéficiaire**' },
          { type: 'p', text: 'Ne fais jamais l\'erreur d\'oublier de compter ton temps. C\'est la ressource non renouvelable la plus précieuse que tu engages.' },
          { type: 'h3', text: '3 méthodes concrètes' },
          { type: 'ol', items: [
            { text: '**Méthode benchmark** — observe ce que font payer les autres pour le même service dans ton quartier. Positionne-toi légèrement en dessous pour commencer, puis augmente quand tu as une réputation.' },
            { text: '**Méthode valeur perçue** — demande-toi ce que ton service vaut pour le client. Une heure de cours particuliers qui fait passer un enfant en classe supérieure vaut infiniment plus que ton coût horaire.' },
            { text: '**Méthode coût + marge** — additionne tous tes coûts (matières, transport, temps), puis ajoute 30 à 50% de marge. C\'est ton prix plancher.' },
          ]},
          { type: 'tip', text: 'Ne sous-facture pas pour "fidéliser". Un prix trop bas crée une image de qualité médiocre — et t\'épuise sans enrichir. Commence correctement ou améliore progressivement.' },
          { type: 'h3', text: 'Comment annoncer son prix sans hésiter' },
          { type: 'p', text: 'Dis ton prix avec calme et conviction, sans t\'excuser. "C\'est X FCFA" — point. Si on négocie, tu peux ajuster légèrement, mais ne soldes pas ton travail sous la pression sociale.' },
        ],
      },
      {
        title: '4. Trouver ses premiers clients (sans budget marketing)',
        blocks: [
          { type: 'p', text: 'Les premiers clients sont souvent là, juste autour de toi. Ils n\'attendent qu\'une chose : que tu leur proposes clairement.' },
          { type: 'h3', text: 'Le cercle des 3 raisons' },
          { type: 'p', text: 'Commence par lister :' },
          { type: 'ul', items: [
            { text: '**Cercle 1 — Famille et proches :** qui dans ta famille ou tes proches amis pourrait avoir besoin de ce que tu offres, ou connaît quelqu\'un qui en a besoin ?' },
            { text: '**Cercle 2 — Voisinage et quartier :** autour de chez toi, qui paie déjà pour ce service mais pas à toi ?' },
            { text: '**Cercle 3 — Communautés :** ton église, ton association, ton marché, ton groupe WhatsApp.' },
          ]},
          { type: 'h3', text: 'L\'annonce WhatsApp simple' },
          { type: 'p', text: 'Un message bien écrit dans 3 groupes WhatsApp peut te ramener tes 5 premiers clients. Structure : emoji accrocheur + ce que tu fais + prix de départ + ton numéro + "Dis-le à ceux qui cherchent 😊".' },
          { type: 'h3', text: 'La puissance du premier témoignage' },
          { type: 'p', text: 'Fais tes 2 ou 3 premières prestations pour des proches — avec soin. Demande-leur de te laisser un avis ou de te recommander activement. Un premier témoignage sincère vaut mieux que n\'importe quelle publicité payante.' },
        ],
      },
      {
        title: '5. Passer à l\'action cette semaine — le plan en 5 jours',
        blocks: [
          { type: 'p', text: 'La majorité des gens pensent à lancer une activité mais n\'agissent jamais. Voici un plan concret sur 5 jours pour passer du stade "j\'y pense" à "j\'ai mes premiers clients".' },
          { type: 'ul', items: [
            { text: '**Jour 1 — Choisir :** liste 3 choses que tu sais faire et que d\'autres paient. Choisis la plus facile à démarrer immédiatement.' },
            { text: '**Jour 2 — Fixer le prix :** utilise l\'une des 3 méthodes de la section 3. Prépare ta réponse pour quand on te demande ton prix.' },
            { text: '**Jour 3 — Créer ton annonce :** un message court, clair, avec emoji, service, prix et contact. Tiens-le en moins de 5 lignes.' },
            { text: '**Jour 4 — Diffuser :** envoie ton annonce dans au moins 3 groupes ou à 10 personnes directement. Parle-en en personne à 2 ou 3 proches.' },
            { text: '**Jour 5 — Attendre et relancer :** si pas de retour, rappelle ou rée envoie. La timidité commerciale est le plus grand ennemi du débutant.' },
          ]},
          { type: 'tip', text: 'Tu n\'as pas besoin d\'un nom commercial, d\'un logo ou d\'un compte bancaire pour commencer. Ces choses viennent après le premier revenu — pas avant.' },
        ],
      },
    ],
    quiz: [
      {
        q: 'Lequel des éléments suivants est un "capital" que tu possèdes déjà sans investissement financier ?',
        opts: ['Un local commercial', 'Ton savoir-faire et ton réseau de connaissances', 'Un compte bancaire professionnel', 'Une formation universitaire'],
        correct: 1,
      },
      {
        q: 'Quel est le premier endroit où chercher ses premiers clients ?',
        opts: ['Les réseaux sociaux publics', 'La famille, les proches et le voisinage', 'Une publicité payante', 'Un site web professionnel'],
        correct: 1,
      },
      {
        q: 'Quand tu fixes ton prix, qu\'est-ce qu\'on oublie souvent d\'inclure ?',
        opts: ['Le coût des matières premières', 'La marge bénéficiaire', 'La valorisation de son propre temps', 'Le prix du marché'],
        correct: 2,
      },
      {
        q: 'Pour démarrer une activité de service, qu\'est-ce qui est indispensable dès le début ?',
        opts: ['Un logo et un nom commercial', 'Un compte bancaire professionnel', 'Une annonce claire et la volonté de proposer ses services', 'Une autorisation administrative'],
        correct: 2,
      },
      {
        q: 'Qu\'est-ce qui génère le plus de confiance pour un nouveau prestataire ?',
        opts: ['Une belle carte de visite', 'Un témoignage sincère d\'un client satisfait', 'Des prix très bas', 'Beaucoup de likes sur les réseaux sociaux'],
        correct: 1,
      },
    ],
  },

  // Module F3 — Pourquoi tu n'arrives jamais à épargner
  f3: {
    sections: [
      {
        title: '1. Ce n\'est pas un problème de volonté',
        blocks: [
          { type: 'p', text: '"Ce mois-ci, je mets de côté." Et puis le mois se termine, et il ne reste rien. Si tu te reconnais dans cette phrase, tu n\'es pas seul — c\'est l\'expérience de la grande majorité des gens, y compris ceux qui gagnent bien leur vie.' },
          { type: 'h3', text: 'Pourquoi les bonnes intentions ne suffisent pas' },
          { type: 'p', text: 'L\'échec de l\'épargne n\'est presque jamais une question de caractère. C\'est une question de **méthode et de structure**. Voici ce qui sabote silencieusement tes efforts :' },
          { type: 'ul', items: [
            { text: '**Piège 1 — Épargner ce qui reste.** Si tu attends la fin du mois pour épargner "ce qui reste", il ne reste presque jamais rien. Les dépenses s\'étendent naturellement pour remplir le budget disponible.' },
            { text: '**Piège 2 — Pas d\'objectif concret.** "Épargner" sans but précis, c\'est comme voyager sans destination. Le cerveau humain est mauvais pour se sacrifier pour un objectif flou.' },
            { text: '**Piège 3 — Mélanger l\'épargne et le compte courant.** Quand l\'épargne est au même endroit que les dépenses courantes, elle finit toujours par être dépensée.' },
          ]},
          { type: 'tip', text: 'Ces pièges sont des bugs de conception, pas des défauts de caractère. Changer la méthode change le résultat — même sans changer la discipline.' },
        ],
      },
      {
        title: '2. La méthode « Paie-toi en premier »',
        blocks: [
          { type: 'p', text: 'C\'est la règle d\'or de l\'épargne. Simple à comprendre, transformatrice à appliquer.' },
          { type: 'h3', text: 'Le principe' },
          { type: 'p', text: 'Dès que tu reçois ton revenu — salaire, paiement d\'un client, transfert — **mets immédiatement de côté ta part d\'épargne, avant de payer quoi que ce soit d\'autre.** Loyer, nourriture, tout le reste attendra cette première action.' },
          { type: 'p', text: 'En traitant l\'épargne comme une facture prioritaire (que tu te dois à toi-même), tu inverses le problème : au lieu d\'épargner ce qui reste, tu dépenses ce qui reste après épargne.' },
          { type: 'h3', text: 'Combien mettre de côté ?' },
          { type: 'ul', items: [
            { text: '**Si tu débutes :** commence par 5%, même 3%. L\'habitude compte plus que le montant.' },
            { text: '**Objectif intermédiaire :** 10% de tes revenus nets.' },
            { text: '**Objectif solide :** 15 à 20% — tu construis vraiment un matelas financier.' },
          ]},
          { type: 'h3', text: 'Où mettre l\'épargne ?' },
          { type: 'p', text: 'Le plus important : **physiquement séparé de ton argent courant**. Options au Bénin :' },
          { type: 'ul', items: [
            { text: 'Un second numéro Mobile Money (MTN ou Moov) dédié uniquement à l\'épargne' },
            { text: 'Une tontine fiable et maîtrisée' },
            { text: 'Un compte bancaire de type épargne (CLCAM, BOA, Ecobank…)' },
            { text: 'Une enveloppe physique chez un proche de confiance qui ne te la rend pas sur simple demande' },
          ]},
        ],
      },
      {
        title: '3. Fixer un objectif d\'épargne réaliste',
        blocks: [
          { type: 'p', text: 'Un objectif d\'épargne efficace répond à 3 critères : il est **concret** (un chiffre précis), **daté** (une échéance) et **utile** (tu sais pourquoi tu épargnes).' },
          { type: 'h3', text: 'Les 3 niveaux d\'objectifs' },
          { type: 'ul', items: [
            { text: '**Niveau 1 — Coussin d\'urgence (priorité absolue)** : épargner l\'équivalent de 1 à 3 mois de dépenses essentielles. Cela t\'évite de t\'endetter à chaque imprévu. Cible : 50 000 à 150 000 FCFA selon ta situation.' },
            { text: '**Niveau 2 — Objectif moyen terme** : quelque chose de concret dans 6 à 18 mois — un équipement, une formation, une contribution à un projet familial. Le fait de visualiser la destination rend l\'effort supportable.' },
            { text: '**Niveau 3 — Investissement et avenir** : une fois le coussin constitué, faire travailler l\'épargne (immobilier, activité secondaire, coopérative, actifs productifs).' },
          ]},
          { type: 'h3', text: 'La technique de la "date ancre"' },
          { type: 'p', text: 'Associe ton objectif à une date significative : "Je veux avoir X FCFA de côté avant le 31 décembre" ou "avant que mon enfant entre au lycée". La date ancre transforme l\'objectif abstrait en compte à rebours concret.' },
          { type: 'tip', text: 'Écris ton objectif, le montant et la date quelque part que tu vois souvent. Une note sur ton téléphone, une phrase sur le mur de ta chambre. Ce qui est écrit est réel.' },
        ],
      },
      {
        title: '4. Les pièges qui font dérailler l\'épargne',
        blocks: [
          { type: 'p', text: 'Même avec la meilleure méthode, certains pièges persistent. Les connaître te permet de les anticiper.' },
          { type: 'h3', text: 'Piège 1 — Les "urgences" non urgentes' },
          { type: 'p', text: 'Beaucoup de prélèvements sur l\'épargne se font au nom d\'"urgences" qui n\'en sont pas vraiment. Avant de toucher à ton épargne, demande-toi honnêtement : "Est-ce vraiment une urgence, ou est-ce un désir qui ne peut pas attendre ?"' },
          { type: 'h3', text: 'Piège 2 — La pression sociale' },
          { type: 'p', text: 'Cérémonies, cadeaux, soutien familial — les sollicitations sont réelles et légitimes dans notre culture. Mais il faut les budgéter à l\'avance (une ligne "solidarité" dans ton budget) plutôt que de les payer sur l\'épargne.' },
          { type: 'h3', text: 'Piège 3 — L\'illusion de la tontine unique' },
          { type: 'p', text: 'La tontine est un excellent outil d\'épargne forcée — mais attention : ce n\'est pas une alternative au coussin d\'urgence liquide. Si ta seule épargne est dans une tontine, tu n\'y as pas accès en cas de besoin réel.' },
          { type: 'h3', text: 'Piège 4 — Abandonner après un mois raté' },
          { type: 'p', text: 'Un mois où tu n\'as pas pu épargner n\'est pas un échec — c\'est un incident. L\'erreur est de considérer l\'incident comme une preuve que "ça ne fonctionne pas pour toi". Reprends le mois suivant.' },
          { type: 'tip', text: 'L\'épargne régulière mais imparfaite (9 mois sur 12) est infiniment plus efficace que l\'épargne parfaite envisagée mais jamais commencée.' },
        ],
      },
      {
        title: '5. Ton plan d\'action concret — dès aujourd\'hui',
        blocks: [
          { type: 'p', text: 'Trois actions que tu peux faire dans les prochaines 24 heures pour sortir du cycle "bonne intention → rien".' },
          { type: 'h3', text: 'Action 1 — Crée ton "coffre" séparé' },
          { type: 'p', text: 'Aujourd\'hui, crée un second numéro Mobile Money (ou identifie un support séparé) qui sera exclusivement ton épargne. Donne-lui un nom mentalement : "Coussin de sécurité", "Projet école", "Mon futur".' },
          { type: 'h3', text: 'Action 2 — Fixe ton montant minimum' },
          { type: 'p', text: 'Décide d\'un montant très faible mais non nul. Même 1 000 FCFA par mois. L\'objectif est de créer l\'habitude du geste — le montant viendra ensuite.' },
          { type: 'h3', text: 'Action 3 — Programme ou note une alerte' },
          { type: 'p', text: 'Mets une alerte sur ton téléphone le jour où tu reçois habituellement ton revenu : "Virer épargne maintenant." Ce rappel mécanique compense le fait que la volonté seule est insuffisante dans les moments chargés.' },
          { type: 'tip', text: 'La discipline n\'est pas une qualité innée — c\'est un système qu\'on construit. Construis ton système d\'épargne et laisse-le travailler à ta place.' },
        ],
      },
    ],
    quiz: [
      {
        q: 'Pourquoi "épargner ce qui reste en fin de mois" ne fonctionne presque jamais ?',
        opts: ['Parce que les gens ne sont pas disciplinés', 'Parce que les dépenses s\'étendent naturellement pour remplir le budget disponible', 'Parce que les revenus sont trop faibles', 'Parce que les prix augmentent chaque mois'],
        correct: 1,
      },
      {
        q: 'Que signifie "se payer en premier" en matière d\'épargne ?',
        opts: ['Se faire plaisir avant de payer les charges', 'Mettre l\'épargne de côté immédiatement dès réception du revenu, avant toute autre dépense', 'Augmenter son salaire', 'Payer ses factures en priorité'],
        correct: 1,
      },
      {
        q: 'Quel est l\'objectif d\'épargne "Niveau 1" — priorité absolue ?',
        opts: ['Épargner pour un projet immobilier', 'Constituer un coussin d\'urgence de 1 à 3 mois de dépenses essentielles', 'Avoir 1 000 000 FCFA en banque', 'Investir en bourse'],
        correct: 1,
      },
      {
        q: 'Pourquoi faut-il séparer physiquement l\'épargne du compte courant ?',
        opts: ['Pour payer moins de frais bancaires', 'Pour gagner des intérêts plus élevés', 'Parce que l\'argent mélangé au compte courant finit toujours par être dépensé', 'Pour éviter les impôts'],
        correct: 2,
      },
      {
        q: 'Si tu rates ton objectif d\'épargne un mois, la bonne attitude est :',
        opts: ['Abandonner la méthode, elle ne fonctionne pas pour toi', 'Doubler l\'épargne le mois suivant pour compenser', 'Traiter ça comme un incident et reprendre normalement le mois suivant', 'Attendre d\'avoir plus de revenus pour recommencer'],
        correct: 2,
      },
    ],
  },
}

// ─── English content ──────────────────────────────────────────────────────────

const EN: AcademieContent = {

  // Module F1 — Daily Money Management
  f1: {
    sections: [
      {
        title: '1. Why does money disappear before the end of the month?',
        blocks: [
          { type: 'p', text: 'You earn money — yet it evaporates. It\'s not a willpower problem or insufficient income. It\'s almost always a **visibility** problem: you don\'t know exactly where it goes.' },
          { type: 'h3', text: 'The 5 most common traps' },
          { type: 'ol', items: [
            { text: '**Invisible expenses** — small untracked daily purchases (ice water, unexpected transport, snacks, airtime...) that seem minor but can total 20–30% of the monthly budget.' },
            { text: '**Impulse buys** — "it\'s on sale", "I need it", "it\'s not expensive" are the phrases that empty an account.' },
            { text: '**No plan** — without even a simple budget, every expense is an isolated decision. Without an overall plan, you never see the limit approaching.' },
            { text: '**Informal debts** — lending and forgetting to collect, borrowing and repaying in small untracked installments.' },
            { text: '**Unbudgeted contributions** — rotating savings groups, ceremonies, family fundraisers often hit unexpectedly during the month.' },
          ]},
          { type: 'tip', text: 'Most people who struggle with money don\'t earn less — they just see less clearly where it goes. The solution starts with looking.' },
        ],
      },
      {
        title: '2. The 5 rules of people who make it',
        blocks: [
          { type: 'p', text: 'These rules require no bank account or complex app. Just method.' },
          { type: 'h3', text: 'Rule 1 — Write down every expense for 30 days' },
          { type: 'p', text: 'A notebook, a file, a voice memo to yourself — anything works. The goal: make invisible expenses visible. After a month, patterns appear clearly.' },
          { type: 'h3', text: 'Rule 2 — The 3 envelopes' },
          { type: 'p', text: 'As soon as you receive income, divide it mentally (or physically) into 3:' },
          { type: 'ul', items: [
            { text: '**Needs envelope (60-70%)** — rent, food, transport, health, education.' },
            { text: '**Savings envelope (10-20% minimum)** — untouched except for a real emergency.' },
            { text: '**Free envelope (the rest)** — leisure, unexpected expenses, gifts.' },
          ]},
          { type: 'h3', text: 'Rule 3 — Pay yourself first' },
          { type: 'p', text: 'Set aside your savings share immediately after receiving income — before paying anything else. Savings that wait "until the end of the month" almost never happen.' },
          { type: 'h3', text: 'Rule 4 — The 24-hour test' },
          { type: 'p', text: 'Before any non-essential purchase, wait 24 hours. If you\'re still thinking about it the next day and still want it, it\'s probably useful. Otherwise, you just saved.' },
          { type: 'h3', text: 'Rule 5 — The safety cushion' },
          { type: 'p', text: 'Progressively build an emergency fund of **1 to 3 months of essential expenses**. This cushion prevents you from going into debt at the first unexpected expense.' },
          { type: 'tip', text: 'These rules are simple to understand and hard to maintain without habit. Start with just one: keeping the notebook for 30 days.' },
        ],
      },
      {
        title: '3. The simple tool: the 3-column table',
        blocks: [
          { type: 'p', text: 'No complex app needed. This table fits on a page or in a notebook.' },
          { type: 'h3', text: 'Monthly table structure' },
          { type: 'ul', items: [
            { text: '**Column 1 — What comes in:** salary, secondary activities, repayments received.' },
            { text: '**Column 2 — What goes out (fixed):** rent, education, subscriptions, debt repayments. These amounts don\'t change from month to month.' },
            { text: '**Column 3 — What goes out (variable):** food, transport, health, leisure. These amounts vary — this is where you can act.' },
          ]},
          { type: 'p', text: 'Balance = Column 1 − Column 2 − Column 3. If positive, you\'re moving forward. If negative, your table tells you exactly where to look to correct.' },
          { type: 'h3', text: 'The right frequency' },
          { type: 'ul', items: [
            { text: '**Start of month:** plan your fixed expenses + savings.' },
            { text: '**Each week:** note the week\'s variable expenses (5 min).' },
            { text: '**End of month:** compare planned vs actual. Where did you overspend? Why?' },
          ]},
          { type: 'tip', text: 'Regularity beats precision. An approximate weekly track is far more useful than a perfect quarterly one.' },
        ],
      },
      {
        title: '4. Managing unexpected expenses and debts',
        blocks: [
          { type: 'p', text: 'Two topics that derail even the best financial intentions.' },
          { type: 'h3', text: 'Unexpected expenses — anticipate before they arrive' },
          { type: 'p', text: 'An unexpected expense is only "unexpected" in its timing. Getting sick, needing to repair something, an urgent family expense — these events are certain, only their date is unknown.' },
          { type: 'ul', items: [
            { text: 'Add an **"unexpected expenses" line in your monthly budget** — even if you don\'t touch it this month, it\'ll be there next month.' },
            { text: 'Recommended amount: 5 to 10% of your monthly income.' },
          ]},
          { type: 'h3', text: 'Debts — the snowball method' },
          { type: 'p', text: 'If you have several debts, use the **snowball method**:' },
          { type: 'ol', items: [
            { text: 'List all your debts from smallest to largest amount.' },
            { text: 'Pay the minimum on all except the smallest.' },
            { text: 'Attack the smallest debt with everything you have.' },
            { text: 'Once repaid, redirect the effort to the next one.' },
          ]},
          { type: 'p', text: 'The psychological advantage: you see debts disappear quickly, which maintains motivation.' },
          { type: 'tip', text: 'Before taking on a new debt, ask yourself: "Can I afford the monthly payments every month, even in a tough month?" If you hesitate, the answer is no.' },
        ],
      },
      {
        title: '5. Where to start today',
        blocks: [
          { type: 'p', text: 'The best method is the one you apply, not the most complex. Here are 3 actions to do in the next 24 hours.' },
          { type: 'h3', text: 'Action 1 — This month\'s overview' },
          { type: 'p', text: 'Take 10 minutes to list (from memory if needed) what you spent this month. Sort by: housing, food, transport, communication, leisure, unexpected. Which category surprises you most?' },
          { type: 'h3', text: 'Action 2 — Set a single savings goal' },
          { type: 'p', text: 'Not 10 goals — just one, small and achievable. For example: set aside 2,000 FCFA this month. Then 3,000 next month. Regularity counts more than the amount.' },
          { type: 'h3', text: 'Action 3 — Create your tracking system' },
          { type: 'p', text: 'A notebook, a WhatsApp message to yourself, a note on your phone — choose something you\'ll actually use. For 7 days, note every expense, even the smallest.' },
          { type: 'tip', text: 'You don\'t need to change everything at once. One small habit maintained for 30 days is worth more than a perfect plan abandoned after a week.' },
        ],
      },
    ],
    quiz: [
      {
        q: 'What is the first step to regain control of your money?',
        opts: ['Earn more money', 'Write down all your expenses for 30 days', 'Open a bank account', 'Stop all non-essential purchases'],
        correct: 1,
      },
      {
        q: 'According to the 3-envelope rule, what is the recommended minimum percentage for savings?',
        opts: ['2%', '5%', '10%', '30%'],
        correct: 2,
      },
      {
        q: 'The rule of "pay yourself first" means:',
        opts: ['Pay your debts first', 'Spend on your pleasures before other obligations', 'Set aside your savings upon receiving income, before any other expense', 'Increase your salary'],
        correct: 2,
      },
      {
        q: 'Which of these is a common "invisible expense"?',
        opts: ['Monthly rent', 'Children\'s school fees', 'Small untracked daily purchases (water, snacks, unexpected trips…)', 'Electricity'],
        correct: 2,
      },
      {
        q: 'The ideal safety cushion corresponds to:',
        opts: ['50,000 FCFA fixed', '1 week of expenses', '1 to 3 months of essential expenses', '1 year\'s salary'],
        correct: 2,
      },
    ],
  },

  // Module F2 — Turn What You Know Into Income
  f2: {
    sections: [
      {
        title: '1. You already have everything you need',
        blocks: [
          { type: 'p', text: 'The biggest entrepreneurship myth: "you need capital to start." The reality in our neighborhoods and cities is that thousands of people make their living with what they **know how to do**, not what they have.' },
          { type: 'h3', text: 'The 3 capitals you already possess' },
          { type: 'ul', items: [
            { text: '**Human capital** — what you know how to do: sew, cook, teach, care, repair, build, style hair, photograph, translate, drive, sell...' },
            { text: '**Relational capital** — the people you know, your neighborhood, your family, your school, your church, your association.' },
            { text: '**Time capital** — even with a job, there\'s often recoverable time (weekends, evenings, breaks) to start a secondary activity.' },
          ]},
          { type: 'p', text: 'The question isn\'t "do I have the resources?" but "am I looking at my existing resources the right way?"' },
          { type: 'tip', text: 'Ask yourself this: "What do people ask my help for or compliment me on?" The answer often gives a serious lead.' },
        ],
      },
      {
        title: '2. 7 ways to monetize without financial capital',
        blocks: [
          { type: 'p', text: 'Here are 7 proven models that don\'t require significant upfront investment.' },
          { type: 'ol', items: [
            { text: '**Direct personal service** — home hairdressing, private lessons, childcare, elderly care. You sell your time and know-how.' },
            { text: '**Product transformation** — buy raw materials and transform them (bread, cakes, juice, fried food) to sell with a margin.' },
            { text: '**Intermediary / Brokerage** — connect sellers and buyers you know, take a commission on the introduction.' },
            { text: '**Resale with added value** — buy wholesale or in bulk, package differently, sell retail or in small portions.' },
            { text: '**Training and transmission** — if you master something (software, a language, an instrument, a trade), you can teach it.' },
            { text: '**Digital service** — simple graphic design, data entry, translation, social media management for merchants.' },
            { text: '**Recurring physical service** — cleaning, gardening, delivery, ironing service — permanent needs in every neighborhood.' },
          ]},
        ],
      },
      {
        title: '3. How to set your price (without undervaluing or scaring away clients)',
        blocks: [
          { type: 'p', text: 'This is the question that blocks most beginners. "What if it\'s too expensive?" "I don\'t want to charge my relatives." "I don\'t know how much to ask."' },
          { type: 'h3', text: 'The basic formula' },
          { type: 'p', text: '**Selling price = Cost of materials + Your time (valued) + Profit margin**' },
          { type: 'p', text: 'Never make the mistake of forgetting to count your time. It\'s the most precious non-renewable resource you engage.' },
          { type: 'h3', text: '3 concrete methods' },
          { type: 'ol', items: [
            { text: '**Benchmark method** — see what others charge for the same service in your neighborhood. Position slightly below to start, then increase as you build a reputation.' },
            { text: '**Perceived value method** — ask yourself what your service is worth to the client. An hour of private lessons that gets a child to the next grade is worth infinitely more than your hourly cost.' },
            { text: '**Cost + margin method** — add up all your costs (materials, transport, time), then add 30 to 50% margin. That\'s your floor price.' },
          ]},
          { type: 'tip', text: 'Don\'t underprice to "build loyalty". A price too low creates an image of mediocre quality — and exhausts you without enriching you. Start correctly or improve progressively.' },
          { type: 'h3', text: 'How to announce your price without hesitating' },
          { type: 'p', text: 'State your price calmly and with confidence, without apologizing. "It\'s X FCFA" — period. If they negotiate, you can adjust slightly, but don\'t discount your work under social pressure.' },
        ],
      },
      {
        title: '4. Finding your first clients (without a marketing budget)',
        blocks: [
          { type: 'p', text: 'The first clients are often right there, around you. They\'re waiting for just one thing: for you to make them a clear offer.' },
          { type: 'h3', text: 'The circle of 3 reasons' },
          { type: 'p', text: 'Start by listing:' },
          { type: 'ul', items: [
            { text: '**Circle 1 — Family and close friends:** who in your family or close friends might need what you offer, or know someone who does?' },
            { text: '**Circle 2 — Neighborhood:** around where you live, who is already paying for this service but not to you?' },
            { text: '**Circle 3 — Communities:** your church, association, market, WhatsApp group.' },
          ]},
          { type: 'h3', text: 'The simple WhatsApp announcement' },
          { type: 'p', text: 'A well-written message in 3 WhatsApp groups can bring your first 5 clients. Structure: catchy emoji + what you do + starting price + your number + "Tell people who are looking 😊".' },
          { type: 'h3', text: 'The power of the first testimonial' },
          { type: 'p', text: 'Do your first 2 or 3 services for close friends — with care. Ask them to leave you a review or actively recommend you. One sincere first testimonial is worth more than any paid advertising.' },
        ],
      },
      {
        title: '5. Taking action this week — the 5-day plan',
        blocks: [
          { type: 'p', text: 'Most people think about starting an activity but never act. Here\'s a concrete 5-day plan to go from "I\'m thinking about it" to "I have my first clients".' },
          { type: 'ul', items: [
            { text: '**Day 1 — Choose:** list 3 things you know how to do that others pay for. Choose the easiest to start immediately.' },
            { text: '**Day 2 — Set the price:** use one of the 3 methods from Section 3. Prepare your answer for when someone asks your price.' },
            { text: '**Day 3 — Create your announcement:** a short, clear message with emoji, service, price and contact. Keep it under 5 lines.' },
            { text: '**Day 4 — Spread it:** send your announcement to at least 3 groups or directly to 10 people. Talk about it in person to 2 or 3 close friends.' },
            { text: '**Day 5 — Wait and follow up:** if no response, call back or resend. Commercial shyness is the beginner\'s worst enemy.' },
          ]},
          { type: 'tip', text: 'You don\'t need a business name, a logo or a bank account to start. These things come after the first income — not before.' },
        ],
      },
    ],
    quiz: [
      {
        q: 'Which of the following is a "capital" you already possess without financial investment?',
        opts: ['A commercial space', 'Your know-how and network of contacts', 'A professional bank account', 'A university degree'],
        correct: 1,
      },
      {
        q: 'What is the first place to look for your first clients?',
        opts: ['Public social networks', 'Family, close friends and neighborhood', 'Paid advertising', 'A professional website'],
        correct: 1,
      },
      {
        q: 'When setting your price, what do people often forget to include?',
        opts: ['The cost of raw materials', 'The profit margin', 'The value of your own time', 'The market price'],
        correct: 2,
      },
      {
        q: 'To start a service business, what is essential from the start?',
        opts: ['A logo and a business name', 'A professional bank account', 'A clear announcement and the willingness to offer services', 'Administrative authorization'],
        correct: 2,
      },
      {
        q: 'What builds the most trust for a new service provider?',
        opts: ['A nice business card', 'A sincere testimonial from a satisfied client', 'Very low prices', 'A lot of social media likes'],
        correct: 1,
      },
    ],
  },

  // Module F3 — Why You Never Manage to Save
  f3: {
    sections: [
      {
        title: '1. It\'s not a willpower problem',
        blocks: [
          { type: 'p', text: '"This month, I\'ll set some aside." And then the month ends, and there\'s nothing left. If you recognize yourself in this phrase, you\'re not alone — it\'s the experience of the vast majority of people, including those who earn well.' },
          { type: 'h3', text: 'Why good intentions are not enough' },
          { type: 'p', text: 'The failure to save is almost never a character issue. It\'s a **method and structure** issue. Here\'s what silently sabotages your efforts:' },
          { type: 'ul', items: [
            { text: '**Trap 1 — Saving what\'s left.** If you wait until the end of the month to save "what\'s left", there\'s almost never anything left. Expenses naturally expand to fill the available budget.' },
            { text: '**Trap 2 — No concrete goal.** "Saving" without a specific purpose is like traveling without a destination. The human brain is bad at sacrificing for a vague goal.' },
            { text: '**Trap 3 — Mixing savings with the current account.** When savings are in the same place as daily expenses, they always end up being spent.' },
          ]},
          { type: 'tip', text: 'These traps are design bugs, not character flaws. Changing the method changes the result — even without changing discipline.' },
        ],
      },
      {
        title: '2. The "Pay Yourself First" method',
        blocks: [
          { type: 'p', text: 'This is the golden rule of savings. Simple to understand, transformative to apply.' },
          { type: 'h3', text: 'The principle' },
          { type: 'p', text: 'As soon as you receive income — salary, client payment, transfer — **immediately set aside your savings share, before paying anything else.** Rent, food, everything else waits for this first action.' },
          { type: 'p', text: 'By treating savings as a priority bill (that you owe to yourself), you reverse the problem: instead of saving what\'s left, you spend what\'s left after savings.' },
          { type: 'h3', text: 'How much to set aside?' },
          { type: 'ul', items: [
            { text: '**If you\'re starting:** begin with 5%, even 3%. The habit counts more than the amount.' },
            { text: '**Intermediate goal:** 10% of your net income.' },
            { text: '**Solid goal:** 15 to 20% — you\'re really building a financial cushion.' },
          ]},
          { type: 'h3', text: 'Where to save?' },
          { type: 'p', text: 'Most importantly: **physically separated from your daily money**. Options:' },
          { type: 'ul', items: [
            { text: 'A second Mobile Money number (MTN or Moov) dedicated only to savings' },
            { text: 'A reliable and well-managed rotating savings group' },
            { text: 'A savings bank account (CLCAM, BOA, Ecobank…)' },
            { text: 'A physical envelope with a trusted person who won\'t give it back on a simple request' },
          ]},
        ],
      },
      {
        title: '3. Setting a realistic savings goal',
        blocks: [
          { type: 'p', text: 'An effective savings goal meets 3 criteria: it\'s **concrete** (a specific number), **dated** (a deadline) and **useful** (you know why you\'re saving).' },
          { type: 'h3', text: 'The 3 levels of goals' },
          { type: 'ul', items: [
            { text: '**Level 1 — Emergency cushion (absolute priority):** save the equivalent of 1 to 3 months of essential expenses. This prevents you from going into debt at every unexpected expense. Target: 50,000 to 150,000 FCFA depending on your situation.' },
            { text: '**Level 2 — Medium-term goal:** something concrete in 6 to 18 months — equipment, training, a contribution to a family project. Visualizing the destination makes the effort bearable.' },
            { text: '**Level 3 — Investment and future:** once the cushion is built, make savings work (real estate, secondary activity, cooperative, productive assets).' },
          ]},
          { type: 'h3', text: 'The "anchor date" technique' },
          { type: 'p', text: 'Associate your goal with a meaningful date: "I want to have X FCFA aside before December 31" or "before my child enters high school". The anchor date turns an abstract goal into a concrete countdown.' },
          { type: 'tip', text: 'Write down your goal, the amount and the date somewhere you see often. A note on your phone, a phrase on your bedroom wall. What\'s written is real.' },
        ],
      },
      {
        title: '4. The traps that derail savings',
        blocks: [
          { type: 'p', text: 'Even with the best method, some traps persist. Knowing them allows you to anticipate them.' },
          { type: 'h3', text: 'Trap 1 — "Non-urgent" emergencies' },
          { type: 'p', text: 'Many withdrawals from savings are made in the name of "emergencies" that aren\'t really emergencies. Before touching your savings, ask yourself honestly: "Is this really an emergency, or is it a desire that can\'t wait?"' },
          { type: 'h3', text: 'Trap 2 — Social pressure' },
          { type: 'p', text: 'Ceremonies, gifts, family support — the demands are real and legitimate in our culture. But they must be budgeted in advance (a "solidarity" line in your budget) rather than paid from savings.' },
          { type: 'h3', text: 'Trap 3 — The single rotating savings illusion' },
          { type: 'p', text: 'A rotating savings group is an excellent forced savings tool — but note: it\'s not an alternative to a liquid emergency cushion. If your only savings are in a rotating group, you can\'t access them in case of a real need.' },
          { type: 'h3', text: 'Trap 4 — Giving up after one missed month' },
          { type: 'p', text: 'A month where you couldn\'t save is not a failure — it\'s an incident. The error is treating the incident as proof that "it doesn\'t work for you". Resume the next month.' },
          { type: 'tip', text: 'Regular but imperfect savings (9 months out of 12) is infinitely more effective than perfect savings planned but never started.' },
        ],
      },
      {
        title: '5. Your concrete action plan — starting today',
        blocks: [
          { type: 'p', text: 'Three actions you can do in the next 24 hours to break the "good intention → nothing" cycle.' },
          { type: 'h3', text: 'Action 1 — Create your separate "vault"' },
          { type: 'p', text: 'Today, create a second Mobile Money number (or identify a separate support) that will be exclusively your savings. Give it a mental name: "Safety Cushion", "School Project", "My Future".' },
          { type: 'h3', text: 'Action 2 — Set your minimum amount' },
          { type: 'p', text: 'Decide on a very small but non-zero amount. Even 1,000 FCFA per month. The goal is to create the habit of the gesture — the amount will follow.' },
          { type: 'h3', text: 'Action 3 — Schedule or note an alert' },
          { type: 'p', text: 'Set an alert on your phone on the day you usually receive income: "Transfer savings now." This mechanical reminder compensates for the fact that willpower alone is insufficient in busy moments.' },
          { type: 'tip', text: 'Discipline is not an innate quality — it\'s a system you build. Build your savings system and let it work for you.' },
        ],
      },
    ],
    quiz: [
      {
        q: 'Why does "saving what\'s left at the end of the month" almost never work?',
        opts: ['Because people lack discipline', 'Because expenses naturally expand to fill the available budget', 'Because income is too low', 'Because prices increase every month'],
        correct: 1,
      },
      {
        q: 'What does "pay yourself first" mean in savings?',
        opts: ['Treat yourself before paying bills', 'Set aside savings immediately upon receiving income, before any other expense', 'Increase your salary', 'Pay your bills first'],
        correct: 1,
      },
      {
        q: 'What is the "Level 1" savings goal — absolute priority?',
        opts: ['Save for a real estate project', 'Build an emergency cushion of 1 to 3 months of essential expenses', 'Have 1,000,000 FCFA in the bank', 'Invest in the stock market'],
        correct: 1,
      },
      {
        q: 'Why must savings be physically separated from the current account?',
        opts: ['To pay less bank fees', 'To earn higher interest', 'Because money mixed with the current account always ends up being spent', 'To avoid taxes'],
        correct: 2,
      },
      {
        q: 'If you miss your savings goal one month, the right attitude is:',
        opts: ['Abandon the method, it doesn\'t work for you', 'Double savings the next month to compensate', 'Treat it as an incident and resume normally the next month', 'Wait until you have more income to start again'],
        correct: 2,
      },
    ],
  },
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const CONTENT: Record<'fr' | 'en', AcademieContent> = { fr: FR, en: EN }
