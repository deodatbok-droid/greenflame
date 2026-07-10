'use client'

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type Measures = {
  tour_poitrine: number | null
  tour_taille: number | null
  tour_hanches: number | null
  longueur_dos: number | null
  longueur_robe: number | null
  longueur_pantalon: number | null
  epaules: number | null
  longueur_manche: number | null
  tour_cou: number | null
}

export type AvatarGarment =
  | 'robe_simple' | 'robe_soiree' | 'haut'
  | 'pantalon' | 'complet' | 'boubou' | 'jupe'

type Fabric = {
  id: string
  label: string
  base: string
  accent?: string
  type: 'uni' | 'wax_dot' | 'wax_diamond' | 'bazin' | 'kente'
}

// ── Catalogue de tissus ────────────────────────────────────────────────────

export const AVATAR_FABRICS: Fabric[] = [
  { id: 'wax_j',  label: 'Wax jaune',   base: '#f59e0b', accent: '#b45309', type: 'wax_dot'     },
  { id: 'wax_b',  label: 'Wax bleu',    base: '#2563eb', accent: '#1e40af', type: 'wax_diamond' },
  { id: 'wax_r',  label: 'Wax rouge',   base: '#dc2626', accent: '#991b1b', type: 'wax_dot'     },
  { id: 'wax_v',  label: 'Wax vert',    base: '#16a34a', accent: '#14532d', type: 'wax_diamond' },
  { id: 'baz_w',  label: 'Bazin blanc', base: '#f1f5f9', accent: '#94a3b8', type: 'bazin'       },
  { id: 'baz_b',  label: 'Bazin bleu',  base: '#bfdbfe', accent: '#60a5fa', type: 'bazin'       },
  { id: 'kente',  label: 'Kente',       base: '#166534', accent: '#fbbf24', type: 'kente'       },
  { id: 'u_blk',  label: 'Noir',        base: '#1f2937',                    type: 'uni'         },
  { id: 'u_vio',  label: 'Violet',      base: '#7c3aed',                    type: 'uni'         },
  { id: 'u_ros',  label: 'Rose',        base: '#db2777',                    type: 'uni'         },
]

// ── Standard fallback measurements ─────────────────────────────────────────

const STD = {
  tour_poitrine: 88, tour_taille: 70, tour_hanches: 96,
  longueur_dos: 40,  longueur_robe: 120, longueur_pantalon: 100,
  epaules: 40, longueur_manche: 55, tour_cou: 36,
}
const f = (v: number | null | undefined, k: keyof typeof STD) => v ?? STD[k]
const r = Math.round

// ── SVG fabric pattern ─────────────────────────────────────────────────────

function FabricPattern({ fab }: { fab: Fabric }) {
  const id = `fp-${fab.id}`
  const b = fab.base, a = fab.accent ?? fab.base

  if (fab.type === 'wax_dot') return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="14" height="14">
      <rect width="14" height="14" fill={b} />
      <circle cx="3.5" cy="3.5" r="2.2" fill={a} fillOpacity="0.5" />
      <circle cx="10.5" cy="10.5" r="2.2" fill={a} fillOpacity="0.5" />
      <circle cx="10.5" cy="3.5" r="1.2" fill="white" fillOpacity="0.28" />
      <circle cx="3.5" cy="10.5" r="1.2" fill="white" fillOpacity="0.28" />
    </pattern>
  )
  if (fab.type === 'wax_diamond') return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="12" height="12">
      <rect width="12" height="12" fill={b} />
      <path d="M6 1 L11 6 L6 11 L1 6 Z" fill={a} fillOpacity="0.42" />
      <path d="M6 3.5 L8.5 6 L6 8.5 L3.5 6 Z" fill="white" fillOpacity="0.22" />
    </pattern>
  )
  if (fab.type === 'bazin') return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="8">
      <rect width="6" height="8" fill={b} />
      <rect y="0" width="6" height="2" fill={a} fillOpacity="0.6" />
      <rect y="5" width="6" height="1" fill={a} fillOpacity="0.3" />
    </pattern>
  )
  if (fab.type === 'kente') return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill={b} />
      <rect x="0"  y="0"  width="5" height="5" fill={a}        fillOpacity="0.75" />
      <rect x="10" y="0"  width="5" height="5" fill="#dc2626"   fillOpacity="0.65" />
      <rect x="5"  y="10" width="5" height="5" fill={a}        fillOpacity="0.75" />
      <rect x="15" y="10" width="5" height="5" fill="#1d4ed8"   fillOpacity="0.55" />
      <rect x="0"  y="10" width="5" height="5" fill="#f59e0b"   fillOpacity="0.65" />
      <rect x="10" y="10" width="5" height="5" fill="white"     fillOpacity="0.12" />
      <line x1="0" y1="5"  x2="20" y2="5"  stroke="black" strokeWidth="0.4" strokeOpacity="0.22" />
      <line x1="0" y1="15" x2="20" y2="15" stroke="black" strokeWidth="0.4" strokeOpacity="0.22" />
      <line x1="5"  y1="0" x2="5"  y2="20" stroke="black" strokeWidth="0.4" strokeOpacity="0.22" />
      <line x1="15" y1="0" x2="15" y2="20" stroke="black" strokeWidth="0.4" strokeOpacity="0.22" />
    </pattern>
  )
  // uni
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="1" height="1">
      <rect width="1" height="1" fill={b} />
    </pattern>
  )
}

