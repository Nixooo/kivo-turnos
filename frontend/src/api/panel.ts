import type { SedeApi } from './kivo'

const TOKEN_KEY = 'detaim_token'
const ROLE_KEY = 'detaim_role'
const SUPREMO_KEY = 'detaim_is_supremo'

export function logoutPanel() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(SUPREMO_KEY)
}

export function getStoredRole(): 'admin' | 'asesor' | null {
  const r = localStorage.getItem(ROLE_KEY)
  if (r === 'admin' || r === 'asesor') return r
  return null
}

export function getStoredIsSupremo(): boolean {
  return localStorage.getItem(SUPREMO_KEY) === '1'
}

export function setStoredIsSupremo(v: boolean) {
  if (v) localStorage.setItem(SUPREMO_KEY, '1')
  else localStorage.removeItem(SUPREMO_KEY)
}

const token = () => localStorage.getItem(TOKEN_KEY)

async function authFetch(path: string, opts: RequestInit = {}) {
  const t = token()
  const r = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  })
  if (r.status === 401) {
    logoutPanel()
    throw new Error('Sesión expirada')
  }
  return r
}

export type LoginResponse = {
  token: string
  role: 'admin' | 'asesor'
  empresaId: number
  empresaNombre: string
  empresaTipo: string
  empresaSlug: string
  isSupremo?: boolean
}

export async function loginPanel(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error al iniciar sesión')
  return j
}

export type EmpresaPanel = {
  empresa: { id: number; nombre: string; slug: string; tipo: string }
  sedes: SedeApi[]
}

export async function fetchEmpresaPanel(): Promise<EmpresaPanel> {
  const r = await authFetch('/api/panel/empresa')
  if (!r.ok) throw new Error('Error')
  return r.json()
}

export type ResumenAdmin = {
  fecha: string
  totales: {
    en_espera: number
    pendientes: number
    atendiendo: number
    completados: number
    cancelados: number
    triage_urgencia: number
    triage_efectivo: number
  }
  porSede: { slug: string; nombre: string; espera: number }[]
  sedes: { id: number; slug: string; nombre: string }[]
}

export async function fetchResumenAdmin(fecha?: string): Promise<ResumenAdmin> {
  const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''
  const r = await authFetch(`/api/panel/empresa/resumen${q}`)
  if (!r.ok) throw new Error('Error')
  return r.json()
}

export type ColaTurno = {
  id: string
  numero_publico: string
  nombre: string
  apellido: string
  telefono: string
  documento_norm: string
  hora_turno: string
  estado: string
  orden_atencion: number
  prioridad: string | null
  triage_efectivo: boolean | null
  triage_urgencia_vital: boolean | null
  checkin_completado: boolean
  modo_hibrido: boolean
  retrasos_aplicados: number
}

export async function fetchCola(
  sedeSlug: string,
  fecha?: string,
): Promise<{ sede: unknown; fecha: string; turnos: ColaTurno[] }> {
  const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''
  const r = await authFetch(
    `/api/panel/cola/${encodeURIComponent(sedeSlug)}${q}`,
  )
  if (!r.ok) throw new Error('Error')
  return r.json()
}

export async function atenderTurno(id: string): Promise<void> {
  const r = await authFetch(`/api/panel/turno/${encodeURIComponent(id)}/atender`, {
    method: 'PATCH',
  })
  if (!r.ok) throw new Error('Error')
}

export async function completarTurno(id: string): Promise<void> {
  const r = await authFetch(
    `/api/panel/turno/${encodeURIComponent(id)}/completar`,
    {
      method: 'PATCH',
    },
  )
  if (!r.ok) throw new Error('Error')
}

export async function cancelarTurno(id: string): Promise<void> {
  const r = await authFetch(
    `/api/panel/turno/${encodeURIComponent(id)}/cancelar`,
    {
      method: 'PATCH',
    },
  )
  if (!r.ok) throw new Error('Error')
}

export async function reasignarTurno(id: string, fecha: string, hora: string): Promise<void> {
  const r = await authFetch(
    `/api/panel/turno/${encodeURIComponent(id)}/reasignar`,
    {
      method: 'PATCH',
      body: JSON.stringify({ fecha_turno: fecha, hora_turno: hora }),
    },
  )
  if (!r.ok) throw new Error('Error')
}

export async function fetchTurnosEmpresa(fecha?: string): Promise<any[]> {
  const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''
  const r = await authFetch(`/api/panel/turnos-empresa${q}`)
  if (!r.ok) throw new Error('Error')
  return r.json()
}

export type EmpresaGlobal = {
  id: number
  slug: string
  nombre: string
  tipo: string
  logo_url?: string
  color_hex?: string
}

