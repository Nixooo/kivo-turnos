import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

const LEGAL_CONTENT: Record<string, { title: string; content: React.ReactNode }> = {
  'tratamiento-datos': {
    title: 'Tratamiento de Datos Personales (Habeas Data)',
    content: (
      <div className="space-y-4">
        <p>De acuerdo con la Ley 1581 de 2012 y demás normas concordantes, DETAIM y sus empresas aliadas informan que los datos personales recolectados a través de esta plataforma tienen como finalidad principal la gestión, asignación y seguimiento de los turnos de atención solicitados por el usuario.</p>
        <h3 className="text-lg font-semibold text-zinc-900">Finalidades del Tratamiento</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>Gestionar la reserva y confirmación del turno.</li>
          <li>Enviar notificaciones vía SMS o WhatsApp sobre el estado del turno.</li>
          <li>Validar la identidad del usuario al momento de la atención.</li>
          <li>Realizar encuestas de satisfacción sobre el servicio recibido.</li>
        </ul>
        <h3 className="text-lg font-semibold text-zinc-900">Derechos del Titular</h3>
        <p>Como titular de los datos, usted tiene derecho a conocer, actualizar, rectificar y suprimir su información personal, así como a revocar el consentimiento otorgado para su tratamiento. Para ejercer estos derechos, puede comunicarse al correo: <a href="mailto:soporte@detaim.com" className="text-kivo-600 hover:underline font-medium">soporte@detaim.com</a>.</p>
      </div>
    )
  },
  'terminos-condiciones': {
    title: 'Términos y Condiciones de Uso',
    content: (
      <div className="space-y-4">
        <p>Al utilizar el sistema de turnos de DETAIM, el usuario acepta los siguientes términos:</p>
        <ol className="list-decimal pl-5 space-y-3">
          <li><strong>Naturaleza del Servicio:</strong> El sistema es una herramienta de facilitación tecnológica. No garantiza atención inmediata si se presentan contingencias operativas en la sede física.</li>
          <li><strong>Responsabilidad del Usuario:</strong> El usuario se compromete a suministrar información veraz y a presentarse en la sede seleccionada dentro del horario establecido.</li>
          <li><strong>Check-In Obligatorio:</strong> Para activar el turno en la fila real, el usuario debe realizar el proceso de Check-In (vía GPS o escaneo de código QR) una vez se encuentre en las instalaciones de la sede.</li>
          <li><strong>Uso Correcto:</strong> El mal uso del sistema, como la creación de múltiples reservas falsas o repetitivas que no se hagan efectivas, podrá resultar en la suspensión temporal o definitiva del acceso al servicio para el documento de identidad asociado.</li>
        </ol>
      </div>
    )
  },
  'politica-privacidad': {
    title: 'Política de Privacidad',
    content: (
      <div className="space-y-4">
        <p>En DETAIM, la privacidad de su información es nuestra prioridad. Esta política describe cómo manejamos sus datos:</p>
        <h3 className="text-lg font-semibold text-zinc-900">Recolección de Información</h3>
        <p>Solo solicitamos la información mínima necesaria para la prestación del servicio: nombre, apellido, número de documento y teléfono celular.</p>
        <h3 className="text-lg font-semibold text-zinc-900">Compartición de Datos</h3>
        <p>Sus datos personales no son vendidos ni cedidos a terceros con fines comerciales. La información se comparte exclusivamente con la empresa prestadora del servicio (la sede seleccionada) para efectos de identificación y atención al cliente.</p>
        <h3 className="text-lg font-semibold text-zinc-900">Seguridad</h3>
        <p>Implementamos medidas técnicas y organizativas para proteger su información contra acceso no autorizado, pérdida o alteración.</p>
      </div>
    )
  },
  'manejo-cookies': {
    title: 'Política de Manejo de Cookies',
    content: (
      <div className="space-y-4">
        <p>Esta plataforma utiliza "cookies" y tecnologías similares para mejorar su experiencia de usuario.</p>
        <h3 className="text-lg font-semibold text-zinc-900">Tipos de Cookies que utilizamos</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Cookies Técnicas:</strong> Esenciales para el funcionamiento del sitio, como mantener la sesión activa y recordar el progreso en el proceso de solicitud del turno.</li>
          <li><strong>Cookies de Preferencias:</strong> Permiten recordar información como el último turno solicitado para facilitar su consulta rápida (LocalStorage).</li>
        </ul>
        <p>No utilizamos cookies de seguimiento publicitario ni compartimos información de su navegación con redes sociales o agencias de marketing.</p>
        <p>Usted puede configurar su navegador para bloquear estas cookies, pero algunas funciones del sitio podrían dejar de estar disponibles.</p>
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
    <div className="min-h-svh bg-zinc-50 flex flex-col">
      <header className="bg-white border-b border-zinc-200 py-6 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/kivo-logo.png" alt="KIVO" className="h-8 w-auto" />
            <span className="font-bold text-xl text-zinc-900">DETAIM</span>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 transition"
          >
            ← Volver
          </button>
        </div>
      </header>

      <main className="flex-1 py-12 px-6">
        <article className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-zinc-200 p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-zinc-900 mb-8 border-b border-zinc-100 pb-6">
            {data.title}
          </h1>
          <div className="prose prose-zinc max-w-none text-zinc-600 leading-relaxed">
            {data.content}
          </div>
          
          <div className="mt-12 pt-8 border-t border-zinc-100 text-sm text-zinc-400">
            Última actualización: Abril 2026
          </div>
        </article>
      </main>

      <footer className="py-8 text-center text-xs text-zinc-400">
        © 2026 DETAIM Colombia. Todos los derechos reservados.
      </footer>
    </div>
  )
}
