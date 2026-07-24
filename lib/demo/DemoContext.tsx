'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_EMAIL, DemoStepId } from './data'

interface DemoContextValue {
  isDemo:           boolean
  completedSteps:   Set<DemoStepId>
  markStepComplete: (step: DemoStepId) => void
  resetDemo:        () => Promise<void>
  resetting:        boolean
  seedDemo:         () => Promise<void>
  seeding:          boolean
}

const DemoContext = createContext<DemoContextValue>({
  isDemo:           false,
  completedSteps:   new Set(),
  markStepComplete: () => {},
  resetDemo:        async () => {},
  resetting:        false,
  seedDemo:         async () => {},
  seeding:          false,
})

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo,         setIsDemo]         = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Set<DemoStepId>>(new Set())
  const [resetting,      setResetting]      = useState(false)
  const [seeding,        setSeeding]        = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email === DEMO_EMAIL) {
        setIsDemo(true)
        try {
          const saved = JSON.parse(localStorage.getItem('gf-demo-completed') ?? '[]')
          setCompletedSteps(new Set(saved as DemoStepId[]))
        } catch { /* ignore */ }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const demo = session?.user?.email === DEMO_EMAIL
      setIsDemo(demo)
      if (!demo) {
        setCompletedSteps(new Set())
        try { localStorage.removeItem('gf-demo-completed') } catch { /* ignore */ }
      } else {
        try {
          const saved = JSON.parse(localStorage.getItem('gf-demo-completed') ?? '[]')
          setCompletedSteps(new Set(saved as DemoStepId[]))
        } catch { /* ignore */ }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const markStepComplete = useCallback((step: DemoStepId) => {
    // Side-effect : activer le compte au premier achat
    if (step === 'premier_achat') {
      fetch('/api/demo/premier-achat', { method: 'POST' }).catch(() => {})
    }
    setCompletedSteps(prev => {
      const next = new Set([...prev, step])
      try { localStorage.setItem('gf-demo-completed', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [])

  const seedDemo = useCallback(async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors du chargement des données')
      }
    } finally {
      setSeeding(false)
    }
  }, [])

  const resetDemo = useCallback(async () => {
    setResetting(true)
    try {
      await fetch('/api/demo/reset', { method: 'POST' })
      setCompletedSteps(new Set())
      try { localStorage.removeItem('gf-demo-completed') } catch { /* ignore */ }
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/login?demo=true'
    } finally {
      setResetting(false)
    }
  }, [])

  return (
    <DemoContext.Provider value={{ isDemo, completedSteps, markStepComplete, resetDemo, resetting, seedDemo, seeding }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  return useContext(DemoContext)
}
