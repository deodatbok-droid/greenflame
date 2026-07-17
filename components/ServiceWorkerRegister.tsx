'use client'

import { useEffect } from 'react'

// Expose l'événement beforeinstallprompt globalement pour que n'importe quel
// composant puisse déclencher l'installation PWA via window.__gf_pwa_install()
declare global {
  interface Window {
    __gf_pwa_prompt?: BeforeInstallPromptEvent | null
    __gf_pwa_install?: () => Promise<boolean>
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // 1. Enregistrement du Service Worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Vérifier les mises à jour toutes les heures
        setInterval(() => reg.update(), 60 * 60 * 1000)
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SW] Registration failed:', err)
        }
      })

    // 2. Capturer l'événement d'installation PWA
    const handler = (e: Event) => {
      e.preventDefault()
      window.__gf_pwa_prompt = e as BeforeInstallPromptEvent

      // Fonction déclenchable par n'importe quel composant
      window.__gf_pwa_install = async () => {
        const prompt = window.__gf_pwa_prompt
        if (!prompt) return false
        await prompt.prompt()
        const { outcome } = await prompt.userChoice
        if (outcome === 'accepted') window.__gf_pwa_prompt = null
        return outcome === 'accepted'
      }
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return null
}