// ── Avatar SVG ─────────────────────────────────────────────────────────────

function AvatarSVG({
  measures, garment, fab,
}: { measures: Measures; garment: AvatarGarment; fab: Fabric }) {
  const CX = 100

  // Measurements with fallbacks
  const ep  = f(measures.epaules,           'epaules')
  const poi = f(measures.tour_poitrine,     'tour_poitrine')
  const tai = f(measures.tour_taille,       'tour_taille')
  const han = f(measures.tour_hanches,      'tour_hanches')
  const ld  = f(measures.longueur_dos,      'longueur_dos')
  const lr  = f(measures.longueur_robe,     'longueur_robe')
  const lp  = f(measures.longueur_pantalon, 'longueur_pantalon')
  const lm  = f(measures.longueur_manche,   'longueur_manche')
  const tc  = f(measures.tour_cou,          'tour_cou')

  // Vertical scale (cm → SVG units)
  const VS = 1.45

  // Fixed vertical anchors
  const headCY  = 35
  const headR   = 22
  const neckTop = headCY + headR - 3
  const shY     = 70

  // Derived vertical positions
  const waistY  = r(Math.min(shY + ld * VS,         200))
  const hipsY   = r(Math.min(waistY + 19,            228))
  const crY     = r(Math.min(hipsY  + 14,            248))
  const robeY   = r(Math.min(shY    + lr * VS,       425))
  const pantY   = r(Math.min(crY    + lp * VS * 0.65, 425))
  const hautY   = waistY + 6

  // Horizontal half-widths (circumference → projected half-width)
  const circ2w  = (c: number) => r((c / Math.PI / 2) * 3.15)
  const sw = Math.max(r(ep / 2 * 2.75), 30)
  const bw = Math.max(circ2w(poi), 23)
  const ww = Math.max(circ2w(tai), bw - 10)
  const hw = Math.max(circ2w(han), 27)
  const nw = Math.max(circ2w(tc),   6)

  // Leg geometry
  const ankleMod = 0.86
  const lW  = r(hw * 0.42)
  const gap = r(lW * 0.14)

  // Jupe ground Y (between waistY and robeY depending on length)
  const jupeY = r(waistY + (robeY - waistY) * 0.65 + crY * 0.1)

  // ViewBox height
  const isLeg  = ['pantalon', 'complet'].includes(garment)
  const isSkin = ['haut', 'jupe'].includes(garment)
  const bottomEdge = isLeg ? pantY : isSkin ? Math.max(pantY * 0.9, crY + 30) : robeY
  const VH = Math.ceil(Math.min(bottomEdge + 22, 448))

  // Pattern & stroke
  const pid = `fp-${fab.id}`
  const strokeC = ['#f1f5f9', '#bfdbfe'].includes(fab.base) ? '#94a3b8' : fab.base

  // Skin colors
  const sk  = '#C38B52'
  const skD = '#9C6B3C'

  // Sleeve length in SVG
  const mLen = r(lm * VS * 0.5)

  // ── Clothing path generators ──────────────────────────────────────────

  const L = 7  // looseness

  function bodyRobe(endY: number, flare: number): string {
    return `M ${CX - sw - L * 0.5} ${shY} C ${CX - sw - L} ${waistY - 13} ${CX - ww - L * 0.5} ${waistY - 4} ${CX - ww - L * 0.5} ${waistY} C ${CX - ww - L * 0.5} ${hipsY - 5} ${CX - hw - flare} ${hipsY + 4} ${CX - hw - flare} ${endY} L ${CX + hw + flare} ${endY} C ${CX + hw + flare} ${hipsY + 4} ${CX + ww + L * 0.5} ${hipsY - 5} ${CX + ww + L * 0.5} ${waistY} C ${CX + ww + L * 0.5} ${waistY - 4} ${CX + sw + L} ${waistY - 13} ${CX + sw + L * 0.5} ${shY} Z`
  }

  function bodyHaut(): string {
    return `M ${CX - sw - L * 0.5} ${shY} C ${CX - sw - L} ${shY + 22} ${CX - bw - L * 0.4} ${waistY - 10} ${CX - bw - L * 0.3} ${hautY} L ${CX + bw + L * 0.3} ${hautY} C ${CX + bw + L * 0.4} ${waistY - 10} ${CX + sw + L} ${shY + 22} ${CX + sw + L * 0.5} ${shY} Z`
  }

  function bodyJupe(endY: number): string {
    const jf = 11
    return `M ${CX - ww - L * 0.3} ${waistY} C ${CX - ww - L * 0.3} ${hipsY - 4} ${CX - hw - jf} ${hipsY + 3} ${CX - hw - jf} ${endY} L ${CX + hw + jf} ${endY} C ${CX + hw + jf} ${hipsY + 3} ${CX + ww + L * 0.3} ${hipsY - 4} ${CX + ww + L * 0.3} ${waistY} Z`
  }

  function bodyPants(endY: number): string {
    const g2  = gap + 2
    const aW  = r(lW * ankleMod)
    const midY = r(crY + (endY - crY) * 0.45)
    return `M ${CX - hw - L * 0.3} ${waistY} L ${CX + hw + L * 0.3} ${waistY} L ${CX + hw + L * 0.3} ${hipsY} L ${CX + lW + g2} ${crY} L ${CX + aW + 1} ${endY} L ${CX + g2 + 1} ${endY} L ${CX + g2 + 1} ${midY} L ${CX - g2 - 1} ${midY} L ${CX - g2 - 1} ${endY} L ${CX - aW - 1} ${endY} L ${CX - lW - g2} ${crY} L ${CX - hw - L * 0.3} ${hipsY} Z`
  }

  function bodyBoubou(endY: number): string {
    const bw2 = sw + 21
    const bf  = 27
    return `M ${CX - bw2} ${shY} L ${CX - bw2} ${waistY + 12} C ${CX - bw2} ${hipsY} ${CX - hw - bf} ${hipsY + 5} ${CX - hw - bf} ${endY} L ${CX + hw + bf} ${endY} C ${CX + hw + bf} ${hipsY + 5} ${CX + bw2} ${hipsY} ${CX + bw2} ${waistY + 12} L ${CX + bw2} ${shY} Z`
  }

  function sleeveLeft(wide: boolean): string {
    const w  = wide ? 22 : 11
    const ex = CX - sw - mLen
    return `M ${CX - sw} ${shY} C ${CX - sw - mLen * 0.4} ${shY + 8} ${ex + 5} ${shY + 13} ${ex} ${shY + 18} L ${ex - w} ${shY + 22} C ${ex - w * 0.6 + 5} ${shY + 13} ${CX - sw - w + 4} ${shY + 6} ${CX - sw - w + 10} ${shY + 1} Z`
  }

  function sleeveRight(wide: boolean): string {
    const w  = wide ? 22 : 11
    const ex = CX + sw + mLen
    return `M ${CX + sw} ${shY} C ${CX + sw + mLen * 0.4} ${shY + 8} ${ex - 5} ${shY + 13} ${ex} ${shY + 18} L ${ex + w} ${shY + 22} C ${ex + w * 0.6 - 5} ${shY + 13} ${CX + sw + w - 4} ${shY + 6} ${CX + sw + w - 10} ${shY + 1} Z`
  }

  // Collect clothing paths
  const mainPaths: string[] = []
  let sleeves: [string, string] | null = null
  let extraPants: string | null = null

  if (garment === 'robe_simple')  mainPaths.push(bodyRobe(robeY, 8))
  if (garment === 'robe_soiree')  mainPaths.push(bodyRobe(robeY, 24))
  if (garment === 'haut')        { mainPaths.push(bodyHaut());  sleeves = [sleeveLeft(false), sleeveRight(false)] }
  if (garment === 'pantalon')     mainPaths.push(bodyPants(pantY))
  if (garment === 'complet')     { mainPaths.push(bodyHaut()); extraPants = bodyPants(pantY); sleeves = [sleeveLeft(false), sleeveRight(false)] }
  if (garment === 'boubou')      { mainPaths.push(bodyBoubou(robeY)); sleeves = [sleeveLeft(true), sleeveRight(true)] }
  if (garment === 'jupe')         mainPaths.push(bodyJupe(jupeY))

  return (
    <svg
      viewBox={`0 0 200 ${VH}`}
      className="w-full max-w-[180px] mx-auto"
      style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.13))' }}
    >
      <defs>
        <FabricPattern fab={fab} />
      </defs>

      {/* Arms skin (background layer) */}
      <line x1={CX - sw} y1={shY} x2={CX - sw - mLen * 0.85} y2={shY + mLen * 0.62}
        stroke={sk} strokeWidth="13" strokeLinecap="round" />
      <line x1={CX + sw} y1={shY} x2={CX + sw + mLen * 0.85} y2={shY + mLen * 0.62}
        stroke={sk} strokeWidth="13" strokeLinecap="round" />

      {/* Neck skin */}
      <rect x={CX - nw} y={neckTop} width={nw * 2} height={70 - neckTop + 2} fill={sk} rx="2.5" />

      {/* Body skin */}
      <path d={`
        M ${CX - sw} ${shY}
        C ${CX - sw - 4} ${shY + 9} ${CX - bw - 2} ${shY + (waistY - shY) * 0.45} ${CX - bw} ${shY + (waistY - shY) * 0.6}
        C ${CX - bw} ${waistY - 4} ${CX - ww - 1} ${waistY - 2} ${CX - ww} ${waistY}
        C ${CX - ww} ${waistY + 5} ${CX - hw + 1} ${hipsY - 5} ${CX - hw} ${hipsY}
        L ${CX - hw} ${crY}
        L ${CX + hw} ${crY}
        L ${CX + hw} ${hipsY}
        C ${CX + hw - 1} ${hipsY - 5} ${CX + ww} ${waistY + 5} ${CX + ww} ${waistY}
        C ${CX + ww + 1} ${waistY - 2} ${CX + bw + 2} ${waistY - 4} ${CX + bw} ${shY + (waistY - shY) * 0.6}
        C ${CX + bw + 2} ${shY + (waistY - shY) * 0.45} ${CX + sw + 4} ${shY + 9} ${CX + sw} ${shY}
        Z
      `} fill={sk} />

      {/* Legs skin (visible for haut and jupe) */}
      {isSkin && (
        <>
          <path d={`M ${CX - lW - gap} ${crY} L ${CX - r(lW * ankleMod) - gap} ${pantY} L ${CX - gap - 1} ${pantY} L ${CX - gap - 1} ${crY + r((pantY - crY) * 0.45)} L ${CX - gap - 2} ${crY} Z`} fill={sk} />
          <path d={`M ${CX + lW + gap} ${crY} L ${CX + r(lW * ankleMod) + gap} ${pantY} L ${CX + gap + 1} ${pantY} L ${CX + gap + 1} ${crY + r((pantY - crY) * 0.45)} L ${CX + gap + 2} ${crY} Z`} fill={sk} />
        </>
      )}

      {/* Clothing sleeves (behind body top) */}
      {sleeves && (
        <>
          <path d={sleeves[0]} fill={`url(#${pid})`} stroke={strokeC} strokeWidth="0.9" strokeOpacity="0.55" />
          <path d={sleeves[1]} fill={`url(#${pid})`} stroke={strokeC} strokeWidth="0.9" strokeOpacity="0.55" />
        </>
      )}

      {/* Extra pants for complet */}
      {extraPants && (
        <path d={extraPants} fill={`url(#${pid})`} stroke={strokeC} strokeWidth="1" strokeOpacity="0.6" />
      )}

      {/* Main clothing */}
      {mainPaths.map((p, i) => (
        <path key={i} d={p} fill={`url(#${pid})`} stroke={strokeC} strokeWidth="1" strokeOpacity="0.6" />
      ))}

      {/* Head (drawn last — always on top) */}
      {/* Hair */}
      <ellipse cx={CX} cy={headCY - 14} rx={headR * 0.9} ry={12} fill="#1a0f02" />
      <path d={`M ${CX - headR + 4} ${headCY - 5} Q ${CX - headR - 6} ${headCY + 8} ${CX - headR + 1} ${headCY + 15}`}
        stroke="#1a0f02" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d={`M ${CX + headR - 4} ${headCY - 5} Q ${CX + headR + 6} ${headCY + 8} ${CX + headR - 1} ${headCY + 15}`}
        stroke="#1a0f02" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Face */}
      <circle cx={CX} cy={headCY} r={headR} fill={sk} />
      <ellipse cx={CX - 7} cy={headCY - 2} rx="2.5" ry="3" fill={skD} fillOpacity="0.6" />
      <ellipse cx={CX + 7} cy={headCY - 2} rx="2.5" ry="3" fill={skD} fillOpacity="0.6" />
      <path d={`M ${CX - 4} ${headCY + 8} Q ${CX} ${headCY + 13} ${CX + 4} ${headCY + 8}`}
        stroke={skD} strokeWidth="1.3" fill="none" />
    </svg>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────

