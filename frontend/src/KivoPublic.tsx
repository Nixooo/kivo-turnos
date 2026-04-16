import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { format, startOfToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { toPng } from 'html-to-image'

interface SedeApi {
  id: string
  nombre: string
  direccion: string
}

const PLANES = [
  {
    id: 'plan-15',
    minutos: 15,
    precio: '20.000',
    fotos: 2,
    descripcion: 'Sesión rápida',
    color: 'from-blue-600 to-cyan-400',
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

async function fetchSedes(slug: string): Promise<SedeApi[]> {
  const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/empresas/${slug}/sedes`)
  if (!res.ok) return []
  return res.json()
}

export default function KivoPublic() {
  const navigate = useNavigate()
  const { empresaSlug } = useParams<{ empresaSlug?: string }>()
  const today = useMemo(() => startOfToday(), [])
  const ticketRef = useRef<HTMLDivElement>(null)

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
  const [selectedHour, setSelectedHour] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchSedes(empresaSlug || 'detaim')
        if (data.length) {
          setForm(f => ({ ...f, lugarId: data[0].id }))
        } else {
          setForm(f => ({ ...f, lugarId: 'default' }))
        }
      } catch (err) {
        console.error('No se pudieron cargar las sedes.', err)
        setForm(f => ({ ...f, lugarId: 'default' }))
      }
    }
    load()
  }, [empresaSlug])

  useEffect(() => {
    if (!fecha || !form.lugarId) return
    // Reset selection when date changes
    setSelectedHour(null)
    setForm(f => ({ ...f, hora: '' }))
    
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

  const handleSubmitTurno = async () => {
    if (!fecha || !form.hora || !form.nombre || !form.telefono) return
    setReservando(true)
    setSubmitError(null)
    const idempotencyKey = crypto.randomUUID()
    
    try {
      const payload = {
        nombre: form.nombre,
        telefono: form.telefono,
        hora_turno: form.hora,
        fecha_turno: format(fecha, 'yyyy-MM-dd'),
        lugar_id: form.lugarId,
        plan_id: form.planId,
        respuestasExtra: {
          tipoSimulador: form.tipoSimulador,
          nivelHabilidad: form.nivelHabilidad,
        },
        idempotencyKey,
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/turnos-publico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok) {
        setTurnoNumero(data.numero_turno)
        setCodigoAsignado(data.codigo_seguridad)
        setReservaTemporalId(data.id)
        setModalCodigoOpen(true)
      } else {
        setSubmitError(data.error || 'Error al procesar la reserva')
      }
    } catch (err) {
      setSubmitError('Error de conexión con el servidor')
    } finally {
      setReservando(false)
    }
  }

  const handleConfirmarCodigoModal = async () => {
    if (codigoDigitado === codigoAsignado) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/turnos/${reservaTemporalId}/confirmar-publico`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: codigoDigitado }),
        })
        setModalCodigoOpen(false)
        setPaso('confirmado')
      } catch (err) {
        setSubmitError('Error al confirmar el código')
      }
    } else {
      alert('Código incorrecto')
    }
  }

  const downloadTicket = async () => {
    if (ticketRef.current === null) return
    const dataUrl = await toPng(ticketRef.current, { cacheBust: true })
    const link = document.createElement('a')
    link.download = `Reserva-DETAIM-${turnoNumero}.png`
    link.href = dataUrl
    link.click()
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

  if (paso === 'confirmado') {
    return (
      <div className="flex min-h-svh flex-col bg-black text-white">
        <HeaderBar />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center p-8 animate-fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-[3rem] bg-white text-center shadow-2xl" ref={ticketRef}>
            <div className="p-12">
              <div className="mb-8 flex justify-center opacity-10">
                <img src="/logo.jpg" alt="DETAIM" className="h-10 w-auto rounded" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Reserva Confirmada</h2>
              <p className="mt-4 text-8xl font-black tracking-tighter text-black">{turnoNumero}</p>
              <p className="mt-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">DETAIM Simulación Profesional</p>
            </div>
            <div className="p-10 text-left space-y-6 bg-zinc-950">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Tirador</p>
                  <p className="text-sm font-black text-white">{form.nombre}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Operación</p>
                  <p className="text-sm font-black text-white">{form.tipoSimulador}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Fecha</p>
                  <p className="text-sm font-black text-white">{fecha ? format(fecha, 'dd/MM/yyyy') : ''}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Hora</p>
                  <p className="text-sm font-black text-white">{form.hora}</p>
                </div>
              </div>
              <div className="pt-6 border-t border-white/5">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Ubicación</p>
                <p className="text-xs font-black text-white">Centro Empresarial B&E, Cajicá. Of 401.</p>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-6 w-full max-w-md">
            <button
              onClick={downloadTicket}
              className="w-full rounded-[2rem] bg-white px-8 py-6 text-xs font-black uppercase tracking-[0.2em] text-black shadow-2xl transition-all hover:bg-zinc-200 active:scale-95"
            >
              Descargar Comprobante
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 hover:text-white transition-colors"
            >
              Nueva Reserva
            </button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-black text-white selection:bg-blue-500/30">
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes glowPulse {
          0% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.05); }
          50% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.1); }
          100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.05); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes borderGlow {
          0%, 100% { border-color: rgba(255,255,255,0.05); }
          50% { border-color: rgba(255,255,255,0.2); }
        }
        .animate-slide-up { animation: slideUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fadeIn 1.2s ease forwards; }
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        
        .detaim-calendar-pro {
          --rdp-cell-size: 44px;
          --rdp-accent-color: #ffffff;
          --rdp-background-color: #18181b;
          margin: 0;
          width: 100%;
          display: flex;
          justify-content: center;
        }
        .detaim-calendar-pro .rdp-months { justify-content: center; }
        .detaim-calendar-pro .rdp-table { max-width: 100%; }
        .detaim-calendar-pro .rdp-day_selected { 
          background-color: var(--rdp-accent-color) !important; 
          color: #000000 !important;
          font-weight: 900 !important;
          border-radius: 16px !important;
          box-shadow: 0 15px 35px -5px rgba(255,255,255,0.25);
          transform: scale(1.1);
        }
        .detaim-calendar-pro .rdp-day:hover:not(.rdp-day_selected):not(.rdp-day_disabled) {
          background-color: rgba(255,255,255,0.08) !important;
          border-radius: 16px !important;
          transform: translateY(-4px) scale(1.05);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          color: white !important;
        }
        .detaim-calendar-pro .rdp-nav_button {
          color: #71717a !important;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border-radius: 12px !important;
        }
        .detaim-calendar-pro .rdp-nav_button:hover {
          color: #ffffff !important;
          background: rgba(255,255,255,0.08) !important;
          transform: scale(1.1);
        }
        .detaim-calendar-pro .rdp-head_cell {
          font-size: 10px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.3em !important;
          color: #52525b !important;
          padding-bottom: 2rem !important;
        }
        .detaim-calendar-pro .rdp-day {
          font-size: 15px !important;
          font-weight: 500 !important;
          color: #a1a1aa;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .detaim-calendar-pro .rdp-day_today {
          color: #ffffff !important;
          font-weight: 900 !important;
          position: relative;
        }
        .detaim-calendar-pro .rdp-day_today::after {
          content: '';
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          background: #3b82f6;
          border-radius: full;
        }
        .detaim-calendar-pro .rdp-day_disabled {
          opacity: 0.1 !important;
        }
        
        .custom-scrollbar-pro::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar-pro::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-pro::-webkit-scrollbar-thumb { 
          background: rgba(255, 255, 255, 0.05); 
          border-radius: 20px; 
        }
        .custom-scrollbar-pro::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }

        .glass-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
          backdrop-filter: blur(40px);
          border: 1px solid rgba(255,255,255,0.04);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          border-color: rgba(255,255,255,0.08);
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
        }
        .glass-input {
          background: rgba(255,255,255,0.01);
          border: 1px solid rgba(255,255,255,0.03);
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-input:focus {
          background: rgba(255,255,255,0.03);
          border-color: rgba(255,255,255,0.15);
          box-shadow: 0 0 40px rgba(255,255,255,0.03);
          transform: translateY(-2px);
        }
        .selection-glow {
          position: relative;
        }
        .selection-glow::before {
          content: '';
          position: absolute;
          inset: -1px;
          background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
          border-radius: inherit;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.5s;
        }
        .selection-glow:hover::before {
          opacity: 1;
        }
      `}</style>

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
          <div className="lg:col-span-4 space-y-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {/* Tirador */}
            <div className="p-10 rounded-[3rem] glass-card shadow-2xl hover:shadow-white/[0.02]">
              <h3 className="text-xl font-black mb-10 flex items-center gap-4 text-white tracking-tighter">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black text-[10px] font-black shadow-2xl animate-pulse">01</span>
                Perfil del Tirador
              </h3>
              <div className="space-y-8">
                <div className="group relative">
                  <label className="block text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-3 group-focus-within:text-white transition-colors">Nombre Completo</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full rounded-2xl glass-input px-6 py-4.5 text-sm text-white placeholder:text-zinc-800 outline-none"
                    placeholder="Identificación del usuario"
                  />
                  <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity" />
                </div>
                <div className="group relative">
                  <label className="block text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-3 group-focus-within:text-white transition-colors">WhatsApp</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full rounded-2xl glass-input px-6 py-4.5 text-sm text-white placeholder:text-zinc-800 outline-none"
                    placeholder="Canal de comunicación"
                  />
                  <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity" />
                </div>
                <div className="pt-8 border-t border-white/5">
                  <label className="block text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-5">Nivel de Habilidad</label>
                  <div className="grid grid-cols-3 gap-3">
                    {NIVELES.map(n => (
                      <button
                        key={n}
                        onClick={() => setForm({ ...form, nivelHabilidad: n })}
                        className={`py-3.5 rounded-xl text-[9px] font-black border uppercase tracking-widest transition-all duration-500 ${form.nivelHabilidad === n ? 'bg-white border-white text-black shadow-2xl shadow-white/10 scale-105' : 'bg-transparent border-white/5 text-zinc-600 hover:border-white/20 hover:text-zinc-400'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Selector */}
            <div className="p-10 rounded-[3rem] glass-card shadow-2xl hover:shadow-white/[0.02]">
              <h3 className="text-xl font-black mb-10 flex items-center gap-4 text-white tracking-tighter">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black text-[10px] font-black shadow-2xl animate-pulse">02</span>
                Sesión de Tiro
              </h3>
              <div className="space-y-4">
                {PLANES.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setForm({ ...form, planId: plan.id })}
                    className={`
                      group w-full text-left p-6 rounded-2xl border transition-all duration-700 relative overflow-hidden
                      ${form.planId === plan.id 
                        ? 'bg-white border-white shadow-2xl shadow-white/5 text-black scale-[1.02]' 
                        : 'bg-white/[0.01] text-zinc-500 border-white/5 hover:border-white/10 hover:bg-white/[0.03] hover:translate-x-1'}
                    `}
                  >
                    <div className="flex justify-between items-center mb-1 relative z-10">
                      <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${form.planId === plan.id ? 'text-black/40' : 'text-zinc-800'}`}>{plan.minutos} min</span>
                      <span className="text-lg font-black tracking-tighter">${plan.precio}</span>
                    </div>
                    <p className="font-black text-sm uppercase tracking-tight relative z-10">{plan.descripcion}</p>
                    {form.planId === plan.id && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.02] to-transparent animate-[shimmer_2s_infinite]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Calendario y Hora Integrados */}
          <div className="lg:col-span-8 space-y-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="p-12 rounded-[4rem] glass-card shadow-2xl min-h-[850px] relative overflow-hidden flex flex-col hover:shadow-white/[0.01]">
              {/* Header de la sección */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                <div className="space-y-3">
                  <h3 className="text-6xl font-black tracking-tighter text-white flex items-center gap-8">
                    <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-black text-sm font-black shadow-2xl animate-pulse">03</span>
                    {form.hora ? 'Confirmar' : 'Agenda'}
                  </h3>
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em] ml-24">
                    Sincronización en Tiempo Real
                  </p>
                </div>
                {fecha && (
                  <div className="bg-white/5 border border-white/10 rounded-[2rem] px-10 py-6 backdrop-blur-3xl animate-scale-in hover:border-white/20 transition-colors">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em] mb-2 text-right">Sesión para el</p>
                    <p className="text-3xl font-black text-white tracking-tighter">{format(fecha, 'dd MMMM yyyy', { locale: es })}</p>
                  </div>
                )}
              </div>

              {/* Contenido Principal */}
              <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-20 relative">
                {/* Calendario */}
                <div className={`transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col items-center justify-start ${form.hora ? 'opacity-0 scale-90 pointer-events-none blur-2xl translate-x-[-50px]' : 'opacity-100 scale-100'}`}>
                  <div className="bg-black/40 p-10 rounded-[4rem] border border-white/5 shadow-inner w-full flex justify-center hover:border-white/10 transition-colors">
                    <DayPicker
                      mode="single"
                      selected={fecha}
                      onSelect={setFecha}
                      locale={es}
                      disabled={{ before: today }}
                      className="detaim-calendar-pro"
                      modifiersClassNames={{ selected: 'rdp-selected' }}
                    />
                  </div>
                  <div className="mt-12 flex gap-10">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Seleccionado</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-white/5" />
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Disponible</span>
                    </div>
                  </div>
                </div>

                {/* Selector de Horas */}
                <div className={`flex flex-col h-full transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) ${!fecha ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                  {!form.hora ? (
                    <div className="flex flex-col h-full animate-fade-in">
                      <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-8">
                        <div className="flex items-center gap-4">
                          {selectedHour && (
                            <button 
                              onClick={() => setSelectedHour(null)}
                              className="p-2 rounded-xl bg-white/5 text-zinc-500 hover:text-white transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                          )}
                          <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.6em]">
                            {selectedHour ? `Minutos para las ${selectedHour}:00` : 'Seleccione Hora'}
                          </h4>
                        </div>
                        {loadingSlots && <span className="flex h-2 w-2 rounded-full bg-white animate-ping" />}
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-6 custom-scrollbar-pro" style={{ maxHeight: '450px' }}>
                        {loadingSlots ? (
                          <div className="h-full flex flex-col items-center justify-center space-y-8">
                            <div className="h-12 w-12 border border-white/5 border-t-white rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.4em]">Sincronizando...</p>
                          </div>
                        ) : availableSlots.length > 0 ? (
                          !selectedHour ? (
                            // Paso 1: Selección de Hora
                            <div className="grid grid-cols-3 gap-4">
                              {Array.from({ length: 11 }, (_, i) => i + 9).map((h) => {
                                const hourStr = String(h).padStart(2, '0');
                                const hasAvailability = availableSlots.some(s => s.hora.startsWith(hourStr) && !s.reservada);
                                return (
                                  <button
                                    key={h}
                                    disabled={!hasAvailability}
                                    onClick={() => setSelectedHour(hourStr)}
                                    className={`
                                      relative overflow-hidden rounded-2xl py-8 text-sm font-black transition-all duration-500 animate-slide-up
                                      ${!hasAvailability 
                                        ? 'bg-black/60 text-zinc-900 border border-white/[0.01] cursor-not-allowed opacity-10' 
                                        : 'bg-white/[0.01] text-zinc-500 border border-white/5 hover:bg-white hover:text-black hover:scale-[1.05] hover:shadow-[0_20px_40px_rgba(255,255,255,0.1)]'}
                                    `}
                                  >
                                    <span className="relative z-10">{h > 12 ? h - 12 : h} {h >= 12 ? 'PM' : 'AM'}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            // Paso 2: Selección de Minutos
                            <div className="grid grid-cols-3 gap-4">
                              {availableSlots
                                .filter(s => s.hora.startsWith(selectedHour))
                                .map((slot, index) => (
                                  <button
                                    key={slot.hora}
                                    disabled={slot.reservada}
                                    onClick={() => setForm({ ...form, hora: slot.hora })}
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                    className={`
                                      relative overflow-hidden rounded-2xl py-8 text-sm font-black transition-all duration-500 animate-slide-up
                                      ${slot.reservada 
                                        ? 'bg-black/60 text-zinc-900 border border-white/[0.01] cursor-not-allowed opacity-10' 
                                        : 'bg-white/[0.01] text-zinc-500 border border-white/5 hover:bg-white hover:text-black hover:scale-[1.05] hover:shadow-[0_20px_40px_rgba(255,255,255,0.1)]'}
                                    `}
                                  >
                                    <span className="relative z-10">{slot.hora}</span>
                                  </button>
                                ))}
                            </div>
                          )
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center space-y-6 py-32">
                            <div className="h-20 w-20 rounded-full border border-white/5 flex items-center justify-center opacity-10">
                              <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <p className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.5em]">Sin Disponibilidad</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full animate-scale-in absolute inset-0 xl:relative">
                      <div className="relative group">
                        <div className="absolute -inset-40 bg-white/[0.02] rounded-full blur-[120px] animate-pulse" />
                        <div className="relative bg-white p-20 rounded-[5rem] border border-white shadow-[0_0_80px_rgba(255,255,255,0.15)] text-center min-w-[380px] transition-all hover:scale-105 duration-1000">
                          <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.7em] mb-8">Hora de Inicio</p>
                          <p className="text-[9rem] font-black text-black tracking-tighter leading-none">{form.hora}</p>
                          <div className="mt-12 h-1.5 w-20 bg-black mx-auto rounded-full opacity-5" />
                        </div>
                      </div>
                      
                      <div className="mt-20 space-y-5 w-full max-w-sm relative z-10">
                        <button
                          onClick={handleSubmitTurno}
                          disabled={!form.nombre || !form.telefono || reservando}
                          className={`
                            w-full py-7 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] transition-all duration-700 shadow-2xl
                            ${(!form.nombre || !form.telefono || reservando)
                              ? 'bg-zinc-900 text-zinc-800 cursor-not-allowed border border-white/5'
                              : 'bg-white text-black hover:bg-zinc-100 hover:scale-[1.02] active:scale-[0.98] shadow-[0_25px_60px_rgba(255,255,255,0.15)]'}
                          `}
                        >
                          {reservando ? 'Procesando...' : 'Confirmar Reserva'}
                        </button>
                        
                        <button 
                          onClick={() => {
                            setForm({ ...form, hora: '' });
                            setSelectedHour(null);
                          }}
                          className="w-full py-5 rounded-3xl bg-transparent text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em] hover:text-white transition-all duration-500"
                        >
                          Cambiar Horario
                        </button>
                      </div>
                      
                      {submitError && <p className="mt-10 text-center text-[11px] text-red-500 font-black uppercase tracking-[0.4em] animate-pulse">{submitError}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Disclaimer minimalista en el centro */}
              {!form.hora && (
                <div className="mt-20 pt-16 border-t border-white/[0.02] flex items-center justify-between">
                  <p className="text-[10px] text-zinc-800 font-black uppercase tracking-[0.3em]">
                    Cifrado de Extremo a Extremo <span className="text-zinc-900 ml-4">v2.4.0</span>
                  </p>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.4em]">Latencia</span>
                      <span className="text-[10px] font-black text-blue-900 uppercase">1.2ms</span>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
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
