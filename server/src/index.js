import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from './db.js'
import { initDb } from './initDb.js'
import { hashPassword, verifyPassword } from './password.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'kivo-dev-secret-cambiar-en-produccion'

const PLANES = [
  { id: 'plan-15', minutos: 15 },
  { id: 'plan-30', minutos: 30 }
]

const app = express()
app.use(cors())
app.use(express.json())

// Helper para registrar actividad
async function logActividad(staffId, empresaId, accion, detalle) {
  try {
    await pool.query(
      `INSERT INTO logs_actividad (staff_id, empresa_id, accion, detalle) VALUES ($1, $2, $3, $4)`,
      [staffId, empresaId, accion, detalle],
    )
  } catch (e) {
    console.error('Error al registrar log:', e)
  }
}

// Servir archivos estáticos del frontend en producción
const frontendDist = path.join(__dirname, '../../frontend/dist')
app.use(express.static(frontendDist))

function mapSede(row) {
  const carga =
    row.personas_fila_estimado >= 12
      ? 'alta'
      : row.personas_fila_estimado >= 5
        ? 'media'
        : 'baja'
  const esperaMinAprox = Math.max(5, Math.round(row.personas_fila_estimado * 1.6))
  return {
    dbId: row.id,
    id: row.slug,
    slug: row.slug,
    label: row.nombre,
    nombre: row.nombre,
    direccion: row.direccion,
    horaApertura: row.hora_apertura,
    horaCierre: row.hora_cierre,
    lat: row.lat,
    lng: row.lng,
    tipo: row.tipo,
    personasDelante: row.personas_fila_estimado,
    esperaMinAprox,
    carga,
    turnoAtendiendo: row.turno_atendiendo,
    geocercaMetros: row.geocerca_metros,
    empresaId: row.empresa_id,
    empresaSlug: row.empresa_slug,
  }
}

function normDoc(d) {
  return String(d || '').replace(/\D/g, '')
}

function randomCodigo() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function prefijoPrioridad(prioridad) {
  if (!prioridad || prioridad === 'ninguna') return 'N'
  return 'P'
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Sin sesión' })
  try {
    req.staff = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión inválida' })
  }
}

function requireAdmin(req, res, next) {
  if (req.staff?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores' })
  }
  next()
}

function requireSupremo(req, res, next) {
  if (req.staff?.isSupremo !== true) {
    return res.status(403).json({ error: 'Solo supremo' })
  }
  next()
}

function normSlug(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' })
  }
  try {
    const { rows } = await pool.query('SELECT * FROM staff WHERE email = $1', [
      email.toLowerCase().trim(),
    ])
    if (!rows.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }
    const s = rows[0]
    const ok = s.password_hash
      ? verifyPassword(password, s.password_hash)
      : s.password_plain === password
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }
    if (!s.password_hash && s.password_plain === password) {
      const ph = hashPassword(password)
      await pool
        .query(`UPDATE staff SET password_hash = $1, password_plain = NULL WHERE id = $2`, [
          ph,
          s.id,
        ])
        .catch(() => {})
      s.password_hash = ph
      s.password_plain = null
    }
    const { rows: emp } = await pool.query('SELECT * FROM empresas WHERE id = $1', [
      s.empresa_id,
    ])
    const token = jwt.sign(
      {
        sid: s.id,
        empresaId: s.empresa_id,
        role: s.role,
        email: s.email,
        isSupremo: s.is_supremo === true,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    )
    res.json({
      token,
      role: s.role,
      empresaId: s.empresa_id,
      empresaNombre: emp[0]?.nombre ?? '',
      empresaTipo: emp[0]?.tipo ?? 'general',
      empresaSlug: emp[0]?.slug ?? '',
      isSupremo: s.is_supremo === true,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al iniciar sesión' })
  }
})

app.get('/api/sedes', async (req, res) => {
  const { empresaSlug } = req.query
  try {
    if (empresaSlug) {
      const { rows } = await pool.query(
        `SELECT s.*, e.slug AS empresa_slug FROM sedes s 
         JOIN empresas e ON e.id = s.empresa_id 
         WHERE e.slug = $1 
         ORDER BY s.nombre`,
        [empresaSlug],
      )
      return res.json(rows.map(mapSede))
    }
    const { rows } = await pool.query(`
      SELECT s.*, e.slug AS empresa_slug 
      FROM sedes s
      LEFT JOIN empresas e ON e.id = s.empresa_id
      ORDER BY s.nombre
    `)
    res.json(rows.map(mapSede))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron cargar las sedes' })
  }
})

app.get('/api/empresas', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, slug, nombre, tipo, logo_url, color_hex FROM empresas ORDER BY nombre')
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar empresas' })
  }
})

app.get('/api/empresas/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM empresas WHERE slug = $1', [
      req.params.slug,
    ])
    if (!rows.length) return res.status(404).json({ error: 'Empresa no encontrada' })
    res.json(rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al consultar la empresa' })
  }
})

