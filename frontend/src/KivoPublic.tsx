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
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  fetchSedes,
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
]

const NIVELES = ['Principiante', 'Amateur', 'Profesional']

type WizardStep = 'inicio' | 'datos' | 'detalle' | 'confirmado'

type FormState = {
  nombre: string
  telefono: string
  hora: string
  lugarId: string
  planId: string
  tipoSimulador: string
  nivelHabilidad: string
}

function emptyForm(slug: string): FormState {
  return {
    nombre: '',
    telefono: '',
    hora: '',
    lugarId: slug,
    planId: 'plan-15',
    tipoSimulador: 'Simulador de tiro',
    nivelHabilidad: 'Amateur',
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
      let reservas: any[] = []
      try {
        const fechaStr = format(fecha, 'yyyy-MM-dd')
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/sedes/${form.lugarId}/reservas-dia?fecha=${fechaStr}`)
        if (res.ok) {
          reservas = await res.json()
        }
      } catch (err) {
        console.error('Error fetching reservas:', err)
      }

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
      setLoadingSlots(false)
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
        respuestasExtra: {
          tipoSimulador: form.tipoSimulador,
          nivelHabilidad: form.nivelHabilidad,
        },
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
      link.download = `Reserva-DETAIM-${turnoNumero}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error al guardar imagen', err)
    }
  }

  const HeaderBar = () => (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/')}>
          <img src="/logo.jpg" alt="DETAIM" className="h-10 w-auto rounded-xl grayscale group-hover:grayscale-0 transition-all duration-500 shadow-2xl" />
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter text-white">DETAIM</span>
            <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-500 uppercase group-hover:text-blue-500 transition-colors">Precision Simulation</span>
          </div>
        </div>
        <nav className="flex items-center gap-8">
          <button
            onClick={() => setShowPlansComparison(true)}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
          >
            Planes
          </button>
          <Link
            to="/legal/horario-atencion"
            className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
          >
            Horarios
          </Link>
          <a
            href="https://maps.google.com/?q=Centro+Empresarial+B%26E+Cajica"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-zinc-200 active:scale-95 shadow-xl shadow-white/5"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Ubicación
          </a>
        </nav>
      </div>
    </header>
  )

  const Footer = () => (
    <footer className="mt-auto border-t border-white/5 bg-black py-20 selection:bg-white selection:text-black">
      <div className="mx-auto max-w-7xl px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-20">
          <div className="md:col-span-5 space-y-8">
            <div className="flex items-center gap-3">
              <img src="/logo.jpg" alt="DETAIM" className="h-8 w-auto rounded-lg grayscale" />
              <span className="text-2xl font-black tracking-tighter text-white">DETAIM</span>
            </div>
            <p className="text-sm text-zinc-500 max-w-sm leading-relaxed font-medium">
              Redefiniendo el entrenamiento de precisión a través de simuladores tácticos de última generación en Colombia.
            </p>
            <div className="pt-4">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-4">Sede Principal</p>
              <a 
                href="https://maps.google.com/?q=Centro+Empresarial+B%26E+Cajica" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-white transition-colors leading-loose flex items-start gap-3 group"
              >
                <div className="mt-1 h-1 w-1 rounded-full bg-blue-500 group-hover:scale-150 transition-transform" />
                <span>Centro Empresarial B&E, Cajicá. Oficina 401.</span>
              </a>
            </div>
          </div>
          
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-12">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Legal</h4>
              <ul className="space-y-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                <li><Link to="/legal/terminos-condiciones" className="hover:text-white transition-colors">Términos</Link></li>
                <li><Link to="/legal/politica-privacidad" className="hover:text-white transition-colors">Privacidad</Link></li>
                <li><Link to="/legal/tratamiento-datos" className="hover:text-white transition-colors">Habeas Data</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Soporte</h4>
              <ul className="space-y-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                <li><Link to="/legal/preguntas-frecuentes" className="hover:text-white transition-colors">FAQ</Link></li>
                <li><Link to="/legal/horario-atencion" className="hover:text-white transition-colors">Horarios</Link></li>
                <li><Link to="/panel" className="hover:text-white transition-colors">Staff</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Conecta</h4>
              <ul className="space-y-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                <li><a href="https://detaim.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Sitio Web</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Instagram</a></li>
                <li><a href="#" className="hover:text-white transition-colors">WhatsApp</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="pt-12 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-8">
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em]">
            © 2026 DETAIM GLOBAL. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">Powered by</span>
            <span className="text-[11px] font-black text-white tracking-tighter">DETAIM CLOUD</span>
          </div>
        </div>
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
                  <div className="bg-black p-3 rounded-2xl">
                    <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Reserva Confirmada</h2>
                <p className="mt-4 text-7xl font-black tracking-tighter text-black">{turnoNumero}</p>
                <p className="mt-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">DETAIM Simulación Profesional</p>
              </div>
              <div className="p-8 text-left space-y-5 bg-zinc-900">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Tirador</p>
                    <p className="text-sm font-bold text-white">{form.nombre}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Simulador</p>
                    <p className="text-sm font-bold text-white">{form.tipoSimulador}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Fecha y Hora</p>
                  <p className="text-sm font-bold text-white">{format(fecha, 'eeee d \'de\' MMMM', { locale: es })} · {form.hora}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Plan y Nivel</p>
                  <p className="text-sm font-bold text-white">{currentPlan.descripcion} · {form.nivelHabilidad}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Ubicación</p>
                  <p className="text-xs font-bold text-white">Centro Empresarial B&E, Cajicá. Of 401.</p>
                </div>
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-[10px] text-zinc-400 italic text-center">Por favor llega 10 minutos antes para calibrar tu sesión.</p>
                </div>
              </div>
            </div>
            <div className="mt-10 flex flex-col gap-4 w-full max-w-sm">
              <button onClick={handleGuardarImagen} className="w-full rounded-2xl bg-white py-4 text-sm font-bold text-black transition hover:bg-zinc-200 shadow-xl shadow-white/5">
                Guardar Comprobante
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
    <div className="relative flex min-h-svh flex-col bg-black text-white selection:bg-blue-500/30">
      <HeaderBar />
      
      {/* Banner de Marca - Ultra Minimal */}
      <div className="bg-white/[0.02] border-b border-white/5 py-3 overflow-hidden">
        <div className="mx-auto max-w-7xl px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">
              Sede <span className="text-white">Cajicá</span> — <span className="text-zinc-400">Polígono Activo</span>
            </p>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Calibración:</span>
              <span className="text-[9px] font-black text-white uppercase tracking-widest">Óptima</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Status:</span>
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 h-full">
          
          {/* Columna Izquierda: Tirador y Plan */}
          <div className="lg:col-span-4 space-y-8 animate-in">
            {/* Tirador */}
            <div className="p-10 rounded-[2.5rem] bg-zinc-900/40 border border-white/5 shadow-2xl backdrop-blur-sm">
              <h3 className="text-xl font-black mb-10 flex items-center gap-4 text-white tracking-tighter">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black text-[10px] font-black shadow-2xl">01</span>
                Perfil del Tirador
              </h3>
              <div className="space-y-8">
                <div className="group">
                  <label className="block text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-3 group-focus-within:text-white transition-colors">Nombre Completo</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full rounded-2xl bg-white/[0.03] border border-white/5 px-6 py-4.5 text-sm text-white focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-zinc-700"
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="group">
                  <label className="block text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-3 group-focus-within:text-white transition-colors">WhatsApp</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full rounded-2xl bg-white/[0.03] border border-white/5 px-6 py-4.5 text-sm text-white focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-zinc-700"
                    placeholder="300 000 0000"
                  />
                </div>
                <div className="pt-8 border-t border-white/5">
                  <label className="block text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-5">Nivel de Habilidad</label>
                  <div className="grid grid-cols-3 gap-3">
                    {NIVELES.map(n => (
                      <button
                        key={n}
                        onClick={() => setForm({ ...form, nivelHabilidad: n })}
                        className={`py-3.5 rounded-xl text-[9px] font-black border uppercase tracking-widest transition-all duration-500 ${form.nivelHabilidad === n ? 'bg-white border-white text-black shadow-2xl shadow-white/10' : 'bg-transparent border-white/5 text-zinc-600 hover:border-white/20 hover:text-zinc-400'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Selector */}
            <div className="p-10 rounded-[2.5rem] bg-zinc-900/40 border border-white/5 shadow-2xl backdrop-blur-sm">
              <h3 className="text-xl font-black mb-10 flex items-center gap-4 text-white tracking-tighter">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black text-[10px] font-black shadow-2xl">02</span>
                Sesión de Tiro
              </h3>
              <div className="space-y-4">
                {PLANES.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setForm({ ...form, planId: plan.id })}
                    className={`
                      group w-full text-left p-6 rounded-2xl border transition-all duration-500
                      ${form.planId === plan.id 
                        ? 'bg-white border-white shadow-2xl shadow-white/5 text-black' 
                        : 'bg-white/[0.02] text-zinc-500 border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}
                    `}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${form.planId === plan.id ? 'text-black/40' : 'text-zinc-700'}`}>{plan.minutos} min</span>
                      <span className="text-lg font-black tracking-tighter">${plan.precio}</span>
                    </div>
                    <p className="font-black text-sm uppercase tracking-tight">{plan.descripcion}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Calendario y Hora Integrados */}
          <div className="lg:col-span-8 space-y-8 animate-in" style={{ animationDelay: '0.1s' }}>
            <div className="p-12 rounded-[3.5rem] bg-zinc-900/40 border border-white/5 shadow-2xl backdrop-blur-sm min-h-[800px] relative overflow-hidden flex flex-col">
              {/* Header de la sección */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                <div className="space-y-3">
                  <h3 className="text-5xl font-black tracking-tighter text-white flex items-center gap-6">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black text-sm font-black shadow-2xl">03</span>
                    {form.hora ? 'Confirmado' : 'Agenda'}
                  </h3>
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-20">
                    Disponibilidad Global en Tiempo Real
                  </p>
                </div>
                {fecha && (
                  <div className="bg-white/5 border border-white/10 rounded-3xl px-8 py-5 backdrop-blur-2xl animate-in fade-in slide-in-from-right-8">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em] mb-2 text-right">Sesión para el</p>
                    <p className="text-2xl font-black text-white tracking-tighter">{format(fecha, 'dd MMMM yyyy', { locale: es })}</p>
                  </div>
                )}
              </div>

              {/* Contenido Principal */}
              <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-16">
                {/* Calendario */}
                <div className={`transition-all duration-1000 ease-in-out flex flex-col items-center justify-center ${form.hora ? 'opacity-10 scale-95 pointer-events-none blur-md' : 'opacity-100 scale-100'}`}>
                  <div className="bg-black/20 p-10 rounded-[3.5rem] border border-white/5 shadow-inner w-full">
                    <DayPicker
                      mode="single"
                      selected={fecha}
                      onSelect={setFecha}
                      locale={es}
                      disabled={{ before: today }}
                      className="detaim-calendar-pro mx-auto"
                      modifiersClassNames={{ selected: 'rdp-selected' }}
                    />
                  </div>
                  <div className="mt-12 flex gap-8">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Seleccionado</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Disponible</span>
                    </div>
                  </div>
                </div>

                {/* Selector de Horas */}
                <div className={`flex flex-col h-full transition-all duration-1000 ${!fecha ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                  {!form.hora ? (
                    <>
                      <div className="flex items-center justify-between mb-8">
                        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em]">Horarios de Sesión</h4>
                        {loadingSlots && <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-6 custom-scrollbar-pro">
                        {loadingSlots ? (
                          <div className="h-full flex flex-col items-center justify-center space-y-6">
                            <div className="h-12 w-12 border-2 border-white/5 border-t-white rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em]">Cargando...</p>
                          </div>
                        ) : availableSlots.length > 0 ? (
                          <div className="grid grid-cols-3 gap-4">
                            {availableSlots.map((slot) => (
                              <button
                                key={slot.hora}
                                disabled={slot.reservada}
                                onClick={() => setForm({ ...form, hora: slot.hora })}
                                className={`
                                  relative overflow-hidden rounded-[1.25rem] py-7 text-sm font-black transition-all duration-500
                                  ${slot.reservada 
                                    ? 'bg-black/40 text-zinc-800 border border-white/5 cursor-not-allowed' 
                                    : 'bg-white/[0.03] text-white hover:bg-white hover:text-black hover:scale-[1.05] border border-white/5 hover:border-white shadow-2xl'}
                                `}
                              >
                                <span className="relative z-10">{slot.hora}</span>
                                {!slot.reservada && (
                                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-20">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">No hay horarios disponibles</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full animate-in zoom-in duration-1000">
                      <div className="relative group">
                        <div className="absolute -inset-20 bg-white/5 rounded-full blur-[120px] animate-pulse transition-all duration-1000" />
                        <div className="relative bg-white p-20 rounded-[5rem] border border-white shadow-2xl text-center min-w-[360px] transition-transform hover:scale-105 duration-700">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.6em] mb-8">Confirmado</p>
                          <p className="text-9xl font-black text-black tracking-tighter leading-none">{form.hora}</p>
                          <div className="mt-12 h-1.5 w-20 bg-black mx-auto rounded-full opacity-10" />
                        </div>
                      </div>
                      
                      <div className="mt-20 space-y-5 w-full max-w-xs">
                        <button
                          onClick={handleSubmitTurno}
                          disabled={!form.nombre || !form.telefono || reservando}
                          className={`
                            w-full py-7 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] transition-all duration-700 shadow-2xl
                            ${(!form.nombre || !form.telefono || reservando)
                              ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed border border-white/5'
                              : 'bg-white text-black hover:bg-zinc-200 hover:scale-[1.02] active:scale-[0.98] shadow-white/5'}
                          `}
                        >
                          {reservando ? 'Procesando...' : 'Finalizar Reserva'}
                        </button>
                        
                        <button 
                          onClick={() => setForm({ ...form, hora: '' })}
                          className="w-full py-5 rounded-2xl bg-transparent text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] hover:text-white transition-all duration-500"
                        >
                          Cambiar Horario
                        </button>
                      </div>
                      
                      {submitError && <p className="mt-8 text-center text-[10px] text-red-500 font-black uppercase tracking-[0.3em] animate-pulse">{submitError}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Disclaimer minimalista en el centro */}
              {!form.hora && (
                <div className="mt-16 pt-12 border-t border-white/5 flex items-center justify-between">
                  <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">
                    Seguridad Encriptada <span className="text-zinc-500">DETAIM Cloud</span>
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.3em]">Latencia 2ms</span>
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {showPlansComparison && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={() => setShowPlansComparison(false)} />
          <div className="relative w-full max-w-5xl bg-zinc-900/50 border border-white/5 rounded-[4rem] p-12 overflow-hidden animate-in fade-in zoom-in duration-500 shadow-2xl">
            <div className="flex justify-between items-start mb-16">
              <div className="space-y-3">
                <h2 className="text-5xl font-black text-white tracking-tighter">Planes de Entrenamiento</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">DETAIM Strategic Comparison</p>
              </div>
              <button onClick={() => setShowPlansComparison(false)} className="group p-4 rounded-full bg-white/5 text-zinc-500 hover:bg-white hover:text-black transition-all duration-500 shadow-xl">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-x-auto custom-scrollbar-pro">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-6 px-4 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600">Configuración</th>
                    <th className="py-6 px-4 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600">Duración</th>
                    <th className="py-6 px-4 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600">Media Assets</th>
                    <th className="py-6 px-4 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600">Inversión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {PLANES.map((plan) => (
                    <tr key={plan.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-8 px-4 font-black text-white text-xl tracking-tighter uppercase">{plan.descripcion}</td>
                      <td className="py-8 px-4 text-zinc-400 font-bold uppercase tracking-widest text-[11px]">{plan.minutos} min</td>
                      <td className="py-8 px-4 text-zinc-500 font-bold uppercase tracking-widest text-[11px]">{plan.fotos > 0 ? `${plan.fotos} Capturas HD` : 'Ilimitado'}</td>
                      <td className="py-8 px-4 font-black text-white text-2xl tracking-tighter">${plan.precio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalCodigoOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" />
          <div className="relative w-full max-w-lg bg-zinc-900/50 border border-white/5 rounded-[4rem] p-16 text-center animate-in fade-in slide-in-from-bottom-8 duration-700 shadow-2xl">
            <div className="mb-12 flex justify-center">
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 shadow-2xl">
                <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h2 className="text-4xl font-black mb-4 text-white tracking-tighter uppercase">Protocolo de Seguridad</h2>
            <p className="text-zinc-500 mb-12 text-[10px] font-black uppercase tracking-[0.4em]">Autenticación de Reserva Requerida</p>
            
            <div className="flex justify-center mb-12">
              <input
                type="text" maxLength={4} value={codigoDigitado}
                onChange={(e) => setCodigoDigitado(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center text-7xl font-black tracking-[0.5em] bg-transparent border-b border-white/10 focus:border-white outline-none transition-all py-6 text-white selection:bg-white selection:text-black"
                autoFocus
                placeholder="0000"
              />
            </div>
            
            <div className="p-8 rounded-[2.5rem] bg-white text-black mb-12 shadow-2xl">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40 mb-3">Clave Generada</p>
              <p className="text-5xl font-black tracking-[0.3em]">{codigoAsignado}</p>
            </div>

            <button
              onClick={handleConfirmarCodigoModal}
              disabled={codigoDigitado.length !== 4}
              className="w-full py-7 rounded-[2rem] bg-white text-black font-black text-xs uppercase tracking-[0.3em] transition-all hover:bg-zinc-200 disabled:opacity-10 shadow-2xl active:scale-95"
            >
              Validar Protocolo
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
