import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getStoredIsSupremo, getStoredRole, loginPanel, setStoredIsSupremo } from './api/panel'

export default function PanelLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('detaim_token')
    const role = getStoredRole()
    const isSupremo = getStoredIsSupremo()
    if (t && (isSupremo || role)) {
      navigate(isSupremo ? '/panel/supremo' : role === 'admin' ? '/panel/admin' : '/panel/asesor', {
        replace: true,
      })
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await loginPanel(email.trim(), password)
      localStorage.setItem('detaim_token', res.token)
      localStorage.setItem('detaim_role', res.role)
      setStoredIsSupremo(res.isSupremo === true)
      navigate(res.isSupremo ? '/panel/supremo' : res.role === 'admin' ? '/panel/admin' : '/panel/asesor', {
        replace: true,
      })
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Error al iniciar sesión'
      setError(m)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-zinc-50 text-black">
      <div className="relative mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center animate-in">
          <img
            src="/logo.jpg"
            alt="DETAIM"
            className="mx-auto h-16 w-auto object-contain rounded-2xl mb-6"
          />
          <h1 className="flex items-center justify-center gap-2 text-3xl font-black tracking-tighter">
            <span>DETAIM</span>
            <span className="opacity-20">/</span>
            <span className="opacity-60 text-xl font-bold">Panel</span>
          </h1>
          <p className="mt-4 text-sm text-zinc-500 font-medium">
            Acceso exclusivo para el equipo de DETAIM.
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-zinc-200 bg-white/80 p-10 backdrop-blur-xl animate-in shadow-xl shadow-black/5" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
            <div>
              <label
                htmlFor="panel-email"
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-400"
              >
                Correo Electrónico
              </label>
              <input
                id="panel-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl bg-zinc-50 border border-zinc-200 px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black/5 transition"
                placeholder="admin@detaim.com"
              />
            </div>
            <div>
              <label
                htmlFor="panel-pass"
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-400"
              >
                Contraseña
              </label>
              <input
                id="panel-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl bg-zinc-50 border border-zinc-200 px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black/5 transition"
              />
            </div>
            {error && (
              <p className="rounded-2xl bg-red-500/5 border border-red-500/10 px-4 py-3 text-xs font-bold text-red-500">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-black py-4 text-sm font-bold text-white hover:bg-zinc-800 transition disabled:opacity-50 shadow-xl shadow-black/10"
            >
              {loading ? 'Iniciando...' : 'Entrar al Panel'}
            </button>
          </form>
        </div>

        <p className="mt-10 text-center">
          <Link
            to="/"
            className="text-sm font-bold text-zinc-400 hover:text-black transition flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7" /></svg>
            Volver al sitio público
          </Link>
        </p>
      </div>
    </div>
  )
}
