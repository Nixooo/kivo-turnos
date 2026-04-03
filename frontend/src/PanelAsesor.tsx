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
          <h1 className="text-2xl font-semibold text-zinc-900">Cola de atención</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Llamá al siguiente turno y completá cuando termine. Solo ves sedes de tu
            empresa.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex-1 min-w-0">
            <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="asesor-sede">
              Sede
            </label>
            <select
              id="asesor-sede"
              value={sedeSlug}
              onChange={(e) => setSedeSlug(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
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
              Fecha
            </label>
            <input
              id="asesor-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadCola()}
            className="w-full sm:w-auto rounded-xl bg-kivo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-kivo-700"
          >
            Refrescar
          </button>
        </div>

        {empresaTipo === 'eps' && (
          <p className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-950">
            <strong>EPS:</strong> priorizá a quienes tengan preferencia y revisá si el
            triage marcó derivación a urgencias antes de atender en ventanilla.
          </p>
        )}
        {empresaTipo === 'banco' && (
          <p className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
            <strong>Banco:</strong> los turnos con caja/efectivo pueden requerir
            módulo distinto al de asesoría.
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Turno</th>
                  <th className="px-4 py-3">Paciente / cliente</th>
                  <th className="px-4 py-3">Doc.</th>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Notas</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading && turnos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      Cargando cola…
                    </td>
                  </tr>
                ) : turnos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      No hay turnos activos para esta sede y fecha.
                    </td>
                  </tr>
                ) : (
                  turnos.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-mono font-bold text-kivo-900">
                        {t.numero_publico}
                      </td>
                      <td className="px-4 py-3 text-zinc-900">
                        {t.nombre} {t.apellido}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                        {t.documento_norm}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-800">
                        {horaCorta(t.hora_turno)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            t.estado === 'atendiendo'
                              ? 'bg-amber-100 text-amber-900'
                              : t.estado === 'pendiente_confirmacion'
                                ? 'bg-violet-100 text-violet-900'
                                : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {estadoLabel(t.estado)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        {t.prioridad && t.prioridad !== 'ninguna' && (
                          <span className="mr-1 font-medium text-kivo-800">P · </span>
                        )}
                        {t.triage_urgencia_vital && (
                          <span className="text-rose-700">Urg. vital · </span>
                        )}
                        {t.triage_efectivo === true && (
                          <span className="text-sky-800">Caja · </span>
                        )}
                        {t.modo_hibrido && <span>Híbrido · </span>}
                        {t.retrasos_aplicados > 0 && (
                          <span>Retrasos: {t.retrasos_aplicados}</span>
                        )}
                        {!t.checkin_completado && t.estado === 'espera' && (
                          <span className="text-amber-800">Sin check-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.estado === 'espera' && (
                          <button
                            type="button"
                            disabled={actionId === t.id}
                            onClick={() => void handleAtender(t.id)}
                            className="rounded-lg bg-kivo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-kivo-700 disabled:opacity-50"
                          >
                            Atender
                          </button>
                        )}
                        {t.estado === 'atendiendo' && (
                          <button
                            type="button"
                            disabled={actionId === t.id}
                            onClick={() => void handleCompletar(t.id)}
                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                          >
                            Completar
                          </button>
                        )}
                        {t.estado === 'pendiente_confirmacion' && (
                          <span className="text-xs text-zinc-500">Esperando código</span>
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
    </PanelShell>
  )
}
