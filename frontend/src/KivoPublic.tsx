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

const NIVELES = ['Principiante', 'Amateur', 'Profesional']

type WizardStep = 'inicio' | 'datos' | 'detalle' | 'confirmado'

type FormState = {
  nombre: string
  telefono: string
  hora: string
  lugarId: string
  planId: string
  // 10 nuevas opciones
  tipoSimulador: string
  nivelHabilidad: string
  extraHidratacion: boolean
  extraVR: boolean
  extraAccesorios: boolean
  transmitirEnVivo: boolean
  telemetriaAvanzada: boolean
  seguroCancelacion: boolean
  // 10 nuevas opciones adicionales
  coachPersonalizado: boolean
  grabacion4K: boolean
  guantesProfesionales: boolean
  setupPersonalizado: boolean
  accesoLounge: boolean
  bebidaEnergizante: boolean
  camaraOnboard: boolean
  simuladorMovimiento: boolean
  auricularesHiFi: boolean
  certificadoParticipacion: boolean
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
    extraHidratacion: false,
    extraVR: false,
    extraAccesorios: false,
    transmitirEnVivo: false,
    telemetriaAvanzada: false,
    seguroCancelacion: false,
    coachPersonalizado: false,
    grabacion4K: false,
    guantesProfesionales: false,
    setupPersonalizado: false,
    accesoLounge: false,
    bebidaEnergizante: false,
    camaraOnboard: false,
    simuladorMovimiento: false,
    auricularesHiFi: false,
    certificadoParticipacion: false,
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
        respuestasExtra: {
          tipoSimulador: form.tipoSimulador,
          nivelHabilidad: form.nivelHabilidad,
          extraHidratacion: form.extraHidratacion,
          extraVR: form.extraVR,
          extraAccesorios: form.extraAccesorios,
          transmitirEnVivo: form.transmitirEnVivo,
          telemetriaAvanzada: form.telemetriaAvanzada,
          seguroCancelacion: form.seguroCancelacion,
          coachPersonalizado: form.coachPersonalizado,
          grabacion4K: form.grabacion4K,
          guantesProfesionales: form.guantesProfesionales,
          setupPersonalizado: form.setupPersonalizado,
          accesoLounge: form.accesoLounge,
          bebidaEnergizante: form.bebidaEnergizante,
          camaraOnboard: form.camaraOnboard,
          simuladorMovimiento: form.simuladorMovimiento,
          auricularesHiFi: form.auricularesHiFi,
          certificadoParticipacion: form.certificadoParticipacion,
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
      link.download = `Reserva-Alpha-${turnoNumero}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error al guardar imagen', err)
    }
  }

  const HeaderBar = () => (
    <header className="relative border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo.jpg" alt="DETAIM" className="h-10 w-auto rounded-lg shadow-lg" />
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter text-white leading-none">DETAIM</span>
            <span className="text-[10px] font-bold tracking-widest text-blue-500 uppercase">Simulación Profesional</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowPlansComparison(true)}
            className="hidden md:block text-xs font-bold text-zinc-400 hover:text-white transition"
          >
            Planes
          </button>
          <Link
            to="/legal/horario-atencion"
            className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-700"
          >
            Horarios
          </Link>
          <a
            href="https://maps.google.com/?q=Centro+Empresarial+B%26E+Cajica"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center gap-2"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="hidden sm:inline">Ubicación</span>
          </a>
        </div>
      </div>
    </header>
  )

  const Footer = () => (
    <footer className="mt-auto border-t border-zinc-800 bg-zinc-950/80 py-12 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.jpg" alt="DETAIM" className="h-8 w-auto rounded" />
              <span className="text-2xl font-black text-white">DETAIM</span>
            </div>
            <p className="text-sm text-zinc-500 max-w-xs leading-relaxed mb-6">
              Líderes en tecnología de simulación en Colombia. Experiencias inmersivas de alta precisión para entrenamiento y recreación.
            </p>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ubicación</p>
              <a 
                href="https://maps.google.com/?q=Centro+Empresarial+B%26E+Cajica" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-white transition flex items-start gap-2 group"
              >
                <svg className="h-4 w-4 text-blue-500 mt-0.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>
                  Centro Empresarial B&E, a 0-50, Cra. 6 #0-2, Cajicá. Oficina 401.
                </span>
              </a>
            </div>
          </div>
          <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li><Link to="/legal/terminos-condiciones" className="hover:text-white transition">Términos y Condiciones</Link></li>
                <li><Link to="/legal/politica-privacidad" className="hover:text-white transition">Privacidad</Link></li>
                <li><Link to="/legal/tratamiento-datos" className="hover:text-white transition">Habeas Data</Link></li>
                <li><Link to="/legal/derechos-autor" className="hover:text-white transition">Copyright</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Compañía</h4>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li><a href="https://detaim.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">detaim.com</a></li>
                <li><Link to="/legal/preguntas-frecuentes" className="hover:text-white transition">Preguntas Frecuentes</Link></li>
                <li><Link to="/legal/horario-atencion" className="hover:text-white transition">Horarios</Link></li>
                <li><Link to="/panel" className="hover:text-white transition">Portal Staff</Link></li>
              </ul>
            </div>
        </div>
        <div className="pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
            © 2026 DETAIM. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 font-bold uppercase">Powered by</span>
            <a href="https://detaim.com" target="_blank" rel="noopener noreferrer">
              <span className="text-xs font-black text-white hover:text-blue-500 transition">DETAIM</span>
            </a>
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
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Piloto</p>
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
      
      {/* Banner de Marca */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 py-3 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
              Sede <span className="text-white">Bogotá / Cajicá</span> — <span className="text-green-500">Pista Abierta</span>
            </p>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-zinc-600 uppercase">Clima:</span>
              <span className="text-[10px] font-black text-white uppercase">Seco / 18°C</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-zinc-600 uppercase">Latencia:</span>
              <span className="text-[10px] font-black text-white uppercase">5ms (Fibra)</span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* Columna Izquierda: Datos y Configuración */}
          <div className="lg:col-span-3 space-y-6 animate-in">
            <div className="p-6 rounded-[2rem] bg-zinc-900 border border-zinc-800 shadow-xl">
              <h3 className="text-lg font-black mb-6 flex items-center gap-3 text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black text-xs font-black">1</span>
                Configuración
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Nombre del Piloto</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">WhatsApp / Celular</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                    placeholder="300 000 0000"
                  />
                </div>
                
                <div className="pt-4 border-t border-zinc-800 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Tipo de Simulador</label>
                    <div className="p-3 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-black text-center uppercase tracking-widest">
                      {form.tipoSimulador}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Nivel de Habilidad</label>
                    <div className="grid grid-cols-3 gap-2">
                      {NIVELES.map(n => (
                        <button
                          key={n}
                          onClick={() => setForm({ ...form, nivelHabilidad: n })}
                          className={`py-2 rounded-lg text-[10px] font-bold border transition ${form.nivelHabilidad === n ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Centro: Calendario y Hora (Más grande y profesional) */}
          <div className="lg:col-span-6 space-y-6 animate-in" style={{ animationDelay: '0.1s' }}>
            <div className="p-10 rounded-[3rem] bg-zinc-900 border border-zinc-800 overflow-hidden min-h-[600px] shadow-2xl relative flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-2xl font-black flex items-center gap-4 text-white tracking-tighter">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black text-sm font-black shadow-lg">2</span>
                    {form.hora ? `Confirmado: ${form.hora}` : 'Agenda tu Sesión'}
                  </h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2 ml-14">
                    Selecciona disponibilidad en tiempo real
                  </p>
                </div>
                {fecha && (
                  <div className="flex flex-col items-end animate-in">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Fecha Seleccionada</span>
                    <span className="text-sm font-black text-white px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      {format(fecha, 'dd MMMM yyyy', { locale: es })}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="relative flex-1 flex flex-col justify-center">
                <div className={`transition-all duration-1000 ease-in-out ${form.hora ? 'opacity-0 -translate-y-10 pointer-events-none absolute inset-0' : 'opacity-100 translate-y-0'}`}>
                  <div className="bg-zinc-800/30 p-8 rounded-[2.5rem] border border-zinc-800/50 backdrop-blur-sm shadow-inner">
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
                </div>

                <div className={`transition-all duration-1000 delay-200 ease-in-out ${!form.hora && fecha ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute inset-0'}`}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-[450px] overflow-y-auto custom-scrollbar-pro pr-4 py-2">
                    {loadingSlots ? (
                      <div className="col-span-full py-20 text-center">
                        <div className="relative inline-block">
                          <div className="h-16 w-16 rounded-full border-4 border-zinc-800 border-t-blue-500 animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 animate-pulse" />
                          </div>
                        </div>
                        <p className="mt-6 text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">Sincronizando Agenda...</p>
                      </div>
                    ) : (
                      availableSlots.map((slot) => (
                        <button
                          key={slot.hora}
                          disabled={slot.reservada}
                          onClick={() => setForm({ ...form, hora: slot.hora })}
                          className={`
                            group relative overflow-hidden rounded-[1.25rem] py-6 text-sm font-black transition-all duration-500
                            ${slot.reservada 
                              ? 'bg-zinc-950/50 text-zinc-800 border border-zinc-900 cursor-not-allowed' 
                              : 'bg-zinc-800 text-white hover:bg-white hover:text-black hover:scale-105 border border-zinc-700 hover:border-white shadow-xl'}
                          `}
                        >
                          <span className="relative z-10">{slot.hora}</span>
                          {!slot.reservada && (
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          )}
                          {slot.reservada && (
                            <div className="absolute top-1 right-1">
                              <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {form.hora && (
                  <div className="flex flex-col items-center justify-center h-full animate-in zoom-in duration-700">
                    <div className="relative mb-10">
                      <div className="absolute -inset-8 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
                      <div className="relative bg-white p-12 rounded-[3rem] border border-white shadow-2xl text-center min-w-[300px]">
                        <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-4">Hora de Ingreso</p>
                        <p className="text-7xl font-black text-black tracking-tighter">{form.hora}</p>
                        <div className="mt-6 h-1 w-12 bg-blue-600 mx-auto rounded-full" />
                      </div>
                    </div>
                    <button 
                      onClick={() => setForm({ ...form, hora: '' })}
                      className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-zinc-800 text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] hover:bg-zinc-700 hover:text-white transition-all duration-500"
                    >
                      <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                      Cambiar Horario
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Plan y Extras */}
          <div className="lg:col-span-3 space-y-6 animate-in" style={{ animationDelay: '0.2s' }}>
            <div className="p-6 rounded-[2rem] bg-zinc-900 border border-zinc-800 shadow-xl">
              <h3 className="text-lg font-black mb-6 flex items-center gap-3 text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black text-xs font-black">3</span>
                Plan & Extras
              </h3>
              <div className="space-y-3 mb-8">
                {PLANES.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setForm({ ...form, planId: plan.id })}
                    className={`
                      w-full text-left p-4 rounded-2xl border transition-all duration-300
                      ${form.planId === plan.id 
                        ? 'bg-blue-600 border-blue-400 scale-[1.02] shadow-xl shadow-blue-500/20 text-white' 
                        : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:border-zinc-500'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{plan.minutos} min</span>
                      <span className="text-xs font-black">${plan.precio}</span>
                    </div>
                    <p className="font-black text-sm">{plan.descripcion}</p>
                  </button>
                ))}
              </div>

              {/* Extras Grouped */}
              <div className="pt-6 border-t border-zinc-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Mejorar mi experiencia</p>
                
                <div className="space-y-6">
                  {/* Categoría: Equipamiento */}
                  <div>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase mb-3 tracking-wider">Equipamiento Pro</p>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'extraVR', label: 'Gafas VR Pro', icon: '🥽' },
                        { id: 'extraAccesorios', label: 'Guantes & Botas', icon: '🧤' },
                        { id: 'guantesProfesionales', label: 'Guantes Carrera', icon: '🏎️' },
                        { id: 'auricularesHiFi', label: 'Audio Hi-Fi', icon: '🎧' },
                        { id: 'simuladorMovimiento', label: 'Movimiento Activo', icon: '🏃' },
                      ].map(ex => (
                        <label key={ex.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800 hover:bg-zinc-800 transition cursor-pointer group">
                          <div className="flex items-center gap-3">
                            <span className="text-sm">{ex.icon}</span>
                            <span className="text-[11px] font-bold text-zinc-300 group-hover:text-white transition">{ex.label}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={(form as any)[ex.id]}
                            onChange={(e) => setForm({ ...form, [ex.id]: e.target.checked })}
                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500/20"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Categoría: Media & Servicios */}
                  <div>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase mb-3 tracking-wider">Media & Servicios</p>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'transmitirEnVivo', label: 'Streaming Twitch', icon: '🎥' },
                        { id: 'telemetriaAvanzada', label: 'Telemetría Pro', icon: '📊' },
                        { id: 'coachPersonalizado', label: 'Coach Privado', icon: '👨‍🏫' },
                        { id: 'grabacion4K', label: 'Video 4K Onboard', icon: '📹' },
                        { id: 'setupPersonalizado', label: 'Setup a Medida', icon: '🔧' },
                      ].map(ex => (
                        <label key={ex.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800 hover:bg-zinc-800 transition cursor-pointer group">
                          <div className="flex items-center gap-3">
                            <span className="text-sm">{ex.icon}</span>
                            <span className="text-[11px] font-bold text-zinc-300 group-hover:text-white transition">{ex.label}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={(form as any)[ex.id]}
                            onChange={(e) => setForm({ ...form, [ex.id]: e.target.checked })}
                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500/20"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Categoría: Hospitalidad */}
                  <div>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase mb-3 tracking-wider">Hospitalidad</p>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'extraHidratacion', label: 'Pack Hidratación', icon: '🥤' },
                        { id: 'bebidaEnergizante', label: 'Energy Drink', icon: '⚡' },
                        { id: 'accesoLounge', label: 'Acceso Lounge', icon: '🛋️' },
                        { id: 'certificadoParticipacion', label: 'Diploma Alpha', icon: '📜' },
                        { id: 'seguroCancelacion', label: 'Seguro Reembolso', icon: '🛡️' },
                      ].map(ex => (
                        <label key={ex.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800 hover:bg-zinc-800 transition cursor-pointer group">
                          <div className="flex items-center gap-3">
                            <span className="text-sm">{ex.icon}</span>
                            <span className="text-[11px] font-bold text-zinc-300 group-hover:text-white transition">{ex.label}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={(form as any)[ex.id]}
                            onChange={(e) => setForm({ ...form, [ex.id]: e.target.checked })}
                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500/20"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-800">
                <button
                  onClick={handleSubmitTurno}
                  disabled={!form.nombre || !form.telefono || !form.hora || reservando}
                  className={`
                    w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-500
                    ${(!form.nombre || !form.telefono || !form.hora || reservando)
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'bg-white text-black hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-white/10'}
                  `}
                >
                  {reservando ? 'Sincronizando...' : 'Confirmar Reserva'}
                </button>
                {submitError && <p className="mt-4 text-center text-[10px] text-red-500 font-black uppercase tracking-widest">{submitError}</p>}
                <p className="mt-4 text-[9px] text-zinc-600 text-center leading-relaxed">
                  Al confirmar, aceptas los <Link to="/legal/terminos-condiciones" className="text-zinc-400 underline">Términos de DETAIM</Link>.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Modals */}
      {showPlansComparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowPlansComparison(false)} />
          <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-[3rem] p-10 overflow-hidden animate-in">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tighter">Comparativa de Sesiones</h2>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">DETAIM Simulación Profesional</p>
              </div>
              <button onClick={() => setShowPlansComparison(false)} className="p-3 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Plan</th>
                    <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Tiempo</th>
                    <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Media</th>
                    <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Extras</th>
                    <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Inversión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {PLANES.map((plan) => (
                    <tr key={plan.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-6 px-6 font-black text-white text-lg">{plan.descripcion}</td>
                      <td className="py-6 px-6 text-zinc-400 font-bold">{plan.minutos} min {plan.diario && 'diarios'}</td>
                      <td className="py-6 px-6 text-zinc-400 font-bold">{plan.fotos > 0 ? `${plan.fotos} Fotos HD` : 'Ilimitado'}</td>
                      <td className="py-6 px-6 text-zinc-500 text-xs font-medium">{plan.usuario ? 'Acceso VIP +1' : plan.diario ? 'Pase Mensual' : 'Acceso Estándar'}</td>
                      <td className="py-6 px-6 font-black text-blue-500 text-xl">${plan.precio}</td>
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
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[3rem] p-12 text-center animate-in shadow-2xl">
            <div className="mb-8 flex justify-center">
              <div className="bg-blue-600/10 p-5 rounded-full border border-blue-500/20">
                <svg className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h2 className="text-3xl font-black mb-2 text-white tracking-tighter">Acceso de Seguridad</h2>
            <p className="text-zinc-500 mb-10 text-sm font-medium">Ingresa el código generado para tu sesión.</p>
            
            <div className="flex justify-center gap-4 mb-10">
              <input
                type="text" maxLength={4} value={codigoDigitado}
                onChange={(e) => setCodigoDigitado(e.target.value.replace(/\D/g, ''))}
                className="w-48 text-center text-5xl font-black tracking-[0.4em] bg-transparent border-b-4 border-zinc-700 focus:border-blue-500 outline-none transition py-3 text-white"
                autoFocus
              />
            </div>
            
            <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 mb-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-2">Código de Seguridad</p>
              <p className="text-4xl font-black tracking-[0.2em] text-white">{codigoAsignado}</p>
            </div>

            <button
              onClick={handleConfirmarCodigoModal}
              disabled={codigoDigitado.length !== 4}
              className="w-full py-5 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-widest transition hover:bg-zinc-200 disabled:opacity-30 shadow-xl"
            >
              Validar Reserva
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
