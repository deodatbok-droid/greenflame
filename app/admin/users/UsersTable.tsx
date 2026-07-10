'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'

interface UserRow {
  id: string
  full_name: string
  phone: string
  role: string[]
  referral_code: string
  created_at: string
  balance_fcfa: number | null
  total_earned_fcfa: number | null
}

export default function UsersTable({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.phone?.includes(search) ||
        u.referral_code?.toLowerCase().includes(search.toLowerCase())
      )
    : users

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher par nom, téléphone ou code..."
        className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-500 focus:outline-none text-sm"
        autoFocus
      />
      <p className="text-gray-500 text-xs">
        {filtered.length} resultat(s) sur {users.length} membre(s)
      </p>

      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                {['Nom', 'Téléphone', 'Roles', 'Code referent', 'Solde', 'Total gagne', 'Inscrit le'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucun resultat</td></tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-700/20">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="text-brand-400 hover:text-brand-300 font-medium hover:underline">
                        {u.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{u.phone}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.role ?? []).map((r: string) => (
                          <span key={r} className={`badge text-xs ${
                            r === 'admin' ? 'bg-red-900/30 text-red-300' :
                            r === 'platform_upline' ? 'bg-purple-900/30 text-purple-300' :
                            r === 'kingmaker' ? 'bg-yellow-900/30 text-yellow-300' :
                            r === 'merchant' ? 'bg-blue-900/30 text-blue-300' :
                            'bg-gray-700 text-gray-300'
                          }`}>{r}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{u.referral_code}</td>
                    <td className="px-4 py-3 text-white">{u.balance_fcfa !== null ? formatFcfa(u.balance_fcfa) : '—'}</td>
                    <td className="px-4 py-3 text-brand-400">{u.total_earned_fcfa !== null ? formatFcfa(u.total_earned_fcfa) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
