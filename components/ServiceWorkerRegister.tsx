'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Vérifier les mises à jour du SW toutes les heures
        setInterval(() => reg.update(), 60 * 60 * 1000)
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SW] Registration failed:', err)
        }
      })
  }, [])

  return null
}
