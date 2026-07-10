'use client'

import toast from 'react-hot-toast'
import { useTrack } from '@/lib/hooks/useTrack'

export default function CopyReferralButton({ referralUrl, code }: { referralUrl: string; code: string }) {
  const track = useTrack()

  function copy() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      toast.success('Lien copié !')
      track('referral_link_copied', { method: 'clipboard' })
    })
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={copy}
        className="text-brand-600 text-xs font-semibold border border-brand-300 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
      >
        Copier le lien
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`Rejoins GreenFlame avec mon code ${code} et gagne du cashback à chaque achat ! ${referralUrl}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('referral_link_shared', { method: 'whatsapp' })}
        className="bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors"
      >
        WhatsApp
      </a>
    </div>
  )
}
