import { useParams, useNavigate, Link } from 'react-router-dom'
import { useEffect } from 'react'

const LEGAL_CONTENT: Record<string, { title: string; content: React.ReactNode }> = {
  'tratamiento-datos': {
    title: 'Política de Tratamiento de Datos Personales (Habeas Data)',
    content: (
      <div className="space-y-6">
        <p>De conformidad con la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas concordantes, <strong>DETAIM</strong> (en adelante, "La Compañía"), en su calidad de Responsable del Tratamiento de datos personales, informa a los usuarios sobre su política para la recolección, almacenamiento, uso, circulación y supresión de la información personal.</p>
        
        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">1. Finalidades del Tratamiento</h3>
        <p>Los datos personales proporcionados por los tiradores serán tratados para:</p>
        <ul className="list-disc pl-6 space-y-3 text-zinc-600">
          <li><strong>Gestión de Reservas:</strong> Asignación de líneas de tiro y control de flujo en el polígono.</li>
          <li><strong>Seguridad y Control:</strong> Verificación de identidad obligatoria para el uso de simuladores tácticos.</li>
          <li><strong>Comunicaciones Técnicas:</strong> Notificaciones sobre estado de calibración, cambios de horario o alertas de sesión.</li>
        </ul>

        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">2. Derechos de los Titulares</h3>
        <p>Usted tiene derecho a conocer, actualizar y rectificar su información personal en cualquier momento a través de nuestros canales oficiales.</p>
      </div>
    )
  },
  'terminos-condiciones': {
    title: 'Términos y Condiciones de Uso',
    content: (
      <div className="space-y-6">
        <p>El uso de la plataforma de simulación táctica <strong>DETAIM</strong> implica la aceptación de los siguientes términos:</p>
        
        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">1. Compromisos del Tirador</h3>
        <ul className="list-disc pl-6 space-y-3 text-zinc-600">
          <li>Presentarse 10 minutos antes de la sesión para el briefing de seguridad.</li>
          <li>Seguir estrictamente las instrucciones del instructor a cargo.</li>
          <li>Hacer uso responsable del equipo láser de alta precisión.</li>
        </ul>

        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">2. Seguridad en el Polígono</h3>
        <p>Nuestros simuladores utilizan tecnología láser Clase 1 (segura para la vista). Sin embargo, se requiere el uso de protección visual si el instructor lo indica para fines de inmersión.</p>
      </div>
    )
  },
  'politica-privacidad': {
    title: 'Política Global de Privacidad',
    content: (
      <div className="space-y-6">
        <p>En <strong>DETAIM</strong>, protegemos su privacidad como si fuera la nuestra. Esta política detalla cómo manejamos su información en el ecosistema de nuestra plataforma.</p>
        
        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">1. Qué información recolectamos</h3>
        <p>Para la correcta prestación del servicio de turnos, solicitamos:</p>
        <ul className="list-disc pl-6 space-y-2 text-zinc-600">
          <li>Nombres y Apellidos.</li>
          <li>Número de documento de identidad (para validación en sede).</li>
          <li>Número de teléfono celular (para envío de avisos de turno).</li>
          <li>Ubicación geográfica aproximada (únicamente al momento del Check-In vía GPS).</li>
        </ul>

        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">2. Con quién compartimos sus datos</h3>
        <p>Su información es tratada bajo estrictos estándares de confidencialidad. <strong>Nunca</strong> vendemos sus datos a terceros. La información se comparte únicamente con:</p>
        <ul className="list-disc pl-6 space-y-3 text-zinc-600">
          <li><strong>Empresa Prestadora:</strong> La entidad (EPS, Banco, Notaría, etc.) en la cual usted solicitó el turno, con el fin de que puedan llamarlo a atención.</li>
          <li><strong>Proveedores de Infraestructura:</strong> Servicios de alojamiento web y envío de mensajes (SMS) que cumplen con certificaciones de seguridad internacional.</li>
        </ul>

        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">3. Retención de Datos</h3>
        <p>Los datos de los turnos se conservan por un periodo máximo necesario para cumplir con los análisis de calidad y auditoría de las empresas aliadas, tras lo cual son anonimizados para fines estadísticos.</p>
      </div>
    )
  },
  'manejo-cookies': {
    title: 'Política de Cookies y Almacenamiento Local',
    content: (
      <div className="space-y-6">
        <p>Nuestra plataforma utiliza tecnologías de almacenamiento para garantizar que el sistema de turnos funcione de manera fluida en su dispositivo.</p>
        
        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">1. Tipos de tecnologías utilizadas</h3>
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="font-bold text-black">Cookies Técnicas (Esenciales)</p>
            <p className="text-sm text-zinc-600">Permiten la navegación y el uso de las diferentes opciones o servicios que existen en la web, como controlar el tráfico y la comunicación de datos o identificar la sesión.</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="font-bold text-black">LocalStorage (Preferencias)</p>
            <p className="text-sm text-zinc-600">Utilizamos el almacenamiento local de su navegador para recordar el último turno solicitado. Esto permite que, si cierra la ventana por error, pueda recuperar su código seguro rápidamente sin tener que contactar a soporte.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">2. Ausencia de Rastreo Publicitario</h3>
        <p>En DETAIM valoramos su tiempo y su privacidad. Por ello:</p>
        <ul className="list-disc pl-6 space-y-2 text-zinc-600">
          <li><strong>NO</strong> utilizamos cookies de seguimiento (tracking).</li>
          <li><strong>NO</strong> compartimos información con redes sociales para perfiles publicitarios.</li>
          <li><strong>NO</strong> permitimos que terceros inserten anuncios en nuestra plataforma.</li>
        </ul>

        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">3. Cómo gestionar estas tecnologías</h3>
        <p>Usted puede restringir, bloquear o borrar las cookies de DETAIM utilizando la configuración de su navegador. Si decide desactivar las tecnologías esenciales, es posible que no pueda completar la solicitud de un turno de manera exitosa.</p>
      </div>
    )
  },
  'horario-atencion': {
    title: 'Horarios de Atención y Disponibilidad',
    content: (
      <div className="space-y-6">
        <p>En <strong>DETAIM</strong>, nos esforzamos por ofrecerte la mejor experiencia de simulación. A continuación, detallamos nuestros horarios de operación:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-50 text-black p-6 rounded-3xl border border-zinc-100 shadow-xl">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sede Cajicá
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Lunes a Viernes</span>
                <span className="font-bold">09:00 AM - 08:00 PM</span>
              </li>
              <li className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Sábados</span>
                <span className="font-bold">10:00 AM - 06:00 PM</span>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-500">Domingos y Festivos</span>
                <span className="font-bold text-red-600">Cerrado</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
            <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Notas Importantes
            </h4>
            <ul className="space-y-3 text-sm text-zinc-600">
              <li>• Las reservas deben realizarse con al menos <strong>2 horas de antelación</strong>.</li>
              <li>• Se recomienda llegar <strong>10 minutos antes</strong> de la sesión de tiro.</li>
              <li>• En caso de retraso superior a 15 minutos, la reserva podrá ser reasignada.</li>
            </ul>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">Atención al Cliente</h3>
        <p>Para consultas sobre horarios especiales o eventos corporativos, por favor contáctanos:</p>
        <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-black">Línea de Atención</p>
            <p className="text-sm text-zinc-600">+57 (300) 123-4567</p>
          </div>
        </div>
      </div>
    )
  },
  'preguntas-frecuentes': {
    title: 'Preguntas Frecuentes',
    content: (
      <div className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-xl font-black text-black flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs">?</span>
            Sobre las Reservas
          </h3>
          <div className="grid gap-4">
            <details className="group bg-zinc-50 p-6 rounded-3xl border border-zinc-100 cursor-pointer">
              <summary className="font-bold text-black list-none flex justify-between items-center">
                ¿Con cuánta anticipación debo reservar?
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-4 text-zinc-500 text-sm leading-relaxed">
                Recomendamos reservar con al menos 24 horas de antelación. Sin embargo, el sistema permite agendar hasta con 2 horas de anticipación según la disponibilidad del polígono.
              </p>
            </details>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-black flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs">🎯</span>
            Simulador Táctico
          </h3>
          <div className="grid gap-4">
            <details className="group bg-zinc-50 p-6 rounded-3xl border border-zinc-100 cursor-pointer">
              <summary className="font-bold text-black list-none flex justify-between items-center">
                ¿Qué tipo de tecnología utilizan?
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-4 text-zinc-500 text-sm leading-relaxed">
                Utilizamos sistemas de simulación láser de grado profesional con retroalimentación en tiempo real y balística digital precisa para entrenamiento táctico y deportivo.
              </p>
            </details>
          </div>
        </div>
      </div>
    )
  },
  'derechos-autor': {
    title: 'Derechos de Autor y Propiedad Intelectual',
    content: (
      <div className="space-y-6">
        <p>Todo el contenido presente en esta plataforma es propiedad de <strong>DETAIM</strong> y está protegido por las leyes de propiedad intelectual internacionales.</p>
        
        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">Marcas Registradas</h3>
        <p>La marca "DETAIM" y sus logotipos son propiedad exclusiva de la compañía.</p>
      </div>
    )
  }
}

