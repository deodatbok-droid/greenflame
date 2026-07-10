'use client'

import { useEffect } from 'react'
import { useTrack } from '@/lib/hooks/useTrack'

export default function PageTracker({
  event,
  metadata,
}: {
  event: string
  metadata?: Record<string, unknown>
}) {
  const track = useTrack()
  useEffect(() => { track(event, metadata ?? {}) }, []) // eslint-disable-line
  return null
}
