import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

export function poolConfigFromUrl(raw) {
  const u = new URL(raw.replace(/^postgres:/, 'http:'))
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: Number(u.port) || 5432,
    database: u.pathname.replace(/^\//, '').split('?')[0] || 'defaultdb',
    ssl: { rejectUnauthorized: false },
  }
}

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en server/.env')
  process.exit(1)
}

export const pool = new Pool(poolConfigFromUrl(process.env.DATABASE_URL))
