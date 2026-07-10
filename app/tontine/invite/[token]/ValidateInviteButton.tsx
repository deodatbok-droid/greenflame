'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  token: string
  labels: {
    validateCta: string
    validating: string
    validateSuccess: string
    validateError: string
  }
}

export default function ValidateInviteButton({ token, labels }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleValidate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tontines/invite/${token}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? labels.validateError)
        return
      }
      setDone(true)
      setTimeout(() => router.push('/tontine'), 1200)
    } catch {
      setError(labels.validateError)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="card text-center">
        <p className="text-sm font-medium text-brand-700">✅ {labels.validateSuccess}</p>
      </div>
    )
  }

  return (
    <div className="card text-center space-y-3">
      <button onClick={handleValidate} disabled={loading} className="btn-primary w-full">
        {loading ? labels.validating : labels.validateCta}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
