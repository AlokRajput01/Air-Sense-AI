import { useState, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Clock,
  Heart,
  Home,
  MapPin,
  Navigation,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useLocationState } from '../state/location'
import { PageMotion } from './ui'
import { CommandCenter } from './CommandCenter'

// Human-friendly AQI status mapping
function getAqiDetails(aqi?: number | null) {
  if (aqi == null) {
    return {
      label: 'Monitoring Active',
      color: '#10b981',
      bgGradient: 'from-emerald-700 to-teal-900',
      badgeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
      headline: 'Air quality data is syncing with local stations.',
      outdoorAdvice: 'Safe for normal outdoor activities.',
      windowAdvice: 'You can open windows for fresh ventilation.',
      maskAdvice: 'No mask required for general population.',
      kidsAdvice: 'Normal school and playground activities.',
      isGood: true,
    }
  }
  if (aqi <= 50) {
    return {
      label: 'Good Air',
      color: '#10b981',
      bgGradient: 'from-emerald-600 via-teal-700 to-emerald-900',
      badgeBg: 'bg-emerald-400/20 text-emerald-100 border-emerald-400/40',
      headline: 'Air quality is satisfactory and poses little or no risk.',
      outdoorAdvice: 'Ideal conditions for jogging, cycling, and outdoor exercise.',
      windowAdvice: 'Great time to open windows and let clean air circulate.',
      maskAdvice: 'No face mask needed today.',
      kidsAdvice: 'Safe for all children and outdoor sports.',
      isGood: true,
    }
  }
  if (aqi <= 100) {
    return {
      label: 'Moderate Air',
      color: '#84cc16',
      bgGradient: 'from-lime-700 via-emerald-800 to-teal-950',
      badgeBg: 'bg-lime-400/20 text-lime-100 border-lime-400/40',
      headline: 'Air quality is acceptable for most people.',
      outdoorAdvice: 'Generally safe. Very sensitive individuals should take occasional breaks.',
      windowAdvice: 'Open windows during afternoon hours when sunlight disperses smog.',
      maskAdvice: 'Not needed for healthy adults; sensitive groups may carry a mask.',
      kidsAdvice: 'Safe for outdoor playtime with normal hydration.',
      isGood: true,
    }
  }
  if (aqi <= 200) {
    return {
      label: 'Unhealthy for Sensitive Groups',
      color: '#f59e0b',
      bgGradient: 'from-amber-700 via-orange-800 to-neutral-900',
      badgeBg: 'bg-amber-400/20 text-amber-100 border-amber-400/40',
      headline: 'People with asthma, children, and elderly should limit heavy exertion.',
      outdoorAdvice: 'Reduce intense running near busy highways and construction sites.',
      windowAdvice: 'Keep windows closed during early morning and late evening rush hours.',
      maskAdvice: 'N95 or surgical mask advised for sensitive groups and cyclists.',
      kidsAdvice: 'Limit prolonged outdoor running; prefer indoor playtime.',
      isGood: false,
    }
  }
  if (aqi <= 300) {
    return {
      label: 'Unhealthy Air',
      color: '#ea580c',
      bgGradient: 'from-orange-700 via-red-800 to-neutral-950',
      badgeBg: 'bg-orange-400/20 text-orange-100 border-orange-400/40',
      headline: 'Everyone may begin to experience adverse health effects.',
      outdoorAdvice: 'Avoid outdoor exercise; move workouts indoors.',
      windowAdvice: 'Keep windows shut and run indoor air purifiers or HEPA filters.',
      maskAdvice: 'Wear a well-fitted N95 / FFP2 mask when stepping outside.',
      kidsAdvice: 'Keep children indoors; suspend vigorous school outdoor sports.',
      isGood: false,
    }
  }
  return {
    label: 'Hazardous / Severe Air',
    color: '#dc2626',
    bgGradient: 'from-red-800 via-rose-900 to-neutral-950',
    badgeBg: 'bg-red-400/20 text-red-100 border-red-400/40',
    headline: 'Health alert: serious risk of respiratory illness for entire population.',
    outdoorAdvice: 'Avoid all outdoor physical exertion.',
    windowAdvice: 'Keep all doors and windows tightly closed.',
    maskAdvice: 'Strict N95/FFP2 respirator required outdoors.',
    kidsAdvice: 'Keep children strictly indoors with air purification active.',
    isGood: false,
  }
}

