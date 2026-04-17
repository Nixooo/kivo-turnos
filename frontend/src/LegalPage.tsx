import { useParams, useNavigate, Link } from 'react-router-dom'
import { useEffect } from 'react'

const LEGAL_CONTENT: Record<string, { title: string; content: React.ReactNode }> = {
  'tratamiento-datos': {
    title: 'Política de Tratamiento de Datos Personales (Habeas Data)',
    content: (
      <div className="space-y-8">
        <p>De conformidad con la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas concordantes, <strong>DETAIM GLOBAL ALPHA</strong> (en adelante, "La Compañía"), en su calidad de Responsable del Tratamiento de datos personales, informa a los usuarios sobre su política para la recolección, almacenamiento, uso, circulación y supresión de la información personal.</p>
        
        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">1. Marco Legal y Alcance</h3>
          <p>Esta política se aplica a todos los datos personales registrados en nuestras bases de datos, ya sea a través de nuestra plataforma web, presencialmente en nuestras sedes o mediante canales digitales de atención. El tratamiento se rige por los principios de legalidad, finalidad, libertad, veracidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad.</p>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">2. Finalidades Específicas del Tratamiento</h3>
          <p>Los datos personales proporcionados por los tiradores y personal operativo serán tratados para las siguientes finalidades primordiales:</p>
          <ul className="grid gap-4 text-zinc-600">
            <li className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex gap-4">
              <span className="text-red-600 font-black">A.</span>
              <div>
                <strong className="text-black">Gestión Operativa de Reservas:</strong>
                <p className="text-sm mt-1">Administración de agendas, asignación de líneas de tiro y control de flujo de usuarios en el simulador ALPHA.</p>
              </div>
            </li>
            <li className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex gap-4">
              <span className="text-red-600 font-black">B.</span>
              <div>
                <strong className="text-black">Protocolos de Seguridad Táctica:</strong>
                <p className="text-sm mt-1">Verificación obligatoria de identidad para el uso de equipos láser profesionales y cumplimiento de normativas de seguridad interna.</p>
              </div>
            </li>
            <li className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex gap-4">
              <span className="text-red-600 font-black">C.</span>
              <div>
                <strong className="text-black">Análisis de Desempeño y Balística:</strong>
                <p className="text-sm mt-1">Seguimiento estadístico del progreso del tirador, precisión y tiempos de reacción para la mejora continua del entrenamiento.</p>
              </div>
            </li>
            <li className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex gap-4">
              <span className="text-red-600 font-black">D.</span>
              <div>
                <strong className="text-black">Comunicaciones de Emergencia:</strong>
                <p className="text-sm mt-1">Notificaciones inmediatas sobre cambios operativos, alertas técnicas o reprogramaciones urgentes.</p>
              </div>
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">3. Derechos de los Titulares</h3>
          <p>Usted, como titular de los datos, tiene los siguientes derechos inalienables:</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-600">
            <li>Acceder de forma gratuita a sus datos personales tratados.</li>
            <li>Solicitar la actualización y rectificación de sus datos frente a información parcial, inexacta o incompleta.</li>
            <li>Solicitar prueba de la autorización otorgada, salvo excepciones legales.</li>
            <li>Revocar la autorización y/o solicitar la supresión del dato cuando en el tratamiento no se respeten los principios, derechos y garantías constitucionales.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">4. Canales de Ejercicio de Derechos</h3>
          <p>Para ejercer sus derechos de Habeas Data, puede contactar a nuestro Oficial de Privacidad a través de:</p>
          <div className="bg-zinc-900 text-white p-6 rounded-3xl space-y-2">
            <p className="font-bold">Oficina de Protección de Datos:</p>
            <p className="text-zinc-400 text-sm">Correo: legal@detaim.com</p>
            <p className="text-zinc-400 text-sm">WhatsApp: +57 312 476 9501</p>
            <p className="text-zinc-400 text-sm">Dirección: C.E. B&E, Cajicá. Oficina 401.</p>
          </div>
        </section>
      </div>
    )
  },
  'terminos-condiciones': {
    title: 'Términos y Condiciones de Operación',
    content: (
      <div className="space-y-8">
        <p>El acceso y uso de la infraestructura de simulación <strong>DETAIM ALPHA</strong> conlleva la aceptación vinculante de este reglamento operativo.</p>
        
        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">1. Normas de Seguridad en el Polígono Digital</h3>
          <ul className="grid gap-4">
            <li className="bg-red-50 p-6 rounded-3xl border border-red-100">
              <h4 className="font-black text-red-600 mb-2 uppercase tracking-widest text-xs">Regla de Oro</h4>
              <p className="text-zinc-700 text-sm font-bold">Toda réplica de entrenamiento debe ser tratada como si fuera real en todo momento, independientemente de ser un sistema láser.</p>
            </li>
            <li className="text-zinc-600 space-y-2">
              <p>• Es obligatorio el uso de protección ocular si el instructor lo indica.</p>
              <p>• No se permite apuntar fuera de las zonas de impacto designadas.</p>
              <p>• El dedo debe permanecer fuera del disparador hasta que el objetivo esté alineado.</p>
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">2. Requisitos de Acceso</h3>
          <p>Para participar en las sesiones de entrenamiento ALPHA, el usuario debe:</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-600">
            <li>Ser mayor de edad (18+) o contar con autorización firmada y presencia de un tutor legal.</li>
            <li>Presentar documento de identidad original para el check-in.</li>
            <li>Completar el briefing de seguridad inicial de 5 minutos.</li>
            <li>No presentar signos de intoxicación por alcohol o sustancias psicoactivas.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">3. Propiedad y Responsabilidad del Equipo</h3>
          <p>El usuario es responsable del manejo cuidadoso de los simuladores, sensores y dispositivos hapticos. El daño intencional o por negligencia manifiesta del equipo resultará en el cobro de la reparación o reposición del mismo.</p>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">4. Política de Sesiones</h3>
          <ul className="space-y-3 text-zinc-600">
            <li><strong>Puntualidad:</strong> Si el tirador llega más de 10 minutos tarde, el tiempo se descontará de su sesión para no afectar la agenda.</li>
            <li><strong>Cancelaciones:</strong> Deben realizarse con 4 horas de anticipación para ser reprogramadas sin costo.</li>
            <li><strong>No-Show:</strong> La inasistencia sin aviso previo conlleva la pérdida del valor de la reserva.</li>
          </ul>
        </section>
      </div>
    )
  },
  'politica-privacidad': {
    title: 'Política de Privacidad y Seguridad Digital',
    content: (
      <div className="space-y-8">
        <p>En <strong>DETAIM ALPHA</strong>, la privacidad de su entrenamiento y sus datos es una prioridad táctica. Implementamos protocolos de seguridad de grado militar para proteger su información.</p>
        
        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">1. Recolección de Datos de Entrenamiento</h3>
          <p>Además de sus datos básicos, nuestro sistema captura datos técnicos de su sesión:</p>
          <ul className="grid gap-4 sm:grid-cols-2">
            <li className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
              <strong className="block text-black text-sm mb-1 uppercase">Métricas de Tiro</strong>
              <p className="text-[11px] text-zinc-500">Precisión, agrupación, tiempos de reacción y control de retroceso.</p>
            </li>
            <li className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
              <strong className="block text-black text-sm mb-1 uppercase">Multimedia</strong>
              <p className="text-[11px] text-zinc-500">Grabaciones de video de los escenarios para análisis post-acción (AAR).</p>
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">2. Seguridad y Cifrado</h3>
          <p>Toda la información es transmitida mediante protocolos <strong>SSL/TLS de 256 bits</strong>. Los registros de entrenamiento se almacenan en servidores locales y en la nube con acceso restringido mediante autenticación de dos factores (2FA).</p>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black text-black border-l-4 border-red-600 pl-4 uppercase tracking-tighter">3. Uso de la Información</h3>
          <p>Sus datos de desempeño se utilizan exclusivamente para:</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-600">
            <li>Generar reportes de progreso personalizados.</li>
            <li>Nivelar la dificultad de los escenarios de simulación.</li>
            <li>Validar el cumplimiento de estándares de seguridad en el polígono.</li>
          </ul>
          <p className="mt-4 font-bold text-black italic">DETAIM no comparte ni comercializa perfiles de tiradores con terceras partes bajo ninguna circunstancia.</p>
        </section>
      </div>
    )
  },
  'manejo-cookies': {
    title: 'Política de Cookies y Almacenamiento Local',
    content: (
      <div className="space-y-6">
        <p>Nuestra plataforma utiliza tecnologías de almacenamiento para garantizar que el sistema de reservas ALPHA funcione de manera fluida.</p>
        
        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">1. Cookies Técnicas</h3>
        <p className="text-sm text-zinc-600">Permiten la navegación segura y el mantenimiento de la sesión activa del usuario durante el proceso de reserva.</p>

        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">2. LocalStorage</h3>
        <p className="text-sm text-zinc-600">Utilizamos el almacenamiento local para recordar sus preferencias de visualización y agilizar el ingreso de datos en futuras reservas.</p>
      </div>
    )
  },
  'horario-atencion': {
    title: 'Horarios de Atención y Disponibilidad',
    content: (
      <div className="space-y-6">
        <p>En <strong>DETAIM ALPHA</strong>, operamos bajo un esquema de disponibilidad total para garantizar tu entrenamiento:</p>
        
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
                <span className="text-zinc-500">Lunes a Domingo</span>
                <span className="font-bold">09:00 AM - 08:00 PM</span>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-500">Festivos</span>
                <span className="font-bold text-red-600">09:00 AM - 08:00 PM</span>
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
              <li>• Disponibilidad total de lunes a domingo incluyendo días festivos.</li>
              <li>• Reservas con mínimo 2 horas de antelación sugeridas.</li>
              <li>• Briefing de seguridad obligatorio antes de cada sesión.</li>
            </ul>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-black border-l-4 border-blue-600 pl-3">Atención al Cliente</h3>
        <p>Para soporte inmediato, consultas sobre membresías o eventos corporativos:</p>
        <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-black">Línea de Atención Directa</p>
            <p className="text-sm text-zinc-600">+57 312 476 9501</p>
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
