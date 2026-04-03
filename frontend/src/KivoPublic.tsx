import {
  useEffect,
  useId,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from 'react'
import { toPng } from 'html-to-image'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'
import { format, parse, startOfToday } from 'date-fns'
import type { SedeApi, EmpresaApi } from './api/kivo'
import { useNavigate, useParams } from 'react-router-dom'
import QrScanner from './QrScanner'
import {
  cancelarTurno,
  checkinTurno,
  confirmarTurno,
  fetchFilaTurno,
  fetchPreguntasSede,
  reservarTurno,
  retrasoCortesia,
  fetchSedes,
  fetchTurnosPorDocumento,
  fetchEmpresaPorSlug,
  fetchEmpresasPublicas,
} from './api/kivo'
import type { PreguntaTurnoPublica } from './api/kivo'

type PrioridadId =
  | 'ninguna'
  | 'adulto-mayor'
  | 'gestante'
  | 'discapacidad'
  | 'ninos-brazos'

const PRIORIDAD_OPCIONES: {
  id: PrioridadId
  label: string
  descripcion: string
}[] = [
  {
    id: 'ninguna',
    label: 'Ninguna',
    descripcion: 'Atención general',
  },
  {
    id: 'adulto-mayor',
    label: 'Adulto mayor',
    descripcion: 'Ley de Atención Preferencial',
  },
  {
    id: 'gestante',
    label: 'Mujer en estado de embarazo',
    descripcion: 'Ley de Atención Preferencial',
  },
  {
    id: 'discapacidad',
    label: 'Persona en condición de discapacidad',
    descripcion: 'Ley de Atención Preferencial',
  },
  {
    id: 'ninos-brazos',
    label: 'Con niños o niñas en brazos',
    descripcion: 'Ley de Atención Preferencial',
  },
]

function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type WizardStep = 'inicio' | 'datos' | 'detalle' | 'confirmado'

type FormState = {
  nombre: string
  apellido: string
  documento: string
  telefono: string
  hora: string
  lugarId: string
}

function emptyForm(slug: string): FormState {
  return {
    nombre: '',
    apellido: '',
    documento: '',
    telefono: '',
    hora: '',
    lugarId: slug,
  }
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-zinc-700"
    >
      {children}
    </label>
  )
}

function cargaStyles(carga: 'baja' | 'media' | 'alta') {
  switch (carga) {
    case 'alta':
      return {
        badge: 'bg-amber-100 text-amber-900 ring-amber-200',
        label: 'Muy ocupada',
      }
    case 'media':
      return {
        badge: 'bg-sky-100 text-sky-900 ring-sky-200',
        label: 'Moderada',
      }
    default:
      return {
        badge: 'bg-kivo-100 text-kivo-800 ring-kivo-200',
        label: 'Con cupo',
      }
  }
}

function horaCorta(t: string) {
  if (!t) return ''
  return t.length >= 5 ? t.slice(0, 5) : t
}