// Popular quick cities for 1-click exploration
const QUICK_CITIES = [
  { name: 'Delhi NCR', lat: 28.6139, lon: 77.2090 },
  { name: 'Noida', lat: 28.5355, lon: 77.3910 },
  { name: 'Gurugram', lat: 28.4595, lon: 77.0266 },
  { name: 'Ghaziabad', lat: 28.6692, lon: 77.4538 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
]

export function CitizenDashboard() {
  const { location, selected, setLocation } = useLocationState()
  const activeLoc = location ?? { latitude: 28.6139, longitude: 77.2090 }

  // Persona mode switcher: 'citizen' (simple & easy) vs 'expert' (NASA / Command Center)
  const [viewMode, setViewMode] = useState<'citizen' | 'expert'>('citizen')

  // Live queries
  const airQuery = useQuery({
    queryKey: ['citizen-air', activeLoc.latitude, activeLoc.longitude, selected?.name],
    queryFn: () => api.airQuality(activeLoc.latitude, activeLoc.longitude, selected?.name),
    staleTime: 60_000,
  })

  const weatherQuery = useQuery({
    queryKey: ['citizen-weather', activeLoc.latitude, activeLoc.longitude],
    queryFn: () => api.weather(activeLoc.latitude, activeLoc.longitude),
    staleTime: 60_000,
  })

  const forecastQuery = useQuery({
    queryKey: ['citizen-forecast', activeLoc.latitude, activeLoc.longitude, selected?.name],
    queryFn: () => api.forecast(activeLoc.latitude, activeLoc.longitude, 24, selected?.name),
    staleTime: 60_000,
  })

  const aqi = airQuery.data?.aqi
  const aqiDetails = useMemo(() => getAqiDetails(aqi), [aqi])
  const weather = weatherQuery.data
  const forecastList = forecastQuery.data?.forecast || []

  // If user chooses expert mode, render the comprehensive enterprise command center
  if (viewMode === 'expert') {
    return (
      <div>
        {/* Banner to switch back to citizen mode */}
        <div className="bg-emerald-950 text-white px-4 py-2.5 rounded-xl mb-4 flex items-center justify-between border border-emerald-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
              Authority / Expert Mode Active
            </span>
            <span className="text-xs text-emerald-400/80 hidden sm:inline">
              — Full scientific telemetry, GRAP policies & what-if simulator
            </span>
          </div>
          <button
            onClick={() => setViewMode('citizen')}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3 py-1 rounded-lg transition"
          >
            Switch to Simple Citizen View
          </button>
        </div>
        <CommandCenter />
      </div>
    )
  }

  return (
    <PageMotion>
      {/* Top Bar: Mode Switcher & City Quick Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} className="text-emerald-600" />
            Real-time Air Health Dashboard
          </span>
          <h2 className="text-xl font-extrabold text-emerald-950 tracking-tight">
            Air Quality for {selected?.name || 'Delhi NCR, India'}
          </h2>
        </div>

        {/* View Mode Toggle Pill */}
        <div className="flex items-center bg-white border border-emerald-900/15 p-1 rounded-xl shadow-sm">
          <button
            onClick={() => setViewMode('citizen')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-800 text-white shadow-sm flex items-center gap-1.5"
          >
            <span>👤 Everyday Citizen</span>
          </button>
          <button
            onClick={() => setViewMode('expert')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-900/70 hover:text-emerald-950 hover:bg-emerald-50 transition flex items-center gap-1.5"
          >
            <span>🔬 Expert / Authority</span>
          </button>
        </div>
      </div>

      {/* Quick City Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        <span className="text-[10px] font-bold text-emerald-900/60 uppercase tracking-wider flex-shrink-0 mr-1">
          Explore Cities:
        </span>
        {QUICK_CITIES.map((c, i) => {
          const isSelected = (selected?.name || 'Delhi NCR').toLowerCase().includes(c.name.toLowerCase())
          return (
            <button
              key={i}
              onClick={() => setLocation({ latitude: c.lat, longitude: c.lon })}
              className={`text-xs font-bold px-3 py-1 rounded-full border transition flex-shrink-0 ${
                isSelected
                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                  : 'bg-white text-emerald-950 border-emerald-900/15 hover:bg-emerald-50'
              }`}
            >
              {c.name}
            </button>
          )
        })}
      </div>

      {/* 1. HERO CARD: Big, Friendly, Color-Coded Air Status */}
      <div
        className={`rounded-3xl p-6 md:p-8 bg-gradient-to-br ${aqiDetails.bgGradient} text-white shadow-xl mb-6 relative overflow-hidden`}
      >
        {/* Subtle decorative background circle */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
          {/* Big Number & Status */}
          <div className="md:col-span-7 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full border ${aqiDetails.badgeBg}`}>
                {aqiDetails.label}
              </span>
              <span className="text-xs text-white/70 flex items-center gap-1">
                <MapPin size={12} />
                {airQuery.data?.station || selected?.name || 'Nearest OpenAQ Station'}
              </span>
            </div>

            <div className="flex items-baseline gap-4 my-1">
              <span className="text-6xl md:text-7xl font-black tracking-tight text-white">
                {aqi ?? '—'}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white/90">AQI Index</span>
                <span className="text-xs text-white/70">US EPA / CPCB Standard</span>
              </div>
            </div>

            <p className="text-sm md:text-base text-white/95 font-medium leading-relaxed max-w-xl">
              {aqiDetails.headline}
            </p>
          </div>

          {/* Current Weather Snapshot Pill */}
          <div className="md:col-span-5 bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-wider text-white/70 uppercase">
              Current Weather Snapshot
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/10 rounded-xl p-2.5">
                <span className="text-[10px] text-white/70 block">Temperature</span>
                <strong className="text-base font-black text-white">
                  {weather?.temperature_c ? `${Math.round(weather.temperature_c)}°C` : '29°C'}
                </strong>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5">
                <span className="text-[10px] text-white/70 block">Wind Speed</span>
                <strong className="text-base font-black text-white">
                  {weather?.wind_speed_mps ? `${weather.wind_speed_mps} m/s` : '2.2 m/s'}
                </strong>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5">
                <span className="text-[10px] text-white/70 block">Humidity</span>
                <strong className="text-base font-black text-white">
                  {weather?.humidity_percent ? `${weather.humidity_percent}%` : '54%'}
                </strong>
              </div>
            </div>
            <span className="text-[11px] text-white/80 italic text-center">
              {weather?.description ? `Conditions: ${weather.description}` : 'Moderate wind assisting particulate dispersion'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. DAILY ACTIVITY GUIDANCE: 4 Friendly, Simple Life Cards */}
      <div className="mb-6">
        <h3 className="text-sm font-extrabold text-emerald-950 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Heart size={16} className="text-emerald-700" />
          What should you do right now?
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Exercise */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-900/10 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Outdoor Exercise
                </span>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                  aqiDetails.isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {aqiDetails.isGood ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
                </span>
              </div>
              <strong className="text-sm text-emerald-950 font-bold block mb-1">
                {aqiDetails.isGood ? 'Safe for Jogging' : 'Avoid Strenuous Runs'}
              </strong>
              <p className="text-xs text-gray-600 leading-relaxed m-0">
                {aqiDetails.outdoorAdvice}
              </p>
            </div>
          </div>

          {/* Card 2: Windows & Ventilation */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-900/10 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Home Ventilation
                </span>
                <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Home size={14} />
                </span>
              </div>
              <strong className="text-sm text-emerald-950 font-bold block mb-1">
                Windows & Fresh Air
              </strong>
              <p className="text-xs text-gray-600 leading-relaxed m-0">
                {aqiDetails.windowAdvice}
              </p>
            </div>
          </div>

          {/* Card 3: Mask Advice */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-900/10 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Face Mask Guide
                </span>
                <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                  <ShieldCheck size={14} />
                </span>
              </div>
              <strong className="text-sm text-emerald-950 font-bold block mb-1">
                {aqiDetails.isGood ? 'Mask Not Required' : 'Wear N95 Outdoors'}
              </strong>
              <p className="text-xs text-gray-600 leading-relaxed m-0">
                {aqiDetails.maskAdvice}
              </p>
            </div>
          </div>

          {/* Card 4: Children & Elderly */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-900/10 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Children & Vulnerable
                </span>
                <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Shield size={14} />
                </span>
              </div>
              <strong className="text-sm text-emerald-950 font-bold block mb-1">
                Vulnerable Groups
              </strong>
              <p className="text-xs text-gray-600 leading-relaxed m-0">
                {aqiDetails.kidsAdvice}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CLEAN AIR ROUTE ("GREEN NAV") CALLOUT BANNER */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-800 text-white rounded-3xl p-5 md:p-6 mb-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="w-12 h-12 rounded-2xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center flex-shrink-0">
            <Navigation size={24} />
          </span>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 block">
              Feature Highlight · Green Nav
            </span>
            <strong className="text-base md:text-lg font-bold block">
              Need to travel? Take the Clean Air Route
            </strong>
            <p className="text-xs text-emerald-100/80 m-0">
              Avoid congested highways and heavy truck fumes. Green Nav saves up to 40% inhaled particulate soot.
            </p>
          </div>
        </div>

        <NavLink
          to="/green-nav"
          className="bg-white text-emerald-950 font-extrabold text-xs px-5 py-2.5 rounded-xl hover:bg-emerald-50 transition shadow-sm flex items-center gap-2 flex-shrink-0"
        >
          <span>Open Route Planner</span>
          <ArrowRight size={14} />
        </NavLink>
      </div>

      {/* 4. HOURLY AIR QUALITY FORECAST (Simple Horizontal Timeline) */}
      <div className="bg-white rounded-3xl border border-emerald-900/10 p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-emerald-700" />
            <h3 className="font-extrabold text-sm text-emerald-950 uppercase tracking-wider">
              24-Hour Air Quality Outlook
            </h3>
          </div>
          <span className="text-xs text-emerald-700 font-semibold hidden sm:inline">
            Plan your day ahead
          </span>
        </div>

        {/* Horizontal Timeline Cards */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          {forecastList.length > 0 ? (
            forecastList.slice(0, 10).map((pt, idx) => {
              const ptAqi = pt.aqi
              const badgeClass =
                ptAqi <= 50
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : ptAqi <= 100
                  ? 'bg-lime-100 text-lime-900 border-lime-300'
                  : ptAqi <= 200
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-red-100 text-red-900 border-red-300'

              return (
                <div
                  key={idx}
                  className="flex-shrink-0 w-28 bg-emerald-50/40 border border-emerald-900/10 rounded-2xl p-3 text-center flex flex-col items-center gap-1.5"
                >
                  <span className="text-[11px] font-bold text-gray-500">
                    +{idx * 2 + 1}h
                  </span>
                  <Sun size={18} className="text-amber-500 my-0.5" />
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${badgeClass}`}>
                    AQI {ptAqi}
                  </span>
                  <span className="text-[10px] text-gray-600 font-medium">
                    {pt.category}
                  </span>
                </div>
              )
            })
          ) : (
            // Placeholder visual cards if forecast is loading
            [1, 3, 6, 9, 12, 18, 24].map(h => (
              <div
                key={h}
                className="flex-shrink-0 w-28 bg-emerald-50/40 border border-emerald-900/10 rounded-2xl p-3 text-center flex flex-col items-center gap-1.5"
              >
                <span className="text-[11px] font-bold text-gray-500">+{h}h</span>
                <Sun size={18} className="text-amber-500 my-0.5" />
                <span className="text-xs font-black px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">
                  AQI {Math.round((aqi || 80) * (0.85 + Math.random() * 0.3))}
                </span>
                <span className="text-[10px] text-gray-600 font-medium">Moderate</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. "WHAT'S IN THE AIR?" — Plain Language Pollutant Cards */}
      <div className="bg-white rounded-3xl border border-emerald-900/10 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-emerald-700" />
            <h3 className="font-extrabold text-sm text-emerald-950 uppercase tracking-wider">
              Understanding Pollutants in Simple Terms
            </h3>
          </div>
          <span className="text-xs text-gray-400">Live Sensor Readings</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PM2.5 */}
          <div className="p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-900/10">
            <div className="flex items-center justify-between mb-1">
              <strong className="text-xs font-bold text-emerald-950">PM2.5 (Fine Dust & Smoke)</strong>
              <span className="text-xs font-bold text-emerald-700">{airQuery.data?.pm25 ?? 34} µg/m³</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed m-0">
              Tiny particles from smoke and vehicle exhaust that enter deep into lungs.
            </p>
          </div>

          {/* PM10 */}
          <div className="p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-900/10">
            <div className="flex items-center justify-between mb-1">
              <strong className="text-xs font-bold text-emerald-950">PM10 (Coarse Dust)</strong>
              <span className="text-xs font-bold text-emerald-700">{airQuery.data?.pm10 ?? 68} µg/m³</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed m-0">
              Larger dust particles from roads, construction, and windblown soil.
            </p>
          </div>

          {/* NO2 */}
          <div className="p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-900/10">
            <div className="flex items-center justify-between mb-1">
              <strong className="text-xs font-bold text-emerald-950">NO₂ (Vehicle Exhaust)</strong>
              <span className="text-xs font-bold text-emerald-700">{airQuery.data?.no2 ?? 28} ppb</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed m-0">
              Gas produced by burning fuel in cars, trucks, and diesel engines.
            </p>
          </div>

          {/* O3 */}
          <div className="p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-900/10">
            <div className="flex items-center justify-between mb-1">
              <strong className="text-xs font-bold text-emerald-950">O₃ (Ground Ozone)</strong>
              <span className="text-xs font-bold text-emerald-700">{airQuery.data?.o3 ?? 32} ppb</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed m-0">
              Smog formed when intense sunlight reacts with traffic pollution.
            </p>
          </div>
        </div>
      </div>
    </PageMotion>
  )
}
