import {
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react'
import { toPng } from 'html-to-image'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'
import { format, startOfToday } from 'date-fns'
import type { SedeApi } from './api/kivo'
import { useNavigate, useParams } from 'react-router-dom'
import {
  fetchSedes,
  fetchEmpresaPorSlug,
  reservarTurno,
  confirmarTurno,
} from './api/kivo'

const PLANES = [
  {
    id: 'plan-10',
    minutos: 10,
    precio: '20.000',
    fotos: 2,
    descripcion: 'Sesión rápida',
    color: 'from-blue-500 to-cyan-400',
  },
  {
    id: 'plan-15',
    minutos: 15,
    precio: '30.000',
    fotos: 3,
    descripcion: 'Sesión estándar',
    color: 'from-purple-500 to-pink-400',
  },
  {
    id: 'plan-30',
    minutos: 30,
    precio: '50.000',
    fotos: 5,
    usuario: true,
    descripcion: 'Sesión extendida',
    color: 'from-orange-500 to-yellow-400',
  },
  {
    id: 'membresia',
    minutos: 15,
    precio: '360.000',
    diario: true,
    fotos: 0,
    descripcion: 'Membresía 30 días',
    color: 'from-green-500 to-emerald-400',
  },
]

type WizardStep = 'inicio' | 'datos' | 'detalle' | 'confirmado'

type FormState = {
  nombre: string
  telefono: string
  hora: string
  lugarId: string
  planId: string
}

function emptyForm(slug: string): FormState {
  return {
    nombre: '',
    telefono: '',
    hora: '',
    lugarId: slug,
    planId: 'plan-15',
  }
}

export default function KivoPublic() {
  const navigate = useNavigate()
  const { empresaSlug } = useParams<{ empresaSlug?: string }>()
  const today = useMemo(() => startOfToday(), [])
  const ticketRef = useRef<HTMLDivElement>(null)

  const [sedes, setSedes] = useState<SedeApi[]>([])

  const [paso, setPaso] = useState<WizardStep>('inicio')
  const [fecha, setFecha] = useState<Date | undefined>(today)
  const [form, setForm] = useState<FormState>(() => emptyForm(''))
  const [turnoNumero, setTurnoNumero] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [reservando, setReservando] = useState(false)
  const [codigoAsignado, setCodigoAsignado] = useState('')
  const [codigoDigitado, setCodigoDigitado] = useState('')
  const [reservaTemporalId, setReservaTemporalId] = useState<string | null>(null)
  const [modalCodigoOpen, setModalCodigoOpen] = useState(false)

  const [showPlansComparison, setShowPlansComparison] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<{hora: string, reservada: boolean}[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const currentPlan = PLANES.find(p => p.id === form.planId) || PLANES[1]

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchSedes(empresaSlug || 'detaim')
        setSedes(data)
        if (data.length) {
          setForm(f => ({ ...f, lugarId: data[0].id }))
        }
      } catch (err) {
        console.error('No se pudieron cargar las sedes.', err)
      }
    }
    load()
  }, [empresaSlug])

  useEffect(() => {
    if (!fecha || !form.lugarId) return
    
    const loadSlots = async () => {
      setLoadingSlots(true)
      try {
        const fechaStr = format(fecha, 'yyyy-MM-dd')
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/sedes/${form.lugarId}/reservas-dia?fecha=${fechaStr}`)
        const reservas = await res.json()
        
        const slots = []
        for (let h = 9; h < 20; h++) {
          for (let m = 0; m < 60; m += 10) {
            const horaStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
            const reservada = Array.isArray(reservas) && reservas.some((r: any) => {
              const [rh, rm] = r.hora_turno.split(':').map(Number)
              const start = rh * 60 + rm
              const end = start + (r.duracion_minutos || 15)
              const current = h * 60 + m
              return current >= start && current < end
            })
            slots.push({ hora: horaStr, reservada })
          }
        }
        setAvailableSlots(slots)
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [fecha, form.lugarId])

  const handleSubmitTurno = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fecha || !form.hora || reservando) return
    setSubmitError(null)
    setReservando(true)
    const fechaStr = format(fecha, 'yyyy-MM-dd')
    const idempotencyKey = crypto.randomUUID()
    try {
      const res = await reservarTurno({
        sedeSlug: form.lugarId,
        documento: '0',
        nombre: form.nombre,
        apellido: '',
        telefono: form.telefono,
        fechaTurno: fechaStr,
        horaTurno: form.hora,
        duracionMinutos: currentPlan.minutos,
        planId: currentPlan.id,
        prioridad: 'ninguna',
        triageUrgenciaVital: false,
        triageEfectivo: false,
        modoHibrido: true,
        respuestasExtra: {},
        idempotencyKey,
      })
      setReservaTemporalId(res.id)
      setCodigoAsignado(res.codigoSeguro)
      setCodigoDigitado('')
      setModalCodigoOpen(true)
    } catch (err: any) {
      setSubmitError(err.message || 'No se pudo hacer la reserva.')
    } finally {
      setReservando(false)
    }
  }

  const handleConfirmarCodigoModal = async () => {
    if (!reservaTemporalId) return
    const c = codigoDigitado.replace(/\D/g, '')
    if (c.length !== 4) return
    try {
      const r = await confirmarTurno(reservaTemporalId, c)
      setTurnoNumero(r.numeroPublico ?? '')
      setPaso('confirmado')
      setModalCodigoOpen(false)
    } catch {
      setSubmitError('Código incorrecto.')
    }
  }

  const resetTodo = () => {
    setPaso('inicio')
    setForm(emptyForm(sedes[0]?.id || ''))
    setFecha(today)
    setTurnoNumero('')
    setSubmitError(null)
  }

  const handleGuardarImagen = async () => {
    if (ticketRef.current === null) return
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true })
      const link = document.createElement('a')
      link.download = `Reserva-${turnoNumero}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error al guardar imagen', err)
    }
  }

  const HeaderBar = () => (
    <header className="relative border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo.jpg" alt="DETAIM" className="h-10 w-auto rounded-lg object-contain" />
          <span className="text-xl font-bold tracking-tight text-white">DETAIM</span>
        </div>
        <button
          onClick={() => setShowPlansComparison(true)}
          className="rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          Ver comparación de planes
        </button>
      </div>
    </header>
  )

  const Footer = () => (
    <footer className="mt-auto border-t border-zinc-800 bg-zinc-950/80 py-8 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <p className="text-xs text-zinc-500">© 2026 DETAIM. Todos los derechos reservados.</p>
      </div>
    </footer>
  )

  if (paso === 'confirmado' && fecha) {
    return (
      <div className="relative flex min-h-svh flex-col overflow-hidden bg-black text-white">
        <HeaderBar />
        <main className="relative mx-auto w-full max-w-lg flex-1 px-6 py-10 pb-24">
          <div className="flex h-full flex-col items-center justify-center text-center animate-in">
            <div ref={ticketRef} className="w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-zinc-800 bg-zinc-900 shadow-2xl">
              <div className="bg-white p-8 text-black">
                <div className="flex justify-center mb-4">
                  <img src="/logo.jpg" alt="" className="h-12 w-auto object-contain" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] opacity-60">Reserva confirmada</h2>
                <p className="mt-4 text-7xl font-black tracking-tighter">{turnoNumero}</p>
              </div>
              <div className="p-8 text-left space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cliente</p>
                  <p className="text-lg font-semibold text-white">{form.nombre}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Fecha y Hora</p>
                  <p className="text-lg font-semibold text-white">{format(fecha, 'eeee d \'de\' MMMM', { locale: es })} · {form.hora}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Plan seleccionado</p>
                  <p className="text-lg font-semibold text-white">{currentPlan.descripcion} ({currentPlan.minutos} min)</p>
                </div>
              </div>
            </div>
            <div className="mt-10 flex flex-col gap-4 w-full max-w-sm">
              <button onClick={handleGuardarImagen} className="w-full rounded-2xl bg-white py-4 text-sm font-bold text-black transition hover:bg-zinc-200">
                Guardar comprobante
              </button>
              <button onClick={resetTodo} className="w-full rounded-2xl border border-zinc-800 py-4 text-sm font-bold text-white transition hover:bg-zinc-900">
                Hacer otra reserva
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-black text-white selection:bg-white/10">
      <HeaderBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          {/* Columna Izquierda */}
          <div className="lg:col-span-3 space-y-6 animate-in">
            <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black text-xs">1</span>
                Tus Datos
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Nombre Completo</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Celular</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition"
                    placeholder="Ej. 3001234567"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Columna Centro */}
          <div className="lg:col-span-6 space-y-6 animate-in" style={{ animationDelay: '0.1s' }}>
            <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden min-h-[500px]">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black text-xs">2</span>
                {form.hora ? `Hora: ${form.hora}` : 'Selecciona el día'}
              </h3>
              <div className="relative">
                <div className={`transition-all duration-500 ${form.hora ? 'opacity-0 scale-95 pointer-events-none absolute inset-0' : 'opacity-100 scale-100'}`}>
                  <DayPicker
                    mode="single"
                    selected={fecha}
                    onSelect={setFecha}
                    locale={es}
                    disabled={{ before: today }}
                    className="detaim-calendar mx-auto"
                    modifiersClassNames={{ selected: 'rdp-selected' }}
                  />
                </div>
                <div className={`transition-all duration-500 delay-100 ${!form.hora && fecha ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none absolute inset-0'}`}>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {loadingSlots ? (
                      <div className="col-span-full py-20 text-center text-zinc-500">Cargando disponibilidad...</div>
                    ) : (
                      availableSlots.map((slot) => (
                        <button
                          key={slot.hora}
                          disabled={slot.reservada}
                          onClick={() => setForm({ ...form, hora: slot.hora })}
                          className={`rounded-xl py-3 text-sm font-semibold transition ${slot.reservada ? 'bg-red-500/10 text-red-500 border border-red-500/20 cursor-not-allowed' : 'bg-zinc-800 text-white hover:bg-white hover:text-black border border-transparent'}`}
                        >
                          {slot.hora}
                          {slot.reservada && <span className="block text-[8px] uppercase mt-1">Reservado</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                {form.hora && (
                  <div className="mt-8 flex justify-center">
                    <button onClick={() => setForm({ ...form, hora: '' })} className="text-sm font-bold text-zinc-500 hover:text-white transition flex items-center gap-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      Cambiar fecha u hora
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="lg:col-span-3 space-y-6 animate-in" style={{ animationDelay: '0.2s' }}>
            <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black text-xs">3</span>
                Elige tu Plan
              </h3>
              <div className="space-y-3">
                {PLANES.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setForm({ ...form, planId: plan.id })}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 ${form.planId === plan.id ? 'bg-white text-black border-white scale-[1.02] shadow-xl shadow-white/5' : 'bg-zinc-800/50 text-white border-zinc-700 hover:border-zinc-500'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold uppercase tracking-widest opacity-60">{plan.minutos} min</span>
                      <span className="text-sm font-black">${plan.precio}</span>
                    </div>
                    <p className="font-bold">{plan.descripcion}</p>
                  </button>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-zinc-800">
                <button
                  onClick={handleSubmitTurno}
                  disabled={!form.nombre || !form.telefono || !form.hora || reservando}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all duration-300 ${(!form.nombre || !form.telefono || !form.hora || reservando) ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20'}`}
                >
                  {reservando ? 'Procesando...' : 'Confirmar Reserva'}
                </button>
                {submitError && <p className="mt-4 text-center text-xs text-red-400 font-bold">{submitError}</p>}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {showPlansComparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowPlansComparison(false)} />
          <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 overflow-hidden animate-in">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white">Comparación de Planes</h2>
              <button onClick={() => setShowPlansComparison(false)} className="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="py-4 px-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Plan</th>
                    <th className="py-4 px-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Tiempo</th>
                    <th className="py-4 px-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Fotos</th>
                    <th className="py-4 px-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Extras</th>
                    <th className="py-4 px-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {PLANES.map((plan) => (
                    <tr key={plan.id} className="hover:bg-zinc-800/50 transition">
                      <td className="py-4 px-4 font-bold text-white">{plan.descripcion}</td>
                      <td className="py-4 px-4 text-zinc-400">{plan.minutos} min {plan.diario && 'diarios'}</td>
                      <td className="py-4 px-4 text-zinc-400">{plan.fotos > 0 ? `${plan.fotos} fotos` : 'N/A'}</td>
                      <td className="py-4 px-4 text-zinc-400">{plan.usuario ? 'Incluye 1 usuario' : plan.diario ? 'Válido por 30 días' : '—'}</td>
                      <td className="py-4 px-4 font-black text-white">${plan.precio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalCodigoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 text-center animate-in">
            <h2 className="text-2xl font-bold mb-2 text-white">Verifica tu Reserva</h2>
            <p className="text-zinc-400 mb-8 text-sm">Ingresa el código de 4 dígitos para confirmar.</p>
            <input
              type="text" maxLength={4} value={codigoDigitado}
              onChange={(e) => setCodigoDigitado(e.target.value.replace(/\D/g, ''))}
              className="w-40 text-center text-4xl font-black tracking-[0.5em] bg-transparent border-b-2 border-white focus:outline-none focus:border-blue-500 transition py-2 text-white mb-8"
              autoFocus
            />
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Tu código es</p>
              <p className="text-2xl font-black tracking-[0.3em] text-white">{codigoAsignado}</p>
            </div>
            <button onClick={handleConfirmarCodigoModal} disabled={codigoDigitado.length !== 4} className="w-full py-4 rounded-2xl bg-white text-black font-bold text-sm transition hover:bg-zinc-200 disabled:opacity-50">
              Confirmar Reserva
            </button>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
