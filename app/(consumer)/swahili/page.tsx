import { Suspense } from 'react'
import SwahiliClient from './SwahiliClient'

export const metadata = {
  title: 'Swahili — GreenFlame',
  description: 'Apprends le Swahili — la langue panafricaine. Par et pour l\'Afrique.',
}

export default function SwahiliPage() {
  return (
    <main className="min-h-screen bg-white">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-64">
          <div className="text-4xl animate-pulse">🌍</div>
        </div>
      }>
        <SwahiliClient />
      </Suspense>
    </main>
  )
}
