import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'Conditions d\'utilisation — GreenFlame',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Logo size={48} className="w-12 h-12" />
          <div>
            <p className="font-bold text-brand-700 text-lg leading-tight">GreenFlame</p>
            <p className="text-xs text-gray-400">Commerce communautaire pan-africain</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Conditions d&apos;utilisation</h1>
            <p className="text-xs text-gray-400">Dernière mise à jour : mai 2026 · GreenFlame SAS, Cotonou, Bénin</p>
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">1. Présentation de GreenFlame</h2>
            <p>
              GreenFlame est une plateforme de commerce communautaire pan-africaine permettant aux utilisateurs d&apos;acheter auprès de marchands locaux tout en bénéficiant d&apos;un système de cashback et de dividendes communautaires sur chaque transaction.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">2. Inscription et compte</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>L&apos;inscription est gratuite et se fait par numéro de téléphone ou par adresse e-mail.</li>
              <li>Un seul compte par numéro de téléphone est autorisé.</li>
              <li>Le compte est <strong>activé</strong> lors du premier achat complété sur la plateforme.</li>
              <li>Vous êtes responsable de la confidentialité de votre code OTP.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">3. Cashback et dividendes communautaires</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Sur chaque transaction, une commission est prélevée sur le montant selon le taux convenu entre GreenFlame et le marchand pour la catégorie du produit vendu.</li>
              <li>12% de cette commission est crédité en cashback à l&apos;acheteur.</li>
              <li>3% alimente le Pool Récompenses et Événements GreenFlame.</li>
              <li>40% est redistribué à votre communauté sur 5 niveaux (N1 à N5).</li>
              <li>45% revient à la plateforme GreenFlame pour son fonctionnement.</li>
              <li>Les cashbacks inférieurs à 50 FCFA sont crédités en Points GreenFlame (GFP). 1 GFP = 0,1 FCFA.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">4. Invitations et communauté</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>L&apos;inscription et l&apos;accès à GreenFlame sont entièrement gratuits. Aucun frais d&apos;adhésion n&apos;est requis.</li>
              <li>Les dividendes communautaires sont générés exclusivement par les transactions réelles.</li>
              <li>Toute manipulation artificielle (fausses transactions, boucles de commission) entraîne la suspension du compte.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">5. Devenir marchand</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Seul un utilisateur ayant effectué au moins un achat sur la plateforme peut devenir marchand.</li>
              <li>L&apos;activation d&apos;une boutique est gratuite.</li>
              <li>Le marchand accepte le taux de commission défini par GreenFlame pour sa catégorie.</li>
              <li>GreenFlame se réserve le droit de suspendre un marchand en cas de fraude ou d&apos;inactivité prolongée.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">6. Retraits</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Les retraits sont effectués vers un numéro Mobile Money (MTN MoMo, Moov Money ou Celtiis).</li>
              <li>Montant minimum de retrait : 500 FCFA.</li>
              <li>Les Points GreenFlame peuvent être convertis en FCFA à partir de 5 000 GFP accumulés.</li>
              <li>Montant minimum de retrait FCFA : 1 000 FCFA.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">7. Responsabilité</h2>
            <p>
              GreenFlame agit en tant qu&apos;intermédiaire technique entre acheteurs et marchands. GreenFlame n&apos;est pas responsable des litiges commerciaux entre utilisateurs et marchands. Les données personnelles sont traitées conformément à la réglementation BCEAO applicable aux plateformes de paiement numérique.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">8. Contact</h2>
            <p>
              Pour toute question : <span className="text-brand-600 font-medium">greenflameafrica8@gmail.com</span>
              <br />GreenFlame SAS · Cotonou, Bénin
            </p>
          </section>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-brand-600 hover:underline">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
