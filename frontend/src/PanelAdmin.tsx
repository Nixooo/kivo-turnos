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
  adelantarTurno,
  reasignarTurno,
  updatePrecioPlan,
  fetchPlanes,
  updateConfigSede,
  crearPlan,
  eliminarPlan,
  type ResumenAdmin,
} from './api/panel'


function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string
  value: number
  hint?: string
  accent?: 'default' | 'amber' | 'emerald' | 'rose' | 'blue'
  icon?: React.ReactNode
}) {
  const ring =
    accent === 'amber'
      ? 'border-amber-100 bg-amber-50/50'
      : accent === 'emerald'
        ? 'border-emerald-100 bg-emerald-50/50'
        : accent === 'rose'
          ? 'border-rose-100 bg-rose-50/50'
          : accent === 'blue'
            ? 'border-blue-100 bg-blue-50/50'
            : 'border-zinc-100 bg-white'
  const text =
    accent === 'amber'
      ? 'text-amber-600'
      : accent === 'emerald'
        ? 'text-emerald-600'
        : accent === 'rose'
          ? 'text-rose-600'
          : accent === 'blue'
            ? 'text-blue-600'
            : 'text-black'
  const dot =
    accent === 'amber'
      ? 'bg-amber-500'
      : accent === 'emerald'
        ? 'bg-emerald-500'
        : accent === 'rose'
          ? 'bg-rose-500'
          : accent === 'blue'
            ? 'bg-blue-500'
            : 'bg-zinc-300'

  return (
    <div className={`rounded-[2.5rem] border p-8 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 ${ring}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${dot}`} />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">
            {label}
          </p>
        </div>
        {icon && <div className={text}>{icon}</div>}
      </div>
      <p className={`text-5xl font-black tabular-nums tracking-tighter ${text}`}>{value}</p>
      {hint && <p className="mt-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{hint}</p>}
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
  const [view, setView] = useState<'stats' | 'calendar' | 'config'>('stats')
  
  // Estados para reasignación
  const [editingTurno, setEditingTurno] = useState<any | null>(null)
  const [newFecha, setNewFecha] = useState('')
  const [newHora, setNewHora] = useState('')

  // Estados para precios y planes
  const [planes, setPlanes] = useState<any[]>([])
  const [updatingPrecio, setUpdatingPrecio] = useState<string | null>(null)
  const [newPrecio, setNewPrecio] = useState('')
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [newPlan, setNewPlan] = useState({ nombre: '', descripcion: '', precio: '', minutos: 60 })

  // Estados para Config Sede
  const [sedeConfig, setSedeConfig] = useState<any>(null)

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
      if (emp.sedes.length) setSedeConfig(emp.sedes[0])

      const r = await fetchResumenAdmin(fecha)
      setResumen(r)
      const t = await fetchTurnosEmpresa(fecha)
      setTurnos(t)

      // Cargar datos extra según la vista
      if (view === 'config') {
        const p = await fetchPlanes()
        setPlanes(p)
      }
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
  }, [fecha, navigate, view])

  useEffect(() => {
    if (!authOk) return
    void cargar()
  }, [authOk, cargar, view])

  const handleAction = async (id: string, action: 'cancel' | 'complete' | 'adelantar') => {
    try {
      if (action === 'cancel') {
        if (!confirm('¿Seguro que deseas eliminar este turno?')) return
        await cancelarTurno(id)
      } else if (action === 'complete') {
        await completarTurno(id)
      } else if (action === 'adelantar') {
        await adelantarTurno(id)
      }
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

  const handleUpdatePrecio = async (planId: string) => {
    if (!newPrecio) return
    try {
      await updatePrecioPlan(planId, newPrecio)
      setUpdatingPrecio(null)
      setNewPrecio('')
      void cargar()
      alert('Precio actualizado con éxito')
    } catch (e) {
      alert('Error al actualizar precio')
    }
  }

  const handleCrearPlan = async () => {
    if (!newPlan.nombre || !newPlan.precio) return
    try {
      await crearPlan(newPlan)
      setIsCreatingPlan(false)
      setNewPlan({ nombre: '', descripcion: '', precio: '', minutos: 60 })
      void cargar()
      alert('Plan creado con éxito')
    } catch (e) {
      alert('Error al crear plan')
    }
  }

  const handleEliminarPlan = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este protocolo de precio?')) return
    try {
      await eliminarPlan(id)
      void cargar()
    } catch (e) {
      alert('Error al eliminar')
    }
  }

  const handleConfigSede = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sedeConfig) return
    try {
      await updateConfigSede(sedeConfig.dbId || sedeConfig.id, {
        hora_apertura: sedeConfig.horaApertura,
        hora_cierre: sedeConfig.horaCierre,
      })
      alert('Configuración guardada')
    } catch (e) {
      alert('Error al guardar configuración')
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
      <div className="flex min-h-svh items-center justify-center bg-white text-zinc-400">
        <div className="flex flex-col items-center gap-6">
          <div className="h-10 w-10 border-4 border-zinc-100 border-t-red-600 rounded-full animate-spin" />
          <p className="text-[11px] font-black uppercase tracking-[0.4em]">Autenticando Acceso...</p>
        </div>
      </div>
    )
  }

  return (
    <PanelShell variant="admin" empresaNombre={empresaNombre} empresaTipo={empresaTipo}>
      <div className="space-y-12 animate-in fade-in duration-1000">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-black uppercase">ALPHA COMMAND</h1>
            <p className="mt-3 text-[12px] text-red-600 font-black tracking-[0.3em] uppercase">{fechaLabel}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 p-2 bg-white rounded-3xl border border-zinc-100 shadow-sm">
            {[
              { id: 'stats', label: 'Métricas' },
              { id: 'calendar', label: 'Agenda' },
              { id: 'config', label: 'Ajustes' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as any)}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${view === tab.id ? 'bg-black text-white shadow-xl' : 'text-zinc-500 hover:text-black'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-6 bg-white p-5 rounded-[2.5rem] border border-zinc-100 shadow-sm">
            <div className="flex items-center gap-5">
              <button onClick={() => setFecha(f => format(subDays(new Date(f + 'T12:00:00'), 1), 'yyyy-MM-dd'))} className="p-3 hover:bg-zinc-50 rounded-2xl text-zinc-500 hover:text-black transition-all">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-transparent text-sm font-black text-black outline-none cursor-pointer"
              />
              <button onClick={() => setFecha(f => format(addDays(new Date(f + 'T12:00:00'), 1), 'yyyy-MM-dd'))} className="p-3 hover:bg-zinc-50 rounded-2xl text-zinc-500 hover:text-black transition-all">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="rounded-[2.5rem] bg-red-50 border border-red-100 p-8 flex items-center gap-6">
            <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse" />
            <p className="text-[12px] font-black text-red-600 uppercase tracking-widest">{loadError}</p>
          </div>
        )}

        {loading && !resumen ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-8">
            <div className="h-16 w-16 border-4 border-zinc-100 border-t-red-600 rounded-full animate-spin" />
            <p className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.5em]">Sincronizando Campo...</p>
          </div>
        ) : view === 'stats' ? (
          <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-1000">
            <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="En Espera" value={resumen?.totales?.en_espera ?? 0} accent="emerald" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
              <StatCard label="En Sesión" value={resumen?.totales?.atendiendo ?? 0} accent="amber" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
              <StatCard label="Completados" value={resumen?.totales?.completados ?? 0} accent="blue" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            </div>
            
            <div className="grid gap-8 grid-cols-1 lg:grid-cols-1">
              <StatCard label="Cancelados" value={resumen?.totales?.cancelados ?? 0} accent="rose" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            </div>
          </div>
        ) : view === 'calendar' ? (
          <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-1000">
            {/* Vista Calendario Semanal */}
            <div className="grid grid-cols-7 gap-6">
              {currentWeek.map((day) => {
                const isSelected = isSameDay(day, new Date(fecha + 'T12:00:00'))
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setFecha(format(day, 'yyyy-MM-dd'))}
                    className={`flex flex-col items-center p-8 rounded-[2.5rem] border transition-all duration-500 ${isSelected ? 'bg-red-600 border-red-600 shadow-2xl scale-105 text-white' : 'bg-white border-zinc-100 hover:border-red-600/30 text-zinc-500 hover:text-black shadow-sm'}`}
                  >
                    <span className={`text-[11px] font-black uppercase tracking-widest mb-3 ${isSelected ? 'text-white/60' : 'text-zinc-400'}`}>{format(day, 'EEE', { locale: es })}</span>
                    <span className={`text-3xl font-black tabular-nums tracking-tighter`}>{format(day, 'd')}</span>
                  </button>
                )
              })}
            </div>

            {/* Lista de Turnos */}
            <div id="print-section" className="rounded-[5rem] border border-zinc-100 bg-white p-12 shadow-sm min-h-[700px]">
              <div className="flex items-center justify-between mb-16 border-b border-zinc-50 pb-10">
                <div className="flex flex-col gap-2">
                  <h3 className="text-3xl font-black text-black tracking-tighter uppercase">Protocolo de Agenda</h3>
                  <p className="print-only hidden text-[10px] font-black text-red-600 uppercase tracking-widest">{fechaLabel}</p>
                </div>
                <span className="px-6 py-2.5 rounded-full bg-red-50 text-red-600 text-[11px] font-black uppercase tracking-widest border border-red-100">
                  {turnos.length} Sesiones Programadas
                </span>
              </div>

              {turnos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 space-y-8 opacity-20">
                  <div className="h-24 w-24 rounded-full border-4 border-zinc-100 flex items-center justify-center">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-[12px] font-black uppercase tracking-[0.5em]">Sin Registros en el Perímetro</p>
                </div>
              ) : (
                <div className="grid gap-8">
                  {turnos.map((t) => (
                    <div key={t.id} className="group relative overflow-hidden rounded-[3rem] border border-zinc-100 bg-zinc-50 p-10 hover:bg-white hover:border-red-600/20 transition-all duration-700 hover:shadow-2xl">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                        <div className="flex items-center gap-10">
                          <div className="text-center min-w-[100px] p-6 bg-white rounded-3xl shadow-sm border border-zinc-50">
                            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-2">Hito</p>
                            <p className="text-4xl font-black text-black tabular-nums tracking-tighter">{t.hora_turno.slice(0, 5)}</p>
                          </div>
                          <div className="h-16 w-[2px] bg-zinc-200 hidden lg:block" />
                          <div>
                            <div className="flex items-center gap-4 mb-3">
                              <span className="text-[11px] font-black text-red-600 uppercase tracking-[0.2em]">{t.numero_publico}</span>
                              <span className="h-1 w-1 rounded-full bg-zinc-300" />
                              <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">{t.plan_id.toUpperCase()}</span>
                            </div>
                            <h4 className="text-2xl font-black text-black tracking-tight uppercase">{t.nombre}</h4>
                            <p className="text-[12px] font-bold text-zinc-500 mt-2 uppercase tracking-widest flex items-center gap-3">
                              <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                              {t.telefono}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <span className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${
                            t.estado === 'completado' ? 'bg-zinc-100 border-zinc-200 text-zinc-500' :
                            t.estado === 'atendiendo' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                            t.estado === 'espera' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                            'bg-zinc-200 border-zinc-300 text-zinc-600'
                          }`}>
                            {t.estado}
                          </span>
                          
                          <div className="flex items-center gap-3 ml-6 no-print">
                            {t.estado === 'espera' && (
                              <>
                                <button onClick={() => handleAction(t.id, 'adelantar')} className="p-4 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20" title="Adelantar Turno">
                                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7 7 7M5 19l7-7 7 7" /></svg>
                                </button>
                                <button onClick={() => handleAction(t.id, 'complete')} className="p-4 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20" title="Finalizar Sesión">
                                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </button>
                              </>
                            )}
                            <button onClick={() => { setEditingTurno(t); setNewFecha(t.fecha_turno); setNewHora(t.hora_turno.slice(0, 5)); }} className="p-4 rounded-2xl bg-black text-white hover:bg-zinc-800 transition-all shadow-xl shadow-black/10" title="Reasignar">
                              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </button>
                            <button onClick={() => handleAction(t.id, 'cancel')} className="p-4 rounded-2xl bg-white border border-zinc-100 text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition-all" title="Eliminar">
                              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
        ) : view === 'config' ? (
          <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-1000">
            {/* Gestión de Precios */}
            <div className="rounded-[4rem] border border-zinc-100 bg-white p-12 shadow-sm">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-3xl font-black text-black tracking-tighter uppercase">Protocolos de Precio</h3>
                <button 
                  onClick={() => setIsCreatingPlan(true)}
                  className="px-6 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-600/20"
                >
                  Nuevo Protocolo
                </button>
              </div>

              {isCreatingPlan && (
                <div className="mb-12 p-10 rounded-[3rem] bg-zinc-50 border-2 border-dashed border-zinc-200 animate-in zoom-in-95 duration-500">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-4">Nombre</label>
                      <input 
                        type="text" 
                        value={newPlan.nombre} 
                        onChange={e => setNewPlan({...newPlan, nombre: e.target.value})}
                        placeholder="Ej: Personalizado"
                        className="w-full bg-white rounded-2xl px-5 py-3 text-sm font-bold outline-none border border-zinc-100 focus:border-red-600 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-4">Descripción</label>
                      <input 
                        type="text" 
                        value={newPlan.descripcion} 
                        onChange={e => setNewPlan({...newPlan, descripcion: e.target.value})}
                        placeholder="Breve detalle..."
                        className="w-full bg-white rounded-2xl px-5 py-3 text-sm font-bold outline-none border border-zinc-100 focus:border-red-600 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-4">Precio</label>
                      <input 
                        type="text" 
                        value={newPlan.precio} 
                        onChange={e => setNewPlan({...newPlan, precio: e.target.value})}
                        placeholder="35.000"
                        className="w-full bg-white rounded-2xl px-5 py-3 text-sm font-bold outline-none border border-zinc-100 focus:border-red-600 transition-all"
                      />
                    </div>
                    <div className="flex items-end gap-3">
                      <button onClick={handleCrearPlan} className="flex-1 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg">Crear</button>
                      <button onClick={() => setIsCreatingPlan(false)} className="px-5 py-3 bg-white border border-zinc-200 text-zinc-400 rounded-2xl text-[10px] font-black uppercase hover:bg-zinc-50 transition-all">X</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {planes.map(plan => (
                  <div key={plan.id} className="p-8 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 hover:bg-white transition-all duration-500 group relative">
                    <button 
                      onClick={() => handleEliminarPlan(plan.id)}
                      className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-white text-zinc-300 hover:text-rose-600 border border-transparent hover:border-rose-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">{plan.nombre}</p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase mb-6 line-clamp-1">{plan.descripcion}</p>
                    {updatingPrecio === plan.id ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          autoFocus
                          value={newPrecio}
                          onChange={e => setNewPrecio(e.target.value)}
                          placeholder="25.000"
                          className="w-full bg-white border-2 border-red-600 rounded-2xl px-5 py-3 text-lg font-black outline-none shadow-xl shadow-red-600/10"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdatePrecio(plan.id)} className="flex-1 py-3 bg-black text-white rounded-xl text-[9px] font-black uppercase hover:bg-zinc-800 transition-all">Guardar</button>
                          <button onClick={() => setUpdatingPrecio(null)} className="flex-1 py-3 bg-zinc-200 text-zinc-600 rounded-xl text-[9px] font-black uppercase">X</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setUpdatingPrecio(plan.id); setNewPrecio(plan.precio); }}
                        className="w-full flex items-center justify-between"
                      >
                        <span className="text-3xl font-black text-black tracking-tighter tabular-nums">${plan.precio}</span>
                        <div className="h-8 w-8 rounded-full bg-white border border-zinc-100 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all shadow-sm">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Horarios de Atención */}
              <div className="rounded-[4rem] border border-zinc-100 bg-white p-12 shadow-sm">
                <h3 className="text-3xl font-black text-black tracking-tighter uppercase mb-8">Horario Operativo</h3>
                {sedeConfig && (
                  <form onSubmit={handleConfigSede} className="space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Apertura</label>
                        <input
                          type="time"
                          value={sedeConfig.horaApertura || ''}
                          onChange={e => setSedeConfig({ ...sedeConfig, horaApertura: e.target.value })}
                          className="w-full bg-zinc-50 border-2 border-transparent rounded-3xl px-8 py-5 text-xl font-black text-black focus:bg-white focus:border-red-600 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Cierre</label>
                        <input
                          type="time"
                          value={sedeConfig.horaCierre || ''}
                          onChange={e => setSedeConfig({ ...sedeConfig, horaCierre: e.target.value })}
                          className="w-full bg-zinc-50 border-2 border-transparent rounded-3xl px-8 py-5 text-xl font-black text-black focus:bg-white focus:border-red-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full py-6 rounded-[2rem] bg-black text-white text-[11px] font-black uppercase tracking-[0.3em] hover:bg-zinc-800 transition-all shadow-xl shadow-black/10">
                      Actualizar Disponibilidad
                    </button>
                  </form>
                )}
              </div>

              {/* Acciones Rápidas y Reportes */}
              <div className="rounded-[4rem] border border-zinc-100 bg-white p-12 shadow-sm">
                <h3 className="text-3xl font-black text-black tracking-tighter uppercase mb-8">Comando Central</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => window.print()} className="p-8 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 text-[10px] font-black uppercase text-zinc-600 hover:bg-black hover:text-white transition-all flex flex-col items-center gap-4 group">
                    <svg className="h-6 w-6 text-zinc-300 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Imprimir Agenda
                  </button>
                  <button onClick={() => void cargar()} className="p-8 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 text-[10px] font-black uppercase text-zinc-600 hover:bg-red-600 hover:text-white transition-all flex flex-col items-center gap-4 group">
                    <svg className="h-6 w-6 text-zinc-300 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Sincronizar
                  </button>
                </div>
              </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * { visibility: hidden; }
                #print-section, #print-section * { visibility: visible; }
                #print-section { position: absolute; left: 0; top: 0; width: 100%; }
                .no-print { display: none !important; }
                .print-only { display: block !important; }
              }
            `}} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 space-y-8 opacity-20">
            <p className="text-[12px] font-black uppercase tracking-[0.5em]">Seleccione una vista del comando</p>
          </div>
        )}

        {/* Modal de Reasignación - Tema Claro */}
        {editingTurno && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setEditingTurno(null)} />
            <div className="relative w-full max-w-xl bg-white border border-zinc-100 rounded-[5rem] p-16 shadow-2xl animate-in zoom-in-95 duration-700">
              <h3 className="text-4xl font-black text-black tracking-tighter mb-4 uppercase">Reasignar Sesión</h3>
              <p className="text-[12px] font-black text-red-600 uppercase tracking-widest mb-12">Tirador: {editingTurno.nombre}</p>
              
              <div className="space-y-10">
                <div className="group">
                  <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-4 group-focus-within:text-black">Nueva Fecha Operativa</label>
                  <input type="date" value={newFecha} onChange={e => setNewFecha(e.target.value)} className="w-full bg-zinc-50 border-2 border-transparent rounded-[2rem] px-8 py-5 text-black font-black text-lg outline-none focus:border-red-600 focus:bg-white transition-all" />
                </div>
                <div className="group">
                  <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-4 group-focus-within:text-black">Nueva Hora de Hito</label>
                  <input type="time" value={newHora} onChange={e => setNewHora(e.target.value)} className="w-full bg-zinc-50 border-2 border-transparent rounded-[2rem] px-8 py-5 text-black font-black text-lg outline-none focus:border-red-600 focus:bg-white transition-all" />
                </div>
                
                <div className="pt-6 flex gap-6">
                  <button onClick={handleReasignar} className="flex-1 py-6 rounded-[2rem] bg-red-600 text-white font-black text-[12px] uppercase tracking-[0.3em] hover:bg-red-700 transition-all shadow-2xl shadow-red-600/20">
                    Guardar Cambios
                  </button>
                  <button onClick={() => setEditingTurno(null)} className="flex-1 py-6 rounded-[2rem] bg-zinc-50 text-zinc-500 font-black text-[12px] uppercase tracking-[0.3em] hover:text-black transition-all">
                    Abortar
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
