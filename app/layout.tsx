import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/next'
import { headers } from 'next/headers'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import type { Locale } from '@/lib/i18n'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GreenFlame — Commerce communautaire pan-africain',
  description: 'Achetez local, gagnez du cashback et des dividendes communautaires sur chaque achat. Payez, gagnez, partagez.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GreenFlame',
  },
  openGraph: {
    title: 'GreenFlame — Commerce communautaire pan-africain',
    description: 'Achetez local, gagnez du cashback et des dividendes communautaires sur chaque achat.',
    url: 'https://greenflameafrica.com',
    siteName: 'GreenFlame',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'GreenFlame — Commerce communautaire' }],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GreenFlame — Commerce communautaire pan-africain',
    description: 'Achetez local, gagnez du cashback et des dividendes communautaires sur chaque achat.',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const locale = (headersList.get('x-locale') ?? 'fr') as Locale

  return (
    <html lang={locale}>
      <head>
        {/* Enregistrement SW immédiat — visible par les crawlers PWA avant hydratation React */}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'})` }} />
      </head>
      <body className={inter.className}>
        <LocaleProvider locale={locale}>
          <ServiceWorkerRegister />
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: '12px', fontFamily: 'Inter, sans-serif' },
              success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            }}
          />
          <Analytics />
        </LocaleProvider>
      </body>
    </html>
  )
}