app.get('/api/empresas/:slug/sedes', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, e.slug AS empresa_slug FROM sedes s
       JOIN empresas e ON e.id = s.empresa_id
       WHERE e.slug = $1
       ORDER BY s.nombre`,
      [req.params.slug],
    )
    res.json(rows.map(mapSede))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar sedes de la empresa' })
  }
})

app.get('/api/sedes/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sedes WHERE slug = $1', [
      req.params.slug,
    ])
    if (!rows.length) return res.status(404).json({ error: 'Sede no encontrada' })
    res.json(mapSede(rows[0]))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al consultar la sede' })
  }
})

app.get('/api/sedes/:slug/reservas-dia', async (req, res) => {
  const { fecha } = req.query
  if (!fecha) return res.status(400).json({ error: 'Fecha requerida' })
  try {
    const { rows } = await pool.query(
      `SELECT hora_turno, duracion_minutos FROM turnos 
       WHERE sede_id = (SELECT id FROM sedes WHERE slug = $1)
       AND fecha_turno = $2::date
       AND estado IN ('espera', 'atendiendo', 'completado', 'pendiente_confirmacion')`,
      [req.params.slug, fecha],
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al consultar reservas' })
  }
})

app.get('/api/turnos', async (req, res) => {
  const documento = normDoc(req.query.documento)
  if (documento.length < 5) {
    return res.json([])
  }
  try {
    const { rows } = await pool.query(
      `
      SELECT t.id, t.numero_publico AS numero, s.nombre AS sede,
        to_char(t.fecha_turno, 'DD/MM/YYYY') || ' · ' || to_char(t.hora_turno, 'HH24:MI') AS fecha_hora,
        t.estado
      FROM turnos t
      JOIN sedes s ON s.id = t.sede_id
      WHERE t.documento_norm = $1
        AND t.estado IN ('espera', 'atendiendo', 'pendiente_confirmacion')
      ORDER BY t.fecha_turno DESC, t.hora_turno DESC
      LIMIT 20
    `,
      [documento],
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al consultar turnos' })
  }
})

/** Reserva turno (pendiente) + código; evita duplicados por doc/sede/día e idempotency */
app.post('/api/turnos/reservar', async (req, res) => {
  const {
    sedeSlug,
    documento,
    nombre,
    apellido,
    telefono,
    fechaTurno,
    horaTurno,
    duracionMinutos,
    planId,
    prioridad,
    triageUrgenciaVital,
    triageEfectivo,
    modoHibrido,
    respuestasExtra,
    idempotencyKey,
  } = req.body || {}

  if (!sedeSlug || !documento || !nombre || !telefono || !fechaTurno || !horaTurno) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' })
  }

  const docN = normDoc(documento)
  if (docN.length < 5) {
    return res.status(400).json({ error: 'Documento inválido' })
  }

  const client = await pool.connect()
  try {
    const sedeR = await client.query('SELECT * FROM sedes WHERE slug = $1', [sedeSlug])
    if (!sedeR.rows.length) {
      return res.status(404).json({ error: 'Sede no encontrada' })
    }
    const sede = sedeR.rows[0]

    // Validar horario de atención
    const now = new Date()
    // Ajustar a hora local (Colombia UTC-5 si es necesario, pero asumiendo hora del sistema)
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
    const todayStr = now.toISOString().slice(0, 10)

    if (horaTurno < sede.hora_apertura || horaTurno > sede.hora_cierre) {
      return res.status(400).json({
        error: `La hora seleccionada (${horaTurno}) está fuera del horario de atención (${sede.hora_apertura} - ${sede.hora_cierre})`,
      })
    }

    if (fechaTurno === todayStr) {
      if (currentTimeStr < sede.hora_apertura || currentTimeStr > sede.hora_cierre) {
        return res.status(400).json({
          error: `La sede está cerrada en este momento. Horario: ${sede.hora_apertura} - ${sede.hora_cierre}`,
        })
      }
    }

    if (sede.tipo === 'eps' && triageUrgenciaVital === true) {
      return res.status(400).json({
        error: 'Derivación a urgencias',
        codigo: 'URGENCIA_VITAL',
      })
    }

    if (idempotencyKey) {
      const ex = await client.query(
        `SELECT id, codigo_seguro, estado FROM turnos WHERE idempotency_key = $1`,
        [idempotencyKey],
      )
      if (ex.rows.length) {
        const t = ex.rows[0]
        return res.status(200).json({
          id: t.id,
          numeroPublico: null,
          codigoSeguro: t.codigo_seguro,
          estado: t.estado,
          duplicadoEvitado: true,
        })
      }
    }

    const { rows: preguntas } = await client.query(
      `
      SELECT key, label, type, options_json
      FROM empresa_preguntas
      WHERE empresa_id = $1 AND active = true
      ORDER BY orden ASC, id ASC
    `,
      [sede.empresa_id],
    )

    const respuestasInput =
      respuestasExtra && typeof respuestasExtra === 'object' && !Array.isArray(respuestasExtra)
        ? respuestasExtra
        : {}
    
    // Guardamos todas las respuestas extra por defecto (flexibilidad para simuladores)
    const respuestasGuardadas = { ...respuestasInput }
    
    // Pero validamos estrictamente las que estén configuradas en la DB
    for (const q of preguntas) {
      const v = respuestasInput[q.key]
      if (q.type === 'bool') {
        if (typeof v !== 'boolean') {
          return res.status(400).json({ error: `Respuesta requerida: ${q.label}` })
        }
        respuestasGuardadas[q.key] = v
      } else if (q.type === 'dropdown') {
        const opts = Array.isArray(q.options_json) ? q.options_json : []
        if (typeof v !== 'string' || !opts.includes(v)) {
          return res.status(400).json({ error: `Respuesta inválida: ${q.label}` })
        }
        respuestasGuardadas[q.key] = v
      } else if (q.type === 'scale10') {
        const n = Number(v)
        const ok = Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 10
        if (!ok) {
          return res.status(400).json({ error: `Respuesta inválida: ${q.label}` })
        }
        respuestasGuardadas[q.key] = n
      }
    }

    const dup = await client.query(
      `
      SELECT id FROM turnos
      WHERE sede_id = $1 AND fecha_turno = $2::date AND documento_norm = $3
        AND estado IN ('pendiente_confirmacion', 'espera', 'atendiendo')
      LIMIT 1
    `,
      [sede.id, fechaTurno, docN],
    )
    if (dup.rows.length) {
      return res.status(409).json({
        error: 'Ya tenés un turno activo este día en esta sede',
        turnoExistenteId: dup.rows[0].id,
      })
    }

    await client.query('BEGIN')

    const maxOrden = await client.query(
      `SELECT COALESCE(MAX(orden_atencion), 0)::int AS m FROM turnos
       WHERE sede_id = $1 AND fecha_turno = $2::date AND estado IN ('espera', 'pendiente_confirmacion')`,
      [sede.id, fechaTurno],
    )
    const orden = maxOrden.rows[0].m + 1

    const n = Math.floor(1 + Math.random() * 98)
    const pref = 'R'
    const numeroPublico = `${pref}-${String(n).padStart(2, '0')}`

    let codigo = randomCodigo()
    for (let k = 0; k < 8; k++) {
      const c = await client.query(
        `SELECT 1 FROM turnos WHERE sede_id = $1 AND fecha_turno = $2::date AND codigo_seguro = $3`,
        [sede.id, fechaTurno, codigo],
      )
      if (!c.rowCount) break
      codigo = randomCodigo()
    }

    const ins = await client.query(
      `
      INSERT INTO turnos (
        sede_id, numero_publico, documento, documento_norm, nombre, apellido, telefono,
        fecha_turno, hora_turno, duracion_minutos, plan_id, prioridad, triage_urgencia_vital, triage_efectivo,
        modo_hibrido, estado, orden_atencion, codigo_seguro, idempotency_key, respuestas_extra
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::time,$10,$11,$12,$13,$14,$15,'pendiente_confirmacion',$16,$17,$18,$19::jsonb)
      RETURNING id, numero_publico, orden_atencion, codigo_seguro
    `,
      [
        sede.id,
        numeroPublico,
        documento,
        docN,
        nombre.trim(),
        apellido?.trim() || null,
        telefono,
        fechaTurno,
        horaTurno,
        duracionMinutos || 15,
        planId || null,
        prioridad || 'ninguna',
        triageUrgenciaVital ?? null,
        triageEfectivo ?? null,
        modoHibrido !== false,
        orden,
        codigo,
        idempotencyKey || null,
        JSON.stringify(respuestasGuardadas),
      ],
    )

    await client.query('COMMIT')
    res.status(201).json({
      id: ins.rows[0].id,
      numeroPublico: ins.rows[0].numero_publico,
      ordenAtencion: ins.rows[0].orden_atencion,
      codigoSeguro: ins.rows[0].codigo_seguro,
      estado: 'pendiente_confirmacion',
    })
  } catch (e) {
    await client.query('ROLLBACK')
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Turno duplicado o sesión repetida' })
    }
    console.error(e)
    res.status(500).json({ error: 'No se pudo reservar el turno' })
  } finally {
    client.release()
  }
})

app.post('/api/turnos/:id/confirmar', async (req, res) => {
  const { codigo } = req.body || {}
  const c = String(codigo || '').replace(/\D/g, '')
  if (c.length !== 4) {
    return res.status(400).json({ error: 'Código de 4 dígitos requerido' })
  }
  try {
    const u = await pool.query(
      `
      UPDATE turnos SET estado = 'espera'
      WHERE id = $1::uuid AND estado = 'pendiente_confirmacion' AND codigo_seguro = $2
      RETURNING id, numero_publico
    `,
      [req.params.id, c],
    )
    if (!u.rowCount) {
      return res.status(400).json({ error: 'Código incorrecto o turno ya confirmado' })
    }
    res.json({ ok: true, numeroPublico: u.rows[0].numero_publico })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al confirmar' })
  }
})

app.get('/api/turnos/:id/fila', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        t.id,
        t.numero_publico,
        t.estado,
        t.orden_atencion,
        t.fecha_turno,
        s.slug AS sede_slug,
        s.nombre AS sede_nombre,
        s.turno_atendiendo,
        s.personas_fila_estimado,
        (SELECT COUNT(*)::int FROM turnos t2
         WHERE t2.sede_id = t.sede_id
           AND t2.fecha_turno = t.fecha_turno
           AND t2.estado = 'espera'
           AND t2.orden_atencion < t.orden_atencion) AS faltan
      FROM turnos t
      JOIN sedes s ON s.id = t.sede_id
      WHERE t.id = $1::uuid
    `,
      [req.params.id],
    )
    if (!rows.length) return res.status(404).json({ error: 'Turno no encontrado' })
    const row = rows[0]
    const minPorPersona = 5
    res.json({
      faltan: row.faltan,
      estimadoMinutos: Math.max(0, row.faltan * minPorPersona),
      numeroPublico: row.numero_publico,
      estado: row.estado,
      turnoAtendiendo: row.turno_atendiendo,
      sedeNombre: row.sede_nombre,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al consultar la fila' })
  }
})

