import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PanelShell from './PanelShell'
import type { SedeApi } from './api/kivo'
import {
  atenderTurno,
  completarTurno,
  fetchCola,
  fetchEmpresaPanel,
  logoutPanel,
  type ColaTurno,
} from './api/panel'

function horaCorta(t: string) {
  if (!t) return '—'
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}

function estadoLabel(e: string) {
  switch (e) {
    case 'pendiente_confirmacion':
      return 'Pendiente código'
    case 'espera':
      return 'En espera'
    case 'atendiendo':
      return 'Atendiendo'
    default:
      return e
  }
}

export default function PanelAsesor() {
  const navigate = useNavigate()
  const [authOk, setAuthOk] = useState(false)
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [empresaTipo, setEmpresaTipo] = useState('general')
  const [sedes, setSedes] = useState<SedeApi[]>([])
  const [sedeSlug, setSedeSlug] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [turnos, setTurnos] = useState<ColaTurno[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const turnoActual = turnos.find((t) => t.estado === 'atendiendo')
  const siguienteEnCola = turnos.find((t) => t.estado === 'espera')

  useEffect(() => {
    if (!localStorage.getItem('kivo_token')) {
      logoutPanel()
      navigate('/panel', { replace: true })
      return
    }
    setAuthOk(true)
  }, [navigate])

  const loadEmpresa = useCallback(async () => {
    const emp = await fetchEmpresaPanel()
    setEmpresaNombre(emp.empresa.nombre)
    setEmpresaTipo(emp.empresa.tipo)
    const list = emp.sedes
    setSedes(list)
    setSedeSlug((prev) => {
      if (prev && list.some((s) => s.slug === prev)) return prev
      return list[0]?.slug ?? ''
    })
  }, [])

  const loadCola = useCallback(async () => {
    if (!sedeSlug) return
    setLoading(true)
    setError(null)
    try {
      const c = await fetchCola(sedeSlug, fecha)
      setTurnos(c.turnos)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      if (msg === 'Sesión expirada') {
        navigate('/panel', { replace: true })
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [fecha, navigate, sedeSlug])

  useEffect(() => {
    if (!authOk) return
    void loadEmpresa().catch(() => setError('No se pudo cargar la empresa'))
  }, [authOk, loadEmpresa])

  useEffect(() => {
    if (!authOk || !sedeSlug) return
    void loadCola()
  }, [authOk, loadCola, sedeSlug])

  useEffect(() => {
    if (!authOk || !sedeSlug) return
    const iv = setInterval(() => void loadCola(), 8000)
    return () => clearInterval(iv)
  }, [authOk, loadCola, sedeSlug])

  const handleAtender = async (id: string) => {
    setActionId(id)
    try {
      await atenderTurno(id)
      await loadCola()
    } catch {
      setError('No se pudo marcar como atendiendo')
    } finally {
      setActionId(null)
    }
  }

  const handleCompletar = async (id: string) => {
    setActionId(id)
    try {
      await completarTurno(id)
      await loadCola()
    } catch {
      setError('No se pudo completar el turno')
    } finally {
      setActionId(null)
    }
  }

  const handleLlamarSiguiente = async () => {
    if (!siguienteEnCola) return
    setActionId(siguienteEnCola.id)
    try {
      if (turnoActual) {
        await completarTurno(turnoActual.id)
      }
      await atenderTurno(siguienteEnCola.id)
      await loadCola()
    } catch {
      setError('No se pudo llamar al siguiente turno')
    } finally {
      setActionId(null)
    }
  }

  if (!authOk) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50 text-zinc-500">
        Verificando acceso…
      </div>
    )
  }

  return (
    <PanelShell variant="asesor" empresaNombre={empresaNombre} empresaTipo={empresaTipo}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Panel de Atención</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Gestioná los turnos en tiempo real para la sede seleccionada.
          </p>
        </div>

        {/* Sección de Turno Actual y Acciones Rápidas */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-kivo-100 bg-white p-6 shadow-sm ring-1 ring-zinc-100">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Atendiendo ahora</h2>
            {turnoActual ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-kivo-600 text-3xl font-black text-white shadow-lg shadow-kivo-200">
                    {turnoActual.numero_publico}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-zinc-900">
                      {turnoActual.nombre} {turnoActual.apellido}
                    </p>
                    <p className="text-sm font-medium text-zinc-500">
                      Documento: <span className="font-mono">{turnoActual.documento_norm}</span>
                    </p>
                    <div className="mt-2 flex gap-2">
                      {turnoActual.prioridad && turnoActual.prioridad !== 'ninguna' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          Preferencial
                        </span>
                      )}
                      {turnoActual.triage_efectivo && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800">
                          Caja/Efectivo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex w-full sm:w-auto flex-col gap-2">
                  <button
                    type="button"
                    disabled={!!actionId}
                    onClick={() => void handleCompletar(turnoActual.id)}
                    className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-95"
                  >
                    Finalizar Atención
                  </button>
                  <button
                    type="button"
                    disabled={!!actionId || !siguienteEnCola}
                    onClick={() => void handleLlamarSiguiente()}
                    className="rounded-xl border border-kivo-600 bg-kivo-50 px-6 py-3 text-sm font-bold text-kivo-800 hover:bg-kivo-100 disabled:opacity-50 transition-all active:scale-95"
                  >
                    Finalizar y Siguiente
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-4 rounded-full bg-zinc-50 p-4">
                  <svg className="h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-medium text-zinc-500">No hay ningún turno en atención</p>
                <button
                  type="button"
                  disabled={!!actionId || !siguienteEnCola}
                  onClick={() => void handleLlamarSiguiente()}
                  className="mt-4 rounded-xl bg-kivo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-kivo-200 hover:bg-kivo-700 disabled:opacity-50 transition-all active:scale-95"
                >
                  Llamar primer turno
                </button>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-zinc-100 bg-zinc-50/50 p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Siguiente en fila</h2>
            {siguienteEnCola ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-zinc-200 text-lg font-bold text-zinc-900 shadow-sm">
                    {siguienteEnCola.numero_publico}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-zinc-900">
                      {siguienteEnCola.nombre} {siguienteEnCola.apellido}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Espera: <span className="font-mono tabular-nums">{horaCorta(siguienteEnCola.hora_turno)}</span>
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500 bg-white/50 p-3 rounded-xl border border-zinc-100">
                  <p>Quedan <strong>{turnos.filter(t => t.estado === 'espera').length}</strong> personas esperando en esta sede.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm font-medium text-zinc-400 italic">La fila está vacía</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex-1 min-w-0">
            <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="asesor-sede">
              Sede de trabajo
            </label>
            <select
              id="asesor-sede"
              value={sedeSlug}
              onChange={(e) => setSedeSlug(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
            >
              {sedes.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="asesor-fecha">
              Fecha de consulta
            </label>
            <input
              id="asesor-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadCola()}
            className="w-full sm:w-auto rounded-xl bg-white border border-zinc-200 px-6 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Refrescar cola
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 border border-red-100">{error}</p>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900">Cola de espera completa</h2>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">
              {turnos.length} Turnos hoy
            </span>
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-4">Turno</th>
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Documento</th>
                    <th className="px-6 py-4">Hora</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Alertas</th>
                    <th className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loading && turnos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 italic">
                        Cargando cola en tiempo real…
                      </td>
                    </tr>
                  ) : turnos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 italic">
                        No hay turnos registrados para esta sede hoy.
                      </td>
                    </tr>
                  ) : (
                    turnos.map((t) => (
                      <tr key={t.id} className={`hover:bg-zinc-50/50 transition-colors ${t.estado === 'atendiendo' ? 'bg-kivo-50/30' : ''}`}>
                        <td className="px-6 py-4 font-mono font-black text-kivo-900">
                          {t.numero_publico}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-zinc-900">{t.nombre} {t.apellido}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                          {t.documento_norm}
                        </td>
                        <td className="px-6 py-4 tabular-nums text-zinc-800 font-medium">
                          {horaCorta(t.hora_turno)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              t.estado === 'atendiendo'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : t.estado === 'pendiente_confirmacion'
                                  ? 'bg-violet-50 text-violet-700 border border-violet-100'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}
                          >
                            {estadoLabel(t.estado)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {t.prioridad && t.prioridad !== 'ninguna' && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 uppercase">Prioritario</span>
                            )}
                            {t.triage_urgencia_vital && (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-900 uppercase">Vital</span>
                            )}
                            {t.triage_efectivo === true && (
                              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-900 uppercase">Caja</span>
                            )}
                            {!t.checkin_completado && t.estado === 'espera' && (
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold text-zinc-500 uppercase">Sin Check-in</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {t.estado === 'espera' && (
                            <button
                              type="button"
                              disabled={!!actionId}
                              onClick={() => void handleAtender(t.id)}
                              className="rounded-xl bg-kivo-600 px-4 py-2 text-xs font-bold text-white hover:bg-kivo-700 disabled:opacity-50 transition-all active:scale-95"
                            >
                              Atender
                            </button>
                          )}
                          {t.estado === 'atendiendo' && (
                            <button
                              type="button"
                              disabled={!!actionId}
                              onClick={() => void handleCompletar(t.id)}
                              className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-95"
                            >
                              Completar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PanelShell>
  )
}
