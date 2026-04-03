import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import PanelShell from './PanelShell'
import {
  crearPreguntaTurnoAdmin,
  eliminarPreguntaTurnoAdmin,
  fetchEmpresaPanel,
  fetchPreguntasTurnoAdmin,
  fetchResumenAdmin,
  getStoredRole,
  logoutPanel,
  type PreguntaTurno,
  type ResumenAdmin,
} from './api/panel'

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: number
  hint?: string
  accent?: 'default' | 'amber' | 'emerald' | 'rose'
}) {
  const ring =
    accent === 'amber'
      ? 'border-amber-100 bg-amber-50/50'
      : accent === 'emerald'
        ? 'border-emerald-100 bg-emerald-50/50'
        : accent === 'rose'
          ? 'border-rose-100 bg-rose-50/50'
          : 'border-zinc-200 bg-white'
  const text =
    accent === 'amber'
      ? 'text-amber-600'
      : accent === 'emerald'
        ? 'text-emerald-600'
        : accent === 'rose'
          ? 'text-rose-600'
          : 'text-zinc-900'
  return (
    <div className={`rounded-3xl border p-6 transition-all duration-300 hover:shadow-md ${ring}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
        {label}
      </p>
      <p className={`mt-2 text-4xl font-bold tabular-nums tracking-tight ${text}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

function QuestionPreview({
  label,
  type,
  options,
}: {
  label: string
  type: 'bool' | 'dropdown' | 'scale10'
  options: string
}) {
  const opts = options
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Previsualización
      </p>
      <div className="mt-3">
        <label className="mb-2 block text-sm font-medium text-zinc-900">
          {label || 'Texto de la pregunta...'}
        </label>
        {type === 'bool' && (
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="radio" disabled className="h-4 w-4" /> Sí
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="radio" disabled className="h-4 w-4" /> No
            </label>
          </div>
        )}
        {type === 'dropdown' && (
          <select disabled className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-400">
            {opts.length > 0 ? (
              opts.map((o, i) => (
                <option key={i} value={o}>
                  {o}
                </option>
              ))
            ) : (
              <option>Esperando opciones...</option>
            )}
          </select>
        )}
        {type === 'scale10' && (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div
                key={n}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-400"
              >
                {n}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PanelAdmin() {
  const navigate = useNavigate()
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [empresaTipo, setEmpresaTipo] = useState('general')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [resumen, setResumen] = useState<ResumenAdmin | null>(null)
  const [preguntas, setPreguntas] = useState<PreguntaTurno[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authOk, setAuthOk] = useState(false)
  const [pregForm, setPregForm] = useState<{
    label: string
    type: 'bool' | 'dropdown' | 'scale10'
    options: string
  }>({ label: '', type: 'bool', options: '' })

  useEffect(() => {
    if (!localStorage.getItem('kivo_token')) {
      logoutPanel()
      navigate('/panel', { replace: true })
      return
    }
    if (getStoredRole() === 'asesor') {
      navigate('/panel/asesor', { replace: true })
      return
    }
    if (getStoredRole() !== 'admin') {
      navigate('/panel', { replace: true })
      return
    }
    setAuthOk(true)
  }, [navigate])

  const cargar = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const emp = await fetchEmpresaPanel()
      setEmpresaNombre(emp.empresa.nombre)
      setEmpresaTipo(emp.empresa.tipo)
      const r = await fetchResumenAdmin(fecha)
      setResumen(r)
      const qs = await fetchPreguntasTurnoAdmin()
      setPreguntas(qs)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar'
      if (msg === 'Sesión expirada') {
        navigate('/panel', { replace: true })
        return
      }
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }, [fecha, navigate])

  const crearPregunta = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadError(null)
    const label = pregForm.label.trim()
    if (!label) {
      setLoadError('Ingresá el texto de la pregunta.')
      return
    }
    const type = pregForm.type
    const options =
      type === 'dropdown'
        ? pregForm.options
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        : undefined
    if (type === 'dropdown' && (!options || !options.length)) {
      setLoadError('Para Dropdown ingresá opciones separadas por coma.')
      return
    }
    setLoading(true)
    try {
      await crearPreguntaTurnoAdmin({ label, type, options })
      setPregForm({ label: '', type: 'bool', options: '' })
      const qs = await fetchPreguntasTurnoAdmin()
      setPreguntas(qs)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error'
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }

  const borrarPregunta = async (id: number) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    setLoading(true)
    setLoadError(null)
    try {
      await eliminarPreguntaTurnoAdmin(id)
      const qs = await fetchPreguntasTurnoAdmin()
      setPreguntas(qs)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error'
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authOk) return
    void cargar()
  }, [authOk, cargar])

  const fechaLabel = useMemo(() => {
    try {
      return format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", {
        locale: es,
      })
    } catch {
      return fecha
    }
  }, [fecha])

  const tot = resumen?.totales

  const bloquesTipo = useMemo(() => {
    const t = empresaTipo
    if (t === 'eps') {
      return (
        <section className="rounded-3xl border border-red-100 bg-red-50/50 p-6">
          <h2 className="text-sm font-semibold text-red-900">EPS · Derivaciones</h2>
          <p className="mt-1 text-sm text-red-950/90">
            Seguimiento de turnos con posible triage de urgencia vital (derivación
            a urgencias). Los números son del día seleccionado y solo de tu EPS.
          </p>
          <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
            <StatCard
              label="Marcados urgencia vital"
              value={tot?.triage_urgencia ?? 0}
              hint="Revisar protocolo clínico"
              accent="rose"
            />
            <StatCard
              label="En espera de ventanilla"
              value={tot?.en_espera ?? 0}
              accent="default"
            />
          </div>
        </section>
      )
    }
    if (t === 'banco') {
      return (
        <section className="rounded-3xl border border-sky-100 bg-sky-50/50 p-6">
          <h2 className="text-sm font-semibold text-sky-900">Banco · Caja</h2>
          <p className="mt-1 text-sm text-sky-950/90">
            Turnos con trámite de efectivo (caja) frente a asesoría sin efectivo.
          </p>
          <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
            <StatCard
              label="Con efectivo / caja"
              value={tot?.triage_efectivo ?? 0}
              hint="Orientados a módulo de caja"
              accent="amber"
            />
            <StatCard
              label="En espera"
              value={tot?.en_espera ?? 0}
              accent="default"
            />
          </div>
        </section>
      )
    }
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">Servicios generales</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Vista resumida de colas por sede. Podés ampliar detalle en la cola de
          atención.
        </p>
      </section>
    )
  }, [empresaTipo, tot])

  if (!authOk) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50 text-zinc-500">
        Verificando acceso…
      </div>
    )
  }

  return (
    <PanelShell variant="admin" empresaNombre={empresaNombre} empresaTipo={empresaTipo}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Resumen del día</h1>
            <p className="mt-1 text-sm text-zinc-600">{fechaLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="admin-fecha">
              Fecha
            </label>
            <input
              id="admin-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            />
            <button
              type="button"
              onClick={() => void cargar()}
              className="rounded-xl border border-kivo-600 bg-kivo-50 px-4 py-2 text-sm font-semibold text-kivo-900 hover:bg-kivo-100"
            >
              Actualizar
            </button>
          </div>
        </div>

        {loadError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </p>
        )}

        {loading && !resumen ? (
          <p className="text-zinc-500">Cargando estadísticas…</p>
        ) : (
          <>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Pend. confirmación" value={tot?.pendientes ?? 0} />
              <StatCard label="En espera" value={tot?.en_espera ?? 0} accent="emerald" />
              <StatCard label="Atendiendo ahora" value={tot?.atendiendo ?? 0} />
              <StatCard label="Completados" value={tot?.completados ?? 0} />
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <StatCard label="Cancelados" value={tot?.cancelados ?? 0} />
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Total movimiento
                </p>
                <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-zinc-900">
                  {(tot?.pendientes ?? 0) +
                    (tot?.en_espera ?? 0) +
                    (tot?.atendiendo ?? 0) +
                    (tot?.completados ?? 0) +
                    (tot?.cancelados ?? 0)}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Suma de estados del día (tu empresa únicamente).
                </p>
              </div>
            </div>

            {bloquesTipo}

            <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">
                Personas en espera por sede
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Compará carga entre puntos de atención de tu red.
              </p>
              <ul className="mt-4 divide-y divide-zinc-100">
                {(resumen?.porSede ?? []).map((row) => (
                  <li
                    key={row.slug}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-4 text-sm"
                  >
                    <span className="font-semibold text-zinc-900">{row.nombre}</span>
                    <span className="tabular-nums text-zinc-600 sm:text-right">
                      <strong className="text-kivo-800 text-lg">{row.espera}</strong> personas en cola
                    </span>
                  </li>
                ))}
                {resumen?.porSede?.length === 0 && (
                  <li className="py-4 text-center text-sm text-zinc-500">
                    No hay sedes registradas o no hay datos para esta fecha.
                  </li>
                )}
              </ul>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">
                Preguntas obligatorias al crear turno
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Se aplican a todas las sedes de tu empresa. Tipos permitidos: Bool,
                Dropdown, 1 a 10.
              </p>

              <form
                onSubmit={(e) => void crearPregunta(e)}
                className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <input
                  value={pregForm.label}
                  onChange={(e) => setPregForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Texto de la pregunta"
                  className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                />
                <select
                  value={pregForm.type}
                  onChange={(e) =>
                    setPregForm((p) => ({
                      ...p,
                      type:
                        e.target.value === 'dropdown'
                          ? 'dropdown'
                          : e.target.value === 'scale10'
                            ? 'scale10'
                            : 'bool',
                    }))
                  }
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
                >
                  <option value="bool">Bool (Sí/No)</option>
                  <option value="dropdown">Dropdown</option>
                  <option value="scale10">1 a 10</option>
                </select>
                <input
                  value={pregForm.options}
                  onChange={(e) => setPregForm((p) => ({ ...p, options: e.target.value }))}
                  placeholder="Opciones (solo Dropdown): A, B, C"
                  disabled={pregForm.type !== 'dropdown'}
                  className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 disabled:bg-zinc-50 sm:col-span-2 lg:col-span-1"
                />

                <div className="sm:col-span-2 lg:col-span-3">
                  <QuestionPreview
                    label={pregForm.label}
                    type={pregForm.type}
                    options={pregForm.options}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 sm:col-span-2 lg:col-span-3"
                >
                  Crear pregunta
                </button>
              </form>

              <ul className="mt-6 divide-y divide-zinc-100">
                {preguntas.map((q) => (
                  <li
                    key={q.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-900">{q.label}</p>
                      <p className="text-xs text-zinc-600">
                        Key: <span className="font-mono">{q.key}</span> · Tipo: {q.type}
                        {q.type === 'dropdown' && q.options?.length
                          ? ` · Opciones: ${q.options.join(', ')}`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void borrarPregunta(q.id)}
                      disabled={loading}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
                {preguntas.length === 0 && (
                  <li className="py-6 text-center text-sm text-zinc-500">
                    No hay preguntas configuradas.
                  </li>
                )}
              </ul>
            </section>
          </>
        )}
      </div>
    </PanelShell>
  )
}
