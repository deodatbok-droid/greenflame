'use client'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

export default function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  if (total === 0) {
    return (
      <div className="w-32 h-32 rounded-full border-[14px] border-gray-100 flex items-center justify-center">
        <p className="text-[10px] text-gray-400 text-center leading-tight px-1">
          Effectuez votre premier achat
        </p>
      </div>
    )
  }

  let cumulative = 0
  const stops: string[] = []
  for (const seg of segments) {
    if (seg.value === 0) continue
    const start = (cumulative / total) * 360
    cumulative += seg.value
    const end = (cumulative / total) * 360
    stops.push(`${seg.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`)
  }

  return (
    <div
      className="w-32 h-32 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: `conic-gradient(${stops.join(', ')})` }}
    >
      <div className="w-[72px] h-[72px] rounded-full bg-white dark:bg-gray-50" />
    </div>
  )
}
