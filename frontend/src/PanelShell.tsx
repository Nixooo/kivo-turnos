import { type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logoutPanel } from './api/panel'

type Props = {
  variant: 'admin' | 'asesor' | 'supremo'
  empresaNombre: string
  empresaTipo: string
  children: ReactNode
}

export default function PanelShell({
  variant,
  empresaNombre,
  empresaTipo,
  children,
}: Props) {
  const navigate = useNavigate()

  const handleSalir = () => {
    logoutPanel()
    navigate('/panel', { replace: true })
  }

  return (
    <div className="min-h-svh bg-zinc-50 text-black">
      <header className="border-b border-zinc-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-8 py-5 sm:flex-row sm:gap-3">
          <div className="flex w-full min-w-0 items-center justify-center gap-5 sm:w-auto sm:justify-start">
            <img
              src="/logo.jpg"
              alt="DETAIM"
              className="h-10 w-auto shrink-0 object-contain sm:h-12 rounded-xl shadow-sm"
              width={120}
              height={40}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-red-600 sm:text-[12px]">
                {variant === 'supremo'
                  ? 'Panel supremo'
                  : variant === 'admin'
                    ? 'Administración'
                    : 'Asesores'}
              </p>
              <p className="truncate text-lg font-black text-black sm:text-xl tracking-tighter">{empresaNombre}</p>
              <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">
                Sector ·{' '}
                <span className="text-zinc-500">{empresaTipo}</span>
              </p>
            </div>
          </div>
          <nav className="flex w-full flex-wrap items-center justify-center gap-4 sm:w-auto sm:justify-end">
            <Link
              to="/"
              className="flex-1 rounded-2xl border border-zinc-100 bg-zinc-50 px-6 py-2.5 text-center text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:bg-white hover:text-black hover:border-zinc-200 transition-all sm:flex-none"
            >
              Ver Público
            </Link>
            <button
              type="button"
              onClick={handleSalir}
              className="flex-1 rounded-2xl bg-black px-6 py-2.5 text-center text-[11px] font-black uppercase tracking-widest text-white hover:bg-zinc-800 transition-all shadow-xl shadow-black/10 sm:flex-none"
            >
              Cerrar Sesión
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-8 py-10 sm:py-12">{children}</main>
    </div>
  )
}
