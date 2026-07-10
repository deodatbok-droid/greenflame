import { NextRequest, NextResponse } from 'next/server'
import { generateAndSaveDigest } from '@/lib/ai/admin-digest'

// Vercel Cron Job — 7h00 UTC = 8h00 Cotonou (UTC+1)
// Configuré dans vercel.json : { "crons": [{ "path": "/api/cron/daily-digest", "schedule": "0 7 * * *" }] }

export async function GET(req: NextRequest) {
  // Vérification du secret Vercel Cron (header automatiquement ajouté par Vercel)
  const authHeader = req.headers.get('authorization')
  const expected   = `Bearer ${process.env.CRON_SECRET}`

  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const digestId = await generateAndSaveDigest('cron')
    return NextResponse.json({ ok: true, digestId })
  } catch (err) {
    console.error('[CRON/daily-digest] Erreur :', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 },
    )
  }
}
