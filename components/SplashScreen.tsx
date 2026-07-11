'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

/**
 * SplashScreen — s'affiche au démarrage de l'app (~2,2s) puis disparaît en fondu.
 * Visible uniquement lors de l'ouverture initiale (PWA ou premier rendu).
 */
export default function SplashScreen() {
  const [visible, setVisible]   = useState(true)
  const [fading,  setFading]    = useState(false)

  useEffect(() => {
    // Démarrer le fondu à 1,8s, disparaître complètement à 2,3s
    const fadeTimer = setTimeout(() => setFading(true),  1800)
    const hideTimer = setTimeout(() => setVisible(false), 2300)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          9999,
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: '#16a34a',
        transition:      'opacity 0.5s ease',
        opacity:         fading ? 0 : 1,
        pointerEvents:   fading ? 'none' : 'auto',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width:  120,
          height: 120,
          position: 'relative',
          animation: 'gf-pulse 1.8s ease-in-out infinite',
        }}
      >
        <Image
          src="/logo-transparent.png"
          alt="GreenFlame"
          fill
          sizes="120px"
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      {/* Nom de l'app */}
      <p
        style={{
          marginTop:   20,
          color:       '#ffffff',
          fontSize:    28,
          fontWeight:  700,
          letterSpacing: 1,
          fontFamily:  'Inter, system-ui, sans-serif',
        }}
      >
        GreenFlame
      </p>

      {/* Tagline discrète */}
      <p
        style={{
          marginTop:  6,
          color:      'rgba(255,255,255,0.7)',
          fontSize:   13,
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: 0.5,
        }}
      >
        Commerce communautaire pan-africain
      </p>

      {/* Animation CSS inline */}
      <style>{`
        @keyframes gf-pulse {
          0%, 100% { transform: scale(1);    opacity: 1;    }
          50%       { transform: scale(1.06); opacity: 0.92; }
        }
      `}</style>
    </div>
  )
}
