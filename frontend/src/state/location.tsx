import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Location } from '../types/api'

export type NamedLocation = Location & { name: string; source?: 'search' | 'current' | 'city' | 'coordinates' }
type LocationContextValue = {
  location: Location | null
  selected: NamedLocation | null
  recent: NamedLocation[]
  favorites: NamedLocation[]
  setLocation: (location: Location, name?: string, source?: NamedLocation['source']) => void
  toggleFavorite: (location: NamedLocation) => void
}
const RECENT_KEY = 'airsense.recentLocations'
const FAVORITES_KEY = 'airsense.favoriteLocations'
function readList(key: string): NamedLocation[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.slice(0, 5) as NamedLocation[] : [] } catch { return [] }
}
function writeList(key: string, items: NamedLocation[]) { try { localStorage.setItem(key, JSON.stringify(items)) } catch { /* Keep the location usable if browser storage is unavailable. */ } }
const Context = createContext<LocationContextValue | null>(null)

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<NamedLocation | null>(() => {
    const query = new URLSearchParams(window.location.search)
    const lat = Number(query.get('lat')), lon = Number(query.get('lon'))
    return Number.isFinite(lat) && Number.isFinite(lon) && query.has('lat') && query.has('lon') ? { latitude: lat, longitude: lon, name: 'Selected coordinates', source: 'coordinates' } : null
  })
  const [recent, setRecent] = useState(readList(RECENT_KEY))
  const [favorites, setFavorites] = useState(readList(FAVORITES_KEY))
  const value = useMemo<LocationContextValue>(() => ({
    location: selected ? { latitude: selected.latitude, longitude: selected.longitude } : null,
    selected, recent, favorites,
    setLocation: (next, name = 'Selected coordinates', source = 'coordinates') => {
      const named = { ...next, name, source }
      setSelected(named)
      const url = new URL(window.location.href); url.searchParams.set('lat', String(next.latitude)); url.searchParams.set('lon', String(next.longitude)); window.history.replaceState({}, '', url)
      setRecent(previous => {
        const list = [named, ...previous.filter(item => item.latitude !== next.latitude || item.longitude !== next.longitude)].slice(0, 5)
        writeList(RECENT_KEY, list); return list
      })
    },
    toggleFavorite: item => setFavorites(previous => {
      const exists = previous.some(location => location.latitude === item.latitude && location.longitude === item.longitude)
      const next = exists ? previous.filter(location => location.latitude !== item.latitude || location.longitude !== item.longitude) : [...previous, item].slice(-5)
      writeList(FAVORITES_KEY, next); return next
    }),
  }), [selected, recent, favorites])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useLocationState() { const value = useContext(Context); if (!value) throw new Error('LocationProvider is missing'); return value }
