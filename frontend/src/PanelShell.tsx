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
    <div className="min-h-svh bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row sm:gap-3">
          <div className="flex w-full min-w-0 items-center justify-center gap-3 sm:w-auto sm:justify-start">
            <img
              src="/logo.jpg"
              alt="DETAIM"
              className="h-8 w-auto shrink-0 object-contain sm:h-9 rounded-lg"
              width={120}
              height={40}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[11px]">
                {variant === 'supremo'
                  ? 'Panel supremo'
                  : variant === 'admin'
                    ? 'Panel de administración'
                    : 'Panel de asesores'}
              </p>
              <p className="truncate text-sm font-semibold text-white sm:text-base">{empresaNombre}</p>
              <p className="text-[10px] text-zinc-500 sm:text-xs">
                Empresa ·{' '}
                <span className="font-medium text-zinc-400">{empresaTipo}</span>
              </p>
            </div>
          </div>
          <nav className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
            <Link
              to="/"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-zinc-800 sm:flex-none sm:text-sm"
            >
              Público
            </Link>
            <button
              type="button"
              onClick={handleSalir}
              className="flex-1 rounded-xl bg-white px-3 py-2 text-center text-xs font-semibold text-black hover:bg-zinc-200 sm:flex-none sm:text-sm"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
