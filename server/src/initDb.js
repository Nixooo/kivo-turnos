import { pool } from './db.js'
import { hashPassword } from './password.js'

async function q(sql, params) {
  return pool.query(sql, params)
}

export async function initDb() {
  const SUPREMO_EMAIL = (process.env.SUPREMO_EMAIL || 'nicolas@supremo.com')
    .toLowerCase()
    .trim()
  const DEFAULT_SUPREMO_PASSWORD_HASH =
    'scrypt$dqQs3pVXVs6el6LqZaoPEQ==$zstTNZdBKQLG7m5iv5xx4Eknjg1mNyuZmBXKec/sL9KOqZVXp3BUBkC91phmEbahlI6MLw6D/pkVdplYGSEK3w=='
  const supremoPasswordHash = process.env.SUPREMO_PASSWORD
    ? hashPassword(process.env.SUPREMO_PASSWORD)
    : process.env.SUPREMO_PASSWORD_HASH || DEFAULT_SUPREMO_PASSWORD_HASH

  await q(`
    CREATE TABLE IF NOT EXISTS empresas (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('eps', 'banco', 'general', 'clinica', 'notaria', 'gimnasio')),
      logo_url TEXT,
      color_hex TEXT DEFAULT '#000000'
    );
  `)

  await q(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url TEXT;`)
  await q(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS color_hex TEXT DEFAULT '#000000';`)

  await q(`
    CREATE TABLE IF NOT EXISTS sedes (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      direccion TEXT NOT NULL,
      hora_apertura TIME NOT NULL,
      hora_cierre TIME NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('general', 'eps', 'banco')),
      personas_fila_estimado INT DEFAULT 0,
      turno_atendiendo TEXT DEFAULT 'A-01',
      geocerca_metros INT DEFAULT 200
    );
  `)

  await q(`ALTER TABLE sedes ADD COLUMN IF NOT EXISTS empresa_id INT REFERENCES empresas(id);`)

  await q(`
    CREATE TABLE IF NOT EXISTS staff (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_plain TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'asesor')),
      empresa_id INT NOT NULL REFERENCES empresas(id)
    );
  `)

  await q(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_hash TEXT;`)
  await q(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_supremo BOOLEAN DEFAULT FALSE;`)
  await q(`UPDATE staff SET is_supremo = COALESCE(is_supremo, false);`).catch(() => {})
  await q(`ALTER TABLE staff ALTER COLUMN is_supremo SET NOT NULL;`).catch(() => {})
  await q(`ALTER TABLE staff ALTER COLUMN password_plain DROP NOT NULL;`).catch(() => {})
  await q(`CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_supremo ON staff (is_supremo) WHERE is_supremo = true;`)

  await q(`
    CREATE TABLE IF NOT EXISTS empresa_preguntas (
      id SERIAL PRIMARY KEY,
      empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('bool', 'dropdown', 'scale10')),
      options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      orden INT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (empresa_id, key)
    );
  `)

  await q(`
    CREATE TABLE IF NOT EXISTS turnos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sede_id INT NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
      numero_publico TEXT NOT NULL,
      documento TEXT NOT NULL,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      telefono TEXT NOT NULL,
      fecha_turno DATE NOT NULL,
      hora_turno TIME NOT NULL,
      prioridad TEXT,
      triage_urgencia_vital BOOLEAN,
      triage_efectivo BOOLEAN,
      modo_hibrido BOOLEAN DEFAULT TRUE,
      estado TEXT NOT NULL DEFAULT 'espera',
      orden_atencion INT NOT NULL,
      checkin_metodo TEXT,
      checkin_completado BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  await q(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS documento_norm TEXT;`)
  await q(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS codigo_seguro CHAR(4);`)
  await q(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`)
  await q(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS retrasos_aplicados INT DEFAULT 0;`)
  await q(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS respuestas_extra JSONB;`)
  await q(`
    CREATE UNIQUE INDEX IF NOT EXISTS turnos_idempotency_key_idx ON turnos (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
  `)

  await q(`
    UPDATE turnos SET documento_norm = regexp_replace(COALESCE(documento, ''), '[^0-9]', '', 'g')
    WHERE documento_norm IS NULL OR documento_norm = '';
  `).catch(() => {})

  await q(`
    UPDATE turnos SET codigo_seguro = LPAD((floor(random() * 9000 + 1000))::text, 4, '0')
    WHERE codigo_seguro IS NULL;
  `).catch(() => {})

  await q(`ALTER TABLE turnos DROP CONSTRAINT IF EXISTS turnos_estado_check;`).catch(() => {})
  await q(`
    ALTER TABLE turnos ADD CONSTRAINT turnos_estado_check CHECK (
      estado IN ('pendiente_confirmacion', 'espera', 'atendiendo', 'completado', 'cancelado')
    );
  `).catch(() => {})

  await q(`
    UPDATE turnos SET estado = 'espera' WHERE estado IS NULL OR estado NOT IN (
      'pendiente_confirmacion', 'espera', 'atendiendo', 'completado', 'cancelado'
    );
  `).catch(() => {})

  const { rows: ec } = await q('SELECT COUNT(*)::int AS c FROM empresas')
  if (ec[0].c === 0) {
    await q(`
      INSERT INTO empresas (slug, nombre, tipo) VALUES
        ('eps-salud', 'EPS Salud Chapinero', 'eps'),
        ('banco-popular', 'Banco Popular', 'banco'),
        ('taller-pro', 'Taller Pro Engativá', 'general'),
        ('estudio-creativo', 'Estudio Creativo Suba', 'general');
    `)
  }

  await q(`
    INSERT INTO empresas (slug, nombre, tipo)
    VALUES ('kivo-core', 'KIVO Core', 'general')
    ON CONFLICT (slug) DO NOTHING
  `)

  const { rows: sc } = await q('SELECT COUNT(*)::int AS c FROM sedes')
  if (sc[0].c === 0) {
    const ins = [
      [
        'eps-norte',
        'EPS Salud Chapinero — Sede Norte',
        'Calle 60 #7-20, Chapinero, Bogotá',
        'eps-salud',
      ],
      [
        'banco-centro',
        'Banco Popular — Centro',
        'Carrera 7 #12-50, La Candelaria, Bogotá',
        'banco-popular',
      ],
      [
        'taller-engativa',
        'Taller Mecánico Engativá',
        'Calle 80 #103-40, Engativá, Bogotá',
        'taller-pro',
      ],
      [
        'estudio-sub',
        'Estudio Creativo — Suba',
        'Calle 145 #91-20, Suba, Bogotá',
        'estudio-creativo',
      ],
    ]
    for (const [slug, nombre, dir, empSlug] of ins) {
      await q(
        `
        INSERT INTO sedes (slug, nombre, direccion, hora_apertura, hora_cierre, lat, lng, tipo, personas_fila_estimado, turno_atendiendo, geocerca_metros, empresa_id)
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, e.id
        FROM empresas e WHERE e.slug = $12
        ON CONFLICT (slug) DO NOTHING
      `,
        [
          slug,
          nombre,
          dir,
          slug.startsWith('eps') ? '07:00' : slug.startsWith('banco') ? '08:00' : slug.startsWith('taller') ? '08:00' : '09:00',
          slug.startsWith('eps') ? '18:00' : slug.startsWith('banco') ? '16:30' : slug.startsWith('taller') ? '18:00' : '19:00',
          slug === 'eps-norte'
            ? 4.6483
            : slug === 'banco-centro'
              ? 4.6097
              : slug === 'taller-engativa'
                ? 4.707
                : 4.745,
          slug === 'eps-norte'
            ? -74.0618
            : slug === 'banco-centro'
              ? -74.0817
              : slug === 'taller-engativa'
                ? -74.112
                : -74.034,
          slug === 'eps-norte' ? 'eps' : slug === 'banco-centro' ? 'banco' : 'general',
          slug === 'eps-norte' ? 15 : slug === 'banco-centro' ? 4 : slug === 'taller-engativa' ? 6 : 0,
          slug === 'eps-norte' ? 'A-14' : slug === 'banco-centro' ? 'C-03' : slug === 'taller-engativa' ? 'T-07' : 'E-01',
          200,
          empSlug,
        ],
      )
    }
  } else {
    await q(`
      UPDATE sedes s SET empresa_id = e.id
      FROM empresas e
      WHERE s.slug = 'eps-norte' AND e.slug = 'eps-salud' AND (s.empresa_id IS NULL);
    `).catch(() => {})
    await q(`
      UPDATE sedes s SET empresa_id = e.id
      FROM empresas e
      WHERE s.slug = 'banco-centro' AND e.slug = 'banco-popular' AND (s.empresa_id IS NULL);
    `).catch(() => {})
    await q(`
      UPDATE sedes s SET empresa_id = e.id
      FROM empresas e
      WHERE s.slug = 'taller-engativa' AND e.slug = 'taller-pro' AND (s.empresa_id IS NULL);
    `).catch(() => {})
    await q(`
      UPDATE sedes s SET empresa_id = e.id
      FROM empresas e
      WHERE s.slug = 'estudio-sub' AND e.slug = 'estudio-creativo' AND (s.empresa_id IS NULL);
    `).catch(() => {})
  }

  const { rows: stc } = await q('SELECT COUNT(*)::int AS c FROM staff')
  if (stc[0].c === 0) {
    const { rows: eps } = await q(`SELECT id FROM empresas WHERE slug = 'eps-salud' LIMIT 1`)
    const eid = eps[0]?.id
    if (eid) {
      await q(
        `INSERT INTO staff (email, password_plain, role, empresa_id) VALUES
          ('admin@kivo.com', '12345', 'admin', $1),
          ('asesor@kivo.com', '12345', 'asesor', $1)
        ON CONFLICT (email) DO NOTHING`,
        [eid],
      )
    }
  }

  const { rows: core } = await q(`SELECT id FROM empresas WHERE slug = 'kivo-core' LIMIT 1`)
  const coreId = core[0]?.id
  if (coreId) {
    await q(`UPDATE staff SET is_supremo = false WHERE is_supremo = true AND email <> $1`, [
      SUPREMO_EMAIL,
    ]).catch(() => {})
    await q(
      `
      INSERT INTO staff (email, password_plain, password_hash, role, empresa_id, is_supremo)
      VALUES ($1, NULL, $2, 'admin', $3, true)
      ON CONFLICT (email) DO UPDATE SET
        password_plain = NULL,
        password_hash = EXCLUDED.password_hash,
        role = 'admin',
        empresa_id = EXCLUDED.empresa_id,
        is_supremo = true
    `,
      [SUPREMO_EMAIL, supremoPasswordHash, coreId],
    )
  }

  await q(`
    DROP INDEX IF EXISTS uq_turno_activo_dia;
  `).catch(() => {})
  await q(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_activo_dia
    ON turnos (sede_id, fecha_turno, documento_norm)
    WHERE estado IN ('pendiente_confirmacion', 'espera', 'atendiendo')
    AND documento_norm IS NOT NULL AND documento_norm <> '';
  `).catch(() => {})
}
