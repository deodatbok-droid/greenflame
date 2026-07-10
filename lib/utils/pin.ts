import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

const KEYLEN = 32
const SALT_LEN = 16

export function hashPin(plain: string): string {
  const salt = randomBytes(SALT_LEN).toString('hex')
  const key = scryptSync(plain, salt, KEYLEN).toString('hex')
  return `${salt}:${key}`
}

export function verifyPin(plain: string, stored: string): boolean {
  try {
    const [salt, key] = stored.split(':')
    if (!salt || !key) return false
    const derived = scryptSync(plain, salt, KEYLEN)
    return timingSafeEqual(derived, Buffer.from(key, 'hex'))
  } catch {
    return false
  }
}
