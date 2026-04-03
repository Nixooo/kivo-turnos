import crypto from 'crypto'

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(String(password), salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password, stored) {
  if (!stored) return false
  const parts = String(stored).split('$')
  if (parts.length !== 3) return false
  const [algo, saltB64, hashB64] = parts
  if (algo !== 'scrypt') return false
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  if (!expected.length) return false
  const actual = crypto.scryptSync(String(password), salt, expected.length)
  if (actual.length !== expected.length) return false
  return crypto.timingSafeEqual(actual, expected)
}

