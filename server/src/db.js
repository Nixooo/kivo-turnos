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
  console.warn('ADVERTENCIA: DATABASE_URL no está definida en el entorno.')
  // No salimos inmediatamente para permitir que el servidor inicie y muestre errores en los logs de Render
}

export const pool = process.env.DATABASE_URL 
  ? new Pool(poolConfigFromUrl(process.env.DATABASE_URL))
  : null

export async function query(text, params) {
  if (!pool) {
    throw new Error('La base de datos no está configurada (falta DATABASE_URL)')
  }
  return pool.query(text, params)
}
