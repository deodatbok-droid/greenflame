import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'Politique de Confidentialité — GreenFlame',
}

export default function PrivacyPage() {
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Politique de Confidentialité</h1>
            <p className="text-xs text-gray-400">Dernière mise à jour : juillet 2026 · GreenFlame SAS, Cotonou, Bénin</p>
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement de vos données personnelles est <strong>GreenFlame SAS</strong>,
              dont le siège social est situé à Cotonou, Bénin.
            </p>
            <p>
              Contact pour toute question relative aux données personnelles :{' '}
              <span className="text-brand-600 font-medium">greenflameafrica8@gmail.com</span>
              {' '}(mention « Données personnelles »).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">2. Données collectées</h2>
            <p>Nous collectons les catégories de données suivantes :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Données d&apos;identité :</strong> nom complet, numéro de téléphone.</li>
              <li><strong>Données de connexion :</strong> historique de sessions, adresse IP, type d&apos;appareil.</li>
              <li>
                <strong>Données transactionnelles :</strong> montants, dates, marchands, cashback crédité,
                Points GreenFlame (GFP), retraits effectués.
              </li>
              <li>
                <strong>Données communautaires :</strong> structure de votre réseau (parrain, filleuls
                jusqu&apos;à 5 niveaux).
              </li>
              <li>
                <strong>Données marchandes :</strong> informations de boutique, catalogue produits, stock,
                historique de ventes, factures, bons de commande, fournisseurs.
              </li>
              <li>
                <strong>Données du module Business :</strong> membres de l&apos;équipe, rôles, accès accordés.
              </li>
              <li>
                <strong>Données techniques :</strong> journaux d&apos;accès, type de navigateur,
                version de l&apos;application.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">3. Finalités et base légale du traitement</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[480px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 font-semibold border border-gray-100 w-2/3">Finalité</th>
                    <th className="text-left p-2 font-semibold border border-gray-100">Base légale</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Exécution du service (transactions, cashback, dividendes)', 'Exécution du contrat'],
                    ['Vérification d\'identité par OTP', 'Obligation légale (BCEAO)'],
                    ['Prévention de la fraude et sécurité des comptes', 'Intérêt légitime'],
                    ['Gestion de l\'arbre communautaire (réseau)', 'Exécution du contrat'],
                    ['Envoi de notifications SMS (OTP, alertes)', 'Consentement / exécution du contrat'],
                    ['Conformité réglementaire BCEAO (paiement numérique)', 'Obligation légale'],
                    ['Gestion du module Business (stock, équipe, ventes)', 'Exécution du contrat'],
                    ['Amélioration du service et statistiques agrégées', 'Intérêt légitime'],
                  ].map(([fin, base], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 border border-gray-100">{fin}</td>
                      <td className="p-2 border border-gray-100 text-gray-500">{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">4. Durée de conservation</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Données de compte actif :</strong> pendant toute la durée de la relation contractuelle.</li>
              <li>
                <strong>Données transactionnelles :</strong> 10 ans à compter de chaque transaction
                (obligation comptable et réglementaire BCEAO).
              </li>
              <li><strong>Journaux de connexion :</strong> 12 mois glissants.</li>
              <li>
                <strong>Données d&apos;un compte clôturé :</strong> 3 ans après la clôture, puis
                suppression définitive ou anonymisation irréversible.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">5. Destinataires et sous-traitants</h2>
            <p>Vos données sont partagées avec les sous-traitants techniques suivants, dans le cadre strict de l&apos;exécution du service :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Supabase Inc.</strong> (États-Unis) — hébergement de la base de données,
                authentification et stockage des fichiers. Transfert encadré par des garanties contractuelles appropriées.
              </li>
              <li>
                <strong>Vercel Inc.</strong> (États-Unis) — hébergement et déploiement de l&apos;application web.
              </li>
              <li>
                <strong>Africa&apos;s Talking Ltd.</strong> (Kenya) — envoi des codes OTP par SMS.
              </li>
              <li>
                <strong>MTN MoMo / Moov Money / Celtiis</strong> (Bénin) — traitement des paiements
                et des retraits Mobile Money.
              </li>
            </ul>
            <p className="font-medium text-gray-800">
              GreenFlame ne vend, ne loue ni ne cède vos données à des tiers à des fins publicitaires
              ou commerciales.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">6. Transferts internationaux de données</h2>
            <p>
              Certains de nos sous-traitants (Supabase, Vercel, Africa&apos;s Talking) sont établis
              en dehors du Bénin. Ces transferts sont encadrés par des garanties contractuelles conformes
              aux exigences de l&apos;APDP Bénin. Vos données ne sont pas transmises à des tiers non
              liés à l&apos;exécution du service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">7. Vos droits</h2>
            <p>
              Conformément à la <strong>loi n°2009-09 du 22 mai 2009</strong> portant protection des
              données à caractère personnel au Bénin, vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Droit d&apos;accès :</strong> obtenir une copie de vos données personnelles détenues par GreenFlame.</li>
              <li><strong>Droit de rectification :</strong> faire corriger des données inexactes ou incomplètes.</li>
              <li>
                <strong>Droit à l&apos;effacement :</strong> demander la suppression de votre compte et de
                vos données, sous réserve des obligations légales de conservation (transactions, BCEAO).
              </li>
              <li>
                <strong>Droit d&apos;opposition :</strong> vous opposer aux traitements fondés sur
                l&apos;intérêt légitime de GreenFlame.
              </li>
              <li>
                <strong>Droit à la portabilité :</strong> récupérer vos données dans un format structuré
                et lisible par machine.
              </li>
            </ul>
            <p>
              Pour exercer ces droits, écrivez à{' '}
              <span className="text-brand-600 font-medium">greenflameafrica8@gmail.com</span>{' '}
              avec la mention « Données personnelles ». Nous répondons sous 30 jours.
            </p>
            <p>
              En cas de réclamation non résolue, vous pouvez saisir l&apos;
              <strong>Autorité de Protection des Données Personnelles (APDP)</strong> du Bénin.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">8. Sécurité des données</h2>
            <p>
              GreenFlame met en œuvre les mesures techniques et organisationnelles suivantes pour
              protéger vos données :
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Chiffrement de toutes les communications (HTTPS/TLS).</li>
              <li>Contrôle d&apos;accès par rôle (Row Level Security) sur la base de données.</li>
              <li>Cloisonnement strict des données entre marchands.</li>
              <li>Journalisation des opérations sensibles (gouvernance, retraits, modifications de compte).</li>
              <li>Accès aux données de production limité au personnel habilité.</li>
            </ul>
            <p>
              En cas de violation de données susceptible de porter atteinte à vos droits, GreenFlame
              s&apos;engage à vous en informer dans les meilleurs délais et à notifier l&apos;APDP
              conformément aux obligations légales.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">9. Cookies et traceurs</h2>
            <p>
              GreenFlame utilise uniquement des cookies de session strictement nécessaires
              au fonctionnement de l&apos;authentification. Aucun cookie publicitaire, de profilage
              ou traceur tiers n&apos;est utilisé. La suppression des cookies de session entraîne
              votre déconnexion.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">10. Modifications de cette politique</h2>
            <p>
              Toute modification substantielle de cette politique sera notifiée par SMS ou par
              notification in-app au moins 15 jours avant son entrée en vigueur. La version en
              vigueur est toujours disponible à l&apos;adresse{' '}
              <span className="text-brand-600 font-medium">greenflameafrica.com/privacy</span>.
            </p>
          </section>
        </div>

        <div className="mt-6 flex justify-between items-center">
          <Link href="/" className="text-sm text-brand-600 hover:underline">
            ← Retour à l&apos;accueil
          </Link>
          <Link href="/terms" className="text-sm text-brand-600 hover:underline">
            Conditions d&apos;utilisation →
          </Link>
        </div>
      </div>
    </div>
  )
}
