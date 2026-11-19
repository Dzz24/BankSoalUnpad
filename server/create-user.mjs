import { randomBytes } from 'node:crypto'
import { open, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { hashPassword, usernamePattern } from './auth.mjs'
import { createPool, prepareSchema, transaction } from './database.mjs'

async function createUser() {
  const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {name: {type: 'string'}, 'credentials-file': {type: 'string'}},
  })
  const username = positionals[0]?.trim().toLowerCase() ?? ''
  if (positionals.length !== 1 || !usernamePattern.test(username)) {
    throw new Error('Gunakan npm run auth:create-user -- nama_pengguna. Nama pengguna harus 3–40 karakter dan boleh memuat huruf, angka, titik, garis bawah, atau tanda hubung.')
  }
  const name = values.name?.trim() ?? username
  if (!name || name.length > 80) throw new Error('Nama tampilan harus diisi dan maksimal 80 karakter.')

  const password = randomBytes(18).toString('base64url')
  const salt = randomBytes(16)
  const hash = await hashPassword(password, salt)
  const credentials = `Nama pengguna: ${username}\nKata sandi: ${password}\n`
  const filename = values['credentials-file'] ? resolve(values['credentials-file']) : null
  const pool = createPool()
  let fileCreated = false
  try {
    await transaction(pool, async (client) => {
      await prepareSchema(client)
      const result = await client.query(
        `INSERT INTO auth_users (username, display_name, password_salt, password_hash)
         VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
        [username, name, salt, hash],
      )
      if (!result.rowCount) throw new Error('Nama pengguna sudah dipakai.')
      if (filename) {
        const output = await open(filename, 'wx', 0o600)
        fileCreated = true
        try {
          await output.writeFile(credentials, 'utf8')
        } finally {
          await output.close()
        }
      }
    })
  } catch (error) {
    if (fileCreated) await unlink(filename)
    throw error
  } finally {
    await pool.end()
  }
  process.stdout.write(filename ? `Akun ${username} dibuat. Kredensial disimpan di ${filename}\n` : credentials)
}

createUser().catch((error) => {
  console.error('Akun gagal dibuat:', error.message)
  process.exitCode = 1
})
