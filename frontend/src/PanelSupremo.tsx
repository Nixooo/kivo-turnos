import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import PanelShell from './PanelShell'
import {
  actualizarEmpresaSupremo,
  actualizarSedeSupremo,
  actualizarStaffSupremo,
  crearEmpresaSupremo,
  crearSedeSupremo,
  crearStaffSupremo,
  eliminarEmpresaSupremo,
  eliminarSedeSupremo,
  eliminarStaffSupremo,
  fetchEmpresasSupremo,
  fetchSedesSupremo,
  fetchStaffSupremo,
  fetchTurnosSupremo,
  getStoredIsSupremo,
  eliminarTurnoSupremo,
  logoutPanel,
  type EmpresaGlobal,
  type SedeGlobal,
  type StaffGlobal,
  type TurnoSupremo,
} from './api/panel'

type Tab = 'empresas' | 'sedes' | 'usuarios' | 'turnos'

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white'
          : 'rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50'
      }
    >
      {label}
    </button>
  )
}

export default function PanelSupremo() {
  const navigate = useNavigate()
  const [authOk, setAuthOk] = useState(false)
  const [tab, setTab] = useState<Tab>('empresas')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [empresas, setEmpresas] = useState<EmpresaGlobal[]>([])
  const [sedes, setSedes] = useState<SedeGlobal[]>([])
  const [staff, setStaff] = useState<StaffGlobal[]>([])
  const [turnos, setTurnos] = useState<TurnoSupremo[]>([])

  const [empresaFiltroId, setEmpresaFiltroId] = useState<number | ''>('')
  const [editingEmpresa, setEditingEmpresa] = useState<EmpresaGlobal | null>(null)
  const [showCreateEmpresaModal, setShowCreateEmpresaModal] = useState(false)

  const [newEmpresaForm, setNewEmpresaForm] = useState({
    slug: '',
    nombre: '',
    tipo: 'general',
    logo_url: '',
    color_hex: '#000000'
  })

  const empresaNombre = useMemo(() => 'KIVO Supremo', [])
  const empresaTipo = useMemo(() => 'control total', [])

  useEffect(() => {
    if (!localStorage.getItem('kivo_token')) {
      logoutPanel()
      navigate('/panel', { replace: true })
      return
    }
    if (!getStoredIsSupremo()) {
      navigate('/panel/admin', { replace: true })
      return
    }
    setAuthOk(true)
  }, [navigate])

  const cargarEmpresas = useCallback(async () => {
    const list = await fetchEmpresasSupremo()
    setEmpresas(list)
  }, [])

  const cargarSedes = useCallback(async () => {
    const id = empresaFiltroId === '' ? undefined : Number(empresaFiltroId)
    const list = await fetchSedesSupremo(id)
    setSedes(list)
  }, [empresaFiltroId])

  const cargarStaff = useCallback(async () => {
    const id = empresaFiltroId === '' ? undefined : Number(empresaFiltroId)
    const list = await fetchStaffSupremo(id)
    setStaff(list)
  }, [empresaFiltroId])

  const cargarTurnos = useCallback(async () => {
    const id = empresaFiltroId === '' ? undefined : Number(empresaFiltroId)
    const list = await fetchTurnosSupremo(id)
    setTurnos(list)
  }, [empresaFiltroId])

  const cargarTodo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await cargarEmpresas()
      await Promise.all([cargarSedes(), cargarStaff(), cargarTurnos()])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar'
      if (msg === 'Sesión expirada') {
        navigate('/panel', { replace: true })
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [cargarEmpresas, cargarSedes, cargarStaff, cargarTurnos, navigate])

  useEffect(() => {
    if (!authOk) return
    void cargarTodo()
  }, [authOk, cargarTodo])

  const empresaFiltroLabel = useMemo(() => {
    if (empresaFiltroId === '') return 'Todas'
    const e = empresas.find((x) => x.id === Number(empresaFiltroId))
    return e ? `${e.nombre} (${e.slug})` : 'Empresa'
  }, [empresaFiltroId, empresas])

  const onCrearEmpresa = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const { slug, nombre, tipo, logo_url, color_hex } = newEmpresaForm
    
    if (!slug || !nombre || !['eps', 'banco', 'general', 'clinica', 'notaria', 'gimnasio'].includes(tipo)) {
      setError('Completá slug, nombre y tipo')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await crearEmpresaSupremo({ 
        slug, 
        nombre, 
        tipo: tipo as any, 
        logo_url, 
        color_hex 
      })
      setNewEmpresaForm({
        slug: '',
        nombre: '',
        tipo: 'general',
        logo_url: '',
        color_hex: '#000000'
      })
      setShowCreateEmpresaModal(false)
      await cargarEmpresas()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onEliminarEmpresa = async (id: number) => {
    if (!confirm('¿Eliminar esta empresa? También se eliminarán sus sedes y usuarios.')) return
    setLoading(true)
    setError(null)
    try {
      await eliminarEmpresaSupremo(id)
      if (empresaFiltroId !== '' && Number(empresaFiltroId) === id) setEmpresaFiltroId('')
      await cargarTodo()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onGuardarEdicionEmpresa = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    if (!editingEmpresa) return
    
    setLoading(true)
    setError(null)
    try {
      await actualizarEmpresaSupremo(editingEmpresa.id, {
        nombre: editingEmpresa.nombre.trim(),
        slug: editingEmpresa.slug.trim(),
        tipo: editingEmpresa.tipo as any,
        logo_url: editingEmpresa.logo_url?.trim() || '',
        color_hex: editingEmpresa.color_hex?.trim() || '#000000',
      })
      setEditingEmpresa(null)
      await cargarEmpresas()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onCrearSede = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const empresaId = Number(fd.get('empresaId'))
    const slug = String(fd.get('slug') || '').trim()
    const nombre = String(fd.get('nombre') || '').trim()
    const direccion = String(fd.get('direccion') || '').trim()
    const horaApertura = String(fd.get('horaApertura') || '').trim()
    const horaCierre = String(fd.get('horaCierre') || '').trim()
    const lat = Number(fd.get('lat'))
    const lng = Number(fd.get('lng'))
    const tipo = fd.get('tipo')
    if (
      !Number.isFinite(empresaId) ||
      !slug ||
      !nombre ||
      !direccion ||
      !horaApertura ||
      !horaCierre ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      (tipo !== 'general' && tipo !== 'eps' && tipo !== 'banco')
    ) {
      setError('Completá todos los campos obligatorios de la sede')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await crearSedeSupremo({
        empresaId,
        slug,
        nombre,
        direccion,
        horaApertura,
        horaCierre,
        lat,
        lng,
        tipo,
      })
      await cargarSedes()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onEliminarSede = async (s: SedeGlobal) => {
    const id = s.dbId
    if (!id) {
      setError('Esta sede no tiene dbId para eliminar. Recargá la página.')
      return
    }
    if (!confirm(`¿Eliminar la sede "${s.nombre}"? Se eliminarán sus turnos.`)) return
    setLoading(true)
    setError(null)
    try {
      await eliminarSedeSupremo(id)
      await cargarSedes()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onEditarSede = async (s: SedeGlobal) => {
    const id = s.dbId
    if (!id) {
      setError('Esta sede no tiene dbId para editar. Recargá la página.')
      return
    }
    const nombre = prompt('Nombre', s.nombre)
    if (nombre == null) return
    const slug = prompt('Slug', s.slug)
    if (slug == null) return
    const direccion = prompt('Dirección', s.direccion)
    if (direccion == null) return
    const horaApertura = prompt('Hora apertura (HH:MM)', String(s.horaApertura || ''))
    if (horaApertura == null) return
    const horaCierre = prompt('Hora cierre (HH:MM)', String(s.horaCierre || ''))
    if (horaCierre == null) return
    const latStr = prompt('Lat', String(s.lat))
    if (latStr == null) return
    const lngStr = prompt('Lng', String(s.lng))
    if (lngStr == null) return
    const tipo = prompt('Tipo (general|eps|banco)', s.tipo)
    if (tipo == null) return
    const empIdStr = prompt('Empresa ID', String(s.empresaId || ''))
    if (empIdStr == null) return

    const lat = Number(latStr)
    const lng = Number(lngStr)
    const empresaId = Number(empIdStr)
    const t = tipo.trim()
    if (
      !nombre.trim() ||
      !slug.trim() ||
      !direccion.trim() ||
      !horaApertura.trim() ||
      !horaCierre.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(empresaId) ||
      (t !== 'general' && t !== 'eps' && t !== 'banco')
    ) {
      setError('Datos inválidos')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await actualizarSedeSupremo(id, {
        empresaId,
        slug: slug.trim(),
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        horaApertura: horaApertura.trim(),
        horaCierre: horaCierre.trim(),
        lat,
        lng,
        tipo: t,
      })
      await cargarSedes()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onCrearUsuario = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const email = String(fd.get('email') || '').toLowerCase().trim()
    const password = String(fd.get('password') || '')
    const role = fd.get('role')
    const empresaId = Number(fd.get('empresaId'))
    if (
      !email ||
      !password ||
      !Number.isFinite(empresaId) ||
      (role !== 'admin' && role !== 'asesor')
    ) {
      setError('Completá correo, contraseña, rol y empresa')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await crearStaffSupremo({ email, password, role, empresaId })
      await cargarStaff()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onEliminarUsuario = async (u: StaffGlobal) => {
    if (u.isSupremo) {
      setError('El usuario supremo está protegido')
      return
    }
    if (!confirm(`¿Eliminar el usuario "${u.email}"?`)) return
    setLoading(true)
    setError(null)
    try {
      await eliminarStaffSupremo(u.id)
      await cargarStaff()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onEditarUsuario = async (u: StaffGlobal) => {
    if (u.isSupremo) {
      setError('El usuario supremo está protegido')
      return
    }
    const email = prompt('Correo', u.email)
    if (email == null) return
    const role = prompt('Rol (admin|asesor)', u.role)
    if (role == null) return
    const empIdStr = prompt('Empresa ID', String(u.empresaId))
    if (empIdStr == null) return
    const pass = prompt('Nueva contraseña (dejá vacío para no cambiar)', '')
    if (pass == null) return

    const r = role.trim()
    const empresaId = Number(empIdStr)
    if (!email.trim() || (r !== 'admin' && r !== 'asesor') || !Number.isFinite(empresaId)) {
      setError('Datos inválidos')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await actualizarStaffSupremo(u.id, {
        email: email.trim(),
        role: r,
        empresaId,
        ...(pass.trim().length ? { password: pass } : {}),
      })
      await cargarStaff()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const onEliminarTurno = async (t: TurnoSupremo) => {
    if (!confirm(`¿Eliminar el turno ${t.numeroPublico}?`)) return
    setLoading(true)
    setError(null)
    try {
      await eliminarTurnoSupremo(t.id)
      await cargarTurnos()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const cs = (carga: string) => {
    switch (carga) {
      case 'alta': return { badge: 'bg-amber-100 text-amber-900', label: 'Muy ocupada' }
      case 'media': return { badge: 'bg-sky-100 text-sky-900', label: 'Moderada' }
      default: return { badge: 'bg-emerald-100 text-emerald-800', label: 'Con cupo' }
    }
  }

  const BrandingPreview = ({ logo, color, nombre }: { logo?: string, color?: string, nombre?: string }) => (
    <div className="mt-4 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Previsualización del cliente</p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <header className="border-b border-zinc-100 px-4 py-3 flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="Logo" className="h-8 w-auto object-contain" />
          ) : (
            <div className="h-8 w-8 rounded bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-400">Logo</div>
          )}
          <span className="font-semibold text-zinc-900 text-sm">{nombre || 'Nombre Empresa'}</span>
        </header>
        <div className="p-4 bg-gradient-to-br from-zinc-50 to-white">
          <div className="mx-auto max-w-xs space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Carga en vivo</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cs('baja').badge}`}>
                  {cs('baja').label}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-600">
                Hay <span className="font-bold">0 personas</span> delante tuyo.
              </p>
              <button 
                type="button"
                style={{ backgroundColor: color || '#000000' }}
                className="mt-4 w-full rounded-xl py-2 text-[10px] font-bold text-white shadow-sm"
              >
                Continuar con esta empresa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const Modal = ({
    open,
    onClose,
    title,
    children,
  }: {
    open: boolean
    onClose: () => void
    title: string
    children: ReactNode
  }) => {
    if (!open) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    )
  }

  if (!authOk) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50 text-zinc-500">
        Verificando acceso…
      </div>
    )
  }

  return (
    <PanelShell variant="supremo" empresaNombre={empresaNombre} empresaTipo={empresaTipo}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Control total</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Empresas, sedes, administradores/asesores y operaciones globales.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
              <span className="font-semibold">Filtro:</span> {empresaFiltroLabel}
            </div>
            <select
              value={empresaFiltroId}
              onChange={(e) => setEmpresaFiltroId(e.target.value ? Number(e.target.value) : '')}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              <option value="">Todas las empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} ({e.slug})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void cargarTodo()}
              className="rounded-xl border border-kivo-600 bg-kivo-50 px-4 py-2 text-sm font-semibold text-kivo-900 hover:bg-kivo-100 disabled:opacity-60"
              disabled={loading}
            >
              Actualizar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <TabButton
            active={tab === 'empresas'}
            label="Empresas"
            onClick={() => setTab('empresas')}
          />
          <TabButton
            active={tab === 'sedes'}
            label="Sedes"
            onClick={() => setTab('sedes')}
          />
          <TabButton
            active={tab === 'usuarios'}
            label="Usuarios"
            onClick={() => setTab('usuarios')}
          />
          <TabButton
            active={tab === 'turnos'}
            label="Turnos"
            onClick={() => setTab('turnos')}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        {tab === 'empresas' && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-zinc-900">Listado de Empresas</h2>
              <button
                type="button"
                onClick={() => setShowCreateEmpresaModal(true)}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Crear Empresa
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-900 min-w-[600px]">
                  <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Logo</th>
                      <th className="px-4 py-3">Nombre / Slug</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Color</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {empresas.map((e) => (
                      <tr key={e.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 text-zinc-500">{e.id}</td>
                        <td className="px-4 py-3">
                          {e.logo_url ? (
                            <img src={e.logo_url} alt={e.nombre} className="h-8 w-8 object-contain" />
                          ) : (
                            <span className="text-xs text-zinc-400">Sin logo</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{e.nombre}</div>
                          <div className="text-xs text-zinc-500">{e.slug}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            {e.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 w-4 rounded-full border border-zinc-200"
                              style={{ backgroundColor: e.color_hex || '#000000' }}
                            />
                            <span className="text-xs font-mono">{e.color_hex || '#000000'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingEmpresa(e)}
                              className="text-zinc-600 hover:underline"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void onEliminarEmpresa(e.id)}
                              className="text-rose-600 hover:underline"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {empresas.length === 0 && (
                <div className="py-12 text-center text-sm text-zinc-500">No hay empresas.</div>
              )}
            </div>
          </section>
        )}

        <Modal 
          open={showCreateEmpresaModal} 
          onClose={() => setShowCreateEmpresaModal(false)} 
          title="Crear Nueva Empresa"
        >
          <form
            onSubmit={(e) => void onCrearEmpresa(e)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Slug</label>
                <input
                  value={newEmpresaForm.slug}
                  onChange={e => setNewEmpresaForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="slug (ej: mi-empresa)"
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Nombre</label>
                <input
                  value={newEmpresaForm.nombre}
                  onChange={e => setNewEmpresaForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Nombre de la empresa"
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Tipo</label>
                <select
                  value={newEmpresaForm.tipo}
                  onChange={e => setNewEmpresaForm(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
                >
                  <option value="general">General</option>
                  <option value="eps">EPS</option>
                  <option value="banco">Banco</option>
                  <option value="clinica">Clínica</option>
                  <option value="notaria">Notaría</option>
                  <option value="gimnasio">Gimnasio</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Color HEX</label>
                <input
                  value={newEmpresaForm.color_hex}
                  onChange={e => setNewEmpresaForm(p => ({ ...p, color_hex: e.target.value }))}
                  placeholder="#000000"
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Logo URL (PNG)</label>
                <input
                  value={newEmpresaForm.logo_url}
                  onChange={e => setNewEmpresaForm(p => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                />
              </div>
            </div>
            
            <BrandingPreview 
              logo={newEmpresaForm.logo_url} 
              color={newEmpresaForm.color_hex} 
              nombre={newEmpresaForm.nombre} 
            />

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreateEmpresaModal(false)}
                className="flex-1 rounded-2xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                disabled={loading}
              >
                Crear empresa
              </button>
            </div>
          </form>
        </Modal>

        <Modal 
          open={!!editingEmpresa} 
          onClose={() => setEditingEmpresa(null)} 
          title="Editar Empresa"
        >
          {editingEmpresa && (
            <form onSubmit={(e) => void onGuardarEdicionEmpresa(e)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Slug</label>
                  <input
                    value={editingEmpresa.slug}
                    onChange={e => setEditingEmpresa(p => p ? ({ ...p, slug: e.target.value }) : null)}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Nombre</label>
                  <input
                    value={editingEmpresa.nombre}
                    onChange={e => setEditingEmpresa(p => p ? ({ ...p, nombre: e.target.value }) : null)}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Tipo</label>
                  <select
                    value={editingEmpresa.tipo}
                    onChange={e => setEditingEmpresa(p => p ? ({ ...p, tipo: e.target.value }) : null)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
                  >
                    <option value="general">General</option>
                    <option value="eps">EPS</option>
                    <option value="banco">Banco</option>
                    <option value="clinica">Clínica</option>
                    <option value="notaria">Notaría</option>
                    <option value="gimnasio">Gimnasio</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Color HEX</label>
                  <input
                    value={editingEmpresa.color_hex || ''}
                    onChange={e => setEditingEmpresa(p => p ? ({ ...p, color_hex: e.target.value }) : null)}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-zinc-500 uppercase">Logo URL</label>
                  <input
                    value={editingEmpresa.logo_url || ''}
                    onChange={e => setEditingEmpresa(p => p ? ({ ...p, logo_url: e.target.value }) : null)}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
                  />
                </div>
              </div>

              <BrandingPreview 
                logo={editingEmpresa.logo_url} 
                color={editingEmpresa.color_hex} 
                nombre={editingEmpresa.nombre} 
              />

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingEmpresa(null)}
                  className="flex-1 rounded-2xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-2xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          )}
        </Modal>

        {tab === 'sedes' && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Sedes</h2>
            <form onSubmit={(e) => void onCrearSede(e)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <select
                name="empresaId"
                defaultValue={empresaFiltroId === '' ? '' : String(empresaFiltroId)}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
              >
                <option value="" disabled>
                  Empresa (obligatorio)
                </option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre} ({e.slug})
                  </option>
                ))}
              </select>
              <input
                name="slug"
                placeholder="slug (ej: sede-centro)"
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
              />
              <input
                name="nombre"
                placeholder="Nombre"
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
              />
              <input
                name="direccion"
                placeholder="Dirección"
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 md:col-span-2"
              />
              <select
                name="tipo"
                defaultValue="general"
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
              >
                <option value="general">General</option>
                <option value="eps">EPS</option>
                <option value="banco">Banco</option>
              </select>
              <input
                name="horaApertura"
                placeholder="Hora apertura (HH:MM)"
                defaultValue="08:00"
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
              />
              <input
                name="horaCierre"
                placeholder="Hora cierre (HH:MM)"
                defaultValue="17:00"
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
              />
              <input
                name="lat"
                placeholder="Lat"
                defaultValue="4.65"
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
              />
              <input
                name="lng"
                placeholder="Lng"
                defaultValue="-74.06"
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
              />
              <button
                type="submit"
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 md:col-span-3"
                disabled={loading}
              >
                Crear sede
              </button>
            </form>
            <ul className="mt-6 divide-y divide-zinc-100">
              {sedes.map((s) => (
                <li key={s.slug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900">
                      {s.nombre}{' '}
                      <span className="text-xs font-semibold text-zinc-500">({s.slug})</span>
                    </p>
                    <p className="text-xs text-zinc-600">
                      Tipo: {s.tipo} · Empresa ID: {s.empresaId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onEditarSede(s)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                      disabled={loading}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void onEliminarSede(s)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                      disabled={loading}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
              {sedes.length === 0 && (
                <li className="py-6 text-center text-sm text-zinc-500">No hay sedes.</li>
              )}
            </ul>
          </section>
        )}

        {tab === 'usuarios' && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Usuarios (admins/asesores)</h2>
            <form onSubmit={(e) => void onCrearUsuario(e)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <select
                name="empresaId"
                defaultValue={empresaFiltroId === '' ? '' : String(empresaFiltroId)}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
              >
                <option value="" disabled>
                  Empresa (obligatorio)
                </option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre} ({e.slug})
                  </option>
                ))}
              </select>
              <input
                name="email"
                placeholder="correo@empresa.com"
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
              />
              <input
                name="password"
                placeholder="Contraseña"
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
              />
              <select
                name="role"
                defaultValue="asesor"
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
              >
                <option value="asesor">Asesor</option>
                <option value="admin">Administrador</option>
              </select>
              <button
                type="submit"
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 md:col-span-4"
                disabled={loading}
              >
                Crear usuario
              </button>
            </form>
            <ul className="mt-6 divide-y divide-zinc-100">
              {staff.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900">{u.email}</p>
                    <p className="text-xs text-zinc-600">
                      Rol: {u.role} · Empresa ID: {u.empresaId}
                      {u.isSupremo ? ' · SUPREMO' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onEditarUsuario(u)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                      disabled={loading}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void onEliminarUsuario(u)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                      disabled={loading}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
              {staff.length === 0 && (
                <li className="py-6 text-center text-sm text-zinc-500">No hay usuarios.</li>
              )}
            </ul>
          </section>
        )}

        {tab === 'turnos' && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Turnos</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Incluye turnos actuales y vencidos (últimos 500 por filtro).
            </p>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Actuales
                </h3>
                <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                  {turnos
                    .filter((t) => !t.vencido)
                    .map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-zinc-900">
                            {t.numeroPublico} · {t.estado}
                          </p>
                          <p className="text-xs text-zinc-600">
                            {t.fechaTurno} {String(t.horaTurno).slice(0, 5)} · {t.empresa.nombre} ·{' '}
                            {t.sede.nombre}
                          </p>
                          <p className="text-xs text-zinc-600">
                            {t.nombre} {t.apellido} · {t.documento}
                          </p>
                          {t.respuestasExtra && (
                            <p className="text-xs text-zinc-600">
                              Respuestas:{' '}
                              {Object.entries(t.respuestasExtra)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void onEliminarTurno(t)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                          disabled={loading}
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  {turnos.filter((t) => !t.vencido).length === 0 && (
                    <li className="p-5 text-center text-sm text-zinc-500">No hay turnos actuales.</li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Vencidos
                </h3>
                <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                  {turnos
                    .filter((t) => t.vencido)
                    .map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-zinc-900">
                            {t.numeroPublico} · {t.estado}
                          </p>
                          <p className="text-xs text-zinc-600">
                            {t.fechaTurno} {String(t.horaTurno).slice(0, 5)} · {t.empresa.nombre} ·{' '}
                            {t.sede.nombre}
                          </p>
                          <p className="text-xs text-zinc-600">
                            {t.nombre} {t.apellido} · {t.documento}
                          </p>
                          {t.respuestasExtra && (
                            <p className="text-xs text-zinc-600">
                              Respuestas:{' '}
                              {Object.entries(t.respuestasExtra)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void onEliminarTurno(t)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                          disabled={loading}
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  {turnos.filter((t) => t.vencido).length === 0 && (
                    <li className="p-5 text-center text-sm text-zinc-500">No hay turnos vencidos.</li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        )}
      </div>
    </PanelShell>
  )
}
