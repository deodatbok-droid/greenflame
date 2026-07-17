'use client'

/**
 * components/ui/Toast.tsx
 *
 * Wrapper typé autour de react-hot-toast (déjà installé + Toaster dans root layout).
 * Exporte `useToast()` — hook simple pour déclencher des toasts depuis n'importe quel
 * composant client, sans configurer de contexte supplémentaire.
 *
 * Usage :
 *   const { success, error, info } = useToast()
 *   success('Paiement effectué !')
 *   error('Solde insuffisant')
 */

import toast from 'react-hot-toast'

export function useToast() {
  return {
    success: (message: string) =>
      toast.success(message, {
        style: { borderRadius: '14px', fontWeight: '500', fontSize: '13px' },
        iconTheme: { primary: '#16a34a', secondary: '#fff' },
      }),
    error: (message: string) =>
      toast.error(message, {
        style: { borderRadius: '14px', fontWeight: '500', fontSize: '13px', color: '#dc2626' },
        iconTheme: { primary: '#dc2626', secondary: '#fff' },
      }),
    info: (message: string) =>
      toast(message, {
        icon: 'ℹ️',
        style: { borderRadius: '14px', fontWeight: '500', fontSize: '13px' },
      }),
    warning: (message: string) =>
      toast(message, {
        icon: '⚠️',
        style: { borderRadius: '14px', fontWeight: '500', fontSize: '13px', color: '#d97706' },
      }),
    toast,   // accès direct si besoin d'options custom
  }
}

// Re-export pour usage direct sans hook
export { toast }
