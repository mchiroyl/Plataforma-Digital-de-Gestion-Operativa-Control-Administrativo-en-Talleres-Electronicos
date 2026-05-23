import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Activity,
  Boxes,
  CreditCard,
  FileText,
  LogOut,
  MessageCircle,
  MonitorSmartphone,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  X,
  UserRound,
  Wrench,
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:3000/api`
const PUBLIC_FRONTEND_URL = import.meta.env.VITE_PUBLIC_FRONTEND_URL ?? location.origin

type Session = {
  accessToken: string
  user: { id: number; username: string; fullName: string; role: string }
}

type Client = { id: number; firstName: string; lastName: string; phone: string; dpi?: string; nit?: string }
type EquipmentType = { id: number; name: string }
type Equipment = { id: number; clientId: number; equipmentTypeId?: number; brand: string; model: string; serialNumber?: string; color?: string; physicalDescription?: string; accessories?: string; equipmentType: EquipmentType; client?: Client }
type FaultType = { id: number; name: string; requiresCredential: boolean; category: { name: string }; equipmentType?: EquipmentType }
type Technician = { id: number; code: string; firstName: string; lastName: string; specialty?: string }
type SparePart = { id: number; internalCode: string; name: string; category: string; brand?: string; model?: string; publicSalePrice: string; purchasePrice: string; currentStock: number; minimumStock: number }
type InventorySale = { id: number; saleCode: string; totalAmount: string; paymentMethod: string; createdAt: string; client: Client; items: { id: number; quantity: number; unitPrice: string; subtotal: string; sparePart: SparePart }[] }
type WhatsappDraft = { orderId?: number; phone: string; message: string; title: string }
type WhatsappStatusResponse = {
  started: boolean
  initializing: boolean
  ready: boolean
  hasQr: boolean
  qrCodeDataUrl?: string
  lastError?: string
  channelKey?: string
  channelLabel?: string
}
type WhatsappMessageOrderSummary = {
  id: number
  orderCode: string
  status: string
  trackingToken: string
  client: Client
}
type IncomingWhatsappMessage = {
  id: number
  orderId?: number | null
  destinationPhone: string
  template: string
  deliveryStatus: string
  message?: string
  sentAt: string
  apiResponse?: { pushName?: string | null; direction?: string | null; channelKey?: string | null; channelLabel?: string | null }
  order?: WhatsappMessageOrderSummary | null
}
type WhatsappConversation = {
  phone: string
  phoneDigits: string
  displayName: string
  channelKey: string
  channelLabel: string
  client?: Client
  order?: WhatsappMessageOrderSummary
  items: IncomingWhatsappMessage[]
  lastMessageAt: string
  unreadCount: number
}
type Order = {
  id: number
  orderCode: string
  trackingToken: string
  status: string
  reportedIssue: string
  additionalFaultDetail?: string
  diagnosis?: string
  unlockCredentialType?: string
  unlockCredentialValue?: string
  unlockCredentialNotes?: string
  totalCost: string
  quoteApproved?: boolean
  client: Client
  equipment: Equipment
  technician?: Technician
  technicianId?: number
  faults?: { faultType: FaultType }[]
  quotes?: { id: number; description: string; type: string; quantity: string; unitPrice: string; subtotal: string; sparePartId?: number; sparePart?: SparePart }[]
  payments: { amount: string }[]
}

function useApi(session: Session | null, onUnauthorized?: () => void) {
  return useMemo(() => {
    const client = axios.create({ baseURL: API_URL })
    client.interceptors.request.use((config) => {
      if (session?.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`
      if (config.data) config.data = normalizePayload(config.data)
      return config
    })
    client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          onUnauthorized?.()
        }
        return Promise.reject(error)
      },
    )
    return client
  }, [session])
}