export default function LegalPage() {
  const { tipo } = useParams<{ tipo: string }>()
  const navigate = useNavigate()
  const data = tipo ? LEGAL_CONTENT[tipo] : null

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tipo])

  if (!data) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-zinc-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black">Página no encontrada</h1>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 text-blue-600 hover:underline font-medium"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-white flex flex-col selection:bg-black selection:text-white">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/60 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/')}>
            <img src="/logo.jpg" alt="DETAIM" className="h-8 w-auto rounded-lg grayscale group-hover:grayscale-0 transition-all duration-500" />
            <span className="font-black text-xl text-black tracking-tighter uppercase">DETAIM</span>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-2 text-xs font-black text-zinc-500 hover:bg-zinc-200 hover:text-black transition-all"
          >
            Volver
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-8 py-20">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter mb-16 leading-tight">
            {data.title}
          </h1>
          <div className="prose prose-zinc prose-lg max-w-none text-zinc-600 font-medium leading-relaxed">
            {data.content}
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-100 bg-zinc-50 py-12">
        <div className="max-w-4xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            © 2026 DETAIM Global Precision
          </p>
          <div className="flex items-center gap-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            <Link to="/legal/terminos-condiciones" className="hover:text-black transition-colors">Términos</Link>
            <Link to="/legal/politica-privacidad" className="hover:text-black transition-colors">Privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