app.patch('/api/turnos/:id/cancel', async (req, res) => {
  const { codigo } = req.body || {}
  const c = String(codigo || '').replace(/\D/g, '')
  if (c.length !== 4) {
    return res.status(400).json({ error: 'Código de 4 dígitos requerido' })
  }
  try {
    const u = await pool.query(
      `UPDATE turnos SET estado = 'cancelado'
       WHERE id = $1::uuid AND codigo_seguro = $2
         AND estado IN ('pendiente_confirmacion', 'espera')
       RETURNING id`,
      [req.params.id, c],
    )
    if (!u.rowCount) return res.status(400).json({ error: 'Código incorrecto o turno no cancelable' })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al cancelar' })
  }
})

app.patch('/api/turnos/:id/checkin', async (req, res) => {
  const metodo = req.body?.metodo === 'qr' ? 'qr' : 'gps'
  const { codigo } = req.body || {}
  const c = String(codigo || '').replace(/\D/g, '')
  if (c.length !== 4) {
    return res.status(400).json({ error: 'Código de 4 dígitos requerido' })
  }
  try {
    const u = await pool.query(
      `UPDATE turnos SET checkin_completado = true, checkin_metodo = $3
       WHERE id = $1::uuid AND codigo_seguro = $2 AND estado = 'espera' RETURNING id`,
      [req.params.id, c, metodo],
    )
    if (!u.rowCount) return res.status(400).json({ error: 'Código incorrecto o turno no válido' })
    res.json({ ok: true, metodo })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error en check-in' })
  }
})

app.post('/api/turnos/:id/retraso', async (req, res) => {
  const { codigo, opcion } = req.body || {}
  const c = String(codigo || '').replace(/\D/g, '')
  const pasos = Number(opcion) === 5 ? 5 : 3
  if (c.length !== 4) {
    return res.status(400).json({ error: 'Código de 4 dígitos requerido' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const tr = await client.query(
      `SELECT * FROM turnos WHERE id = $1::uuid AND codigo_seguro = $2 AND estado = 'espera'`,
      [req.params.id, c],
    )
    if (!tr.rows.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Código incorrecto o turno no en espera' })
    }
    const t = tr.rows[0]
    const { rows: cola } = await client.query(
      `SELECT id, orden_atencion FROM turnos
       WHERE sede_id = $1 AND fecha_turno = $2::date AND estado = 'espera'
       ORDER BY orden_atencion ASC`,
      [t.sede_id, t.fecha_turno],
    )
    const idx = cola.findIndex((r) => r.id === t.id)
    if (idx < 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Turno no en cola' })
    }
    const newIdx = Math.min(idx + pasos, cola.length - 1)
    if (newIdx === idx) {
      await client.query('ROLLBACK')
      return res.json({ ok: true, mensaje: 'Ya estás al final de la fila' })
    }
    const arr = [...cola]
    const [mov] = arr.splice(idx, 1)
    arr.splice(newIdx, 0, mov)
    for (let i = 0; i < arr.length; i++) {
      await client.query(`UPDATE turnos SET orden_atencion = $1 WHERE id = $2::uuid`, [
        i + 1,
        arr[i].id,
      ])
    }
    await client.query(
      `UPDATE turnos SET retrasos_aplicados = COALESCE(retrasos_aplicados,0) + 1 WHERE id = $1::uuid`,
      [t.id],
    )
    await client.query('COMMIT')
    res.json({ ok: true, nuevaPosicion: newIdx + 1, pasosMovidos: newIdx - idx })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({ error: 'Error al aplicar retraso' })
  } finally {
    client.release()
  }
})

app.get(
  '/api/panel/empresa',
  authMiddleware,
  async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM empresas WHERE id = $1`, [
        req.staff.empresaId,
      ])
      if (!rows.length) return res.status(404).json({ error: 'Empresa no encontrada' })
      const e = rows[0]
      const { rows: sedes } = await pool.query(
        `SELECT * FROM sedes WHERE empresa_id = $1 ORDER BY nombre`,
        [e.id],
      )
      res.json({
        empresa: { id: e.id, nombre: e.nombre, slug: e.slug, tipo: e.tipo },
        sedes: sedes.map(mapSede),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Error' })
    }
  },
)

app.get(
  '/api/panel/empresa/resumen',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const fecha = req.query.fecha || new Date().toISOString().slice(0, 10)
      const { rows: sedes } = await pool.query(
        `SELECT id, slug, nombre FROM sedes WHERE empresa_id = $1`,
        [req.staff.empresaId],
      )
      const ids = sedes.map((s) => s.id)
      if (!ids.length) return res.json({ fecha, sedes: [], totales: {} })

      const stats = await pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE estado = 'espera')::int AS en_espera,
          COUNT(*) FILTER (WHERE estado = 'pendiente_confirmacion')::int AS pendientes,
          COUNT(*) FILTER (WHERE estado = 'atendiendo')::int AS atendiendo,
          COUNT(*) FILTER (WHERE estado = 'completado')::int AS completados,
          COUNT(*) FILTER (WHERE estado = 'cancelado')::int AS cancelados,
          COUNT(*) FILTER (WHERE triage_urgencia_vital = true)::int AS triage_urgencia,
          COUNT(*) FILTER (WHERE triage_efectivo = true)::int AS triage_efectivo
        FROM turnos t
        JOIN sedes s ON s.id = t.sede_id
        WHERE s.empresa_id = $1 AND t.fecha_turno = $2::date
      `,
        [req.staff.empresaId, fecha],
      )

      const porSede = await pool.query(
        `
        SELECT s.slug, s.nombre,
          COUNT(*) FILTER (WHERE t.estado = 'espera')::int AS espera
        FROM sedes s
        LEFT JOIN turnos t ON t.sede_id = s.id AND t.fecha_turno = $2::date
        WHERE s.empresa_id = $1
        GROUP BY s.id, s.slug, s.nombre
        ORDER BY s.nombre
      `,
        [req.staff.empresaId, fecha],
      )

      res.json({
        fecha,
        totales: stats.rows[0],
        porSede: porSede.rows,
        sedes: sedes,
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Error de estadísticas' })
    }
  },
)

app.get('/api/panel/preguntas', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, key, label, type, options_json, orden, active
      FROM empresa_preguntas
      WHERE empresa_id = $1
      ORDER BY orden ASC, id ASC
    `,
      [req.staff.empresaId],
    )
    res.json(
      rows.map((r) => ({
        id: r.id,
        key: r.key,
        label: r.label,
        type: r.type,
        options: r.options_json,
        orden: r.orden,
        active: r.active === true,
      })),
    )
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar preguntas' })
  }
})

app.post('/api/panel/preguntas', authMiddleware, requireAdmin, async (req, res) => {
  const label = String(req.body?.label || '').trim()
  const type = req.body?.type
  const keyRaw = req.body?.key
  const orden = req.body?.orden != null ? Number(req.body.orden) : 0
  const active = req.body?.active !== false

  const key = normSlug(keyRaw != null ? keyRaw : label)
  if (!key || !label || !['bool', 'dropdown', 'scale10'].includes(type)) {
    return res.status(400).json({ error: 'Datos inválidos' })
  }

  let options = []
  if (type === 'dropdown') {
    const raw = Array.isArray(req.body?.options) ? req.body.options : []
    options = raw.map((x) => String(x || '').trim()).filter(Boolean)
    if (!options.length) return res.status(400).json({ error: 'Opciones requeridas' })
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO empresa_preguntas (empresa_id, key, label, type, options_json, orden, active)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      RETURNING id, key, label, type, options_json, orden, active
    `,
      [req.staff.empresaId, key, label, type, JSON.stringify(options), orden || 0, active],
    )
    const r = rows[0]
    res.status(201).json({
      id: r.id,
      key: r.key,
      label: r.label,
      type: r.type,
      options: r.options_json,
      orden: r.orden,
      active: r.active === true,
    })
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Key ya existe' })
    console.error(e)
    res.status(500).json({ error: 'Error al crear pregunta' })
  }
})

