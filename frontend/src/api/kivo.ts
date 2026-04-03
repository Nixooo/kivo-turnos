export type SedeTipo = 'general' | 'eps' | 'banco'

export type SedeApi = {
  id: string
  slug: string
  label: string
  nombre: string
  direccion: string
  horaApertura: string
  horaCierre: string
  lat: number
  lng: number
  tipo: SedeTipo
  personasDelante: number
  esperaMinAprox: number
  carga: 'baja' | 'media' | 'alta'
  turnoAtendiendo: string
  geocercaMetros: number
  empresaId?: number
  empresaSlug?: string
}

export type TurnoResumenApi = {
  id: string
  numero: string
  sede: string
  fecha_hora: string
  estado: string
}

export type ReservarTurnoResponse = {
  id: string
  numeroPublico: string | null
  ordenAtencion: number
  codigoSeguro: string
  estado: string
  duplicadoEvitado?: boolean
}

export type PreguntaTurnoPublica = {
  key: string
  label: string
  type: 'bool' | 'dropdown' | 'scale10'
  options: string[]
  orden: number
}

export type FilaApi = {
  faltan: number
  estimadoMinutos: number
  numeroPublico: string
  estado: string
  turnoAtendiendo: string
  sedeNombre: string
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    return j.error || res.statusText
  } catch {
    return res.statusText
  }
}

export type EmpresaApi = {
  id: number
  slug: string
  nombre: string
  tipo: string
  logo_url?: string
  color_hex?: string
}

export async function fetchSedes(empresaSlug?: string): Promise<SedeApi[]> {
  const q = empresaSlug ? `?empresaSlug=${encodeURIComponent(empresaSlug)}` : ''
  const r = await fetch(`/api/sedes${q}`)
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function fetchEmpresaPorSlug(slug: string): Promise<EmpresaApi> {
  const r = await fetch(`/api/empresas/${encodeURIComponent(slug)}`)
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function fetchEmpresasPublicas(): Promise<EmpresaApi[]> {
  const r = await fetch('/api/empresas')
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function fetchPreguntasSede(sedeSlug: string): Promise<PreguntaTurnoPublica[]> {
  const r = await fetch(`/api/sedes/${encodeURIComponent(sedeSlug)}/preguntas`)
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function fetchTurnosPorDocumento(
  documento: string,
): Promise<TurnoResumenApi[]> {
  const r = await fetch(
    `/api/turnos?documento=${encodeURIComponent(documento)}`,
  )
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export type ReservarError = Error & { codigo?: string; status?: number }

export async function reservarTurno(body: {
  sedeSlug: string
  documento: string
  nombre: string
  apellido: string
  telefono: string
  fechaTurno: string
  horaTurno: string
  prioridad: string
  triageUrgenciaVital: boolean | null
  triageEfectivo: boolean | null
  modoHibrido: boolean
  respuestasExtra?: Record<string, unknown>
  idempotencyKey?: string
}): Promise<ReservarTurnoResponse> {
  const r = await fetch('/api/turnos/reservar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as {
      error?: string
      codigo?: string
    }
    const err = new Error(j.error || (await parseError(r))) as ReservarError
    err.codigo = j.codigo
    err.status = r.status
    throw err
  }
  return r.json()
}

export async function confirmarTurno(
  id: string,
  codigo: string,
): Promise<{ ok: boolean; numeroPublico?: string }> {
  const r = await fetch(`/api/turnos/${encodeURIComponent(id)}/confirmar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo }),
  })
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function fetchFilaTurno(id: string): Promise<FilaApi> {
  const r = await fetch(`/api/turnos/${encodeURIComponent(id)}/fila`)
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function cancelarTurno(id: string, codigo: string): Promise<void> {
  const r = await fetch(`/api/turnos/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo }),
  })
  if (!r.ok) throw new Error(await parseError(r))
}

export async function checkinTurno(
  id: string,
  metodo: 'gps' | 'qr',
  codigo: string,
): Promise<void> {
  const r = await fetch(`/api/turnos/${encodeURIComponent(id)}/checkin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metodo, codigo }),
  })
  if (!r.ok) throw new Error(await parseError(r))
}

export async function retrasoCortesia(
  id: string,
  codigo: string,
  opcion: 3 | 5,
): Promise<{ ok: boolean; nuevaPosicion?: number; pasosMovidos?: number }> {
  const r = await fetch(`/api/turnos/${encodeURIComponent(id)}/retraso`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo, opcion }),
  })
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}
