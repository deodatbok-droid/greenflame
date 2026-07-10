'use client'

import toast from 'react-hot-toast'

export default function ShareButtons({ referralUrl }: { referralUrl: string }) {
  function copyLink() {
    navigator.clipboard.writeText(referralUrl).then(() => toast.success('Link copied!'))
  }

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={copyLink}
        className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        Copy link
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`Join GreenFlame and earn cashback on every purchase! ${referralUrl}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 bg-green-500 text-white rounded-xl py-2.5 text-sm font-medium text-center hover:bg-green-600 transition-colors"
      >
        WhatsApp
      </a>
    </div>
  )
}
