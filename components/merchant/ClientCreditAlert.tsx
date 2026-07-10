'use client'

import { formatFcfa } from '@/lib/utils/format'

interface Client {
  userId: string
  fullName: string
  balance: number
}

interface Props {
  clients: Client[]
}

// ALERTE JOUR-30 : Affiche proactivement le credit disponible des clients presents
// C'est l'evenement d'activation virale le plus important de GreenFlame
export default function ClientCreditAlert({ clients }: Props) {
  if (clients.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-brand-500 to-brand-700 rounded-2xl p-4 shadow-lg border-2 border-brand-400">
      <div className="flex items-start gap-3">
        <div className="text-2xl">💡</div>
        <div className="flex-1">
          <p className="font-bold text-white text-sm">
            {clients.length === 1
              ? `${clients[0].fullName} a du credit disponible !`
              : `${clients.length} clients ont du credit disponible !`}
          </p>
          <p className="text-brand-100 text-xs mt-0.5">
            Proposez-leur une reduction pour fideliser
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {clients.slice(0, 3).map(client => {
          const discountExample = Math.max(client.balance, 0)

          return (
            <div key={client.userId} className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">{client.fullName}</p>
                  <p className="text-brand-100 text-xs">
                    Solde disponible : <strong>{formatFcfa(discountExample)} FCFA</strong>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white text-xs font-medium">Proposez</p>
                  <p className="text-brand-200 text-xs">
                    Ex : -50 FCFA sur sa prochaine commande
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {clients.length > 3 && (
        <p className="text-brand-200 text-xs mt-2 text-center">
          + {clients.length - 3} autre(s) client(s) avec du credit
        </p>
      )}
    </div>
  )
}