type AvatarTryOnProps = {
  clients: Array<{ id: string; full_name: string } & Measures>
  selectedClientId: string
  selectedGarment: AvatarGarment
}

// ── Composant principal ────────────────────────────────────────────────────

export default function AvatarTryOn({
  clients,
  selectedClientId,
  selectedGarment,
}: AvatarTryOnProps) {
  const [fabIdx, setFabIdx] = useState(0)

  const client = clients.find((c) => c.id === selectedClientId)
  const measures: Measures = client ?? {
    tour_poitrine: null, tour_taille: null, tour_hanches: null,
    longueur_dos: null, longueur_robe: null, longueur_pantalon: null,
    epaules: null, longueur_manche: null, tour_cou: null,
  }

  const fab = AVATAR_FABRICS[fabIdx]

  return (
    <div className="space-y-4">
      {/* Sélection du tissu */}
      <div>
        <p className="label mb-2">Tissu</p>
        <div className="flex flex-wrap gap-2">
          {AVATAR_FABRICS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setFabIdx(i)}
              title={t.label}
              aria-label={t.label}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                fabIdx === i
                  ? 'border-gray-800 scale-110 shadow-md'
                  : 'border-transparent hover:border-gray-400'
              }`}
              style={{ backgroundColor: t.base }}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">{fab.label}</p>
      </div>

      {/* Avatar */}
      <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl border border-gray-100 py-5 px-4 flex justify-center min-h-[260px]">
        <AvatarSVG measures={measures} garment={selectedGarment} fab={fab} />
      </div>

      {/* Légende mesures */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
        {client ? (
          <>
            {client.tour_poitrine  && <span>Poitrine {client.tour_poitrine}cm</span>}
            {client.tour_taille    && <span>Taille {client.tour_taille}cm</span>}
            {client.tour_hanches   && <span>Hanches {client.tour_hanches}cm</span>}
            {client.longueur_robe  && <span>Longueur {client.longueur_robe}cm</span>}
            {!client.tour_poitrine && !client.tour_taille && !client.tour_hanches && (
              <span className="text-orange-400">Aucune mesure enregistrée — proportions standard</span>
            )}
          </>
        ) : (
          <span>Sélectionnez un client pour ses proportions réelles · Sinon : taille standard</span>
        )}
      </div>
    </div>
  )
}
