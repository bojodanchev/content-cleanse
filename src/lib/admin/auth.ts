import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    throw new Error('ADMIN_PASSWORD env var is not set')
  }
  return password
}

export function createSessionToken(password: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const hmac = createHmac('sha256', password)
    .update(timestamp)
    .digest('hex')
  return `${timestamp}.${hmac}`
}

export function verifySessionToken(token: string): boolean {
  const password = getAdminPassword()
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [timestamp, signature] = parts
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) return false

  // Reject tokens older than 24 hours
  const now = Math.floor(Date.now() / 1000)
  if (now - ts > COOKIE_MAX_AGE) return false

  const expected = createHmac('sha256', password)
    .update(timestamp)
    .digest('hex')

  try {
    const sigBuf = Buffer.from(signature, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return false
    return timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

export async function verifyAdminSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get(COOKIE_NAME)
    if (!session?.value) return false
    return verifySessionToken(session.value)
  } catch {
    return false
  }
}

export async function setAdminCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}