app.patch('/api/panel/preguntas/:id', authMiddleware, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const { rows: cur } = await pool.query(
      `SELECT * FROM empresa_preguntas WHERE id = $1 AND empresa_id = $2`,
      [id, req.staff.empresaId],
    )
    if (!cur.length) return res.status(404).json({ error: 'Pregunta no encontrada' })
    const q = cur[0]

    const label = req.body?.label != null ? String(req.body.label || '').trim() : q.label
    const type = req.body?.type != null ? req.body.type : q.type
    const key = req.body?.key != null ? normSlug(req.body.key) : q.key
    const orden = req.body?.orden != null ? Number(req.body.orden) : q.orden
    const active = req.body?.active != null ? req.body.active === true : q.active === true

    if (!key || !label || !['bool', 'dropdown', 'scale10'].includes(type)) {
      return res.status(400).json({ error: 'Datos inválidos' })
    }

    let options = q.options_json ?? []
    if (type === 'dropdown') {
      const raw = req.body?.options != null ? req.body.options : options
      options = Array.isArray(raw) ? raw.map((x) => String(x || '').trim()).filter(Boolean) : []
      if (!options.length) return res.status(400).json({ error: 'Opciones requeridas' })
    } else {
      options = []
    }

    const { rows } = await pool.query(
      `
      UPDATE empresa_preguntas
      SET key = $3, label = $4, type = $5, options_json = $6::jsonb, orden = $7, active = $8
      WHERE id = $1 AND empresa_id = $2
      RETURNING id, key, label, type, options_json, orden, active
    `,
      [
        id,
        req.staff.empresaId,
        key,
        label,
        type,
        JSON.stringify(options),
        Number.isFinite(orden) ? orden : 0,
        active,
      ],
    )
    const r = rows[0]
    res.json({
      id: r.id,
      key: r.key,
      label: r.label,
      type: r.type,
      options: r.options_json,
      orden: r.orden,
      active: r.active === true,
    })
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Key ya existe' })
    console.error(e)
    res.status(500).json({ error: 'Error al actualizar pregunta' })
  }
})

app.delete('/api/panel/preguntas/:id', authMiddleware, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const d = await pool.query(
      `DELETE FROM empresa_preguntas WHERE id = $1 AND empresa_id = $2 RETURNING id`,
      [id, req.staff.empresaId],
    )
    if (!d.rowCount) return res.status(404).json({ error: 'Pregunta no encontrada' })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al eliminar pregunta' })
  }
})

