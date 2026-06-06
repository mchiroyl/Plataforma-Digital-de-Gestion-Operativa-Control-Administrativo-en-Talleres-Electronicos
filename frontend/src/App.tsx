import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Briefcase,
  CheckCheck,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  MessageCircle,
  MonitorSmartphone,
  Package,
  Pencil,
  Plus,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'


const API_URL = import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:3000/api`
const PUBLIC_FRONTEND_URL = import.meta.env.VITE_PUBLIC_FRONTEND_URL ?? location.origin
const PROJECT_TITLE = 'Plataforma Digital de Gestion Operativa para el Fortalecimiento del Control Administrativo en Talleres Electronicos'
const SYSTEM_NAME = 'Sistema de Servicio Técnico'
const WHATSAPP_CHANNELS = [
  { key: 'ORDERS', label: 'Canal ordenes', description: 'Ordenes, rastreo y presupuestos' },
  { key: 'SALES_SUPPORT', label: 'Ventas y atencion', description: 'Ventas, repuestos y consultas de clientes' },
]
const SERVICE_LINES = [
  { key: 'TELEFONIA', label: 'TELEFONIA', description: 'Telefonos Android, iPhone y celulares multimarcas' },
  { key: 'EQUIPOS_GENERALES', label: 'EQUIPOS GENERALES', description: 'Televisores, sonido, planchas, licuadoras, DVD y electrodomesticos' },
  { key: 'EQUIPOS_DE_COMPUTO', label: 'EQUIPOS DE COMPUTO', description: 'Laptops, computadoras, impresoras, teclados, mouse y perifericos' },
] as const
const ROLE_MODULES = {
  ADMIN: ['dashboard', 'orders', 'clients', 'equipment', 'inventory', 'sales', 'whatsapp', 'expenses', 'settings'],
  RECEPCIONISTA: ['dashboard', 'orders', 'clients', 'equipment', 'inventory', 'sales', 'whatsapp'],
  TECNICO: ['dashboard', 'orders', 'inventory', 'whatsapp'],
} as const
const NAV_ITEMS = [
  ['dashboard', Activity, 'Tablero'],
  ['orders', Wrench, 'Ordenes'],
  ['clients', UserRound, 'Clientes'],
  ['equipment', MonitorSmartphone, 'Equipos'],
  ['inventory', Boxes, 'Inventario'],
  ['sales', CreditCard, 'Ventas'],
  ['whatsapp', MessageCircle, 'WhatsApp'],
  ['expenses', DollarSign, 'Gastos'],
  ['settings', Settings, 'Ajustes'],
] as const

type Session = {
  accessToken: string
  user: { id: number; username: string; fullName: string; role: string }
}

type RoleName = keyof typeof ROLE_MODULES
type TabId = typeof NAV_ITEMS[number][0]
type Client = { id: number; firstName: string; lastName: string; phone: string; dpi?: string; nit?: string }
type ServiceLineKey = typeof SERVICE_LINES[number]['key']
type EquipmentType = { id: number; name: string; serviceLine: ServiceLineKey; requiresCredential: boolean; allowsUnlockCase: boolean; isActive?: boolean }
type EquipmentOrderSummary = { orderCode: string; status: string; reportedIssue: string; createdAt: string }
type Equipment = { id: number; clientId: number; equipmentTypeId?: number; brand: string; model: string; serialNumber?: string; color?: string; physicalDescription?: string; accessories?: string; createdAt?: string; equipmentType: EquipmentType; client?: Client; lastOrder?: EquipmentOrderSummary | null }
type FaultType = { id: number; name: string; requiresCredential: boolean; category: { name: string }; equipmentType?: EquipmentType }
type Technician = { id: number; code: string; firstName: string; lastName: string; specialty?: string }
type SparePart = { id: number; internalCode: string; name: string; category: string; brand?: string; model?: string; publicSalePrice: string; purchasePrice: string; currentStock: number; minimumStock: number }
type InventorySale = { id: number; saleCode: string; totalAmount: string; paymentMethod: string; createdAt: string; client: Client; items: { id: number; quantity: number; unitPrice: string; subtotal: string; sparePart: SparePart }[] }
type UserAccount = { id: number; username: string; email: string; fullName: string; isActive: boolean; role: { name: string }; createdAt: string }
type Expense = { id: number; spentAt: string; category: string; description: string; amount: string; paymentMethod: string; responsible: string; notes?: string; registeredBy?: { fullName: string } }
type Evidence = { id: number; evidenceType: string; description?: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string; uploadedBy?: { fullName: string } }
type ShopSettings = {
  id: number
  projectTitle?: string
  shopName: string
  slogan?: string | null
  logoUrl?: string | null
  hasLogo?: boolean
  logoUpdatedAt?: string | null
  phone: string
  whatsapp: string
  address?: string | null
  contactEmail?: string | null
  defaultWarrantyDays?: number
  termsText?: string | null
  privacyText?: string | null
  currency?: string
  ticketFormat?: string
  updatedAt?: string
}
type WhatsappDraft = { orderId?: number; phone: string; message: string; title: string; channelKey?: string }
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
type WhatsappChannelStatus = WhatsappStatusResponse & { key: string; label: string; clientId?: string; quoteAutomation?: boolean }
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
  apiResponse?: { pushName?: string | null; direction?: string | null; channelKey?: string | null; channelLabel?: string | null; reason?: string | null; decision?: string | null; orderCode?: string | null }
  order?: WhatsappMessageOrderSummary | null
}
type WhatsappConversation = {
  conversationKey: string
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
  createdAt?: string
  status: string
  reportedIssue: string
  additionalFaultDetail?: string
  diagnosis?: string
  unlockCredentialType?: string
  unlockCredentialValue?: string
  unlockCredentialNotes?: string
  totalCost: string
  quoteApproved?: boolean | null
  approvalMethod?: string | null
  approvedAt?: string | null
  client: Client
  equipment: Equipment
  technician?: Technician
  technicianId?: number
  faults?: { faultType: FaultType }[]
  quotes?: { id: number; description: string; type: string; quantity: string; unitPrice: string; subtotal: string; sparePartId?: number; sparePart?: SparePart }[]
  payments: { id: number; amount: string; paymentMethod: string; paymentType?: string; createdAt: string }[]
  evidences?: Evidence[]
  history?: { previousStatus?: string | null; newStatus: string; comment?: string | null; changedAt: string }[]
}
type OrderHistoryEvent = NonNullable<Order['history']>[number]

type DashboardPayload = {
  ordersByStatus?: { status: string; _count: { id: number } }[]
  activeClients?: number
  activeTechnicians?: number
  lowStockParts?: number
  totalIncome?: number
  totalOrders?: number
  period?: { key: string; from: string; to: string }
  financial?: {
    orderPaymentsRevenue: number
    inventorySalesRevenue: number
    inventorySalesCost: number
    orderSparePartsCost: number
    expensesTotal: number
    grossProfit: number
    netProfit: number
    inventoryInvestment: number
    inventoryPotentialSaleValue: number
    inventoryPotentialProfit: number
    capitalRecovered: number
  }
  timeSeries?: { label: string; orderPaymentsRevenue: number; inventorySalesRevenue: number; expensesTotal: number; netProfit: number }[]
  expenseCategories?: { name: string; amount: number }[]
  salesCategories?: { name: string; amount: number }[]
  topSellingParts?: { name: string; amount: number }[]
  lowStockItems?: { id: number; internalCode: string; name: string; currentStock: number; minimumStock: number }[]
  quoteAcceptanceRate?: number
  avgRepairDays?: number
  serviceLines?: { name: string; amount: number }[]
  topBrands?: { name: string; amount: number }[]
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

function normalizeRole(role?: string): RoleName {
  return role === 'ADMIN' || role === 'RECEPCIONISTA' || role === 'TECNICO' ? role : 'TECNICO'
}

function canAccessModule(role: string, module: string) {
  return (ROLE_MODULES[normalizeRole(role)] as readonly string[]).includes(module)
}

function publicBackendUrl(path?: string | null, version?: string | null) {
  if (!path) return ''
  const url = path.startsWith('http') ? path : `${API_URL.replace(/\/api$/, '')}${path}`
  return version ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}` : url
}

function normalizeDisplayText(value?: string | null) {
  return (value ?? '').trim().toLocaleUpperCase('es-GT')
}

function shopDisplayName(settings?: ShopSettings | null) {
  const name = settings?.shopName?.trim()
  return name && normalizeDisplayText(name) !== normalizeDisplayText(PROJECT_TITLE) ? name : 'Sistema de Servicio Tecnico'
}

