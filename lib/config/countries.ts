/**
 * GreenFlame — Configuration pays
 *
 * Chaque entrée définit :
 *  - monnaie, préfixe téléphonique, langue
 *  - opérateurs Mobile Money disponibles + code USSD marchand
 *
 * Pour ouvrir un nouveau pays : ajouter une entrée ici, définir
 * NEXT_PUBLIC_COUNTRY dans les env vars Vercel du sous-domaine.
 * Le reste du code s'adapte automatiquement.
 */

export type CountryCode = 'BJ' | 'TG' | 'CI' | 'SN' | 'GH'
export type OperatorKey = 'mtn_momo' | 'moov_money' | 'celtiis' | 'orange' | 'wave' | 'vodafone' | 'airteltigo' | 'tmoney'

export interface OperatorConfig {
  label: string         // Nom affiché à l'utilisateur
  icon: string          // Emoji
  ussdBase: string      // Base du code USSD ex: "*880*41*739394" (sans *montant#)
                        // Laisser '' si non encore configuré
}

export interface CountryConfig {
  name: string
  flag: string
  currency: string      // Code ISO ex: "FCFA", "GHS"
  phonePrefix: string   // ex: "+229"
  phoneDigits: number   // Longueur attendue après le préfixe
  locale: string        // ex: "fr-BJ"
  lang: 'fr' | 'en'
  operators: Partial<Record<OperatorKey, OperatorConfig>>
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  BJ: {
    name: 'Bénin',
    flag: '🇧🇯',
    currency: 'FCFA',
    phonePrefix: '+229',
    phoneDigits: 10,
    locale: 'fr-BJ',
    lang: 'fr',
    operators: {
      mtn_momo: {
        label: 'MTN Mobile Money',
        icon: '📱',
        ussdBase: '*880*41*739394',   // ✅ Code marchand GreenFlame MTN Bénin
      },
      moov_money: {
        label: 'Moov Money (Flooz)',
        icon: '💚',
        ussdBase: '',                  // 🔜 À renseigner
      },
      celtiis: {
        label: 'Celtiis',
        icon: '🔵',
        ussdBase: '',                  // 🔜 À renseigner
      },
    },
  },

  TG: {
    name: 'Togo',
    flag: '🇹🇬',
    currency: 'FCFA',
    phonePrefix: '+228',
    phoneDigits: 8,
    locale: 'fr-TG',
    lang: 'fr',
    operators: {
      moov_money: {
        label: 'Flooz (Moov)',
        icon: '💚',
        ussdBase: '',   // 🔜 À renseigner
      },
      tmoney: {
        label: 'T-Money (Togocel)',
        icon: '🟡',
        ussdBase: '',   // 🔜 À renseigner
      },
    },
  },

  CI: {
    name: "Côte d'Ivoire",
    flag: '🇨🇮',
    currency: 'FCFA',
    phonePrefix: '+225',
    phoneDigits: 10,
    locale: 'fr-CI',
    lang: 'fr',
    operators: {
      mtn_momo: {
        label: 'MTN Mobile Money',
        icon: '📱',
        ussdBase: '',   // 🔜 À renseigner
      },
      orange: {
        label: 'Orange Money',
        icon: '🟠',
        ussdBase: '',   // 🔜 À renseigner
      },
      moov_money: {
        label: 'Moov Money',
        icon: '💚',
        ussdBase: '',   // 🔜 À renseigner
      },
      wave: {
        label: 'Wave',
        icon: '🌊',
        ussdBase: '',   // 🔜 À renseigner
      },
    },
  },

  SN: {
    name: 'Sénégal',
    flag: '🇸🇳',
    currency: 'FCFA',
    phonePrefix: '+221',
    phoneDigits: 9,
    locale: 'fr-SN',
    lang: 'fr',
    operators: {
      orange: {
        label: 'Orange Money',
        icon: '🟠',
        ussdBase: '',   // 🔜 À renseigner
      },
      wave: {
        label: 'Wave',
        icon: '🌊',
        ussdBase: '',   // 🔜 À renseigner
      },
      mtn_momo: {
        label: 'MTN Mobile Money',
        icon: '📱',
        ussdBase: '',   // 🔜 À renseigner
      },
    },
  },

  GH: {
    name: 'Ghana',
    flag: '🇬🇭',
    currency: 'GHS',
    phonePrefix: '+233',
    phoneDigits: 9,
    locale: 'en-GH',
    lang: 'en',
    operators: {
      mtn_momo: {
        label: 'MTN MoMo',
        icon: '📱',
        ussdBase: '',   // 🔜 À renseigner
      },
      vodafone: {
        label: 'Vodafone Cash',
        icon: '🔴',
        ussdBase: '',   // 🔜 À renseigner
      },
      airteltigo: {
        label: 'AirtelTigo Money',
        icon: '🔷',
        ussdBase: '',   // 🔜 À renseigner
      },
    },
  },
}

/** Pays actif — configuré via NEXT_PUBLIC_COUNTRY, défaut Bénin */
export const ACTIVE_COUNTRY: CountryCode =
  (process.env.NEXT_PUBLIC_COUNTRY as CountryCode) ?? 'BJ'

export const COUNTRY = COUNTRIES[ACTIVE_COUNTRY]