app.get(
  '/api/panel/cola/:slug',
  authMiddleware,
  async (req, res) => {
    try {
      const fecha = req.query.fecha || new Date().toISOString().slice(0, 10)
      const { rows: sede } = await pool.query(
        `SELECT * FROM sedes WHERE slug = $1 AND empresa_id = $2`,
        [req.params.slug, req.staff.empresaId],
      )
      if (!sede.length) return res.status(404).json({ error: 'Sede no encontrada' })
      const s = sede[0]
      const { rows: turnos } = await pool.query(
        `
        SELECT id, numero_publico, nombre, apellido, documento_norm, hora_turno,
          estado, orden_atencion, prioridad, triage_efectivo, triage_urgencia_vital,
          checkin_completado, modo_hibrido, retrasos_aplicados
        FROM turnos
        WHERE sede_id = $1 AND fecha_turno = $2::date
          AND estado IN ('espera', 'atendiendo', 'pendiente_confirmacion')
        ORDER BY orden_atencion ASC
      `,
        [s.id, fecha],
      )
      res.json({
        sede: mapSede(s),
        fecha,
        turnos,
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Error al cargar cola' })
    }
  },
)

app.patch(
  '/api/panel/turno/:id/atender',
  authMiddleware,
  async (req, res) => {
    try {
      const { rows: t } = await pool.query(
        `SELECT t.* FROM turnos t JOIN sedes s ON s.id = t.sede_id
         WHERE t.id = $1::uuid AND s.empresa_id = $2`,
        [req.params.id, req.staff.empresaId],
      )
      if (!t.length) return res.status(404).json({ error: 'Turno no encontrado' })
      await pool.query(
        `UPDATE turnos SET estado = 'atendiendo' WHERE id = $1::uuid AND estado = 'espera'`,
        [req.params.id],
      )
      await logActividad(req.staff.sid, req.staff.empresaId, 'ATENDER_TURNO', `Turno ${t[0].numero_publico} atendiendo`)
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Error' })
    }
  },
)

app.patch(
  '/api/panel/turno/:id/completar',
  authMiddleware,
  async (req, res) => {
    try {
      const { rows: t } = await pool.query(
        `SELECT t.id, t.numero_publico FROM turnos t JOIN sedes s ON s.id = t.sede_id
         WHERE t.id = $1::uuid AND s.empresa_id = $2`,
        [req.params.id, req.staff.empresaId],
      )
      if (!t.length) return res.status(404).json({ error: 'Turno no encontrado' })
      await pool.query(`UPDATE turnos SET estado = 'completado' WHERE id = $1::uuid`, [
        req.params.id,
      ])
      await logActividad(req.staff.sid, req.staff.empresaId, 'COMPLETE_TURNO', `Turno ${t[0].numero_publico} completado`)
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Error' })
    }
  },
)

app.patch(
  '/api/panel/turno/:id/adelantar',
  authMiddleware,
  async (req, res) => {
    try {
      const { rows: t } = await pool.query(
        `SELECT t.id, t.numero_publico, t.sede_id, t.fecha_turno, t.orden_atencion 
         FROM turnos t JOIN sedes s ON s.id = t.sede_id
         WHERE t.id = $1::uuid AND s.empresa_id = $2`,
        [req.params.id, req.staff.empresaId],
      )
      if (!t.length) return res.status(404).json({ error: 'Turno no encontrado' })
      const turno = t[0]

      // Buscar el turno inmediatamente anterior en la cola
      const { rows: anterior } = await pool.query(
        `SELECT id, orden_atencion FROM turnos 
         WHERE sede_id = $1 AND fecha_turno = $2 AND orden_atencion < $3 AND estado = 'espera'
         ORDER BY orden_atencion DESC LIMIT 1`,
        [turno.sede_id, turno.fecha_turno, turno.orden_atencion]
      )

      if (anterior.length) {
        const targetOrden = anterior[0].orden_atencion
        // Intercambiar orden_atencion
        await pool.query('BEGIN')
        await pool.query(`UPDATE turnos SET orden_atencion = $1 WHERE id = $2`, [turno.orden_atencion, anterior[0].id])
        await pool.query(`UPDATE turnos SET orden_atencion = $1 WHERE id = $2`, [targetOrden, turno.id])
        await pool.query('COMMIT')
        await logActividad(req.staff.sid, req.staff.empresaId, 'ADELANTAR_TURNO', `Turno ${turno.numero_publico} adelantado`)
      }

      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Error al adelantar turno' })
    }
  },
)

app.patch(
  '/api/panel/turno/:id/cancelar',
  authMiddleware,
  async (req, res) => {
    try {
      const { rows: t } = await pool.query(
        `SELECT t.id, t.numero_publico FROM turnos t JOIN sedes s ON s.id = t.sede_id
         WHERE t.id = $1::uuid AND s.empresa_id = $2`,
        [req.params.id, req.staff.empresaId],
      )
      if (!t.length) return res.status(404).json({ error: 'Turno no encontrado' })
      await pool.query(`UPDATE turnos SET estado = 'cancelado' WHERE id = $1::uuid`, [
        req.params.id,
      ])
      await logActividad(req.staff.sid, req.staff.empresaId, 'CANCEL_TURNO', `Turno ${t[0].numero_publico} cancelado`)
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Error' })
    }
  },
)

app.get('/api/panel/turnos-empresa', authMiddleware, async (req, res) => {
  const { fecha } = req.query
  try {
    const { rows } = await pool.query(
      `SELECT t.*, s.nombre as sede_nombre, s.slug as sede_slug
       FROM turnos t
       JOIN sedes s ON s.id = t.sede_id
       WHERE s.empresa_id = $1 ${fecha ? 'AND t.fecha_turno = $2::date' : ''}
       ORDER BY t.hora_turno ASC`,
      fecha ? [req.staff.empresaId, fecha] : [req.staff.empresaId]
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al cargar turnos de la empresa' })
  }
})

app.get('/api/supremo/empresas', authMiddleware, requireSupremo, async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM empresas ORDER BY nombre`)
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar empresas' })
  }
})

/** Reserva turno público para DETAIM (simulador) */
app.post('/api/turnos-publico', async (req, res) => {
  const {
    lugar_id,
    nombre,
    telefono,
    fecha_turno,
    hora_turno,
    plan_id,
    respuestasExtra,
    idempotencyKey,
  } = req.body || {}

  if (!lugar_id || !nombre || !telefono || !fecha_turno || !hora_turno) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' })
  }

  const client = await pool.connect()
  try {
    const sedeR = await client.query(
      'SELECT * FROM sedes WHERE slug = $1 OR (CASE WHEN $1 ~ \'^[0-9]+$\' THEN id = $1::int ELSE false END) OR slug = \'detaim-cajica\'',
      [String(lugar_id)]
    )
    if (!sedeR.rows.length) {
      return res.status(404).json({ error: 'Sede no encontrada' })
    }
    const sede = sedeR.rows[0]

    if (idempotencyKey) {
      const ex = await client.query(
        `SELECT id, numero_publico, codigo_seguro, estado FROM turnos WHERE idempotency_key = $1`,
        [idempotencyKey],
      )
      if (ex.rows.length) {
        const t = ex.rows[0]
        return res.json({
          id: t.id,
          numero_turno: t.numero_publico,
          codigo_seguridad: t.codigo_seguro,
          estado: t.estado,
        })
      }
    }

    await client.query('BEGIN')

    const maxOrden = await client.query(
      `SELECT COALESCE(MAX(orden_atencion), 0)::int AS m FROM turnos
       WHERE sede_id = $1 AND fecha_turno = $2::date`,
      [sede.id, fecha_turno],
    )
    const orden = maxOrden.rows[0].m + 1

    const n = Math.floor(1 + Math.random() * 99)
    const numero_publico = `T-${String(n).padStart(2, '0')}`

    let codigo = randomCodigo()
    
    // Obtener duración del plan desde la DB
    const planRes = await client.query('SELECT minutos FROM planes WHERE id = $1', [plan_id])
    const duracion = planRes.rows[0]?.minutos || 15

    const ins = await client.query(
      `
      INSERT INTO turnos (
        sede_id, numero_publico, documento, documento_norm, nombre, telefono,
        fecha_turno, hora_turno, duracion_minutos, plan_id, estado, orden_atencion, 
        codigo_seguro, idempotency_key, respuestas_extra
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8::time,$9,$10,'pendiente_confirmacion',$11,$12,$13,$14::jsonb)
      RETURNING id, numero_publico, codigo_seguro
    `,
      [
        sede.id,
        numero_publico,
        'PUBL-000', // Documento genérico para público
        '000',
        nombre.trim(),
        telefono,
        fecha_turno,
        hora_turno,
        duracion,
        plan_id,
        orden,
        codigo,
        idempotencyKey || null,
        JSON.stringify(respuestasExtra || {}),
      ],
    )

    await client.query('COMMIT')
    res.status(201).json({
      id: ins.rows[0].id,
      numero_turno: ins.rows[0].numero_publico,
      codigo_seguridad: ins.rows[0].codigo_seguro,
      estado: 'pendiente_confirmacion',
    })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({ error: 'No se pudo procesar la reserva' })
  } finally {
    client.release()
  }
})

app.post('/api/turnos/:id/confirmar-publico', async (req, res) => {
  const { codigo } = req.body || {}
  if (!codigo) return res.status(400).json({ error: 'Código requerido' })
  try {
    const u = await pool.query(
      `UPDATE turnos SET estado = 'espera'
       WHERE id = $1::uuid AND estado = 'pendiente_confirmacion' AND codigo_seguro = $2
       RETURNING id, numero_publico`,
      [req.params.id, codigo],
    )
    if (!u.rowCount) {
      return res.status(400).json({ error: 'Código incorrecto o turno no válido' })
    }
    res.json({ ok: true, numero_turno: u.rows[0].numero_publico })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al confirmar' })
  }
})

app.post('/api/supremo/empresas', authMiddleware, requireSupremo, async (req, res) => {
  const slug = normSlug(req.body?.slug)
  const nombre = String(req.body?.nombre || '').trim()
  const tipo = req.body?.tipo
  const logo_url = req.body?.logo_url ? String(req.body.logo_url).trim() : null
  const color_hex = req.body?.color_hex ? String(req.body.color_hex).trim() : '#000000'

  if (!slug || !nombre || !['eps', 'banco', 'general', 'clinica', 'notaria', 'gimnasio'].includes(tipo)) {
    return res.status(400).json({ error: 'Datos inválidos' })
  }
  if (slug === 'kivo-core') return res.status(400).json({ error: 'Slug reservado' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO empresas (slug, nombre, tipo, logo_url, color_hex) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [slug, nombre, tipo, logo_url, color_hex],
    )
    res.status(201).json(rows[0])
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Slug ya existe' })
    console.error(e)
    res.status(500).json({ error: 'Error al crear empresa' })
  }
})

app.patch('/api/supremo/empresas/:id', authMiddleware, requireSupremo, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const { rows: cur } = await pool.query(`SELECT * FROM empresas WHERE id = $1`, [id])
    if (!cur.length) return res.status(404).json({ error: 'Empresa no encontrada' })
    if (cur[0].slug === 'kivo-core') return res.status(400).json({ error: 'Empresa reservada' })

    const slug = req.body?.slug != null ? normSlug(req.body.slug) : cur[0].slug
    const nombre = req.body?.nombre != null ? String(req.body.nombre || '').trim() : cur[0].nombre
    const tipo = req.body?.tipo != null ? req.body.tipo : cur[0].tipo
    const logo_url = req.body?.logo_url != null ? String(req.body.logo_url || '').trim() : cur[0].logo_url
    const color_hex = req.body?.color_hex != null ? String(req.body.color_hex || '').trim() : cur[0].color_hex

    if (!slug || !nombre || !['eps', 'banco', 'general', 'clinica', 'notaria', 'gimnasio'].includes(tipo)) {
      return res.status(400).json({ error: 'Datos inválidos' })
    }
    if (slug === 'kivo-core') return res.status(400).json({ error: 'Slug reservado' })

    const { rows } = await pool.query(
      `UPDATE empresas SET slug = $2, nombre = $3, tipo = $4, logo_url = $5, color_hex = $6 WHERE id = $1 RETURNING *`,
      [id, slug, nombre, tipo, logo_url, color_hex],
    )
    res.json(rows[0])
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Slug ya existe' })
    console.error(e)
    res.status(500).json({ error: 'Error al actualizar empresa' })
  }
})

app.delete('/api/supremo/empresas/:id', authMiddleware, requireSupremo, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: cur } = await client.query(`SELECT slug FROM empresas WHERE id = $1`, [id])
    if (!cur.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Empresa no encontrada' })
    }
    if (cur[0].slug === 'kivo-core') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Empresa reservada' })
    }
    await client.query(`DELETE FROM staff WHERE empresa_id = $1`, [id])
    await client.query(`DELETE FROM sedes WHERE empresa_id = $1`, [id])
    await client.query(`DELETE FROM empresas WHERE id = $1`, [id])
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({ error: 'Error al eliminar empresa' })
  } finally {
    client.release()
  }
})

app.get('/api/supremo/sedes', authMiddleware, requireSupremo, async (req, res) => {
  const empresaId = req.query.empresaId ? Number(req.query.empresaId) : null
  if (req.query.empresaId && !Number.isFinite(empresaId)) {
    return res.status(400).json({ error: 'empresaId inválido' })
  }
  try {
    const { rows } = await pool.query(
      empresaId
        ? `SELECT * FROM sedes WHERE empresa_id = $1 ORDER BY nombre`
        : `SELECT * FROM sedes ORDER BY nombre`,
      empresaId ? [empresaId] : [],
    )
    res.json(rows.map(mapSede))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar sedes' })
  }
})

app.post('/api/supremo/sedes', authMiddleware, requireSupremo, async (req, res) => {
  const empresaId = Number(req.body?.empresaId)
  const slug = normSlug(req.body?.slug)
  const nombre = String(req.body?.nombre || '').trim()
  const direccion = String(req.body?.direccion || '').trim()
  const horaApertura = String(req.body?.horaApertura || '').trim()
  const horaCierre = String(req.body?.horaCierre || '').trim()
  const lat = Number(req.body?.lat)
  const lng = Number(req.body?.lng)
  const tipo = req.body?.tipo
  const personasFilaEstimado = req.body?.personasFilaEstimado ?? 0
  const turnoAtendiendo = String(req.body?.turnoAtendiendo || 'A-01').trim()
  const geocercaMetros = req.body?.geocercaMetros ?? 200

  if (
    !Number.isFinite(empresaId) ||
    !slug ||
    !nombre ||
    !direccion ||
    !horaApertura ||
    !horaCierre ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !['general', 'eps', 'banco'].includes(tipo)
  ) {
    return res.status(400).json({ error: 'Datos inválidos' })
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO sedes
        (slug, nombre, direccion, hora_apertura, hora_cierre, lat, lng, tipo,
         personas_fila_estimado, turno_atendiendo, geocerca_metros, empresa_id)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `,
      [
        slug,
        nombre,
        direccion,
        horaApertura,
        horaCierre,
        lat,
        lng,
        tipo,
        Number(personasFilaEstimado) || 0,
        turnoAtendiendo,
        Number(geocercaMetros) || 200,
        empresaId,
      ],
    )
    res.status(201).json(mapSede(rows[0]))
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Slug ya existe' })
    console.error(e)
    res.status(500).json({ error: 'Error al crear sede' })
  }
})

