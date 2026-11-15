import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import express from 'express'
import { transaction } from './database.mjs'
import { ApiError, inputObject } from './validation.mjs'

const deriveKey = promisify(scrypt)
const hashOptions = {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024}
const sessionLifetime = 8 * 60 * 60 * 1000
const cookieName = 'bank_soal_session'
const tokenPattern = /(?:^|;\s*)bank_soal_session=([A-Za-z0-9_-]{43})(?:;|$)/
const tokenHash = (token) => createHash('sha256').update(token).digest()
const readToken = (request) => request.headers.cookie?.match(tokenPattern)?.[1]
const cookieOptions = (request) => ({httpOnly: true, sameSite: 'strict', secure: request.secure, path: '/'})
const credentialsError = 'Nama pengguna atau kata sandi salah.'
const dummySalt = Buffer.alloc(16)
const dummyHash = Buffer.alloc(64)

export const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,39}$/

export async function hashPassword(password, salt) {
  return deriveKey(password, salt, 64, hashOptions)
}

export function requireSameOrigin(request, _response, next) {
  const origin = request.get('origin')
  if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    && origin !== `${request.protocol}://${request.get('host')}`) {
    throw new ApiError(403, 'Permintaan berasal dari alamat yang berbeda.')
  }
  next()
}

export function createAuth(pool) {
  const router = express.Router()
  const attempts = new Map()

  function countAttempt(request) {
    const time = Date.now()
    const address = request.ip
    for (const [key, attempt] of attempts) {
      if (attempt.until <= time) attempts.delete(key)
    }
    const current = attempts.get(address) ?? {count: 0, until: time + 60_000}
    if (current.count >= 10) throw new ApiError(429, 'Terlalu banyak percobaan masuk. Coba lagi dalam satu menit.')
    current.count += 1
    attempts.set(address, current)
  }

  async function getSession(request) {
    const token = readToken(request)
    if (!token) return null
    const {rows: [row]} = await pool.query(
      `SELECT auth_users.username, auth_users.display_name AS name, expires_at AS "expiresAt"
       FROM auth_sessions JOIN auth_users USING (username)
       WHERE token_hash = $1 AND expires_at > now()`,
      [tokenHash(token)],
    )
    return row ? {user: {username: row.username, name: row.name}, expiresAt: row.expiresAt} : null
  }

  async function removeSession(client, request) {
    const token = readToken(request)
    if (token) await client.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash(token)])
  }

  router.get('/session', async (request, response) => {
    const session = await getSession(request)
    if (!session && readToken(request)) response.clearCookie(cookieName, cookieOptions(request))
    response.json({session})
  })

  router.post('/login', express.json({limit: '4kb'}), async (request, response) => {
    countAttempt(request)
    const input = inputObject(request.body)
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : ''
    const password = input.password
    if (!usernamePattern.test(username) || typeof password !== 'string' || !password.length || Buffer.byteLength(password) > 1024) {
      throw new ApiError(401, credentialsError)
    }

    const {rows: [account]} = await pool.query(
      'SELECT username, display_name, password_salt, password_hash FROM auth_users WHERE username = $1', [username],
    )
    const candidate = await hashPassword(password, account?.password_salt ?? dummySalt)
    if (!timingSafeEqual(candidate, account?.password_hash ?? dummyHash) || !account) throw new ApiError(401, credentialsError)

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + sessionLifetime)
    await transaction(pool, async (client) => {
      await removeSession(client, request)
      await client.query('DELETE FROM auth_sessions WHERE expires_at <= now()')
      await client.query(
        'INSERT INTO auth_sessions (token_hash, username, expires_at) VALUES ($1, $2, $3)',
        [tokenHash(token), account.username, expiresAt],
      )
    })

    attempts.delete(request.ip)
    response.cookie(cookieName, token, {...cookieOptions(request), maxAge: sessionLifetime})
    response.json({session: {user: {username: account.username, name: account.display_name}, expiresAt}})
  })

  router.post('/logout', async (request, response) => {
    await removeSession(pool, request)
    response.clearCookie(cookieName, cookieOptions(request)).status(204).end()
  })

  async function requireSession(request, response, next) {
    const session = await getSession(request)
    if (!session) {
      response.clearCookie(cookieName, cookieOptions(request))
      throw new ApiError(401, 'Silakan masuk untuk mengakses Bank Soal.')
    }
    response.locals.account = session.user
    next()
  }

  return {router, requireSession}
}
