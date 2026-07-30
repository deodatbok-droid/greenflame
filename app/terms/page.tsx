import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'Conditions Générales d\'Utilisation — GreenFlame',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={48} className="w-12 h-12" />
          <div>
            <p className="font-bold text-brand-700 text-lg leading-tight">GreenFlame</p>
            <p className="text-xs text-gray-400">Commerce communautaire pan-africain</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Conditions Générales d&apos;Utilisation</h1>
            <p className="text-xs text-gray-400">Dernière mise à jour : juillet 2026 · GreenFlame SAS, Cotonou, Bénin</p>
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">1. Présentation de GreenFlame</h2>
            <p>
              GreenFlame est une plateforme de commerce communautaire pan-africaine permettant aux utilisateurs
              d&apos;acheter auprès de marchands locaux tout en bénéficiant d&apos;un système automatique de cashback
              et de dividendes communautaires sur chaque transaction.
            </p>
            <p>
              La plateforme est éditée et exploitée par <strong>GreenFlame SAS</strong>, dont le siège social est à
              Cotonou, Bénin. En utilisant GreenFlame, vous acceptez les présentes Conditions Générales
              d&apos;Utilisation (CGU) dans leur intégralité.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">2. Inscription et compte utilisateur</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>L&apos;inscription est gratuite et se fait par numéro de téléphone béninois (+229) via un code OTP SMS.</li>
              <li>Un seul compte par numéro de téléphone est autorisé.</li>
              <li>Le compte est <strong>activé</strong> lors du premier achat complété sur la plateforme.</li>
              <li>
                Vous êtes responsable de la confidentialité de votre code OTP. GreenFlame ne vous demandera
                jamais votre OTP par téléphone, SMS ou e-mail.
              </li>
              <li>
                GreenFlame se réserve le droit de suspendre tout compte en cas de fraude, d&apos;usurpation
                d&apos;identité ou de violation des présentes CGU.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">3. Cashback et dividendes communautaires</h2>
            <p>
              Sur chaque transaction validée, la commission prélevée est redistribuée selon les règles
              de gouvernance fixes suivantes :
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>12%</strong> crédité en cashback à l&apos;acheteur.</li>
              <li>
                <strong>40%</strong> redistribué à la communauté sur 5 niveaux
                (N1 : 12 % · N2 : 10 % · N3 : 8 % · N4 : 6 % · N5 : 4 %).
              </li>
              <li><strong>3%</strong> alimente le Pool Récompenses et Événements GreenFlame.</li>
              <li><strong>45%</strong> revient à GreenFlame pour son fonctionnement et son développement.</li>
            </ul>
            <p>
              Ces pourcentages sont des invariants de gouvernance inscrits dans le protocole de traitement
              des transactions. Ils ne peuvent être modifiés que par décision formelle de la direction de GreenFlame.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">4. Points GreenFlame (GFP)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Lorsque le cashback calculé est inférieur à 50 FCFA, il est crédité en Points GreenFlame
                (GFP) plutôt qu&apos;en FCFA.
              </li>
              <li><strong>1 FCFA donne droit à 10 GFP.</strong></li>
              <li>Les GFP peuvent être convertis en FCFA à partir d&apos;un solde de 5 000 GFP accumulés.</li>
              <li>
                Les GFP n&apos;ont aucune valeur monétaire tant qu&apos;ils n&apos;ont pas été convertis
                et ne peuvent pas être transférés à un autre utilisateur.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">5. Invitations et communauté</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>L&apos;accès à GreenFlame est entièrement gratuit. Aucun frais d&apos;adhésion n&apos;est requis.</li>
              <li>
                Les dividendes communautaires sont générés <strong>exclusivement</strong> par des transactions
                commerciales réelles entre acheteurs et marchands.
              </li>
              <li>
                Toute manipulation artificielle (fausses transactions, boucles de commission, comptes multiples)
                entraîne la suspension immédiate et définitive du ou des comptes impliqués.
              </li>
              <li>
                GreenFlame n&apos;est pas un système de vente pyramidale. Aucun gain n&apos;est promis
                en dehors des transactions réelles.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">6. Devenir marchand</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Seul un utilisateur ayant effectué au moins un achat sur la plateforme peut accéder
                au statut de marchand.
              </li>
              <li>L&apos;activation d&apos;une boutique est gratuite.</li>
              <li>
                Le marchand accepte le taux de commission applicable à sa catégorie de produits,
                tel que défini par GreenFlame.
              </li>
              <li>
                GreenFlame se réserve le droit de suspendre une boutique en cas de fraude, de plaintes
                répétées ou d&apos;inactivité prolongée.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">7. Module Business</h2>
            <p>
              Le module Business (business.greenflameafrica.com) est un outil de gestion commerciale
              accessible aux marchands abonnés. Il permet la gestion du stock, des ventes, de la caisse,
              des devis, des factures et du personnel.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>L&apos;accès au module Business est soumis à un abonnement actif au plan correspondant.</li>
              <li>
                Les données du module Business (transactions, stock, membres de l&apos;équipe) sont
                strictement confidentielles et accessibles uniquement aux membres autorisés de chaque compte marchand.
              </li>
              <li>
                Le propriétaire du compte est seul responsable de la gestion des accès accordés à ses collaborateurs.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">8. Retraits</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Les retraits sont effectués vers un numéro Mobile Money (MTN MoMo, Moov Money ou Celtiis)
                enregistré à votre nom.
              </li>
              <li>Montant minimum de retrait en FCFA : 500 FCFA.</li>
              <li>
                Les GFP sont convertibles en FCFA à partir de 5 000 GFP accumulés
                (montant minimum de retrait après conversion : 1 000 FCFA).
              </li>
              <li>
                GreenFlame se réserve le droit de suspendre les retraits d&apos;un compte faisant
                l&apos;objet d&apos;une enquête pour fraude.
              </li>
              <li>Les délais de traitement dépendent des opérateurs Mobile Money et peuvent varier.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">9. Protection des données personnelles</h2>
            <p>
              GreenFlame collecte et traite vos données personnelles dans le respect de la{' '}
              <strong>loi béninoise n°2009-09 du 22 mai 2009</strong> portant protection des données
              à caractère personnel, sous la supervision de l&apos;<strong>Autorité de Protection
              des Données Personnelles (APDP)</strong> du Bénin.
            </p>
            <p>
              Pour l&apos;exercice de vos droits (accès, rectification, suppression, portabilité) ou
              toute question relative à vos données :{' '}
              <span className="text-brand-600 font-medium">greenflameafrica8@gmail.com</span>
            </p>
            <p>
              Le détail complet de notre politique de traitement est disponible dans notre{' '}
              <Link href="/privacy" className="text-brand-600 hover:underline font-medium">
                Politique de Confidentialité
              </Link>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">10. Responsabilité</h2>
            <p>
              GreenFlame agit en tant qu&apos;intermédiaire technique entre acheteurs et marchands.
              GreenFlame n&apos;est pas responsable des litiges commerciaux entre utilisateurs et marchands,
              ni des interruptions de service liées aux opérateurs Mobile Money ou aux réseaux
              de télécommunication.
            </p>
            <p>
              La responsabilité de GreenFlame est limitée au montant des transactions effectuées sur
              la plateforme dans les 30 jours précédant le litige.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">11. Modification des CGU</h2>
            <p>
              GreenFlame se réserve le droit de modifier les présentes CGU à tout moment. En cas
              de modification substantielle, les utilisateurs seront notifiés par SMS ou par
              notification in-app au moins 15 jours avant l&apos;entrée en vigueur des nouvelles
              dispositions. La poursuite de l&apos;utilisation du service vaut acceptation des CGU modifiées.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">12. Droit applicable et contact</h2>
            <p>
              Les présentes CGU sont régies par le droit béninois. Tout litige sera soumis
              à la juridiction compétente de Cotonou, Bénin.
            </p>
            <p>
              Contact :{' '}
              <span className="text-brand-600 font-medium">greenflameafrica8@gmail.com</span>
              <br />GreenFlame SAS · Cotonou, Bénin
            </p>
          </section>
        </div>

        <div className="mt-6 flex justify-between items-center">
          <Link href="/" className="text-sm text-brand-600 hover:underline">
            ← Retour à l&apos;accueil
          </Link>
          <Link href="/privacy" className="text-sm text-brand-600 hover:underline">
            Politique de confidentialité →
          </Link>
        </div>
      </div>
    </div>
  )
}
