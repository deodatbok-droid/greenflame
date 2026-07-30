'use client'

import Link from 'next/link'
import { useState } from 'react'

interface QuickActionProps {
  href: string
  icon: string
  label: string
  desc: string
  accent: string
}

export default function QuickAction({ href, icon, label, desc, accent }: QuickActionProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: '14px 14px', borderRadius: 12,
        background: '#fff', border: '1px solid #E2E8F0',
        textDecoration: 'none',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,.1)' : '0 1px 3px rgba(0,0,0,.05)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all .15s',
        borderTop: `3px solid ${accent}`,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{desc}</p>
      </div>
    </Link>
  )
}
