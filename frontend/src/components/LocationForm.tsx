import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ChevronDown, Clock3, Heart, LoaderCircle, MapPin, Search, Star, X } from 'lucide-react'
import { useLocationState } from '../state/location'
import type { NamedLocation } from '../state/location'
import { searchPlaces } from '../services/locationSearch'
import type { Place } from '../services/locationSearch'
import { useGeolocation } from '../hooks/useGeolocation'

const cities: Record<string, Record<string, [number, number]>> = {
  'Andhra Pradesh': { Visakhapatnam: [17.6868, 83.2185], Vijayawada: [16.5062, 80.648], Tirupati: [13.6288, 79.4192] }, 'Arunachal Pradesh': { Itanagar: [27.0844, 93.6053], Tawang: [27.586, 91.8594] }, Assam: { Guwahati: [26.1445, 91.7362], Dibrugarh: [27.4728, 94.912] }, Bihar: { Patna: [25.5941, 85.1376], Gaya: [24.7955, 84.9994] }, Chhattisgarh: { Raipur: [21.2514, 81.6296], Bilaspur: [22.0797, 82.1409] }, Goa: { Panaji: [15.4909, 73.8278], Margao: [15.2832, 73.9862] }, Gujarat: { Ahmedabad: [23.0225, 72.5714], Surat: [21.1702, 72.8311], Vadodara: [22.3072, 73.1812] }, Haryana: { Gurugram: [28.4595, 77.0266], Faridabad: [28.4089, 77.3178], Hisar: [29.1492, 75.7217] }, 'Himachal Pradesh': { Shimla: [31.1048, 77.1734], Dharamshala: [32.219, 76.3234] }, Jharkhand: { Ranchi: [23.3441, 85.3096], Jamshedpur: [22.8046, 86.2029] }, Karnataka: { Bengaluru: [12.9716, 77.5946], Mysuru: [12.2958, 76.6394], Mangaluru: [12.9141, 74.856] }, Kerala: { Thiruvananthapuram: [8.5241, 76.9366], Kochi: [9.9312, 76.2673], Kozhikode: [11.2588, 75.7804] }, 'Madhya Pradesh': { Bhopal: [23.2599, 77.4126], Indore: [22.7196, 75.8577], Jabalpur: [23.1815, 79.9864] }, Maharashtra: { Mumbai: [19.076, 72.8777], Pune: [18.5204, 73.8567], Nagpur: [21.1458, 79.0882] }, Manipur: { Imphal: [24.817, 93.9368] }, Meghalaya: { Shillong: [25.5788, 91.8933] }, Mizoram: { Aizawl: [23.7271, 92.7176] }, Nagaland: { Kohima: [25.6751, 94.1086], Dimapur: [25.9045, 93.7266] }, Odisha: { Bhubaneswar: [20.2961, 85.8245], Cuttack: [20.4625, 85.883] }, Punjab: { Ludhiana: [30.901, 75.8573], Amritsar: [31.634, 74.8723], Chandigarh: [30.7333, 76.7794] }, Rajasthan: { Jaipur: [26.9124, 75.7873], Jodhpur: [26.2389, 73.0243], Udaipur: [24.5854, 73.7125] }, Sikkim: { Gangtok: [27.3389, 88.6065] }, 'Tamil Nadu': { Chennai: [13.0827, 80.2707], Coimbatore: [11.0168, 76.9558], Madurai: [9.9252, 78.1198] }, Telangana: { Hyderabad: [17.385, 78.4867], Warangal: [17.9689, 79.5941] }, Tripura: { Agartala: [23.8315, 91.2868] }, 'Uttar Pradesh': { Lucknow: [26.8467, 80.9462], Noida: [28.5355, 77.391], Ghaziabad: [28.6692, 77.4538], Varanasi: [25.3176, 82.9739], Kanpur: [26.4499, 80.3319] }, Uttarakhand: { Dehradun: [30.3165, 78.0322], Nainital: [29.3919, 79.4542] }, 'West Bengal': { Kolkata: [22.5726, 88.3639], Siliguri: [26.7271, 88.3953] }, Delhi: { Delhi: [28.6139, 77.209] }, 'Jammu and Kashmir': { Srinagar: [34.0837, 74.7973], Jammu: [32.7266, 74.857] }, Ladakh: { Leh: [34.1526, 77.5771] }, Puducherry: { Puducherry: [11.9416, 79.8083] }, 'Andaman and Nicobar Islands': { 'Port Blair': [11.6234, 92.7265] }, Chandigarh: { Chandigarh: [30.7333, 76.7794] }, 'Dadra and Nagar Haveli and Daman and Diu': { Daman: [20.3974, 72.8328] }, Lakshadweep: { Kavaratti: [10.5667, 72.6417] },
}
function ChoiceList({ title, icon, items, onChoose, onRemove }: { title: string; icon: ReactNode; items: NamedLocation[]; onChoose: (item: NamedLocation) => void; onRemove?: (item: NamedLocation) => void }) {
  if (!items.length) return null
  return <div className="location-choices"><div className="location-choices-title">{icon}{title}</div>{items.map(item => <div className="location-choice" key={`${item.latitude},${item.longitude}`}><button onClick={() => onChoose(item)}><span>{item.name}</span><small>{item.latitude.toFixed(3)}, {item.longitude.toFixed(3)}</small></button>{onRemove && <button className="choice-remove" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)}><X size={14}/></button>}</div>)}</div>
}

