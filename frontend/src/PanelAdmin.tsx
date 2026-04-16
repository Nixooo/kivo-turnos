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
      ? 'border-amber-500/20 bg-amber-500/5'
      : accent === 'emerald'
        ? 'border-emerald-500/20 bg-emerald-500/5'
        : accent === 'rose'
          ? 'border-rose-500/20 bg-rose-500/5'
          : 'border-zinc-800 bg-zinc-900/50'
  const text =
    accent === 'amber'
      ? 'text-amber-400'
      : accent === 'emerald'
        ? 'text-emerald-400'
        : accent === 'rose'
          ? 'text-rose-400'
          : 'text-white'
  return (
    <div className={`rounded-3xl border p-6 transition-all duration-300 hover:shadow-xl ${ring}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-2 text-4xl font-black tabular-nums tracking-tight ${text}`}>{value}</p>
      {hint && <p className="mt-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{hint}</p>}
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
    if (!localStorage.getItem('detaim_token')) {
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
      <div className="space-y-10 animate-in">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Resumen Operativo</h1>
            <p className="mt-1 text-sm text-zinc-500 font-medium">{fechaLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 bg-zinc-900/50 p-4 rounded-[1.5rem] border border-zinc-800">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500" htmlFor="admin-fecha">
                Filtrar por Fecha
              </label>
              <input
                id="admin-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-transparent text-sm font-bold text-white outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void cargar()}
              className="rounded-xl bg-white px-6 py-2.5 text-xs font-bold text-black hover:bg-zinc-200 transition shadow-lg shadow-white/5"
            >
              Actualizar
            </button>
          </div>
        </div>

        {loadError && (
          <p className="rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-sm font-bold text-red-400">
            {loadError}
          </p>
        )}

        {loading && !resumen ? (
          <p className="text-zinc-500 font-bold text-center py-20">Cargando estadísticas…</p>
        ) : (
          <>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Pend. confirmación" value={tot?.pendientes ?? 0} />
              <StatCard label="En espera" value={tot?.en_espera ?? 0} accent="emerald" />
              <StatCard label="Atendiendo ahora" value={tot?.atendiendo ?? 0} accent="amber" />
              <StatCard label="Completados" value={tot?.completados ?? 0} />
            </div>
            
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
              <StatCard label="Cancelados" value={tot?.cancelados ?? 0} accent="rose" />
              <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-8 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Total movimiento
                </p>
                <p className="mt-4 text-5xl font-black tabular-nums tracking-tighter text-white">
                  {(tot?.pendientes ?? 0) +
                    (tot?.en_espera ?? 0) +
                    (tot?.atendiendo ?? 0) +
                    (tot?.completados ?? 0) +
                    (tot?.cancelados ?? 0)}
                </p>
                <p className="mt-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-relaxed">
                  Suma total de interacciones registradas en el sistema para la fecha seleccionada.
                </p>
              </div>
            </div>

            <section className="rounded-[2.5rem] border border-zinc-800 bg-zinc-900/30 p-8">
              <h2 className="text-xl font-black text-white mb-2">
                Personas en espera por sede
              </h2>
              <p className="text-sm text-zinc-500 font-medium mb-8">
                Visualización de carga operativa por punto de atención.
              </p>
              <ul className="divide-y divide-zinc-800">
                {(resumen?.porSede ?? []).map((row) => (
                  <li
                    key={row.slug}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-6"
                  >
                    <span className="font-bold text-white text-lg">{row.nombre}</span>
                    <span className="tabular-nums text-zinc-400 font-bold uppercase tracking-widest text-xs">
                      <strong className="text-white text-2xl font-black mr-2">{row.espera}</strong> en espera
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </PanelShell>
  )
}
