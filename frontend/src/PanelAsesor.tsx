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
      return 'En sesión'
    case 'completado':
      return 'Completado'
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
    if (!localStorage.getItem('detaim_token')) {
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
      <div className="space-y-8 animate-in">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-black">Panel de Atención</h1>
          <p className="mt-1 text-sm text-zinc-500 font-medium">
            Gestioná las reservas en tiempo real.
          </p>
        </div>

        {/* Sección de Reserva Actual y Acciones Rápidas */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-[2.5rem] border border-zinc-200 bg-white/80 p-8 shadow-2xl shadow-black/5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-6">Atendiendo ahora</h2>
            {turnoActual ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-8">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-black text-4xl font-black text-white shadow-xl">
                    {turnoActual.numero_publico}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-black">
                      {turnoActual.nombre} {turnoActual.apellido}
                    </p>
                    <p className="text-sm font-bold text-zinc-500 mt-1">
                      Celular: <span className="text-zinc-600">{turnoActual.telefono || 'No reg.'}</span>
                    </p>
                    <div className="mt-4 flex gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 border border-blue-100">
                        Sesión Activa
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex w-full sm:w-auto flex-col gap-3">
                  <button
                    type="button"
                    disabled={!!actionId}
                    onClick={() => void handleCompletar(turnoActual.id)}
                    className="rounded-2xl bg-black px-8 py-4 text-sm font-bold text-white shadow-xl transition-all hover:bg-zinc-800 active:scale-95"
                  >
                    Finalizar Sesión
                  </button>
                  <button
                    type="button"
                    disabled={!!actionId || !siguienteEnCola}
                    onClick={() => void handleLlamarSiguiente()}
                    className="rounded-2xl border border-zinc-200 bg-zinc-100 px-8 py-4 text-sm font-bold text-black transition-all hover:bg-white active:scale-95"
                  >
                    Siguiente Reserva
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-6 rounded-full bg-zinc-100 p-6">
                  <svg className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-bold text-zinc-500">No hay ninguna reserva en atención</p>
                <button
                  type="button"
                  disabled={!!actionId || !siguienteEnCola}
                  onClick={() => void handleLlamarSiguiente()}
                  className="mt-8 rounded-2xl bg-black px-10 py-4 text-sm font-bold text-white shadow-xl shadow-black/10 hover:bg-zinc-800 transition-all active:scale-95"
                >
                  Llamar primera reserva
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[2.5rem] border border-zinc-200 bg-white/50 p-8">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-6">Próxima reserva</h2>
            {siguienteEnCola ? (
              <div className="space-y-6">
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 border border-zinc-200 text-2xl font-black text-black shadow-lg">
                    {siguienteEnCola.numero_publico}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black text-black text-lg">
                      {siguienteEnCola.nombre} {siguienteEnCola.apellido}
                    </p>
                    <p className="text-sm font-bold text-zinc-500">
                      Cita: <span className="text-black">{horaCorta(siguienteEnCola.hora_turno)}</span>
                    </p>
                  </div>
                </div>
                <div className="text-[11px] font-bold text-zinc-500 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                  <p>Quedan <strong className="text-black">{turnos.filter(t => t.estado === 'espera').length}</strong> personas esperando.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm font-bold text-zinc-600 italic tracking-wide">La fila está vacía</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-6 rounded-[2rem] border border-zinc-200 bg-white/50 p-6">
          <div className="flex-1 min-w-0">
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-400" htmlFor="asesor-sede">
              Sede de trabajo
            </label>
            <select
              id="asesor-sede"
              value={sedeSlug}
              onChange={(e) => setSedeSlug(e.target.value)}
              className="w-full rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm text-black focus:ring-2 focus:ring-black/5 transition outline-none"
            >
              {sedes.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-400" htmlFor="asesor-fecha">
              Fecha de consulta
            </label>
            <input
              id="asesor-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm text-black focus:ring-2 focus:ring-black/5 transition outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadCola()}
            className="w-full sm:w-auto rounded-xl border border-zinc-200 bg-black px-8 py-3 text-sm font-bold text-white hover:bg-zinc-800 transition shadow-xl shadow-black/10"
          >
            Actualizar
          </button>
        </div>

        {error && (
          <p className="rounded-2xl bg-red-50 px-6 py-4 text-sm font-bold text-red-500 border border-red-100">{error}</p>
        )}

        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black text-black">Cola de Reservas</h2>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-4 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {turnos.length} Reservas hoy
            </span>
          </div>
          
          <div className="overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white/50 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50/50 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  <tr>
                    <th className="px-8 py-6">ID</th>
                    <th className="px-8 py-6">Usuario</th>
                    <th className="px-8 py-6">Cita</th>
                    <th className="px-8 py-6">Estado</th>
                    <th className="px-8 py-6 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loading && turnos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center text-zinc-400 italic font-bold">
                        Cargando reservas en tiempo real…
                      </td>
                    </tr>
                  ) : turnos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center text-zinc-400 italic font-bold">
                        No hay reservas para hoy.
                      </td>
                    </tr>
                  ) : (
                    turnos.map((t) => (
                      <tr key={t.id} className={`hover:bg-zinc-50/50 transition-colors ${t.estado === 'atendiendo' ? 'bg-zinc-50' : ''}`}>
                        <td className="px-8 py-6 font-black text-black">
                          {t.numero_publico}
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-bold text-black">{t.nombre} {t.apellido}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{t.telefono || 'Sin celular'}</p>
                        </td>
                        <td className="px-8 py-6 tabular-nums text-black font-bold">
                          {horaCorta(t.hora_turno)}
                        </td>
                        <td className="px-8 py-6">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${
                              t.estado === 'atendiendo'
                                ? 'bg-black text-white'
                                : t.estado === 'pendiente_confirmacion'
                                  ? 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                                  : 'bg-blue-50 text-blue-600 border border-blue-100'
                            }`}
                          >
                            {estadoLabel(t.estado)}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {t.estado === 'espera' && (
                            <button
                              type="button"
                              disabled={!!actionId}
                              onClick={() => void handleAtender(t.id)}
                              className="rounded-xl bg-black px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition-all active:scale-95"
                            >
                              Atender
                            </button>
                          )}
                          {t.estado === 'atendiendo' && (
                            <button
                              type="button"
                              disabled={!!actionId}
                              onClick={() => void handleCompletar(t.id)}
                              className="rounded-xl bg-zinc-100 border border-zinc-200 px-5 py-2.5 text-xs font-bold text-black hover:bg-white transition-all active:scale-95"
                            >
                              Finalizar
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
