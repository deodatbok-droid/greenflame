import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat      = parseFloat(searchParams.get('lat') ?? '')
  const lng      = parseFloat(searchParams.get('lng') ?? '')
  const radius   = Math.min(parseInt(searchParams.get('radius') ?? '5000', 10), 50000)
  const category = searchParams.get('category') || null

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat et lng requis' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data, error } = await svc.rpc('search_merchants_nearby', {
    lat,
    lng,
    radius_m:        radius,
    category_filter: category,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
