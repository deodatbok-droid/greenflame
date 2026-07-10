/**
 * Contenu source : GreenFlame_FAQ.md (vérifié contre l'état réel du code le 22 juin 2026).
 * Toute mise à jour doit être répercutée ici ET dans lib/chat/core.ts
 * pour que l'assistant chatbot reste cohérent avec le contenu affiché.
 */

export interface FaqItem  { q: string; a: string }
export interface FaqGroup { category: string; items: FaqItem[] }

export const FAQ_GROUPS: FaqGroup[] = [
  {
    category: 'Compte et inscription',
    items: [
      { q: 'Comment je crée mon compte GreenFlame ?', a: 'Avec votre numéro de téléphone, directement dans l\'application. C\'est rapide et gratuit.' },
      { q: 'Qu\'est-ce qu\'un Leader communautaire ?', a: 'C\'est la personne qui vous a fait découvrir GreenFlame — généralement celle dont vous avez utilisé le lien d\'invitation pour vous inscrire. Si vous ne vous êtes pas inscrit via un lien, le premier marchand chez qui vous achetez devient automatiquement votre Leader communautaire.' },
      { q: 'Pourquoi je ne vois pas encore mon cashback ou mon lien d\'invitation ?', a: 'Parce que votre compte n\'est pas encore "activé". L\'activation se déclenche automatiquement dès votre tout premier achat sur la plateforme. Avant cela, votre compte existe mais ces fonctionnalités restent en attente.' },
    ],
  },
  {
    category: 'Paiements et cashback',
    items: [
      { q: 'Comment je paie un marchand ?', a: 'Scannez son QR code, recherchez son nom, ou entrez son identifiant. Choisissez ensuite votre moyen de paiement (MTN MoMo, Moov, wallet GreenFlame, ou espèces), entrez le montant, et validez avec votre code PIN.' },
      { q: 'Quand est-ce que je reçois mon cashback ?', a: 'Immédiatement après un paiement par Mobile Money ou wallet. Pour un paiement en espèces, le cashback arrive dès que le marchand confirme avoir bien reçu l\'argent.' },
      { q: 'Pourquoi mon cashback est en partie affiché en GFP et pas en FCFA ?', a: 'Les GFP (GreenFlame Points) servent à ne jamais perdre les petites fractions de cashback trop fines pour être versées directement en FCFA. 10 GFP équivalent à 1 FCFA.' },
      { q: 'Quel est le taux de commission appliqué sur mes achats ?', a: 'La commission standard est de 10% chez la plupart des marchands, prélevée chez le marchand et non sur votre paiement. Une partie de cette commission finance directement votre cashback.' },
    ],
  },
  {
    category: 'Wallet et retraits',
    items: [
      { q: 'Comment retirer mes gains ?', a: 'Depuis la page Wallet, utilisez le bouton Retirer. Le minimum est 1 000 FCFA (ou 50 000 GFP). Le virement est effectué sur votre Mobile Money (MTN ou Moov) sous 24h.' },
      { q: 'Y a-t-il un plafond de retrait mensuel ?', a: 'Oui, 50 000 FCFA par mois par défaut. Ce plafond passe à 500 000 FCFA par mois une fois votre identité vérifiée.' },
      { q: 'Puis-je retirer du cash chez un marchand plutôt que par Mobile Money ?', a: 'Oui, chez un marchand ayant activé le service Point de dépôt/retrait (Service Agent). Ce canal facture 1% de frais de service sur le montant retiré — le retrait vers Mobile Money n\'a pas ce frais. Les dépôts en espèces chez un agent restent toujours gratuits.' },
      { q: 'Où je vois l\'historique de mes opérations ?', a: 'Dans votre wallet et dans l\'historique des transactions : cashback, dividendes, dépôts, retraits, achats, remboursements y sont tous listés.' },
    ],
  },
  {
    category: 'Communauté et revenus partagés',
    items: [
      { q: 'Comment je gagne de l\'argent grâce à mes invitations ?', a: 'Quand les personnes que vous avez invitées (et leurs propres invités, sur 5 Cercles) font des achats, une partie de la commission prélevée chez le marchand vous revient automatiquement en dividende communautaire. Vous n\'avez rien à faire de plus.' },
      { q: 'C\'est quoi les 5 Cercles ?', a: 'Ce sont les 5 cercles de profondeur de votre communauté : vos invités directs (Cercle 1), leurs propres invités (Cercle 2), et ainsi de suite jusqu\'au Cercle 5. Chaque Cercle a son propre taux de reversement.' },
      { q: 'Comment je partage mon lien d\'invitation ?', a: 'Depuis votre profil ou l\'espace Ma Communauté, une fois votre compte activé par un premier achat.' },
    ],
  },
  {
    category: 'Tontines',
    items: [
      { q: 'Comment je crée une tontine ?', a: 'Dans l\'application : donnez un nom au groupe, fixez le montant de la cotisation, la fréquence (hebdomadaire, bimensuelle, mensuelle) et la date de début, puis ajoutez les membres par nom et téléphone. Vous devenez automatiquement administrateur du groupe.' },
      { q: 'Que se passe-t-il quand j\'ajoute un membre ?', a: 'Il reçoit une invitation par WhatsApp (avec repli SMS) contenant un lien à valider sous 7 jours. Pour confirmer sa participation, il doit créer un compte GreenFlame ou se connecter à son compte existant. Sa place dans l\'ordre de rotation est réservée dès l\'ajout, mais il n\'est compté ni dans la cagnotte ni dans le suivi des cotisations tant qu\'il n\'a pas validé.' },
      { q: 'Un membre n\'a pas validé son invitation, que faire ?', a: 'Vous pouvez relancer l\'invitation à tout moment depuis l\'onglet Membres (un nouveau lien valable 7 jours est renvoyé). Il n\'y a pas de suppression automatique : le membre reste dans la liste, simplement en attente, jusqu\'à ce qu\'il valide.' },
      { q: 'Les membres doivent-ils avoir l\'application pour suivre la tontine ?', a: 'Non — un lien public permet à n\'importe quel membre de suivre l\'état des cotisations sans se connecter à l\'application.' },
    ],
  },
  {
    category: 'Bons de retrait',
    items: [
      { q: 'C\'est quoi un bon de retrait ?', a: 'Un moyen d\'envoyer de l\'argent à quelqu\'un qui pourra le retirer en espèces chez un marchand, sans avoir besoin de connaître son numéro de wallet.' },
      { q: 'Que se passe-t-il si le bon n\'est pas utilisé ?', a: 'Il est automatiquement recrédité s\'il est annulé ou s\'il expire sans avoir été encaissé.' },
      { q: 'Y a-t-il des frais ?', a: 'Oui, 1% de frais de service, prélevés uniquement au moment de l\'encaissement chez un marchand.' },
    ],
  },
  {
    category: 'Sécurité et identité',
    items: [
      { q: 'Pourquoi vérifier mon identité (KYC) ?', a: 'Cela fait passer votre plafond de retrait mensuel de 50 000 à 500 000 FCFA, augmente votre éligibilité au crédit sur la plateforme, et débloque la recherche + invitation directe d\'autres membres dans la messagerie. C\'est optionnel mais avantageux.' },
      { q: 'Mes crédits sont-ils sécurisés ?', a: 'Oui. Votre wallet GreenFlame est protégé par un code PIN et chaque opération de retrait est authentifiée. Les fonds FCFA sont 100% adossés aux transactions réelles.' },
      { q: 'Mon numéro de téléphone est-il visible par les autres membres ?', a: 'Non. Même dans la fonction recherche et invitation, votre numéro complet n\'est jamais affiché dans les résultats.' },
    ],
  },
  {
    category: 'Académie et autres fonctionnalités',
    items: [
      { q: 'À quoi sert l\'Académie GreenFlame ?', a: 'À vous aider à gérer votre budget, estimer vos revenus potentiels et épargner régulièrement, avec des modules pratiques et un quiz de validation à la fin de chacun.' },
      { q: 'C\'est quoi le Système Flamme & Rang ?', a: 'Un système de progression qui récompense votre activité réelle (transactions, formations, tontines) et la couverture de vos objectifs de vie, à travers 5 rangs visuels sur votre tableau de bord.' },
      { q: 'C\'est quoi la Cagnotte Communautaire ?', a: 'Chaque mois, une petite partie de votre cashback déjà gagné (les 50 premiers FCFA) est mise de côté dans une cagnotte collective. Des tirages réguliers mais imprévisibles désignent des gagnants, et tous les autres reçoivent une compensation équivalente.' },
    ],
  },
]

