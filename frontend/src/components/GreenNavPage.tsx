import { useState, useEffect } from 'react'
import {
  Navigation,
  ShieldCheck,
  Leaf,
  Car,
  Bike,
  Footprints,
  ArrowUpDown,
  MapPin,
  Info,
  Check,
  Layers,
  AlertTriangle,
} from 'lucide-react'
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useLocationState } from '../state/location'
import { searchPlaces, Place } from '../services/locationSearch'
import { PageMotion } from './ui'
import type { CleanRouteResponse, Location } from '../types/api'

// Preset iconic routes for 1-click evaluation
const PRESETS = [
  {
    label: 'CP → Noida Sec 62',
    origin: { latitude: 28.6315, longitude: 77.2167 },
    originName: 'Connaught Place, Central Delhi',
    dest: { latitude: 28.6280, longitude: 77.3649 },
    destName: 'Sector 62, Noida',
  },
  {
    label: 'DU → Cyber Hub',
    origin: { latitude: 28.6892, longitude: 77.2072 },
    originName: 'Delhi University North Campus',
    dest: { latitude: 28.4986, longitude: 77.0898 },
    destName: 'DLF Cyber Hub, Gurugram',
  },
  {
    label: 'Anand Vihar → Dwarka',
    origin: { latitude: 28.6469, longitude: 77.3160 },
    originName: 'Anand Vihar ISBT, East Delhi',
    dest: { latitude: 28.5815, longitude: 77.0583 },
    destName: 'Dwarka Sector 10, South West Delhi',
  },
  {
    label: 'India Gate → Rohini',
    origin: { latitude: 28.6129, longitude: 77.2295 },
    originName: 'India Gate, New Delhi',
    dest: { latitude: 28.7180, longitude: 77.1265 },
    destName: 'Rohini Sector 14, North Delhi',
  },
]

type TravelMode = 'driving' | 'cycling' | 'walking'