app.patch('/api/supremo/sedes/:id', authMiddleware, requireSupremo, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const { rows: cur } = await pool.query(`SELECT * FROM sedes WHERE id = $1`, [id])
    if (!cur.length) return res.status(404).json({ error: 'Sede no encontrada' })
    const s = cur[0]

    const slug = req.body?.slug != null ? normSlug(req.body.slug) : s.slug
    const nombre = req.body?.nombre != null ? String(req.body.nombre || '').trim() : s.nombre
    const direccion =
      req.body?.direccion != null ? String(req.body.direccion || '').trim() : s.direccion
    const horaApertura =
      req.body?.horaApertura != null ? String(req.body.horaApertura || '').trim() : s.hora_apertura
    const horaCierre =
      req.body?.horaCierre != null ? String(req.body.horaCierre || '').trim() : s.hora_cierre
    const lat = req.body?.lat != null ? Number(req.body.lat) : Number(s.lat)
    const lng = req.body?.lng != null ? Number(req.body.lng) : Number(s.lng)
    const tipo = req.body?.tipo != null ? req.body.tipo : s.tipo
    const personasFilaEstimado =
      req.body?.personasFilaEstimado != null
        ? Number(req.body.personasFilaEstimado) || 0
        : s.personas_fila_estimado
    const turnoAtendiendo =
      req.body?.turnoAtendiendo != null ? String(req.body.turnoAtendiendo || '').trim() : s.turno_atendiendo
    const geocercaMetros =
      req.body?.geocercaMetros != null ? Number(req.body.geocercaMetros) || 200 : s.geocerca_metros
    const empresaId = req.body?.empresaId != null ? Number(req.body.empresaId) : s.empresa_id

    if (
      !slug ||
      !nombre ||
      !direccion ||
      !horaApertura ||
      !horaCierre ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !['general', 'eps', 'banco'].includes(tipo) ||
      !Number.isFinite(empresaId)
    ) {
      return res.status(400).json({ error: 'Datos inválidos' })
    }

    const { rows } = await pool.query(
      `
      UPDATE sedes SET
        slug = $2,
        nombre = $3,
        direccion = $4,
        hora_apertura = $5,
        hora_cierre = $6,
        lat = $7,
        lng = $8,
        tipo = $9,
        personas_fila_estimado = $10,
        turno_atendiendo = $11,
        geocerca_metros = $12,
        empresa_id = $13
      WHERE id = $1
      RETURNING *
    `,
      [
        id,
        slug,
        nombre,
        direccion,
        horaApertura,
        horaCierre,
        lat,
        lng,
        tipo,
        personasFilaEstimado,
        turnoAtendiendo,
        geocercaMetros,
        empresaId,
      ],
    )
    res.json(mapSede(rows[0]))
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Slug ya existe' })
    console.error(e)
    res.status(500).json({ error: 'Error al actualizar sede' })
  }
})

app.delete('/api/supremo/sedes/:id', authMiddleware, requireSupremo, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const d = await pool.query(`DELETE FROM sedes WHERE id = $1 RETURNING id`, [id])
    if (!d.rowCount) return res.status(404).json({ error: 'Sede no encontrada' })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al eliminar sede' })
  }
})

app.get('/api/supremo/staff', authMiddleware, requireSupremo, async (req, res) => {
  const empresaId = req.query.empresaId ? Number(req.query.empresaId) : null
  if (req.query.empresaId && !Number.isFinite(empresaId)) {
    return res.status(400).json({ error: 'empresaId inválido' })
  }
  try {
    const { rows } = await pool.query(
      empresaId
        ? `SELECT id, email, role, empresa_id, is_supremo FROM staff WHERE empresa_id = $1 ORDER BY email`
        : `SELECT id, email, role, empresa_id, is_supremo FROM staff ORDER BY email`,
      empresaId ? [empresaId] : [],
    )
    res.json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        empresaId: r.empresa_id,
        isSupremo: r.is_supremo === true,
      })),
    )
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar staff' })
  }
})

app.post('/api/supremo/staff', authMiddleware, requireSupremo, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim()
  const password = req.body?.password
  const role = req.body?.role
  const empresaId = Number(req.body?.empresaId)
  if (!email || !password || !['admin', 'asesor'].includes(role) || !Number.isFinite(empresaId)) {
    return res.status(400).json({ error: 'Datos inválidos' })
  }
  try {
    const ph = hashPassword(password)
    const { rows } = await pool.query(
      `
      INSERT INTO staff (email, password_plain, password_hash, role, empresa_id, is_supremo)
      VALUES ($1, NULL, $2, $3, $4, false)
      RETURNING id, email, role, empresa_id, is_supremo
    `,
      [email, ph, role, empresaId],
    )
    res.status(201).json({
      id: rows[0].id,
      email: rows[0].email,
      role: rows[0].role,
      empresaId: rows[0].empresa_id,
      isSupremo: rows[0].is_supremo === true,
    })
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Correo ya existe' })
    console.error(e)
    res.status(500).json({ error: 'Error al crear staff' })
  }
})

app.patch('/api/supremo/staff/:id', authMiddleware, requireSupremo, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const { rows: cur } = await pool.query(`SELECT * FROM staff WHERE id = $1`, [id])
    if (!cur.length) return res.status(404).json({ error: 'Usuario no encontrado' })
    if (cur[0].is_supremo === true) return res.status(400).json({ error: 'Usuario protegido' })

    const email = req.body?.email != null ? String(req.body.email || '').toLowerCase().trim() : cur[0].email
    const role = req.body?.role != null ? req.body.role : cur[0].role
    const empresaId = req.body?.empresaId != null ? Number(req.body.empresaId) : cur[0].empresa_id
    const pass = req.body?.password
    if (!email || !['admin', 'asesor'].includes(role) || !Number.isFinite(empresaId)) {
      return res.status(400).json({ error: 'Datos inválidos' })
    }

    const fields = []
    const params = [id]
    let p = 2
    fields.push(`email = $${p++}`)
    params.push(email)
    fields.push(`role = $${p++}`)
    params.push(role)
    fields.push(`empresa_id = $${p++}`)
    params.push(empresaId)
    if (pass != null && String(pass).length) {
      const ph = hashPassword(pass)
      fields.push(`password_hash = $${p++}`)
      params.push(ph)
      fields.push(`password_plain = NULL`)
    }
    const { rows } = await pool.query(
      `UPDATE staff SET ${fields.join(', ')} WHERE id = $1 RETURNING id, email, role, empresa_id, is_supremo`,
      params,
    )
    res.json({
      id: rows[0].id,
      email: rows[0].email,
      role: rows[0].role,
      empresaId: rows[0].empresa_id,
      isSupremo: rows[0].is_supremo === true,
    })
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'Correo ya existe' })
    console.error(e)
    res.status(500).json({ error: 'Error al actualizar staff' })
  }
})