export const MERCHANT_FAQ_GROUPS: FaqGroup[] = [
  {
    category: 'Devenir marchand',
    items: [
      { q: 'Comment j\'active ma boutique ?', a: 'Depuis votre compte personnel, remplissez le formulaire d\'activation (nom commercial, secteur, ville, quartier). Votre compte acheteur reste actif en parallèle — vous ne perdez rien.' },
      { q: 'Quelle commission je paie en tant que marchand ?', a: '10% standard sur chaque vente, dont 12% de cette commission reversés en cashback à vos clients.' },
      { q: 'Combien de produits puis-je ajouter ?', a: '10 produits actifs maximum en compte gratuit, illimité avec l\'abonnement Pro ou VIP.' },
    ],
  },
  {
    category: 'Abonnements marchands',
    items: [
      { q: 'Quelle est la différence entre Gratuit, Pro et VIP ?', a: 'Le compte gratuit limite les produits (10) et les devis/factures (5/mois). Pro débloque l\'illimité sur ces deux points plus les analytics avancés. VIP ajoute le multi-caissier (jusqu\'à 5 caissiers), l\'acceptation des bons de retrait, et la mise en avant automatique de vos nouveaux produits.' },
      { q: 'Comment je passe à un palier supérieur ?', a: 'Directement dans l\'application, par paiement MTN MoMo ou Moov.' },
    ],
  },
  {
    category: 'Encaissement et outils marchands',
    items: [
      { q: 'Quels types de paiement je peux encaisser ?', a: 'Vente de produit/service (avec commission et cashback), recharge du wallet d\'un client (sans commission), bon de retrait (réservé aux VIP), paiement d\'abonnement, ou autre paiement libre.' },
      { q: 'Comment j\'identifie un client pour l\'encaisser ?', a: 'Générez un QR code à lui montrer, ou encaissez directement via son numéro de téléphone.' },
      { q: 'Existe-t-il des outils adaptés à mon métier ?', a: 'Oui. Des modules complets existent pour la Couture, le BTP, la Restauration et la Coiffure/Beauté. De nombreux autres métiers ont accès à des générateurs de devis/factures adaptés à leur vocabulaire.' },
      { q: 'Comment devenir un point de dépôt/retrait cash (Service Agent) ?', a: 'Depuis votre espace marchand. Une fois actif, vous gagnez 0,5% de commission sur chaque retrait client, et les dépôts sont gratuits pour vous tout en créditant le client.' },
    ],
  },
]
