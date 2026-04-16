import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

const LEGAL_CONTENT: Record<string, { title: string; content: React.ReactNode }> = {
  'tratamiento-datos': {
    title: 'Política de Tratamiento de Datos Personales (Habeas Data)',
    content: (
      <div className="space-y-6">
        <p>De conformidad con la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas concordantes, <strong>DETAIM</strong> (en adelante, "La Compañía"), en su calidad de Responsable del Tratamiento de datos personales, informa a los usuarios sobre su política para la recolección, almacenamiento, uso, circulación y supresión de la información personal.</p>
        
        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">1. Finalidades del Tratamiento</h3>
        <p>Los datos personales proporcionados por los usuarios a través de nuestra plataforma de gestión de turnos serán tratados para las siguientes finalidades:</p>
        <ul className="list-disc pl-6 space-y-3">
          <li><strong>Gestión Operativa:</strong> Procesar, asignar y realizar seguimiento a las solicitudes de turnos de atención presencial o virtual.</li>
          <li><strong>Comunicación:</strong> Remitir notificaciones relacionadas con el estado del turno, cambios en la programación o avisos de proximidad de atención mediante SMS, correo electrónico o mensajería instantánea (WhatsApp).</li>
          <li><strong>Seguridad:</strong> Validar la identidad del titular al momento de presentarse en la sede física para evitar suplantaciones.</li>
          <li><strong>Mejora del Servicio:</strong> Realizar análisis estadísticos anónimos sobre el flujo de personas y tiempos de espera para optimizar la operación de las sedes aliadas.</li>
          <li><strong>Calidad:</strong> Contactar al usuario para evaluar su nivel de satisfacción con el servicio recibido mediante encuestas cortas.</li>
        </ul>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">2. Derechos de los Titulares</h3>
        <p>Como titular de sus datos personales, usted tiene los siguientes derechos establecidos por ley:</p>
        <ul className="list-disc pl-6 space-y-3">
          <li>Conocer, actualizar y rectificar sus datos personales frente a los Responsables o Encargados del Tratamiento.</li>
          <li>Solicitar prueba de la autorización otorgada, salvo cuando expresamente se exceptúe como requisito para el Tratamiento.</li>
          <li>Ser informado, previa solicitud, respecto del uso que se le ha dado a sus datos personales.</li>
          <li>Presentar ante la Superintendencia de Industria y Comercio quejas por infracciones a lo dispuesto en la ley.</li>
          <li>Revocar la autorización y/o solicitar la supresión del dato cuando en el Tratamiento no se respeten los principios, derechos y garantías constitucionales y legales.</li>
          <li>Acceder en forma gratuita a sus datos personales que hayan sido objeto de Tratamiento.</li>
        </ul>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">3. Canales de Atención</h3>
        <p>Para el ejercicio de sus derechos de consulta, reclamo o supresión, DETAIM ha dispuesto el siguiente canal oficial de comunicación:</p>
        <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
          <p className="font-medium text-zinc-900">Oficina de Privacidad y Datos</p>
          <p className="text-zinc-600">Correo electrónico: <a href="mailto:soporte@detaim.com" className="text-kivo-600 hover:underline">soporte@detaim.com</a></p>
          <p className="text-xs mt-2 text-zinc-400">Tiempo de respuesta: Hasta 15 días hábiles según lo estipulado por la Ley 1581.</p>
        </div>
      </div>
    )
  },
  'terminos-condiciones': {
    title: 'Términos y Condiciones de Uso del Sistema',
    content: (
      <div className="space-y-6">
        <p>El acceso y uso de la plataforma de turnos operada por <strong>DETAIM</strong> implica la aceptación plena y sin reservas de los presentes Términos y Condiciones por parte del usuario.</p>
        
        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">1. Objeto del Servicio</h3>
        <p>DETAIM proporciona una solución tecnológica de intermediación para la organización de filas y turnos. El usuario entiende que DETAIM no es el prestador directo del servicio final (médico, bancario, administrativo, etc.), sino el proveedor de la tecnología que facilita la espera.</p>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">2. Compromisos del Usuario</h3>
        <p>Al reservar un turno, el usuario se compromete a:</p>
        <ul className="list-disc pl-6 space-y-3">
          <li>Suministrar información veraz, completa y actualizada.</li>
          <li>Presentarse en la sede física con la antelación suficiente sugerida por el sistema (recomendado 10 min antes).</li>
          <li>Realizar el proceso de <strong>Check-In</strong> una vez esté en la sede.</li>
          <li>Hacer un uso responsable del equipo de simulación, siguiendo las instrucciones del staff. Cualquier daño por mal uso será responsabilidad del usuario.</li>
          <li>Hacer un uso responsable del sistema, evitando reservas ficticias o cancelaciones reiteradas sin justificación.</li>
        </ul>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">3. Uso de Equipos y Seguridad</h3>
        <p>Para garantizar una experiencia segura y óptima:</p>
        <ul className="list-disc pl-6 space-y-3">
          <li>El uso de simuladores de movimiento puede causar mareos o fatiga; el usuario acepta este riesgo al contratar el servicio.</li>
          <li>No se permite el ingreso con alimentos o bebidas a la zona de simuladores.</li>
          <li>Menores de edad deben estar acompañados por un adulto responsable.</li>
        </ul>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">4. Limitación de Responsabilidad</h3>
        <p>Aunque DETAIM se esfuerza por mantener la precisión en los tiempos estimados de espera, estos son cálculos aproximados basados en promedios históricos y flujo actual. DETAIM no se hace responsable por:</p>
        <ul className="list-disc pl-6 space-y-3">
          <li>Retrasos imprevistos causados por emergencias u operativos internos de la sede física.</li>
          <li>Fallas en la conexión a internet del dispositivo del usuario que impidan el Check-In.</li>
          <li>Pérdida del turno por no estar presente al momento del llamado físico o digital.</li>
        </ul>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">4. Propiedad Intelectual</h3>
        <p>Todos los derechos de propiedad intelectual sobre la interfaz, algoritmos, logotipos y software de la plataforma pertenecen exclusivamente a DETAIM Colombia.</p>
      </div>
    )
  },
  'politica-privacidad': {
    title: 'Política Global de Privacidad',
    content: (
      <div className="space-y-6">
        <p>En <strong>DETAIM</strong>, protegemos su privacidad como si fuera la nuestra. Esta política detalla cómo manejamos su información en el ecosistema de nuestra plataforma.</p>
        
        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">1. Qué información recolectamos</h3>
        <p>Para la correcta prestación del servicio de turnos, solicitamos:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Nombres y Apellidos.</li>
          <li>Número de documento de identidad (para validación en sede).</li>
          <li>Número de teléfono celular (para envío de avisos de turno).</li>
          <li>Ubicación geográfica aproximada (únicamente al momento del Check-In vía GPS).</li>
        </ul>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">2. Con quién compartimos sus datos</h3>
        <p>Su información es tratada bajo estrictos estándares de confidencialidad. <strong>Nunca</strong> vendemos sus datos a terceros. La información se comparte únicamente con:</p>
        <ul className="list-disc pl-6 space-y-3">
          <li><strong>Empresa Prestadora:</strong> La entidad (EPS, Banco, Notaría, etc.) en la cual usted solicitó el turno, con el fin de que puedan llamarlo a atención.</li>
          <li><strong>Proveedores de Infraestructura:</strong> Servicios de alojamiento web y envío de mensajes (SMS) que cumplen con certificaciones de seguridad internacional.</li>
        </ul>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">3. Retención de Datos</h3>
        <p>Los datos de los turnos se conservan por un periodo máximo necesario para cumplir con los análisis de calidad y auditoría de las empresas aliadas, tras lo cual son anonimizados para fines estadísticos.</p>
      </div>
    )
  },
  'manejo-cookies': {
    title: 'Política de Cookies y Almacenamiento Local',
    content: (
      <div className="space-y-6">
        <p>Nuestra plataforma utiliza tecnologías de almacenamiento para garantizar que el sistema de turnos funcione de manera fluida en su dispositivo.</p>
        
        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">1. Tipos de tecnologías utilizadas</h3>
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="font-bold text-kivo-700">Cookies Técnicas (Esenciales)</p>
            <p className="text-sm text-zinc-600">Permiten la navegación y el uso de las diferentes opciones o servicios que existen en la web, como controlar el tráfico y la comunicación de datos o identificar la sesión.</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="font-bold text-kivo-700">LocalStorage (Preferencias)</p>
            <p className="text-sm text-zinc-600">Utilizamos el almacenamiento local de su navegador para recordar el último turno solicitado. Esto permite que, si cierra la ventana por error, pueda recuperar su código seguro rápidamente sin tener que contactar a soporte.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">2. Ausencia de Rastreo Publicitario</h3>
        <p>En DETAIM valoramos su tiempo y su privacidad. Por ello:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>NO</strong> utilizamos cookies de seguimiento (tracking).</li>
          <li><strong>NO</strong> compartimos información con redes sociales para perfiles publicitarios.</li>
          <li><strong>NO</strong> permitimos que terceros inserten anuncios en nuestra plataforma.</li>
        </ul>

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">3. Cómo gestionar estas tecnologías</h3>
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
          <div className="bg-zinc-900 text-white p-6 rounded-3xl border border-zinc-800 shadow-xl">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sede Cajicá
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Lunes a Viernes</span>
                <span className="font-bold">09:00 AM - 08:00 PM</span>
              </li>
              <li className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Sábados</span>
                <span className="font-bold">10:00 AM - 06:00 PM</span>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-400">Domingos y Festivos</span>
                <span className="font-bold text-red-400">Cerrado</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
            <h4 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">Atención al Cliente</h3>
        <p>Para consultas sobre horarios especiales o eventos corporativos, por favor contáctanos:</p>
        <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-zinc-900">Línea de Atención</p>
            <p className="text-sm text-zinc-600">+57 (300) 123-4567</p>
          </div>
        </div>
      </div>
    )
  },
  'preguntas-frecuentes': {
    title: 'Preguntas Frecuentes (FAQ)',
    content: (
      <div className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-xl font-black text-zinc-900 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs">?</span>
            Sobre las Reservas
          </h3>
          <div className="grid gap-4">
            <details className="group bg-zinc-50 p-6 rounded-3xl border border-zinc-100 cursor-pointer">
              <summary className="font-bold text-zinc-900 list-none flex justify-between items-center">
                ¿Con cuánta anticipación debo reservar?
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-4 text-zinc-600 text-sm leading-relaxed">
                Recomendamos reservar con al menos 24 horas de antelación para asegurar tu cupo. El sistema permite reservas hasta con 2 horas de anticipación según disponibilidad.
              </p>
            </details>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-black text-zinc-900 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs">🎯</span>
            Simulador de Tiro
          </h3>
          <div className="grid gap-4">
            <details className="group bg-zinc-50 p-6 rounded-3xl border border-zinc-100 cursor-pointer">
              <summary className="font-bold text-zinc-900 list-none flex justify-between items-center">
                ¿Es seguro el simulador de tiro?
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-4 text-zinc-600 text-sm leading-relaxed">
                Totalmente. Utilizamos tecnología láser de alta precisión sin proyectiles reales. Es una experiencia 100% segura para todas las edades bajo supervisión.
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
        
        <h3 className="text-xl font-semibold text-zinc-900 border-l-4 border-kivo-500 pl-3">Marcas Registradas</h3>
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
          <h1 className="text-2xl font-bold text-zinc-900">Página no encontrada</h1>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 text-kivo-600 hover:underline font-medium"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-black flex flex-col selection:bg-white selection:text-black">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/')}>
            <img src="/logo.jpg" alt="DETAIM" className="h-8 w-auto rounded-lg grayscale group-hover:grayscale-0 transition-all duration-500" />
            <span className="font-black text-xl text-white tracking-tighter uppercase">DETAIM</span>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 hover:text-white transition-colors"
          >
            ← Volver
          </button>
        </div>
      </header>

      <main className="flex-1 py-20 px-8">
        <article className="max-w-3xl mx-auto">
          <header className="mb-16 space-y-4">
            <div className="h-1 w-12 bg-blue-600 rounded-full" />
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter leading-tight">
              {data.title}
            </h1>
          </header>
          
          <div className="prose prose-invert prose-zinc max-w-none text-zinc-400 leading-relaxed font-medium">
            {data.content}
          </div>
          
          <div className="mt-20 pt-10 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">
                Última revisión: Abril 2026
              </p>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-800">
              DETAIM Legal Framework
            </p>
          </div>
        </article>
      </main>

      <footer className="py-20 border-t border-white/5 bg-black">
        <div className="max-w-4xl mx-auto px-8 flex flex-col items-center gap-8">
          <div className="flex items-center gap-4 opacity-20 grayscale">
            <img src="/logo.jpg" alt="DETAIM" className="h-6 w-auto rounded" />
            <span className="font-black text-sm tracking-tighter text-white">DETAIM</span>
          </div>
          <p className="text-[9px] text-zinc-700 font-black uppercase tracking-[0.5em] text-center">
            © 2026 DETAIM GLOBAL · Cajicá, Colombia
          </p>
        </div>
      </footer>
    </div>
  )
}