export async function fetchEmpresasSupremo(): Promise<EmpresaGlobal[]> {
  const r = await authFetch('/api/supremo/empresas')
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function crearEmpresaSupremo(input: {
  slug: string
  nombre: string
  tipo: 'eps' | 'banco' | 'general' | 'clinica' | 'notaria' | 'gimnasio'
  logo_url?: string
  color_hex?: string
}): Promise<EmpresaGlobal> {
  const r = await authFetch('/api/supremo/empresas', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function actualizarEmpresaSupremo(
  id: number,
  input: Partial<{
    slug: string
    nombre: string
    tipo: 'eps' | 'banco' | 'general' | 'clinica' | 'notaria' | 'gimnasio'
    logo_url: string
    color_hex: string
  }>,
): Promise<EmpresaGlobal> {
  const r = await authFetch(`/api/supremo/empresas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function eliminarEmpresaSupremo(id: number): Promise<void> {
  const r = await authFetch(`/api/supremo/empresas/${id}`, { method: 'DELETE' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
}

export type SedeGlobal = SedeApi & { dbId?: number }

export async function fetchSedesSupremo(empresaId?: number): Promise<SedeGlobal[]> {
  const q = empresaId ? `?empresaId=${encodeURIComponent(String(empresaId))}` : ''
  const r = await authFetch(`/api/supremo/sedes${q}`)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function crearSedeSupremo(input: {
  empresaId: number
  slug: string
  nombre: string
  direccion: string
  horaApertura: string
  horaCierre: string
  lat: number
  lng: number
  tipo: 'general' | 'eps' | 'banco'
  personasFilaEstimado?: number
  turnoAtendiendo?: string
  geocercaMetros?: number
}): Promise<SedeGlobal> {
  const r = await authFetch('/api/supremo/sedes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function actualizarSedeSupremo(
  id: number,
  input: Partial<{
    empresaId: number
    slug: string
    nombre: string
    direccion: string
    horaApertura: string
    horaCierre: string
    lat: number
    lng: number
    tipo: 'general' | 'eps' | 'banco'
    personasFilaEstimado: number
    turnoAtendiendo: string
    geocercaMetros: number
  }>,
): Promise<SedeGlobal> {
  const r = await authFetch(`/api/supremo/sedes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function eliminarSedeSupremo(id: number): Promise<void> {
  const r = await authFetch(`/api/supremo/sedes/${id}`, { method: 'DELETE' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
}

export type StaffGlobal = {
  id: number
  email: string
  role: 'admin' | 'asesor'
  empresaId: number
  isSupremo: boolean
}

export async function fetchStaffSupremo(empresaId?: number): Promise<StaffGlobal[]> {
  const q = empresaId ? `?empresaId=${encodeURIComponent(String(empresaId))}` : ''
  const r = await authFetch(`/api/supremo/staff${q}`)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function crearStaffSupremo(input: {
  email: string
  password: string
  role: 'admin' | 'asesor'
  empresaId: number
}): Promise<StaffGlobal> {
  const r = await authFetch('/api/supremo/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function actualizarStaffSupremo(
  id: number,
  input: Partial<{ email: string; password: string; role: 'admin' | 'asesor'; empresaId: number }>,
): Promise<StaffGlobal> {
  const r = await authFetch(`/api/supremo/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function eliminarStaffSupremo(id: number): Promise<void> {
  const r = await authFetch(`/api/supremo/staff/${id}`, { method: 'DELETE' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
}

export type PreguntaTurno = {
  id: number
  key: string
  label: string
  type: 'bool' | 'dropdown' | 'scale10'
  options: string[]
  orden: number
  active: boolean
}

export async function fetchPreguntasTurnoAdmin(): Promise<PreguntaTurno[]> {
  const r = await authFetch('/api/panel/preguntas')
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function crearPreguntaTurnoAdmin(input: {
  key?: string
  label: string
  type: 'bool' | 'dropdown' | 'scale10'
  options?: string[]
  orden?: number
  active?: boolean
}): Promise<PreguntaTurno> {
  const r = await authFetch('/api/panel/preguntas', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function actualizarPreguntaTurnoAdmin(
  id: number,
  input: Partial<{
    key: string
    label: string
    type: 'bool' | 'dropdown' | 'scale10'
    options: string[]
    orden: number
    active: boolean
  }>,
): Promise<PreguntaTurno> {
  const r = await authFetch(`/api/panel/preguntas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function eliminarPreguntaTurnoAdmin(id: number): Promise<void> {
  const r = await authFetch(`/api/panel/preguntas/${id}`, { method: 'DELETE' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
}

export type TurnoSupremo = {
  id: string
  numeroPublico: string
  estado: string
  fechaTurno: string
  horaTurno: string
  nombre: string
  apellido: string
  documento: string
  telefono: string
  prioridad: string | null
  triageUrgenciaVital: boolean | null
  triageEfectivo: boolean | null
  modoHibrido: boolean | null
  checkinCompletado: boolean
  retrasosAplicados: number
  respuestasExtra: Record<string, unknown> | null
  sede: { id: number; slug: string; nombre: string }
  empresa: { id: number; slug: string; nombre: string }
  vencido: boolean
}

export async function fetchTurnosSupremo(empresaId?: number): Promise<TurnoSupremo[]> {
  const q = empresaId ? `?empresaId=${encodeURIComponent(String(empresaId))}` : ''
  const r = await authFetch(`/api/supremo/turnos${q}`)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
  return j
}

export async function eliminarTurnoSupremo(id: string): Promise<void> {
  const r = await authFetch(`/api/supremo/turnos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error')
}