export default function KivoPublic() {
  const navigate = useNavigate()
  const { empresaSlug } = useParams<{ empresaSlug?: string }>()
  const today = useMemo(() => startOfToday(), [])
  const dialogTitleId = useId()
  const cancelDialogId = useId()
  const sitioModalTitleId = useId()
  const ticketRef = useRef<HTMLDivElement>(null)

  const [empresas, setEmpresas] = useState<EmpresaApi[]>([])
  const [sedes, setSedes] = useState<SedeApi[]>([])
  const [sedesError, setSedesError] = useState<string | null>(null)
  const [empresaCustom, setEmpresaCustom] = useState<EmpresaApi | null>(null)

  const [paso, setPaso] = useState<WizardStep>('inicio')
  const [empresaSeleccionadaId, setEmpresaSeleccionadaId] = useState<number | ''>('')
  const [empresaInicialId, setEmpresaInicialId] = useState('')
  const [fecha, setFecha] = useState<Date | undefined>(today)
  const [form, setForm] = useState<FormState>(() => emptyForm(''))
  const [prioridad, setPrioridad] = useState<PrioridadId>('ninguna')
  const [turnoNumero, setTurnoNumero] = useState('')
  const [turnoId, setTurnoId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [consultarOpen, setConsultarOpen] = useState(false)
  const [legalModal, setLegalModal] = useState<{ open: boolean, title: string, content: ReactNode } | null>(null)
  const [triageUrgencia, setTriageUrgencia] = useState<boolean | null>(null)
  const [triageEfectivo, setTriageEfectivo] = useState<boolean | null>(null)
  const [modoHibrido, setModoHibrido] = useState(true)
  const [preguntasExtra, setPreguntasExtra] = useState<PreguntaTurnoPublica[]>([])
  const [respuestasExtra, setRespuestasExtra] = useState<Record<string, unknown>>({})
  const [preguntasExtraError, setPreguntasExtraError] = useState<string | null>(null)

  const [docConsulta, setDocConsulta] = useState('')
  const [resultadosConsulta, setResultadosConsulta] = useState<
    | {
        id: string
        numero: string
        sede: string
        fechaHora: string
      }[]
    | null
  >(null)
  const [consultaCargando, setConsultaCargando] = useState(false)

  const [gpsStatus, setGpsStatus] = useState<
    'idle' | 'loading' | 'ok' | 'lejos' | 'error'
  >('idle')
  const [gpsDistanciaM, setGpsDistanciaM] = useState<number | null>(null)
  const [qrInput, setQrInput] = useState('')
  const [qrStatus, setQrStatus] = useState<'idle' | 'ok' | 'invalid'>('idle')

  const [checkInMetodo, setCheckInMetodo] = useState<'gps' | 'qr' | null>(null)
  const [checkInListo, setCheckInListo] = useState(false)

  const [contactOpen, setContactOpen] = useState(false)
  const [modalCodigoOpen, setModalCodigoOpen] = useState(false)
  const [codigoDigitado, setCodigoDigitado] = useState('')
  const [codigoAsignado, setCodigoAsignado] = useState('')
  const [reservaTemporalId, setReservaTemporalId] = useState<string | null>(null)
  const [codigoCheckin, setCodigoCheckin] = useState('')
  const [codigoCancelar, setCodigoCancelar] = useState('')
  const [codigoRetraso, setCodigoRetraso] = useState('')
  const [retrasoMsg, setRetrasoMsg] = useState<string | null>(null)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [qrScanOpen, setQrScanOpen] = useState(false)
  const [tardeOpen, setTardeOpen] = useState(false)
  const [accesoOpen, setAccesoOpen] = useState(false)
  const [accesoTurno, setAccesoTurno] = useState<{
    id: string
    numero: string
    sede: string
    fechaHora: string
  } | null>(null)
  const [accesoCodigo, setAccesoCodigo] = useState('')
  const [accesoError, setAccesoError] = useState<string | null>(null)
  const [reservando, setReservando] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [sitioOpen, setSitioOpen] = useState(false)
  const [sitioSlug, setSitioSlug] = useState('')

  const [filaInfo, setFilaInfo] = useState<{
    faltan: number
    estimadoMinutos: number
    turnoAtendiendo: string
  } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const emps = await fetchEmpresasPublicas()
        setEmpresas(emps)

        if (empresaSlug) {
          const emp = await fetchEmpresaPorSlug(empresaSlug)
          setEmpresaCustom(emp)
          setEmpresaSeleccionadaId(emp.id)
        } else {
          setEmpresaCustom(null)
          setEmpresaSeleccionadaId('')
        }

        const data = await fetchSedes(empresaSlug)
        setSedes(data)
        setSedesError(null)
        if (data.length) {
          const firstSede = data[0]
          setEmpresaInicialId(firstSede.id)
          setForm((f) => ({
            ...f,
            lugarId: f.lugarId || firstSede.id,
          }))
          setSitioSlug(firstSede.id)

          // Si entramos por link directo de empresa y solo hay una sede, saltar a datos
          if (empresaSlug && data.length === 1) {
            setPaso('datos')
          }
        }
      } catch (err) {
        setSedesError(
          empresaSlug 
            ? `No pudimos cargar la empresa "${empresaSlug}".` 
            : 'No pudimos cargar las sedes. Revisá que el servidor KIVO esté corriendo.'
        )
      }
    }
    load()
  }, [empresaSlug])

  useEffect(() => {
    setTriageUrgencia(null)
    setTriageEfectivo(null)
    setPreguntasExtra([])
    setRespuestasExtra({})
    setPreguntasExtraError(null)
    if (!form.lugarId) return
    fetchPreguntasSede(form.lugarId)
      .then((qs) => {
        setPreguntasExtra(Array.isArray(qs) ? qs : [])
        setPreguntasExtraError(null)
      })
      .catch(() => {
        setPreguntasExtra([])
        setPreguntasExtraError('No pudimos cargar las preguntas de la sede.')
      })
  }, [form.lugarId])

  useEffect(() => {
    if (paso !== 'confirmado' || !turnoId || checkInOpen || tardeOpen || cancelOpen) {
      setFilaInfo(null)
      return
    }
    let cancelled = false
    const load = () => {
      fetchFilaTurno(turnoId)
        .then((d) => {
          if (!cancelled) {
            setFilaInfo({
              faltan: d.faltan,
              estimadoMinutos: d.estimadoMinutos,
              turnoAtendiendo: d.turnoAtendiendo,
            })
          }
        })
        .catch(() => {})
    }
    load()
    const iv = setInterval(load, 8000)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [paso, turnoId, checkInOpen, tardeOpen, cancelOpen])

  const lugarActual =
    sedes.find((l) => l.id === form.lugarId) ?? sedes[0] ?? null
  const lugarLabel = lugarActual?.label ?? '—'

  const radioMetros = lugarActual?.geocercaMetros ?? 200

  const alternativaSede = useMemo(() => {
    if (!lugarActual || lugarActual.carga !== 'alta') return null
    const mejor = sedes
      .filter((l) => l.id !== lugarActual.id)
      .sort((a, b) => a.esperaMinAprox - b.esperaMinAprox)[0]
    return mejor ?? null
  }, [lugarActual, sedes])

  const prioridadPreferencial = prioridad !== 'ninguna'

  const sedeTipo = lugarActual?.tipo ?? 'general'

  const triageOk =
    (sedeTipo !== 'eps' || triageUrgencia === false) &&
    (sedeTipo !== 'banco' || triageEfectivo !== null) &&
    (sedeTipo === 'eps' ? triageUrgencia !== null : true)

  const puedeConfirmar =
    !!fecha &&
    !!form.hora &&
    triageOk &&
    !(sedeTipo === 'eps' && triageUrgencia === true) &&
    preguntasExtra.every((q) => {
      const v = respuestasExtra[q.key]
      if (q.type === 'bool') return typeof v === 'boolean'
      if (q.type === 'dropdown') return typeof v === 'string' && v.length > 0
      if (q.type === 'scale10') {
        const n = Number(v)
        return Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 10
      }
      return true
    })

  const handleGpsCheckIn = async () => {
    if (!lugarActual || !turnoId) return
    const c = codigoCheckin.replace(/\D/g, '')
    if (c.length !== 4) {
      return
    }
    setGpsStatus('loading')
    setQrStatus('idle')
    setQrInput('')
    if (!navigator.geolocation) {
      setGpsStatus('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const d = haversineM(
          pos.coords.latitude,
          pos.coords.longitude,
          lugarActual.lat,
          lugarActual.lng,
        )
        setGpsDistanciaM(Math.round(d))
        if (d <= radioMetros) {
          setGpsStatus('ok')
          setCheckInMetodo('gps')
          setCheckInListo(true)
          try {
            await checkinTurno(turnoId, 'gps', c)
            setQrScanOpen(false)
            setCheckInOpen(false)
          } catch {
            setCheckInListo(false)
            setGpsStatus('error')
          }
        } else {
          setGpsStatus('lejos')
          setCheckInMetodo(null)
          setCheckInListo(false)
        }
      },
      () => {
        setGpsStatus('error')
        setGpsDistanciaM(null)
        setCheckInMetodo(null)
        setCheckInListo(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const handleQrValidate = async (raw?: string) => {
    if (!turnoId) return
    const c = codigoCheckin.replace(/\D/g, '')
    if (c.length !== 4) return
    const esperado = `KIVO-${form.lugarId}`
    const normalized = (raw ?? qrInput).trim().toUpperCase().replace(/\s+/g, '')
    if (normalized === esperado.toUpperCase() || normalized === 'KIVO-DEMO') {
      setQrStatus('ok')
      setGpsStatus('idle')
      setGpsDistanciaM(null)
      setCheckInMetodo('qr')
      setCheckInListo(true)
      try {
        await checkinTurno(turnoId, 'qr', c)
        setQrScanOpen(false)
        setCheckInOpen(false)
      } catch {
        setCheckInListo(false)
        setQrStatus('invalid')
      }
    } else {
      setQrStatus('invalid')
      if (gpsStatus !== 'ok') {
        setCheckInMetodo(null)
        setCheckInListo(false)
      }
    }
  }

  const handleSubmitTurno = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!puedeConfirmar || !lugarActual || !fecha || reservando) return
    setSubmitError(null)
    setReservando(true)
    const fechaStr = format(fecha, 'yyyy-MM-dd')
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    try {
      const res = await reservarTurno({
        sedeSlug: form.lugarId,
        documento: form.documento,
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono,
        fechaTurno: fechaStr,
        horaTurno: form.hora,
        prioridad,
        triageUrgenciaVital:
          sedeTipo === 'eps' ? triageUrgencia : null,
        triageEfectivo: sedeTipo === 'banco' ? triageEfectivo : null,
        modoHibrido: modoHibrido,
        respuestasExtra: respuestasExtra,
        idempotencyKey,
      })
      setReservaTemporalId(res.id)
      setCodigoAsignado(res.codigoSeguro)
      setCodigoDigitado('')
      setModalCodigoOpen(true)
      if (res.duplicadoEvitado) {
        setSubmitError(null)
      }
    } catch (err: unknown) {
      const e = err as { message?: string; codigo?: string; status?: number }
      if (e.codigo === 'URGENCIA_VITAL') {
        setSubmitError(
          'Por protocolo no podemos darte turno de asesoría. Andá a urgencias o llamá al 123.',
        )
      } else if (e.status === 409) {
        setSubmitError(e.message || 'Ya tenés un turno este día en esta sede.')
      } else {
        setSubmitError(e.message || 'No se pudo reservar el turno.')
      }
    } finally {
      setReservando(false)
    }
  }

  const handleConfirmarCodigoModal = async () => {
    if (!reservaTemporalId) return
    const c = codigoDigitado.replace(/\D/g, '')
    if (c.length !== 4) return
    setSubmitError(null)
    try {
      const r = await confirmarTurno(reservaTemporalId, c)
      setTurnoNumero(r.numeroPublico ?? '')
      setTurnoId(reservaTemporalId)
      
      // Guardar información temporal en localStorage
      const turnData = {
        id: reservaTemporalId,
        numero: r.numeroPublico,
        codigo: c,
        empresa: empresaCustom?.nombre,
        sede: lugarLabel,
        fecha: format(fecha || today, 'dd/MM/yyyy'),
        hora: form.hora
      }
      localStorage.setItem('detaim_last_turn', JSON.stringify(turnData))

      setModalCodigoOpen(false)
      setPaso('confirmado')
      setCodigoCheckin(c)
      setCheckInListo(false)
      setCheckInMetodo(null)
      setGpsStatus('idle')
      setGpsDistanciaM(null)
      setQrInput('')
      setQrStatus('idle')
      setReservaTemporalId(null)
    } catch {
      setSubmitError('Código incorrecto. Revisá e intentá de nuevo.')
    }
  }

  const resetTodo = () => {
    const first = sedes[0]?.id ?? ''
    setPaso('inicio')
    setEmpresaSeleccionadaId(empresaCustom?.id ?? '')
    setEmpresaInicialId(first)
    setForm(emptyForm(first))
    setFecha(today)
    setPrioridad('ninguna')
    setTurnoNumero('')
    setTurnoId(null)
    setDocConsulta('')
    setResultadosConsulta(null)
    setCheckInMetodo(null)
    setCheckInListo(false)
    setGpsStatus('idle')
    setGpsDistanciaM(null)
    setQrInput('')
    setQrStatus('idle')
    setTriageUrgencia(null)
    setTriageEfectivo(null)
    setModoHibrido(true)
    setSubmitError(null)
    setModalCodigoOpen(false)
    setCodigoDigitado('')
    setCodigoAsignado('')
    setReservaTemporalId(null)
    setCodigoCheckin('')
    setCodigoCancelar('')
    setCodigoRetraso('')
    setRetrasoMsg(null)
    if (empresaSlug) {
      navigate(`/${empresaSlug}`)
    } else {
      navigate('/')
    }
  }

  const handleGuardarImagen = async () => {
    if (ticketRef.current === null) return
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true })
      const link = document.createElement('a')
      link.download = `Turno-${turnoNumero}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error al guardar imagen', err)
    }
  }

  const sedesFiltradas = useMemo(() => {
    if (!empresaSeleccionadaId) return []
    return sedes.filter(s => s.empresaId === empresaSeleccionadaId)
  }, [sedes, empresaSeleccionadaId])

  const irASede = () => {
    const emp = empresas.find(e => e.id === empresaSeleccionadaId)
    if (emp) setEmpresaCustom(emp)
    
    const s = sedes.find(s => s.empresaId === empresaSeleccionadaId)
    if (s) {
      setEmpresaInicialId(s.id)
      setForm(f => ({ ...f, lugarId: s.id }))
    }
    
    // Si la empresa seleccionada solo tiene una sede, saltar directo a datos
    const filtered = sedes.filter(s => s.empresaId === empresaSeleccionadaId)
    if (filtered.length === 1) {
      setPaso('datos')
    } else {
      setPaso('inicio') // Aquí 'inicio' ahora significará elegir sede después de empresa
    }
  }

  const irADatos = async () => {
    const selectedSede = sedes.find(s => s.id === empresaInicialId)
    if (selectedSede?.empresaSlug && !empresaCustom) {
      try {
        const emp = await fetchEmpresaPorSlug(selectedSede.empresaSlug)
        setEmpresaCustom(emp)
      } catch {
        // Ignorar error si no se puede cargar branding
      }
    }
    setForm((f) => ({ ...f, lugarId: empresaInicialId }))
    setPaso('datos')
  }

  const consultarDocumento = async () => {
    setConsultaCargando(true)
    try {
      const rows = await fetchTurnosPorDocumento(docConsulta)
      setResultadosConsulta(
        rows.map((r) => ({
          id: r.id,
          numero: r.numero,
          sede: r.sede,
          fechaHora: r.fecha_hora,
        })),
      )
    } catch {
      setResultadosConsulta([])
    } finally {
      setConsultaCargando(false)
    }
  }

  const abrirAccesoTurno = (t: {
    id: string
    numero: string
    sede: string
    fechaHora: string
  }) => {
    setAccesoTurno(t)
    setAccesoCodigo('')
    setAccesoError(null)
    setAccesoOpen(true)
  }

  const confirmarAccesoTurno = () => {
    if (!accesoTurno) return
    const c = accesoCodigo.replace(/\D/g, '')
    if (c.length !== 4) {
      setAccesoError('Ingresá el código seguro de 4 dígitos.')
      return
    }

    const parts = accesoTurno.fechaHora.split('·').map((p) => p.trim())
    const dateStr = parts[0] ?? ''
    const hourStr = parts[1] ?? ''
    const parsed = parse(dateStr, 'dd/MM/yyyy', new Date())
    if (!Number.isNaN(parsed.getTime())) {
      setFecha(parsed)
    }

    const sedeMatch = sedes.find((s) => s.nombre === accesoTurno.sede || s.label === accesoTurno.sede)
    if (sedeMatch) {
      setForm((f) => ({ ...f, lugarId: sedeMatch.id }))
      setSitioSlug(sedeMatch.id)
    }

    setForm((f) => ({
      ...f,
      documento: docConsulta,
      hora: hourStr,
    }))

    setTurnoId(accesoTurno.id)
    setTurnoNumero(accesoTurno.numero)
    setPaso('confirmado')
    setCodigoCheckin(c)
    setCodigoRetraso('')
    setRetrasoMsg(null)
    setCheckInListo(false)
    setCheckInMetodo(null)
    setGpsStatus('idle')
    setGpsDistanciaM(null)
    setQrInput('')
    setQrStatus('idle')
    setQrScanOpen(false)
    setCheckInOpen(false)
    setTardeOpen(false)
    setAccesoOpen(false)
  }

  const sedeSitio = sedes.find((s) => s.id === sitioSlug) ?? sedes[0]

  const HeaderBar = () => {
    const lastTurnStr = localStorage.getItem('detaim_last_turn')
    const lastTurn = lastTurnStr ? JSON.parse(lastTurnStr) : null

    return (
      <header className="relative border-b border-zinc-200/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row sm:gap-3">
          <div 
            className="flex w-full min-w-0 cursor-pointer items-center justify-center gap-3 sm:w-auto sm:justify-start"
            onClick={() => navigate(empresaSlug ? `/${empresaSlug}` : '/')}
          >
            <img
              src={empresaCustom?.logo_url || "/detaim.avif"}
              alt={empresaCustom?.nombre || "DETAIM"}
              className="h-9 w-auto shrink-0 object-contain sm:h-10"
              width={120}
              height={40}
            />
            <div className="hidden text-left xs:block">
              <p className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
                {empresaCustom?.nombre}
              </p>
              {!empresaCustom && <p className="text-[10px] text-zinc-500 sm:text-xs">Turnos sin complicaciones</p>}
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
            {lastTurn && (
              <button
                type="button"
                onClick={() => {
                  setDocConsulta(lastTurn.documento || '')
                  setConsultarOpen(true)
                }}
                className="flex-1 rounded-xl border border-kivo-200 bg-kivo-50 px-3 py-2 text-xs font-semibold text-kivo-900 shadow-sm transition hover:bg-kivo-100 focus:outline-none focus:ring-2 focus:ring-kivo-500/20 sm:flex-none sm:px-4 sm:py-2.5 sm:text-sm"
              >
                Recuperar último código
              </button>
            )}
            <button
              type="button"
              onClick={() => setSitioOpen(true)}
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-kivo-500/20 sm:flex-none sm:px-4 sm:py-2.5 sm:text-sm"
            >
              Consultar sitio
            </button>
            <button
              type="button"
              onClick={() => setConsultarOpen(true)}
              className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 sm:flex-none sm:px-4 sm:py-2.5 sm:text-sm"
            >
              Consultar turno
            </button>
          </div>
        </div>
      </header>
    )
  }

  const Footer = () => {
    return (
      <footer className="mt-auto border-t border-zinc-200 bg-white/80 py-12 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img 
                  src={empresaCustom?.logo_url || "/detaim.avif"} 
                  alt={empresaCustom?.nombre || "DETAIM"} 
                  className="h-6 w-auto object-contain" 
                />
                <span className="text-lg font-bold tracking-tight text-zinc-900">
                  {empresaCustom?.nombre}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-500">
                {empresaCustom 
                  ? `Plataforma de turnos oficial de ${empresaCustom.nombre}, potenciada por la tecnología de DETAIM.`
                  : 'La plataforma líder en gestión de turnos y filas en Colombia. Optimizamos la espera para que tus clientes valoren su tiempo.'}
              </p>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Desarrollado por</span>
                <a 
                  href="https://detaim.com" 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex w-fit items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800"
                >
                  <img src="/detaim.avif" alt="DETAIM" className="h-4 w-auto brightness-0 invert" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">
                Legal y Privacidad
              </h3>
              <ul className="space-y-3 text-sm font-medium text-zinc-600">
                <li>
                  <button onClick={() => navigate('/legal/tratamiento-datos')} className="transition hover:text-kivo-600">
                    Tratamiento de Datos
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/legal/terminos-condiciones')} className="transition hover:text-kivo-600">
                    Términos y Condiciones
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/legal/politica-privacidad')} className="transition hover:text-kivo-600">
                    Política de Privacidad
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/legal/manejo-cookies')} className="transition hover:text-kivo-600">
                    Manejo de Cookies
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">
                Soporte y Contacto
              </h3>
              <ul className="space-y-3 text-sm font-medium text-zinc-600">
                <li>
                  <button onClick={() => setContactOpen(true)} className="transition hover:text-kivo-600">
                    Contáctanos
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/panel')} className="transition hover:text-kivo-600">
                    Iniciar sesión (Staff)
                  </button>
                </li>
                <li>
                  <button onClick={() => setSitioOpen(true)} className="transition hover:text-kivo-600">
                    Información de sedes
                  </button>
                </li>
              </ul>
              <a 
                href="mailto:soporte@detaim.com" 
                className="mt-4 inline-block text-sm font-bold text-kivo-600 hover:underline"
              >
                soporte@detaim.com
              </a>
            </div>
          </div>
          <div className="mt-12 border-t border-zinc-100 pt-8 text-center flex flex-col items-center gap-3">
            <img src="/detaim.avif" alt="DETAIM" className="h-4 w-auto opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition" />
            <p className="text-xs text-zinc-400">
              © 2026 Colombia. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    )
  }

  const Modal = ({
    open,
    onClose,
    title,
    titleId,
    children,
  }: {
    open: boolean
    onClose: () => void
    title: string
    titleId?: string
  } & { children: ReactNode }) => {
    const tid = titleId ?? dialogTitleId
    if (!open) return null
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Cerrar"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={tid}
          className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={tid} className="text-lg font-semibold text-zinc-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Cerrar diálogo"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    )
  }

  const cs = lugarActual ? cargaStyles(lugarActual.carga) : cargaStyles('baja')

  const fondo = (
    <>
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full blur-3xl"
        style={{ backgroundColor: `${empresaCustom?.color_hex || '#0ea5e9'}26` }} // 26 is ~15% opacity in hex
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full blur-3xl"
        style={{ backgroundColor: `${empresaCustom?.color_hex || '#14b8a6'}33` }} // 33 is ~20% opacity in hex
        aria-hidden
      />
    </>
  )

  if (paso === 'confirmado' && fecha && lugarActual) {
    return (
      <div className="relative flex min-h-svh flex-col overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
        {fondo}
        <HeaderBar />
        <main className="relative mx-auto w-full max-w-lg flex-1 px-6 py-10 pb-24">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div ref={ticketRef} className="w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white shadow-2xl shadow-zinc-200/50">
              <div className="bg-zinc-900 p-8 text-white">
                <div className="flex justify-center mb-4">
                  <img
                    src={empresaCustom?.logo_url || "/kivo-logo.png"}
                    alt=""
                    className="h-12 w-auto object-contain brightness-0 invert"
                  />
                </div>
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] opacity-60">
                    Turno confirmado
                  </h2>
                  <div className="flex flex-col items-end gap-1">
                    {prioridadPreferencial && (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-950">
                        Preferencial
                      </span>
                    )}
                    {checkInListo && (
                      <span className="rounded-full bg-kivo-400 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-kivo-950">
                        Check-in {checkInMetodo === 'gps' ? 'GPS' : 'QR'}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-4 text-7xl font-black tracking-tighter">
                  {turnoNumero}
                </p>
              </div>
              <div className="p-8 text-left">
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sede</p>
                    <p className="text-lg font-bold text-zinc-900">{lugarLabel}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Fecha</p>
                      <p className="font-bold text-zinc-900">{format(fecha, 'dd/MM/yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Hora</p>
                      <p className="font-bold text-zinc-900">{form.hora}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-6 border border-zinc-100 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Código seguro</p>
                    <p className="text-4xl font-black tracking-[0.3em] text-zinc-900">
                      {codigoCheckin}
                    </p>
                    <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
                      Guardá este código. Lo necesitarás para hacer el Check-In al llegar a la sede.
                    </p>
                  </div>
                  {filaInfo && (
                    <div className="rounded-2xl bg-kivo-50 p-4 border border-kivo-100">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-kivo-600 mb-1">Tu lugar en la fila</p>
                      <div className="flex justify-between items-end">
                        <p className="text-sm font-bold text-zinc-900">Faltan {filaInfo.faltan} personas</p>
                        <p className="text-xs text-kivo-700">~{filaInfo.estimadoMinutos} min</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleGuardarImagen()}
                className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-6 py-4 text-sm font-bold text-zinc-900 shadow-sm transition hover:bg-zinc-50"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Guardar imagen
              </button>
              <button
                type="button"
                onClick={resetTodo}
                className="rounded-2xl bg-zinc-900 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800"
              >
                Finalizar
              </button>
            </div>
          </div>
        </main>
        <Footer />

        <Modal
          open={checkInOpen}
          onClose={() => {
            setQrScanOpen(false)
            setCheckInOpen(false)
          }}
          title="Hacer Check-In"
        >
          <p className="text-sm text-zinc-600">
            Ingresá tu código seguro y elegí el método: ubicación (GPS) o QR de la
            sede.
          </p>
          <div className="mt-3">
            <FieldLabel htmlFor="codigo-checkin-modal">Código seguro</FieldLabel>
            <input
              id="codigo-checkin-modal"
              inputMode="numeric"
              maxLength={4}
              value={codigoCheckin}
              onChange={(e) =>
                setCodigoCheckin(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-center font-mono text-xl tracking-widest"
            />
          </div>

          {qrScanOpen ? (
            <div className="mt-4">
              <QrScanner
                onDetect={(v) => {
                  setQrInput(v)
                  setQrStatus('idle')
                  void handleQrValidate(v)
                }}
                onClose={() => setQrScanOpen(false)}
              />
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-center text-sm font-semibold text-zinc-900">
                  Ubicación (GPS)
                </p>
                <button
                  type="button"
                  onClick={() => void handleGpsCheckIn()}
                  disabled={
                    gpsStatus === 'loading' ||
                    codigoCheckin.replace(/\D/g, '').length !== 4
                  }
                  className="mt-3 w-full rounded-2xl bg-kivo-600 py-3 text-sm font-bold text-white hover:bg-kivo-700 disabled:opacity-60"
                >
                  {gpsStatus === 'loading'
                    ? 'Buscando señal…'
                    : 'Confirmar con mi ubicación'}
                </button>
                {gpsStatus === 'lejos' && (
                  <p className="mt-2 text-center text-xs text-amber-800">
                    Estás fuera de los {radioMetros} m. Acercate o usá el QR.
                  </p>
                )}
                {gpsStatus === 'error' && (
                  <p className="mt-2 text-center text-xs text-red-700">
                    No pudimos leer el GPS. Probá con el QR.
                  </p>
                )}
                {gpsStatus === 'ok' && gpsDistanciaM != null && (
                  <p className="mt-2 text-center text-xs text-zinc-600">
                    Distancia a la sede: ~{gpsDistanciaM} m
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                <p className="text-center text-sm font-semibold text-zinc-900">
                  Código en la sede (QR)
                </p>
                <button
                  type="button"
                  onClick={() => setQrScanOpen(true)}
                  disabled={codigoCheckin.replace(/\D/g, '').length !== 4}
                  className="mt-3 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  Escanear QR
                </button>
                <input
                  type="text"
                  value={qrInput}
                  onChange={(e) => {
                    setQrInput(e.target.value)
                    setQrStatus('idle')
                  }}
                  placeholder="O pegar código (Ej. KIVO-eps-norte)"
                  className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
                />
                <button
                  type="button"
                  onClick={() => void handleQrValidate()}
                  disabled={codigoCheckin.replace(/\D/g, '').length !== 4}
                  className="mt-2 w-full rounded-xl bg-kivo-600 py-2.5 text-sm font-semibold text-white hover:bg-kivo-700 disabled:opacity-50"
                >
                  Validar código
                </button>
                {qrStatus === 'invalid' && (
                  <p className="mt-2 text-center text-xs text-red-700">
                    Código no coincide con esta sede.
                  </p>
                )}
              </div>
            </>
          )}
        </Modal>

        <Modal
          open={tardeOpen}
          onClose={() => setTardeOpen(false)}
          title="Tardo más"
        >
          <p className="text-sm text-zinc-600">
            Si vas tarde, podés ceder 3 o 5 puestos sin perder el turno. Ingresá
            tu código seguro.
          </p>
          <div className="mt-3">
            <FieldLabel htmlFor="codigo-tarde">Código seguro</FieldLabel>
            <input
              id="codigo-tarde"
              inputMode="numeric"
              maxLength={4}
              value={codigoRetraso}
              onChange={(e) =>
                setCodigoRetraso(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-center font-mono text-xl tracking-widest"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={!turnoId || codigoRetraso.length !== 4}
              onClick={() => {
                if (!turnoId || codigoRetraso.length !== 4) return
                void retrasoCortesia(turnoId, codigoRetraso, 3)
                  .then((r) => {
                    setRetrasoMsg(`Listo: te movimos ${r.pasosMovidos ?? 3} puestos.`)
                    setTardeOpen(false)
                  })
                  .catch(() => setRetrasoMsg('No se pudo aplicar. Revisá el código.'))
              }}
              className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Ceder 3 puestos
            </button>
            <button
              type="button"
              disabled={!turnoId || codigoRetraso.length !== 4}
              onClick={() => {
                if (!turnoId || codigoRetraso.length !== 4) return
                void retrasoCortesia(turnoId, codigoRetraso, 5)
                  .then((r) => {
                    setRetrasoMsg(`Listo: te movimos ${r.pasosMovidos ?? 5} puestos.`)
                    setTardeOpen(false)
                  })
                  .catch(() => setRetrasoMsg('No se pudo aplicar. Revisá el código.'))
              }}
              className="flex-1 rounded-xl bg-amber-700 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Ceder 5 puestos
            </button>
          </div>
          {retrasoMsg && (
            <p className="mt-3 text-center text-xs text-amber-900">{retrasoMsg}</p>
          )}
        </Modal>

        <Modal
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title="¿Cancelar el turno?"
          titleId={cancelDialogId}
        >
          <p className="text-sm text-zinc-600">
            Se va a liberar el cupo en el sistema. Ingresá tu código seguro.
          </p>
          <div className="mt-3">
            <FieldLabel htmlFor="codigo-cancel">Código seguro</FieldLabel>
            <input
              id="codigo-cancel"
              inputMode="numeric"
              maxLength={4}
              value={codigoCancelar}
              onChange={(e) =>
                setCodigoCancelar(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-center font-mono text-xl tracking-widest"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-800"
            >
              No, volver
            </button>
            <button
              type="button"
              onClick={() => {
                setCancelOpen(false)
                if (turnoId && codigoCancelar.length === 4) {
                  void cancelarTurno(turnoId, codigoCancelar).finally(() =>
                    resetTodo(),
                  )
                }
              }}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              disabled={codigoCancelar.length !== 4}
            >
              Sí, cancelar
            </button>
          </div>
        </Modal>

        <Modal
        open={legalModal?.open ?? false}
        onClose={() => setLegalModal(null)}
        title={legalModal?.title ?? ''}
      >
        {legalModal?.content}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setLegalModal(null)}
            className="w-full rounded-2xl bg-zinc-900 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
          >
            Entendido
          </button>
        </div>
      </Modal>

      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title="Contáctanos">
          <p className="text-sm text-zinc-600">
            ¿Tu empresa quiere usar nuestra plataforma? Escríbenos.
          </p>
          <a
            href="mailto:hola@detaim.com?subject=Consulta%20Plataforma%20Turnos"
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
          >
            hola@detaim.com
          </a>
          <p className="mt-3 text-center text-xs text-zinc-500">
            Te respondemos en un día hábil, más o menos.
          </p>
        </Modal>

        <Modal
          open={sitioOpen}
          onClose={() => setSitioOpen(false)}
          title="Consultar sitio"
          titleId={sitioModalTitleId}
        >
          {sedeSitio && (
            <>
              <FieldLabel htmlFor="sitio-sede">Sede</FieldLabel>
              <select
                id="sitio-sede"
                value={sitioSlug}
                onChange={(e) => setSitioSlug(e.target.value)}
                className="mb-4 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900"
              >
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-zinc-500">Dirección</dt>
                  <dd className="font-medium text-zinc-900">{sedeSitio.direccion}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Horario</dt>
                  <dd className="font-medium text-zinc-900">
                    De {horaCorta(sedeSitio.horaApertura)} a{' '}
                    {horaCorta(sedeSitio.horaCierre)} (hora local)
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Turno que atienden ahora</dt>
                  <dd className="font-mono text-lg font-bold text-kivo-800">
                    {sedeSitio.turnoAtendiendo}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Fila estimada</dt>
                  <dd className="text-zinc-800">
                    ~{sedeSitio.personasDelante} personas en cola · espera
                    aprox. {sedeSitio.esperaMinAprox} min
                  </dd>
                </div>
              </dl>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${sedeSitio.lat},${sedeSitio.lng}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center rounded-2xl border border-zinc-200 py-3 text-sm font-semibold text-kivo-800 hover:bg-zinc-50"
              >
                Ver en mapa
              </a>
            </>
          )}
        </Modal>
      </div>
    )
  }

  if (!sedes.length && !sedesError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50 text-zinc-600">
        Cargando sedes…
      </div>
    )
  }

  if (sedesError || !sedes.length) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center">
        <p className="max-w-md text-zinc-700">{sedesError}</p>
        <p className="text-sm text-zinc-500">
          En la carpeta <code className="rounded bg-zinc-200 px-1">server</code>{' '}
          ejecutá: <code className="rounded bg-zinc-200 px-1">npm install</code>{' '}
          y <code className="rounded bg-zinc-200 px-1">npm run dev</code> (con{' '}
          <code className="rounded bg-zinc-200 px-1">DATABASE_URL</code> en{' '}
          <code className="rounded bg-zinc-200 px-1">server/.env</code>).
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
      {fondo}
      <HeaderBar />

      <main className="relative mx-auto w-full max-w-3xl flex-1 px-6 py-10 pb-20">
        <nav
          className="mb-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-4 text-[10px] font-bold uppercase tracking-widest sm:gap-x-6 sm:text-xs"
          aria-label="Pasos del trámite"
        >
          {(
            [
              { id: 'inicio' as const, label: 'Empresa' },
              { id: 'datos' as const, label: 'Tus datos' },
              { id: 'detalle' as const, label: 'Turno' },
            ] as const
          ).map((s, i) => {
            const idx = paso === 'inicio' ? 0 : paso === 'datos' ? 1 : 2
            const actual = paso === s.id
            const pasado = i < idx
            return (
              <span key={s.id} className="flex items-center gap-2">
                {i > 0 && <span className="text-zinc-300">/</span>}
                <span
                  className={`transition-colors duration-300 ${
                    actual
                      ? 'text-kivo-600 underline decoration-2 underline-offset-8'
                      : pasado
                        ? 'text-kivo-800'
                        : 'text-zinc-400'
                  }`}
                >
                  {s.label}
                </span>
              </span>
            )
          })}
        </nav>

        {paso === 'inicio' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
                {empresaCustom ? `Bienvenido a ${empresaCustom.nombre}` : '¿Dónde querés el turno?'}
              </h1>
              <p className="mt-2 text-zinc-600">
                {empresaCustom 
                  ? 'Por favor seleccioná la sede en la que deseás ser atendido.' 
                  : 'Elegí la empresa para continuar con tu solicitud.'}
              </p>
            </div>

            <section className="rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-lg sm:p-8">
              {!empresaCustom ? (
                <>
                  <FieldLabel htmlFor="empresa-select">Seleccioná la empresa</FieldLabel>
                  <select
                    id="empresa-select"
                    value={empresaSeleccionadaId}
                    onChange={(e) => setEmpresaSeleccionadaId(Number(e.target.value))}
                    className="w-full cursor-pointer appearance-none rounded-2xl border border-zinc-200 bg-zinc-50/50 bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                    }}
                  >
                    <option value="">Elegir empresa...</option>
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!empresaSeleccionadaId}
                    onClick={irASede}
                    className="mt-6 w-full rounded-2xl bg-zinc-900 py-4 text-sm font-bold text-white shadow-lg shadow-zinc-900/25 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </>
              ) : (
                <>
                  <FieldLabel htmlFor="sede-select">Seleccioná la sede</FieldLabel>
                  <select
                    id="sede-select"
                    value={empresaInicialId}
                    onChange={(e) => setEmpresaInicialId(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-2xl border border-zinc-200 bg-zinc-50/50 bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                    }}
                  >
                    {sedesFiltradas.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-4 flex gap-3">
                    {!empresaSlug && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmpresaCustom(null)
                          setEmpresaSeleccionadaId('')
                        }}
                        className="rounded-2xl border border-zinc-200 bg-white px-6 py-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
                      >
                        Cambiar empresa
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void irADatos()}
                      style={{ backgroundColor: empresaCustom?.color_hex || undefined }}
                      className="flex-1 rounded-2xl bg-kivo-600 py-4 text-sm font-bold text-white shadow-lg shadow-kivo-600/25 hover:opacity-90"
                    >
                      Continuar
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {paso === 'datos' && (
          <div className="space-y-6">
            <div>
              <button
                type="button"
                onClick={() => setPaso('inicio')}
                className="mb-4 text-sm font-medium text-kivo-700 hover:underline"
              >
                ← Volver
              </button>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
                Tus datos
              </h1>
              <p className="mt-2 text-zinc-600">
                Para identificarte y enviarte avisos al celular.
              </p>
            </div>

            <section className="rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-lg sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
                  <input
                    id="nombre"
                    value={form.nombre}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nombre: e.target.value }))
                    }
                    autoComplete="given-name"
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:bg-white focus:ring-2 focus:ring-kivo-500/20"
                    placeholder="Como en la cédula"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="apellido">Apellidos</FieldLabel>
                  <input
                    id="apellido"
                    value={form.apellido}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, apellido: e.target.value }))
                    }
                    autoComplete="family-name"
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:bg-white focus:ring-2 focus:ring-kivo-500/20"
                  />
                </div>
              </div>
              <div className="mt-5">
                <FieldLabel htmlFor="documento">
                  Número de cédula o documento
                </FieldLabel>
                <input
                  id="documento"
                  value={form.documento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, documento: e.target.value }))
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:bg-white focus:ring-2 focus:ring-kivo-500/20"
                />
              </div>
              <div className="mt-5">
                <FieldLabel htmlFor="telefono">Celular</FieldLabel>
                <input
                  id="telefono"
                  type="tel"
                  inputMode="tel"
                  value={form.telefono}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, telefono: e.target.value }))
                  }
                  autoComplete="tel"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:bg-white focus:ring-2 focus:ring-kivo-500/20"
                  placeholder="Ej. 300 123 4567"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (
                    !form.nombre.trim() ||
                    !form.apellido.trim() ||
                    !form.documento.trim() ||
                    !form.telefono.trim()
                  ) {
                    return
                  }
                  setPaso('detalle')
                }}
                style={{ backgroundColor: empresaCustom?.color_hex || undefined }}
                className="mt-8 w-full rounded-2xl bg-kivo-600 py-4 text-sm font-bold text-white shadow-lg shadow-kivo-600/25 hover:opacity-90"
              >
                Siguiente: elegir fecha y hora
              </button>
            </section>
          </div>
        )}

        {paso === 'detalle' && lugarActual && (
          <div className="space-y-8">
            <div>
              <button
                type="button"
                onClick={() => setPaso('datos')}
                className="mb-4 text-sm font-medium text-kivo-700 hover:underline"
              >
                ← Volver
              </button>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
                Detalle del turno
              </h1>
              <p className="mt-2 text-zinc-600">
                Elegí día, sede y hora. Respondé el triage si la sede lo pide.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-start">
              <section className="rounded-3xl border border-zinc-200/80 bg-white/90 p-5 shadow-lg">
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Día del turno
                </h2>
                <p className="mb-3 text-base font-medium text-zinc-900">
                  {fecha
                    ? format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })
                    : 'Elegí una fecha'}
                </p>
                <div className="flex justify-center">
                  <DayPicker
                    mode="single"
                    selected={fecha}
                    onSelect={setFecha}
                    locale={es}
                    disabled={{ before: today }}
                    showOutsideDays
                    fixedWeeks
                    className="kivo-calendar text-zinc-800"
                  />
                </div>
              </section>

              <div className="space-y-6">
                <section
                  className="rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-lg sm:p-8"
                  aria-live="polite"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                      Carga de la sede (en vivo)
                    </h2>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cs.badge}`}
                    >
                      {cs.label}
                    </span>
                  </div>
                  <p className="mt-4 text-lg text-zinc-900">
                    Van{' '}
                    <span className="font-semibold tabular-nums">
                      {lugarActual.personasDelante}
                    </span>{' '}
                    {lugarActual.personasDelante === 1
                      ? 'persona'
                      : 'personas'}{' '}
                    delante tuyo · tiempo aproximado:{' '}
                    <span className="font-semibold tabular-nums">
                      {lugarActual.esperaMinAprox} min
                    </span>
                  </p>
                  {alternativaSede && (
                    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                      <p>
                        <span className="font-semibold">{lugarActual.label}</span>{' '}
                        está muy llena.{' '}
                        <span className="font-medium">
                          {alternativaSede.label}
                        </span>{' '}
                        tiene cupo más rápido (~{alternativaSede.esperaMinAprox}{' '}
                        min).
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, lugarId: alternativaSede.id }))
                        }
                        className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Cambiar a esa sede
                      </button>
                    </div>
                  )}

                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="lugar-detalle">Sede</FieldLabel>
                      <select
                        id="lugar-detalle"
                        value={form.lugarId}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, lugarId: e.target.value }))
                        }
                        className="w-full cursor-pointer appearance-none rounded-2xl border border-zinc-200 bg-zinc-50/50 bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                        }}
                      >
                        {sedes.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="hora-detalle">Hora</FieldLabel>
                      <input
                        id="hora-detalle"
                        type="time"
                        required
                        value={form.hora}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, hora: e.target.value }))
                        }
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-indigo-200 bg-indigo-50/80 p-6 shadow-lg sm:p-8">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-800">
                    Turno híbrido (fila virtual)
                  </h2>
                  <p className="text-sm text-indigo-950">
                    Pedís el turno desde tu casa. Cuando el GPS te detecte a{' '}
                    <strong>{radioMetros} m</strong> de la sede, podés hacer
                    check-in remoto. Si no llegás a la hora pactada, el sistema
                    puede <strong>correr tu turno dos posiciones</strong> para
                    no frenar la fila.
                  </p>
                  <label className="mt-4 flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={modoHibrido}
                      onChange={(e) => setModoHibrido(e.target.checked)}
                      className="h-4 w-4 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-indigo-950">
                      Activar modo híbrido para esta reserva
                    </span>
                  </label>
                </section>

                {sedeTipo === 'eps' && (
                  <section className="rounded-3xl border border-red-200 bg-red-50/90 p-6 shadow-lg">
                    <h2 className="mb-2 text-sm font-semibold text-red-900">
                      Triage · EPS
                    </h2>
                    <p className="text-sm text-red-950">
                      ¿Presentás síntomas que sugieren{' '}
                      <strong>urgencia vital</strong> (dolor torácico intenso,
                      sangrado abundante, falta de aire severa, etc.)?
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setTriageUrgencia(true)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                          triageUrgencia === true
                            ? 'bg-red-700 text-white'
                            : 'bg-white text-red-800 ring-1 ring-red-300'
                        }`}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setTriageUrgencia(false)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                          triageUrgencia === false
                            ? 'bg-kivo-600 text-white'
                            : 'bg-white text-red-800 ring-1 ring-red-300'
                        }`}
                      >
                        No
                      </button>
                    </div>
                    {triageUrgencia === true && (
                      <div className="mt-4 rounded-2xl border border-red-300 bg-white p-4">
                        <p className="text-sm font-semibold text-red-900">
                          No te damos turno de asesoría. Andá a urgencias o
                          llamá al 123.
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <a
                            href="https://www.google.com/maps/search/urgencias+hospital+bogota"
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 rounded-xl bg-red-600 py-2.5 text-center text-sm font-bold text-white hover:bg-red-700"
                          >
                            Ver mapa · Urgencias
                          </a>
                          <a
                            href="tel:123"
                            className="flex-1 rounded-xl border border-red-300 py-2.5 text-center text-sm font-bold text-red-900 hover:bg-red-50"
                          >
                            Llamar 123
                          </a>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {sedeTipo === 'banco' && (
                  <section className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-lg">
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                      Triage · Banco
                    </h2>
                    <p className="text-sm text-zinc-700">
                      ¿Tu trámite requiere <strong>manejo de efectivo</strong>{' '}
                      (retiros, consignaciones, moneda)?
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setTriageEfectivo(true)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                          triageEfectivo === true
                            ? 'bg-kivo-600 text-white'
                            : 'bg-zinc-100 text-zinc-800'
                        }`}
                      >
                        Sí, voy a caja
                      </button>
                      <button
                        type="button"
                        onClick={() => setTriageEfectivo(false)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                          triageEfectivo === false
                            ? 'bg-kivo-600 text-white'
                            : 'bg-zinc-100 text-zinc-800'
                        }`}
                      >
                        No, asesoría
                      </button>
                    </div>
                    {triageEfectivo === true && (
                      <p className="mt-3 text-xs text-zinc-600">
                        Te orientamos a <strong>caja</strong> en el orden de la
                        fila virtual.
                      </p>
                    )}
                    {triageEfectivo === false && (
                      <p className="mt-3 text-xs text-zinc-600">
                        Te orientamos a <strong>consultoría</strong> sin caja.
                      </p>
                    )}
                  </section>
                )}

                {(preguntasExtraError || preguntasExtra.length > 0) && (
                  <section className="rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-lg sm:p-8">
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                      Preguntas de la empresa
                    </h2>
                    <p className="mb-4 text-sm text-zinc-600">
                      Estas preguntas son obligatorias para completar el turno.
                    </p>
                    {preguntasExtraError && (
                      <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {preguntasExtraError}
                      </p>
                    )}
                    <div className="space-y-5">
                      {preguntasExtra.map((q) => (
                        <div key={q.key}>
                          <FieldLabel htmlFor={`extra-${q.key}`}>{q.label}</FieldLabel>
                          {q.type === 'bool' ? (
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setRespuestasExtra((r) => ({ ...r, [q.key]: true }))
                                }
                                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                                  respuestasExtra[q.key] === true
                                    ? 'bg-kivo-600 text-white'
                                    : 'bg-zinc-100 text-zinc-800'
                                }`}
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setRespuestasExtra((r) => ({ ...r, [q.key]: false }))
                                }
                                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                                  respuestasExtra[q.key] === false
                                    ? 'bg-kivo-600 text-white'
                                    : 'bg-zinc-100 text-zinc-800'
                                }`}
                              >
                                No
                              </button>
                            </div>
                          ) : q.type === 'dropdown' ? (
                            <select
                              id={`extra-${q.key}`}
                              value={typeof respuestasExtra[q.key] === 'string' ? (respuestasExtra[q.key] as string) : ''}
                              onChange={(e) =>
                                setRespuestasExtra((r) => ({ ...r, [q.key]: e.target.value }))
                              }
                              className="w-full cursor-pointer appearance-none rounded-2xl border border-zinc-200 bg-zinc-50/50 bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                              }}
                            >
                              <option value="">Seleccionar…</option>
                              {(q.options || []).map((op) => (
                                <option key={op} value={op}>
                                  {op}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              id={`extra-${q.key}`}
                              value={
                                typeof respuestasExtra[q.key] === 'number' ||
                                typeof respuestasExtra[q.key] === 'string'
                                  ? String(respuestasExtra[q.key])
                                  : ''
                              }
                              onChange={(e) =>
                                setRespuestasExtra((r) => ({
                                  ...r,
                                  [q.key]: Number(e.target.value),
                                }))
                              }
                              className="w-full cursor-pointer appearance-none rounded-2xl border border-zinc-200 bg-zinc-50/50 bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                              }}
                            >
                              <option value="">Seleccionar…</option>
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={String(n)}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                      {preguntasExtra.length === 0 && !preguntasExtraError && (
                        <p className="text-sm text-zinc-500">
                          Esta empresa no tiene preguntas adicionales.
                        </p>
                      )}
                    </div>
                  </section>
                )}

                <section className="rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-lg sm:p-8">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                    Atención preferencial
                  </h2>
                  <p className="mb-4 text-sm text-zinc-600">
                    Prefijo <span className="font-mono font-semibold">P-</span>{' '}
                    si aplica ley de atención preferencial.
                  </p>
                  <fieldset className="space-y-2">
                    <legend className="sr-only">Categoría preferencial</legend>
                    {PRIORIDAD_OPCIONES.map((op) => (
                      <label
                        key={op.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                          prioridad === op.id
                            ? 'border-kivo-500 bg-kivo-50/80 ring-1 ring-kivo-500/30'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="prioridad"
                          value={op.id}
                          checked={prioridad === op.id}
                          onChange={() => setPrioridad(op.id)}
                          className="mt-1 h-4 w-4 border-zinc-300 text-kivo-600 focus:ring-kivo-500"
                        />
                        <span>
                          <span className="block font-medium text-zinc-900">
                            {op.label}
                          </span>
                          <span className="text-sm text-zinc-500">
                            {op.descripcion}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </section>

                {submitError && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                    {submitError}
                  </p>
                )}

                <form onSubmit={(e) => void handleSubmitTurno(e)} className="space-y-4">
                  <button
                    type="submit"
                    disabled={!puedeConfirmar || !form.hora || reservando}
                    style={{ backgroundColor: empresaCustom?.color_hex || undefined }}
                    className="w-full rounded-2xl bg-kivo-600 py-4 text-sm font-bold text-white shadow-lg shadow-kivo-600/25 hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {reservando ? 'Reservando…' : 'Confirmar turno'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      <Modal
        open={consultarOpen}
        onClose={() => setConsultarOpen(false)}
        title="Consultar turnos vigentes"
      >
        <p className="text-sm text-zinc-600 mb-4">
          Ingresá tu número de cédula para ver tus turnos activos.
        </p>
        <form 
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            void consultarDocumento()
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={docConsulta}
            onChange={(e) => {
              setDocConsulta(e.target.value)
              setResultadosConsulta(null)
            }}
            placeholder="Ej. 1.234.567.890"
            className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
          />
          <button
            type="submit"
            disabled={consultaCargando}
            className="rounded-2xl border border-kivo-600 bg-white px-6 py-3 text-sm font-semibold text-kivo-800 hover:bg-kivo-50 disabled:opacity-50"
          >
            {consultaCargando ? '…' : 'Consultar'}
          </button>
        </form>
        {resultadosConsulta && (
          <ul className="mt-4 space-y-3">
            {resultadosConsulta.length === 0 ? (
              <li className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                No hay turnos vigentes con ese documento.
              </li>
            ) : (
              resultadosConsulta.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-kivo-100 bg-kivo-50/50 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-kivo-900">
                        {t.numero}
                      </span>
                      <span className="truncate text-zinc-700">{t.sede}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{t.fechaHora}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConsultarOpen(false)
                      abrirAccesoTurno(t)
                    }}
                    className="rounded-xl bg-kivo-600 px-4 py-2 text-xs font-bold text-white hover:bg-kivo-700"
                  >
                    Acceder
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </Modal>

      <Modal
        open={accesoOpen}
        onClose={() => setAccesoOpen(false)}
        title="Acceder al turno"
      >
        <p className="text-sm text-zinc-600">
          Ingresá el código seguro de 4 dígitos para acceder al turno.
        </p>
        {accesoTurno && (
          <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
            Turno <span className="font-mono font-bold">{accesoTurno.numero}</span> ·{' '}
            {accesoTurno.sede}
          </p>
        )}
        <div className="mt-3">
          <FieldLabel htmlFor="codigo-acceso">Código seguro</FieldLabel>
          <input
            id="codigo-acceso"
            inputMode="numeric"
            maxLength={4}
            value={accesoCodigo}
            onChange={(e) => {
              setAccesoCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))
              setAccesoError(null)
            }}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-center font-mono text-xl tracking-widest"
          />
        </div>
        {accesoError && (
          <p className="mt-2 text-sm text-red-700">{accesoError}</p>
        )}
        <button
          type="button"
          onClick={confirmarAccesoTurno}
          disabled={accesoCodigo.replace(/\D/g, '').length !== 4 || !accesoTurno}
          className="mt-4 w-full rounded-2xl bg-kivo-600 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          Acceder
        </button>
      </Modal>

      <Modal open={sitioOpen} onClose={() => setSitioOpen(false)} title="Consultar sitio" titleId={sitioModalTitleId}>
        {sedeSitio && (
          <>
            <FieldLabel htmlFor="sitio-sede-main">Sede</FieldLabel>
            <select
              id="sitio-sede-main"
              value={sitioSlug}
              onChange={(e) => setSitioSlug(e.target.value)}
              className="mb-4 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900"
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-zinc-500">Dirección</dt>
                <dd className="font-medium text-zinc-900">{sedeSitio.direccion}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Horario</dt>
                <dd className="font-medium text-zinc-900">
                  De {horaCorta(sedeSitio.horaApertura)} a{' '}
                  {horaCorta(sedeSitio.horaCierre)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Turno en ventanilla</dt>
                <dd className="font-mono text-lg font-bold text-kivo-800">
                  {sedeSitio.turnoAtendiendo}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Fila</dt>
                <dd className="text-zinc-800">
                  ~{sedeSitio.personasDelante} personas · ~{sedeSitio.esperaMinAprox}{' '}
                  min
                </dd>
              </div>
            </dl>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${sedeSitio.lat},${sedeSitio.lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex w-full items-center justify-center rounded-2xl border border-zinc-200 py-3 text-sm font-semibold text-kivo-800 hover:bg-zinc-50"
            >
              Ver en mapa
            </a>
          </>
        )}
      </Modal>

      <Modal
        open={modalCodigoOpen}
        onClose={() => {
          setModalCodigoOpen(false)
          setSubmitError(
            'Tenés que activar el turno con el código o volvé a intentar desde el paso anterior.',
          )
        }}
        title="Código seguro"
      >
        <p className="text-sm text-zinc-600">
          Guardá este código: lo vas a usar para check-in, consultar o cancelar
          el turno desde cualquier lugar.
        </p>
        <p className="mt-4 text-center font-mono text-4xl font-bold tracking-widest text-kivo-800">
          {codigoAsignado}
        </p>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Ingresalo de nuevo para confirmar que lo anotaste bien.
        </p>
        <input
          inputMode="numeric"
          maxLength={4}
          value={codigoDigitado}
          onChange={(e) =>
            setCodigoDigitado(e.target.value.replace(/\D/g, '').slice(0, 4))
          }
          placeholder="••••"
          className="mt-4 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
        />
        {submitError && (
          <p className="mt-2 text-sm text-red-700">{submitError}</p>
        )}
        <button
          type="button"
          onClick={() => void handleConfirmarCodigoModal()}
          disabled={codigoDigitado.length !== 4}
          className="mt-4 w-full rounded-2xl bg-kivo-600 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          Activar mi turno
        </button>
      </Modal>

      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title="Contáctanos">
        <p className="text-sm text-zinc-600">
          ¿Tu empresa quiere usar KIVO? Escríbenos.
        </p>
        <a
          href="mailto:hola@kivo.app?subject=Consulta%20KIVO%20Colombia"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-kivo-200 bg-kivo-50 px-4 py-3 text-sm font-semibold text-kivo-900 hover:bg-kivo-100"
        >
          hola@kivo.app
        </a>
        <p className="mt-3 text-center text-xs text-zinc-500">
          Te respondemos en un día hábil, más o menos.
        </p>
      </Modal>
      <Footer />
    </div>
  )
}