app.delete('/api/supremo/staff/:id', authMiddleware, requireSupremo, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' })
  try {
    const { rows: cur } = await pool.query(`SELECT is_supremo FROM staff WHERE id = $1`, [id])
    if (!cur.length) return res.status(404).json({ error: 'Usuario no encontrado' })
    if (cur[0].is_supremo === true) return res.status(400).json({ error: 'Usuario protegido' })
    await pool.query(`DELETE FROM staff WHERE id = $1`, [id])
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al eliminar staff' })
  }
})

app.get('/api/supremo/turnos', authMiddleware, requireSupremo, async (req, res) => {
  const empresaId = req.query.empresaId ? Number(req.query.empresaId) : null
  if (req.query.empresaId && !Number.isFinite(empresaId)) {
    return res.status(400).json({ error: 'empresaId inválido' })
  }
  try {
    const { rows } = await pool.query(
      `
      SELECT
        t.id,
        t.numero_publico,
        t.estado,
        t.fecha_turno,
        t.hora_turno,
        t.nombre,
        t.apellido,
        t.documento_norm,
        t.telefono,
        t.prioridad,
        t.triage_urgencia_vital,
        t.triage_efectivo,
        t.modo_hibrido,
        t.checkin_completado,
        t.retrasos_aplicados,
        t.respuestas_extra,
        s.id AS sede_id,
        s.slug AS sede_slug,
        s.nombre AS sede_nombre,
        e.id AS empresa_id,
        e.slug AS empresa_slug,
        e.nombre AS empresa_nombre,
        (t.fecha_turno < CURRENT_DATE) AS vencido
      FROM turnos t
      JOIN sedes s ON s.id = t.sede_id
      JOIN empresas e ON e.id = s.empresa_id
      WHERE ($1::int IS NULL OR e.id = $1)
      ORDER BY t.fecha_turno DESC, t.hora_turno DESC
      LIMIT 500
    `,
      [empresaId],
    )
    res.json(
      rows.map((r) => ({
        id: r.id,
        numeroPublico: r.numero_publico,
        estado: r.estado,
        fechaTurno: r.fecha_turno,
        horaTurno: r.hora_turno,
        nombre: r.nombre,
        apellido: r.apellido,
        documento: r.documento_norm,
        telefono: r.telefono,
        prioridad: r.prioridad,
        triageUrgenciaVital: r.triage_urgencia_vital,
        triageEfectivo: r.triage_efectivo,
        modoHibrido: r.modo_hibrido,
        checkinCompletado: r.checkin_completado,
        retrasosAplicados: r.retrasos_aplicados,
        respuestasExtra: r.respuestas_extra,
        sede: { id: r.sede_id, slug: r.sede_slug, nombre: r.sede_nombre },
        empresa: { id: r.empresa_id, slug: r.empresa_slug, nombre: r.empresa_nombre },
        vencido: r.vencido === true,
      })),
    )
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar turnos' })
  }
})

app.post('/api/supremo/turnos', authMiddleware, requireSupremo, async (req, res) => {
  const sedeSlug = req.body?.sedeSlug ? normSlug(req.body.sedeSlug) : null
  const sedeId = req.body?.sedeId != null ? Number(req.body.sedeId) : null
  const documento = req.body?.documento
  const nombre = req.body?.nombre
  const apellido = req.body?.apellido
  const telefono = req.body?.telefono
  const fechaTurno = req.body?.fechaTurno
  const horaTurno = req.body?.horaTurno
  const prioridad = req.body?.prioridad
  const triageUrgenciaVital = req.body?.triageUrgenciaVital
  const triageEfectivo = req.body?.triageEfectivo
  const modoHibrido = req.body?.modoHibrido

  if (!documento || !nombre || !apellido || !telefono || !fechaTurno || !horaTurno) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' })
  }

  const docN = normDoc(documento)
  if (docN.length < 5) {
    return res.status(400).json({ error: 'Documento inválido' })
  }

  const client = await pool.connect()
  try {
    const sedeR = sedeId
      ? await client.query('SELECT * FROM sedes WHERE id = $1', [sedeId])
      : await client.query('SELECT * FROM sedes WHERE slug = $1', [sedeSlug])
    if (!sedeR.rows.length) {
      return res.status(404).json({ error: 'Sede no encontrada' })
    }
    const sede = sedeR.rows[0]

    if (sede.tipo === 'eps' && triageUrgenciaVital === true) {
      return res.status(400).json({
        error: 'Derivación a urgencias',
        codigo: 'URGENCIA_VITAL',
      })
    }

    const dup = await client.query(
      `
      SELECT id FROM turnos
      WHERE sede_id = $1 AND fecha_turno = $2::date AND documento_norm = $3
        AND estado IN ('pendiente_confirmacion', 'espera', 'atendiendo')
      LIMIT 1
    `,
      [sede.id, fechaTurno, docN],
    )
    if (dup.rows.length) {
      return res.status(409).json({
        error: 'Ya tenés un turno activo este día en esta sede',
        turnoExistenteId: dup.rows[0].id,
      })
    }

    await client.query('BEGIN')

    const maxOrden = await client.query(
      `SELECT COALESCE(MAX(orden_atencion), 0)::int AS m FROM turnos
       WHERE sede_id = $1 AND fecha_turno = $2::date AND estado IN ('espera', 'pendiente_confirmacion')`,
      [sede.id, fechaTurno],
    )
    const orden = maxOrden.rows[0].m + 1

    const n = Math.floor(1 + Math.random() * 98)
    const pref = prefijoPrioridad(prioridad)
    const numeroPublico = `${pref}-${String(n).padStart(2, '0')}`

    let codigo = randomCodigo()
    for (let k = 0; k < 8; k++) {
      const c = await client.query(
        `SELECT 1 FROM turnos WHERE sede_id = $1 AND fecha_turno = $2::date AND codigo_seguro = $3`,
        [sede.id, fechaTurno, codigo],
      )
      if (!c.rowCount) break
      codigo = randomCodigo()
    }

    const ins = await client.query(
      `
      INSERT INTO turnos
        (sede_id, numero_publico, documento, documento_norm, nombre, apellido, telefono,
         fecha_turno, hora_turno, prioridad, triage_urgencia_vital, triage_efectivo,
         modo_hibrido, estado, orden_atencion, codigo_seguro)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::time,$10,$11,$12,$13,'espera',$14,$15)
      RETURNING id, numero_publico, codigo_seguro, estado
    `,
      [
        sede.id,
        numeroPublico,
        String(documento),
        docN,
        String(nombre),
        String(apellido),
        String(telefono),
        fechaTurno,
        horaTurno,
        prioridad ?? null,
        triageUrgenciaVital ?? null,
        triageEfectivo ?? null,
        modoHibrido ?? true,
        orden,
        codigo,
      ],
    )

    await client.query('COMMIT')
    const t = ins.rows[0]
    res.status(201).json({
      id: t.id,
      numeroPublico: t.numero_publico,
      codigoSeguro: t.codigo_seguro,
      estado: t.estado,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    if (e?.code === '23505') {
      return res.status(409).json({ error: 'Turno duplicado' })
    }
    console.error(e)
    res.status(500).json({ error: 'Error al crear turno' })
  } finally {
    client.release()
  }
})

app.patch(
  '/api/supremo/turnos/:id/cancelar',
  authMiddleware,
  requireSupremo,
  async (req, res) => {
    try {
      const u = await pool.query(
        `UPDATE turnos SET estado = 'cancelado' WHERE id = $1::uuid RETURNING id`,
        [req.params.id],
      )
      if (!u.rowCount) return res.status(404).json({ error: 'Turno no encontrado' })
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: 'Error al cancelar turno' })
    }
  },
)

