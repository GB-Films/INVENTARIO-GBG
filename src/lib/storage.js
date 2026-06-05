const STORAGE_KEY = 'gbg-inventory-state'
const CLOUD_TABLE = 'app_state'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloudStorageEnabled = () => Boolean(supabaseUrl && supabaseAnonKey)

const cloudHeaders = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
  'Content-Type': 'application/json',
}

const cloudEndpoint = (query = '') => `${supabaseUrl}/rest/v1/${CLOUD_TABLE}${query}`

const loadCloudValue = async (key, fallback) => {
  if (!isCloudStorageEnabled()) return fallback
  const response = await fetch(cloudEndpoint(`?key=eq.${encodeURIComponent(key)}&select=data&limit=1`), {
    headers: cloudHeaders,
    cache: 'no-store',
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Supabase load failed: ${response.status}${details ? ` ${details}` : ''}`)
  }
  const rows = await response.json()
  return rows[0]?.data ?? fallback
}

const saveCloudValue = async (key, value) => {
  if (!isCloudStorageEnabled()) return
  const response = await fetch(cloudEndpoint('?on_conflict=key'), {
    method: 'POST',
    headers: {
      ...cloudHeaders,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      key,
      data: value,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Supabase save failed: ${response.status}${details ? ` ${details}` : ''}`)
  }
}

export const loadInventoryState = (fallback) => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? fallback
  } catch {
    return fallback
  }
}

export const saveInventoryState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const loadSharedInventoryState = () => loadCloudValue(STORAGE_KEY, null)
export const saveSharedInventoryState = (state) => saveCloudValue(STORAGE_KEY, state)
