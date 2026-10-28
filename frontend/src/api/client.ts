import type { AirQuality, AirQualityHistory, AnalyticsData, CleanRouteResponse, FireData, Forecast, Inversion, Recommendations, Risk, Weather } from '../types/api'

const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api'
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}
async function get<T>(path: string): Promise<T> {
  let response: Response
  try { response = await fetch(`${base}${path}`, { headers: { Accept: 'application/json' } }) }
  catch { throw new ApiError('Data Currently Unavailable', 0) }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const error = body?.error
    const message = error?.detail ? `${error.provider || 'Provider'}: ${error.detail}` : error?.message || 'Data Currently Unavailable'
    const requestId = error?.request_id ? ` (Request ID: ${error.request_id})` : ''
    throw new ApiError(`${message}${requestId}`, response.status)
  }
  return response.json() as Promise<T>
}
export const api = {
  weather: (lat: number, lon: number) => get<Weather>(`/weather?lat=${lat}&lon=${lon}`),
  airQuality: (lat: number, lon: number, placeName?: string) => get<AirQuality>(`/air-quality?lat=${lat}&lon=${lon}${placeName ? `&place_name=${encodeURIComponent(placeName)}` : ''}`),
  airQualityHistory: (lat: number, lon: number, days = 7) => get<AirQualityHistory>(`/air-quality/history?lat=${lat}&lon=${lon}&days=${days}`),
  fires: (west: number, south: number, east: number, north: number) => get<FireData>(`/fire-hotspots?west=${west}&south=${south}&east=${east}&north=${north}&day_range=3`),
  forecast: (lat: number, lon: number, hours = 24, city?: string) => get<Forecast>(`/forecast?lat=${lat}&lon=${lon}&hours=${hours}${city ? `&city=${encodeURIComponent(city)}` : ''}`),
  forecast72h: (lat: number, lon: number, city = 'Delhi') => get<Forecast>(`/forecast/72h?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}`),
  analytics: (city = 'Delhi', days = 7) => get<AnalyticsData>(`/analytics?city=${encodeURIComponent(city)}&days=${days}`),
  historicalAqi: (city = 'Delhi', limit = 168) => get<{ city: string; count: number; records: unknown[] }>(`/historical-aqi?city=${encodeURIComponent(city)}&limit=${limit}`),
  inversion: (lat: number, lon: number) => get<Inversion>(`/inversion?lat=${lat}&lon=${lon}`),
  risk: (lat: number, lon: number) => get<Risk>(`/health-risk?lat=${lat}&lon=${lon}`),
  recommendations: (lat: number, lon: number) => get<Recommendations>(`/recommendations?lat=${lat}&lon=${lon}`),
  cleanRoute: (originLat: number, originLon: number, destLat: number, destLon: number, mode = 'driving', originName?: string, destName?: string) =>
    get<CleanRouteResponse>(`/navigation/clean-route?origin_lat=${originLat}&origin_lon=${originLon}&dest_lat=${destLat}&dest_lon=${destLon}&mode=${mode}${originName ? `&origin_name=${encodeURIComponent(originName)}` : ''}${destName ? `&dest_name=${encodeURIComponent(destName)}` : ''}`),
}
