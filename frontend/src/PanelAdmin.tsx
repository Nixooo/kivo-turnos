import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import PanelShell from './PanelShell'
import {
  fetchEmpresaPanel,
  fetchResumenAdmin,
  getStoredRole,
  logoutPanel,
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

export default function PanelAdmin() {
  const navigate = useNavigate()
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [empresaTipo, setEmpresaTipo] = useState('general')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [resumen, setResumen] = useState<ResumenAdmin | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authOk, setAuthOk] = useState(false)

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
