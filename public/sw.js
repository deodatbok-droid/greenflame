// GreenFlame Service Worker — cache stratégique + offline
const CACHE_NAME = 'gf-v4'
const STATIC_PRECACHE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ─── Install : précache des assets statiques ───────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE.map((url) => new Request(url, { cache: 'reload' })))
    })
  )
  self.skipWaiting()
})

// ─── Activate : purger les anciens caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ─── Fetch : stratégie hybride ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer les requêtes cross-origin
  if (url.origin !== self.location.origin) return

  // API + Supabase : network only, pas de cache
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase')
  ) return

  // Next.js internals
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          }
          return res
        })
      )
    )
    return
  }

  // Navigation (pages HTML) : network first → cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Mettre en cache la page visitée pour offline
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/')))
    )
    return
  }

  // Images et assets statiques : cache first
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Tout le reste : network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// ─── Push notifications (préparé pour Wasender/future) ────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'GreenFlame', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(clients.openWindow(url))
})
