/**
 * Rate Limiting — GreenFlame
 *
 * Couche légère pour limiter le nombre de requêtes par utilisateur/IP.
 * Fonctionne en mémoire par instance serverless (suffisant pour 200–5 000 users).
 * Pour scale > 5 000 : migrer vers Upstash Redis avec @upstash/ratelimit.
 */

export interface RateLimitEntry {
  count: number
  resetTime: number
}

// Store module-level (persiste dans l'instance serverless le temps de sa vie)
const store = new Map<string, RateLimitEntry>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number   // secondes
}

/**
 * Vérifie et incrémente le compteur pour une clé donnée.
 * @param key      Clé unique (ex: "txn:user-uuid", "withdraw:ip-address")
 * @param limit    Nombre maximum de requêtes dans la fenêtre
 * @param windowMs Durée de la fenêtre en millisecondes
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // Pas encore vu ou fenêtre expirée → reset
  if (!entry || now >= entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs })
    return {
      allowed: true,
      remaining: limit - 1,
      resetIn: Math.ceil(windowMs / 1000),
    }
  }

  // Limite atteinte
  if (entry.count >= limit) {
    const resetIn = Math.ceil((entry.resetTime - now) / 1000)
    return { allowed: false, remaining: 0, resetIn }
  }

  // Dans la fenêtre, incrémenter
  entry.count++
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetIn: Math.ceil((entry.resetTime - now) / 1000),
  }
}

/**
 * Construit les en-têtes HTTP standard pour les réponses rate-limited.
 */
export function rateLimitHeaders(
  limit: number,
  result: RateLimitResult
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + result.resetIn),
    ...(result.allowed ? {} : { 'Retry-After': String(result.resetIn) }),
  }
}
