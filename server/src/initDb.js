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
      apellido TEXT,
      telefono TEXT NOT NULL,
      fecha_turno DATE NOT NULL,
      hora_turno TIME NOT NULL,
      duracion_minutos INT NOT NULL DEFAULT 15,
      plan_id TEXT,
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

  await q(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS duracion_minutos INT NOT NULL DEFAULT 15;`)
  await q(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS plan_id TEXT;`)
  await q(`ALTER TABLE turnos ALTER COLUMN apellido DROP NOT NULL;`)

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

  await q(`
    CREATE TABLE IF NOT EXISTS planes (
      id TEXT PRIMARY KEY,
      empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      detalle TEXT,
      minutos INT NOT NULL DEFAULT 15,
      precio TEXT NOT NULL,
      activo BOOLEAN DEFAULT TRUE,
      orden INT DEFAULT 0
    );
  `)

  await q(`
    CREATE TABLE IF NOT EXISTS logs_actividad (
      id SERIAL PRIMARY KEY,
      staff_id INT REFERENCES staff(id) ON DELETE SET NULL,
      empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
      accion TEXT NOT NULL,
      detalle TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  const { rows: detaimEmp } = await q(`SELECT id FROM empresas WHERE slug = 'detaim' LIMIT 1`)
  const dId = detaimEmp[0]?.id
  if (dId) {
    const defaultPlanes = [
      ['basico-express', 'Básico Express', 'Pistola/Revólver ilimitado. Fases 1 y 2.', 'Fases 1 y 2.', 15, '20.000', 1],
      ['tactico-express', 'Táctico Express', 'Pistola + 1 Proveedor M4. Fases 1 y 2.', 'Fases 1 y 2.', 15, '30.000', 2],
      ['basico-30', "Básico 30'", 'Acceso Total Fases 1-4. Video + PDF incl.', 'Fases 1-4.', 30, '40.000', 3],
      ['tactico-30', "Táctico 30'", 'Acceso Total + 2 Prov M4. Video + PDF incl.', 'Acceso Total.', 30, '50.000', 4]
    ]
    for (const [id, nom, desc, det, min, pre, ord] of defaultPlanes) {
      await q(`
        INSERT INTO planes (id, empresa_id, nombre, descripcion, detalle, minutos, precio, orden)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          descripcion = EXCLUDED.descripcion,
          detalle = EXCLUDED.detalle,
          minutos = EXCLUDED.minutos,
          precio = EXCLUDED.precio,
          orden = EXCLUDED.orden
      `, [id, dId, nom, desc, det, min, pre, ord])
    }
  }

  const { rows: ec } = await q('SELECT COUNT(*)::int AS c FROM empresas')
  if (ec[0].c === 0) {
    await q(`
      INSERT INTO empresas (slug, nombre, tipo, color_hex) VALUES
        ('detaim', 'DETAIM', 'general', '#ffffff');
    `)
  }

  await q(`
    INSERT INTO empresas (slug, nombre, tipo, color_hex)
    VALUES ('detaim', 'DETAIM', 'general', '#ffffff')
    ON CONFLICT (slug) DO NOTHING
  `)

  const { rows: sc } = await q("SELECT COUNT(*)::int AS c FROM sedes WHERE slug = 'detaim-cajica'")
  if (sc[0].c === 0) {
    const ins = [
      [
        'detaim-cajica',
        'DETAIM Sede Cajicá',
        'Centro Empresarial B&E. a 0-50,, Cra. 6 #0-2, Cajicá. Oficina 401.',
        'detaim',
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
          '09:00',
          '20:00',
          4.9192,
          -74.0278,
          'general',
          0,
          'R-01',
          200,
          empSlug,
        ],
      )
    }
  }

  const { rows: detaim } = await q(`SELECT id FROM empresas WHERE slug = 'detaim' LIMIT 1`)
  const eid = detaim[0]?.id
  if (eid) {
    // Asegurar que el admin predeterminado exista y tenga la contraseña correcta
    await q(
      `INSERT INTO staff (email, password_plain, role, empresa_id) 
       VALUES ('admin@detaim.com', '12345', 'admin', $1)
       ON CONFLICT (email) DO UPDATE SET 
         password_plain = EXCLUDED.password_plain,
         password_hash = NULL,
         role = 'admin',
         empresa_id = EXCLUDED.empresa_id`,
      [eid],
    )
    
    // Asegurar que el asesor predeterminado exista
    await q(
      `INSERT INTO staff (email, password_plain, role, empresa_id) 
       VALUES ('asesor@detaim.com', '12345', 'asesor', $1)
       ON CONFLICT (email) DO NOTHING`,
      [eid],
    )
  }

  const coreId = eid
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
