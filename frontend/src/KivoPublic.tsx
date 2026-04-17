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
        setPaso('confirmado')
      } else {
        setSubmitError(data.error || 'Error al procesar la reserva')
      }
    } catch (err) {
      setSubmitError('Error de conexión con el servidor')
    } finally {
      setReservando(false)
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
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/')}>
          <img src="/logo.jpg" alt="DETAIM" className="h-10 w-auto rounded-xl grayscale group-hover:grayscale-0 transition-all duration-500 shadow-2xl" />
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter text-black">DETAIM</span>
            <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-400 uppercase group-hover:text-blue-500 transition-colors">Precision Simulation</span>
          </div>
        </div>
        <nav className="flex items-center gap-8">
          <Link
            to="/legal/horario-atencion"
            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black transition-colors"
          >
            Horarios
          </Link>
          <a
            href="https://maps.google.com/?q=Centro+Empresarial+B%26E+Cajica"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-zinc-800 active:scale-95 shadow-xl shadow-black/5"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Ubicación
          </a>
        </nav>
      </div>
    </header>
  )

  const Footer = () => (
    <footer className="mt-auto border-t border-black/5 bg-white py-20 selection:bg-black selection:text-white">
      <div className="mx-auto max-w-7xl px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-20">
          <div className="md:col-span-5 space-y-8">
            <div className="flex items-center gap-3">
              <img src="/logo.jpg" alt="DETAIM" className="h-8 w-auto rounded-lg grayscale" />
              <span className="text-2xl font-black tracking-tighter text-black">DETAIM</span>
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
                className="text-xs text-zinc-500 hover:text-black transition-colors leading-loose flex items-start gap-3 group"
              >
                <div className="mt-1 h-1 w-1 rounded-full bg-blue-500 group-hover:scale-150 transition-transform" />
                <span>Centro Empresarial B&E, Cajicá. Oficina 401.</span>
              </a>
            </div>
          </div>
          
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-12">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">Legal</h4>
              <ul className="space-y-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                <li><Link to="/legal/terminos-condiciones" className="hover:text-black transition-colors">Términos</Link></li>
                <li><Link to="/legal/politica-privacidad" className="hover:text-black transition-colors">Privacidad</Link></li>
                <li><Link to="/legal/tratamiento-datos" className="hover:text-black transition-colors">Habeas Data</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">Soporte</h4>
              <ul className="space-y-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                <li><Link to="/legal/preguntas-frecuentes" className="hover:text-black transition-colors">FAQ</Link></li>
                <li><Link to="/legal/horario-atencion" className="hover:text-black transition-colors">Horarios</Link></li>
                <li><Link to="/panel" className="hover:text-black transition-colors">Staff</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">Conecta</h4>
              <ul className="space-y-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                <li><a href="https://detaim.com" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Sitio Web</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Instagram</a></li>
                <li><a href="#" className="hover:text-black transition-colors">WhatsApp</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="pt-12 border-t border-black/5 flex flex-col sm:flex-row justify-between items-center gap-8">
          <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.4em]">
            © 2026 DETAIM GLOBAL. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Powered by</span>
            <span className="text-[11px] font-black text-black tracking-tighter">DETAIM CLOUD</span>
          </div>
        </div>
      </div>
    </footer>
  )

  if (paso === 'confirmado') {
    return (
      <div className="flex min-h-svh flex-col bg-white text-black">
        <HeaderBar />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center p-8 animate-fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-[3rem] bg-white text-center shadow-2xl border border-black/5" ref={ticketRef}>
            <div className="p-12">
              <div className="mb-8 flex justify-center opacity-10">
                <img src="/logo.jpg" alt="DETAIM" className="h-10 w-auto rounded" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Reserva Confirmada</h2>
              <p className="mt-4 text-8xl font-black tracking-tighter text-black">{turnoNumero}</p>
              <p className="mt-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">DETAIM Simulación Profesional</p>
            </div>
            <div className="p-10 text-left space-y-6 bg-zinc-50">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Tirador</p>
                  <p className="text-sm font-black text-black">{form.nombre}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Operación</p>
                  <p className="text-sm font-black text-black">{form.tipoSimulador}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Fecha</p>
                  <p className="text-sm font-black text-black">{fecha ? format(fecha, 'dd/MM/yyyy') : ''}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Hora</p>
                  <p className="text-sm font-black text-black">{form.hora}</p>
                </div>
              </div>
              <div className="pt-6 border-t border-black/5">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Ubicación</p>
                <p className="text-xs font-black text-black">Centro Empresarial B&E, Cajicá. Of 401.</p>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-6 w-full max-w-md">
            <button
              onClick={downloadTicket}
              className="w-full rounded-[2rem] bg-black px-8 py-6 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:bg-zinc-800 active:scale-95"
            >
              Descargar Comprobante
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 hover:text-black transition-colors"
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
    <div className="relative flex min-h-svh flex-col bg-white text-black selection:bg-red-500/30">
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
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
          0% { box-shadow: 0 0 5px rgba(225, 29, 72, 0.05); }
          50% { box-shadow: 0 0 20px rgba(225, 29, 72, 0.15); }
          100% { box-shadow: 0 0 5px rgba(225, 29, 72, 0.05); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-slide-up { animation: slideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fadeIn 1.5s ease forwards; }
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .detaim-calendar-pro {
          --rdp-cell-size: 48px;
          --rdp-accent-color: #000000;
          --rdp-background-color: #f4f4f5;
          margin: 0;
          width: 100%;
          display: flex;
          justify-content: center;
        }
        .detaim-calendar-pro .rdp-months { justify-content: center; }
        .detaim-calendar-pro .rdp-day_selected { 
          background-color: #e11d48 !important; 
          color: #ffffff !important;
          font-weight: 900 !important;
          border-radius: 18px !important;
          box-shadow: 0 20px 40px -10px rgba(225,29,72,0.4);
          transform: scale(1.1);
        }
        .detaim-calendar-pro .rdp-day:hover:not(.rdp-day_selected):not(.rdp-day_disabled) {
          background-color: #f4f4f5 !important;
          border-radius: 18px !important;
          transform: translateY(-4px) scale(1.05);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          color: #e11d48 !important;
        }
        .detaim-calendar-pro .rdp-nav_button {
          color: #a1a1aa !important;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border-radius: 14px !important;
        }
        .detaim-calendar-pro .rdp-nav_button:hover {
          color: #000000 !important;
          background: #f4f4f5 !important;
          transform: scale(1.1);
        }
        .detaim-calendar-pro .rdp-head_cell {
          font-size: 12px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.3em !important;
          color: #a1a1aa !important;
          padding-bottom: 2.5rem !important;
        }
        .detaim-calendar-pro .rdp-day {
          font-size: 17px !important;
          font-weight: 600 !important;
          color: #3f3f46;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .detaim-calendar-pro .rdp-day_today {
          color: #e11d48 !important;
          font-weight: 900 !important;
        }
        
        .custom-scrollbar-pro::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-pro::-webkit-scrollbar-track { background: #f4f4f5; }
        .custom-scrollbar-pro::-webkit-scrollbar-thumb { 
          background: #e4e4e7; 
          border-radius: 20px; 
        }
        .custom-scrollbar-pro::-webkit-scrollbar-thumb:hover { background: #d4d4d8; }

        .glass-card {
          background: #ffffff;
          border: 1px solid #f4f4f5;
          box-shadow: 0 20px 60px -15px rgba(0,0,0,0.05);
          transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          border-color: #e4e4e7;
          box-shadow: 0 40px 100px -20px rgba(0,0,0,0.08);
          transform: translateY(-5px);
        }
        .glass-input {
          background: #f8fafc;
          border: 2px solid transparent;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          color: #000000;
        }
        .glass-input:focus {
          background: #ffffff;
          border-color: #e11d48;
          box-shadow: 0 10px 40px -10px rgba(225,29,72,0.15);
          transform: translateY(-2px);
        }
        .btn-red {
          background: #e11d48;
          color: #ffffff;
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .btn-red:hover {
          background: #be123c;
          box-shadow: 0 25px 50px -12px rgba(225,29,72,0.5);
          transform: translateY(-3px) scale(1.02);
        }
        .btn-black {
          background: #000000;
          color: #ffffff;
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .btn-black:hover {
          background: #18181b;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
          transform: translateY(-3px) scale(1.02);
        }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
          <div className="flex items-center gap-5 cursor-pointer group" onClick={() => navigate('/')}>
            <img src="/logo.jpg" alt="DETAIM" className="h-12 w-auto rounded-2xl transition-all duration-500 shadow-xl" />
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-black">DETAIM</span>
              <span className="text-[11px] font-bold tracking-[0.4em] text-red-600 uppercase">Precision Simulation</span>
            </div>
          </div>
          <nav className="flex items-center gap-12">
            <Link to="/legal/horario-atencion" className="text-[12px] font-black uppercase tracking-widest text-zinc-400 hover:text-black transition-colors">Horarios</Link>
            <a href="https://maps.google.com/?q=Centro+Empresarial+B%26E+Cajica" target="_blank" rel="noopener noreferrer" className="btn-black flex items-center gap-3 rounded-full px-8 py-3.5 text-[11px] font-black uppercase tracking-widest shadow-2xl active:scale-95">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Ubicación
            </a>
          </nav>
        </div>
      </header>

      {/* Banner de Marca - Tema Claro */}
      <div className="bg-zinc-50 border-b border-zinc-100 py-4">
        <div className="mx-auto max-w-7xl px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 rounded-full bg-red-600 shadow-[0_0_12px_rgba(225,29,72,0.4)] animate-pulse" />
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400">
              Sede <span className="text-black font-black">Cajicá</span> — <span className="text-red-600">Polígono Activo</span>
            </p>
          </div>
          <div className="hidden md:flex items-center gap-10">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Calibración:</span>
              <span className="text-[11px] font-black text-black uppercase tracking-widest">Óptima</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Status:</span>
              <span className="text-[11px] font-black text-red-600 uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 h-full">
          
          {/* Columna Izquierda: Tirador y Plan */}
          <div className="lg:col-span-4 space-y-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="p-12 rounded-[4rem] glass-card">
              <h3 className="text-2xl font-black mb-12 flex items-center gap-5 text-black tracking-tighter">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600 text-white text-xs font-black shadow-xl animate-pulse">01</span>
                Perfil del Tirador
              </h3>
              <div className="space-y-10">
                <div className="group relative">
                  <label className="block text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-4 group-focus-within:text-red-600 transition-colors">Nombre Completo</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full rounded-[2rem] glass-input px-8 py-5 text-base placeholder:text-zinc-300 outline-none"
                    placeholder="Identificación del usuario"
                  />
                </div>
                <div className="group relative">
                  <label className="block text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-4 group-focus-within:text-red-600 transition-colors">WhatsApp</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full rounded-[2rem] glass-input px-8 py-5 text-base placeholder:text-zinc-300 outline-none"
                    placeholder="Canal de comunicación"
                  />
                </div>
                <div className="pt-10 border-t border-zinc-100">
                  <label className="block text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-6">Nivel de Habilidad</label>
                  <div className="grid grid-cols-3 gap-4">
                    {NIVELES.map(n => (
                      <button
                        key={n}
                        onClick={() => setForm({ ...form, nivelHabilidad: n })}
                        className={`py-4 rounded-2xl text-[10px] font-black border uppercase tracking-widest transition-all duration-500 ${form.nivelHabilidad === n ? 'bg-red-600 border-red-600 text-white shadow-2xl scale-105' : 'bg-transparent border-zinc-100 text-zinc-400 hover:border-red-600/30 hover:text-red-600'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-12 rounded-[4rem] glass-card">
              <h3 className="text-2xl font-black mb-12 flex items-center gap-5 text-black tracking-tighter">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600 text-white text-xs font-black shadow-xl animate-pulse">02</span>
                Sesión de Tiro
              </h3>
              <div className="space-y-5">
                {PLANES.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setForm({ ...form, planId: plan.id })}
                    className={`
                      group w-full text-left p-8 rounded-3xl border transition-all duration-700 relative overflow-hidden
                      ${form.planId === plan.id 
                        ? 'bg-black border-black shadow-2xl text-white scale-[1.03]' 
                        : 'bg-zinc-50 text-zinc-400 border-transparent hover:border-red-600/20 hover:bg-white hover:translate-x-1'}
                    `}
                  >
                    <div className="flex justify-between items-center mb-2 relative z-10">
                      <span className={`text-[11px] font-black uppercase tracking-[0.4em] ${form.planId === plan.id ? 'text-red-600' : 'text-zinc-400'}`}>{plan.minutos} min</span>
                      <span className="text-2xl font-black tracking-tighter">${plan.precio}</span>
                    </div>
                    <p className="font-black text-base uppercase tracking-tight relative z-10">{plan.descripcion}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Calendario y Hora */}
          <div className="lg:col-span-8 space-y-10 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="p-16 rounded-[5rem] glass-card min-h-[900px] relative overflow-hidden flex flex-col">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20">
                <div className="space-y-4">
                  <h3 className="text-8xl font-black tracking-tighter text-black flex items-center gap-10">
                    <span className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-red-600 text-white text-base font-black shadow-2xl animate-pulse">03</span>
                    {form.hora ? 'Confirmar' : 'Agenda'}
                  </h3>
                  <p className="text-[12px] font-black text-red-600 uppercase tracking-[0.6em] ml-28">
                    Sincronización de Campo
                  </p>
                </div>
                {fecha && (
                  <div className="bg-zinc-50 border border-zinc-100 rounded-[2.5rem] px-12 py-8 animate-scale-in">
                    <p className="text-[11px] font-black text-red-600 uppercase tracking-[0.4em] mb-3 text-right font-black">Sesión para el</p>
                    <p className="text-4xl font-black text-black tracking-tighter">{format(fecha, 'dd MMMM yyyy', { locale: es })}</p>
                  </div>
                )}
              </div>

              <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-24 relative">
                {/* Calendario Claro */}
                <div className={`transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col items-center justify-start ${form.hora ? 'opacity-0 scale-90 pointer-events-none blur-3xl translate-x-[-50px]' : 'opacity-100 scale-100'}`}>
                  <div className="bg-zinc-50 p-12 rounded-[4rem] border border-zinc-100 shadow-inner w-full flex justify-center hover:border-red-600/10 transition-colors">
                    <DayPicker
                      mode="single"
                      selected={fecha}
                      onSelect={setFecha}
                      locale={es}
                      disabled={{ before: today }}
                      className="detaim-calendar-pro"
                    />
                  </div>
                  <div className="mt-16 flex gap-12">
                    <div className="flex items-center gap-4">
                      <div className="h-3 w-3 rounded-full bg-red-600 shadow-[0_0_15px_rgba(225,29,72,0.6)]" />
                      <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em]">Seleccionado</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-3 w-3 rounded-full bg-zinc-200" />
                      <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em]">Disponible</span>
                    </div>
                  </div>
                </div>

                {/* Selector de Horas Claro */}
                <div className={`flex flex-col h-full transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) ${!fecha ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                  {!form.hora ? (
                    <div className="flex flex-col h-full animate-fade-in">
                      <div className="flex items-center justify-between mb-12 border-b border-zinc-100 pb-10">
                        <div className="flex items-center gap-6">
                          {selectedHour && (
                            <button onClick={() => setSelectedHour(null)} className="p-3 rounded-2xl bg-zinc-50 text-zinc-400 hover:text-red-600 transition-colors">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                          )}
                          <h4 className="text-[12px] font-black text-black uppercase tracking-[0.8em]">
                            {selectedHour ? `Bloque ${selectedHour}:00` : 'Seleccione Bloque'}
                          </h4>
                        </div>
                        {loadingSlots && <span className="flex h-3 w-3 rounded-full bg-red-600 animate-ping" />}
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-8 custom-scrollbar-pro" style={{ maxHeight: '500px' }}>
                        {loadingSlots ? (
                          <div className="h-full flex flex-col items-center justify-center space-y-10">
                            <div className="h-16 w-16 border-4 border-zinc-100 border-t-red-600 rounded-full animate-spin" />
                            <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.6em]">Sincronizando...</p>
                          </div>
                        ) : availableSlots.length > 0 ? (
                          !selectedHour ? (
                            <div className="grid grid-cols-3 gap-6">
                              {Array.from({ length: 11 }, (_, i) => i + 9).map((h) => {
                                const hourStr = String(h).padStart(2, '0');
                                const hasAvailability = availableSlots.some(s => s.hora.startsWith(hourStr) && !s.reservada);
                                return (
                                  <button
                                    key={h}
                                    disabled={!hasAvailability}
                                    onClick={() => setSelectedHour(hourStr)}
                                    className={`
                                      relative overflow-hidden rounded-[2rem] py-10 text-base font-black transition-all duration-500
                                      ${!hasAvailability 
                                        ? 'bg-zinc-50 text-zinc-200 border border-transparent cursor-not-allowed opacity-40' 
                                        : 'bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-black hover:text-white hover:scale-[1.05] hover:shadow-2xl'}
                                    `}
                                  >
                                    <span className="relative z-10">{h > 12 ? h - 12 : h} {h >= 12 ? 'PM' : 'AM'}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-6">
                              {availableSlots
                                .filter(s => s.hora.startsWith(selectedHour))
                                .map((slot, index) => (
                                  <button
                                    key={slot.hora}
                                    disabled={slot.reservada}
                                    onClick={() => setForm({ ...form, hora: slot.hora })}
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                    className={`
                                      relative overflow-hidden rounded-[2rem] py-10 text-base font-black transition-all duration-500 animate-slide-up
                                      ${slot.reservada 
                                        ? 'bg-zinc-50 text-zinc-100 border border-transparent cursor-not-allowed opacity-20' 
                                        : 'bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-red-600 hover:text-white hover:scale-[1.05] hover:shadow-2xl'}
                                    `}
                                  >
                                    <span className="relative z-10">{slot.hora}</span>
                                  </button>
                                ))}
                            </div>
                          )
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center space-y-8 py-40">
                            <div className="h-24 w-24 rounded-full border-4 border-zinc-50 flex items-center justify-center opacity-40">
                              <svg className="h-10 w-10 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <p className="text-[12px] font-black text-zinc-400 uppercase tracking-[0.8em]">Sin Disponibilidad</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full animate-scale-in absolute inset-0 xl:relative">
                      <div className="space-y-8 w-full max-w-md relative z-10">
                        <button
                          onClick={handleSubmitTurno}
                          disabled={!form.nombre || !form.telefono || reservando}
                          className={`
                            btn-red w-full py-12 rounded-[3rem] font-black text-[16px] uppercase tracking-[0.6em] shadow-2xl
                            ${(!form.nombre || !form.telefono || reservando)
                              ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed border border-transparent'
                              : ''}
                          `}
                        >
                          {reservando ? 'Procesando...' : 'Confirmar Reserva'}
                        </button>
                        
                        <div className="text-center">
                          <p className="text-[12px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-6">
                            Sesión para las <span className="text-red-600 font-black">{form.hora}</span>
                          </p>
                          <button 
                            onClick={() => { setForm({ ...form, hora: '' }); setSelectedHour(null); }}
                            className="w-full py-6 rounded-full bg-transparent text-[11px] font-black text-zinc-400 uppercase tracking-[0.6em] hover:text-black transition-all duration-500"
                          >
                            Modificar Horario
                          </button>
                        </div>
                      </div>
                      {submitError && <p className="mt-12 text-center text-[12px] text-red-600 font-black uppercase tracking-[0.5em] animate-pulse">{submitError}</p>}
                    </div>
                  )}
                </div>
              </div>

              {!form.hora && (
                <div className="mt-24 pt-20 border-t border-zinc-100 flex items-center justify-between">
                  <p className="text-[11px] text-zinc-400 font-black uppercase tracking-[0.5em]">
                    Cifrado Táctico <span className="text-zinc-300 ml-6">v3.0.0 — PRO</span>
                  </p>
                  <div className="flex items-center gap-8">
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.6em]">Sync</span>
                      <span className="text-[11px] font-black text-red-600 uppercase">Realtime</span>
                    </div>
                    <div className="h-3 w-3 rounded-full bg-red-600 shadow-[0_0_15px_rgba(225,29,72,0.8)]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-zinc-100 bg-zinc-50 py-32">
        <div className="mx-auto max-w-7xl px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-24 mb-32">
            <div className="md:col-span-5 space-y-12">
              <div className="flex items-center gap-5">
                <img src="/logo.jpg" alt="DETAIM" className="h-10 w-auto rounded-xl" />
                <span className="text-3xl font-black tracking-tighter text-black">DETAIM</span>
              </div>
              <p className="text-lg text-zinc-500 max-w-sm leading-relaxed font-bold">
                Redefiniendo el entrenamiento de precisión con simuladores tácticos de élite.
              </p>
              <div>
                <p className="text-[12px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-6">Operaciones Centrales</p>
                <a href="https://maps.google.com/?q=Centro+Empresarial+B%26E+Cajica" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-600 hover:text-red-600 transition-colors flex items-start gap-4 group font-bold">
                  <div className="mt-2 h-2 w-2 rounded-full bg-red-600 group-hover:scale-150 transition-transform" />
                  <span>C.E. B&E, Cajicá. Oficina 401.</span>
                </a>
              </div>
            </div>
            
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-16">
              <div className="space-y-8">
                <h4 className="text-[12px] font-black text-black uppercase tracking-[0.4em]">Protocolos</h4>
                <ul className="space-y-5 text-[12px] font-black text-zinc-500 uppercase tracking-widest">
                  <li><Link to="/legal/terminos-condiciones" className="hover:text-red-600 transition-colors">Términos</Link></li>
                  <li><Link to="/legal/politica-privacidad" className="hover:text-red-600 transition-colors">Privacidad</Link></li>
                  <li><Link to="/legal/tratamiento-datos" className="hover:text-red-600 transition-colors">Habeas Data</Link></li>
                </ul>
              </div>
              <div className="space-y-8">
                <h4 className="text-[12px] font-black text-black uppercase tracking-[0.4em]">Soporte</h4>
                <ul className="space-y-5 text-[12px] font-black text-zinc-500 uppercase tracking-widest">
                  <li><Link to="/legal/preguntas-frecuentes" className="hover:text-red-600 transition-colors">Preguntas</Link></li>
                  <li><Link to="/legal/horario-atencion" className="hover:text-red-600 transition-colors">Horarios</Link></li>
                  <li><Link to="/panel" className="hover:text-red-600 transition-colors">Staff</Link></li>
                </ul>
              </div>
              <div className="space-y-8">
                <h4 className="text-[12px] font-black text-black uppercase tracking-[0.4em]">Red</h4>
                <ul className="space-y-5 text-[12px] font-black text-zinc-500 uppercase tracking-widest">
                  <li><a href="https://detaim.com" className="hover:text-red-600 transition-colors">Web Oficial</a></li>
                  <li><a href="#" className="hover:text-red-600 transition-colors">Instagram</a></li>
                  <li><a href="#" className="hover:text-red-600 transition-colors">WhatsApp</a></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="pt-16 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-center gap-10">
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.5em]">
              © 2026 DETAIM GLOBAL PRECISION.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Infr.</span>
              <span className="text-[13px] font-black text-black tracking-tighter">DETAIM CLOUD CORE</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