function App() {
  const trackingRoute = resolveTrackingRoute()
  if (trackingRoute) return <TrackingPage orderCode={trackingRoute.orderCode} token={trackingRoute.token} />

  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem('session')
    return raw ? JSON.parse(raw) : null
  })
  const [tab, setTab] = useState('dashboard')
  const [showWhatsappInbox, setShowWhatsappInbox] = useState(false)
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<WhatsappDraft | null>(null)

  const logout = () => {
    localStorage.removeItem('session')
    setSession(null)
  }

  const api = useApi(session, logout)

  if (!session) return <Login onLogin={setSession} />

  return (
    <div className="min-h-screen bg-[#f5f7f8]">
      <header className="border-b border-slate-300 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase text-teal-700">Talleres Electronicos</p>
            <h1 className="text-lg font-extrabold text-slate-900">
              Plataforma Digital de Gestion Operativa
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-5 w-5 text-teal-700" />
            <span className="font-semibold">{session.user.fullName}</span>
            <span className="status-pill">{session.user.role}</span>
            <button className="btn btn-secondary" onClick={logout} title="Cerrar sesion">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[240px_1fr]">
        <nav className="panel flex gap-2 overflow-x-auto p-2 lg:block lg:space-y-2">
          {[
            ['dashboard', Activity, 'Tablero'],
            ['orders', Wrench, 'Ordenes'],
            ['clients', UserRound, 'Clientes'],
            ['equipment', MonitorSmartphone, 'Equipos'],
            ['inventory', Boxes, 'Inventario'],
            ['sales', CreditCard, 'Ventas'],
            ['whatsapp', MessageCircle, 'WhatsApp'],
          ].map(([id, Icon, label]) => (
            <button
              key={String(id)}
              className={`btn w-full justify-start ${tab === id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setTab(String(id))
                if (String(id) !== 'whatsapp') setShowWhatsappInbox(false)
              }}
            >
              <Icon className="h-4 w-4" />
              {String(label)}
            </button>
          ))}
        </nav>

        <section className="space-y-4">
          {message && <div className="panel border-teal-300 bg-teal-50 p-3 text-sm font-semibold text-teal-900">{message}</div>}
          {tab === 'dashboard' && <Dashboard api={api} />}
          {tab === 'orders' && <Orders api={api} onMessage={setMessage} onDraft={setDraft} />}
          {tab === 'clients' && <Clients api={api} onMessage={setMessage} />}
          {tab === 'equipment' && <EquipmentPanel api={api} onMessage={setMessage} />}
          {tab === 'inventory' && <Inventory api={api} onMessage={setMessage} />}
          {tab === 'sales' && <Sales api={api} onMessage={setMessage} />}
          {tab === 'whatsapp' && !showWhatsappInbox && <Whatsapp api={api} onMessage={setMessage} onOpenInbox={() => setShowWhatsappInbox(true)} />}
          {tab === 'whatsapp' && showWhatsappInbox && <WhatsappInbox api={api} onMessage={setMessage} onDraft={setDraft} onBack={() => setShowWhatsappInbox(false)} />}
        </section>
      </main>
      {draft && <WhatsappPreviewModal api={api} draft={draft} onClose={() => setDraft(null)} onMessage={setMessage} />}
    </div>
  )
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('Admin123*')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, { username, password })
      localStorage.setItem('session', JSON.stringify(data))
      onLogin(data)
    } catch {
      setError('No se pudo iniciar sesion. Revise usuario y contrasena.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e9eef0] px-4">
      <form onSubmit={submit} className="panel w-full max-w-md p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-bold uppercase text-teal-700">Acceso del personal</p>
          <h1 className="text-2xl font-extrabold text-slate-950">Control Administrativo del Taller</h1>
        </div>
        <label className="mb-3 block text-sm font-bold">
          Usuario
          <input className="field mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="mb-4 block text-sm font-bold">
          Contrasena
          <input className="field mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="mb-3 text-sm font-semibold text-red-700">{error}</p>}
        <button className="btn btn-primary w-full">
          <ShieldCheck className="h-4 w-4" />
          Entrar
        </button>
        <p className="mt-4 text-xs text-slate-600">Demo inicial: admin / Admin123*</p>
      </form>
    </main>
  )
}

function Dashboard({ api }: { api: ReturnType<typeof useApi> }) {
  const [data, setData] = useState<any>()
  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).catch(() => null)
  }, [api])
  const cards = [
    ['Clientes activos', data?.activeClients ?? 0],
    ['Tecnicos activos', data?.activeTechnicians ?? 0],
    ['Repuestos bajo minimo', data?.lowStockParts ?? 0],
    ['Ingresos registrados', `Q ${Number(data?.totalIncome ?? 0).toFixed(2)}`],
  ]
  return (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>
      <div className="panel p-4">
        <h2 className="mb-3 text-lg font-extrabold">Ordenes por estado</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {(data?.ordersByStatus ?? []).map((row: any) => (
            <div key={row.status} className="rounded-md border border-slate-200 p-3">
              <span className="status-pill">{row.status}</span>
              <p className="mt-2 text-xl font-extrabold">{row._count.id}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function Clients({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const emptyForm = { firstName: '', lastName: '', phone: '', dpi: '', nit: '' }
  const [items, setItems] = useState<Client[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const load = () => api.get('/clients').then((r) => setItems(r.data))
  useEffect(() => { load() }, [])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (editingId) {
        await api.patch(`/clients/${editingId}`, clean(form))
        onMessage('Cliente actualizado correctamente')
      } else {
        await api.post('/clients', clean({ ...form, phone: form.phone.trim() || 'Sin telefono registrado' }))
        onMessage('Cliente registrado correctamente')
      }
      setForm(emptyForm)
      setEditingId(null)
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const edit = (item: Client) => {
    setEditingId(item.id)
    setForm({ firstName: item.firstName, lastName: item.lastName, phone: item.phone, dpi: item.dpi ?? '', nit: item.nit ?? '' })
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  return (
    <CrudLayout title={editingId ? 'Editar cliente' : 'Clientes'} icon={<UserRound />} onSubmit={submit} submitLabel={editingId ? 'Actualizar cliente' : 'Guardar cliente'} onCancel={editingId ? cancelEdit : undefined}>
      <input className="field" title="Ingrese los nombres del cliente" placeholder="Nombres del cliente, por ejemplo: Mario Alexander" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
      <input className="field" title="Ingrese los apellidos del cliente" placeholder="Apellidos del cliente, por ejemplo: Mejia Lopez" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
      <input className="field" title="Numero para avisos por WhatsApp; puede dejarlo vacio si el telefono del cliente es el equipo danado" placeholder="Telefono WhatsApp del cliente o familiar, opcional si no tiene disponible" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input className="field" title="Documento personal de identificacion, si aplica" placeholder="DPI del cliente, si lo proporciono" value={form.dpi} onChange={(e) => setForm({ ...form, dpi: e.target.value })} />
      <input className="field" title="NIT para facturacion, si aplica" placeholder="NIT para factura, si lo proporciono" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
      <List>
        {items.map((item) => (
          <Row
            key={item.id}
            title={`${item.firstName} ${item.lastName}`}
            subtitle={`${item.phone} | DPI: ${item.dpi ?? 'N/A'} | NIT: ${item.nit ?? 'N/A'}`}
            actions={<button type="button" className="btn btn-secondary" onClick={() => edit(item)}><Pencil className="h-4 w-4" />Editar</button>}
          />
        ))}
      </List>
    </CrudLayout>
  )
}

function EquipmentPanel({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const [clients, setClients] = useState<Client[]>([])
  const [types, setTypes] = useState<EquipmentType[]>([])
  const [items, setItems] = useState<Equipment[]>([])
  const emptyForm = { clientId: '', equipmentTypeId: '', brand: '', model: '', serialNumber: '', color: '', physicalDescription: '', accessories: '' }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const load = () => Promise.all([api.get('/clients'), api.get('/equipment-types'), api.get('/equipment')]).then(([c, t, e]) => {
    setClients(c.data); setTypes(t.data); setItems(e.data)
  })
  useEffect(() => { load() }, [])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const payload = clean({ ...form, clientId: Number(form.clientId), equipmentTypeId: Number(form.equipmentTypeId) })
      if (editingId) {
        await api.patch(`/equipment/${editingId}`, payload)
        onMessage('Equipo actualizado correctamente')
      } else {
        await api.post('/equipment', payload)
        onMessage('Equipo registrado correctamente')
      }
      setForm(emptyForm)
      setEditingId(null)
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const edit = (item: Equipment) => {
    setEditingId(item.id)
    setForm({
      clientId: String(item.clientId),
      equipmentTypeId: String(item.equipmentType?.id ?? item.equipmentTypeId ?? ''),
      brand: item.brand,
      model: item.model,
      serialNumber: item.serialNumber ?? '',
      color: item.color ?? '',
      physicalDescription: item.physicalDescription ?? '',
      accessories: item.accessories ?? '',
    })
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  return (
    <CrudLayout title={editingId ? 'Editar equipo' : 'Equipos'} icon={<MonitorSmartphone />} onSubmit={submit} submitLabel={editingId ? 'Actualizar equipo' : 'Guardar equipo'} onCancel={editingId ? cancelEdit : undefined}>
      <select className="field" title="Seleccione el propietario del equipo" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
        <option value="">Cliente propietario del equipo</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
      </select>
      <select className="field" title="Seleccione si es celular, laptop, tablet u otro tipo registrado" value={form.equipmentTypeId} onChange={(e) => setForm({ ...form, equipmentTypeId: e.target.value })} required>
        <option value="">Tipo de equipo recibido</option>
        {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input className="field" title="Marca comercial del equipo" placeholder="Marca del equipo, por ejemplo: Samsung" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
      <input className="field" title="Modelo exacto o referencia del equipo" placeholder="Modelo del equipo, por ejemplo: SM-A336M" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
      <input className="field" title="Serie, IMEI o identificador unico si esta disponible" placeholder="Serie o IMEI, si el equipo lo tiene visible" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
      <input className="field" title="Color principal del equipo" placeholder="Color del equipo, por ejemplo: negro" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
      <textarea className="field md:col-span-2" title="Estado fisico al recibirlo para evitar reclamos posteriores" placeholder="Estado fisico al recibirlo: golpes, rayones, pantalla rota, humedad, faltantes" value={form.physicalDescription} onChange={(e) => setForm({ ...form, physicalDescription: e.target.value })} />
      <input className="field md:col-span-2" title="Cargador, cable, chip, memoria, funda u otros accesorios entregados" placeholder="Accesorios incluidos con el equipo, por ejemplo: cargador y funda" value={form.accessories} onChange={(e) => setForm({ ...form, accessories: e.target.value })} />
      <List>
        {items.map((item) => (
          <Row
            key={item.id}
            title={`${item.equipmentType.name} ${item.brand} ${item.model}`}
            subtitle={`${item.client?.firstName ?? ''} ${item.client?.lastName ?? ''} | Serie: ${item.serialNumber ?? 'N/A'}`}
            actions={<button type="button" className="btn btn-secondary" onClick={() => edit(item)}><Pencil className="h-4 w-4" />Editar</button>}
          />
        ))}
      </List>
    </CrudLayout>
  )
}

function Orders({ api, onMessage, onDraft }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void; onDraft: (draft: WhatsappDraft) => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [faults, setFaults] = useState<FaultType[]>([])
  const [techs, setTechs] = useState<Technician[]>([])
  const [spareParts, setSpareParts] = useState<SparePart[]>([])
  const emptyForm = { clientId: '', equipmentId: '', technicianId: '', reportedIssue: '', additionalFaultDetail: '', unlockCredentialType: '', unlockCredentialValue: '', unlockCredentialNotes: '', totalCost: 0, faultTypeIds: [] as number[] }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const load = () => Promise.all([api.get('/orders'), api.get('/clients'), api.get('/equipment'), api.get('/fault-types'), api.get('/technicians'), api.get('/spare-parts')]).then(([o, c, e, f, t, s]) => {
    setOrders(o.data); setClients(c.data); setEquipment(e.data); setFaults(f.data); setTechs(t.data); setSpareParts(s.data)
  })
  useEffect(() => { load() }, [])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const payload = clean({ ...form, clientId: Number(form.clientId), equipmentId: Number(form.equipmentId), technicianId: form.technicianId ? Number(form.technicianId) : undefined })
      if (editingId) {
        await api.patch(`/orders/${editingId}`, payload)
        onMessage('Orden actualizada correctamente')
      } else {
        await api.post('/orders', payload)
        onMessage('Orden creada correctamente. El mensaje de recepcion queda disponible para envio manual cuando usted lo decida.')
      }
      setForm(emptyForm)
      setEditingId(null)
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const status = async (id: number, next: string) => {
    try {
      await api.patch(`/orders/${id}/status`, { status: next, comment: `Cambio manual a ${next}` })
      onMessage(`Orden actualizada a ${next}`)
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const edit = (order: Order) => {
    setEditingId(order.id)
    setForm({
      clientId: String(order.client.id),
      equipmentId: String(order.equipment.id),
      technicianId: order.technician?.id ? String(order.technician.id) : '',
      reportedIssue: order.reportedIssue,
      additionalFaultDetail: order.additionalFaultDetail ?? '',
      unlockCredentialType: order.unlockCredentialType ?? '',
      unlockCredentialValue: order.unlockCredentialValue ?? '',
      unlockCredentialNotes: order.unlockCredentialNotes ?? '',
      totalCost: Number(order.totalCost),
      faultTypeIds: order.faults?.map((fault) => fault.faultType.id) ?? [],
    })
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  const credentialRequired = faults.some((fault) => fault.requiresCredential && form.faultTypeIds.includes(fault.id))
  const credentialPlaceholder = form.unlockCredentialType === 'PATRON'
    ? 'PATRON EN NUMEROS, EJEMPLO: 1-2-3-6-9'
    : form.unlockCredentialType === 'CONTRASENA'
      ? 'CONTRASENA EXACTA, RESPETA MAYUSCULAS Y MINUSCULAS'
      : 'PIN O CLAVE EXACTA'
  return (
    <div className="space-y-4">
      <CrudLayout title={editingId ? 'Editar orden' : 'Nueva orden'} icon={<Wrench />} onSubmit={submit} submitLabel={editingId ? 'Actualizar orden' : 'Guardar orden'} onCancel={editingId ? cancelEdit : undefined}>
        <select className="field" title="Seleccione el cliente que entrega el equipo al taller" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value, equipmentId: '' })} required>
          <option value="">Cliente que entrega el equipo</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
        </select>
        <select className="field" title="Seleccione el equipo especifico que sera diagnosticado o reparado" value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} required>
          <option value="">Equipo que ingresa a revision</option>
          {equipment.filter((e) => !form.clientId || e.clientId === Number(form.clientId)).map((e) => <option key={e.id} value={e.id}>{e.brand} {e.model}</option>)}
        </select>
        <select className="field" title="Asignacion interna; puede dejarlo vacio si aun no sabe quien lo revisara" value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>
          <option value="">Tecnico asignado, opcional</option>
          {techs.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
        </select>
        {editingId && (
          <input className="field" type="number" min="0" step="0.01" title="Monto total presupuestado o acordado para esta orden" placeholder="Presupuesto total de la orden en Q" value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: Number(e.target.value) })} />
        )}
        <textarea className="field md:col-span-2" title="Describa con palabras del cliente el motivo del ingreso. Esto es el relato libre del cliente." placeholder="PROBLEMA REPORTADO POR EL CLIENTE, POR EJEMPLO: NO CARGA, PANTALLA QUEBRADA, SE APAGA SOLO" value={form.reportedIssue} onChange={(e) => setForm({ ...form, reportedIssue: e.target.value })} required />
        <input className="field md:col-span-2" title="Use este campo cuando la falla no exista en la lista de clasificacion" placeholder="FALLA ADICIONAL NO LISTADA, OPCIONAL" value={form.additionalFaultDetail} onChange={(e) => setForm({ ...form, additionalFaultDetail: e.target.value })} />
        <div className="md:col-span-2 grid gap-2 sm:grid-cols-2">
          {faults.map((f) => (
            <label key={f.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm" title="Marque sintomas para clasificar la orden y orientar la revision tecnica">
              <input type="checkbox" checked={form.faultTypeIds.includes(f.id)} onChange={(e) => {
                const ids = e.target.checked ? [...form.faultTypeIds, f.id] : form.faultTypeIds.filter((id) => id !== f.id)
                const stillNeedsCredential = faults.some((fault) => fault.requiresCredential && ids.includes(fault.id))
                setForm({
                  ...form,
                  faultTypeIds: ids,
                  unlockCredentialType: stillNeedsCredential ? form.unlockCredentialType : '',
                  unlockCredentialValue: stillNeedsCredential ? form.unlockCredentialValue : '',
                  unlockCredentialNotes: stillNeedsCredential ? form.unlockCredentialNotes : '',
                })
              }} />
              {f.name} {f.requiresCredential ? '(requiere clave)' : ''}
            </label>
          ))}
        </div>
        {credentialRequired && (
          <div className="md:col-span-2 grid gap-2 rounded-md border border-teal-200 bg-teal-50 p-3 md:grid-cols-3">
            <select className="field" title="Seleccione el tipo de desbloqueo que dejo el cliente" value={form.unlockCredentialType} onChange={(e) => setForm({ ...form, unlockCredentialType: e.target.value })} required={credentialRequired}>
              <option value="" disabled>SELECCIONE TIPO DE CLAVE</option>
              <option value="PIN">PIN NUMERICO</option>
              <option value="CONTRASENA">CONTRASENA</option>
              <option value="PATRON">PATRON</option>
              <option value="NINGUNA">NO DEJO CLAVE</option>
            </select>
            <input className="field credential-value" title="Para patron use posiciones como teclado numerico: 1-2-3 arriba, 4-5-6 centro, 7-8-9 abajo. Para contrasena escriba exactamente mayusculas y minusculas." placeholder={credentialPlaceholder} value={form.unlockCredentialValue} onChange={(e) => setForm({ ...form, unlockCredentialValue: e.target.value })} />
            <input className="field" title="Notas utiles para el tecnico sobre el desbloqueo" placeholder="Notas de desbloqueo, opcional" value={form.unlockCredentialNotes} onChange={(e) => setForm({ ...form, unlockCredentialNotes: e.target.value })} />
          </div>
        )}
      </CrudLayout>
      <div className="panel p-4">
        <h2 className="mb-3 text-lg font-extrabold">Ordenes registradas</h2>
        <div className="space-y-3">
          {orders.map((order) => <OrderCard key={order.id} order={order} spareParts={spareParts} api={api} onStatus={status} onMessage={onMessage} reload={load} onEdit={edit} onDraft={onDraft} />)}
        </div>
      </div>
    </div>
  )
}

function OrderCard({ order, spareParts, api, onStatus, onMessage, reload, onEdit, onDraft }: { order: Order; spareParts: SparePart[]; api: ReturnType<typeof useApi>; onStatus: (id: number, s: string) => void; onMessage: (m: string) => void; reload: () => void; onEdit: (order: Order) => void; onDraft: (draft: WhatsappDraft) => void }) {
  const [quote, setQuote] = useState({ description: '', type: 'MANO_OBRA', quantity: 1, unitPrice: 0, sparePartId: '' })
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null)
  const [diagnosis, setDiagnosis] = useState({ diagnosis: order.diagnosis ?? '', additionalFaultDetail: order.additionalFaultDetail ?? '' })
  const [payment, setPayment] = useState({ amount: 0, paymentMethod: 'EFECTIVO' })
  const paid = order.payments?.reduce((sum, item) => sum + Number(item.amount), 0) ?? 0
  const addQuote = async () => {
    try {
      const wasFirstQuote = !editingQuoteId && (!order.quotes || order.quotes.length === 0)
      const projectedTotal = wasFirstQuote ? quote.quantity * quote.unitPrice : Number(order.totalCost)
      const payload = clean({ ...quote, sparePartId: quote.sparePartId ? Number(quote.sparePartId) : undefined })
      if (editingQuoteId) {
        await api.patch(`/orders/${order.id}/quotes/${editingQuoteId}`, payload)
      } else {
        await api.post(`/orders/${order.id}/quotes`, payload)
      }
      setQuote({ description: '', type: 'MANO_OBRA', quantity: 1, unitPrice: 0, sparePartId: '' })
      setEditingQuoteId(null)
      onMessage(editingQuoteId ? 'Detalle de presupuesto actualizado' : 'Presupuesto agregado')
      if (wasFirstQuote) {
        openWhatsappDraft(buildBudgetWhatsappDraft(order, diagnosis.diagnosis || order.diagnosis || '', projectedTotal), onDraft, onMessage)
      }
      reload()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const editQuote = (item: NonNullable<Order['quotes']>[number]) => {
    setEditingQuoteId(item.id)
    setQuote({ description: item.description, type: item.type, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), sparePartId: item.sparePartId ? String(item.sparePartId) : '' })
  }
  const removeQuote = async (quoteId: number) => {
    try {
      await api.patch(`/orders/${order.id}/quotes/${quoteId}/remove`)
      if (editingQuoteId === quoteId) {
        setEditingQuoteId(null)
        setQuote({ description: '', type: 'MANO_OBRA', quantity: 1, unitPrice: 0, sparePartId: '' })
      }
      onMessage('Detalle de presupuesto eliminado')
      reload()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const cancelQuoteEdit = () => {
    setEditingQuoteId(null)
    setQuote({ description: '', type: 'MANO_OBRA', quantity: 1, unitPrice: 0, sparePartId: '' })
  }
  const approveQuote = async () => {
    try {
      await api.patch(`/orders/${order.id}/approve-quote`, { approved: true, method: 'IN_PERSON' })
      onMessage('Presupuesto aprobado y orden enviada a reparacion')
      reload()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const saveDiagnosis = async () => {
    try {
      await api.patch(`/orders/${order.id}/diagnosis`, diagnosis)
      onMessage('Diagnostico tecnico registrado')
      reload()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const addPayment = async () => {
    try {
      await api.post(`/orders/${order.id}/payments`, payment)
      setPayment({ amount: 0, paymentMethod: 'EFECTIVO' })
      onMessage('Pago registrado')
      reload()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  return (
    <article className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold">{order.orderCode}</h3>
            <span className="status-pill">{order.status}</span>
          </div>
          <p className="text-sm text-slate-600">{order.client.firstName} {order.client.lastName} | {order.equipment.brand} {order.equipment.model}</p>
          <p className="mt-1 text-sm">{order.reportedIssue}</p>
          {order.additionalFaultDetail && <p className="mt-1 text-sm">FALLA ADICIONAL: {order.additionalFaultDetail}</p>}
          {order.unlockCredentialType && (
            <p className="mt-1 text-sm font-semibold text-teal-800">
              DESBLOQUEO: {order.unlockCredentialType} {order.unlockCredentialValue ? `| ${order.unlockCredentialValue}` : ''} {order.unlockCredentialNotes ? `| ${order.unlockCredentialNotes}` : ''}
            </p>
          )}
        </div>
        <div className="text-right text-sm">
          <p className="font-extrabold" title="Monto total presupuestado para la reparacion. Se calcula con los detalles de presupuesto y tambien puede editarse desde Editar orden.">Presupuesto total Q {Number(order.totalCost).toFixed(2)}</p>
          <p>Pagado Q {paid.toFixed(2)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="btn btn-secondary" href={`${API_URL}/public/orders/${order.id}/ticket`} target="_blank"><FileText className="h-4 w-4" />Ticket con QR</a>
        <button className="btn btn-secondary" onClick={() => openWhatsappDraft(buildOrderWhatsappDraft(order), onDraft, onMessage)}><MessageCircle className="h-4 w-4" />WhatsApp rastreo</button>
        <button className="btn btn-secondary" onClick={() => onEdit(order)}><Pencil className="h-4 w-4" />Editar orden</button>
        <button className="btn btn-secondary" onClick={() => onStatus(order.id, 'EN_REVISION')}>Marcar revision</button>
        <button className="btn btn-secondary" onClick={() => openWhatsappDraft(buildBudgetWhatsappDraft(order, diagnosis.diagnosis || order.diagnosis || '', Number(order.totalCost)), onDraft, onMessage)}><MessageCircle className="h-4 w-4" />WhatsApp presupuesto</button>
        <button className="btn btn-secondary" onClick={approveQuote}>Aprobar presupuesto</button>
        <button className="btn btn-secondary" onClick={() => {
          onStatus(order.id, 'LISTO_PARA_RECOGER')
          openWhatsappDraft(buildReadyWhatsappDraft(order), onDraft, onMessage)
        }}><MessageCircle className="h-4 w-4" />Listo para recoger</button>
        <button className="btn btn-primary" onClick={() => onStatus(order.id, 'FINALIZADO')}>Finalizar entrega</button>
      </div>
      <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
        <p className="text-sm font-extrabold text-slate-700">Diagnostico tecnico</p>
        {order.diagnosis && <p className="mt-1 text-sm text-slate-700">{order.diagnosis}</p>}
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <textarea className="field" title="Pruebas realizadas y hallazgos reales del tecnico" placeholder="DIAGNOSTICO TECNICO: PRUEBAS REALIZADAS Y HALLAZGOS" value={diagnosis.diagnosis} onChange={(e) => setDiagnosis({ ...diagnosis, diagnosis: e.target.value })} />
          <textarea className="field" title="Fallas nuevas detectadas despues de la revision" placeholder="FALLAS NUEVAS DETECTADAS, POR EJEMPLO: HUMEDAD DANO PANTALLA" value={diagnosis.additionalFaultDetail} onChange={(e) => setDiagnosis({ ...diagnosis, additionalFaultDetail: e.target.value })} />
          <button className="btn btn-secondary" onClick={saveDiagnosis}><Pencil className="h-4 w-4" />Guardar diagnostico</button>
        </div>
      </div>
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-extrabold text-slate-700">Presupuesto tecnico registrado</p>
        {order.quotes?.length ? (
          <div className="mt-2 space-y-1 text-sm">
            {order.quotes.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span>{item.description} ({item.type}) x {Number(item.quantity).toFixed(0)}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Q {Number(item.subtotal).toFixed(2)}</span>
                  <button className="btn btn-secondary px-2 py-1 text-xs" type="button" onClick={() => editQuote(item)}><Pencil className="h-3 w-3" />Editar</button>
                  <button className="btn btn-secondary px-2 py-1 text-xs" type="button" onClick={() => removeQuote(item.id)}><X className="h-3 w-3" />Quitar</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-600">Aun no hay presupuesto. El tecnico debe agregar detalle, cantidad y precio unitario abajo.</p>
        )}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_130px_110px_110px_auto]">
        <input className="field" title="Trabajo, repuesto o cargo que se agregara al presupuesto" placeholder="Detalle del presupuesto, por ejemplo: cambio de pantalla" value={quote.description} onChange={(e) => setQuote({ ...quote, description: e.target.value })} />
        <select className="field" title="Clasifique si el cobro corresponde a mano de obra, repuesto u otro cargo" value={quote.type} onChange={(e) => setQuote({ ...quote, type: e.target.value, sparePartId: e.target.value === 'REPUESTO' ? quote.sparePartId : '' })}>
          <option value="MANO_OBRA">Mano de obra</option>
          <option value="REPUESTO">Repuesto</option>
          <option value="OTRO">Otro</option>
        </select>
        <input className="field" type="number" min="1" title="Cantidad de piezas o servicios de este detalle" placeholder="Cantidad" value={quote.quantity} onChange={(e) => setQuote({ ...quote, quantity: Number(e.target.value) })} />
        <input className="field" type="number" min="0" step="0.01" title="Precio unitario en quetzales" placeholder="Precio unitario Q" value={quote.unitPrice} onChange={(e) => setQuote({ ...quote, unitPrice: Number(e.target.value) })} />
        <button className="btn btn-secondary" onClick={addQuote} title={editingQuoteId ? 'Actualizar este detalle del presupuesto' : 'Agregar este detalle al presupuesto'}>
          {editingQuoteId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
      {quote.type === 'REPUESTO' && (
        <select
          className="field mt-2 w-full"
          title="Si el repuesto sale del inventario, seleccionelo aqui para descontarlo cuando el presupuesto sea aprobado"
          value={quote.sparePartId}
          onChange={(e) => {
            const part = spareParts.find((item) => item.id === Number(e.target.value))
            setQuote({
              ...quote,
              sparePartId: e.target.value,
              description: part ? part.name : quote.description,
              unitPrice: part ? Number(part.publicSalePrice) : quote.unitPrice,
            })
          }}
        >
          <option value="">Repuesto externo o no controlado en inventario</option>
          {spareParts.map((part) => (
            <option key={part.id} value={part.id}>
              {part.internalCode} - {part.name} | Stock {part.currentStock} | Q {Number(part.publicSalePrice).toFixed(2)}
            </option>
          ))}
        </select>
      )}
      {editingQuoteId && (
        <button className="btn btn-secondary mt-2" type="button" onClick={cancelQuoteEdit}>
          <X className="h-4 w-4" />
          Cancelar edicion de presupuesto
        </button>
      )}
      <div className="mt-2 grid gap-2 md:grid-cols-[140px_150px_auto]">
        <input className="field" type="number" min="0" step="0.01" title="Monto que el cliente paga en este momento" placeholder="Monto pagado Q" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })} />
        <select className="field" title="Forma de pago usada por el cliente" value={payment.paymentMethod} onChange={(e) => setPayment({ ...payment, paymentMethod: e.target.value })}>
          <option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>QR_PAGO</option>
        </select>
        <button className="btn btn-secondary" onClick={addPayment}><CreditCard className="h-4 w-4" />Registrar pago</button>
      </div>
    </article>
  )
}

function Inventory({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const [items, setItems] = useState<SparePart[]>([])
  const emptyForm = { internalCode: '', name: '', category: '', purchasePrice: 0, publicSalePrice: 0, currentStock: 0, minimumStock: 3 }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const load = () => api.get('/spare-parts').then((r) => setItems(r.data))
  useEffect(() => { load() }, [])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (editingId) {
        await api.patch(`/spare-parts/${editingId}`, form)
        onMessage('Repuesto actualizado')
      } else {
        await api.post('/spare-parts', form)
        onMessage('Repuesto registrado')
      }
      setForm(emptyForm)
      setEditingId(null)
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const edit = (item: any) => {
    setEditingId(item.id)
    setForm({
      internalCode: item.internalCode,
      name: item.name,
      category: item.category,
      purchasePrice: Number(item.purchasePrice),
      publicSalePrice: Number(item.publicSalePrice),
      currentStock: Number(item.currentStock),
      minimumStock: Number(item.minimumStock),
    })
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  const normalizedSearch = search.trim().toLocaleUpperCase('es-GT')
  const filteredItems = items.filter((item) => {
    if (!normalizedSearch) return true
    const haystack = [item.internalCode, item.name, item.category, item.brand ?? '', item.model ?? ''].join(' ').toLocaleUpperCase('es-GT')
    return haystack.includes(normalizedSearch)
  })
  return (
    <CrudLayout title={editingId ? 'Editar repuesto' : 'Inventario de repuestos'} icon={<Boxes />} onSubmit={submit} submitLabel={editingId ? 'Actualizar repuesto' : 'Guardar repuesto'} onCancel={editingId ? cancelEdit : undefined}>
      <input className="field" title="Codigo interno unico para ubicar el repuesto en inventario" placeholder="Codigo interno del repuesto, por ejemplo: SCREEN-0002" value={form.internalCode} onChange={(e) => setForm({ ...form, internalCode: e.target.value })} required />
      <input className="field" title="Nombre comercial o tecnico del repuesto" placeholder="Nombre del repuesto, por ejemplo: pantalla Samsung A336M" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input className="field" title="Categoria para filtrar y ordenar inventario" placeholder="Categoria, por ejemplo: pantallas, baterias, conectores" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
      <input className="field" type="number" min="0" step="0.01" title="Costo real de compra del repuesto" placeholder="Costo de compra en Q" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
      <input className="field" type="number" min="0" step="0.01" title="Precio final que se cobrara al cliente" placeholder="Precio de venta al publico en Q" value={form.publicSalePrice} onChange={(e) => setForm({ ...form, publicSalePrice: Number(e.target.value) })} />
      <input className="field" type="number" min="0" title="Cantidad disponible actualmente" placeholder="Stock actual disponible" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })} />
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <input className="field flex-1" title="Busque por codigo, nombre, marca, modelo o categoria" placeholder="Buscar repuesto por codigo, marca, modelo o categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
        <p className="text-sm font-bold text-slate-600">{filteredItems.length} repuestos visibles</p>
      </div>
      <List>
        {filteredItems.map((item) => (
          <Row
            key={item.id}
            title={`${item.internalCode} - ${item.name}`}
            subtitle={`${item.category} | Stock ${item.currentStock} | Venta Q ${Number(item.publicSalePrice).toFixed(2)}`}
            actions={<button type="button" className="btn btn-secondary" onClick={() => edit(item)}><Pencil className="h-4 w-4" />Editar</button>}
          />
        ))}
      </List>
    </CrudLayout>
  )
}

function Sales({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const [clients, setClients] = useState<Client[]>([])
  const [parts, setParts] = useState<SparePart[]>([])
  const [sales, setSales] = useState<InventorySale[]>([])
  const [form, setForm] = useState({ clientId: '', paymentMethod: 'EFECTIVO', notes: '' })
  const [item, setItem] = useState({ sparePartId: '', quantity: 1, unitPrice: 0 })
  const [items, setItems] = useState<{ sparePartId: number; name: string; quantity: number; unitPrice: number; subtotal: number }[]>([])
  const load = () => Promise.all([api.get('/clients'), api.get('/spare-parts'), api.get('/inventory-sales')]).then(([c, p, s]) => {
    setClients(c.data); setParts(p.data); setSales(s.data)
  })
  useEffect(() => { load() }, [])
  const addItem = () => {
    const part = parts.find((candidate) => candidate.id === Number(item.sparePartId))
    if (!part) { onMessage('Seleccione un articulo del inventario'); return }
    if (item.quantity <= 0 || item.unitPrice <= 0) { onMessage('Cantidad y precio deben ser mayores que cero'); return }
    if (item.quantity > part.currentStock) { onMessage('No hay stock suficiente para ese articulo'); return }
    setItems([...items, { sparePartId: part.id, name: part.name, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.quantity * item.unitPrice }])
    setItem({ sparePartId: '', quantity: 1, unitPrice: 0 })
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/inventory-sales', {
        clientId: Number(form.clientId),
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
        items: items.map(({ sparePartId, quantity, unitPrice }) => ({ sparePartId, quantity, unitPrice })),
      })
      setForm({ clientId: '', paymentMethod: 'EFECTIVO', notes: '' })
      setItems([])
      onMessage('Venta registrada y stock descontado')
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const total = items.reduce((sum, row) => sum + row.subtotal, 0)
  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><CreditCard />Nueva venta de inventario</h2>
        <form onSubmit={submit} className="grid gap-2 md:grid-cols-2">
          <select className="field" title="Cliente al que se le vende el repuesto o articulo" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
            <option value="">Cliente comprador</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>)}
          </select>
          <select className="field" title="Forma en que el cliente paga la venta" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
            <option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>QR_PAGO</option>
          </select>
          <input className="field md:col-span-2" title="Observaciones internas de la venta" placeholder="Observaciones de la venta, opcional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="md:col-span-2 grid gap-2 md:grid-cols-[1fr_110px_150px_auto]">
            <select className="field" title="Articulo que saldra del inventario" value={item.sparePartId} onChange={(e) => {
              const part = parts.find((candidate) => candidate.id === Number(e.target.value))
              setItem({ ...item, sparePartId: e.target.value, unitPrice: part ? Number(part.publicSalePrice) : item.unitPrice })
            }}>
              <option value="">Articulo del inventario</option>
              {parts.map((part) => <option key={part.id} value={part.id}>{part.internalCode} - {part.name} | Stock {part.currentStock}</option>)}
            </select>
            <input className="field" type="number" min="1" title="Cantidad vendida" placeholder="Cantidad" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: Number(e.target.value) })} />
            <input className="field" type="number" min="0" step="0.01" title="Precio unitario de venta" placeholder="Precio unitario Q" value={item.unitPrice} onChange={(e) => setItem({ ...item, unitPrice: Number(e.target.value) })} />
            <button type="button" className="btn btn-secondary" onClick={addItem}><Plus className="h-4 w-4" />Agregar</button>
          </div>
          <div className="md:col-span-2 space-y-2">
            {items.map((row, index) => (
              <div key={`${row.sparePartId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-2">
                <span>{row.name} x {row.quantity}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Q {row.subtotal.toFixed(2)}</span>
                  <button type="button" className="btn btn-secondary px-2 py-1 text-xs" onClick={() => setItems(items.filter((_, i) => i !== index))}><X className="h-3 w-3" />Quitar</button>
                </div>
              </div>
            ))}
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-extrabold">Total venta Q {total.toFixed(2)}</p>
            <button className="btn btn-primary"><CreditCard className="h-4 w-4" />Registrar venta</button>
          </div>
        </form>
      </div>
      <div className="panel p-4">
        <h2 className="mb-3 text-lg font-extrabold">Ventas registradas</h2>
        <div className="space-y-2">
          {sales.map((sale) => (
            <Row
              key={sale.id}
              title={`${sale.saleCode} - ${sale.client.firstName} ${sale.client.lastName}`}
              subtitle={`${sale.items.map((row) => `${row.sparePart.name} x ${row.quantity}`).join(', ')} | ${sale.paymentMethod} | Total Q ${Number(sale.totalAmount).toFixed(2)}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Whatsapp({ api, onMessage, onOpenInbox }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void; onOpenInbox: () => void }) {
  const [status, setStatus] = useState<WhatsappStatusResponse>({ started: false, initializing: false, ready: false, hasQr: false })
  const [messages, setMessages] = useState<IncomingWhatsappMessage[]>([])

  const loadStatus = () => {
    api.get('/whatsapp/status').then((response) => setStatus(response.data)).catch(() => null)
  }

  const loadMessages = () => {
    api.get('/whatsapp/messages').then((response) => setMessages(response.data)).catch(() => null)
  }

  useEffect(() => {
    loadStatus()
    loadMessages()
    const timer = window.setInterval(() => {
      loadStatus()
      loadMessages()
    }, status.ready ? 5000 : 2000)
    return () => window.clearInterval(timer)
  }, [api, status.ready])

  const startLinkedSession = async () => {
    try {
      onMessage('')
      const { data } = await api.post('/whatsapp/start')
      if (data.message && data.message !== 'Vinculacion por QR iniciada') onMessage(data.message)
      loadStatus()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }

  const stopLinkedSession = async () => {
    try {
      const { data } = await api.post('/whatsapp/stop')
      onMessage(data.message ?? 'Numero desvinculado correctamente.')
      loadStatus()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }

  const displayError =
    status.lastError &&
    !status.hasQr &&
    !status.ready &&
    !status.lastError.includes('Attempted to use detached Frame')
      ? status.lastError
      : ''

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold">WhatsApp vinculado</h2>
            <p className="text-sm text-slate-600">Desde aqui solo se controla la sesion institucional y el acceso a la bandeja de conversaciones.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={onOpenInbox}>
              <MessageCircle className="h-4 w-4" />
              Abrir bandeja
            </button>
            <button
              className="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={stopLinkedSession}
              disabled={!status.started && !status.ready}
              title={status.started || status.ready ? 'Desvincular el numero actual y limpiar la sesion guardada.' : 'No hay un numero vinculado para desvincular.'}
            >
              <X className="h-4 w-4" />
              Desvincular
            </button>
            <button
              className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={startLinkedSession}
              disabled={status.ready || status.initializing}
              title={status.ready ? 'Ya existe un numero vinculado. Primero debe desvincularlo para iniciar un QR nuevo.' : status.initializing ? 'La vinculacion ya esta en proceso.' : 'Iniciar vinculacion por QR'}
            >
              <ShieldCheck className="h-4 w-4" />
              {status.ready ? 'Numero vinculado' : status.initializing ? 'Iniciando...' : 'Iniciar QR'}
            </button>
          </div>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Status label="Sesion" value={status.ready ? 'Iniciado' : status.initializing ? 'Iniciando' : status.started ? 'Pendiente de escaneo' : 'Sin iniciar'} />
          <Status label="QR" value={status.ready ? 'Oculto' : status.hasQr ? 'Visible para escaneo' : 'No visible'} />
          <Status label="Canal" value={status.channelLabel ?? 'Sesion empresa'} />
          <Status label="Mensajes" value={messages.length ? `${messages.length} registrados` : 'Sin registros'} />
        </div>
        {displayError && <p className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{displayError}</p>}
        {status.qrCodeDataUrl && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-sm font-bold text-slate-700">QR de vinculacion</p>
            <img src={status.qrCodeDataUrl} alt="QR de WhatsApp" className="h-64 w-64 rounded-md border border-slate-200 bg-white p-2" />
          </div>
        )}
      </div>
    </div>
  )
}

function WhatsappInbox({ api, onMessage, onDraft, onBack }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void; onDraft: (draft: WhatsappDraft) => void; onBack: () => void }) {
  const [messages, setMessages] = useState<IncomingWhatsappMessage[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [selectedPhone, setSelectedPhone] = useState('')
  const [conversationDraft, setConversationDraft] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'RESPONDED' | 'ACCEPTED' | 'REJECTED' | 'PENDING'>('ALL')
  const [channelFilter, setChannelFilter] = useState<'ALL' | string>('ALL')

  useEffect(() => {
    const load = () => {
      api.get('/whatsapp/messages').then((response) => setMessages(response.data)).catch(() => null)
      api.get('/clients').then((response) => setClients(response.data)).catch(() => null)
    }
    load()
    const timer = window.setInterval(load, 10000)
    return () => window.clearInterval(timer)
  }, [api])

  const conversations = useMemo<WhatsappConversation[]>(() => {
    const grouped = new Map<string, IncomingWhatsappMessage[]>()
    for (const item of messages) {
      const digits = normalizePhoneForMatching(item.destinationPhone)
      if (!digits) continue
      const current = grouped.get(digits) ?? []
      current.push(item)
      grouped.set(digits, current)
    }

    return [...grouped.entries()]
      .map(([phoneDigits, items]) => {
        const sortedItems = [...items].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
        const latest = sortedItems[sortedItems.length - 1]
        const order = [...sortedItems].reverse().find((item) => item.order)?.order ?? undefined
        const client = order?.client ?? clients.find((row) => normalizePhoneForMatching(row.phone) === phoneDigits)
        const displayName = client ? `${client.firstName} ${client.lastName}` : latest.apiResponse?.pushName?.trim() || formatPhoneForDisplay(latest.destinationPhone)
        return {
          phone: latest.destinationPhone,
          phoneDigits,
          displayName,
          channelKey: latest.apiResponse?.channelKey ?? 'WHATSAPP_GENERAL',
          channelLabel: latest.apiResponse?.channelLabel ?? 'Canal general',
          client,
          order,
          items: sortedItems,
          lastMessageAt: latest.sentAt,
          unreadCount: sortedItems.filter((item) => item.template === 'incoming_message').length,
        }
      })
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
  }, [clients, messages])

  const channelOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const conversation of conversations) {
      map.set(conversation.channelKey, conversation.channelLabel)
    }
    return [...map.entries()].map(([key, label]) => ({ key, label }))
  }, [conversations])

  const dashboard = useMemo(() => {
    const orders = new Map<number, WhatsappMessageOrderSummary>()
    for (const conversation of conversations) {
      if (conversation.order) orders.set(conversation.order.id, conversation.order)
    }
    const rows = [...orders.values()]
    return {
      totalConversations: conversations.length,
      responded: rows.filter((order) => order.status === 'EN_REPARACION' || order.status === 'PRESUPUESTO_RECHAZADO').length,
      accepted: rows.filter((order) => order.status === 'EN_REPARACION').length,
      rejected: rows.filter((order) => order.status === 'PRESUPUESTO_RECHAZADO').length,
      pending: rows.filter((order) => ['PRESUPUESTO_ENVIADO', 'EN_REVISION', 'ESPERANDO_PRESUPUESTO'].includes(order.status)).length,
    }
  }, [conversations])

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase()
    return conversations.filter((conversation) => {
      if (channelFilter !== 'ALL' && conversation.channelKey !== channelFilter) return false
      const matchesTerm = !term || conversation.displayName.toLowerCase().includes(term) || conversation.phoneDigits.includes(term.replace(/\D/g, '')) || (conversation.order?.orderCode.toLowerCase().includes(term) ?? false)
      if (!matchesTerm) return false
      if (filter === 'ALL') return true
      if (!conversation.order) return false
      if (filter === 'RESPONDED') return conversation.order.status === 'EN_REPARACION' || conversation.order.status === 'PRESUPUESTO_RECHAZADO'
      if (filter === 'ACCEPTED') return conversation.order.status === 'EN_REPARACION'
      if (filter === 'REJECTED') return conversation.order.status === 'PRESUPUESTO_RECHAZADO'
      return ['PRESUPUESTO_ENVIADO', 'EN_REVISION', 'ESPERANDO_PRESUPUESTO'].includes(conversation.order.status)
    })
  }, [channelFilter, conversations, filter, search])

  useEffect(() => {
    if (!filteredConversations.length) {
      setSelectedPhone('')
      return
    }
    if (!selectedPhone || !filteredConversations.some((conversation) => conversation.phoneDigits === selectedPhone)) {
      setSelectedPhone(filteredConversations[0].phoneDigits)
    }
  }, [filteredConversations, selectedPhone])

  const selectedConversation = filteredConversations.find((conversation) => conversation.phoneDigits === selectedPhone)

  const openConversationDraft = () => {
    if (!selectedConversation) return onMessage('Seleccione una conversacion para preparar el mensaje.')
    const draft = buildManualWhatsappDraft(selectedConversation.phone, conversationDraft)
    if (draft.notice) return onMessage(draft.notice)
    if (draft.draft) onDraft({ ...draft.draft, orderId: selectedConversation.order?.id, title: `Conversacion ${selectedConversation.displayName}` })
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold">Bandeja de conversaciones</h2>
            <p className="text-sm text-slate-600">Panel auxiliar para revisar respuestas de clientes, filtrar conversaciones y enviar mensajes desde un solo lugar.</p>
          </div>
          <button className="btn btn-secondary" onClick={onBack}>
            <X className="h-4 w-4" />
            Regresar
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Status label="Conversaciones" value={String(dashboard.totalConversations)} />
          <Status label="Respondieron" value={String(dashboard.responded)} />
          <Status label="Aceptaron" value={String(dashboard.accepted)} />
          <Status label="Rechazaron" value={String(dashboard.rejected)} />
          <Status label="Pendientes" value={String(dashboard.pending)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="panel p-4">
          <h3 className="text-lg font-extrabold">Conversaciones</h3>
          <p className="mb-3 text-sm text-slate-600">Busque por cliente, telefono u orden.</p>
          <input className="field mb-3" placeholder="Buscar por cliente, telefono u orden" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="field mb-3" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
            <option value="ALL">Todos los canales</option>
            {channelOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              ['ALL', 'Todos'],
              ['RESPONDED', 'Respondidos'],
              ['ACCEPTED', 'Aceptados'],
              ['REJECTED', 'Rechazados'],
              ['PENDING', 'Pendientes'],
            ].map(([value, label]) => (
              <button key={value} className={`btn ${filter === value ? 'btn-primary' : 'btn-secondary'} px-3 py-2 text-xs`} onClick={() => setFilter(value as typeof filter)}>
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredConversations.length ? filteredConversations.map((conversation) => {
              const latest = conversation.items[conversation.items.length - 1]
              return (
                <button key={conversation.phoneDigits} className={`w-full rounded-md border p-3 text-left ${conversation.phoneDigits === selectedPhone ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white'}`} onClick={() => setSelectedPhone(conversation.phoneDigits)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-900">{conversation.displayName}</p>
                    <span className="text-xs font-semibold text-slate-500">{new Date(conversation.lastMessageAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-500">{formatPhoneForDisplay(conversation.phone)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">{conversation.channelLabel}</p>
                  {conversation.order && <p className="mt-1 text-xs font-semibold text-teal-700">{conversation.order.orderCode} · {conversation.order.status}</p>}
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{latest.message || 'Sin texto'}</p>
                </button>
              )
            }) : <p className="text-sm text-slate-600">No hay conversaciones para ese filtro.</p>}
          </div>
        </div>

        <div className="panel p-4">
          {selectedConversation ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-lg font-extrabold">{selectedConversation.displayName}</h3>
                  <p className="text-sm text-slate-600">{formatPhoneForDisplay(selectedConversation.phone)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Canal: {selectedConversation.channelLabel}</p>
                  {selectedConversation.order && <p className="mt-1 text-sm font-semibold text-teal-700">Orden vinculada: {selectedConversation.order.orderCode} · {selectedConversation.order.status}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedConversation.order && (
                    <button className="btn btn-secondary" onClick={() => openWhatsappDraft(buildOrderWhatsappDraft({ id: selectedConversation.order!.id, orderCode: selectedConversation.order!.orderCode, trackingToken: selectedConversation.order!.trackingToken, client: selectedConversation.order!.client }), onDraft, onMessage)}>
                      <FileText className="h-4 w-4" />
                      Reenviar rastreo
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => setConversationDraft(`Hola ${selectedConversation.client?.firstName || selectedConversation.displayName}, le saluda el taller. ¿En que podemos apoyarle?`)}>
                    <Plus className="h-4 w-4" />
                    Plantilla base
                  </button>
                </div>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {selectedConversation.items.map((item) => {
                  const inbound = item.template === 'incoming_message'
                  return (
                    <div key={item.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${inbound ? 'bg-slate-100 text-slate-800' : 'bg-teal-700 text-white'}`}>
                        <p className="whitespace-pre-wrap">{item.message || 'Sin texto'}</p>
                        <p className={`mt-2 text-[11px] ${inbound ? 'text-slate-500' : 'text-teal-100'}`}>{new Date(item.sentAt).toLocaleString()} · {describeWhatsappEvent(item)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-bold text-slate-700">Responder desde este panel</p>
                <textarea className="field min-h-[120px]" placeholder="Escriba aqui el mensaje para el cliente" value={conversationDraft} onChange={(e) => setConversationDraft(e.target.value)} />
                <div className="mt-3 flex flex-wrap justify-between gap-2">
                  <p className="text-xs text-slate-500">El envio sigue pasando por la vista previa para mantener control interno.</p>
                  <button className="btn btn-primary" onClick={openConversationDraft}>
                    <Send className="h-4 w-4" />
                    Preparar envio
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center text-center text-sm text-slate-600">
              Seleccione una conversacion del panel izquierdo para revisar el hilo.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TrackingPage({ orderCode, token }: { orderCode: string; token: string }) {
  const [data, setData] = useState<any>()
  const [error, setError] = useState('')
  const load = () => axios.get(`${API_URL}/public/tracking/${orderCode}?token=${token}`).then((r) => setData(r.data)).catch(() => setError('No se encontro la orden o el token no es valido.'))
  useEffect(() => { load() }, [orderCode, token])
  const decideQuote = async (approved: boolean) => {
    try {
      await axios.patch(`${API_URL}/public/tracking/${orderCode}/quote-decision?token=${token}`, {
        approved,
        customerName: 'Cliente por rastreo publico',
      })
      setError('')
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  const canDecide = data?.quotes?.length > 0 && data?.quoteApproved == null && ['PRESUPUESTO_ENVIADO', 'EN_REVISION', 'ESPERANDO_PRESUPUESTO'].includes(data?.status)
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="panel p-5">
        <p className="text-sm font-bold uppercase text-teal-700">Rastreo publico</p>
        <h1 className="text-2xl font-extrabold">{orderCode}</h1>
        {error && <p className="mt-4 font-semibold text-red-700">{error}</p>}
        {data && (
          <div className="mt-4 space-y-4">
            <span className="status-pill">{data.status}</span>
            <p>{data.equipment.equipmentType.name} {data.equipment.brand} {data.equipment.model}</p>
            <p className="text-sm text-slate-700">{data.reportedIssue}</p>
            <div className="rounded-md border border-slate-200 p-3">
              <h2 className="mb-2 text-lg font-extrabold">Presupuesto</h2>
              {data.quotes?.length ? (
                <div className="space-y-2">
                  {data.quotes.map((item: any) => (
                    <div key={item.id} className="flex flex-wrap justify-between gap-2 text-sm">
                      <span>{item.description} ({item.type}) x {Number(item.quantity).toFixed(0)}</span>
                      <span className="font-bold">Q {Number(item.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                  <p className="pt-2 font-extrabold">Total Q {Number(data.totalCost).toFixed(2)}</p>
                  {canDecide && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button className="btn btn-primary" onClick={() => decideQuote(true)}>Aceptar presupuesto</button>
                      <button className="btn btn-secondary" onClick={() => decideQuote(false)}>Rechazar presupuesto</button>
                    </div>
                  )}
                  {data.quoteApproved === true && <p className="font-semibold text-teal-700">Presupuesto aceptado.</p>}
                  {data.quoteApproved === false && <p className="font-semibold text-red-700">Presupuesto rechazado.</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-600">El taller aun no ha registrado presupuesto.</p>
              )}
            </div>
            <div className="space-y-2">
              {data.history.map((item: any) => (
                <div key={`${item.newStatus}-${item.changedAt}`} className="rounded-md border border-slate-200 p-3">
                  <p className="font-bold">{item.newStatus}</p>
                  <p className="text-sm text-slate-600">{new Date(item.changedAt).toLocaleString()}</p>
                  {item.comment && <p className="text-sm">{item.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function CrudLayout({
  title,
  icon,
  children,
  onSubmit,
  submitLabel = 'Guardar',
  onCancel,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  onSubmit: (e: React.FormEvent) => void
  submitLabel?: string
  onCancel?: () => void
}) {
  return (
    <div className="panel p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">{icon}{title}</h2>
      <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-2">
        {children}
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <button className="btn btn-primary flex-1"><Plus className="h-4 w-4" />{submitLabel}</button>
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              <X className="h-4 w-4" />
              Cancelar edicion
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return <div className="md:col-span-2 mt-3 space-y-2">{children}</div>
}

function Row({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3">
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      {actions}
    </div>
  )
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 p-3"><p className="text-sm font-bold text-slate-500">{label}</p><p className="text-xl font-extrabold">{value}</p></div>
}

function WhatsappPreviewModal({ api, draft, onClose, onMessage }: { api: ReturnType<typeof useApi>; draft: WhatsappDraft; onClose: () => void; onMessage: (m: string) => void }) {
  const [sending, setSending] = useState(false)

  const openInOfficialWeb = () => {
    const url = `https://wa.me/${draft.phone}?text=${encodeURIComponent(draft.message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    onMessage('Vista previa aprobada. El mensaje se abrio en WhatsApp Web para envio manual.')
    onClose()
  }

  const sendLinked = async () => {
    try {
      setSending(true)
      const { data } = await api.post('/whatsapp/send', { orderId: draft.orderId, phone: draft.phone, message: draft.message })
      onMessage(data.deliveryStatus === 'SENT' ? 'Mensaje enviado desde la sesion vinculada de WhatsApp.' : 'La sesion vinculada no estaba lista. El intento quedo auditado para seguimiento interno.')
      onClose()
    } catch (error) {
      onMessage(errorMessage(error))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase text-teal-700">Vista previa obligatoria</p>
            <h2 className="text-xl font-extrabold text-slate-950">{draft.title}</h2>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            <X className="h-4 w-4" />
            Cerrar
          </button>
        </div>
        <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <p><span className="font-bold">Destino:</span> {draft.phone}</p>
        </div>
        <textarea className="field min-h-56 w-full" value={draft.message} readOnly />
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={sendLinked} disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? 'Enviando...' : 'Enviar por sesion vinculada'}
          </button>
          <button className="btn btn-secondary" onClick={openInOfficialWeb}>
            <MessageCircle className="h-4 w-4" />
            Abrir en WhatsApp Web
          </button>
        </div>
      </div>
    </div>
  )
}

function clean<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== '' && value !== undefined)) as Partial<T>
}

function normalizeText(value: string) {
  return value.trim().toLocaleUpperCase('es-GT')
}

function normalizePayload<T>(value: T): T {
  if (typeof value === 'string') return normalizeText(value) as T
  if (Array.isArray(value)) return value.map((item) => normalizePayload(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'unlockCredentialValue' ? item : normalizePayload(item)])) as T
  }
  return value
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message.join(', ')
    return message ?? error.message
  }
  return 'No se pudo completar la accion solicitada'
}

function openWhatsappDraft(result: { draft?: WhatsappDraft; notice?: string }, onDraft: (draft: WhatsappDraft) => void, onMessage: (m: string) => void) {
  if (result.notice) onMessage(result.notice)
  if (result.draft) onDraft(result.draft)
}

function buildManualWhatsappDraft(phone: string, message: string) {
  const normalizedPhone = normalizeWhatsappPhone(phone)
  if (!normalizedPhone || !message.trim()) {
    return { notice: 'Ingrese telefono y mensaje antes de preparar la vista previa.' }
  }
  return { draft: { phone: normalizedPhone, message: message.trim(), title: 'Mensaje manual de WhatsApp' } }
}

function buildOrderWhatsappDraft(order: Pick<Order, 'id' | 'orderCode' | 'trackingToken' | 'client'>) {
  const digits = order.client.phone?.replace(/\D/g, '') ?? ''
  const trackingUrl = buildTrackingUrl(order.orderCode, order.trackingToken)
  if (!digits || order.client.phone.toLowerCase().includes('sin telefono')) {
    return { notice: 'El cliente no dejo telefono disponible. Entregue el ticket impreso con el codigo QR para que pueda consultar su orden.' }
  }
  const phone = normalizeWhatsappPhone(order.client.phone)
  const text = `🔧📦 Estimado/a ${order.client.firstName}:\n\nSu equipo ha sido recibido exitosamente en nuestro taller con el numero de orden:\n🧾 ${order.orderCode}\n\n🌐 Puede consultar el estado de su reparacion y revisar futuras actualizaciones en el siguiente enlace:\n🔗 ${trackingUrl}\n\n🙏 Gracias por confiar en nosotros.\n🛠️ Estamos para servirle y atentos a cualquier consulta.`
  return { draft: { orderId: order.id, phone, message: text, title: `Seguimiento ${order.orderCode}` } }
}

function buildBudgetWhatsappDraft(order: Pick<Order, 'id' | 'orderCode' | 'trackingToken' | 'client'>, diagnosis: string, totalCost?: number) {
  const digits = order.client.phone?.replace(/\D/g, '') ?? ''
  const trackingUrl = buildTrackingUrl(order.orderCode, order.trackingToken)
  if (!digits || order.client.phone.toLowerCase().includes('sin telefono')) {
    return { notice: 'El cliente no tiene telefono registrado. El diagnostico queda disponible en el codigo QR del ticket.' }
  }
  const phone = normalizeWhatsappPhone(order.client.phone)
  const diagnosisBlock = diagnosis.trim() ? `🛠️ Diagnostico tecnico:\n${diagnosis.trim()}\n\n` : ''
  const totalBlock = totalCost && totalCost > 0 ? `💰 Presupuesto estimado: Q ${totalCost.toFixed(2)}\n\n` : ''
  const text = `📋🔧 Estimado/a ${order.client.firstName}:\n\nYa tenemos listo el presupuesto de su equipo correspondiente a la orden:\n🧾 ${order.orderCode}\n\n${diagnosisBlock}${totalBlock}🌐 Puede revisar el detalle completo y autorizar el servicio en el siguiente enlace:\n🔗 ${trackingUrl}\n\n💬 Puede responder directamente por este medio con alguna de estas opciones:\n\n✅ SI ACEPTO ${order.orderCode}\n→ Para autorizar la reparacion.\n\n❌ NO ACEPTO ${order.orderCode}\n→ Si desea retirar su equipo sin reparar.\n\n⏳ Si necesita apoyo adicional, con gusto le orientamos.\n🙏 Gracias por confiar en nosotros.`
  return { draft: { orderId: order.id, phone, message: text, title: `Presupuesto ${order.orderCode}` } }
}

function buildReadyWhatsappDraft(order: Pick<Order, 'id' | 'orderCode' | 'trackingToken' | 'client'>) {
  const digits = order.client.phone?.replace(/\D/g, '') ?? ''
  const trackingUrl = buildTrackingUrl(order.orderCode, order.trackingToken)
  if (!digits || order.client.phone.toLowerCase().includes('sin telefono')) {
    return { notice: 'El cliente no tiene telefono registrado. Notifiquele personalmente o por otro medio cuando venga a recoger.' }
  }
  const phone = normalizeWhatsappPhone(order.client.phone)
  const text = `✅📦 Estimado/a ${order.client.firstName}:\n\nNos complace informarle que su equipo correspondiente a la orden:\n🧾 ${order.orderCode}\n\nya se encuentra listo para ser retirado en nuestro taller.\n\n🌐 Puede verificar el estado de su orden aqui:\n🔗 ${trackingUrl}\n\n🙏 Gracias por su preferencia.\n🛠️ Le esperamos en nuestro horario de atencion.`
  return { draft: { orderId: order.id, phone, message: text, title: `Equipo listo ${order.orderCode}` } }
}

function normalizeWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  return digits.length === 8 ? `502${digits}` : digits
}

function resolveTrackingRoute() {
  const pathMatch = location.pathname.match(/^\/rastreo\/([^/]+)/)
  if (pathMatch) {
    return {
      orderCode: decodeURIComponent(pathMatch[1]),
      token: new URLSearchParams(location.search).get('token') ?? '',
    }
  }

  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
  const [hashPath, hashQuery = ''] = hash.split('?')
  const hashMatch = hashPath.match(/^\/rastreo\/([^/]+)/)
  if (!hashMatch) return null

  return {
    orderCode: decodeURIComponent(hashMatch[1]),
    token: new URLSearchParams(hashQuery).get('token') ?? '',
  }
}

function buildTrackingUrl(orderCode: string, trackingToken: string) {
  const baseUrl = PUBLIC_FRONTEND_URL.endsWith('/') ? PUBLIC_FRONTEND_URL.slice(0, -1) : PUBLIC_FRONTEND_URL
  return `${baseUrl}/#/rastreo/${encodeURIComponent(orderCode)}?token=${encodeURIComponent(trackingToken)}`
}

function normalizePhoneForMatching(phone?: string) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  return digits.length > 8 ? digits.slice(-8) : digits
}

function formatPhoneForDisplay(phone?: string) {
  if (!phone) return 'Sin telefono'
  return phone.startsWith('+') ? phone : `+${phone.replace(/[^\d]/g, '') || phone}`
}

function describeWhatsappEvent(item: IncomingWhatsappMessage) {
  if (item.template === 'incoming_message') return 'Mensaje recibido'
  if (item.deliveryStatus === 'SENT') return item.order?.orderCode ? `Enviado · ${item.order.orderCode}` : 'Enviado'
  if (item.deliveryStatus === 'PENDING') return 'Pendiente por sesion'
  if (item.deliveryStatus === 'FAILED') return 'Envio fallido'
  return item.deliveryStatus
}

export default App
