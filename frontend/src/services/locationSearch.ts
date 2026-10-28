import type { Location } from '../types/api'
export type Place = Location & { name: string; displayName: string }
type NominatimResult = { lat: string; lon: string; display_name: string; name?: string; address?: { city?: string; town?: string; village?: string; state?: string; county?: string } }
const endpoint = ((import.meta.env.VITE_NOMINATIM_BASE_URL as string | undefined) || 'https://nominatim.openstreetmap.org').replace(/\/$/, '')
const headers = { Accept: 'application/json' }
const searchCache = new Map<string, Place[]>()
const reverseCache = new Map<string, string>()
let lastRequestAt = 0
async function waitForRateLimit() {
  const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt))
  if (wait) await new Promise(resolve => window.setTimeout(resolve, wait))
  lastRequestAt = Date.now()
}
function placeFrom(item: NominatimResult): Place {
  const address = item.address || {}
  const locality = address.city || address.town || address.village || item.name || item.display_name.split(',')[0]
  return { latitude: Number(item.lat), longitude: Number(item.lon), name: [locality, address.state].filter(Boolean).join(', '), displayName: item.display_name }
}
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const key = query.trim().toLocaleLowerCase()
  if (searchCache.has(key)) return searchCache.get(key)!
  const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '6', countrycodes: 'in' })
  await waitForRateLimit()
  const response = await fetch(`${endpoint}/search?${params}`, { headers, signal })
  if (!response.ok) throw new Error('Location search is temporarily unavailable.')
  const places = (await response.json() as NominatimResult[]).map(placeFrom)
  searchCache.set(key, places)
  return places
}
export async function reverseGeocode(location: Location, signal?: AbortSignal): Promise<string> {
  const key = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`
  if (reverseCache.has(key)) return reverseCache.get(key)!
  const params = new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), format: 'jsonv2', addressdetails: '1' })
  await waitForRateLimit()
  const response = await fetch(`${endpoint}/reverse?${params}`, { headers, signal })
  if (!response.ok) throw new Error('Could not find a place name for these coordinates.')
  const result = await response.json() as NominatimResult
  const name = placeFrom(result).name || result.display_name
  reverseCache.set(key, name)
  return name
}
