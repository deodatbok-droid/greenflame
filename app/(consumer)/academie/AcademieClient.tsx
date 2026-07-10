'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { VoiceButton } from '@/components/ui/VoiceButton'
import type { VoiceAction } from '@/components/ui/VoiceButton'
import Link from 'next/link'
import BackButton from '@/components/ui/BackButton'
import { useLocale } from '@/components/providers/LocaleProvider'
import { CONTENT } from '@/lib/i18n/academie-content'
import type { ContentBlock, QuizQuestion } from '@/lib/i18n/academie-content'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoreData = {
  score: number
  niveau: string
  bnpl_eligible: boolean
  bnpl_plafond_fcfa: number
  score_details?: Record<string, number>
}

type ProgressData = {
  f1_simulator?: boolean; f1_quiz_score?: number | null; f1_cert_at?: string | null
  f2_simulator?: boolean; f2_quiz_score?: number | null; f2_cert_at?: string | null
  f3_simulator?: boolean; f3_quiz_score?: number | null; f3_cert_at?: string | null
}

type BudgetProfile = {
  revenus_mensuels_fcfa?: number
  enveloppe_besoins_pct?: number
  enveloppe_epargne_pct?: number
  enveloppe_libre_pct?: number
  objectif_epargne_fcfa?: number
  objectif_epargne_label?: string
  coussin_actuel_fcfa?: number
  service_type?: string
  tarif_moyen_fcfa?: number
  prestations_par_semaine?: number
}

type Props = {
  userId: string
  initialScore: ScoreData | null
  initialProgress: ProgressData | null
  initialBudgetProfile: BudgetProfile | null
}

type BudgetEntry = {
  id: string
  montant_fcfa: number
  type: string
  categorie: string
  description: string | null
  source: string
  date_entree: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_ICONS: Record<string, string> = {
  alimentation: '🍽️', transport: '🚌', loyer: '🏠', sante: '🏥',
  scolarite: '📚', tontine: '🤝', communication: '📱', loisirs: '🎉',
  imprevus: '⚡', dettes: '💳', epargne: '🏦', autre: '💰',
}

const NIVEAU_STYLES: Record<string, { color: string; bg: string }> = {
  debutant: { color: 'text-gray-600', bg: 'bg-gray-100' },
  actif:    { color: 'text-blue-600',  bg: 'bg-blue-50' },
  fiable:   { color: 'text-green-600', bg: 'bg-green-50' },
  avance:   { color: 'text-orange-600',bg: 'bg-orange-50' },
  expert:   { color: 'text-purple-600',bg: 'bg-purple-50' },
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('fr-FR') + ' FCFA'
}

// ─── Accordion & Tip ─────────────────────────────────────────────────────────

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white text-left text-sm font-semibold text-gray-800"
      >
        {title}
        <span className={`text-green-500 text-lg transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <div className="px-4 pb-4 bg-white text-sm text-gray-700 space-y-2">{children}</div>}
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-orange-400 bg-orange-50 rounded-r-lg px-3 py-2 text-xs text-orange-800">
      {children}
    </div>
  )
}

// ─── Content renderers ────────────────────────────────────────────────────────

function renderText(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      )}
    </>
  )
}

function renderBlocks(blocks: ContentBlock[]) {
  return blocks.map((b, i) => {
    switch (b.type) {
      case 'p':
        return <p key={i} className="text-sm">{renderText(b.text)}</p>
      case 'h3':
        return <p key={i} className="text-sm font-semibold mt-2">{b.text}</p>
      case 'tip':
        return <Tip key={i}>{b.text}</Tip>
      case 'ul':
        return (
          <ul key={i} className="list-disc pl-4 space-y-1 text-sm">
            {b.items.map((item, j) => (
              <li key={j}>
                {renderText(item.text)}
                {item.sub && (
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {item.sub.map((s, k) => <li key={k}>{renderText(s)}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )
      case 'ol':
        return (
          <ol key={i} className="list-decimal pl-4 space-y-1 text-sm">
            {b.items.map((item, j) => (
              <li key={j}>
                {renderText(item.text)}
                {item.sub && (
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {item.sub.map((s, k) => <li key={k}>{renderText(s)}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )
    }
  })
}

// ─── Score Badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score, niveau }: { score: number; niveau: string }) {
  const { t } = useLocale()
  const styles = NIVEAU_STYLES[niveau] ?? NIVEAU_STYLES.debutant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const label = t(`academie.score.niveaux.${niveau}` as any) || niveau
  const pct = Math.round((score / 1000) * 100)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
            {t('academie.score.label')}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-4xl font-black text-gray-900">{score}</span>
            <span className="text-gray-400 text-sm font-medium">/ 1000</span>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${styles.bg} ${styles.color}`}>
          {label}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
        <span>{t('academie.score.niveaux.debutant')}</span>
        <span>{t('academie.score.niveaux.actif')}</span>
        <span>{t('academie.score.niveaux.fiable')}</span>
        <span>{t('academie.score.niveaux.avance')}</span>
        <span>{t('academie.score.niveaux.expert')}</span>
      </div>
    </div>
  )
}

