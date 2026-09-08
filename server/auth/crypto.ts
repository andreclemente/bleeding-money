import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const SALT_LENGTH = 16
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const BASE64URL = /^[A-Za-z0-9_-]+$/
const scrypt = (password: string, salt: Buffer, length: number, options: typeof SCRYPT_OPTIONS) => new Promise<Buffer>((resolve, reject) => {
  nodeScrypt(password, salt, length, options, (error, key) => error ? reject(error) : resolve(key))
})

export const hashPassword = async (password: string) => {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS) as Buffer
  return `scrypt$v1$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export const parsePasswordHash = (encoded: string) => {
  const parts = encoded.split('$')
  if (parts.length !== 7) return null
  const [algorithm, version, n, r, p, saltValue, hashValue] = parts
  if (algorithm !== 'scrypt' || version !== 'v1' || n !== String(SCRYPT_OPTIONS.N) || r !== String(SCRYPT_OPTIONS.r) || p !== String(SCRYPT_OPTIONS.p)) return null
  if (!saltValue || saltValue.length !== 22 || !BASE64URL.test(saltValue) || !hashValue || hashValue.length !== 86 || !BASE64URL.test(hashValue)) return null
  const salt = Buffer.from(saltValue, 'base64url')
  const expected = Buffer.from(hashValue, 'base64url')
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return null
  return { salt, expected }
}

export const verifyPassword = async (password: string, encoded: string) => {
  try {
    const parsed = parsePasswordHash(encoded)
    if (!parsed) return false
    const actual = await scrypt(password, parsed.salt, KEY_LENGTH, SCRYPT_OPTIONS) as Buffer
    return timingSafeEqual(actual, parsed.expected)
  } catch {
    return false
  }
}

export const createSessionToken = () => randomBytes(32).toString('base64url')
export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex')
