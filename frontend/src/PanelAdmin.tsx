import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import PanelShell from './PanelShell'
import {
  fetchEmpresaPanel,
  fetchResumenAdmin,
  getStoredRole,
  logoutPanel,
  fetchTurnosEmpresa,
  cancelarTurno,
  completarTurno,
  reasignarTurno,
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
  const [turnos, setTurnos] = useState<any[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authOk, setAuthOk] = useState(false)
  const [view, setView] = useState<'stats' | 'calendar'>('stats')
  
  // Estados para reasignación
  const [editingTurno, setEditingTurno] = useState<any | null>(null)
  const [newFecha, setNewFecha] = useState('')
  const [newHora, setNewHora] = useState('')

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
      const t = await fetchTurnosEmpresa(fecha)
      setTurnos(t)
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

  const handleAction = async (id: string, action: 'cancel' | 'complete') => {
    try {
      if (action === 'cancel') await cancelarTurno(id)
      else await completarTurno(id)
      void cargar()
    } catch (e) {
      alert('Error al procesar acción')
    }
  }

  const handleReasignar = async () => {
    if (!editingTurno || !newFecha || !newHora) return
    try {
      await reasignarTurno(editingTurno.id, newFecha, newHora)
      setEditingTurno(null)
      void cargar()
    } catch (e) {
      alert('Error al reasignar')
    }
  }

  const fechaLabel = useMemo(() => {
    try {
      return format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", {
        locale: es,
      })
    } catch {
      return fecha
    }
  }, [fecha])

  // Lógica de Calendario Semanal
  const currentWeek = useMemo(() => {
    const start = startOfWeek(new Date(fecha + 'T12:00:00'), { weekStartsOn: 1 })
    const end = endOfWeek(new Date(fecha + 'T12:00:00'), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [fecha])

  if (!authOk) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-black text-zinc-500">
        Verificando acceso…
      </div>
    )
  }

  return (
    <PanelShell variant="admin" empresaNombre={empresaNombre} empresaTipo={empresaTipo}>
      <div className="space-y-10 animate-in fade-in duration-700">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white">Panel de Control</h1>
            <p className="mt-2 text-sm text-zinc-500 font-medium tracking-wide uppercase">{fechaLabel}</p>
          </div>
          
          <div className="flex items-center gap-2 p-1.5 bg-zinc-900/80 rounded-2xl border border-white/5">
            <button
              onClick={() => setView('stats')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'stats' ? 'bg-white text-black shadow-xl' : 'text-zinc-500 hover:text-white'}`}
            >
              Estadísticas
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'calendar' ? 'bg-white text-black shadow-xl' : 'text-zinc-500 hover:text-white'}`}
            >
              Agenda
            </button>
          </div>

          <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-[2rem] border border-white/5 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <button onClick={() => setFecha(f => format(subDays(new Date(f + 'T12:00:00'), 1), 'yyyy-MM-dd'))} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-transparent text-sm font-black text-white outline-none cursor-pointer"
              />
              <button onClick={() => setFecha(f => format(addDays(new Date(f + 'T12:00:00'), 1), 'yyyy-MM-dd'))} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="rounded-3xl bg-red-500/5 border border-red-500/10 p-6 flex items-center gap-4">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm font-black text-red-400 uppercase tracking-widest">{loadError}</p>
          </div>
        )}

        {loading && !resumen ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="h-12 w-12 border-2 border-white/5 border-t-white rounded-full animate-spin" />
            <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em]">Sincronizando Datos...</p>
          </div>
        ) : view === 'stats' ? (
          <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Pend. Confirmación" value={resumen?.totales?.pendientes ?? 0} />
              <StatCard label="En Espera" value={resumen?.totales?.en_espera ?? 0} accent="emerald" />
              <StatCard label="Atendiendo" value={resumen?.totales?.atendiendo ?? 0} accent="amber" />
              <StatCard label="Completados" value={resumen?.totales?.completados ?? 0} />
            </div>
            
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
              <StatCard label="Cancelados" value={resumen?.totales?.cancelados ?? 0} accent="rose" />
              <div className="lg:col-span-2 rounded-[3rem] border border-white/5 bg-zinc-900/30 p-10 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight">Carga por Sede</h2>
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Distribución Operativa</p>
                  </div>
                  <div className="h-1 w-12 bg-white/5 rounded-full" />
                </div>
                <div className="space-y-4">
                  {(resumen?.porSede ?? []).map((row) => (
                    <div key={row.slug} className="group flex items-center justify-between p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                      <span className="font-black text-white uppercase tracking-tight">{row.nombre}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-black text-white tabular-nums tracking-tighter">{row.espera}</span>
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">En Fila</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            {/* Vista Calendario Semanal */}
            <div className="grid grid-cols-7 gap-4">
              {currentWeek.map((day) => {
                const isSelected = isSameDay(day, new Date(fecha + 'T12:00:00'))
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setFecha(format(day, 'yyyy-MM-dd'))}
                    className={`flex flex-col items-center p-6 rounded-3xl border transition-all ${isSelected ? 'bg-white border-white shadow-2xl scale-105' : 'bg-zinc-900/30 border-white/5 hover:bg-zinc-900/50 text-zinc-500 hover:text-white'}`}
                  >
                    <span className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isSelected ? 'text-black/40' : 'text-zinc-600'}`}>{format(day, 'EEE', { locale: es })}</span>
                    <span className={`text-2xl font-black tabular-nums tracking-tighter ${isSelected ? 'text-black' : 'text-white'}`}>{format(day, 'd')}</span>
                  </button>
                )
              })}
            </div>

            {/* Lista de Turnos */}
            <div className="rounded-[4rem] border border-white/5 bg-zinc-900/20 p-10 min-h-[600px]">
              <div className="flex items-center justify-between mb-12 border-b border-white/5 pb-8">
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Agenda del Día</h3>
                <span className="px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                  {turnos.length} Sesiones
                </span>
              </div>

              {turnos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-6 opacity-20">
                  <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Sin turnos programados</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {turnos.map((t) => (
                    <div key={t.id} className="group relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="flex items-center gap-8">
                          <div className="text-center min-w-[80px]">
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Hora</p>
                            <p className="text-3xl font-black text-white tabular-nums tracking-tighter">{t.hora_turno.slice(0, 5)}</p>
                          </div>
                          <div className="h-12 w-[1px] bg-white/5 hidden lg:block" />
                          <div>
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">{t.numero_publico} — {t.plan_id === 'plan-30' ? 'PRO' : 'SPEED'}</p>
                            <h4 className="text-xl font-black text-white tracking-tight uppercase">{t.nombre}</h4>
                            <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">{t.telefono}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                            t.estado === 'completado' ? 'bg-zinc-900 border-zinc-800 text-zinc-600' :
                            t.estado === 'atendiendo' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                            t.estado === 'espera' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                            'bg-zinc-800/50 border-white/5 text-zinc-500'
                          }`}>
                            {t.estado}
                          </span>
                          
                          <div className="flex items-center gap-2 ml-4">
                            {t.estado === 'espera' && (
                              <button onClick={() => handleAction(t.id, 'complete')} className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all shadow-xl shadow-emerald-500/5" title="Marcar como hecho">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              </button>
                            )}
                            <button onClick={() => { setEditingTurno(t); setNewFecha(t.fecha_turno); setNewHora(t.hora_turno.slice(0, 5)); }} className="p-3 rounded-2xl bg-white/5 text-zinc-500 hover:bg-white hover:text-black transition-all" title="Reasignar">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </button>
                            <button onClick={() => handleAction(t.id, 'cancel')} className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all" title="Cancelar">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Reasignación */}
        {editingTurno && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={() => setEditingTurno(null)} />
            <div className="relative w-full max-w-lg bg-zinc-900 border border-white/5 rounded-[4rem] p-12 shadow-2xl animate-in zoom-in-95 duration-500">
              <h3 className="text-3xl font-black text-white tracking-tighter mb-2 uppercase">Reasignar Sesión</h3>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-10">Tirador: {editingTurno.nombre}</p>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-3">Nueva Fecha</label>
                  <input type="date" value={newFecha} onChange={e => setNewFecha(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white font-black outline-none focus:border-white/20 transition-all" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-3">Nueva Hora</label>
                  <input type="time" value={newHora} onChange={e => setNewHora(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white font-black outline-none focus:border-white/20 transition-all" />
                </div>
                
                <div className="pt-4 flex gap-4">
                  <button onClick={handleReasignar} className="flex-1 py-5 rounded-3xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl shadow-white/5">
                    Guardar Cambios
                  </button>
                  <button onClick={() => setEditingTurno(null)} className="flex-1 py-5 rounded-3xl bg-transparent border border-white/5 text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelShell>
  )
}