export function LocationForm() {
  const { selected, recent, favorites, setLocation, toggleFavorite } = useLocationState()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [lat, setLat] = useState(''); const [lon, setLon] = useState(''); const [coordError, setCoordError] = useState('')
  const [state, setState] = useState(''); const [city, setCity] = useState('')
  const wrapper = useRef<HTMLDivElement>(null)
  const { locate, loading: locating, error: locationError } = useGeolocation()
  const states = Object.keys(cities).sort()
  useEffect(() => {
    function close(event: MouseEvent) { if (!wrapper.current?.contains(event.target as Node)) setSuggestions([]) }
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [])
  function choose(place: Place) { setLocation(place, place.name, 'search'); setQuery(''); setSuggestions([]); setState(''); setCity('') }
  async function submitSearch(event: FormEvent) {
    event.preventDefault()
    if (query.trim().length < 3) { setSearchError('Enter at least 3 characters to search.'); return }
    setSearching(true); setSearchError(''); setSuggestions([])
    try { const results = await searchPlaces(query.trim()); setSuggestions(results); if (!results.length) setSearchError('No matching places found. Try a nearby city or district.') }
    catch (error) { setSearchError(error instanceof Error ? error.message : 'Location search failed.') }
    finally { setSearching(false) }
  }
  function chooseSaved(item: NamedLocation) { setLocation(item, item.name, item.source || 'search'); setQuery('') }
  function chooseCity(stateName: string, cityName: string) {
    const coords = cities[stateName]?.[cityName]; if (!coords) return
    setLocation({ latitude: coords[0], longitude: coords[1] }, `${cityName}, ${stateName}`, 'city')
  }
  function submitCoords(event: FormEvent) {
    event.preventDefault(); const latitude = Number(lat), longitude = Number(lon)
    if (!lat.trim() || !lon.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { setCoordError('Enter valid latitude and longitude values.'); return }
    setCoordError(''); setLocation({ latitude, longitude }, `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 'coordinates')
  }
  const isFavorite = selected && favorites.some(item => item.latitude === selected.latitude && item.longitude === selected.longitude)
  return <div className="location-bar" ref={wrapper}>
    <div className="location-bar-main">
      <div className="location-current"><MapPin size={18}/><div><small>YOUR LOCATION</small><strong>{selected?.name || 'Choose a location'}</strong></div></div>
      <button className="location-current-button" onClick={() => locate((point, name) => setLocation(point, name, 'current'))} disabled={locating}>{locating ? <LoaderCircle className="spin" size={16}/> : <MapPin size={16}/>}<span>{locating ? 'Finding you…' : 'Use Current Location'}</span></button>
      {selected && <button className={`location-favorite ${isFavorite ? 'is-favorite' : ''}`} aria-label={isFavorite ? 'Remove from saved locations' : 'Save location'} title={isFavorite ? 'Remove saved location' : 'Save location'} onClick={() => toggleFavorite(selected)}><Star size={17} fill={isFavorite ? 'currentColor' : 'none'}/></button>}
    </div>
    {(locationError || searchError) && <p className="location-message" role="status">{locationError || searchError}</p>}
    <div className="location-bar-options">
      <form className="location-search-wrap" onSubmit={submitSearch}><Search size={16}/><input aria-label="Search locations" placeholder="Search city or place" value={query} onChange={event => { setQuery(event.target.value); setSuggestions([]) }}/><button type="submit" disabled={searching}>{searching ? <LoaderCircle size={15} className="spin"/> : 'Search'}</button>{suggestions.length > 0 && <div className="location-suggestions" role="listbox">{suggestions.map(place => <button type="button" role="option" key={`${place.latitude},${place.longitude}`} onClick={() => choose(place)}><MapPin size={15}/><span><strong>{place.name}</strong><small>{place.displayName}</small></span></button>)}<a className="nominatim-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · Search by Nominatim</a></div>}</form>
      <label className="location-select"><span>State</span><select value={state} onChange={event => { setState(event.target.value); setCity('') }}><option value="">Select state</option>{states.map(name => <option key={name}>{name}</option>)}</select><ChevronDown size={13}/></label>
      <label className="location-select"><span>City</span><select value={city} disabled={!state} onChange={event => { setCity(event.target.value); if (event.target.value) chooseCity(state, event.target.value) }}><option value="">{state ? 'Select city' : 'Choose state first'}</option>{Object.keys(cities[state] || {}).sort().map(name => <option key={name}>{name}</option>)}</select><ChevronDown size={13}/></label>
    </div>
    <div className="location-shortcuts"><ChoiceList title="Saved locations" icon={<Heart size={14}/>} items={favorites} onChoose={chooseSaved} onRemove={toggleFavorite}/><ChoiceList title="Recent locations" icon={<Clock3 size={14}/>} items={recent} onChoose={chooseSaved}/></div>
    <small className="location-attribution">Place names by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></small>
    <details className="advanced-location" open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)}><summary>Advanced Location Settings <ChevronDown size={14}/></summary><form className="advanced-coordinates" onSubmit={submitCoords}><p>Enter coordinates manually when you need a precise point.</p><input aria-label="Latitude" inputMode="decimal" value={lat} onChange={event => setLat(event.target.value)} placeholder="Latitude (−90 to 90)"/><input aria-label="Longitude" inputMode="decimal" value={lon} onChange={event => setLon(event.target.value)} placeholder="Longitude (−180 to 180)"/><button type="submit">Use coordinates</button>{coordError && <small role="alert">{coordError}</small>}</form></details>
  </div>
}
