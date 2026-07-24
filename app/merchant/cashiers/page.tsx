'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'

interface Cashier {
  id: string
  label: string
  is_active: boolean
  created_at: string
  users: { full_name: string; phone: string } | null
}

export default function CashiersPage() {
  const { t } = useLocale()
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [loading, setLoading]   = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [phone, setPhone]       = useState('')
  const [label, setLabel]       = useState('')
  const [adding, setAdding]     = useState(false)

  useEffect(() => {
    fetch('/api/merchant/cashiers')
      .then(r => {
        if (r.status === 403) { setForbidden(true); return [] }
        return r.json()
      })
      .then(data => { setCashiers(data); setLoading(false) })
  }, [])

  async function addCashier() {
    if (!phone.trim()) return toast.error(t('merchant.cashiers.phoneRequired'))
    setAdding(true)
    const res = await fetch('/api/merchant/cashiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, label }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(t('merchant.cashiers.added').replace('{name}', data.userName))
      setCashiers(prev => [...prev, data.cashier])
      setPhone(''); setLabel('')
    } else {
      toast.error(data.error ?? t('merchant.cashiers.removeError'))
    }
    setAdding(false)
  }

  async function removeCashier(id: string, name: string) {
    if (!confirm(t('merchant.cashiers.removeConfirm').replace('{name}', name))) return
    const res = await fetch('/api/merchant/cashiers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashierId: id }),
    })
    if (res.ok) {
      setCashiers(prev => prev.filter(c => c.id !== id))
      toast.success(t('merchant.cashiers.removed'))
    } else {
      toast.error(t('merchant.cashiers.removeError'))
    }
  }

  if (loading) return <div className="text-center py-16 text-gray-500">{t('merchant.cashiers.loading')}</div>

  if (forbidden) return (
    <div className="max-w-lg mx-auto p-6 text-center">
      <p className="text-4xl mb-4">👑</p>
      <h1 className="text-xl font-bold text-gray-900 mb-2">{t('merchant.cashiers.vipTitle')}</h1>
      <p className="text-gray-500 text-sm mb-6">{t('merchant.cashiers.vipDesc')}</p>
      <Link href="/merchant/upgrade" className="bg-amber-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-amber-600 transition-colors">
        {t('merchant.cashiers.upgradeVip')}
      </Link>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('merchant.cashiers.title')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('merchant.cashiers.count').replace('{n}', String(cashiers.length))}
          </p>
        </div>
        <Link href="/merchant/tools" className="text-brand-600 text-sm">{t('merchant.cashiers.backToTools')}</Link>
      </div>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        {t('merchant.cashiers.info')}
      </div>

      {/* Formulaire ajout */}
      <div className="card space-y-3">
        <p className="font-semibold text-gray-900 text-sm">{t('merchant.cashiers.addTitle')}</p>
        <PhoneInput value={phone} onChange={setPhone} placeholder="97 00 00 00" />
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder={t('merchant.cashiers.labelPlaceholder')}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
        />
        <button
          onClick={addCashier}
          disabled={adding || cashiers.length >= 5}
          className="w-full bg-brand-600 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-40"
        >
          {adding ? t('merchant.cashiers.adding') : t('merchant.cashiers.addBtn')}
        </button>
      </div>

      {/* Liste */}
      {cashiers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-3xl mb-2">👤</p>
          <p className="text-sm">{t('merchant.cashiers.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cashiers.map(c => (
            <div key={c.id} className="card flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <span className="text-brand-700 font-bold text-sm">
                  {c.users?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{c.users?.full_name}</p>
                <p className="text-xs text-gray-500">{c.label} · {c.users?.phone}</p>
              </div>
              <button
                onClick={() => removeCashier(c.id, c.users?.full_name ?? '')}
                className="flex-shrink-0 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                {t('merchant.cashiers.remove')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