function App() {
  const trackingRoute = resolveTrackingRoute()
  if (trackingRoute) return <TrackingPage orderCode={trackingRoute.orderCode} token={trackingRoute.token} />

  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem('session')
    return raw ? JSON.parse(raw) : null
  })
  const [tab, setTab] = useState<TabId>('dashboard')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<WhatsappDraft | null>(null)
  const [settings, setSettings] = useState<ShopSettings | null>(null)

  const logout = () => {
    localStorage.removeItem('session')
    setSession(null)
  }

  const api = useApi(session, logout)
  useEffect(() => {
    axios.get(`${API_URL}/public/settings`).then((response) => {
      const data = response.data as ShopSettings
      setSettings(data)
      // Actualizar el símbolo de moneda global según la configuración del sistema
      if (data?.currency) setCurrencySymbol(data.currency === 'GTQ' ? 'Q' : data.currency)
    }).catch(() => null)
  }, [])

  if (!session) return <Login onLogin={setSession} />
  const currentRole = normalizeRole(session.user.role)
  const visibleNavItems = NAV_ITEMS.filter(([id]) => canAccessModule(currentRole, id))
  const currentTab = canAccessModule(currentRole, tab) ? tab : 'dashboard'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="flex items-center gap-3">
              {settings?.hasLogo && <img className="header-logo" src={publicBackendUrl(settings.logoUrl, settings.logoUpdatedAt ?? settings.updatedAt)} alt="Logotipo del taller" />}
              <div>
                <p className="text-xs font-bold uppercase text-teal-700">{shopDisplayName(settings)}</p>
                <h1 className="text-lg font-extrabold text-slate-900">{SYSTEM_NAME}</h1>
              </div>
            </div>
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
          {visibleNavItems.map(([id, Icon, label]) => (
            <button
              key={String(id)}
              className={`btn nav-button w-full justify-start ${currentTab === id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(id)}
            >
              <Icon className="h-4 w-4" />
              {String(label)}
            </button>
          ))}
        </nav>

        <section className="space-y-4">
          {message && <div className="panel border-teal-300 bg-teal-50 p-3 text-sm font-semibold text-teal-900">{message}</div>}
          {tab !== currentTab && <AccessDenied role={currentRole} />}
          {currentTab === 'dashboard' && <Dashboard api={api} currentRole={currentRole} />}
          {currentTab === 'orders' && <Orders api={api} onMessage={setMessage} onDraft={setDraft} currentRole={currentRole} currentUser={session.user} />}
          {currentTab === 'clients' && <Clients api={api} onMessage={setMessage} />}
          {currentTab === 'equipment' && <EquipmentPanel api={api} onMessage={setMessage} currentRole={currentRole} />}
          {currentTab === 'inventory' && <Inventory api={api} onMessage={setMessage} currentRole={currentRole} />}
          {currentTab === 'sales' && <Sales api={api} onMessage={setMessage} />}
          {currentTab === 'whatsapp' && <Whatsapp api={api} onMessage={setMessage} onDraft={setDraft} currentRole={currentRole} />}
          {currentTab === 'expenses' && <Expenses api={api} onMessage={setMessage} />}
          {currentTab === 'settings' && <SystemSettingsPanel api={api} onMessage={setMessage} />}
        </section>
      </main>
      {draft && <WhatsappPreviewModal api={api} draft={draft} onClose={() => setDraft(null)} onMessage={setMessage} />}
    </div>
  )
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<ShopSettings | null>(null)

  useEffect(() => {
    axios.get(`${API_URL}/public/settings`).then((response) => setSettings(response.data)).catch(() => null)
  }, [])

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
    <main className="login-screen">
      <form onSubmit={submit} className="login-card">
        <div className="mb-6 text-center">
          {settings?.hasLogo && <img className="login-logo" src={publicBackendUrl(settings.logoUrl, settings.logoUpdatedAt ?? settings.updatedAt)} alt="Logotipo del taller" />}
          <p className="text-sm font-bold uppercase text-sky-700">Acceso del personal</p>
        </div>
        <label className="login-field">
          <UserRound className="h-5 w-5 text-slate-500" />
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" autoComplete="username" />
        </label>
        <label className="login-field">
          <KeyRound className="h-5 w-5 text-slate-500" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contrasena" autoComplete="current-password" />
        </label>
        {error && <p className="mb-3 text-sm font-semibold text-red-700">{error}</p>}
        <button className="btn btn-primary w-full">
          <ShieldCheck className="h-4 w-4" />
          Acceder
        </button>
      </form>
    </main>
  )
}

function AccessDenied({ role }: { role: string }) {
  return (
    <section className="panel p-4">
      <p className="text-xs font-extrabold uppercase text-teal-700">Acceso restringido</p>
      <h2 className="text-xl font-extrabold">Modulo no disponible para {role}</h2>
      <p className="mt-1 text-sm text-slate-600">El sistema oculto esa opcion porque no corresponde a las responsabilidades del rol actual.</p>
    </section>
  )
}

function Dashboard({ api, currentRole }: { api: ReturnType<typeof useApi>; currentRole: RoleName }) {
  const [dashboard, setDashboard] = useState<DashboardPayload>()
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })

  useEffect(() => {
    const params = new URLSearchParams({ period })
    if (period === 'custom') {
      if (customRange.from) params.set('from', customRange.from)
      if (customRange.to) params.set('to', customRange.to)
    }
    api.get(`/dashboard?${params.toString()}`)
      .then((response) => {
        setDashboard(response.data)
      })
      .catch(() => null)
  }, [api, period, customRange.from, customRange.to, currentRole])

  const statusRows = dashboard?.ordersByStatus?.map((row) => ({ status: row.status, count: row._count.id })) ?? []
  const statusTotal = statusRows.reduce((total, row) => total + row.count, 0)
  
  const financial = dashboard?.financial
  const totalIncome = Number(financial?.orderPaymentsRevenue ?? dashboard?.totalIncome ?? 0)
  const salesTotal = Number(financial?.inventorySalesRevenue ?? 0)
  const totalExpenses = Number(financial?.expensesTotal ?? 0)
  const netResult = Number(financial?.netProfit ?? totalIncome + salesTotal - totalExpenses)
  const lowStock = dashboard?.lowStockParts ?? 0
  
  const pendingQuotes = statusRows.filter((row) => ['PRESUPUESTO_ENVIADO', 'EN_REVISION', 'ESPERANDO_PRESUPUESTO'].includes(row.status)).reduce((total, row) => total + row.count, 0)
  const activeOrders = statusRows.filter((row) => !['FINALIZADO', 'PRESUPUESTO_RECHAZADO', 'DEVUELTO_SIN_REPARAR'].includes(row.status)).reduce((total, row) => total + row.count, 0)
  
  const adminDashboard = currentRole === 'ADMIN'
  const maxStatus = Math.max(...statusRows.map((row) => row.count), 1)
  const pipeline = ['CREADO', 'PRESUPUESTO_ENVIADO', 'PRESUPUESTO_ACEPTADO', 'EN_REPARACION', 'LISTO_PARA_RECOGER', 'FINALIZADO', 'PRESUPUESTO_RECHAZADO'].map((status) => ({
    status,
    count: statusRows.find((row) => row.status === status)?.count ?? 0,
  }))

  const kpis = [
    adminDashboard
      ? { label: 'Inversion en repuestos', value: moneyGTQ(financial?.inventoryInvestment), accent: '#0ea5e9', detail: 'Capital actualmente en stock', icon: <Package className="h-5 w-5" /> }
      : { label: 'Clientes activos', value: dashboard?.activeClients ?? 0, accent: '#10bde0', detail: 'Base actual de clientes', icon: <UserRound className="h-5 w-5" /> },
    adminDashboard
      ? { label: 'Capital recuperado', value: moneyGTQ(financial?.capitalRecovered), accent: '#14b8a6', detail: 'Costo de repuestos vendidos/usados', icon: <TrendingUp className="h-5 w-5" /> }
      : { label: 'Ordenes activas', value: activeOrders, accent: '#2f90c4', detail: 'Trabajo en proceso del taller', icon: <Activity className="h-5 w-5" /> },
    { label: 'Presupuestos pendientes', value: pendingQuotes, accent: '#f59e0b', detail: 'Decision pendiente del cliente', icon: <AlertTriangle className="h-5 w-5" /> },
    { label: adminDashboard ? 'Ganancia neta' : 'Ordenes totales', value: adminDashboard ? moneyGTQ(netResult) : statusTotal, accent: netResult >= 0 ? '#08ad63' : '#dc2626', detail: adminDashboard ? 'Ingresos menos costos y gastos' : 'Carga total histórica en taller', icon: netResult >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" /> },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Dashboard</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Órdenes activas</span>
          <span className="text-lg font-extrabold text-indigo-600">{activeOrders}</span>
        </div>
      </div>

      {adminDashboard && (
        <section className="dashboard-controls flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="period-tabs flex-1">
            {[
              ['day', 'Hoy'],
              ['week', 'Semana'],
              ['month', 'Mes'],
              ['year', 'Año'],
              ['custom', 'Personalizado'],
            ].map(([key, label]) => (
              <button key={key} type="button" className={`period-tab ${period === key ? 'active' : ''}`} onClick={() => setPeriod(key as typeof period)}>
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="custom-range flex gap-2">
              <input className="field py-1.5 text-sm" type="date" value={customRange.from} onChange={(event) => setCustomRange({ ...customRange, from: event.target.value })} />
              <input className="field py-1.5 text-sm" type="date" value={customRange.to} onChange={(event) => setCustomRange({ ...customRange, to: event.target.value })} />
            </div>
          )}
        </section>
      )}

      {/* KPI Cards Row */}
      <div className="grid gap-3 md:grid-cols-4">
        {kpis.map((card) => (
          <div key={card.label} className="executive-card" style={{ '--accent': card.accent } as CSSProperties & Record<string, string>}>
            <div className="kpi-icon">
              {card.icon}
            </div>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
            <div className="kpi-signal" />
          </div>
        ))}
      </div>

      {/* Clean Charts Layout */}
      <div className="dashboard-grid-modern">
        {/* Top Selling Parts */}
        <section className="chart-panel shadow-sm">
          <div className="chart-title">
            <h3>Top Repuestos</h3>
          </div>
          <div className="h-[280px] flex flex-col justify-center">
            <HorizontalBarChart rows={dashboard?.topSellingParts ?? []} />
          </div>
        </section>

        {/* Financial Trends */}
        {adminDashboard && (
          <section className="chart-panel shadow-sm col-span-1 md:col-span-2">
            <div className="chart-title">
              <h3>Ingresos, Gastos y Ganancia</h3>
              <span className="status-pill">{dashboard?.period?.from} - {dashboard?.period?.to}</span>
            </div>
            <div className="h-[280px] flex flex-col justify-center">
              <LineChart data={dashboard?.timeSeries ?? []} />
            </div>
          </section>
        )}

        {/* Ring Chart of Orders */}
        <section className="chart-panel shadow-sm">
          <div className="chart-title">
            <h3>Órdenes por Estado</h3>
            <span className="status-pill">{statusTotal} total</span>
          </div>
          <div className="h-[280px] flex flex-col justify-center">
            <RingChart rows={statusRows} />
          </div>
        </section>

        {/* Service Lines Demand */}
        <section className="chart-panel shadow-sm">
          <div className="chart-title">
            <h3>Líneas de Servicio</h3>
          </div>
          <div className="h-[280px] flex flex-col justify-center">
            <HorizontalBarChart rows={dashboard?.serviceLines?.map(l => ({ name: serviceLineLabel(l.name), amount: l.amount })) ?? []} />
          </div>
        </section>
      </div>
    </div>
  )
}

function HorizontalBarChart({ rows }: { rows: { name: string; amount: number }[] }) {
  const width = 500
  const padLeft = 140
  const padRight = 45
  const padTop = 15
  const padBottom = 15
  const barHeight = 22
  const gap = 14
  
  const chartRows = rows.filter((r) => r.amount > 0)
  const displayRows = chartRows.length ? chartRows.slice(0, 5) : [{ name: 'Sin datos', amount: 0 }]
  
  const height = padTop + padBottom + displayRows.length * barHeight + (displayRows.length - 1) * gap
  const max = Math.max(...displayRows.map((row) => row.amount), 1)

  const colors = ['#0ea5e9', '#08ad63', '#f59e0b', '#7c3aed', '#ec4899']

  return (
    <div className="horizontal-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafica de barras horizontal de repuestos mas vendidos">
        {displayRows.map((row, index) => {
          const y = padTop + index * (barHeight + gap)
          const barWidth = row.amount > 0 ? (row.amount / max) * (width - padLeft - padRight) : 0
          const barColor = colors[index % colors.length]
          return (
            <g key={row.name}>
              <text x={padLeft - 10} y={y + barHeight / 2 + 4} textAnchor="end" className="horizontal-label" fill="#475569" style={{ fontSize: '11px', fontWeight: 700 }}>
                {row.name.length > 20 ? `${row.name.slice(0, 18)}...` : row.name}
              </text>
              {row.amount > 0 ? (
                <rect x={padLeft} y={y} width={Math.max(barWidth, 6)} height={barHeight} rx="5" fill={barColor} />
              ) : (
                <text x={padLeft} y={y + barHeight / 2 + 4} fill="#94a3b8" style={{ fontSize: '11px', fontStyle: 'italic' }}>Sin ventas</text>
              )}
              {row.amount > 0 && (
                <text x={padLeft + barWidth + 8} y={y + barHeight / 2 + 4} textAnchor="start" className="horizontal-value" fill="#0f172a" style={{ fontSize: '11px', fontWeight: 900 }}>
                  {row.amount} uds
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function RingChart({ rows }: { rows: { status: string; count: number }[] }) {
  // Allow showing empty state properly if no rows
  if (rows.length === 0) return <div className="empty-chart text-center py-6 text-sm font-bold text-slate-400">No hay datos en este período.</div>

  const activeRows = rows.filter((row) => row.count > 0)
  const total = activeRows.reduce((sum, row) => sum + row.count, 0)

  let currentAngle = 0
  const segments = activeRows.map((row) => {
    const angle = (row.count / total) * 360
    const start = currentAngle
    currentAngle += angle
    const percentage = ((row.count / total) * 100).toFixed(0)
    return {
      status: row.status,
      count: row.count,
      percentage,
      start,
      end: currentAngle,
      color: statusColor(row.status)
    }
  })

  const conicGradient = segments.map((seg) => `${seg.color} ${seg.start}deg ${seg.end}deg`).join(', ') || 'transparent 0deg 360deg'

  return (
    <div className="ring-chart-layout w-full h-full flex items-center justify-center gap-6">
      <div className="ring-container relative w-36 h-36 flex-shrink-0">
        <div className="ring-pie absolute inset-0 rounded-full" style={{ background: total > 0 ? `conic-gradient(${conicGradient})` : '#e2e8f0' }}>
          <div className="ring-hole absolute inset-[12px] bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
            <strong className="text-2xl font-black text-slate-800 leading-none">{total}</strong>
            <span className="text-[10px] font-bold uppercase text-slate-400">Total</span>
          </div>
        </div>
      </div>
      <div className="ring-legend-list flex-1 max-h-48 overflow-y-auto pr-2 flex flex-col gap-2">
        {total === 0 ? (
          <p className="text-xs text-slate-400 text-center font-bold">Sin datos</p>
        ) : (
          segments.map((seg) => (
            <div key={seg.status} className="ring-legend-item flex items-center justify-between gap-2 border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: seg.color }} />
                <span className="text-[11px] font-extrabold text-slate-700 uppercase">{formatStatus(seg.status)}</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md">{seg.count} ({seg.percentage}%)</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function FinanceBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="finance-row">
      <div>
        <span>{label}</span>
        <strong>{moneyGTQ(value)}</strong>
      </div>
      <div className="finance-track">
        <div style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

export function FinancialColumnChart({ rows, max }: { rows: { label: string; value: number; color: string }[]; max: number }) {
  const width = 560
  const height = 260
  const padX = 34
  const padBottom = 54
  const padTop = 18
  const safeMax = Math.max(max, 1)
  const barGap = 14
  const barWidth = Math.max(34, (width - padX * 2 - barGap * Math.max(rows.length - 1, 0)) / Math.max(rows.length, 1))
  return (
    <div className="column-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafica de barras de ingresos costos gastos y ganancia">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = padTop + step * (height - padTop - padBottom)
          return <line key={step} x1={padX} x2={width - padX} y1={y} y2={y} className="chart-grid-line" />
        })}
        {rows.map((row, index) => {
          const value = Math.max(row.value, 0)
          const x = padX + index * (barWidth + barGap)
          const barHeight = (value / safeMax) * (height - padTop - padBottom)
          const y = height - padBottom - barHeight
          return (
            <g key={row.label}>
              <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, row.value === 0 ? 3 : 6)} rx="7" fill={row.color} />
              <text x={x + barWidth / 2} y={Math.max(12, y - 7)} textAnchor="middle" className="column-value">{moneyGTQ(row.value)}</text>
              <text x={x + barWidth / 2} y={height - 28} textAnchor="middle" className="column-label">
                {shortChartLabel(row.label)}
              </text>
              <text x={x + barWidth / 2} y={height - 12} textAnchor="middle" className="column-label-muted">
                {index + 1}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend compact">
        {rows.map((row) => <span key={row.label}><i style={{ background: row.color }} />{row.label}</span>)}
      </div>
    </div>
  )
}

function LineChart({ data }: { data: NonNullable<DashboardPayload['timeSeries']> }) {
  const width = 760
  const height = 230
  const pad = 24
  const chartData = data.length ? data : [{ label: 'Sin datos', orderPaymentsRevenue: 0, inventorySalesRevenue: 0, expensesTotal: 0, netProfit: 0 }]
  const max = Math.max(...chartData.flatMap((row) => [row.orderPaymentsRevenue + row.inventorySalesRevenue, row.expensesTotal, Math.abs(row.netProfit)]), 1)
  const point = (value: number, index: number) => {
    const x = pad + (chartData.length <= 1 ? (width - pad * 2) / 2 : (index / (chartData.length - 1)) * (width - pad * 2))
    const y = height - pad - 12 - (Math.max(value, 0) / max) * (height - pad * 2 - 24)
    return { x, y }
  }
  const line = (getter: (row: NonNullable<DashboardPayload['timeSeries']>[number]) => number) => chartData.map((row, index) => {
    const item = point(getter(row), index)
    return `${item.x},${item.y}`
  }).join(' ')

  return (
    <div className="line-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico de lineas de ingresos gastos y ganancia">
        <polyline points={line((row) => row.orderPaymentsRevenue + row.inventorySalesRevenue)} className="line-income" style={{ strokeWidth: 4, stroke: '#0284c7', fill: 'none' }} />
        <polyline points={line((row) => row.expensesTotal)} className="line-expense" style={{ strokeWidth: 4, stroke: '#dc2626', fill: 'none' }} />
        <polyline points={line((row) => Math.max(row.netProfit, 0))} className="line-profit" style={{ strokeWidth: 4, stroke: '#08ad63', fill: 'none' }} />
        {chartData.map((row, index) => {
          const income = point(row.orderPaymentsRevenue + row.inventorySalesRevenue, index)
          const expense = point(row.expensesTotal, index)
          const profit = point(Math.max(row.netProfit, 0), index)
          return (
            <g key={row.label}>
              <circle cx={income.x} cy={income.y} r="5" className="point-income" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
              <circle cx={expense.x} cy={expense.y} r="5" className="point-expense" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
              <circle cx={profit.x} cy={profit.y} r="5" className="point-profit" fill="#08ad63" stroke="#ffffff" strokeWidth="2" />
              <text x={income.x} y={height - 6} textAnchor="middle" className="chart-axis-label" fill="#64748b" style={{ fontSize: '10px', fontWeight: 800 }}>{row.label}</text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend" style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}><i style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />Ingresos</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}><i style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />Gastos</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#08ad63' }}><i style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: '#08ad63', display: 'inline-block' }} />Ganancia</span>
      </div>
    </div>
  )
}

export function RankedBars({ rows }: { rows: { name: string; amount: number }[] }) {
  const max = Math.max(...rows.map((row) => row.amount), 1)
  if (!rows.length) return <div className="empty-chart">Aun no hay ventas de inventario en este periodo.</div>
  return (
    <div className="ranked-bars">
      {rows.map((row) => (
        <div key={row.name} className="ranked-row">
          <div>
            <span>{row.name}</span>
            <strong>{row.amount}</strong>
          </div>
          <div className="finance-track"><div style={{ width: `${(row.amount / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

export function MiniDonut({ rows }: { rows: { name: string; amount: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const colors = ['#0ea5e9', '#14b8a6', '#f59e0b', '#dc2626', '#7c3aed']
  if (!total) return <div className="empty-chart">No hay gastos registrados para este periodo.</div>
  let start = 0
  const gradient = rows.map((row, index) => {
    const end = start + (row.amount / total) * 360
    const segment = `${colors[index % colors.length]} ${start}deg ${end}deg`
    start = end
    return segment
  }).join(', ')
  return (
    <div className="mini-donut-layout">
      <div className="mini-donut" style={{ background: `conic-gradient(${gradient})` }}><span>{moneyGTQ(total)}</span></div>
      <div className="mini-donut-list">
        {rows.slice(0, 5).map((row, index) => (
          <span key={row.name}><i style={{ background: colors[index % colors.length] }} />{row.name}: {moneyGTQ(row.amount)}</span>
        ))}
      </div>
    </div>
  )
}

export function ManagerAlert({ title, value, text, tone }: { title: string; value: number; text: string; tone: 'success' | 'warning' | 'danger' | 'info' }) {
  return (
    <section className={`manager-alert alert-${tone}`}>
      <p>{title}</p>
      <strong>{value}</strong>
      <span>{text}</span>
    </section>
  )
}

export function normalizeStatusRows(source: DashboardPayload['ordersByStatus'], orders: Order[]) {
  const rows = source?.map((row) => ({ status: row.status, count: row._count.id })) ?? []
  if (rows.length > 0) return rows
  const map = new Map<string, number>()
  orders.forEach((order) => map.set(order.status, (map.get(order.status) ?? 0) + 1))
  return Array.from(map.entries()).map(([status, count]) => ({ status, count }))
}

function Clients({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const emptyForm = { firstName: '', lastName: '', phone: '', dpi: '', nit: '' }
  const [items, setItems] = useState<Client[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [view, setView] = useState<'form' | 'list'>('form')
  const [searchTerm, setSearchTerm] = useState('')
  const load = () => api.get('/clients').then((r) => setItems(r.data))
  useEffect(() => { load() }, [])
  const filteredItems = items.filter((item) => {
    const query = searchTerm.trim().toLocaleUpperCase('es-GT')
    if (!query) return true
    return [formatClientName(item), item.phone, item.dpi, item.nit].filter(Boolean).join(' ').toLocaleUpperCase('es-GT').includes(query)
  })
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
    setView('form')
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  if (view === 'list') {
    return (
      <section className="panel space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase text-teal-700">Listado de clientes</p>
            <h2 className="flex items-center gap-2 text-2xl font-extrabold"><UserRound className="h-6 w-6" />Clientes registrados</h2>
            <p className="text-sm text-slate-600">Busque, revise o seleccione un cliente para editarlo.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setView('form')}><ArrowLeft className="h-4 w-4" />Volver al registro</button>
        </div>
        <div className="field flex items-center gap-2">
          <Search className="h-5 w-5 text-slate-500" />
          <input
            className="w-full border-0 bg-transparent outline-none"
            title="Busque por nombre, telefono, DPI o NIT"
            placeholder="Buscar cliente por nombre, telefono, DPI o NIT"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <List>
          {filteredItems.length ? filteredItems.map((item) => (
            <Row
              key={item.id}
              title={formatClientName(item)}
              subtitle={`${item.phone} | DPI: ${item.dpi ?? 'N/A'} | NIT: ${item.nit ?? 'N/A'}`}
              actions={<button type="button" className="btn btn-secondary" onClick={() => edit(item)}><Pencil className="h-4 w-4" />Editar</button>}
            />
          )) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">No hay clientes que coincidan con la busqueda.</div>
          )}
        </List>
      </section>
    )
  }
  return (
    <CrudLayout
      title={editingId ? 'Editar cliente' : 'Clientes'}
      icon={<UserRound />}
      onSubmit={submit}
      submitLabel={editingId ? 'Actualizar cliente' : 'Guardar cliente'}
      onCancel={editingId ? cancelEdit : undefined}
      headerAction={<button type="button" className="btn btn-secondary" onClick={() => setView('list')}><Search className="h-4 w-4" />Ver clientes</button>}
    >
      <input className="field" title="Ingrese los nombres del cliente" placeholder="Nombres del cliente, por ejemplo: Mario Alexander" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
      <input className="field" title="Ingrese los apellidos del cliente" placeholder="Apellidos del cliente, por ejemplo: Mejia Lopez" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
      <input className="field" title="Numero para avisos por WhatsApp; puede dejarlo vacio si el telefono del cliente es el equipo danado" placeholder="Telefono WhatsApp del cliente o familiar, opcional si no tiene disponible" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input className="field" title="Documento personal de identificacion, si aplica" placeholder="DPI del cliente, si lo proporciono" value={form.dpi} onChange={(e) => setForm({ ...form, dpi: e.target.value })} />
      <input className="field" title="NIT para facturacion, si aplica" placeholder="NIT para factura, si lo proporciono" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
    </CrudLayout>
  )
}

function SearchableClientSelect({
  clients,
  value,
  onChange,
  placeholder = 'Cliente propietario del equipo',
  required = false,
  disabled = false,
}: {
  clients: Client[]
  value: string
  onChange: (clientId: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
}) {
  const selectedClient = clients.find((client) => String(client.id) === value)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selectedClientName = selectedClient ? formatClientName(selectedClient) : ''
  const visibleText = selectedClient ? selectedClientName : query
  const normalizedQuery = query.trim().toLocaleUpperCase('es-GT')
  const filteredClients = clients.filter((client) => {
    if (!normalizedQuery) return true
    return [formatClientName(client), client.phone].join(' ').toLocaleUpperCase('es-GT').includes(normalizedQuery)
  })
  const selectClient = (client: Client) => {
    onChange(String(client.id))
    setQuery('')
    setOpen(false)
  }
  const clearSelection = () => {
    onChange('')
    setQuery('')
    setOpen(true)
  }

  return (
    <div className="relative">
      <div className="field flex items-center gap-2 p-0">
        <input
          className="w-full border-0 bg-transparent px-3 py-3 outline-none"
          placeholder={placeholder}
          value={visibleText}
          onFocus={() => {
            if (disabled) return
            setOpen(true)
            if (selectedClient) setQuery('')
          }}
          onChange={(event) => {
            if (disabled) return
            setQuery(event.target.value)
            onChange('')
            setOpen(true)
          }}
          required={required && !value}
          disabled={disabled}
        />
        {value && !disabled && (
          <button type="button" className="px-2 text-slate-500" onClick={clearSelection} title="Quitar cliente">
            <X className="h-4 w-4" />
          </button>
        )}
        <button type="button" className="px-3 text-slate-500" onClick={() => !disabled && setOpen(!open)} title="Buscar cliente" disabled={disabled}>
          <Search className="h-4 w-4" />
        </button>
      </div>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl">
          {filteredClients.length ? filteredClients.map((client) => (
            <button
              key={client.id}
              type="button"
              className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-sky-50"
              onClick={() => selectClient(client)}
            >
              <span className="block font-extrabold">{formatClientName(client)}</span>
              <span className="text-xs font-semibold text-slate-500">{formatPhoneForDisplay(client.phone)}</span>
            </button>
          )) : (
            <p className="px-3 py-3 text-sm font-semibold text-slate-500">No hay clientes con ese criterio.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ServiceLineSelect({
  value,
  onChange,
  placeholder = 'LINEA DE SERVICIO',
  required = false,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
}) {
  const selectedLine = SERVICE_LINES.find((line) => line.key === value)
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        className="field flex min-h-[3rem] items-center justify-between text-left"
        title={selectedLine?.description ?? placeholder}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
      >
        <span>{selectedLine?.label ?? placeholder}</span>
        <span className="text-slate-500">⌄</span>
      </button>
      <input className="sr-only" tabIndex={-1} value={value} onChange={() => null} required={required && !value} />
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-visible rounded-lg border border-slate-300 bg-white shadow-2xl">
          {SERVICE_LINES.map((line) => (
            <button
              key={line.key}
              type="button"
              className="block w-full px-4 py-2 text-left text-slate-950 hover:bg-blue-600 hover:text-white"
              title={line.description}
              onClick={() => {
                onChange(line.key)
                setOpen(false)
              }}
            >
              {line.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EquipmentPanel({ api, onMessage, currentRole }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void; currentRole: RoleName }) {
  const [clients, setClients] = useState<Client[]>([])
  const [types, setTypes] = useState<EquipmentType[]>([])
  const [items, setItems] = useState<Equipment[]>([])
  const emptyForm = { clientId: '', serviceLine: '', equipmentTypeId: '', brand: '', model: '', serialNumber: '', color: '', physicalDescription: '', accessories: '' }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchFilters, setSearchFilters] = useState({ clientId: '', brand: '', model: '', serialNumber: '', serviceLine: '', equipmentTypeId: '' })
  const load = () => Promise.all([api.get('/clients'), api.get('/equipment-types'), api.get('/equipment')]).then(([c, t, e]) => {
    setClients(c.data); setTypes(t.data); setItems(e.data)
  })
  useEffect(() => { load() }, [])
  const filteredTypes = types.filter((type) => !form.serviceLine || type.serviceLine === form.serviceLine)
  const searchTypes = types.filter((type) => !searchFilters.serviceLine || type.serviceLine === searchFilters.serviceLine)
  const canManageEquipment = ['ADMIN', 'RECEPCIONISTA'].includes(currentRole)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const payload = clean({ ...form, clientId: Number(form.clientId), equipmentTypeId: Number(form.equipmentTypeId) })
      delete payload.serviceLine
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
    setShowSearch(false)
    setForm({
      clientId: String(item.clientId),
      serviceLine: item.equipmentType?.serviceLine ?? '',
      equipmentTypeId: String(item.equipmentType?.id ?? item.equipmentTypeId ?? ''),
      brand: item.brand,
      model: item.model,
      serialNumber: item.serialNumber ?? '',
      color: item.color ?? '',
      physicalDescription: item.physicalDescription ?? '',
      accessories: item.accessories ?? '',
    })
  }
  const searchEquipment = async () => {
    const params = new URLSearchParams()
    Object.entries(searchFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    const { data } = await api.get(`/equipment${params.toString() ? `?${params}` : ''}`)
    setItems(data)
    setShowSearch(true)
  }
  const openEquipmentSearch = () => {
    setShowSearch(true)
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  const headerAction = (
    <button type="button" className="btn btn-secondary" onClick={openEquipmentSearch}>
      <Search className="h-4 w-4" />
      Ver equipos
    </button>
  )
  return (
    <CrudLayout
      title={editingId ? 'Editar equipo' : 'Equipos'}
      icon={<MonitorSmartphone />}
      onSubmit={submit}
      submitLabel={editingId ? 'Actualizar equipo' : 'Guardar equipo'}
      onCancel={editingId ? cancelEdit : undefined}
      headerAction={headerAction}
      submitClassName="w-full max-w-lg"
      hideSubmit={!canManageEquipment}
    >
      {!canManageEquipment && <div className="md:col-span-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-900">Modo consulta: el rol TECNICO puede revisar equipos, pero no registrar ni editar datos de recepcion.</div>}
      <SearchableClientSelect clients={clients} value={form.clientId} onChange={(clientId) => setForm({ ...form, clientId })} required disabled={!canManageEquipment} />
      <ServiceLineSelect value={form.serviceLine} onChange={(serviceLine) => setForm({ ...form, serviceLine, equipmentTypeId: '' })} required disabled={!canManageEquipment} />
      <select className="field" title="Seleccione el tipo configurado por el administrador" value={form.equipmentTypeId} onChange={(e) => setForm({ ...form, equipmentTypeId: e.target.value })} required disabled={!form.serviceLine || !canManageEquipment}>
        <option value="">Tipo de equipo recibido</option>
        {filteredTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input className="field" title="Marca comercial del equipo" placeholder="Marca del equipo, por ejemplo: Samsung" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required disabled={!canManageEquipment} />
      <input className="field" title="Modelo exacto o referencia del equipo" placeholder="Modelo del equipo, por ejemplo: SM-A336M" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required disabled={!canManageEquipment} />
      <input className="field" title="Serie, IMEI o identificador unico si esta disponible" placeholder="Serie o IMEI, si el equipo lo tiene visible" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} disabled={!canManageEquipment} />
      <input className="field" title="Color principal del equipo" placeholder="Color del equipo, por ejemplo: negro" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} disabled={!canManageEquipment} />
      <textarea className="field md:col-span-2" title="Estado fisico al recibirlo para evitar reclamos posteriores" placeholder="Estado fisico al recibirlo: golpes, rayones, pantalla rota, humedad, faltantes" value={form.physicalDescription} onChange={(e) => setForm({ ...form, physicalDescription: e.target.value })} disabled={!canManageEquipment} />
      <input className="field md:col-span-2" title="Cargador, cable, chip, memoria, funda u otros accesorios entregados" placeholder="Accesorios incluidos con el equipo, por ejemplo: cargador y funda" value={form.accessories} onChange={(e) => setForm({ ...form, accessories: e.target.value })} disabled={!canManageEquipment} />
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[88vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold uppercase text-teal-700">Historial por equipo</p>
                <h3 className="text-xl font-extrabold">Ver equipos</h3>
                <p className="text-sm text-slate-600">Use este panel para encontrar equipos existentes y evitar duplicados cuando un cliente vuelve al taller.</p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSearch(false)}><X className="h-4 w-4" />Cerrar</button>
            </div>
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <SearchableClientSelect clients={clients} value={searchFilters.clientId} onChange={(clientId) => setSearchFilters({ ...searchFilters, clientId })} placeholder="Buscar cliente por nombre o telefono" />
              <ServiceLineSelect value={searchFilters.serviceLine} onChange={(serviceLine) => setSearchFilters({ ...searchFilters, serviceLine, equipmentTypeId: '' })} placeholder="TODAS LAS LINEAS" />
              <select className="field" value={searchFilters.equipmentTypeId} onChange={(e) => setSearchFilters({ ...searchFilters, equipmentTypeId: e.target.value })}>
                <option value="">Todos los tipos</option>
                {searchTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
              <input className="field" placeholder="Marca" value={searchFilters.brand} onChange={(e) => setSearchFilters({ ...searchFilters, brand: e.target.value })} />
              <input className="field" placeholder="Modelo" value={searchFilters.model} onChange={(e) => setSearchFilters({ ...searchFilters, model: e.target.value })} />
              <input className="field" placeholder="Serie o IMEI" value={searchFilters.serialNumber} onChange={(e) => setSearchFilters({ ...searchFilters, serialNumber: e.target.value })} />
            </div>
            <button type="button" className="btn btn-primary mb-3" onClick={searchEquipment}><Search className="h-4 w-4" />Buscar</button>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-2">Cliente</th>
                    <th className="p-2">Linea</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Marca</th>
                    <th className="p-2">Modelo</th>
                    <th className="p-2">Serie/IMEI</th>
                    <th className="p-2">Fecha registro</th>
                    <th className="p-2">Ultima orden</th>
                    <th className="p-2">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="p-2">{item.client?.firstName ?? ''} {item.client?.lastName ?? ''}</td>
                      <td className="p-2">{serviceLineLabel(item.equipmentType?.serviceLine)}</td>
                      <td className="p-2">{item.equipmentType.name}</td>
                      <td className="p-2">{item.brand}</td>
                      <td className="p-2">{item.model}</td>
                      <td className="p-2">{item.serialNumber ?? 'Sin serie visible'}</td>
                      <td className="p-2">{formatDateTime(item.createdAt)}</td>
                      <td className="p-2">
                        {item.lastOrder ? (
                          <div>
                            <p className="font-extrabold">{item.lastOrder.orderCode}</p>
                            <p className="text-xs text-slate-600">{formatStatus(item.lastOrder.status)} - {item.lastOrder.reportedIssue}</p>
                          </div>
                        ) : (
                          <span className="text-slate-500">Sin orden registrada</span>
                        )}
                      </td>
                      <td className="p-2">{canManageEquipment ? <button type="button" className="btn btn-secondary" onClick={() => edit(item)}><Pencil className="h-4 w-4" />Editar</button> : <span className="text-xs font-bold text-slate-500">Solo consulta</span>}</td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td colSpan={9} className="p-4 text-center font-semibold text-slate-500">No hay equipos con esos filtros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </CrudLayout>
  )
}

function Orders({ api, onMessage, onDraft, currentRole, currentUser }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void; onDraft: (draft: WhatsappDraft) => void; currentRole: RoleName; currentUser: Session['user'] }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [techs, setTechs] = useState<Technician[]>([])
  const [spareParts, setSpareParts] = useState<SparePart[]>([])
  const emptyForm = { clientId: '', equipmentId: '', technicianId: '', reportedIssue: '', additionalFaultDetail: '', unlockCredentialType: '', unlockCredentialValue: '', unlockCredentialNotes: '', totalCost: 0 }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [ordersView, setOrdersView] = useState<'form' | 'list' | 'detail'>('form')
  const canManageOrderIntake = ['ADMIN', 'RECEPCIONISTA'].includes(currentRole)
  const canExportOrders = currentRole === 'ADMIN'
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const load = () => {
    if (!canManageOrderIntake) {
      return Promise.all([api.get('/orders'), api.get('/spare-parts')]).then(([o, s]) => {
        setOrders(o.data); setClients([]); setEquipment([]); setTechs([]); setSpareParts(s.data)
      })
    }
    return Promise.all([api.get('/orders'), api.get('/clients'), api.get('/equipment'), api.get('/technicians'), api.get('/spare-parts')]).then(([o, c, e, t, s]) => {
      setOrders(o.data); setClients(c.data); setEquipment(e.data); setTechs(t.data); setSpareParts(s.data)
    })
  }
  useEffect(() => { load() }, [currentRole])
  useEffect(() => {
    if (selectedOrderId && !orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(null)
      setOrdersView('list')
    }
  }, [orders, selectedOrderId])
  useEffect(() => {
    setSelectedOrderId(null)
    setEditingId(null)
    setForm(emptyForm)
    setOrdersView(canManageOrderIntake ? 'form' : 'list')
  }, [currentRole, canManageOrderIntake])
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
      setOrdersView('list')
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
    if (!canManageOrderIntake) return
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
    })
    setSelectedOrderId(null)
    setOrdersView('form')
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  const openOrderDetail = (orderId: number) => {
    setSelectedOrderId(orderId)
    setOrdersView('detail')
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  const showOrderList = () => {
    setEditingId(null)
    setForm(emptyForm)
    setSelectedOrderId(null)
    setOrdersView('list')
  }
  const showOrderForm = () => {
    setSelectedOrderId(null)
    setEditingId(null)
    setForm(emptyForm)
    setOrdersView('form')
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  const backToOrderList = () => {
    setSelectedOrderId(null)
    setOrdersView('list')
  }
  const exportServices = async (format: 'pdf' | 'excel') => {
    try {
      await downloadBlob(api, `/orders/export/${format}`, format === 'pdf' ? 'servicios.pdf' : 'servicios.xlsx')
      onMessage(format === 'pdf' ? 'Reporte PDF generado' : 'Reporte Excel generado')
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const selectedEquipment = equipment.find((item) => item.id === Number(form.equipmentId))
  const selectedEquipmentType = selectedEquipment?.equipmentType
  const credentialRequired = shouldRequestCredential(selectedEquipmentType)
  const credentialPlaceholder = form.unlockCredentialType === 'PATRON'
    ? 'PATRON EN NUMEROS, EJEMPLO: 1-2-3-6-9'
    : form.unlockCredentialType === 'CONTRASENA'
      ? 'CONTRASENA EXACTA, RESPETA MAYUSCULAS Y MINUSCULAS'
      : 'PIN O CLAVE EXACTA'
  return (
    <div className="space-y-4">
      {canManageOrderIntake && ordersView === 'form' ? (
        <CrudLayout
          title={editingId ? 'Editar orden' : 'Nueva orden'}
          icon={<Wrench />}
          onSubmit={submit}
          submitLabel={editingId ? 'Actualizar orden' : 'Guardar orden'}
          onCancel={editingId ? cancelEdit : undefined}
          headerAction={
            <button className="btn btn-secondary" type="button" onClick={showOrderList}>
              <Search className="h-4 w-4" />
              Ver ordenes
            </button>
          }
        >
          <select className="field" title="Seleccione el cliente que entrega el equipo al taller" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value, equipmentId: '' })} required>
            <option value="">Cliente que entrega el equipo</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
          <select className="field" title="Seleccione el equipo especifico que sera diagnosticado o reparado" value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })} required>
            <option value="">Equipo que ingresa a revision</option>
            {equipment.filter((e) => !form.clientId || e.clientId === Number(form.clientId)).map((e) => <option key={e.id} value={e.id}>{serviceLineLabel(e.equipmentType?.serviceLine)} - {e.equipmentType?.name} {e.brand} {e.model}</option>)}
          </select>
          {selectedEquipmentType && (
            <div className="md:col-span-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-900">
              Linea detectada: {serviceLineLabel(selectedEquipmentType.serviceLine)} | Tipo: {selectedEquipmentType.name}
            </div>
          )}
          <select className="field" title="Asignacion interna; puede dejarlo vacio si aun no sabe quien lo revisara" value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>
            <option value="">Tecnico asignado, opcional</option>
            {techs.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </select>
          {editingId && (
            <input className="field" type="number" min="0" step="0.01" title="Monto total presupuestado o acordado para esta orden" placeholder="Presupuesto total de la orden en Q" value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: Number(e.target.value) })} />
          )}
          <textarea className="field md:col-span-2" title="Describa con palabras del cliente el motivo del ingreso. Esto es el relato libre del cliente." placeholder="PROBLEMA REPORTADO POR EL CLIENTE, POR EJEMPLO: NO CARGA, PANTALLA QUEBRADA, SE APAGA SOLO" value={form.reportedIssue} onChange={(e) => setForm({ ...form, reportedIssue: e.target.value })} required />
          <input className="field md:col-span-2" title="Use este campo cuando la falla no exista en la lista de clasificacion" placeholder="FALLA ADICIONAL NO LISTADA, OPCIONAL" value={form.additionalFaultDetail} onChange={(e) => setForm({ ...form, additionalFaultDetail: e.target.value })} />
          {credentialRequired && (
            <div className="md:col-span-2 grid gap-2 rounded-md border border-teal-200 bg-teal-50 p-3 md:grid-cols-3">
              <select className="field" title="Seleccione el tipo de desbloqueo que dejo el cliente" value={form.unlockCredentialType} onChange={(e) => setForm({ ...form, unlockCredentialType: e.target.value })} required={credentialRequired}>
                <option value="" disabled>SELECCIONE TIPO DE CLAVE</option>
                <option value="PIN">PIN NUMERICO</option>
                <option value="CONTRASENA">CONTRASENA</option>
                <option value="PATRON">PATRON</option>
                {selectedEquipmentType?.allowsUnlockCase && <option value="CUENTA_GOOGLE">CUENTA GOOGLE / FRP</option>}
                {selectedEquipmentType?.allowsUnlockCase && <option value="PAYJOY">PAYJOY / FALTA DE PAGO</option>}
                {selectedEquipmentType?.allowsUnlockCase && <option value="REPORTE_ROBO">REPORTE DE ROBO</option>}
                <option value="NINGUNA">NO DEJO CLAVE</option>
              </select>
              <input className="field credential-value" title="Para patron use posiciones como teclado numerico: 1-2-3 arriba, 4-5-6 centro, 7-8-9 abajo. Para contrasena escriba exactamente mayusculas y minusculas." placeholder={credentialPlaceholder} value={form.unlockCredentialValue} onChange={(e) => setForm({ ...form, unlockCredentialValue: e.target.value })} />
              <input className="field" title="Notas utiles para el tecnico sobre el desbloqueo" placeholder="Notas de desbloqueo, opcional" value={form.unlockCredentialNotes} onChange={(e) => setForm({ ...form, unlockCredentialNotes: e.target.value })} />
            </div>
          )}
        </CrudLayout>
      ) : !canManageOrderIntake ? (
        <div className="panel p-4">
          <p className="text-xs font-bold uppercase text-teal-700">Trabajo tecnico</p>
          <h2 className="text-2xl font-extrabold">Ordenes asignadas</h2>
          <p className="text-sm text-slate-600">Usuario tecnico: {currentUser.fullName}. Esta vista solo muestra ordenes vinculadas a su usuario y oculta la creacion de ordenes de recepcion.</p>
        </div>
      ) : null}
      {ordersView === 'detail' && selectedOrder ? (
        <div className="space-y-4">
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs font-bold uppercase text-teal-700">{canManageOrderIntake ? 'Detalle de orden' : 'Detalle tecnico'}</p>
              <h2 className="text-xl font-extrabold">{selectedOrder.orderCode}</h2>
            </div>
            <button className="btn btn-secondary" type="button" onClick={backToOrderList}>
              <ArrowLeft className="h-4 w-4" />
              {canManageOrderIntake ? 'Volver a ordenes' : 'Volver a ordenes asignadas'}
            </button>
          </div>
          <OrderCard order={selectedOrder} spareParts={spareParts} api={api} onStatus={status} onMessage={onMessage} reload={load} onEdit={edit} onDraft={onDraft} currentRole={currentRole} />
        </div>
      ) : ordersView === 'list' ? (
        <div className="panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase text-teal-700">{canManageOrderIntake ? 'Gestion de ordenes' : 'Trabajo tecnico'}</p>
              <h2 className="text-lg font-extrabold">{canManageOrderIntake ? 'Ordenes creadas' : 'Ordenes asignadas'}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManageOrderIntake && (
                <button className="btn btn-primary" type="button" onClick={showOrderForm}>
                  <Plus className="h-4 w-4" />
                  Nueva orden
                </button>
              )}
              {canExportOrders && <>
                <button className="btn btn-secondary" type="button" onClick={() => exportServices('pdf')}><Download className="h-4 w-4" />PDF servicios</button>
                <button className="btn btn-secondary" type="button" onClick={() => exportServices('excel')}><Download className="h-4 w-4" />Excel servicios</button>
              </>}
            </div>
          </div>
          <div className="space-y-3">
            {orders.map((order) => (
              <AssignedOrderSummaryCard key={order.id} order={order} onOpen={() => openOrderDetail(order.id)} />
            ))}
            {!orders.length && <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">{canManageOrderIntake ? 'No hay ordenes creadas.' : 'No tiene ordenes asignadas en este momento.'}</div>}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AssignedOrderSummaryCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const totalCost = Number(order.totalCost)
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold">{order.orderCode}</h3>
            <span className={`status-pill ${statusClass(order.status)}`}>{formatStatus(order.status)}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{order.client.firstName} {order.client.lastName}</p>
          <p className="text-sm font-semibold text-slate-800">{order.equipment.equipmentType?.name} {order.equipment.brand} {order.equipment.model}</p>
          <p className="mt-2 text-sm">{order.reportedIssue}</p>
        </div>
        <div className="flex flex-col items-end gap-3 text-right">
          <p className="text-sm font-extrabold">Presupuesto Q {totalCost.toFixed(2)}</p>
          <button className="btn btn-primary" type="button" onClick={onOpen}>
            <FileText className="h-4 w-4" />
            Detalles
          </button>
        </div>
      </div>
    </article>
  )
}

function OrderTimeline({ order }: { order: Order }) {
  const events = sortTimelineDescending(order.history)
  if (!events.length) {
    return <p className="mt-3 text-sm font-semibold text-slate-500">Aun no hay trazabilidad registrada para esta orden.</p>
  }
  return (
    <div className="mt-4">
      <p className="mb-3 text-sm font-extrabold text-slate-700">Linea de tiempo de la orden</p>
      <div className="space-y-0">
        {events.map((item, index) => {
          const isCurrent = item.newStatus === order.status && index === events.findIndex((event) => event.newStatus === order.status)
          return (
            <div key={`${item.newStatus}-${item.changedAt}-${index}`} className="grid grid-cols-[22px_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-4 w-4 rounded-full border-2 ${isCurrent ? 'border-teal-700 bg-teal-500' : 'border-sky-400 bg-white'}`} />
                {index < events.length - 1 && <span className="h-full min-h-10 w-px bg-slate-200" />}
              </div>
              <div className={`mb-3 rounded-lg border p-3 text-sm ${isCurrent ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-extrabold">{formatStatus(item.newStatus)}</p>
                      {isCurrent && <span className={`status-pill ${statusClass(order.status)}`}>Estado actual</span>}
                    </div>
                    <p className="text-slate-600">{formatDateTime(item.changedAt)}</p>
                  </div>
                  <CheckCheck className={`mt-1 h-5 w-5 shrink-0 ${isCurrent ? 'text-teal-600' : 'text-sky-500'}`} aria-label="Evento registrado" />
                </div>
                {item.comment && <p className="mt-1">{item.comment}</p>}
                {item.newStatus === 'PRESUPUESTO_ACEPTADO' && order.approvalMethod && <p className="mt-1 text-xs font-bold text-teal-700">Medio: {formatApprovalMethod(order.approvalMethod)}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PublicRepairTimeline({ history, currentStatus }: { history?: OrderHistoryEvent[]; currentStatus: string }) {
  const events = sortTimelineDescending(history)
  if (!events.length) return null
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Avance de la reparacion</p>
          <h2 className="text-lg font-extrabold">{customerStatusMessage(currentStatus)}</h2>
        </div>
        <span className={`status-pill ${statusClass(currentStatus)}`}>Estado actual</span>
      </div>
      <div className="space-y-0">
        {events.map((item, index) => {
          const isCurrent = item.newStatus === currentStatus && index === events.findIndex((event) => event.newStatus === currentStatus)
          return (
            <div key={`${item.newStatus}-${item.changedAt}-${index}`} className="grid grid-cols-[22px_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-4 w-4 rounded-full border-2 ${isCurrent ? 'border-teal-700 bg-teal-500' : 'border-sky-400 bg-white'}`} />
                {index < events.length - 1 && <span className="h-full min-h-10 w-px bg-slate-200" />}
              </div>
              <article className={`mb-3 rounded-lg border p-3 text-sm ${isCurrent ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-extrabold">{customerStatusMessage(item.newStatus)}</p>
                      {isCurrent && <span className={`status-pill ${statusClass(currentStatus)}`}>Ahora</span>}
                    </div>
                    <p className="text-slate-600">{formatDateTime(item.changedAt)}</p>
                  </div>
                  <CheckCheck className={`mt-1 h-5 w-5 shrink-0 ${isCurrent ? 'text-teal-600' : 'text-sky-500'}`} aria-label="Evento registrado" />
                </div>
                {item.comment && <p className="mt-1">{item.comment}</p>}
              </article>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function OrderCard({ order, spareParts, api, onStatus, onMessage, reload, onEdit, onDraft, currentRole }: { order: Order; spareParts: SparePart[]; api: ReturnType<typeof useApi>; onStatus: (id: number, s: string) => void; onMessage: (m: string) => void; reload: () => void; onEdit: (order: Order) => void; onDraft: (draft: WhatsappDraft) => void; currentRole: RoleName }) {
  const [quote, setQuote] = useState({ description: '', type: 'MANO_OBRA', quantity: 1, unitPrice: 0, sparePartId: '' })
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null)
  const [diagnosis, setDiagnosis] = useState({ diagnosis: order.diagnosis ?? '', additionalFaultDetail: order.additionalFaultDetail ?? '' })
  const [payment, setPayment] = useState({ amount: 0, paymentMethod: 'EFECTIVO' })
  const [evidence, setEvidence] = useState<{ evidenceType: string; description: string; file: File | null }>({ evidenceType: 'RECEPCION', description: '', file: null })
  const paid = order.payments?.reduce((sum, item) => sum + Number(item.amount), 0) ?? 0
  const totalCost = Number(order.totalCost)
  const balance = Math.max(totalCost - paid, 0)
  const hasQuotes = Boolean(order.quotes?.length)
  const isQuotePending = hasQuotes && order.quoteApproved == null && ['PRESUPUESTO_ENVIADO', 'EN_REVISION', 'ESPERANDO_PRESUPUESTO'].includes(order.status)
  const canUseTechnicalActions = ['ADMIN', 'TECNICO'].includes(currentRole)
  const canUseAdministrativeActions = ['ADMIN', 'RECEPCIONISTA'].includes(currentRole)
  const canManagePayments = currentRole === 'ADMIN'
  const canViewPayments = ['ADMIN', 'RECEPCIONISTA'].includes(currentRole)
  const canMarkReview = canUseTechnicalActions && order.status === 'CREADO'
  const canApproveQuote = currentRole === 'ADMIN' && isQuotePending
  const canSendBudget = canUseTechnicalActions && isQuotePending
  const canMarkReady = canUseTechnicalActions && order.status === 'EN_REPARACION'
  const canFinalize = canUseAdministrativeActions && order.status === 'LISTO_PARA_RECOGER' && balance <= 0
  const quoteDecisionLabel = order.quoteApproved === true ? 'Presupuesto aceptado' : order.quoteApproved === false ? 'Presupuesto rechazado' : 'Respuesta pendiente'
  const quoteDecisionClass = order.quoteApproved === true ? 'text-teal-700' : order.quoteApproved === false ? 'text-red-700' : 'text-amber-700'
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
        openWhatsappDraft(buildShortBudgetWhatsappDraft(order, diagnosis.diagnosis || order.diagnosis || '', projectedTotal), onDraft, onMessage)
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
      const { data } = await api.post(`/orders/${order.id}/payments`, payment)
      setPayment({ amount: 0, paymentMethod: 'EFECTIVO' })
      onMessage('Pago registrado')
      await downloadBlob(api, `/payments/${data.id}/receipt`, `comprobante-${order.orderCode}-pago.pdf`)
      reload()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const addEvidence = async () => {
    try {
      if (!evidence.file) {
        onMessage('Seleccione una imagen para la evidencia')
        return
      }
      const formData = new FormData()
      formData.append('file', evidence.file)
      formData.append('evidenceType', evidence.evidenceType)
      formData.append('description', evidence.description)
      await api.post(`/orders/${order.id}/evidences`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setEvidence({ evidenceType: 'RECEPCION', description: '', file: null })
      onMessage('Evidencia fotografica agregada')
      reload()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const removeEvidence = async (evidenceId: number) => {
    try {
      await api.delete(`/orders/${order.id}/evidences/${evidenceId}`)
      onMessage('Evidencia eliminada de la orden')
      reload()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  return (
    <article className="order-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold">{order.orderCode}</h3>
            <span className={`status-pill ${statusClass(order.status)}`}>{formatStatus(order.status)}</span>
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
          <p className="font-extrabold" title="Monto total presupuestado para la reparacion. Se calcula con los detalles de presupuesto y tambien puede editarse desde Editar orden.">Presupuesto total Q {totalCost.toFixed(2)}</p>
          {canViewPayments && <p>Pagado Q {paid.toFixed(2)}</p>}
          {canViewPayments && <p className={balance > 0 ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>Saldo Q {balance.toFixed(2)}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="btn btn-secondary" href={`${API_URL}/public/orders/${order.id}/ticket`} target="_blank"><FileText className="h-4 w-4" />Ticket con QR</a>
        <button className="btn btn-secondary" onClick={() => openWhatsappDraft(buildOrderWhatsappDraft(order), onDraft, onMessage)}><MessageCircle className="h-4 w-4" />WhatsApp rastreo</button>
        {canUseAdministrativeActions && <button className="btn btn-secondary" onClick={() => onEdit(order)}><Pencil className="h-4 w-4" />Editar orden</button>}
        {canMarkReview && <button className="btn btn-secondary" onClick={() => onStatus(order.id, 'EN_REVISION')}>Marcar revision</button>}
        {canSendBudget && <button className="btn btn-accent" onClick={() => openWhatsappDraft(buildShortBudgetWhatsappDraft(order, diagnosis.diagnosis || order.diagnosis || '', totalCost), onDraft, onMessage)}><MessageCircle className="h-4 w-4" />WhatsApp presupuesto</button>}
        {canApproveQuote && <button className="btn btn-primary" onClick={approveQuote}>Aprobar presupuesto</button>}
        {canMarkReady && (
          <button className="btn btn-primary" onClick={() => {
            onStatus(order.id, 'LISTO_PARA_RECOGER')
            openWhatsappDraft(buildReadyWhatsappDraft(order), onDraft, onMessage)
          }}><MessageCircle className="h-4 w-4" />Listo para recoger</button>
        )}
        {canFinalize && <button className="btn btn-primary" onClick={() => onStatus(order.id, 'FINALIZADO')}>Finalizar entrega</button>}
      </div>
      {canUseTechnicalActions && <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
        <p className="text-sm font-extrabold text-slate-700">Diagnostico tecnico</p>
        {order.diagnosis && <p className="mt-1 text-sm text-slate-700">{order.diagnosis}</p>}
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <textarea className="field" title="Pruebas realizadas y hallazgos reales del tecnico" placeholder="DIAGNOSTICO TECNICO: PRUEBAS REALIZADAS Y HALLAZGOS" value={diagnosis.diagnosis} onChange={(e) => setDiagnosis({ ...diagnosis, diagnosis: e.target.value })} />
          <textarea className="field" title="Fallas nuevas detectadas despues de la revision" placeholder="FALLAS NUEVAS DETECTADAS, POR EJEMPLO: HUMEDAD DANO PANTALLA" value={diagnosis.additionalFaultDetail} onChange={(e) => setDiagnosis({ ...diagnosis, additionalFaultDetail: e.target.value })} />
          <button className="btn btn-secondary" onClick={saveDiagnosis}><Pencil className="h-4 w-4" />Guardar diagnostico</button>
        </div>
      </div>}
      <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-slate-700">Respuesta del cliente al presupuesto</p>
            <p className={`mt-1 font-bold ${quoteDecisionClass}`}>{quoteDecisionLabel}</p>
            {order.approvalMethod && <p className="text-sm text-slate-600">Medio: {formatApprovalMethod(order.approvalMethod)}</p>}
            {order.approvedAt && <p className="text-sm text-slate-600">Fecha: {new Date(order.approvedAt).toLocaleString()}</p>}
          </div>
          <span className={`status-pill ${statusClass(order.status)}`}>{formatStatus(order.status)}</span>
        </div>
        <OrderTimeline order={order} />
      </div>
      {canUseTechnicalActions && <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
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
      </div>}
      {canUseTechnicalActions && <div className="mt-3 grid gap-2 md:grid-cols-[1fr_130px_110px_110px_auto]">
        <input className="field" title="Trabajo, repuesto o cargo que se agregara al presupuesto" placeholder="Detalle del presupuesto, por ejemplo: cambio de pantalla" value={quote.description} onChange={(e) => setQuote({ ...quote, description: e.target.value })} />
        <select className="field" title="Clasifique si el cobro corresponde a mano de obra, repuesto u otro cargo" value={quote.type} onChange={(e) => setQuote({ ...quote, type: e.target.value, sparePartId: e.target.value === 'REPUESTO' ? quote.sparePartId : '' })}>
          <option value="MANO_OBRA">Mano de obra</option>
          <option value="REPUESTO">Repuesto</option>
          <option value="OTRO">Otro</option>
        </select>
        <input className="field" type="number" min="1" title="Cantidad de piezas o servicios de este detalle" placeholder="Cantidad" value={quote.quantity} onChange={(e) => setQuote({ ...quote, quantity: Number(e.target.value) })} />
        <input className="field" type="number" min="0" step="0.01" title="Precio unitario en quetzales" placeholder={`Precio unitario ${currentCurrencySymbol}`} value={quote.unitPrice} onChange={(e) => setQuote({ ...quote, unitPrice: Number(e.target.value) })} />
        <button className="btn btn-secondary" onClick={addQuote} title={editingQuoteId ? 'Actualizar este detalle del presupuesto' : 'Agregar este detalle al presupuesto'}>
          {editingQuoteId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>}
      {canUseTechnicalActions && quote.type === 'REPUESTO' && (
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
      {canUseTechnicalActions && editingQuoteId && (
        <button className="btn btn-secondary mt-2" type="button" onClick={cancelQuoteEdit}>
          <X className="h-4 w-4" />
          Cancelar edicion de presupuesto
        </button>
      )}
      {canManagePayments && <div className="mt-2 grid gap-2 md:grid-cols-[140px_150px_auto]">
        <input className="field" type="number" min="0" step="0.01" title="Monto que el cliente paga en este momento" placeholder="Monto pagado Q" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })} />
        <select className="field" title="Forma de pago usada por el cliente" value={payment.paymentMethod} onChange={(e) => setPayment({ ...payment, paymentMethod: e.target.value })}>
          <option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>QR_PAGO</option>
        </select>
        <button className="btn btn-secondary" onClick={addPayment}><CreditCard className="h-4 w-4" />Registrar pago</button>
      </div>}
      {currentRole === 'RECEPCIONISTA' && (
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 opacity-75">
          <p className="text-sm font-extrabold text-slate-700">Registro de pagos restringido</p>
          <p className="text-sm text-slate-600">Solo el administrador del sistema puede registrar o modificar pagos.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-[140px_150px_auto]">
            <input className="field" disabled placeholder="Monto pagado Q" />
            <select className="field" disabled><option>EFECTIVO</option></select>
            <button className="btn btn-secondary" disabled><CreditCard className="h-4 w-4" />Registrar pago</button>
          </div>
        </div>
      )}
      {canViewPayments && order.payments?.length > 0 && (
        <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-sm font-extrabold text-slate-700">Pagos y comprobantes</p>
          {order.payments.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span>{item.paymentMethod} | {new Date(item.createdAt).toLocaleString()} | Q {Number(item.amount).toFixed(2)}</span>
              <button className="btn btn-secondary px-2 py-1 text-xs" onClick={() => downloadBlob(api, `/payments/${item.id}/receipt`, `comprobante-${order.orderCode}-${item.id}.pdf`)}>
                <Receipt className="h-3 w-3" />
                Comprobante
              </button>
            </div>
          ))}
        </div>
      )}
      {canUseTechnicalActions && <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
        <p className="mb-2 text-sm font-extrabold text-slate-700">Evidencias fotograficas</p>
        <div className="grid gap-2 md:grid-cols-[150px_1fr_1fr_auto]">
          <select className="field" value={evidence.evidenceType} onChange={(e) => setEvidence({ ...evidence, evidenceType: e.target.value })}>
            <option>RECEPCION</option><option>DIAGNOSTICO</option><option>REPARACION</option><option>ENTREGA</option>
          </select>
          <input className="field" placeholder="Descripcion breve de la evidencia" value={evidence.description} onChange={(e) => setEvidence({ ...evidence, description: e.target.value })} />
          <input className="field" type="file" accept="image/*" onChange={(e) => setEvidence({ ...evidence, file: e.target.files?.[0] ?? null })} />
          <button className="btn btn-secondary" onClick={addEvidence}><Upload className="h-4 w-4" />Subir</button>
        </div>
        {order.evidences?.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {order.evidences.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <EvidenceImage api={api} orderId={order.id} evidence={item} />
                <p className="mt-2 text-xs font-bold">{item.evidenceType}</p>
                <p className="text-xs text-slate-600">{item.description || item.originalName}</p>
                <div className="mt-2 flex justify-end">
                  <button className="btn btn-secondary px-2 py-1 text-xs" onClick={() => removeEvidence(item.id)}><Trash2 className="h-3 w-3" />Quitar</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Aun no hay evidencias en esta orden.</p>
        )}
      </div>}
    </article>
  )
}

function Inventory({ api, onMessage, currentRole }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void; currentRole: RoleName }) {
  const [items, setItems] = useState<SparePart[]>([])
  const emptyForm = { internalCode: '', name: '', category: '', purchasePrice: 0, publicSalePrice: 0, currentStock: 0, minimumStock: 3 }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'form' | 'list'>('form')
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
    setView('form')
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
  const canManageInventory = currentRole === 'ADMIN'
  const filteredItems = items.filter((item) => {
    if (!normalizedSearch) return true
    const haystack = [item.internalCode, item.name, item.category, item.brand ?? '', item.model ?? ''].join(' ').toLocaleUpperCase('es-GT')
    return haystack.includes(normalizedSearch)
  })
  const inventoryList = (
    <section className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase text-teal-700">Consulta de inventario</p>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold"><Boxes className="h-6 w-6" />Inventario registrado</h2>
          <p className="text-sm text-slate-600">Busque repuestos por codigo, nombre, marca, modelo o categoria.</p>
        </div>
        {canManageInventory ? (
          <button type="button" className="btn btn-secondary" onClick={() => setView('form')}><ArrowLeft className="h-4 w-4" />Volver al registro</button>
        ) : (
          <span className="rounded-full bg-sky-100 px-3 py-2 text-sm font-extrabold text-sky-800">Solo consulta</span>
        )}
      </div>
      <div className="field flex items-center gap-2">
        <Search className="h-5 w-5 text-slate-500" />
        <input
          className="w-full border-0 bg-transparent outline-none"
          title="Busque por codigo, nombre, marca, modelo o categoria"
          placeholder="Buscar repuesto por codigo, nombre, marca, modelo o categoria"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span className="whitespace-nowrap text-sm font-bold text-slate-600">{filteredItems.length} visibles</span>
      </div>
      <List>
        {filteredItems.length ? filteredItems.map((item) => (
          <Row
            key={item.id}
            title={`${item.internalCode} - ${item.name}`}
            subtitle={`${item.category} | Stock ${item.currentStock} | Venta ${currentCurrencySymbol} ${Number(item.publicSalePrice).toFixed(2)}`}
            actions={
              <div className="flex flex-wrap gap-2">
                {canManageInventory && <button type="button" className="btn btn-secondary" onClick={() => edit(item)}><Pencil className="h-4 w-4" />Editar</button>}
                <button type="button" className="btn btn-secondary" onClick={() => downloadBlob(api, `/spare-parts/${item.id}/label`, `etiqueta-${item.internalCode}.pdf`).then(() => onMessage('Etiqueta generada')).catch((error) => onMessage(errorMessage(error)))}>
                  <Tag className="h-4 w-4" />
                  Etiqueta
                </button>
              </div>
            }
          />
        )) : (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">No hay repuestos que coincidan con la busqueda.</div>
        )}
      </List>
    </section>
  )
  if (view === 'list' || !canManageInventory) return inventoryList
  return (
    <CrudLayout
      title={editingId ? 'Editar repuesto' : 'Inventario de repuestos'}
      icon={<Boxes />}
      onSubmit={submit}
      submitLabel={editingId ? 'Actualizar repuesto' : 'Guardar repuesto'}
      onCancel={editingId ? cancelEdit : undefined}
      headerAction={<button type="button" className="btn btn-secondary" onClick={() => setView('list')}><Search className="h-4 w-4" />Ver inventario</button>}
    >
      {canManageInventory && (
        <>
          <input className="field" title="Codigo interno unico para ubicar el repuesto en inventario" placeholder="Codigo interno del repuesto, por ejemplo: SCREEN-0002" value={form.internalCode} onChange={(e) => setForm({ ...form, internalCode: e.target.value })} required />
          <input className="field" title="Nombre comercial o tecnico del repuesto" placeholder="Nombre del repuesto, por ejemplo: pantalla Samsung A336M" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="field" title="Categoria para filtrar y ordenar inventario" placeholder="Categoria, por ejemplo: pantallas, baterias, conectores" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
          <input className="field" type="number" min="0" step="0.01" title="Costo real de compra del repuesto" placeholder="Costo de compra en Q" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
          <input className="field" type="number" min="0" step="0.01" title="Precio final que se cobrara al cliente" placeholder="Precio de venta al publico en Q" value={form.publicSalePrice} onChange={(e) => setForm({ ...form, publicSalePrice: Number(e.target.value) })} />
          <input className="field" type="number" min="0" title="Cantidad disponible actualmente" placeholder="Stock actual disponible" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })} />
        </>
      )}
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
  const [view, setView] = useState<'form' | 'list'>('form')
  const [search, setSearch] = useState('')
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
  const normalizedSearch = search.trim().toLocaleUpperCase('es-GT')
  const filteredSales = sales.filter((sale) => {
    if (!normalizedSearch) return true
    const haystack = [
      sale.saleCode,
      formatClientName(sale.client),
      sale.paymentMethod,
      sale.items.map((row) => row.sparePart.name).join(' '),
    ].join(' ').toLocaleUpperCase('es-GT')
    return haystack.includes(normalizedSearch)
  })
  if (view === 'list') {
    return (
      <section className="panel space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase text-teal-700">Historial de ventas</p>
            <h2 className="flex items-center gap-2 text-2xl font-extrabold"><CreditCard className="h-6 w-6" />Ventas registradas</h2>
            <p className="text-sm text-slate-600">Consulte ventas de inventario y genere comprobantes.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setView('form')}><ArrowLeft className="h-4 w-4" />Volver al registro</button>
        </div>
        <div className="field flex items-center gap-2">
          <Search className="h-5 w-5 text-slate-500" />
          <input
            className="w-full border-0 bg-transparent outline-none"
            title="Busque por codigo de venta, cliente, metodo de pago o articulo vendido"
            placeholder="Buscar venta por codigo, cliente, metodo o articulo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="whitespace-nowrap text-sm font-bold text-slate-600">{filteredSales.length} visibles</span>
        </div>
        <List>
          {filteredSales.length ? filteredSales.map((sale) => (
            <Row
              key={sale.id}
              title={`${sale.saleCode} - ${formatClientName(sale.client)}`}
              subtitle={`${sale.items.map((row) => `${row.sparePart.name} x ${row.quantity}`).join(', ')} | ${sale.paymentMethod} | Total ${currentCurrencySymbol} ${Number(sale.totalAmount).toFixed(2)}`}
              actions={
                <button className="btn btn-secondary" onClick={() => downloadBlob(api, `/inventory-sales/${sale.id}/receipt`, `comprobante-${sale.saleCode}.pdf`).then(() => onMessage('Comprobante de venta generado')).catch((error) => onMessage(errorMessage(error)))}>
                  <Receipt className="h-4 w-4" />
                  Comprobante
                </button>
              }
            />
          )) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">No hay ventas que coincidan con la busqueda.</div>
          )}
        </List>
      </section>
    )
  }
  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><CreditCard />Nueva venta de inventario</h2>
        <button type="button" className="btn btn-secondary" onClick={() => setView('list')}><Search className="h-4 w-4" />Ver ventas</button>
      </div>
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
            <p className="font-extrabold">Total venta {currentCurrencySymbol} {total.toFixed(2)}</p>
            <button className="btn btn-primary"><CreditCard className="h-4 w-4" />Registrar venta</button>
          </div>
        </form>
    </div>
  )
}

function Expenses({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const emptyForm = { spentAt: new Date().toISOString().slice(0, 10), category: '', description: '', amount: 0, paymentMethod: 'EFECTIVO', responsible: '', notes: '' }
  const [items, setItems] = useState<Expense[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [view, setView] = useState<'form' | 'list'>('form')
  const [search, setSearch] = useState('')
  const load = () => api.get('/expenses').then((r) => setItems(r.data))
  useEffect(() => { load() }, [])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (editingId) {
        await api.patch(`/expenses/${editingId}`, clean(form))
        onMessage('Gasto actualizado')
      } else {
        await api.post('/expenses', clean(form))
        onMessage('Gasto registrado')
      }
      setForm(emptyForm)
      setEditingId(null)
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const edit = (item: Expense) => {
    setEditingId(item.id)
    setView('form')
    setForm({
      spentAt: item.spentAt.slice(0, 10),
      category: item.category,
      description: item.description,
      amount: Number(item.amount),
      paymentMethod: item.paymentMethod,
      responsible: item.responsible,
      notes: item.notes ?? '',
    })
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
  const normalizedSearch = search.trim().toLocaleUpperCase('es-GT')
  const filteredItems = items.filter((item) => {
    if (!normalizedSearch) return true
    const haystack = [item.category, item.description, item.paymentMethod, item.responsible, item.notes ?? ''].join(' ').toLocaleUpperCase('es-GT')
    return haystack.includes(normalizedSearch)
  })
  const filteredTotal = filteredItems.reduce((sum, item) => sum + Number(item.amount), 0)
  if (view === 'list') {
    return (
      <section className="panel space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase text-teal-700">Control financiero</p>
            <h2 className="flex items-center gap-2 text-2xl font-extrabold"><DollarSign className="h-6 w-6" />Gastos registrados</h2>
            <p className="text-sm text-slate-600">Consulte gastos operativos por categoria, responsable, metodo o descripcion.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setView('form')}><ArrowLeft className="h-4 w-4" />Volver al registro</button>
        </div>
        <div className="field flex items-center gap-2">
          <Search className="h-5 w-5 text-slate-500" />
          <input
            className="w-full border-0 bg-transparent outline-none"
            title="Busque por categoria, descripcion, metodo de pago o responsable"
            placeholder="Buscar gasto por categoria, descripcion, metodo o responsable"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="whitespace-nowrap text-sm font-bold text-slate-600">Q {filteredTotal.toFixed(2)}</span>
        </div>
        <List>
          {filteredItems.length ? filteredItems.map((item) => (
            <Row
              key={item.id}
              title={`${item.category} - ${currentCurrencySymbol} ${Number(item.amount).toFixed(2)}`}
              subtitle={`${new Date(item.spentAt).toLocaleDateString()} | ${item.description} | ${item.paymentMethod} | Responsable: ${item.responsible}`}
              actions={<button type="button" className="btn btn-secondary" onClick={() => edit(item)}><Pencil className="h-4 w-4" />Editar</button>}
            />
          )) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">No hay gastos que coincidan con la busqueda.</div>
          )}
        </List>
      </section>
    )
  }
  return (
    <CrudLayout
      title={editingId ? 'Editar gasto' : 'Gastos operativos'}
      icon={<DollarSign />}
      onSubmit={submit}
      submitLabel={editingId ? 'Actualizar gasto' : 'Guardar gasto'}
      onCancel={editingId ? cancelEdit : undefined}
      headerAction={<button type="button" className="btn btn-secondary" onClick={() => setView('list')}><Search className="h-4 w-4" />Ver gastos</button>}
    >
      <input className="field" type="date" value={form.spentAt} onChange={(e) => setForm({ ...form, spentAt: e.target.value })} required />
      <input className="field" placeholder="Categoria del gasto, por ejemplo: renta, repuestos, transporte" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
      <input className="field md:col-span-2" placeholder="Descripcion del gasto" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
      <input className="field" type="number" min="0.01" step="0.01" placeholder="Monto Q" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
      <select className="field" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
        <option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>QR_PAGO</option>
      </select>
      <input className="field" placeholder="Responsable del gasto" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} required />
      <input className="field" placeholder="Notas internas, opcional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <div className="md:col-span-2 rounded-md border border-sky-200 bg-sky-50 p-3 font-bold text-sky-900">Total visible de gastos: Q {total.toFixed(2)}</div>
    </CrudLayout>
  )
}

function SystemSettingsPanel({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const [section, setSection] = useState<'identity' | 'users' | 'equipment-types'>('identity')
  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="mb-3">
          <p className="text-xs font-extrabold uppercase text-teal-700">Configuracion administrativa</p>
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Settings className="h-5 w-5" />Ajustes del sistema</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn ${section === 'identity' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSection('identity')}>
            <ShieldCheck className="h-4 w-4" />
            Taller
          </button>
          <button type="button" className={`btn ${section === 'users' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSection('users')}>
            <Users className="h-4 w-4" />
            Usuarios
          </button>
          <button type="button" className={`btn ${section === 'equipment-types' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSection('equipment-types')}>
            <MonitorSmartphone className="h-4 w-4" />
            Tipos de equipo
          </button>
        </div>
      </div>
      {section === 'identity' && <ShopIdentityPanel api={api} onMessage={onMessage} />}
      {section === 'users' && <UsersPanel api={api} onMessage={onMessage} />}
      {section === 'equipment-types' && <EquipmentTypesPanel api={api} onMessage={onMessage} />}
    </div>
  )
}

function ShopIdentityPanel({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const emptyForm = {
    shopName: '',
    slogan: '',
    phone: '',
    whatsapp: '',
    address: '',
    contactEmail: '',
    termsText: '',
    privacyText: '',
    defaultWarrantyDays: 30,
    currency: 'GTQ',
    ticketFormat: 'LETTER',
  }
  const [form, setForm] = useState(emptyForm)
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get('/settings').then((response) => {
      const data = response.data as ShopSettings
      setSettings(data)
      setForm({
        shopName: data.shopName ?? '',
        slogan: data.slogan ?? '',
        phone: data.phone ?? '',
        whatsapp: data.whatsapp ?? '',
        address: data.address ?? '',
        contactEmail: data.contactEmail ?? '',
        termsText: data.termsText ?? '',
        privacyText: data.privacyText ?? '',
        defaultWarrantyDays: data.defaultWarrantyDays ?? 30,
        currency: data.currency ?? 'GTQ',
        ticketFormat: data.ticketFormat ?? 'LETTER',
      })
    }).catch((error) => onMessage(errorMessage(error)))
  }
  useEffect(() => { load() }, [])

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setSaving(true)
      await api.patch('/settings', clean(form))
      if (logoFile) {
        const data = new FormData()
        data.append('file', logoFile)
        await api.post('/settings/logo', data, { headers: { 'Content-Type': 'multipart/form-data' } })
        setLogoFile(null)
      }
      onMessage('Identidad del taller actualizada')
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const logoUrl = settings?.hasLogo ? publicBackendUrl(settings.logoUrl, settings.logoUpdatedAt ?? settings.updatedAt) : ''
  return (
    <div className="panel p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase text-teal-700">Configuracion del taller</p>
          <h3 className="flex items-center gap-2 text-xl font-extrabold"><ShieldCheck className="h-5 w-5" />Perfil comercial del sistema</h3>
          <p className="mt-1 text-sm text-slate-600">Estos datos se usan en login, encabezado, tickets, comprobantes, rastreo publico y reportes.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          {logoUrl ? <img className="mx-auto h-20 w-28 object-contain" src={logoUrl} alt="Logotipo actual" /> : <div className="grid h-20 w-28 place-items-center rounded-lg bg-sky-100 font-extrabold text-sky-700">LOGO</div>}
          <p className="mt-2 text-xs font-bold text-slate-500">Logo actual</p>
        </div>
      </div>
      <form onSubmit={saveSettings} className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <input className="field h-[58px]" title="Escriba el nombre comercial real del taller o electronica." placeholder="Nombre comercial del taller" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} required />
          <input className="field h-[58px]" title="Escriba una frase corta que describa el servicio del taller." placeholder="Eslogan del taller" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
          <input className="field h-[58px]" title="Escriba el numero telefonico principal del taller." placeholder="Telefono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <input className="field h-[58px]" title="Escriba el numero de WhatsApp que usara el taller para comunicacion." placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} required />
          <input className="field h-[58px]" title="Escriba el correo electronico publico o administrativo del taller." placeholder="Correo" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <textarea className="field min-h-[84px]" title="Escriba la direccion fisica que aparecera en tickets, comprobantes y rastreo." placeholder="Direccion" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <textarea className="field min-h-[118px]" title="Escriba las condiciones que el cliente debe leer en tickets y comprobantes." placeholder="Terminos para tickets y comprobantes" value={form.termsText} onChange={(e) => setForm({ ...form, termsText: e.target.value })} />
          <textarea className="field min-h-[118px]" title="Escriba un texto breve sobre el uso de datos del cliente." placeholder="Texto de privacidad, opcional" value={form.privacyText} onChange={(e) => setForm({ ...form, privacyText: e.target.value })} />
        </div>
        <div className="grid gap-3 lg:col-span-2 lg:grid-cols-[140px_140px_1fr_1.8fr]">
          <input className="field h-[58px] text-center" title="Indique cuantos dias de garantia se aplican por defecto." type="number" min="0" max="99" placeholder="Dias garantia" value={form.defaultWarrantyDays} onChange={(e) => setForm({ ...form, defaultWarrantyDays: Number(e.target.value.slice(0, 2)) })} />
          <input className="field h-[58px] text-center" title="Escriba el codigo de moneda que se usara en documentos, por ejemplo GTQ." maxLength={3} placeholder="Moneda" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          <select className="field h-[58px]" title="Seleccione el tipo de impresion para el ticket de orden." value={form.ticketFormat} onChange={(e) => setForm({ ...form, ticketFormat: e.target.value })}>
            <option value="LETTER">Formato carta</option>
            <option value="THERMAL_80MM">Formato termica 80mm</option>
          </select>
          <label className="field flex h-[58px] cursor-pointer items-center justify-between gap-3" title="Seleccione un logotipo PNG o JPG de maximo 2 MB.">
            <span className="font-semibold text-slate-600">{logoFile ? logoFile.name : 'Subir logotipo PNG o JPG, maximo 2MB'}</span>
            <input className="hidden" type="file" accept="image/png,image/jpeg" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            <Upload className="h-5 w-5 text-slate-500" />
          </label>
        </div>
        <div className="flex justify-center">
          <button className="btn btn-primary w-full max-w-sm" disabled={saving}>
            <ShieldCheck className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar perfil del taller'}
          </button>
        </div>
      </form>
    </div>
  )
}

function EquipmentTypesPanel({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const [types, setTypes] = useState<EquipmentType[]>([])
  const emptyTypeForm = { name: '', serviceLine: 'EQUIPOS_GENERALES' as ServiceLineKey, requiresCredential: false, allowsUnlockCase: false, isActive: true }
  const [typeForm, setTypeForm] = useState(emptyTypeForm)
  const [editForm, setEditForm] = useState(emptyTypeForm)
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null)
  const [showTypesModal, setShowTypesModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [typeSearch, setTypeSearch] = useState('')
  const load = () => api.get('/equipment-types?includeInactive=true').then((response) => setTypes(response.data))
  useEffect(() => { load() }, [])
  const normalizedTypeSearch = typeSearch.trim().toLocaleUpperCase('es-GT')
  const activeTypes = types.filter((type) => type.isActive !== false)
  const filteredTypes = activeTypes.filter((type) => {
    if (!normalizedTypeSearch) return true
    return [type.name, serviceLineLabel(type.serviceLine), type.requiresCredential ? 'requiere clave' : 'sin clave', type.allowsUnlockCase ? 'bloqueos' : 'sin bloqueos']
      .join(' ')
      .toLocaleUpperCase('es-GT')
      .includes(normalizedTypeSearch)
  })

  const submitType = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/equipment-types', typeForm)
      onMessage('Tipo de equipo creado')
      setTypeForm(emptyTypeForm)
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }

  const updateType = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingTypeId) return
    try {
      await api.patch(`/equipment-types/${editingTypeId}`, editForm)
      onMessage('Tipo de equipo actualizado')
      closeEditModal()
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }

  const editType = (type: EquipmentType) => {
    setEditingTypeId(type.id)
    setEditForm({
      name: type.name,
      serviceLine: type.serviceLine,
      requiresCredential: type.requiresCredential,
      allowsUnlockCase: type.allowsUnlockCase,
      isActive: type.isActive ?? true,
    })
    setShowEditModal(true)
  }
  const closeEditModal = () => {
    setEditingTypeId(null)
    setEditForm(emptyTypeForm)
    setShowEditModal(false)
  }
  const deleteType = async (type: EquipmentType) => {
    try {
      await api.patch(`/equipment-types/${type.id}`, { isActive: false })
      setTypes((current) => current.filter((item) => item.id !== type.id))
      onMessage('Tipo de equipo eliminado del catalogo activo')
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }

  return (
    <div className="panel p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase text-teal-700">Catalogo operativo</p>
          <h3 className="flex items-center gap-2 text-xl font-extrabold"><Settings className="h-5 w-5" />Tipos de equipo</h3>
          <p className="mt-1 text-sm text-slate-600">Configure que tipos apareceran al registrar equipos y si requieren clave o manejo de bloqueos.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setShowTypesModal(true)}>
          <MonitorSmartphone className="h-4 w-4" />
          Tipos de equipo
        </button>
      </div>
      <div>
        <form className="rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={submitType}>
          <h4 className="mb-3 font-extrabold">Crear nuevo tipo</h4>
          <div className="grid gap-3 lg:grid-cols-2">
            <input className="field" placeholder="Nombre del tipo" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} required />
            <ServiceLineSelect value={typeForm.serviceLine} onChange={(serviceLine) => setTypeForm({ ...typeForm, serviceLine: serviceLine as ServiceLineKey })} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold"><input type="checkbox" checked={typeForm.requiresCredential} onChange={(e) => setTypeForm({ ...typeForm, requiresCredential: e.target.checked })} />Requiere clave</label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold"><input type="checkbox" checked={typeForm.allowsUnlockCase} onChange={(e) => setTypeForm({ ...typeForm, allowsUnlockCase: e.target.checked })} />Permite casos de bloqueo</label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold"><input type="checkbox" checked={typeForm.isActive} onChange={(e) => setTypeForm({ ...typeForm, isActive: e.target.checked })} />Tipo activo</label>
          </div>
          <div className="mt-4 flex justify-center">
            <button className="btn btn-primary w-full max-w-sm px-8">Crear tipo</button>
          </div>
        </form>
      </div>
      {showTypesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[88vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase text-teal-700">Administrador</p>
                <h3 className="flex items-center gap-2 text-xl font-extrabold"><MonitorSmartphone className="h-5 w-5" />Tipos de equipo</h3>
                <p className="text-sm text-slate-600">Busque, edite o elimine tipos del catalogo del sistema.</p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTypesModal(false)}><X className="h-4 w-4" />Cerrar</button>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input className="w-full border-0 bg-transparent py-2 outline-none" placeholder="Buscar por nombre, linea, clave o bloqueo" value={typeSearch} onChange={(e) => setTypeSearch(e.target.value)} />
            </div>
            <div className="space-y-3">
              {SERVICE_LINES.map((line) => {
                const lineTypes = filteredTypes.filter((type) => type.serviceLine === line.key)
                if (!lineTypes.length) return null
                return (
                  <section key={line.key} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold">{line.label}</h4>
                        <p className="text-xs font-semibold text-slate-500">{line.description}</p>
                      </div>
                      <span className="status-pill">{lineTypes.length} tipos</span>
                    </div>
                    <div className="grid gap-2">
                      {lineTypes.map((type) => (
                        <div key={type.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
                            <strong className="min-w-44 text-lg">{type.name}</strong>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="status-pill status-accepted">Activo</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">{type.requiresCredential ? 'Requiere clave' : 'Sin clave'}</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">{type.allowsUnlockCase ? 'Permite bloqueos' : 'Sin bloqueos'}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn btn-secondary" onClick={() => editType(type)}><Pencil className="h-4 w-4" />Editar</button>
                            <button type="button" className="btn btn-danger" onClick={() => deleteType(type)}><Trash2 className="h-4 w-4" />Eliminar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}
              {!filteredTypes.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center font-semibold text-slate-500">No hay tipos de equipo con ese criterio.</p>}
            </div>
          </div>
        </div>
      )}
      {showEditModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4">
          <form className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" onSubmit={updateType}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase text-teal-700">Actualizar catalogo</p>
                <h3 className="text-xl font-extrabold">Editar tipo de equipo</h3>
              </div>
              <button type="button" className="btn btn-secondary" onClick={closeEditModal}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm font-extrabold text-slate-700">Nombre del tipo</span>
                <input className="field" placeholder="Nombre del tipo" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </label>
              <div className="grid gap-1">
                <span className="text-sm font-extrabold text-slate-700">Linea de servicio</span>
                <ServiceLineSelect value={editForm.serviceLine} onChange={(serviceLine) => setEditForm({ ...editForm, serviceLine: serviceLine as ServiceLineKey })} />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold">
                <input type="checkbox" checked={editForm.requiresCredential} onChange={(e) => setEditForm({ ...editForm, requiresCredential: e.target.checked })} />
                Requiere clave
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold">
                <input type="checkbox" checked={editForm.allowsUnlockCase} onChange={(e) => setEditForm({ ...editForm, allowsUnlockCase: e.target.checked })} />
                Permite casos de bloqueo
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold">
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                Tipo activo
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn btn-primary flex-1">Actualizar tipo</button>
                <button type="button" className="btn btn-secondary" onClick={closeEditModal}>Cancelar</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function UsersPanel({ api, onMessage }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void }) {
  const emptyForm = { username: '', email: '', fullName: '', password: '', role: 'RECEPCIONISTA', isActive: true }
  const [items, setItems] = useState<UserAccount[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const load = () => api.get('/users').then((r) => setItems(r.data))
  useEffect(() => { load() }, [])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const payload = clean({ ...form, password: form.password || undefined })
      if (editingId) {
        await api.patch(`/users/${editingId}`, payload)
        onMessage('Usuario actualizado')
      } else {
        await api.post('/users', payload)
        onMessage('Usuario creado')
      }
      setForm(emptyForm)
      setEditingId(null)
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const edit = (item: UserAccount) => {
    setEditingId(item.id)
    setForm({ username: item.username, email: item.email, fullName: item.fullName, password: '', role: item.role.name, isActive: item.isActive })
  }
  const toggle = async (item: UserAccount) => {
    try {
      await api.patch(`/users/${item.id}`, { isActive: !item.isActive })
      onMessage(item.isActive ? 'Usuario desactivado' : 'Usuario activado')
      load()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  return (
    <CrudLayout title={editingId ? 'Editar usuario' : 'Usuarios del sistema'} icon={<Users />} onSubmit={submit} submitLabel={editingId ? 'Actualizar usuario' : 'Crear usuario'} onCancel={editingId ? cancelEdit : undefined}>
      <input className="field" placeholder="Usuario de acceso" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
      <input className="field" type="email" placeholder="Correo electronico" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      <input className="field" placeholder="Nombre completo" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
      <input className="field credential-value" type="password" placeholder={editingId ? 'Nueva contrasena, opcional' : 'Contrasena exacta'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} />
      <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
        <option>ADMIN</option><option>RECEPCIONISTA</option><option>TECNICO</option>
      </select>
      <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm font-bold">
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        Usuario activo
      </label>
      <List>
        {items.map((item) => (
          <Row
            key={item.id}
            title={`${item.fullName} (${item.username})`}
            subtitle={`${item.email} | Rol: ${item.role.name} | ${item.isActive ? 'Activo' : 'Inactivo'}`}
            actions={
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => edit(item)}><Pencil className="h-4 w-4" />Editar</button>
                <button type="button" className="btn btn-secondary" onClick={() => toggle(item)}>{item.isActive ? 'Desactivar' : 'Activar'}</button>
              </div>
            }
          />
        ))}
      </List>
    </CrudLayout>
  )
}

function Whatsapp({ api, onMessage, onDraft, currentRole }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void; onDraft: (draft: WhatsappDraft) => void; currentRole: string }) {
  const [view, setView] = useState<'control' | 'chats'>('control')
  const [statuses, setStatuses] = useState<Record<string, WhatsappChannelStatus>>({})
  const [messages, setMessages] = useState<IncomingWhatsappMessage[]>([])

  const loadStatuses = () => {
    Promise.all(WHATSAPP_CHANNELS.map((channel) => api.get(`/whatsapp/channels/${channel.key}/status`)))
      .then((responses) => {
        setStatuses(Object.fromEntries(responses.map((response, index) => {
          const channel = WHATSAPP_CHANNELS[index]
          return [channel.key, { ...response.data, key: channel.key, label: response.data.channelLabel ?? channel.label }]
        })))
      })
      .catch(() => null)
  }

  const loadMessages = () => {
    api.get('/whatsapp/messages').then((response) => setMessages(response.data)).catch(() => null)
  }

  useEffect(() => {
    loadStatuses()
    loadMessages()
    const timer = window.setInterval(() => {
      loadStatuses()
      loadMessages()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [api])

  const startLinkedSession = async (channelKey: string) => {
    try {
      onMessage('')
      const { data } = await api.post(`/whatsapp/channels/${channelKey}/start`)
      if (data.message && data.message !== 'Vinculacion por QR iniciada') onMessage(data.message)
      loadStatuses()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }

  const stopLinkedSession = async (channelKey: string) => {
    try {
      const { data } = await api.post(`/whatsapp/channels/${channelKey}/stop`)
      onMessage(data.message ?? 'Numero desvinculado correctamente.')
      loadStatuses()
    } catch (error) {
      onMessage(errorMessage(error))
    }
  }

  if (view === 'chats') {
    return (
      <div className="space-y-4">
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-bold uppercase text-teal-700">Bandeja visual</p>
            <h2 className="text-xl font-extrabold">Chats WhatsApp</h2>
            <p className="text-sm text-slate-600">Evidencia de mensajes enviados y respuestas recibidas por canal.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setView('control')}>
            <ArrowLeft className="h-4 w-4" />
            Volver al panel
          </button>
        </div>
        <WhatsappInbox api={api} onMessage={onMessage} onDraft={onDraft} currentRole={currentRole} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold uppercase text-teal-700">Panel de control</p>
            <h2 className="text-xl font-extrabold">WhatsApp del taller</h2>
            <p className="text-sm text-slate-600">Controle los numeros, revise canales y abra la bandeja visual de conversaciones.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-accent"
              onClick={() => setView('chats')}
              title="Abrir la bandeja visual para revisar chats enviados y recibidos."
            >
              <MessageCircle className="h-4 w-4" />
              Abrir chats
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {WHATSAPP_CHANNELS.map((channel) => {
            const status = statuses[channel.key]
            const canStopSession = Boolean(status?.started || status?.ready || status?.lastError)
            const displayError = status?.lastError && !status.hasQr && !status.ready && !status.lastError.includes('Attempted to use detached Frame') ? status.lastError : ''
            const channelMessages = messages.filter((item) => normalizeWhatsappChannelKey(item.apiResponse?.channelKey) === channel.key)
            return (
              <div key={channel.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold uppercase text-teal-700">{channel.label}</p>
                    <h3 className="text-lg font-extrabold">{channel.description}</h3>
                  </div>
                  <span className={`status-pill ${status?.ready ? 'status-repair' : status?.hasQr ? 'status-quote' : 'status-created'}`}>
                    {status?.ready ? 'Vinculado' : status?.initializing ? 'Iniciando' : status?.hasQr ? 'QR visible' : 'Sin iniciar'}
                  </span>
                </div>
                <div className="mb-3 grid gap-2 sm:grid-cols-3">
                  <Status label="Sesion" value={status?.ready ? 'Iniciado' : status?.initializing ? 'Iniciando' : status?.started ? 'Pendiente' : 'Sin iniciar'} />
                  <Status label="QR" value={status?.ready ? 'Oculto' : status?.hasQr ? 'Visible' : 'No visible'} />
                  <Status label="Mensajes" value={channelMessages.length ? `${channelMessages.length}` : '0'} />
                </div>
                {displayError && <p className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{displayError}</p>}
                {status?.qrCodeDataUrl && (
                  <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-sm font-bold text-slate-700">QR de vinculacion</p>
                    <img src={status.qrCodeDataUrl} alt={`QR de ${channel.label}`} className="h-56 w-56 rounded-md border border-slate-200 bg-white p-2" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => startLinkedSession(channel.key)}
                    disabled={status?.ready || status?.initializing}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {status?.ready ? 'Numero vinculado' : status?.initializing ? 'Iniciando...' : 'Iniciar QR'}
                  </button>
                  <button
                    className="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => stopLinkedSession(channel.key)}
                    disabled={!canStopSession}
                  >
                    <X className="h-4 w-4" />
                    Desvincular
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WhatsappInbox({ api, onMessage, onDraft, currentRole }: { api: ReturnType<typeof useApi>; onMessage: (m: string) => void; onDraft: (draft: WhatsappDraft) => void; currentRole: string }) {
  const [messages, setMessages] = useState<IncomingWhatsappMessage[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [selectedConversationKey, setSelectedConversationKey] = useState('')
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
      const channelKey = normalizeWhatsappChannelKey(item.apiResponse?.channelKey)
      const groupKey = `${channelKey}:${digits}`
      const current = grouped.get(groupKey) ?? []
      current.push(item)
      grouped.set(groupKey, current)
    }

    return [...grouped.entries()]
      .map(([conversationKey, items]) => {
        const sortedItems = [...items].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
        const latest = sortedItems[sortedItems.length - 1]
        const phoneDigits = normalizePhoneForMatching(latest.destinationPhone)
        const channelKey = normalizeWhatsappChannelKey(latest.apiResponse?.channelKey)
        const order = [...sortedItems].reverse().find((item) => item.order)?.order ?? undefined
        const client = order?.client ?? clients.find((row) => normalizePhoneForMatching(row.phone) === phoneDigits)
        const displayName = client ? `${client.firstName} ${client.lastName}` : latest.apiResponse?.pushName?.trim() || formatPhoneForDisplay(latest.destinationPhone)
        return {
          conversationKey,
          phone: latest.destinationPhone,
          phoneDigits,
          displayName,
          channelKey,
          channelLabel: normalizeWhatsappChannelLabel(latest.apiResponse?.channelKey, latest.apiResponse?.channelLabel),
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
    for (const channel of WHATSAPP_CHANNELS) {
      map.set(channel.key, channel.label)
    }
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
      ambiguous: messages.filter((item) => item.apiResponse?.reason === 'missing_order_code').length,
    }
  }, [conversations, messages])

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase()
    return conversations.filter((conversation) => {
      if (channelFilter !== 'ALL' && conversation.channelKey !== channelFilter) return false
      const matchesText = conversation.items.some((item) => (item.message ?? '').toLowerCase().includes(term))
      const matchesTerm = !term || conversation.displayName.toLowerCase().includes(term) || conversation.phoneDigits.includes(term.replace(/\D/g, '')) || (conversation.order?.orderCode.toLowerCase().includes(term) ?? false) || matchesText
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
      setSelectedConversationKey('')
      return
    }
    if (!selectedConversationKey || !filteredConversations.some((conversation) => conversation.conversationKey === selectedConversationKey)) {
      setSelectedConversationKey(filteredConversations[0].conversationKey)
    }
  }, [filteredConversations, selectedConversationKey])

  const selectedConversation = filteredConversations.find((conversation) => conversation.conversationKey === selectedConversationKey)
  const canReplySelectedChannel = !selectedConversation || selectedConversation.channelKey !== 'SALES_SUPPORT' || ['ADMIN', 'TECNICO'].includes(currentRole)

  const openConversationDraft = () => {
    if (!selectedConversation) return onMessage('Seleccione una conversacion para preparar el mensaje.')
    if (!canReplySelectedChannel) return onMessage('Solo ADMIN o TECNICO puede responder desde Ventas y atencion.')
    const draft = buildManualWhatsappDraft(selectedConversation.phone, conversationDraft)
    if (draft.notice) return onMessage(draft.notice)
    if (draft.draft) onDraft({ ...draft.draft, channelKey: selectedConversation.channelKey, orderId: selectedConversation.order?.id, title: `Conversacion ${selectedConversation.displayName}` })
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold">Conversaciones y respuestas de presupuesto</h2>
            <p className="text-sm text-slate-600">Revise chats, respuestas aceptadas, rechazos, pendientes y mensajes ambiguos desde un solo lugar.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <Status label="Conversaciones" value={String(dashboard.totalConversations)} />
          <Status label="Respondieron" value={String(dashboard.responded)} />
          <Status label="Aceptaron" value={String(dashboard.accepted)} />
          <Status label="Rechazaron" value={String(dashboard.rejected)} />
          <Status label="Pendientes" value={String(dashboard.pending)} />
          <Status label="Ambiguos" value={String(dashboard.ambiguous)} />
        </div>
      </div>

      <div className="wa-web-shell">
        <div className="wa-sidebar">
          <div className="wa-sidebar-header">
            <div>
              <h3>WhatsApp</h3>
              <span>{filteredConversations.length} chats registrados</span>
            </div>
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="wa-search">
            <MessageCircle className="h-4 w-4" />
            <input placeholder="Buscar un chat o iniciar busqueda" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="wa-channel-select" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
            <option value="ALL">Todos los canales</option>
            {channelOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
          <div className="wa-filter-tabs">
            {[
              ['ALL', 'Todos'],
              ['RESPONDED', 'Respondidos'],
              ['ACCEPTED', 'Aceptados'],
              ['REJECTED', 'Rechazados'],
              ['PENDING', 'Pendientes'],
            ].map(([value, label]) => (
              <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value as typeof filter)}>
                {label}
              </button>
            ))}
          </div>
          <div className="wa-chat-list">
            {filteredConversations.length ? filteredConversations.map((conversation) => {
              const latest = conversation.items[conversation.items.length - 1]
              return (
                <button key={conversation.conversationKey} className={`wa-chat-item ${conversation.conversationKey === selectedConversationKey ? 'active' : ''}`} onClick={() => setSelectedConversationKey(conversation.conversationKey)}>
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

        <div className="wa-conversation">
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
                  <button className="btn btn-secondary" onClick={() => setConversationDraft(`Hola ${selectedConversation.client?.firstName || selectedConversation.displayName}, le saluda el taller. En que podemos apoyarle?`)}>
                    <Plus className="h-4 w-4" />
                    Plantilla base
                  </button>
                </div>
              </div>

              <div className="wa-message-area">
                {selectedConversation.items.map((item) => {
                  const inbound = item.template === 'incoming_message'
                  const system = item.apiResponse?.direction === 'SYSTEM' || item.template.startsWith('auto_')
                  return (
                    <div key={item.id} className={`wa-message-line ${system ? 'system' : inbound ? 'inbound' : 'outbound'}`}>
                      <div className={`wa-bubble ${system ? 'system' : inbound ? 'inbound' : 'outbound'}`}>
                        <p className="whitespace-pre-wrap">{item.message || 'Sin texto'}</p>
                        <p className={`mt-2 text-[11px] ${system || inbound ? 'text-slate-500' : 'text-teal-100'}`}>{new Date(item.sentAt).toLocaleString()} - {describeWhatsappEventLabel(item)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="wa-compose-panel">
                <p className="mb-2 text-sm font-bold text-slate-700">Responder desde este panel</p>
                <textarea className="field min-h-[120px]" placeholder="Escriba aqui el mensaje para el cliente" value={conversationDraft} onChange={(e) => setConversationDraft(e.target.value)} />
                <div className="mt-3 flex flex-wrap justify-between gap-2">
                  <p className="text-xs text-slate-500">{canReplySelectedChannel ? 'El envio sigue pasando por la vista previa para mantener control interno.' : 'Solo ADMIN o TECNICO puede responder desde Ventas y atencion.'}</p>
                  <button className="btn btn-primary" onClick={openConversationDraft} disabled={!canReplySelectedChannel}>
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
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [error, setError] = useState('')
  const load = () => axios.get(`${API_URL}/public/tracking/${orderCode}?token=${token}`).then((r) => setData(r.data)).catch(() => setError('No se encontro la orden o el token no es valido.'))
  useEffect(() => {
    load()
    axios.get(`${API_URL}/public/settings`).then((response) => setSettings(response.data)).catch(() => null)
  }, [orderCode, token])
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
  const logoUrl = settings?.hasLogo ? publicBackendUrl(settings.logoUrl, settings.logoUpdatedAt ?? settings.updatedAt) : ''
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            {logoUrl ? <img className="h-16 w-20 object-contain" src={logoUrl} alt="Logotipo del taller" /> : <div className="grid h-16 w-20 place-items-center rounded-lg bg-sky-100 font-extrabold text-sky-700">ST</div>}
            <div>
              <p className="text-sm font-bold uppercase text-teal-700">Rastreo publico</p>
              <h1 className="text-2xl font-extrabold">{orderCode}</h1>
              <p className="text-sm font-semibold text-slate-600">{shopDisplayName(settings)}</p>
            </div>
          </div>
          {settings?.whatsapp && <p className="text-sm font-bold text-slate-600">WhatsApp {settings.whatsapp}</p>}
        </div>
        {error && <p className="mt-4 font-semibold text-red-700">{error}</p>}
        {data && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
              <p className="text-sm font-bold uppercase text-teal-700">Estado actual</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold">{customerStatusMessage(data.status)}</h2>
                <span className={`status-pill ${statusClass(data.status)}`}>{formatStatus(data.status)}</span>
              </div>
            </div>
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
                  <p className="pt-2 font-extrabold">Total {currentCurrencySymbol} {Number(data.totalCost).toFixed(2)}</p>
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
            <PublicRepairTimeline history={data.history} currentStatus={data.status} />
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
  headerAction,
  submitClassName,
  hideSubmit = false,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  onSubmit: (e: React.FormEvent) => void
  submitLabel?: string
  onCancel?: () => void
  headerAction?: React.ReactNode
  submitClassName?: string
  hideSubmit?: boolean
}) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">{icon}{title}</h2>
        {headerAction}
      </div>
      <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-2">
        {children}
        <div className="md:col-span-2 flex flex-wrap justify-center gap-2">
          {!hideSubmit && <button className={`btn btn-primary ${submitClassName ?? 'flex-1'}`}><Plus className="h-4 w-4" />{submitLabel}</button>}
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

function EvidenceImage({ api, orderId, evidence }: { api: ReturnType<typeof useApi>; orderId: number; evidence: Evidence }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true
    let objectUrl = ''
    api.get(`/orders/${orderId}/evidences/${evidence.id}/file`, { responseType: 'blob' }).then((response) => {
      objectUrl = URL.createObjectURL(response.data)
      if (alive) setUrl(objectUrl)
    }).catch(() => null)
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [api, orderId, evidence.id])
  if (!url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-md bg-slate-200 text-slate-500">
        <ImageIcon className="h-6 w-6" />
      </div>
    )
  }
  return <img className="aspect-video w-full rounded-md object-cover" src={url} alt={evidence.description || evidence.originalName} />
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
      const { data } = await api.post('/whatsapp/send', { orderId: draft.orderId, phone: draft.phone, message: draft.message, channelKey: draft.channelKey ?? 'ORDERS' })
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
  if (typeof FormData !== 'undefined' && value instanceof FormData) return value
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shouldPreserveInputValue(key) ? item : normalizePayload(item)])) as T
  }
  return value
}

function shouldPreserveInputValue(key: string) {
  return ['password', 'username', 'unlockCredentialValue'].includes(key)
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message.join(', ')
    return message ?? error.message
  }
  return 'No se pudo completar la accion solicitada'
}

async function downloadBlob(api: ReturnType<typeof useApi>, path: string, fallbackName: string) {
  const response = await api.get(path, { responseType: 'blob' })
  const disposition = response.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? fallbackName
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
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
  const totalBlock = totalCost && totalCost > 0 ? `💰 Presupuesto estimado: ${currentCurrencySymbol} ${totalCost.toFixed(2)}\n\n` : ''
  const text = `📋🔧 Estimado/a ${order.client.firstName}:\n\nYa tenemos listo el presupuesto de su equipo correspondiente a la orden:\n🧾 ${order.orderCode}\n\n${diagnosisBlock}${totalBlock}🌐 Puede revisar el detalle completo y autorizar el servicio en el siguiente enlace:\n🔗 ${trackingUrl}\n\n💬 Puede responder directamente por este medio con alguna de estas opciones:\n\n✅ SI ACEPTO ${order.orderCode}\n→ Para autorizar la reparacion.\n\n❌ NO ACEPTO ${order.orderCode}\n→ Si desea retirar su equipo sin reparar.\n\n⏳ Si necesita apoyo adicional, con gusto le orientamos.\n🙏 Gracias por confiar en nosotros.`
  return { draft: { orderId: order.id, phone, message: text, title: `Presupuesto ${order.orderCode}` } }
}

function buildShortBudgetWhatsappDraft(order: Pick<Order, 'id' | 'orderCode' | 'trackingToken' | 'client'>, diagnosis: string, totalCost?: number) {
  const digits = order.client.phone?.replace(/\D/g, '') ?? ''
  const trackingUrl = buildTrackingUrl(order.orderCode, order.trackingToken)
  const shortCode = shortOrderCode(order.orderCode)
  if (!digits || order.client.phone.toLowerCase().includes('sin telefono')) {
    return { notice: 'El cliente no tiene telefono registrado. El diagnostico queda disponible en el codigo QR del ticket.' }
  }
  const phone = normalizeWhatsappPhone(order.client.phone)
  const diagnosisBlock = diagnosis.trim() ? `Diagnostico tecnico:\n${diagnosis.trim()}\n\n` : ''
  const totalBlock = totalCost && totalCost > 0 ? `Presupuesto: ${currentCurrencySymbol} ${totalCost.toFixed(2)}\n\n` : ''
  const text = `Hola ${order.client.firstName}. Ya tenemos el presupuesto de su equipo.\n\nOrden: ${shortCode} (${order.orderCode})\n${diagnosisBlock}${totalBlock}Detalle y autorizacion web:\n${trackingUrl}\n\nPara responder por WhatsApp escriba solo:\nSI ${shortCode} = acepta\nNO ${shortCode} = rechaza\n\nSi solo tiene una orden pendiente, tambien puede responder solo SI o NO.`
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

function shortOrderCode(orderCode: string) {
  return orderCode.match(/\d{5}$/)?.[0] ?? orderCode
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ')
}

function sortTimelineDescending(history?: OrderHistoryEvent[]) {
  return (history ?? []).slice().sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
}

function customerStatusMessage(status: string) {
  if (status === 'CREADO') return 'Orden recibida'
  if (status === 'EN_REVISION') return 'Equipo en revision'
  if (status === 'ESPERANDO_PRESUPUESTO') return 'Preparando presupuesto'
  if (status === 'PRESUPUESTO_ENVIADO') return 'Presupuesto enviado'
  if (status === 'PRESUPUESTO_ACEPTADO') return 'Presupuesto aceptado'
  if (status === 'PRESUPUESTO_RECHAZADO') return 'Presupuesto rechazado'
  if (status === 'EN_REPARACION') return 'Equipo en reparacion'
  if (status === 'LISTO_PARA_RECOGER') return 'Listo para recoger'
  if (status === 'FINALIZADO') return 'Servicio finalizado'
  if (status === 'DEVUELTO_SIN_REPARAR') return 'Devuelto sin reparar'
  return formatStatus(status)
}

function formatDateTime(value?: string | Date | null) {
  return value ? new Date(value).toLocaleString('es-GT') : 'N/A'
}

/** Símbolo de moneda activo según la configuración del sistema.
 * Se actualiza automáticamente al cargar los ajustes del taller.
 * GTQ (Quetzal guatemalteco) → símbolo: Q
 */
let currentCurrencySymbol = 'Q'

export function setCurrencySymbol(symbol: string) {
  currentCurrencySymbol = symbol && symbol.trim() ? symbol.trim() : 'Q'
}

function moneyGTQ(value?: number | string | null) {
  const symbol = currentCurrencySymbol === 'P' ? 'Q' : currentCurrencySymbol // Safeguard contra cache/glitches
  return `${symbol} ${Number(value ?? 0).toFixed(2)}`
}

function shortChartLabel(value: string) {
  return value
    .replace('Pagos de ordenes', 'Ordenes')
    .replace('Ventas inventario', 'Ventas')
    .replace('Costo repuestos', 'Costos')
    .replace('Gastos registrados', 'Gastos') // legacy label
    .replace(/^Gastos$/, 'Gastos')            // label actual
    .replace('Ganancia neta', 'Ganancia')
}

function serviceLineLabel(serviceLine?: string) {
  return SERVICE_LINES.find((line) => line.key === serviceLine)?.label ?? 'Sin linea'
}

function shouldRequestCredential(equipmentType?: EquipmentType) {
  return Boolean(
    equipmentType?.serviceLine === 'TELEFONIA'
      || equipmentType?.requiresCredential
  )
}

function formatApprovalMethod(method: string) {
  if (method === 'PUBLIC_TRACKING') return 'Rastreo publico'
  if (method === 'WHATSAPP') return 'WhatsApp'
  if (method === 'IN_PERSON') return 'Atencion en taller'
  return method.replaceAll('_', ' ')
}

function statusClass(status: string) {
  if (status === 'CREADO') return 'status-created'
  if (status === 'EN_REVISION' || status === 'ESPERANDO_PRESUPUESTO') return 'status-review'
  if (status === 'PRESUPUESTO_ENVIADO') return 'status-quote'
  if (status === 'PRESUPUESTO_ACEPTADO') return 'status-accepted'
  if (status === 'EN_REPARACION') return 'status-repair'
  if (status === 'LISTO_PARA_RECOGER') return 'status-ready'
  if (status === 'FINALIZADO') return 'status-done'
  if (status === 'PRESUPUESTO_RECHAZADO' || status === 'DEVUELTO_SIN_REPARAR') return 'status-rejected'
  return ''
}

function statusColor(status: string) {
  if (status === 'CREADO') return '#0ea5e9'
  if (status === 'EN_REVISION' || status === 'ESPERANDO_PRESUPUESTO') return '#7c3aed'
  if (status === 'PRESUPUESTO_ENVIADO') return '#f59e0b'
  if (status === 'PRESUPUESTO_ACEPTADO') return '#08ad63'
  if (status === 'EN_REPARACION') return '#16a34a'
  if (status === 'LISTO_PARA_RECOGER') return '#14b8a6'
  if (status === 'FINALIZADO') return '#64748b'
  if (status === 'PRESUPUESTO_RECHAZADO' || status === 'DEVUELTO_SIN_REPARAR') return '#dc2626'
  return '#2f90c4'
}

export function buildStatusGradient(rows: { status: string; count: number }[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  if (!total) return '#e8f1f8'
  let current = 0
  const segments = rows.map((row) => {
    const start = current
    current += (row.count / total) * 360
    return `${statusColor(row.status)} ${start}deg ${current}deg`
  })
  return `conic-gradient(${segments.join(', ')})`
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

function formatClientName(client?: Pick<Client, 'firstName' | 'lastName'>) {
  const rawName = [client?.firstName, client?.lastName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  const invertedMatch = rawName.match(/^(.+?)\s+DE\s+(.+)$/i)
  if (invertedMatch) {
    const surname = invertedMatch[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const names = invertedMatch[2]
    return `${names} ${surname}`.replace(/\s+/g, ' ').trim()
  }
  return rawName
}

function describeWhatsappEventLabel(item: IncomingWhatsappMessage) {
  if (item.template === 'incoming_message') return 'Mensaje recibido'
  if (item.template === 'auto_quote_decision') return item.apiResponse?.decision === 'ACCEPTED' ? 'Respuesta interpretada: presupuesto aceptado' : 'Respuesta interpretada: presupuesto rechazado'
  if (item.template === 'auto_reply_missing_order_code') return 'Respuesta ambigua: se pidio codigo de orden'
  if (item.deliveryStatus === 'PROCESSED') return 'Procesado por el sistema'
  if (item.deliveryStatus === 'SENT') return item.order?.orderCode ? `Enviado - ${item.order.orderCode}` : 'Enviado'
  if (item.deliveryStatus === 'PENDING') return 'Pendiente por sesion'
  if (item.deliveryStatus === 'FAILED') return 'Envio fallido'
  return item.deliveryStatus
}

function normalizeWhatsappChannelKey(value?: string | null) {
  if (value === 'SALES_SUPPORT') return 'SALES_SUPPORT'
  return 'ORDERS'
}

function normalizeWhatsappChannelLabel(key?: string | null, label?: string | null) {
  const normalized = normalizeWhatsappChannelKey(key)
  return WHATSAPP_CHANNELS.find((channel) => channel.key === normalized)?.label ?? label ?? 'Canal ordenes'
}

void buildBudgetWhatsappDraft

export default App
