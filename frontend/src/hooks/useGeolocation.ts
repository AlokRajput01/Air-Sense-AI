import { useCallback, useState } from 'react'
import { reverseGeocode } from '../services/locationSearch'
import type { Location } from '../types/api'
export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const locate = useCallback(async (onLocated: (location: Location, name: string) => void) => {
    if (!navigator.geolocation) { setError('Location access is not supported by this browser.'); return }
    setLoading(true); setError('')
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const location = { latitude: coords.latitude, longitude: coords.longitude }
      try { onLocated(location, await reverseGeocode(location)) }
      catch { onLocated(location, 'Current location') }
      finally { setLoading(false) }
    }, error => {
      setError(error.code === error.PERMISSION_DENIED ? 'Allow location access in your browser, or search for a place.' : 'Could not determine your location. Try searching instead.')
      setLoading(false)
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 })
  }, [])
  return { locate, loading, error }
}
