import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  Boxes,
  Building2,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  Edit3,
  Filter,
  History,
  Home,
  MapPin,
  PackagePlus,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import {
  isCloudStorageEnabled,
  loadInventoryState,
  loadSharedInventoryState,
  saveInventoryState,
  saveSharedInventoryState,
} from './lib/storage'

const nowIso = () => new Date().toISOString()
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`

const categories = ['Rodaje', 'Camara', 'Data', 'Post', 'Computadoras', 'Muebles', 'Oficina', 'Otros']
const statuses = ['Oficina', 'Rodaje', 'Prestado', 'Mantenimiento', 'Deposito', 'Archivado']
const conditions = ['OK', 'Revisar', 'Danado']

const defaultOwners = [
  { id: 'owner-gbf', name: 'Gran Berta Films', type: 'Empresa', contact: 'Equipo GBF' },
  { id: 'owner-bani', name: 'BANI VFX', type: 'Empresa', contact: 'Post / VFX' },
  { id: 'owner-crew', name: 'Crew GBG', type: 'Equipo', contact: 'Produccion' },
  { id: 'owner-unassigned', name: 'Sin asignar', type: 'Pendiente', contact: '' },
]

const defaultLocations = [
  { id: 'loc-office', name: 'Oficina', detail: 'Base GBG' },
  { id: 'loc-studio', name: 'Estudio', detail: 'Uso interno' },
  { id: 'loc-shoot', name: 'Rodaje', detail: 'Fuera de oficina' },
  { id: 'loc-loan', name: 'Prestamo', detail: 'Con responsable externo' },
  { id: 'loc-storage', name: 'Deposito', detail: 'Guardado' },
]

const assetSeed = [
  {
    code: 'GBG-0001',
    name: 'Tripode Manfrotto 504',
    category: 'Rodaje',
    ownerId: 'owner-gbf',
    custodyId: 'owner-crew',
    locationId: 'loc-office',
    status: 'Oficina',
    condition: 'OK',
    serial: 'TRI-504-A',
    purchaseDate: '2025-11-12',
    purchaseValue: 780,
    tags: ['tripode', 'camara'],
    notes: 'Cabezal fluido y placa rapida incluidos.',
  },
  {
    code: 'GBG-0002',
    name: 'Memoria SD 128GB V90',
    category: 'Data',
    ownerId: 'owner-gbf',
    custodyId: 'owner-crew',
    locationId: 'loc-shoot',
    status: 'Rodaje',
    condition: 'OK',
    serial: 'SD-V90-128-01',
    purchaseDate: '2026-02-18',
    purchaseValue: 120,
    tags: ['memoria', 'data'],
    notes: 'Rotular siempre antes de salir a rodaje.',
  },
  {
    code: 'GBG-0003',
    name: 'SSD Samsung T7 2TB',
    category: 'Data',
    ownerId: 'owner-bani',
    custodyId: 'owner-bani',
    locationId: 'loc-studio',
    status: 'Oficina',
    condition: 'OK',
    serial: 'SSD-T7-2TB-02',
    purchaseDate: '2025-08-04',
    purchaseValue: 190,
    tags: ['backup', 'post'],
    notes: 'Disco de transferencia entre rodaje y post.',
  },
  {
    code: 'GBG-0004',
    name: 'Notebook Dell XPS 15',
    category: 'Computadoras',
    ownerId: 'owner-gbf',
    custodyId: 'owner-crew',
    locationId: 'loc-office',
    status: 'Oficina',
    condition: 'Revisar',
    serial: 'XPS15-GBG-01',
    purchaseDate: '2024-09-20',
    purchaseValue: 2200,
    tags: ['notebook', 'produccion'],
    notes: 'Revisar bateria antes de viajes largos.',
  },
  {
    code: 'GBG-0005',
    name: 'Mesa plegable negra',
    category: 'Muebles',
    ownerId: 'owner-gbf',
    custodyId: 'owner-gbf',
    locationId: 'loc-storage',
    status: 'Deposito',
    condition: 'OK',
    serial: '',
    purchaseDate: '2025-03-10',
    purchaseValue: 95,
    tags: ['oficina', 'rodaje'],
    notes: 'Mesa auxiliar para produccion.',
  },
]

const makeHistory = (description, type = 'Alta') => ({
  id: makeId(),
  at: nowIso(),
  type,
  description,
})

const defaultAssets = assetSeed.map((asset) => ({
  id: makeId(),
  createdAt: nowIso(),
  updatedAt: nowIso(),
  history: [makeHistory('Activo cargado en inventario inicial.')],
  ...asset,
}))

const defaultInventory = {
  assets: defaultAssets,
  owners: defaultOwners,
  locations: defaultLocations,
  activity: defaultAssets.slice(0, 4).map((asset) => ({
    id: makeId(),
    at: nowIso(),
    assetId: asset.id,
    text: `${asset.code} cargado en inventario inicial.`,
  })),
}

const cloudErrorStatus = (error, fallback = 'Error de nube') => {
  const message = String(error?.message || error || '')
  if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('permission')) return 'Nube sin permisos'
  if (message.includes('404') || message.includes('42P01') || message.toLowerCase().includes('does not exist')) return 'Falta tabla nube'
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.toLowerCase().includes('resolve')) return 'Nube sin conexion'
  return fallback
}

const normalizeInventory = (state) => ({
  assets: Array.isArray(state?.assets) ? state.assets : defaultInventory.assets,
  owners: Array.isArray(state?.owners) && state.owners.length ? state.owners : defaultInventory.owners,
  locations: Array.isArray(state?.locations) && state.locations.length ? state.locations : defaultInventory.locations,
  activity: Array.isArray(state?.activity) ? state.activity : [],
})

const nextCode = (assets) => {
  const max = assets.reduce((highest, asset) => {
    const match = String(asset.code || '').match(/GBG-(\d+)/)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `GBG-${String(max + 1).padStart(4, '0')}`
}

const createEmptyDraft = (assets) => ({
  id: '',
  code: nextCode(assets),
  name: '',
  category: 'Rodaje',
  ownerId: 'owner-gbf',
  custodyId: 'owner-crew',
  locationId: 'loc-office',
  status: 'Oficina',
  condition: 'OK',
  serial: '',
  purchaseDate: '',
  purchaseValue: '',
  tags: '',
  notes: '',
})

const assetToDraft = (asset) => ({
  ...asset,
  purchaseValue: asset.purchaseValue || '',
  tags: (asset.tags || []).join(', '),
})

const draftToAsset = (draft) => ({
  code: draft.code.trim(),
  name: draft.name.trim(),
  category: draft.category,
  ownerId: draft.ownerId,
  custodyId: draft.custodyId,
  locationId: draft.locationId,
  status: draft.status,
  condition: draft.condition,
  serial: draft.serial.trim(),
  purchaseDate: draft.purchaseDate,
  purchaseValue: Number(draft.purchaseValue) || 0,
  tags: String(draft.tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean),
  notes: draft.notes.trim(),
})

const formatMoney = (value) => {
  if (!value) return '-'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]))

function App() {
  const [inventory, setInventory] = useState(() => normalizeInventory(loadInventoryState(defaultInventory)))
  const [section, setSection] = useState('overview')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [draft, setDraft] = useState(() => createEmptyDraft(inventory.assets))
  const [editorOpen, setEditorOpen] = useState(false)
  const [deletePrompt, setDeletePrompt] = useState(null)
  const [filters, setFilters] = useState({ search: '', category: 'Todos', status: 'Todos', ownerId: 'Todos', locationId: 'Todos' })
  const [movement, setMovement] = useState({
    assetId: inventory.assets[0]?.id || '',
    locationId: inventory.assets[0]?.locationId || 'loc-office',
    status: inventory.assets[0]?.status || 'Oficina',
    custodyId: inventory.assets[0]?.custodyId || 'owner-crew',
    note: '',
  })
  const [newOwner, setNewOwner] = useState({ name: '', type: 'Empresa', contact: '' })
  const [newLocation, setNewLocation] = useState({ name: '', detail: '' })
  const [cloudLoaded, setCloudLoaded] = useState(!isCloudStorageEnabled())
  const [cloudStatus, setCloudStatus] = useState(isCloudStorageEnabled() ? 'Conectando nube...' : 'Modo local')
  const saveTimer = useRef(null)
  const initialInventory = useRef(inventory)

  const ownersById = useMemo(() => byId(inventory.owners), [inventory.owners])
  const locationsById = useMemo(() => byId(inventory.locations), [inventory.locations])
  const movementAsset = inventory.assets.find((asset) => asset.id === movement.assetId)

  const stats = useMemo(() => {
    const totalValue = inventory.assets.reduce((sum, asset) => sum + (Number(asset.purchaseValue) || 0), 0)
    const officeCount = inventory.assets.filter((asset) => asset.status === 'Oficina').length
    const outCount = inventory.assets.filter((asset) => ['Rodaje', 'Prestado'].includes(asset.status)).length
    const maintenanceCount = inventory.assets.filter((asset) => asset.status === 'Mantenimiento' || asset.condition !== 'OK').length
    const byStatus = statuses.map((status) => ({
      status,
      count: inventory.assets.filter((asset) => asset.status === status).length,
    }))
    return { totalValue, officeCount, outCount, maintenanceCount, byStatus }
  }, [inventory.assets])

  const filteredAssets = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return inventory.assets.filter((asset) => {
      const text = [
        asset.code,
        asset.name,
        asset.category,
        asset.serial,
        asset.notes,
        ownersById[asset.ownerId]?.name,
        ownersById[asset.custodyId]?.name,
        locationsById[asset.locationId]?.name,
        ...(asset.tags || []),
      ].join(' ').toLowerCase()
      if (query && !text.includes(query)) return false
      if (filters.category !== 'Todos' && asset.category !== filters.category) return false
      if (filters.status !== 'Todos' && asset.status !== filters.status) return false
      if (filters.ownerId !== 'Todos' && asset.ownerId !== filters.ownerId) return false
      if (filters.locationId !== 'Todos' && asset.locationId !== filters.locationId) return false
      return true
    })
  }, [filters, inventory.assets, locationsById, ownersById])

  useEffect(() => {
    saveInventoryState(inventory)
  }, [inventory])

  useEffect(() => {
    if (!isCloudStorageEnabled()) return undefined
    let cancelled = false
    const hydrateCloud = async () => {
      try {
        const sharedState = await loadSharedInventoryState()
        if (cancelled) return
        if (sharedState?.assets) {
          const normalized = normalizeInventory(sharedState)
          setInventory(normalized)
          setMovement((current) => ({
            ...current,
            assetId: normalized.assets.some((asset) => asset.id === current.assetId) ? current.assetId : normalized.assets[0]?.id || '',
          }))
        } else {
          await saveSharedInventoryState(initialInventory.current)
        }
        setCloudStatus('Nube sincronizada')
      } catch (error) {
        if (!cancelled) setCloudStatus(cloudErrorStatus(error, 'Sin conexion a nube'))
      } finally {
        if (!cancelled) setCloudLoaded(true)
      }
    }
    hydrateCloud()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!cloudLoaded || !isCloudStorageEnabled()) return undefined
    setCloudStatus('Guardando en nube...')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveSharedInventoryState(inventory)
        .then(() => setCloudStatus('Nube sincronizada'))
        .catch((error) => setCloudStatus(cloudErrorStatus(error, 'No se pudo guardar en nube')))
    }, 450)
    return () => clearTimeout(saveTimer.current)
  }, [cloudLoaded, inventory])

  useEffect(() => {
    if (!movementAsset && inventory.assets[0]) {
      setMovement((current) => ({
        ...current,
        assetId: inventory.assets[0].id,
        locationId: inventory.assets[0].locationId,
        status: inventory.assets[0].status,
        custodyId: inventory.assets[0].custodyId,
      }))
    }
  }, [inventory.assets, movementAsset])

  const ownerName = (id) => ownersById[id]?.name || 'Sin asignar'
  const locationName = (id) => locationsById[id]?.name || 'Sin ubicacion'

  const pushActivity = (state, asset, text) => ({
    ...state,
    activity: [
      { id: makeId(), at: nowIso(), assetId: asset.id, text },
      ...(state.activity || []),
    ].slice(0, 80),
  })

  const startNewAsset = () => {
    setSelectedAssetId('')
    setDraft(createEmptyDraft(inventory.assets))
    setEditorOpen(true)
    setSection('inventory')
  }

  const selectAsset = (assetId) => {
    startEditAsset(assetId)
  }

  const startEditAsset = (assetId) => {
    const asset = inventory.assets.find((item) => item.id === assetId)
    if (!asset) return
    setSelectedAssetId(assetId)
    setDraft(assetToDraft(asset))
    setEditorOpen(true)
    setSection('inventory')
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setSelectedAssetId('')
    setDraft(createEmptyDraft(inventory.assets))
  }

  const saveAsset = () => {
    if (!draft.name.trim()) return
    const data = draftToAsset(draft)
    const newAssetId = draft.id ? '' : makeId()
    setInventory((current) => {
      if (draft.id) {
        const previous = current.assets.find((asset) => asset.id === draft.id)
        if (!previous) return current
        const changes = []
        if (previous.locationId !== data.locationId) changes.push(`Ubicacion: ${locationName(previous.locationId)} -> ${locationName(data.locationId)}`)
        if (previous.status !== data.status) changes.push(`Estado: ${previous.status} -> ${data.status}`)
        if (previous.custodyId !== data.custodyId) changes.push(`Responsable: ${ownerName(previous.custodyId)} -> ${ownerName(data.custodyId)}`)
        if (previous.condition !== data.condition) changes.push(`Condicion: ${previous.condition} -> ${data.condition}`)
        const description = changes.length ? changes.join(' | ') : 'Ficha actualizada.'
        const updatedAsset = {
          ...previous,
          ...data,
          updatedAt: nowIso(),
          history: [makeHistory(description, changes.length ? 'Movimiento' : 'Edicion'), ...(previous.history || [])].slice(0, 80),
        }
        const nextState = {
          ...current,
          assets: current.assets.map((asset) => (asset.id === draft.id ? updatedAsset : asset)),
        }
        return pushActivity(nextState, updatedAsset, `${updatedAsset.code} - ${description}`)
      }
      const newAsset = {
        id: newAssetId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        history: [makeHistory('Activo creado desde la app.')],
        ...data,
      }
      const nextState = { ...current, assets: [newAsset, ...current.assets] }
      return pushActivity(nextState, newAsset, `${newAsset.code} creado en inventario.`)
    })
    closeEditor()
  }

  const requestDeleteAsset = (assetId) => {
    const asset = inventory.assets.find((item) => item.id === assetId)
    if (!asset) return
    setDeletePrompt(asset)
  }

  const confirmDeleteAsset = () => {
    if (!deletePrompt) return
    const asset = deletePrompt
    setInventory((current) => ({
      ...current,
      assets: current.assets.filter((item) => item.id !== asset.id),
      activity: [
        { id: makeId(), at: nowIso(), assetId: asset.id, text: `${asset.code} eliminado del inventario.` },
        ...(current.activity || []),
      ].slice(0, 80),
    }))
    if (selectedAssetId === asset.id) closeEditor()
    setDeletePrompt(null)
  }

  const applyMovement = () => {
    const asset = inventory.assets.find((item) => item.id === movement.assetId)
    if (!asset) return
    const changes = []
    if (asset.locationId !== movement.locationId) changes.push(`Ubicacion: ${locationName(asset.locationId)} -> ${locationName(movement.locationId)}`)
    if (asset.status !== movement.status) changes.push(`Estado: ${asset.status} -> ${movement.status}`)
    if (asset.custodyId !== movement.custodyId) changes.push(`Responsable: ${ownerName(asset.custodyId)} -> ${ownerName(movement.custodyId)}`)
    const description = [changes.join(' | '), movement.note.trim()].filter(Boolean).join(' - ') || 'Movimiento registrado.'
    const updatedAsset = {
      ...asset,
      locationId: movement.locationId,
      status: movement.status,
      custodyId: movement.custodyId,
      updatedAt: nowIso(),
      history: [makeHistory(description, 'Movimiento'), ...(asset.history || [])].slice(0, 80),
    }
    setInventory((current) => {
      const nextState = {
        ...current,
        assets: current.assets.map((item) => (item.id === asset.id ? updatedAsset : item)),
      }
      return pushActivity(nextState, updatedAsset, `${updatedAsset.code} - ${description}`)
    })
    setSelectedAssetId(asset.id)
    setMovement((current) => ({ ...current, note: '' }))
  }

  const addOwner = () => {
    if (!newOwner.name.trim()) return
    const owner = { id: makeId(), ...newOwner, name: newOwner.name.trim(), contact: newOwner.contact.trim() }
    setInventory((current) => ({ ...current, owners: [...current.owners, owner] }))
    setNewOwner({ name: '', type: 'Empresa', contact: '' })
  }

  const addLocation = () => {
    if (!newLocation.name.trim()) return
    const location = { id: makeId(), name: newLocation.name.trim(), detail: newLocation.detail.trim() }
    setInventory((current) => ({ ...current, locations: [...current.locations, location] }))
    setNewLocation({ name: '', detail: '' })
  }

  const exportCsv = () => {
    const headers = ['Codigo', 'Activo', 'Categoria', 'Duenio', 'Responsable', 'Ubicacion', 'Estado', 'Condicion', 'Serie', 'Compra', 'Valor', 'Tags', 'Notas']
    const rows = inventory.assets.map((asset) => [
      asset.code,
      asset.name,
      asset.category,
      ownerName(asset.ownerId),
      ownerName(asset.custodyId),
      locationName(asset.locationId),
      asset.status,
      asset.condition,
      asset.serial,
      asset.purchaseDate,
      asset.purchaseValue,
      (asset.tags || []).join(' / '),
      asset.notes,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventario-gbg-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <img src={`${import.meta.env.BASE_URL}gb-films-logo.png`} alt="GB Films" />
          <div>
            <strong>GBG</strong>
            <span>Inventario vivo</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Secciones">
          <NavButton active={section === 'overview'} icon={<Home />} label="Resumen" onClick={() => setSection('overview')} />
          <NavButton active={section === 'inventory'} icon={<Boxes />} label="Inventario" onClick={() => setSection('inventory')} />
          <NavButton active={section === 'movement'} icon={<MapPin />} label="Movimientos" onClick={() => setSection('movement')} />
          <NavButton active={section === 'owners'} icon={<Users />} label="Duenos y lugares" onClick={() => setSection('owners')} />
        </nav>

        <button className="primary full" onClick={startNewAsset}>
          <PackagePlus size={17} />
          Nuevo activo
        </button>

        <div className="side-total">
          <span>Valor cargado</span>
          <strong>{formatMoney(stats.totalValue)}</strong>
          <small>{inventory.assets.length} activos registrados</small>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Gran Berta Films</p>
            <h1>Inventario de activos</h1>
          </div>
          <div className="toolbar">
            <CloudPill enabled={isCloudStorageEnabled()} status={cloudStatus} />
            <button className="ghost" onClick={exportCsv} title="Exportar CSV">
              <Download size={16} />
              CSV
            </button>
          </div>
        </header>

        {section === 'overview' && (
          <Overview
            assets={inventory.assets}
            activity={inventory.activity}
            locationsById={locationsById}
            ownersById={ownersById}
            stats={stats}
            onSelectAsset={selectAsset}
          />
        )}

        {section === 'inventory' && (
          <InventorySection
            assets={filteredAssets}
            categories={categories}
            conditions={conditions}
            draft={draft}
            filters={filters}
            locations={inventory.locations}
            owners={inventory.owners}
            editorOpen={editorOpen}
            selectedAssetId={selectedAssetId}
            statuses={statuses}
            onCloseEditor={closeEditor}
            onDelete={requestDeleteAsset}
            onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onEdit={startEditAsset}
            onFilterChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onNew={startNewAsset}
            onSave={saveAsset}
          />
        )}

        {section === 'movement' && (
          <MovementSection
            assets={inventory.assets}
            locations={inventory.locations}
            movement={movement}
            owners={inventory.owners}
            selectedAsset={movementAsset}
            statuses={statuses}
            locationsById={locationsById}
            ownersById={ownersById}
            onApply={applyMovement}
            onMovementChange={(patch) => {
              setMovement((current) => {
                const next = { ...current, ...patch }
                if (patch.assetId) {
                  const asset = inventory.assets.find((item) => item.id === patch.assetId)
                  if (asset) {
                    next.locationId = asset.locationId
                    next.status = asset.status
                    next.custodyId = asset.custodyId
                  }
                }
                return next
              })
            }}
          />
        )}

        {section === 'owners' && (
          <OwnersSection
            assets={inventory.assets}
            locations={inventory.locations}
            newLocation={newLocation}
            newOwner={newOwner}
            owners={inventory.owners}
            onAddLocation={addLocation}
            onAddOwner={addOwner}
            onLocationChange={(patch) => setNewLocation((current) => ({ ...current, ...patch }))}
            onOwnerChange={(patch) => setNewOwner((current) => ({ ...current, ...patch }))}
          />
        )}

        {deletePrompt && (
          <ConfirmDialog
            asset={deletePrompt}
            onCancel={() => setDeletePrompt(null)}
            onConfirm={confirmDeleteAsset}
          />
        )}
      </main>
    </div>
  )
}

function Overview({ assets, activity, locationsById, ownersById, stats, onSelectAsset }) {
  const outAssets = assets.filter((asset) => ['Rodaje', 'Prestado', 'Mantenimiento'].includes(asset.status))
  return (
    <div className="view-stack">
      <section className="metric-grid">
        <MetricCard icon={<Boxes />} label="Activos" value={assets.length} detail="Total inventariado" />
        <MetricCard icon={<Home />} label="En oficina" value={stats.officeCount} detail="Disponibles o guardados" />
        <MetricCard icon={<MapPin />} label="Fuera" value={stats.outCount} detail="Rodaje o prestamo" />
        <MetricCard icon={<Wrench />} label="Revisar" value={stats.maintenanceCount} detail="Mantenimiento o condicion" />
      </section>

      <section className="dashboard-grid">
        <Panel title="Estado general" eyebrow="Disponibilidad" icon={<Filter />}>
          <div className="status-bars">
            {stats.byStatus.map((row) => (
              <div className="status-row" key={row.status}>
                <span>{row.status}</span>
                <div><i style={{ width: `${assets.length ? (row.count / assets.length) * 100 : 0}%` }} /></div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Fuera de base" eyebrow="Atencion" icon={<MapPin />}>
          <div className="asset-list compact">
            {outAssets.length ? outAssets.map((asset) => (
              <button key={asset.id} onClick={() => onSelectAsset(asset.id)}>
                <strong>{asset.code}</strong>
                <span>{asset.name}</span>
                <em>{locationsById[asset.locationId]?.name || 'Sin ubicacion'} - {ownersById[asset.custodyId]?.name || 'Sin responsable'}</em>
              </button>
            )) : <EmptyState title="Todo en base" body="No hay activos marcados como rodaje, prestamo o mantenimiento." />}
          </div>
        </Panel>
      </section>

      <Panel title="Ultima actividad" eyebrow="Registro compartido" icon={<History />}>
        <Timeline activity={activity} assetsById={byId(assets)} />
      </Panel>
    </div>
  )
}

function InventorySection({
  assets,
  categories,
  conditions,
  draft,
  filters,
  locations,
  owners,
  editorOpen,
  selectedAssetId,
  statuses,
  onCloseEditor,
  onDelete,
  onDraftChange,
  onEdit,
  onFilterChange,
  onNew,
  onSave,
}) {
  return (
    <div className={`inventory-layout ${editorOpen ? 'editor-open' : ''}`}>
      <section className="panel inventory-table-panel">
        <div className="panel-head">
          <Title eyebrow="Base completa" title="Activos" icon={<Boxes />} />
          <button className="ghost icon-only" onClick={onNew} title="Nuevo activo"><Plus size={18} /></button>
        </div>

        <div className="filters">
          <label className="search-field">
            <Search size={15} />
            <input value={filters.search} placeholder="Buscar por codigo, activo, tag, serie..." onChange={(event) => onFilterChange({ search: event.target.value })} />
          </label>
          <Select value={filters.category} onChange={(value) => onFilterChange({ category: value })} options={['Todos', ...categories]} />
          <Select value={filters.status} onChange={(value) => onFilterChange({ status: value })} options={['Todos', ...statuses]} />
          <Select value={filters.ownerId} onChange={(value) => onFilterChange({ ownerId: value })} options={[{ id: 'Todos', name: 'Todos los duenos' }, ...owners]} valueKey="id" labelKey="name" />
          <Select value={filters.locationId} onChange={(value) => onFilterChange({ locationId: value })} options={[{ id: 'Todos', name: 'Todas las ubicaciones' }, ...locations]} valueKey="id" labelKey="name" />
        </div>

        <div className="table-wrap">
          <table className="asset-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Activo</th>
                <th>Categoria</th>
                <th>Duenio</th>
                <th>Ubicacion</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const owner = owners.find((item) => item.id === asset.ownerId)?.name || 'Sin asignar'
                const location = locations.find((item) => item.id === asset.locationId)?.name || 'Sin ubicacion'
                return (
                  <tr key={asset.id} className={selectedAssetId === asset.id ? 'selected' : ''}>
                    <td><b>{asset.code}</b></td>
                    <td>
                      <strong>{asset.name}</strong>
                      <small>{asset.serial || 'Sin serie'} - {asset.condition}</small>
                    </td>
                    <td>{asset.category}</td>
                    <td>{owner}</td>
                    <td>{location}</td>
                    <td><StatusBadge status={asset.status} /></td>
                    <td>
                      <div className="row-actions">
                        <button className="ghost icon-only" onClick={() => onEdit(asset.id)} title="Editar activo"><Edit3 size={16} /></button>
                        <button className="ghost icon-only" onClick={() => onDelete(asset.id)} title="Eliminar activo"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!assets.length && <EmptyState title="Sin resultados" body="Ajusta los filtros o carga un nuevo activo." />}
        </div>
      </section>

      {editorOpen && <section className="panel editor-panel">
        <div className="panel-head">
          <Title eyebrow={draft.id ? 'Editar ficha' : 'Alta nueva'} title={draft.id ? draft.code : 'Nuevo activo'} icon={<Edit3 />} />
          <div className="row-actions">
            {draft.id && <button className="ghost icon-only" onClick={() => onDelete(draft.id)} title="Eliminar activo"><Trash2 size={17} /></button>}
            <button className="ghost icon-only" onClick={onCloseEditor} title="Cerrar editor"><X size={17} /></button>
          </div>
        </div>

        <div className="form-grid">
          <Input label="Codigo" value={draft.code} onChange={(value) => onDraftChange({ code: value })} />
          <Input label="Nombre del activo" value={draft.name} onChange={(value) => onDraftChange({ name: value })} />
          <Field label="Categoria"><Select value={draft.category} onChange={(value) => onDraftChange({ category: value })} options={categories} /></Field>
          <Field label="Estado"><Select value={draft.status} onChange={(value) => onDraftChange({ status: value })} options={statuses} /></Field>
          <Field label="Condicion"><Select value={draft.condition} onChange={(value) => onDraftChange({ condition: value })} options={conditions} /></Field>
          <Field label="Duenio"><Select value={draft.ownerId} onChange={(value) => onDraftChange({ ownerId: value })} options={owners} valueKey="id" labelKey="name" /></Field>
          <Field label="Responsable actual"><Select value={draft.custodyId} onChange={(value) => onDraftChange({ custodyId: value })} options={owners} valueKey="id" labelKey="name" /></Field>
          <Field label="Ubicacion"><Select value={draft.locationId} onChange={(value) => onDraftChange({ locationId: value })} options={locations} valueKey="id" labelKey="name" /></Field>
          <Input label="Serie / identificador" value={draft.serial} onChange={(value) => onDraftChange({ serial: value })} />
          <Input label="Fecha de compra" type="date" value={draft.purchaseDate} onChange={(value) => onDraftChange({ purchaseDate: value })} />
          <Input label="Valor estimado USD" type="number" value={draft.purchaseValue} onChange={(value) => onDraftChange({ purchaseValue: value })} />
          <Input label="Tags" value={draft.tags} onChange={(value) => onDraftChange({ tags: value })} placeholder="tripode, camara, data" />
          <label className="field wide">
            <span>Notas</span>
            <textarea value={draft.notes} onChange={(event) => onDraftChange({ notes: event.target.value })} />
          </label>
        </div>

        <div className="editor-actions">
          <button className="ghost" onClick={onCloseEditor}><X size={16} /> Cerrar</button>
          <button className="primary" onClick={onSave} disabled={!draft.name.trim()}><Save size={16} /> Guardar activo</button>
        </div>
      </section>}
    </div>
  )
}

function MovementSection({ assets, locations, movement, owners, selectedAsset, statuses, locationsById, ownersById, onApply, onMovementChange }) {
  return (
    <div className="movement-layout">
      <section className="panel">
        <Title eyebrow="Registro rapido" title="Mover activo" icon={<MapPin />} />
        <div className="form-grid movement-form">
          <Field label="Activo">
            <Select value={movement.assetId} onChange={(value) => onMovementChange({ assetId: value })} options={assets} valueKey="id" labelKey={(asset) => `${asset.code} - ${asset.name}`} />
          </Field>
          <Field label="Nueva ubicacion">
            <Select value={movement.locationId} onChange={(value) => onMovementChange({ locationId: value })} options={locations} valueKey="id" labelKey="name" />
          </Field>
          <Field label="Nuevo estado">
            <Select value={movement.status} onChange={(value) => onMovementChange({ status: value })} options={statuses} />
          </Field>
          <Field label="Responsable">
            <Select value={movement.custodyId} onChange={(value) => onMovementChange({ custodyId: value })} options={owners} valueKey="id" labelKey="name" />
          </Field>
          <label className="field wide">
            <span>Nota de movimiento</span>
            <textarea value={movement.note} onChange={(event) => onMovementChange({ note: event.target.value })} placeholder="Ej: sale a rodaje para proyecto X, vuelve el viernes." />
          </label>
        </div>
        <div className="editor-actions">
          <button className="primary" onClick={onApply} disabled={!selectedAsset}><Save size={16} /> Registrar movimiento</button>
        </div>
      </section>

      <section className="panel">
        <Title eyebrow="Historial del activo" title={selectedAsset ? selectedAsset.code : 'Sin activo'} icon={<History />} />
        {selectedAsset ? (
          <>
            <div className="asset-summary">
              <strong>{selectedAsset.name}</strong>
              <span>{locationsById[selectedAsset.locationId]?.name || 'Sin ubicacion'} - {ownersById[selectedAsset.custodyId]?.name || 'Sin responsable'}</span>
              <StatusBadge status={selectedAsset.status} />
            </div>
            <div className="history-list">
              {(selectedAsset.history || []).map((entry) => (
                <article key={entry.id} className="history-item">
                  <div>
                    <strong>{entry.type}</strong>
                    <time>{formatDate(entry.at)}</time>
                  </div>
                  <p>{entry.description}</p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="Selecciona un activo" body="El historial aparece cuando hay un activo elegido." />
        )}
      </section>
    </div>
  )
}

function OwnersSection({ assets, locations, newLocation, newOwner, owners, onAddLocation, onAddOwner, onLocationChange, onOwnerChange }) {
  return (
    <div className="owners-layout">
      <section className="panel">
        <Title eyebrow="Propiedad y custodia" title="Duenos / responsables" icon={<Users />} />
        <div className="mini-form">
          <Input label="Nombre" value={newOwner.name} onChange={(value) => onOwnerChange({ name: value })} />
          <Input label="Tipo" value={newOwner.type} onChange={(value) => onOwnerChange({ type: value })} />
          <Input label="Contacto / nota" value={newOwner.contact} onChange={(value) => onOwnerChange({ contact: value })} />
          <button className="primary" onClick={onAddOwner}><UserPlus size={16} /> Agregar</button>
        </div>
        <div className="directory-list">
          {owners.map((owner) => {
            const owned = assets.filter((asset) => asset.ownerId === owner.id).length
            const custody = assets.filter((asset) => asset.custodyId === owner.id).length
            return (
              <article key={owner.id} className="directory-card">
                <Building2 size={18} />
                <div>
                  <strong>{owner.name}</strong>
                  <span>{owner.type} - {owner.contact || 'Sin contacto'}</span>
                </div>
                <em>{owned} propios / {custody} a cargo</em>
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <Title eyebrow="Ubicaciones" title="Lugares posibles" icon={<MapPin />} />
        <div className="mini-form">
          <Input label="Lugar" value={newLocation.name} onChange={(value) => onLocationChange({ name: value })} />
          <Input label="Detalle" value={newLocation.detail} onChange={(value) => onLocationChange({ detail: value })} />
          <button className="primary" onClick={onAddLocation}><Plus size={16} /> Agregar</button>
        </div>
        <div className="directory-list">
          {locations.map((location) => {
            const count = assets.filter((asset) => asset.locationId === location.id).length
            return (
              <article key={location.id} className="directory-card">
                <MapPin size={18} />
                <div>
                  <strong>{location.name}</strong>
                  <span>{location.detail || 'Sin detalle'}</span>
                </div>
                <em>{count} activos</em>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Timeline({ activity, assetsById }) {
  if (!activity?.length) return <EmptyState title="Sin actividad" body="Los cambios van a aparecer aca." />
  return (
    <div className="timeline">
      {activity.slice(0, 12).map((entry) => (
        <article key={entry.id}>
          <span />
          <div>
            <strong>{assetsById[entry.assetId]?.code || 'Registro'}</strong>
            <p>{entry.text}</p>
            <time>{formatDate(entry.at)}</time>
          </div>
        </article>
      ))}
    </div>
  )
}

function MetricCard({ icon, label, value, detail }) {
  return (
    <article className="metric-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function Panel({ title, eyebrow, icon, children }) {
  return (
    <section className="panel">
      <Title title={title} eyebrow={eyebrow} icon={icon} />
      {children}
    </section>
  )
}

function Title({ title, eyebrow, icon }) {
  return (
    <div className="section-title">
      <div className="title-icon">{icon}</div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  )
}

function NavButton({ active, icon, label, onClick }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      {icon}
      {label}
    </button>
  )
}

function CloudPill({ enabled, status }) {
  return (
    <div className={`cloud-pill ${enabled && status === 'Nube sincronizada' ? 'online' : ''}`}>
      {enabled ? <Cloud size={15} /> : <CloudOff size={15} />}
      <span>{status}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const icon = status === 'Mantenimiento' ? <Wrench size={13} /> : status === 'Archivado' ? <Archive size={13} /> : <CheckCircle2 size={13} />
  return <span className={`status-badge ${status.toLowerCase()}`}>{icon}{status}</span>
}

function ConfirmDialog({ asset, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <section className="confirm-modal">
        <div className="modal-icon"><Trash2 size={22} /></div>
        <p className="eyebrow">Confirmar borrado</p>
        <h2 id="delete-title">Eliminar activo</h2>
        <p>Vas a borrar <strong>{asset.code} - {asset.name}</strong> del inventario compartido.</p>
        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>Cancelar</button>
          <button className="primary" onClick={onConfirm}><Trash2 size={16} /> Borrar</button>
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Select({ value, onChange, options, valueKey, labelKey }) {
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => {
        const optionValue = valueKey ? option[valueKey] : option
        const label = typeof labelKey === 'function' ? labelKey(option) : labelKey ? option[labelKey] : option
        return <option key={optionValue} value={optionValue}>{label}</option>
      })}
    </select>
  )
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <ShieldCheck size={22} />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

export default App