app.delete('/api/supremo/turnos/:id', authMiddleware, requireSupremo, async (req, res) => {
  try {
    const d = await pool.query(`DELETE FROM turnos WHERE id = $1::uuid RETURNING id`, [
      req.params.id,
    ])
    if (!d.rowCount) return res.status(404).json({ error: 'Turno no encontrado' })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al eliminar turno' })
  }
})

// Health check para Render
app.get('/health', (req, res) => {
  res.status(200).send('OK')
})

// --- ENDPOINTS PANEL ADMIN (10+ OPCIONES) ---

// 1. Listar Planes (Público y Admin)
app.get('/api/planes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM planes ORDER BY orden ASC')
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar planes' })
  }
})

// 2. Actualizar Precio/Plan (Admin)
app.patch('/api/panel/planes/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { precio, nombre, descripcion, detalle, minutos, activo, orden } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE planes SET 
        precio = COALESCE($1, precio),
        nombre = COALESCE($2, nombre),
        descripcion = COALESCE($3, descripcion),
        detalle = COALESCE($4, detalle),
        minutos = COALESCE($5, minutos),
        activo = COALESCE($6, activo),
        orden = COALESCE($7, orden)
      WHERE id = $8 AND empresa_id = $9
      RETURNING *`,
      [precio, nombre, descripcion, detalle, minutos, activo, orden, req.params.id, req.staff.empresaId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Plan no encontrado' })
    
    await logActividad(req.staff.sid, req.staff.empresaId, 'UPDATE_PLAN', `Plan ${req.params.id} actualizado`)
    res.json(rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al actualizar plan' })
  }
})

// 2b. Crear Plan (Admin)
app.post('/api/panel/planes', authMiddleware, requireAdmin, async (req, res) => {
  const { nombre, descripcion, precio, minutos, activo, orden } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO planes (nombre, descripcion, precio, minutos, activo, orden, empresa_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [nombre, descripcion, precio || '0', minutos || 60, activo ?? true, orden || 0, req.staff.empresaId]
    )
    await logActividad(req.staff.sid, req.staff.empresaId, 'CREATE_PLAN', `Plan ${rows[0].id} creado`)
    res.status(201).json(rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al crear plan' })
  }
})

// 2c. Eliminar Plan (Admin)
app.delete('/api/panel/planes/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM planes WHERE id = $1 AND empresa_id = $2',
      [req.params.id, req.staff.empresaId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Plan no encontrado' })
    await logActividad(req.staff.sid, req.staff.empresaId, 'DELETE_PLAN', `Plan ${req.params.id} eliminado`)
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al eliminar plan' })
  }
})

// 3. Actualizar Configuración de Sede (Horarios, etc.) (Admin)
app.patch('/api/panel/sedes/:id/config', authMiddleware, requireAdmin, async (req, res) => {
  const { hora_apertura, hora_cierre, geocerca_metros } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE sedes SET 
        hora_apertura = COALESCE($1, hora_apertura),
        hora_cierre = COALESCE($2, hora_cierre),
        geocerca_metros = COALESCE($3, geocerca_metros)
      WHERE id = $4 AND empresa_id = $5
      RETURNING *`,
      [hora_apertura, hora_cierre, geocerca_metros, req.params.id, req.staff.empresaId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Sede no encontrada' })
    
    await logActividad(req.staff.sid, req.staff.empresaId, 'UPDATE_SEDE_CONFIG', `Configuración de sede ${req.params.id} actualizada`)
    res.json(mapSede(rows[0]))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al actualizar configuración' })
  }
})

// 4. Ver Logs de Actividad (Admin)
app.get('/api/panel/logs', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, s.email as staff_email 
       FROM logs_actividad l 
       LEFT JOIN staff s ON s.id = l.staff_id 
       WHERE l.empresa_id = $1 
       ORDER BY l.created_at DESC LIMIT 100`,
      [req.staff.empresaId]
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al cargar logs' })
  }
})

// 5. Gestión de Staff (Listar) (Admin)
app.get('/api/panel/staff', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, role, is_supremo FROM staff WHERE empresa_id = $1 ORDER BY email',
      [req.staff.empresaId]
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al listar staff' })
  }
})

// 6. Crear Staff (Admin)
app.post('/api/panel/staff', authMiddleware, requireAdmin, async (req, res) => {
  const { email, password, role } = req.body
  if (!email || !password || !role) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const ph = hashPassword(password)
    const { rows } = await pool.query(
      `INSERT INTO staff (email, password_hash, role, empresa_id) 
       VALUES ($1, $2, $3, $4) RETURNING id, email, role`,
      [email.toLowerCase().trim(), ph, role, req.staff.empresaId]
    )
    await logActividad(req.staff.sid, req.staff.empresaId, 'CREATE_STAFF', `Staff ${email} creado`)
    res.status(201).json(rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al crear staff' })
  }
})

// 7. Eliminar Staff (Admin)
app.delete('/api/panel/staff/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM staff WHERE id = $1 AND empresa_id = $2 AND is_supremo = false',
      [req.params.id, req.staff.empresaId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Staff no encontrado o no eliminable' })
    await logActividad(req.staff.sid, req.staff.empresaId, 'DELETE_STAFF', `Staff ID ${req.params.id} eliminado`)
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al eliminar staff' })
  }
})

// 8. Completar Turno (Admin/Asesor) - Ya existe pero agregamos log
// (Se asume que ya existe /api/panel/turno/:id/completar, lo buscaremos para inyectar el log)

// 9. Reasignar Turno (Admin/Asesor)
app.patch('/api/panel/turno/:id/asignar', authMiddleware, async (req, res) => {
  const { fecha_turno, hora_turno } = req.body
  try {
    const { rowCount } = await pool.query(
      `UPDATE turnos SET fecha_turno = $1::date, hora_turno = $2::time 
       WHERE id = $3::uuid AND (SELECT empresa_id FROM sedes WHERE id = sede_id) = $4`,
      [fecha_turno, hora_turno, req.params.id, req.staff.empresaId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Turno no encontrado' })
    await logActividad(req.staff.sid, req.staff.empresaId, 'REASSIGN_TURNO', `Turno ${req.params.id} reasignado a ${fecha_turno} ${hora_turno}`)
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al reasignar turno' })
  }
})

// 10. Exportar Reporte de Hoy (Admin)
app.get('/api/panel/reporte/hoy', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const fecha = new Date().toISOString().slice(0, 10)
    const { rows } = await pool.query(
      `SELECT t.*, s.nombre as sede_nombre 
       FROM turnos t 
       JOIN sedes s ON s.id = t.sede_id 
       WHERE s.empresa_id = $1 AND t.fecha_turno = $2::date
       ORDER BY t.hora_turno ASC`,
      [req.staff.empresaId, fecha]
    )
    res.json({ fecha, data: rows })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al generar reporte' })
  }
})

// Servir archivos estáticos del frontend
app.use(express.static(frontendDist))

// Redirigir cualquier otra petición al index.html del frontend (React Router)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' })
  res.sendFile(path.join(frontendDist, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DETAIM API ejecutándose en puerto ${PORT} (0.0.0.0)`)
  console.log(`Frontend servido desde: ${frontendDist}`)
  
  // Inicializar DB en segundo plano
  console.log('Iniciando base de datos en segundo plano...')
  initDb()
    .then(() => console.log('Base de datos inicializada correctamente.'))
    .catch(error => console.error('Error al inicializar la base de datos:', error))
})
