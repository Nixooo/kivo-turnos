import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getStoredIsSupremo, getStoredRole, loginPanel, logoutPanel, setStoredIsSupremo } from './api/panel'

export default function PanelLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('kivo_token')
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
      localStorage.setItem('kivo_token', res.token)
      localStorage.setItem('kivo_role', res.role)
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
    <div className="relative min-h-svh overflow-hidden bg-gradient-to-br from-kivo-50 via-white to-zinc-100">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-kivo-500/15 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <img
            src="/kivo-logo.png"
            alt="KIVO"
            className="mx-auto h-12 w-auto object-contain"
            width={160}
            height={48}
          />
          <h1 className="mt-4 flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900">
            <span className="opacity-60">KIVO</span>
            <span className="opacity-60">·</span>
            <span>Panel interno</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Administradores y asesores de tu empresa. Los datos están aislados
            por organización.
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-8 shadow-xl shadow-zinc-200/50">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label
                htmlFor="panel-email"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Correo institucional
              </label>
              <input
                id="panel-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
                placeholder="admin@kivo.com"
              />
            </div>
            <div>
              <label
                htmlFor="panel-pass"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Contraseña
              </label>
              <input
                id="panel-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none focus:border-kivo-500 focus:ring-2 focus:ring-kivo-500/20"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-kivo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-kivo-600/25 hover:bg-kivo-700 disabled:opacity-60"
            >
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-zinc-500">
            Demo EPS: <span className="font-mono">admin@kivo.com</span> /{' '}
            <span className="font-mono">12345</span> ·{' '}
            <span className="font-mono">asesor@kivo.com</span> /{' '}
            <span className="font-mono">12345</span>
          </p>
        </div>

        <p className="mt-8 text-center text-sm">
          <Link
            to="/"
            className="font-semibold text-kivo-800 hover:text-kivo-900 hover:underline"
          >
            ← Volver al sitio público
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-zinc-400">
          ¿Otra cuenta?{' '}
          <button
            type="button"
            onClick={() => {
              logoutPanel()
              setEmail('')
              setPassword('')
              setError(null)
            }}
            className="font-medium text-zinc-600 underline hover:text-zinc-800"
          >
            Borrar sesión guardada
          </button>
        </p>
      </div>
    </div>
  )
}
