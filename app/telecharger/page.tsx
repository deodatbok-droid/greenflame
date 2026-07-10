import Link from 'next/link'
import Logo from '@/components/Logo'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Télécharger GreenFlame — App Android',
  description: 'Installe l\'application GreenFlame sur ton téléphone Android en quelques secondes.',
}

const STEPS = [
  {
    n: '1',
    icon: '⬇️',
    title: 'Télécharge le fichier',
    desc: 'Appuie sur le bouton vert ci-dessous. Le fichier GreenFlame.apk se télécharge sur ton téléphone.',
  },
  {
    n: '2',
    icon: '🔔',
    title: 'Ouvre le fichier téléchargé',
    desc: 'Une notification apparaît en haut de ton écran. Appuie dessus, ou ouvre ton gestionnaire de fichiers et cherche GreenFlame.apk dans le dossier Téléchargements.',
  },
  {
    n: '3',
    icon: '⚙️',
    title: 'Autorise les sources inconnues',
    desc: 'Android affiche un message de sécurité. Appuie sur "Paramètres" → active "Autoriser les applications de cette source". Reviens en arrière et relance l\'installation.',
    note: 'Cette étape est normale pour toute app qui n\'est pas sur le Play Store. Tu peux désactiver l\'option après l\'installation.',
  },
  {
    n: '4',
    icon: '✅',
    title: 'Installe et lance',
    desc: 'Appuie sur "Installer". En quelques secondes, l\'icône GreenFlame apparaît sur ton écran d\'accueil. C\'est prêt !',
  },
]

export default function TelechargerPage() {
  const apkUrl = '/GreenFlame.apk'
  const whatsappText = encodeURIComponent(
    '🔥 Télécharge l\'app GreenFlame ici : https://greenflameafrica.com/telecharger\nAchète local, gagne du cashback à chaque achat 🔥'
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 pt-12 pb-8 text-center">
        <div className="flex justify-center mb-4">
          <Logo size={64} className="w-16 h-16" />
        </div>
        <h1 className="text-white text-2xl font-bold">GreenFlame</h1>
        <p className="text-brand-100 text-sm mt-1">Commerce communautaire pan-africain</p>
      </div>

      <div className="max-w-md mx-auto px-5 py-8 space-y-8">

        {/* CTA principal */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-4xl mb-3">🤖</p>
          <h2 className="text-xl font-bold text-gray-900 mb-1">App Android</h2>
          <p className="text-sm text-gray-500 mb-5">
            Version 1.0 · 1,7 Mo · Compatible Android 7+
          </p>
          <a
            href={apkUrl}
            download="GreenFlame.apk"
            className="block w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-lg py-4 rounded-2xl transition-colors"
          >
            ⬇️ Télécharger GreenFlame.apk
          </a>
          <p className="text-xs text-gray-400 mt-3">
            Gratuit · Sans abonnement requis
          </p>
        </div>

        {/* Guide étape par étape */}
        <div>
          <h3 className="font-bold text-gray-800 text-base mb-4">
            📋 Guide d&apos;installation (2 minutes)
          </h3>
          <div className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.n} className="flex gap-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex-shrink-0 w-9 h-9 bg-brand-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {step.n}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    {step.icon} {step.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{step.desc}</p>
                  {step.note && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mt-2">
                      ℹ️ {step.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* iOS */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
          <p className="font-semibold text-gray-800 text-sm mb-2">🍎 Tu as un iPhone ?</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Ouvre <strong>greenflameafrica.com</strong> dans Safari, puis appuie sur
            le bouton Partager (carré avec une flèche) →{' '}
            <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
            L&apos;app s&apos;installe sans passer par l&apos;App Store.
          </p>
        </div>

        {/* Partage WhatsApp */}
        <div className="bg-green-50 rounded-2xl border border-green-200 p-5 text-center">
          <p className="font-semibold text-gray-800 text-sm mb-3">
            Partage l&apos;app avec tes proches
          </p>
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Envoyer via WhatsApp
          </a>
        </div>

        {/* Lien retour */}
        <div className="text-center pb-4">
          <Link href="/marketplace" className="text-sm text-brand-600 font-medium hover:underline">
            ← Aller à la Marketplace
          </Link>
        </div>
      </div>
    </div>
  )
}