// Custom map markers
const pinStart = L.divIcon({
  className: 'nav-marker-start',
  html: '<div style="background:#059669;color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;box-shadow:0 0 0 4px rgba(5,150,105,0.25);border:2px solid white;">A</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

const pinEnd = L.divIcon({
  className: 'nav-marker-end',
  html: '<div style="background:#dc2626;color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;box-shadow:0 0 0 4px rgba(220,38,38,0.25);border:2px solid white;">B</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

function MapBoundsFitter({ routeData, activeTab }: { routeData?: CleanRouteResponse; activeTab: 'clean' | 'fastest' }) {
  const map = useMap()
  useEffect(() => {
    if (!routeData) return
    const targetCoords =
      activeTab === 'clean'
        ? routeData.cleanest_route.coordinates
        : routeData.fastest_route.coordinates
    const allCoords = targetCoords.length > 0 ? targetCoords : routeData.cleanest_route.coordinates
    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords.map(c => [c[0], c[1]]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }, [map, routeData, activeTab])
  return null
}

export function GreenNavPage() {
  const { location } = useLocationState()

  // Origin & Destination state
  const [origin, setOrigin] = useState<Location>({ latitude: 28.6315, longitude: 77.2167 })
  const [originName, setOriginName] = useState('Connaught Place, Central Delhi')
  const [dest, setDest] = useState<Location>({ latitude: 28.6280, longitude: 77.3649 })
  const [destName, setDestName] = useState('Sector 62, Noida')
  const [mode, setMode] = useState<TravelMode>('driving')

  // Search input state
  const [originQuery, setOriginQuery] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [originResults, setOriginResults] = useState<Place[]>([])
  const [destResults, setDestResults] = useState<Place[]>([])

  // Active view tab: 'clean' or 'fastest'
  const [activeRoute, setActiveRoute] = useState<'clean' | 'fastest'>('clean')
  const [showBothOnMap, setShowBothOnMap] = useState(true)

  // Search debouncing for origin
  useEffect(() => {
    if (originQuery.trim().length < 3) {
      setOriginResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const places = await searchPlaces(originQuery)
        setOriginResults(places)
      } catch {
        setOriginResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [originQuery])

  // Search debouncing for destination
  useEffect(() => {
    if (destQuery.trim().length < 3) {
      setDestResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const places = await searchPlaces(destQuery)
        setDestResults(places)
      } catch {
        setDestResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [destQuery])

  // Query Backend Clean Route API
  const { data: routeData, isLoading, error } = useQuery<CleanRouteResponse>({
    queryKey: ['clean-route', origin.latitude, origin.longitude, dest.latitude, dest.longitude, mode, originName, destName],
    queryFn: () => api.cleanRoute(origin.latitude, origin.longitude, dest.latitude, dest.longitude, mode, originName, destName),
    staleTime: 60_000,
  })

  // Swap origin and destination
  const handleSwap = () => {
    const prevOrigin = origin
    const prevOriginName = originName
    setOrigin(dest)
    setOriginName(destName)
    setDest(prevOrigin)
    setDestName(prevOriginName)
  }

  // Select Preset
  const handleSelectPreset = (p: typeof PRESETS[0]) => {
    setOrigin(p.origin)
    setOriginName(p.originName)
    setDest(p.dest)
    setDestName(p.destName)
    setOriginQuery('')
    setDestQuery('')
    setOriginResults([])
    setDestResults([])
  }

  return (
    <PageMotion>
      {/* Top Breadcrumb & Simple Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
          <Navigation size={14} className="text-emerald-600" />
          <span>Clean Air Mobility</span>
          <span className="text-gray-300">/</span>
          <span className="text-emerald-950 font-bold">Green Nav Route Planner</span>
        </div>
        <h1 className="text-2xl font-extrabold text-emerald-950 tracking-tight">
          Find the cleanest route between two places
        </h1>
        <p className="text-xs text-emerald-900/70 mt-0.5">
          Standard maps only optimize for time. Green Nav routes you away from heavy truck exhaust and highway smog, protecting your lungs.
        </p>
      </div>

      {/* 2-Column Clean Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Controls & Route Selection Cards (~38% width) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Box 1: Trip Inputs */}
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-4">
            {/* Mode Selector */}
            <div className="flex bg-emerald-950/5 p-1 rounded-xl gap-1 mb-3.5 border border-emerald-900/5">
              {(
                [
                  { id: 'driving', label: 'Drive', icon: Car },
                  { id: 'cycling', label: 'Cycle', icon: Bike },
                  { id: 'walking', label: 'Walk', icon: Footprints },
                ] as const
              ).map(m => {
                const Icon = m.icon
                const isSelected = mode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      isSelected
                        ? 'bg-emerald-800 text-white shadow-sm'
                        : 'text-emerald-900/70 hover:text-emerald-950 hover:bg-white/60'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{m.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Inputs with visual vertical connector line */}
            <div className="relative flex flex-col gap-2.5">
              {/* Origin */}
              <div className="relative">
                <div className="flex items-center gap-2.5 bg-emerald-50/50 border border-emerald-900/15 rounded-xl px-3 py-2.5 focus-within:border-emerald-600 focus-within:bg-white transition">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 flex-shrink-0 ring-4 ring-emerald-100" />
                  <input
                    type="text"
                    value={originQuery}
                    placeholder={originName || 'Enter starting location...'}
                    onChange={e => setOriginQuery(e.target.value)}
                    className="w-full text-xs text-emerald-950 font-medium focus:outline-none bg-transparent placeholder-emerald-950/80"
                  />
                  {location && (
                    <button
                      onClick={() => {
                        setOrigin(location)
                        setOriginName('My Current Location')
                        setOriginQuery('')
                      }}
                      className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md hover:bg-emerald-200 transition"
                    >
                      GPS
                    </button>
                  )}
                </div>

                {/* Origin Autocomplete Dropdown */}
                {originResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-emerald-900/15 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {originResults.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setOrigin({ latitude: p.latitude, longitude: p.longitude })
                          setOriginName(p.name)
                          setOriginQuery('')
                          setOriginResults([])
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 text-emerald-950 border-b border-gray-100 last:border-0 truncate flex items-center gap-2"
                      >
                        <MapPin size={12} className="text-emerald-700 flex-shrink-0" />
                        <span className="truncate">{p.displayName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap Button on the Right */}
              <div className="absolute right-3 top-[34px] z-10">
                <button
                  onClick={handleSwap}
                  className="w-7 h-7 rounded-full bg-white border border-emerald-900/20 text-emerald-800 flex items-center justify-center hover:bg-emerald-50 shadow-sm transition"
                  title="Swap Origin and Destination"
                >
                  <ArrowUpDown size={13} />
                </button>
              </div>

              {/* Destination */}
              <div className="relative">
                <div className="flex items-center gap-2.5 bg-red-50/30 border border-emerald-900/15 rounded-xl px-3 py-2.5 focus-within:border-red-500 focus-within:bg-white transition">
                  <span className="w-3 h-3 rounded-full bg-red-600 flex-shrink-0 ring-4 ring-red-100" />
                  <input
                    type="text"
                    value={destQuery}
                    placeholder={destName || 'Enter destination...'}
                    onChange={e => setDestQuery(e.target.value)}
                    className="w-full text-xs text-emerald-950 font-medium focus:outline-none bg-transparent placeholder-emerald-950/80"
                  />
                </div>

                {/* Destination Autocomplete Dropdown */}
                {destResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-emerald-900/15 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {destResults.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setDest({ latitude: p.latitude, longitude: p.longitude })
                          setDestName(p.name)
                          setDestQuery('')
                          setDestResults([])
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 text-emerald-950 border-b border-gray-100 last:border-0 truncate flex items-center gap-2"
                      >
                        <MapPin size={12} className="text-red-600 flex-shrink-0" />
                        <span className="truncate">{p.displayName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick 1-Click Demo Presets */}
            <div className="mt-3.5 pt-3 border-t border-emerald-900/5">
              <span className="text-[10px] font-bold text-emerald-800/80 uppercase tracking-wider block mb-2">
                Quick Delhi NCR Demo Routes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p, idx) => {
                  const isCurrent = originName === p.originName
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectPreset(p)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                        isCurrent
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                          : 'bg-emerald-50/60 text-emerald-900 border-emerald-900/10 hover:bg-emerald-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="bg-white rounded-2xl border border-emerald-900/10 p-6 text-center text-emerald-800 flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold">Calculating clean air road corridors...</span>
            </div>
          )}

          {/* Error Message */}
          {error && !isLoading && (
            <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
              <span>Route service is temporarily busy. Please retry with standard locations.</span>
            </div>
          )}

          {/* Box 2: The Two Route Options (Clean vs Fastest) */}
          {routeData && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                  Select Route Option
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold">
                  Click to inspect on map
                </span>
              </div>

              {/* ROUTE 1: Clean Air Route Card */}
              <div
                onClick={() => setActiveRoute('clean')}
                className={`relative rounded-2xl p-4 cursor-pointer transition-all border-2 text-left ${
                  activeRoute === 'clean'
                    ? 'bg-emerald-50/70 border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                    : 'bg-white border-emerald-900/15 hover:border-emerald-300'
                }`}
              >
                {/* Header with savings badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <Leaf size={14} />
                    </span>
                    <strong className="text-sm font-extrabold text-emerald-950">
                      Clean Air Route
                    </strong>
                  </div>
                  <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wide shadow-sm flex items-center gap-1">
                    <ShieldCheck size={11} />
                    {routeData.savings_percent}% Cleaner
                  </span>
                </div>

                {/* 3 Main Numbers */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-emerald-900/10 my-2 text-center">
                  <div>
                    <span className="text-[10px] text-emerald-800/80 font-bold uppercase block">
                      Travel Time
                    </span>
                    <strong className="text-base text-emerald-950 font-extrabold">
                      {routeData.cleanest_route.duration_min} min
                    </strong>
                    <small className="block text-[10px] text-gray-500">
                      {routeData.cleanest_route.distance_km} km
                    </small>
                  </div>

                  <div>
                    <span className="text-[10px] text-emerald-800/80 font-bold uppercase block">
                      Average Air
                    </span>
                    <strong className="text-base text-emerald-700 font-extrabold">
                      AQI {routeData.cleanest_route.average_aqi}
                    </strong>
                    <small className="block text-[10px] text-emerald-700 font-semibold">
                      {routeData.cleanest_route.category}
                    </small>
                  </div>

                  <div>
                    <span className="text-[10px] text-emerald-800/80 font-bold uppercase block">
                      Inhaled Dose
                    </span>
                    <strong className="text-base text-emerald-950 font-extrabold">
                      {routeData.cleanest_route.inhaled_pm25_ug} µg
                    </strong>
                    <small className="block text-[10px] text-emerald-600 font-semibold">
                      Low soot intake
                    </small>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-900/80 leading-relaxed m-0">
                  🌿 <b>Path:</b> {routeData.cleanest_route.summary}
                </p>
              </div>

              {/* ROUTE 2: Direct Arterial Route Card */}
              <div
                onClick={() => setActiveRoute('fastest')}
                className={`relative rounded-2xl p-4 cursor-pointer transition-all border-2 text-left ${
                  activeRoute === 'fastest'
                    ? 'bg-red-50/40 border-red-500 shadow-md ring-2 ring-red-400/20'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-gray-600 text-white flex items-center justify-center">
                      <Car size={14} />
                    </span>
                    <strong className="text-sm font-extrabold text-gray-900">
                      Direct Arterial Route
                    </strong>
                  </div>
                  <span className="bg-red-100 text-red-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                    High Highway Exhaust
                  </span>
                </div>

                {/* 3 Main Numbers */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-gray-100 my-2 text-center">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">
                      Travel Time
                    </span>
                    <strong className="text-base text-gray-900 font-extrabold">
                      {routeData.fastest_route.duration_min} min
                    </strong>
                    <small className="block text-[10px] text-gray-500">
                      {routeData.fastest_route.distance_km} km
                    </small>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">
                      Average Air
                    </span>
                    <strong className="text-base text-red-600 font-extrabold">
                      AQI {routeData.fastest_route.average_aqi}
                    </strong>
                    <small className="block text-[10px] text-red-600 font-semibold">
                      {routeData.fastest_route.category}
                    </small>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">
                      Inhaled Dose
                    </span>
                    <strong className="text-base text-red-700 font-extrabold">
                      {routeData.fastest_route.inhaled_pm25_ug} µg
                    </strong>
                    <small className="block text-[10px] text-red-500 font-semibold">
                      Elevated toxicity
                    </small>
                  </div>
                </div>

                <p className="text-[11px] text-gray-600 leading-relaxed m-0">
                  🚗 <b>Path:</b> {routeData.fastest_route.summary}
                </p>
              </div>

              {/* Health Guidance Card */}
              <div className="bg-emerald-950 text-emerald-100 rounded-2xl p-4 text-xs leading-relaxed flex items-start gap-3 shadow-sm">
                <Info size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold mb-1">
                    Health Recommendation:
                  </strong>
                  <p className="m-0 text-emerald-200/90 text-[11px] leading-relaxed">
                    {routeData.health_verdict}
                  </p>
                  <p className="mt-1 mb-0 text-emerald-300/80 text-[10px]">
                    💡 {routeData.mask_recommendation}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Full Map & Visual Route Comparison (~62% width) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Main Leaflet Map Card */}
          <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-sm p-3.5 relative">
            {/* Top Toolbar over map */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Interactive Route Map
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBothOnMap(v => !v)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 ${
                    showBothOnMap
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-white text-emerald-900 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Layers size={13} />
                  <span>{showBothOnMap ? 'Compare Both' : 'Show Single'}</span>
                </button>
              </div>
            </div>

            {/* Leaflet Map Shell */}
            <div className="h-[520px] w-full rounded-xl overflow-hidden relative border border-emerald-900/10">
              <MapContainer
                center={[origin.latitude, origin.longitude]}
                zoom={11}
                className="w-full h-full"
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBoundsFitter routeData={routeData} activeTab={activeRoute} />

                {/* Point A Marker */}
                <Marker position={[origin.latitude, origin.longitude]} icon={pinStart}>
                  <Popup>
                    <strong>Point A (Origin)</strong>
                    <br />
                    {originName}
                  </Popup>
                </Marker>

                {/* Point B Marker */}
                <Marker position={[dest.latitude, dest.longitude]} icon={pinEnd}>
                  <Popup>
                    <strong>Point B (Destination)</strong>
                    <br />
                    {destName}
                  </Popup>
                </Marker>

                {/* Direct Arterial Route Polyline */}
                {routeData && (showBothOnMap || activeRoute === 'fastest') && routeData.fastest_route.coordinates.length > 0 && (
                  <Polyline
                    positions={routeData.fastest_route.coordinates}
                    pathOptions={{
                      color: '#dc2626',
                      weight: activeRoute === 'fastest' ? 6 : 4,
                      opacity: activeRoute === 'fastest' ? 0.95 : 0.65,
                      dashArray: '8, 6',
                    }}
                    eventHandlers={{ click: () => setActiveRoute('fastest') }}
                  >
                    <Popup>
                      <strong className="text-red-700">Direct Arterial Route</strong>
                      <br />
                      Average AQI: <b>{routeData.fastest_route.average_aqi}</b>
                      <br />
                      Duration: <b>{routeData.fastest_route.duration_min} mins</b>
                    </Popup>
                  </Polyline>
                )}

                {/* Clean Air Route Polyline */}
                {routeData && (showBothOnMap || activeRoute === 'clean') && routeData.cleanest_route.coordinates.length > 0 && (
                  <Polyline
                    positions={routeData.cleanest_route.coordinates}
                    pathOptions={{
                      color: '#059669',
                      weight: activeRoute === 'clean' ? 7 : 4,
                      opacity: activeRoute === 'clean' ? 1.0 : 0.65,
                    }}
                    eventHandlers={{ click: () => setActiveRoute('clean') }}
                  >
                    <Popup>
                      <strong className="text-emerald-700">Clean Air Route (Green Nav)</strong>
                      <br />
                      Average AQI: <b>{routeData.cleanest_route.average_aqi}</b>
                      <br />
                      Duration: <b>{routeData.cleanest_route.duration_min} mins</b>
                      <br />
                      <i>Protected by urban green belts & parkways</i>
                    </Popup>
                  </Polyline>
                )}
              </MapContainer>

              {/* Floating Simple Legend on Map */}
              <div className="absolute bottom-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-emerald-900/15 shadow-md text-xs flex flex-col gap-1.5">
                <div
                  onClick={() => setActiveRoute('clean')}
                  className={`flex items-center gap-2 cursor-pointer ${activeRoute === 'clean' ? 'font-extrabold text-emerald-900' : 'text-gray-600'}`}
                >
                  <span className="w-5 h-2 rounded bg-emerald-600 inline-block" />
                  <span>Clean Air Route (Green Nav)</span>
                  {activeRoute === 'clean' && <Check size={13} className="text-emerald-600" />}
                </div>
                <div
                  onClick={() => setActiveRoute('fastest')}
                  className={`flex items-center gap-2 cursor-pointer ${activeRoute === 'fastest' ? 'font-extrabold text-red-900' : 'text-gray-600'}`}
                >
                  <span className="w-5 h-1.5 border-t-2 border-dashed border-red-600 inline-block" />
                  <span>Direct Arterial Route</span>
                  {activeRoute === 'fastest' && <Check size={13} className="text-red-600" />}
                </div>
              </div>
            </div>

            {/* Bottom At-a-glance Summary Bar */}
            {routeData && (
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block">
                      Clean Air Savings
                    </span>
                    <strong className="text-sm text-emerald-950 font-extrabold">
                      {routeData.savings_percent}% Cleaner Air
                    </strong>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold">
                    🌿
                  </span>
                </div>

                <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block">
                      Time Cost
                    </span>
                    <strong className="text-sm text-emerald-950 font-extrabold">
                      +{routeData.time_difference_min} min drive
                    </strong>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    ⏱️
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageMotion>
  )
}