// ─── Quiz Component ───────────────────────────────────────────────────────────

function QuizBlock({
  questions,
  done,
  onComplete,
}: {
  questions: QuizQuestion[]
  done: boolean
  onComplete: (score: number) => void
}) {
  const { t } = useLocale()
  const [answers, setAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null))
  const [submitted, setSubmitted] = useState(done)
  const [score, setScore] = useState<number | null>(null)

  function submit() {
    if (answers.some((a) => a === null)) {
      toast.error(t('academie.quiz.answerAll'))
      return
    }
    const s = answers.reduce<number>(
      (acc, a, i) => acc + (a !== null && a === questions[i].correct ? 1 : 0),
      0
    )
    setScore(s)
    setSubmitted(true)
    onComplete(s)
  }

  if (done && score === null) {
    return (
      <div className="text-center py-4 text-green-600 font-semibold text-sm">
        {t('academie.quiz.alreadyDone')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => (
        <div key={qi} className="space-y-2">
          <p className="text-sm font-semibold text-gray-800">{qi + 1}. {q.q}</p>
          {q.opts.map((opt, oi) => {
            let cls = 'border border-gray-200 bg-white'
            if (submitted) {
              if (oi === q.correct) cls = 'border-green-400 bg-green-50'
              else if (answers[qi] === oi) cls = 'border-red-300 bg-red-50'
            } else if (answers[qi] === oi) {
              cls = 'border-green-400 bg-green-50'
            }
            return (
              <button
                key={oi}
                disabled={submitted}
                onClick={() => setAnswers((prev) => { const n = [...prev]; n[qi] = oi; return n })}
                className={`w-full text-left text-sm px-3 py-2.5 rounded-xl transition-colors ${cls}`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      ))}
      {!submitted ? (
        <button onClick={submit} className="btn-primary w-full">
          {t('academie.quiz.submit')}
        </button>
      ) : (
        <div className={`text-center py-3 rounded-xl font-semibold text-sm ${(score ?? 0) >= 3 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
          {(score ?? 0) >= 3
            ? t('academie.quiz.pass').replace('{score}', String(score ?? 0))
            : t('academie.quiz.fail').replace('{score}', String(score ?? 0))}
        </div>
      )}
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export default function AcademieClient({ initialScore, initialProgress, initialBudgetProfile, userId: _userId }: Props & { userId: string }) {
  const router = useRouter()
  const { locale, t } = useLocale()
  const modules = CONTENT[locale === 'en' ? 'en' : 'fr']

  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0)
  const [score, setScore] = useState<ScoreData | null>(initialScore)
  const [progress, setProgress] = useState<ProgressData>(initialProgress ?? {})
  const [budgetProfile, setBudgetProfile] = useState<BudgetProfile>(initialBudgetProfile ?? {})
  const [entries, setEntries] = useState<BudgetEntry[]>([])

  // Simulateur F1
  const [f1, setF1] = useState({ rev: '', loyer: '', nourriture: '', transport: '', autres: '' })
  const [f1Result, setF1Result] = useState<null | { dep: number; reste: number; epargne: number }>(null)

  // Simulateur F2
  const [f2, setF2] = useState({ serviceType: '', tarif: '', prestSem: '' })
  const [f2Result, setF2Result] = useState<null | { mensuel: number; annuel: number; parJour: number }>(null)

  // Simulateur F3
  const [f3, setF3] = useState({ rev: '', objectif: '', mensuel: '' })
  const [f3Result, setF3Result] = useState<null | { pct: number; mois: number }>(null)

  // Budget profile form
  const [bp, setBp] = useState({
    revenus: String(budgetProfile.revenus_mensuels_fcfa ?? ''),
    besoins: String(budgetProfile.enveloppe_besoins_pct ?? 65),
    epargne: String(budgetProfile.enveloppe_epargne_pct ?? 15),
    libre: String(budgetProfile.enveloppe_libre_pct ?? 20),
    objectifMontant: String(budgetProfile.objectif_epargne_fcfa ?? ''),
    objectifLabel: budgetProfile.objectif_epargne_label ?? '',
    coussin: String(budgetProfile.coussin_actuel_fcfa ?? ''),
  })
  const [savingBp, setSavingBp] = useState(false)

  const reloadScore = useCallback(async () => {
    const res = await fetch('/api/scoring', { method: 'POST' })
    if (res.ok) setScore(await res.json())
  }, [])

  const loadEntries = useCallback(async () => {
    const res = await fetch('/api/budget-entries?limit=5')
    if (res.ok) setEntries(await res.json())
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  const handleVoiceAction = useCallback(async (action: VoiceAction) => {
    if (action.action === 'budget_entry') {
      const d = action.data as { montant_fcfa?: number; type?: string; categorie?: string; description?: string }
      if (!d.montant_fcfa) return
      const res = await fetch('/api/budget-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, source: 'voice' }),
      })
      if (res.ok) {
        toast.success(t('academie.expenses.recorded'))
        loadEntries()
        reloadScore()
      }
    } else if (action.action === 'navigate') {
      const d = action.data as { href?: string }
      if (d.href) router.push(d.href)
    }
  }, [loadEntries, reloadScore, router, t])

  async function saveProgress(module: 'f1' | 'f2' | 'f3', payload: { simulator?: boolean; quiz_score?: number }) {
    const res = await fetch('/api/academie/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module, ...payload }),
    })
    if (res.ok) {
      const data = await res.json()
      setProgress(data)
      await reloadScore()
    }
  }

  function calcF1() {
    const rev = parseFloat(f1.rev) || 0
    if (!rev) { toast.error(t('academie.simulator.f1.errorRev')); return }
    const dep = (parseFloat(f1.loyer) || 0) + (parseFloat(f1.nourriture) || 0) + (parseFloat(f1.transport) || 0) + (parseFloat(f1.autres) || 0)
    setF1Result({ dep, reste: rev - dep, epargne: rev * 0.1 })
    if (!progress.f1_simulator) saveProgress('f1', { simulator: true })
  }

  function calcF2() {
    const tarif = parseFloat(f2.tarif) || 0
    const prest = parseFloat(f2.prestSem) || 0
    if (!tarif || !prest) { toast.error(t('academie.simulator.f2.errorFields')); return }
    const mensuel = tarif * prest * 4
    setF2Result({ mensuel, annuel: mensuel * 12, parJour: (tarif * prest) / 6 })
    if (!progress.f2_simulator) saveProgress('f2', { simulator: true })
    if (f2.serviceType) {
      fetch('/api/academie/budget-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_type: f2.serviceType, tarif_moyen_fcfa: tarif, prestations_par_semaine: prest }),
      })
    }
  }

  function calcF3() {
    const rev = parseFloat(f3.rev) || 0
    const obj = parseFloat(f3.objectif) || 0
    const mens = parseFloat(f3.mensuel) || 0
    if (!rev || !obj || !mens) { toast.error(t('academie.simulator.f3.errorFields')); return }
    setF3Result({ pct: (mens / rev) * 100, mois: Math.ceil(obj / mens) })
    if (!progress.f3_simulator) saveProgress('f3', { simulator: true })
  }

  async function saveBudgetProfile() {
    setSavingBp(true)
    const res = await fetch('/api/academie/budget-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        revenus_mensuels_fcfa: parseInt(bp.revenus) || 0,
        enveloppe_besoins_pct: parseInt(bp.besoins) || 65,
        enveloppe_epargne_pct: parseInt(bp.epargne) || 15,
        enveloppe_libre_pct: parseInt(bp.libre) || 20,
        objectif_epargne_fcfa: parseInt(bp.objectifMontant) || 0,
        objectif_epargne_label: bp.objectifLabel || null,
        coussin_actuel_fcfa: parseInt(bp.coussin) || 0,
      }),
    })
    if (res.ok) {
      setBudgetProfile(await res.json())
      await reloadScore()
      toast.success(t('academie.budgetProfile.saved'))
    }
    setSavingBp(false)
  }

  const TABS = [
    { label: t('academie.tabs.budget') },
    { label: t('academie.tabs.revenus') },
    { label: t('academie.tabs.epargne') },
  ]

  // Simulator field configs — defined here to use t()
  const f1Fields = [
    { label: t('academie.simulator.f1.fields.rev'),        key: 'rev',        placeholder: t('academie.simulator.f1.placeholders.rev') },
    { label: t('academie.simulator.f1.fields.loyer'),      key: 'loyer',      placeholder: t('academie.simulator.f1.placeholders.loyer') },
    { label: t('academie.simulator.f1.fields.nourriture'), key: 'nourriture', placeholder: t('academie.simulator.f1.placeholders.nourriture') },
    { label: t('academie.simulator.f1.fields.transport'),  key: 'transport',  placeholder: t('academie.simulator.f1.placeholders.transport') },
    { label: t('academie.simulator.f1.fields.autres'),     key: 'autres',     placeholder: t('academie.simulator.f1.placeholders.autres') },
  ]

  const f3Fields = [
    { label: t('academie.simulator.f3.fields.rev'),      key: 'rev',      placeholder: t('academie.simulator.f3.placeholders.rev') },
    { label: t('academie.simulator.f3.fields.objectif'), key: 'objectif', placeholder: t('academie.simulator.f3.placeholders.objectif') },
    { label: t('academie.simulator.f3.fields.mensuel'),  key: 'mensuel',  placeholder: t('academie.simulator.f3.placeholders.mensuel') },
  ]

  return (
    <div className="max-w-lg mx-auto px-3 py-4 space-y-4 pb-28">
      {/* Back */}
      <BackButton href="/dashboard" />

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-black text-gray-900">{t('academie.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('academie.subtitle')}</p>
      </div>

      {/* Score Badge */}
      {score && <ScoreBadge score={score.score} niveau={score.niveau} />}
      {!score && (
        <div className="bg-gray-50 rounded-2xl p-4 text-center text-sm text-gray-500">
          {t('academie.noScore')}
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i as 0 | 1 | 2)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === i ? 'bg-white shadow text-green-700' : 'text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──── MODULE 1 : BUDGET ──────────────────────────────────────────────── */}
      {activeTab === 0 && (
        <div className="space-y-3">
          {modules.f1.sections.map((section, i) => (
            <Accordion key={i} title={section.title}>
              {renderBlocks(section.blocks)}
            </Accordion>
          ))}

          {/* Suivi des dépenses par voix */}
          <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{t('academie.expenses.title')}</h3>
              <span className="text-xs text-gray-400">
                {new Date().toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long' })}
              </span>
            </div>
            <VoiceButton
              context={{ page: 'budget' }}
              onAction={handleVoiceAction}
              label={t('academie.expenses.voiceLabel')}
              className="w-full"
            />
            {entries.length > 0 ? (
              <div className="space-y-2 pt-3 border-t border-gray-50">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm flex-shrink-0">{CAT_ICONS[e.categorie] ?? '💰'}</span>
                      <span className="text-sm text-gray-700 truncate">
                        {e.description || e.categorie}
                      </span>
                      {e.source === 'voice' && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0">🎤</span>
                      )}
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ml-2 ${e.type === 'rentree' ? 'text-green-600' : 'text-red-500'}`}>
                      {e.type === 'rentree' ? '+' : '−'}{e.montant_fcfa.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center border-t border-gray-50 pt-3">
                {t('academie.expenses.empty')}
              </p>
            )}
          </div>

          {/* Simulateur F1 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-900">{t('academie.simulator.f1.title')}</h3>
            {f1Fields.map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                <input
                  type="number"
                  className="input text-sm"
                  placeholder={placeholder}
                  value={(f1 as Record<string, string>)[key]}
                  onChange={(e) => setF1((p) => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <button onClick={calcF1} className="btn-primary w-full">
              {t('academie.simulator.f1.cta')}
            </button>
            {f1Result && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('academie.simulator.f1.result.dep')}</span>
                  <span className="font-bold">{fmt(f1Result.dep)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('academie.simulator.f1.result.reste')}</span>
                  <span className={`font-bold ${f1Result.reste > f1Result.epargne ? 'text-green-600' : f1Result.reste > 0 ? 'text-orange-500' : 'text-red-600'}`}>
                    {fmt(f1Result.reste)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('academie.simulator.f1.result.epargne')}</span>
                  <span className="font-bold text-green-600">{fmt(f1Result.epargne)}</span>
                </div>
                <div className={`rounded-xl p-3 text-xs font-medium ${f1Result.reste < 0 ? 'bg-red-50 text-red-700' : f1Result.reste < f1Result.epargne ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                  {f1Result.reste < 0
                    ? t('academie.simulator.f1.result.deficit')
                    : f1Result.reste < f1Result.epargne
                    ? t('academie.simulator.f1.result.tight')
                    : t('academie.simulator.f1.result.good').replace('{amount}', fmt(f1Result.epargne))}
                </div>
              </div>
            )}
          </div>

          {/* Mon profil budget */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-900">{t('academie.budgetProfile.title')}</h3>
            <p className="text-xs text-gray-500">{t('academie.budgetProfile.subtitle')}</p>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                {t('academie.budgetProfile.revenus')}
              </label>
              <input
                type="number"
                className="input text-sm"
                value={bp.revenus}
                onChange={(e) => setBp(p => ({ ...p, revenus: e.target.value }))}
                placeholder={t('academie.budgetProfile.revenusPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['besoins', t('academie.budgetProfile.besoins')],
                ['epargne', t('academie.budgetProfile.epargne')],
                ['libre',   t('academie.budgetProfile.libre')],
              ] as [string, string][]).map(([key, lbl]) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">{lbl}</label>
                  <input
                    type="number"
                    className="input text-sm"
                    value={(bp as Record<string, string>)[key]}
                    onChange={(e) => setBp(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                {t('academie.budgetProfile.objectifMontant')}
              </label>
              <input
                type="number"
                className="input text-sm"
                value={bp.objectifMontant}
                onChange={(e) => setBp(p => ({ ...p, objectifMontant: e.target.value }))}
                placeholder={t('academie.budgetProfile.objectifMontantPlaceholder')}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                {t('academie.budgetProfile.objectifLabel')}
              </label>
              <input
                type="text"
                className="input text-sm"
                value={bp.objectifLabel}
                onChange={(e) => setBp(p => ({ ...p, objectifLabel: e.target.value }))}
                placeholder={t('academie.budgetProfile.objectifLabelPlaceholder')}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                {t('academie.budgetProfile.coussin')}
              </label>
              <input
                type="number"
                className="input text-sm"
                value={bp.coussin}
                onChange={(e) => setBp(p => ({ ...p, coussin: e.target.value }))}
                placeholder={t('academie.budgetProfile.coussinPlaceholder')}
              />
            </div>
            <button onClick={saveBudgetProfile} disabled={savingBp} className="btn-primary w-full disabled:opacity-50">
              {savingBp ? t('academie.budgetProfile.saving') : t('academie.budgetProfile.save')}
            </button>
          </div>

          {/* Quiz F1 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-900">{t('academie.quiz.title')}</h3>
            <p className="text-xs text-gray-500">{t('academie.quiz.subtitle')}</p>
            <QuizBlock
              questions={modules.f1.quiz}
              done={!!progress.f1_cert_at}
              onComplete={(s) => saveProgress('f1', { quiz_score: s })}
            />
          </div>
        </div>
      )}

      {/* ──── MODULE 2 : REVENUS ─────────────────────────────────────────────── */}
      {activeTab === 1 && (
        <div className="space-y-3">
          {modules.f2.sections.map((section, i) => (
            <Accordion key={i} title={section.title}>
              {renderBlocks(section.blocks)}
            </Accordion>
          ))}

          {/* Simulateur F2 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-900">{t('academie.simulator.f2.title')}</h3>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                {t('academie.simulator.f2.serviceType')}
              </label>
              <select
                className="input text-sm"
                value={f2.serviceType}
                onChange={(e) => setF2(p => ({ ...p, serviceType: e.target.value }))}
              >
                <option value="">{t('academie.simulator.f2.serviceTypePlaceholder')}</option>
                <option value="cours">{t('academie.simulator.f2.services.cours')}</option>
                <option value="couture">{t('academie.simulator.f2.services.couture')}</option>
                <option value="cuisine">{t('academie.simulator.f2.services.cuisine')}</option>
                <option value="coiffure">{t('academie.simulator.f2.services.coiffure')}</option>
                <option value="reparation">{t('academie.simulator.f2.services.reparation')}</option>
                <option value="numerique">{t('academie.simulator.f2.services.numerique')}</option>
                <option value="autre">{t('academie.simulator.f2.services.autre')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                {t('academie.simulator.f2.tarif')}
              </label>
              <input
                type="number"
                className="input text-sm"
                placeholder={t('academie.simulator.f2.tarifPlaceholder')}
                value={f2.tarif}
                onChange={(e) => setF2(p => ({ ...p, tarif: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                {t('academie.simulator.f2.prestSem')}
              </label>
              <input
                type="number"
                className="input text-sm"
                placeholder={t('academie.simulator.f2.prestSemPlaceholder')}
                value={f2.prestSem}
                onChange={(e) => setF2(p => ({ ...p, prestSem: e.target.value }))}
              />
            </div>
            <button onClick={calcF2} className="btn-primary w-full">
              {t('academie.simulator.f2.cta')}
            </button>
            {f2Result && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('academie.simulator.f2.result.mensuel')}</span>
                  <span className="font-bold text-green-600">{fmt(f2Result.mensuel)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('academie.simulator.f2.result.annuel')}</span>
                  <span className="font-bold">{fmt(f2Result.annuel)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('academie.simulator.f2.result.parJour')}</span>
                  <span className="font-bold">{fmt(f2Result.parJour)}</span>
                </div>
                <div className={`rounded-xl p-3 text-xs font-medium ${f2Result.mensuel >= 50000 ? 'bg-green-50 text-green-700' : f2Result.mensuel >= 10000 ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-700'}`}>
                  {f2Result.mensuel >= 50000
                    ? t('academie.simulator.f2.result.excellent')
                    : f2Result.mensuel >= 10000
                    ? t('academie.simulator.f2.result.good')
                    : t('academie.simulator.f2.result.start')}
                </div>
              </div>
            )}
          </div>

          {/* Quiz F2 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-900">{t('academie.quiz.title')}</h3>
            <p className="text-xs text-gray-500">{t('academie.quiz.subtitle')}</p>
            <QuizBlock
              questions={modules.f2.quiz}
              done={!!progress.f2_cert_at}
              onComplete={(s) => saveProgress('f2', { quiz_score: s })}
            />
          </div>
        </div>
      )}

      {/* ──── MODULE 3 : ÉPARGNE ────────────────────────────────────────────── */}
      {activeTab === 2 && (
        <div className="space-y-3">
          {modules.f3.sections.map((section, i) => (
            <Accordion key={i} title={section.title}>
              {renderBlocks(section.blocks)}
            </Accordion>
          ))}

          {/* Simulateur F3 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-900">{t('academie.simulator.f3.title')}</h3>
            {f3Fields.map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                <input
                  type="number"
                  className="input text-sm"
                  placeholder={placeholder}
                  value={(f3 as Record<string, string>)[key]}
                  onChange={(e) => setF3((p) => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <button onClick={calcF3} className="btn-primary w-full">
              {t('academie.simulator.f3.cta')}
            </button>
            {f3Result && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('academie.simulator.f3.result.effort')}</span>
                  <span className="font-bold">{fmt(parseFloat(f3.mensuel) || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('academie.simulator.f3.result.pct')}</span>
                  <span className="font-bold">{f3Result.pct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('academie.simulator.f3.result.duration')}</span>
                  <span className={`font-bold ${f3Result.mois <= 12 ? 'text-green-600' : f3Result.mois <= 24 ? 'text-orange-500' : 'text-gray-700'}`}>
                    {f3Result.mois > 24
                      ? `${f3Result.mois} mois (${(f3Result.mois / 12).toFixed(1)} ans)`
                      : `${f3Result.mois} mois`}
                  </span>
                </div>
                <div className={`rounded-xl p-3 text-xs font-medium ${f3Result.pct >= 15 ? 'bg-green-50 text-green-700' : f3Result.pct >= 5 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                  {f3Result.pct >= 15
                    ? t('academie.simulator.f3.result.excellent').replace('{pct}', f3Result.pct.toFixed(0))
                    : f3Result.pct >= 5
                    ? t('academie.simulator.f3.result.good').replace('{pct}', f3Result.pct.toFixed(0))
                    : t('academie.simulator.f3.result.start')}
                </div>
              </div>
            )}
          </div>

          {/* Quiz F3 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-gray-900">{t('academie.quiz.title')}</h3>
            <p className="text-xs text-gray-500">{t('academie.quiz.subtitle')}</p>
            <QuizBlock
              questions={modules.f3.quiz}
              done={!!progress.f3_cert_at}
              onComplete={(s) => saveProgress('f3', { quiz_score: s })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
