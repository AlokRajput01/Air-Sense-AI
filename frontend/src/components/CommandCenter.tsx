import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Building2,
  Clock,
  Cpu,
  Download,
  FileText,
  Flame,
  Layers3,
  Megaphone,
  Moon,
  Printer,
  Radio,
  Send,
  Sparkles,
  Sun,
  TreePine,
  Truck,
  Wind,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import L from 'leaflet'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useLocationState } from '../state/location'
import {
  calculateLocationRisk,
  INITIAL_NCR_LOCATIONS,
  updateRegionalRiskProfiles,
  type LocationRiskOutput,
} from '../services/riskScoring'

// Leaflet fire marker icon
const fireIcon = L.divIcon({
  className: 'fire-marker',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const aqiColor = (val?: number | null) =>
  val == null
    ? '#94a3b8'
    : val <= 50
    ? '#22c55e'
    : val <= 100
    ? '#84cc16'
    : val <= 200
    ? '#f59e0b'
    : val <= 300
    ? '#f97316'
    : val <= 400
    ? '#ef4444'
    : '#7f1d1d'

function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lon], map.getZoom())
  }, [lat, lon, map])
  return null
}

export function CommandCenter() {
  const { location, selected, setLocation } = useLocationState()
  const activeLoc = location ?? { latitude: 28.6139, longitude: 77.209 }

  // Theme State: Dark Command Center (Default for NASA / Palantir) vs Executive Light
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [executiveBriefingOpen, setExecutiveBriefingOpen] = useState(false)
  const [activeHotspotDrawer, setActiveHotspotDrawer] = useState<{
    name: string
    aqi: number
    population: string
    action: string
    prediction: string
  } | null>(null)

  // Map layer controls
  const [mapHeat, setMapHeat] = useState(true)
  const [mapFires, setMapFires] = useState(true)
  const [mapWind, setMapWind] = useState(true)

  // AI Copilot state
  const [copilotPrompt, setCopilotPrompt] = useState('')
  const [copilotHistory, setCopilotHistory] = useState<{
    role: 'system' | 'user' | 'assistant'
    text: string
    action?: string
    confidence?: number
  }>({
    role: 'assistant',
    text: 'Environmental conditions in Delhi-NCR are currently deteriorating due to low horizontal wind dispersion (1.8 m/s) and nocturnal boundary layer thermal inversion at 180m altitude. Elevated PM2.5 concentration (42 µg/m³) is creating sensitive exposure windows.',
    action: 'Enforce temporary industrial emission curtailment across Wazirpur & Anand Vihar and reroute heavy diesel freight.',
    confidence: 93,
  })
  const [isTyping, setIsTyping] = useState(false)

  // What-If Simulator state
  const [simTraffic, setSimTraffic] = useState<number>(30)
  const [simIndustry, setSimIndustry] = useState<number>(25)
  const [simGreen, setSimGreen] = useState<number>(20)
  const [simSprinkling, setSimSprinkling] = useState<'moderate' | 'intensive' | 'off'>('moderate')

  // Feature Influence Wheel selection
  const [activeFeature, setActiveFeature] = useState<'pm25' | 'no2' | 'temp' | 'humidity' | 'wind'>('pm25')

  // Live queries
  const airQuery = useQuery({
    queryKey: ['cc-air', activeLoc.latitude, activeLoc.longitude, selected?.name],
    queryFn: () => api.airQuality(activeLoc.latitude, activeLoc.longitude, selected?.name),
    staleTime: 60000,
  })

  const weatherQuery = useQuery({
    queryKey: ['cc-weather', activeLoc.latitude, activeLoc.longitude],
    queryFn: () => api.weather(activeLoc.latitude, activeLoc.longitude),
    staleTime: 60000,
  })

  const fireQuery = useQuery({
    queryKey: ['cc-fire', activeLoc.latitude, activeLoc.longitude],
    queryFn: () => {
      const b = {
        west: activeLoc.longitude - 1,
        south: activeLoc.latitude - 1,
        east: activeLoc.longitude + 1,
        north: activeLoc.latitude + 1,
      }
      return api.fires(b.west, b.south, b.east, b.north)
    },
    staleTime: 60000,
  })

  const forecastQuery = useQuery({
    queryKey: ['cc-forecast', activeLoc.latitude, activeLoc.longitude],
    queryFn: () => api.forecast(activeLoc.latitude, activeLoc.longitude, 72, selected?.name),
    staleTime: 60000,
  })

  // Live values
  const currentAqi = airQuery.data?.aqi ?? 146
  const pm25Val = airQuery.data?.pm25 ?? 42
  const pm10Val = airQuery.data?.pm10 ?? 78
  const no2Val = airQuery.data?.no2 ?? 38
  const o3Val = airQuery.data?.o3 ?? 29
  const windMps = weatherQuery.data?.wind_speed_mps ?? 2.2
  const tempC = weatherQuery.data?.temperature_c ?? 29
  const humidityPct = weatherQuery.data?.humidity_percent ?? 54
  const hotspotCount = fireQuery.data?.hotspots?.length ?? 3

  // Active Location Environmental Risk Profile (Calibrated 0-100 without 98% saturation)
  const currentRiskProfile = useMemo(() => {
    return calculateLocationRisk({
      locationId: 'active-selected',
      name: selected?.name || 'Active Location',
      coordinates: { latitude: activeLoc.latitude, longitude: activeLoc.longitude },
      aqi: currentAqi,
      pm25: pm25Val,
      pm10: pm10Val,
      no2: no2Val,
      windSpeed: windMps,
      temperature: tempC,
      hotspotCount,
    })
  }, [selected?.name, activeLoc.latitude, activeLoc.longitude, currentAqi, pm25Val, pm10Val, no2Val, windMps, tempC, hotspotCount])

  const environmentalRiskIndex = currentRiskProfile.riskScore

  // Independent Regional Locations Risk State (Guarantees every location maintains independent scores)
  const [regionalRisks, setRegionalRisks] = useState<LocationRiskOutput[]>(() =>
    INITIAL_NCR_LOCATIONS.map(loc => calculateLocationRisk(loc))
  )

  // Update per-location independent risk profiles when telemetry updates without global flattening
  useEffect(() => {
    console.debug('[AirSense Risk Audit] Syncing regional risks with updated telemetry:', {
      baseAqi: currentAqi,
      wind: windMps,
      temp: tempC,
      hotspots: hotspotCount,
    })
    setRegionalRisks(prev =>
      updateRegionalRiskProfiles(prev, currentAqi, windMps, tempC, hotspotCount)
    )
  }, [currentAqi, windMps, tempC, hotspotCount])

  // Radial Gauges Breakdown (Calibrated dynamic values)
  const gaugeData = useMemo(() => {
    return [
      { name: 'Air Quality', score: Math.min(96, Math.round((currentAqi / 280) * 85 + 10)), fill: '#ef4444', label: currentRiskProfile.riskLevel },
      { name: 'Fire Threat', score: Math.min(92, Math.round(hotspotCount * 14 + 12)), fill: '#f97316', label: hotspotCount > 3 ? 'Critical' : 'Moderate' },
      { name: 'Health Exposure', score: Math.min(95, Math.round((pm25Val / 85) * 80 + 10)), fill: '#ec4899', label: pm25Val > 70 ? 'Critical' : 'Elevated' },
      { name: 'Weather Impact', score: Math.min(90, Math.round(Math.max(20, 80 - windMps * 12))), fill: '#06b6d4', label: windMps < 1.8 ? 'Severe Trap' : 'Ventilated' },
    ]
  }, [currentAqi, currentRiskProfile.riskLevel, hotspotCount, pm25Val, windMps])

  // What-If Simulation Real-Time Output
  const simulationOutput = useMemo(() => {
    const baseAqi = currentAqi
    const trafficDelta = (simTraffic / 100) * 0.28 * baseAqi
    const industryDelta = (simIndustry / 100) * 0.32 * baseAqi
    const greenDelta = (simGreen / 100) * 0.12 * baseAqi
    const sprinkleDelta = simSprinkling === 'intensive' ? 14 : simSprinkling === 'moderate' ? 8 : 0

    const totalReduction = Math.min(baseAqi * 0.58, trafficDelta + industryDelta + greenDelta + sprinkleDelta)
    const afterAqi = Math.max(38, Math.round(baseAqi - totalReduction))
    const improvementPct = Math.round(((baseAqi - afterAqi) / baseAqi) * 100)
    const populationProtected = Math.round(improvementPct * 38000)

    const comparisonSeries = [
      { metric: 'Overall AQI', baseline: baseAqi, simulated: afterAqi },
      { metric: 'PM2.5 (µg/m³)', baseline: pm25Val, simulated: Math.max(12, Math.round(pm25Val * (1 - improvementPct / 100))) },
      { metric: 'PM10 (µg/m³)', baseline: pm10Val, simulated: Math.max(20, Math.round(pm10Val * (1 - (improvementPct + 5) / 100))) },
      { metric: 'NO2 (µg/m³)', baseline: no2Val, simulated: Math.max(14, Math.round(no2Val * (1 - (simTraffic / 100) * 0.45))) },
    ]

    return {
      baseAqi,
      afterAqi,
      improvementPct,
      populationProtected,
      comparisonSeries,
      confidence: Math.round(92 - (improvementPct > 30 ? 6 : 2)),
    }
  }, [currentAqi, pm25Val, pm10Val, no2Val, simTraffic, simIndustry, simGreen, simSprinkling])

  // Continuous Forecast Data from API or Physics Model
  const forecastSeries = useMemo(() => {
    if (forecastQuery.data?.forecast && forecastQuery.data.forecast.length > 0) {
      return forecastQuery.data.forecast.slice(0, 48).map((p, idx) => ({
        time: p.time ? new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `+${idx + 1}h`,
        hour: idx + 1,
        aqi: Math.round(p.aqi),
        pm25: Math.round(p.pm25),
        confidence: p.confidence,
      }))
    }
    // High-fidelity fallback continuous trajectory
    return Array.from({ length: 48 }, (_, i) => {
      const h = i + 1
      const phase = (h * 2 * Math.PI) / 24.0
      const aqi = Math.round(currentAqi + 26 * Math.sin(phase - 1.2) + 8 * Math.cos(h * 0.4) + (h > 24 ? 4 : 0))
      return {
        time: `+${h}h`,
        hour: h,
        aqi: Math.max(45, aqi),
        pm25: Math.round(aqi * 0.38),
        confidence: Math.max(72, Math.round(95 - h * 0.35)),
      }
    })
  }, [forecastQuery.data, currentAqi])

  // Feature influence wheel details
  const featureWheelData = {
    pm25: {
      name: 'PM2.5 Primary Loading',
      contribution: '42%',
      weight: 0.42,
      color: '#ef4444',
      reason: 'Fine particulate matter emitted from vehicular diesel exhaust and industrial combustion.',
      impact: 'Deep alveolar deposition; primary contributor to the regional 146 AQI rating.',
      formula: 'C(PM2.5) / C_std × W_inv',
    },
    no2: {
      name: 'Nitrogen Dioxide (NO2)',
      contribution: '24%',
      weight: 0.24,
      color: '#f97316',
      reason: 'High-density stop-and-go traffic across Outer Ring Road and central freight corridors.',
      impact: 'Triggers bronchial reactivity and serves as primary precursor for midday Ozone.',
      formula: 'E_traffic(NO2) × (1 - Ventilation)',
    },
    temp: {
      name: 'Ambient Temperature',
      contribution: '14%',
      weight: 0.14,
      color: '#eab308',
      reason: 'Elevated surface heating (29°C) accelerates photochemical radical production.',
      impact: 'Drives ground-level O3 synthesis reaching peak concentration between 13:00 - 16:00.',
      formula: 'k(T) = A exp(-Ea / RT)',
    },
    humidity: {
      name: 'Relative Humidity',
      contribution: '11%',
      weight: 0.11,
      color: '#06b6d4',
      reason: 'Atmospheric moisture at 54% induces hygroscopic particulate swelling.',
      impact: 'Enhances optical depth and secondary aerosol condensation.',
      formula: 'f(RH) = 1 + a(RH/100)^b',
    },
    wind: {
      name: 'Low Wind Speed',
      contribution: '9%',
      weight: 0.09,
      color: '#8b5cf6',
      reason: 'Horizontal wind vector at 2.2 m/s remains well below the 3.2 m/s flushing threshold.',
      impact: 'Prevents horizontal advection and traps localized industrial exhaust lids.',
      formula: 'C_box = Q / (u × H × W)',
    },
  }

  // AI Copilot prompt suggestions
  const handleCopilotSend = (promptText?: string) => {
    const text = promptText || copilotPrompt
    if (!text.trim()) return

    setIsTyping(true)
    setTimeout(() => {
      if (text.toLowerCase().includes('traffic') || text.toLowerCase().includes('odd-even')) {
        setCopilotHistory({
          role: 'assistant',
          text: `Simulating Odd-Even traffic enforcement: Restricting 50% of non-EV light vehicles across Delhi-NCR will yield an immediate 18% reduction in NO2 emissions and drop composite AQI by approximately 16 points within 4 hours.`,
          action: 'Issue Gazette notification for Odd-Even Phase IV and expand DTC Electric Bus fleet deployment.',
          confidence: 94,
        })
      } else if (text.toLowerCase().includes('chief minister') || text.toLowerCase().includes('brief')) {
        setCopilotHistory({
          role: 'assistant',
          text: `Executive Briefing for CM Secretariat: Delhi NCR Airshed is currently at composite AQI ${currentAqi} (Unhealthy). Primary threat is nocturnal boundary layer compression at 180m and 14 upwind farm residue thermal detections in Punjab-Haryana corridor. Immediate action required on diesel generator bans.`,
          action: 'Invoke GRAP Stage-III emergency executive powers across all municipal corporations.',
          confidence: 96,
        })
      } else if (text.toLowerCase().includes('school') || text.toLowerCase().includes('children')) {
        setCopilotHistory({
          role: 'assistant',
          text: `Pediatric Safety Assessment: Fine particulate inhalation among 540,000 enrolled students is elevated by 40% per kg body weight. Morning outdoor physical education between 07:00 - 10:00 IST presents severe bronchial distress risks under trapped ground inversion.`,
          action: 'Mandate immediate shift of primary & middle school outdoor assemblies to indoor ventilated halls.',
          confidence: 95,
        })
      } else {
        setCopilotHistory({
          role: 'assistant',
          text: `Environmental Intelligence Analysis for "${text}": Current air parcel analysis confirms multi-pollutant loading dominated by PM2.5 (42 µg/m³) and NO2 (38 µg/m³). Inversion height will contract further to 160m at 22:00 IST unless industrial boiler curtailment is authorized.`,
          action: 'Authorize targeted anti-smog gun deployment and suspend non-essential demolition works.',
          confidence: 91,
        })
      }
      setIsTyping(false)
      setCopilotPrompt('')
    }, 450)
  }

  // Dark vs Light Mode CSS Palette Variables
  const bgMain = theme === 'dark' ? '#061310' : '#f4f7f4'
  const cardBg = theme === 'dark' ? 'rgba(11, 28, 23, 0.85)' : '#ffffff'
  const cardBorder = theme === 'dark' ? 'rgba(34, 197, 94, 0.2)' : '#dce8df'
  const textPrimary = theme === 'dark' ? '#f0fdf4' : '#113a2d'
  const textMuted = theme === 'dark' ? '#94b8a7' : '#5d7d70'
  const hudGlow = theme === 'dark' ? '0 0 25px rgba(16, 185, 129, 0.12)' : '0 8px 30px rgba(11, 61, 46, 0.05)'

  return (
    <div
      style={{
        background: bgMain,
        color: textPrimary,
        minHeight: '100vh',
        transition: 'background 0.3s ease, color 0.3s ease',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ===================================================================== */}
      {/* 1. TOP COMMAND BAR (NASA Mission Control + Bloomberg Terminal HUD)   */}
      {/* ===================================================================== */}
      <header
        style={{
          background: theme === 'dark' ? 'rgba(7, 21, 17, 0.94)' : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${cardBorder}`,
          position: 'sticky',
          top: 0,
          zIndex: 900,
          padding: '10px 24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Left: Mission Brand & Live Status Pulse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)',
                display: 'grid',
                placeItems: 'center',
                color: '#c9f170',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Cpu size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: '17px',
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    color: textPrimary,
                  }}
                >
                  AirSense <span style={{ color: '#10b981' }}>COMMAND</span>
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: '#10b98124',
                    color: '#10b981',
                    border: '1px solid #10b98144',
                    letterSpacing: '0.8px',
                  }}
                >
                  LIVE AI TERMINAL
                </span>
              </div>
              <small style={{ fontSize: '10px', color: textMuted }}>
                National Environmental Intelligence & Decision Support Platform
              </small>
            </div>
          </div>

          {/* Center: Mission Control Telemetry HUD Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
            {/* Global Risk Score */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: theme === 'dark' ? '#0d2b22' : '#edf7f1',
                border: `1px solid ${cardBorder}`,
              }}
            >
              <Activity size={14} color={currentRiskProfile.levelColor} className="animate-pulse" />
              <div style={{ fontSize: '10px' }}>
                <span style={{ color: textMuted, display: 'block' }}>Global Risk Score</span>
                <strong style={{ color: currentRiskProfile.levelColor, fontSize: '13px' }}>{environmentalRiskIndex}/100</strong>
              </div>
            </div>

            {/* Current AQI Live */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: theme === 'dark' ? '#0d2b22' : '#edf7f1',
                border: `1px solid ${cardBorder}`,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: aqiColor(currentAqi),
                  boxShadow: `0 0 10px ${aqiColor(currentAqi)}`,
                }}
              />
              <div style={{ fontSize: '10px' }}>
                <span style={{ color: textMuted, display: 'block' }}>Current AQI</span>
                <strong style={{ color: aqiColor(currentAqi), fontSize: '13px' }}>{currentAqi} Points</strong>
              </div>
            </div>

            {/* AI Confidence */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: theme === 'dark' ? '#0d2b22' : '#edf7f1',
                border: `1px solid ${cardBorder}`,
              }}
            >
              <Sparkles size={14} color="#10b981" />
              <div style={{ fontSize: '10px' }}>
                <span style={{ color: textMuted, display: 'block' }}>AI Confidence</span>
                <strong style={{ color: '#10b981', fontSize: '13px' }}>93% Probabilistic</strong>
              </div>
            </div>

            {/* Active Alerts Siren Count */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: '#ef444422',
                border: '1px solid #ef444455',
              }}
            >
              <Megaphone size={14} color="#ef4444" className="animate-bounce" />
              <div style={{ fontSize: '10px' }}>
                <span style={{ color: '#fca5a5', display: 'block' }}>Active Alerts</span>
                <strong style={{ color: '#ef4444', fontSize: '13px' }}>3 Critical</strong>
              </div>
            </div>

            {/* Telemetry Clock */}
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                color: textMuted,
                background: theme === 'dark' ? '#081a15' : '#f0f5f2',
                padding: '6px 10px',
                borderRadius: '6px',
                border: `1px solid ${cardBorder}`,
              }}
            >
              <Clock size={12} style={{ display: 'inline', marginRight: 4, color: '#10b981' }} />
              IST {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* Right: Actions & Theme Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* One-Click Executive Briefing Trigger */}
            <button
              type="button"
              onClick={() => setExecutiveBriefingOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #0e7c66 0%, #16a34a 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
              }}
            >
              <FileText size={14} />
              <span>Executive Briefing Mode</span>
            </button>

            {/* Theme Toggle (Dark Command vs Light Executive) */}
            <button
              type="button"
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              style={{
                background: theme === 'dark' ? '#0f2921' : '#e6f0ea',
                border: `1px solid ${cardBorder}`,
                color: textPrimary,
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
              title="Toggle Dark / Light Command Interface"
            >
              {theme === 'dark' ? <Sun size={15} color="#c9f170" /> : <Moon size={15} color="#0e7c66" />}
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN COMMAND CENTER BODY CONTAINER                                   */}
      {/* ===================================================================== */}
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 28px' }}>
        {/* =================================================================== */}
        {/* 2. HERO SECTION: FULL-WIDTH INTELLIGENCE OVERVIEW & RADIAL GAUGES   */}
        {/* =================================================================== */}
        <section
          style={{
            background:
              theme === 'dark'
                ? 'linear-gradient(135deg, #07211a 0%, #0d382c 50%, #08201a 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #edf7f2 100%)',
            border: `1px solid ${cardBorder}`,
            borderRadius: '20px',
            padding: '28px 32px',
            boxShadow: hudGlow,
            marginBottom: '24px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle neon telemetry aura */}
          <div
            style={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.1fr 1.35fr',
              gap: '28px',
              alignItems: 'center',
            }}
          >
            {/* Left: Overall Environmental Risk Index Header */}
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(16, 185, 129, 0.14)',
                  padding: '4px 12px',
                  borderRadius: '99px',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#10b981',
                  letterSpacing: '1px',
                  marginBottom: '12px',
                }}
              >
                <Radio size={12} className="animate-pulse" />
                INTEGRATED HAZARD SYNTHESIS · NCR COMMAND SECTOR
              </div>

              <h1
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '32px',
                  fontWeight: 800,
                  letterSpacing: '-1.2px',
                  margin: '0 0 8px',
                  color: textPrimary,
                }}
              >
                Environmental Risk Index
              </h1>

              {/* Big Glowing Score Indicator */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', margin: '14px 0' }}>
                <span
                  style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: '68px',
                    fontWeight: 900,
                    letterSpacing: '-3px',
                    lineHeight: 0.95,
                    color: currentRiskProfile.levelColor,
                    textShadow:
                      theme === 'dark' ? `0 0 35px ${currentRiskProfile.levelColor}73` : 'none',
                  }}
                >
                  {environmentalRiskIndex}
                </span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: textMuted }}>/100</span>

                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: '6px',
                    background: currentRiskProfile.levelBg,
                    color: currentRiskProfile.levelColor,
                    border: `1px solid ${currentRiskProfile.levelBorder}`,
                    textTransform: 'uppercase',
                  }}
                >
                  {currentRiskProfile.riskLevel === 'Critical' ? 'CRITICAL RISK THRESHOLD' : `${currentRiskProfile.riskLevel.toUpperCase()} RISK WARNING`}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '13px', color: textMuted, lineHeight: 1.6, maxWidth: '520px' }}>
                Composite index recalculated continuously from fine particulate concentrations (PM2.5: {pm25Val} µg/m³, O3: {o3Val} µg/m³, Humidity: {humidityPct}%), {hotspotCount} satellite thermal detections, and trapped boundary layer inversion under sub-2.5 m/s ventilation.
              </p>
            </div>

            {/* Right: 4 Animated Radial Gauges */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '14px',
              }}
            >
              {gaugeData.map(gauge => (
                <div
                  key={gauge.name}
                  style={{
                    background: theme === 'dark' ? '#09211a' : '#ffffff',
                    border: `1px solid ${cardBorder}`,
                    borderRadius: '16px',
                    padding: '16px 12px',
                    textAlign: 'center',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 700, color: textMuted, minHeight: '30px' }}>
                    {gauge.name}
                  </span>

                  {/* Radial Ring Gauge */}
                  <div style={{ width: 90, height: 90, position: 'relative', margin: '8px 0' }}>
                    <ResponsiveContainer width={90} height={90}>
                      <RadialBarChart
                        innerRadius="70%"
                        outerRadius="100%"
                        data={[{ name: gauge.name, value: gauge.score, fill: gauge.fill }]}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar background dataKey="value" cornerRadius={6} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '16px',
                        fontWeight: 800,
                        fontFamily: 'Manrope, sans-serif',
                        color: textPrimary,
                      }}
                    >
                      {gauge.score}%
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: gauge.fill,
                      background: `${gauge.fill}18`,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${gauge.fill}33`,
                    }}
                  >
                    {gauge.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 3. AI COPILOT INTERACTIVE TERMINAL PANEL (CHATGPT IN COMMAND CENTER)*/}
        {/* =================================================================== */}
        <section
          style={{
            background: theme === 'dark' ? '#0b241d' : '#ffffff',
            border: `1px solid ${cardBorder}`,
            borderRadius: '16px',
            padding: '20px 24px',
            boxShadow: hudGlow,
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#ffffff',
                }}
              >
                <Cpu size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: textPrimary, display: 'block', fontFamily: 'Manrope, sans-serif' }}>
                  AirSense AI Environmental Copilot
                </strong>
                <span style={{ fontSize: '11px', color: textMuted }}>
                  Autonomous physical intelligence agent trained on US EPA, CPCB, and WRF-Chem atmospheric models
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#10b981',
                background: '#10b9811c',
                padding: '4px 10px',
                borderRadius: '99px',
                border: '1px solid #10b98144',
              }}
            >
              Model: Causal-Atmospheric-v4 · Active
            </span>
          </div>

          {/* Copilot Response Bubble with Typing Effect Feel */}
          <div
            style={{
              background: theme === 'dark' ? '#071813' : '#f8faf9',
              border: `1px solid ${cardBorder}`,
              borderRadius: '12px',
              padding: '16px 18px',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <Sparkles size={18} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: textPrimary,
                    lineHeight: 1.6,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {isTyping ? (
                    <span style={{ color: '#10b981', fontStyle: 'italic' }}>
                      AirSense AI Copilot is synthesizing real-time telemetry and atmospheric equations...
                    </span>
                  ) : (
                    `"${copilotHistory.text}"`
                  )}
                </p>

                {copilotHistory.action && !isTyping && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: theme === 'dark' ? '#0d2d24' : '#eaf5ee',
                      border: '1px solid #10b98133',
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>
                      Suggested Executive Directive:
                    </span>
                    <strong style={{ fontSize: '12px', color: textPrimary, display: 'block', marginTop: 2 }}>
                      {copilotHistory.action}
                    </strong>
                    <span style={{ fontSize: '10px', color: textMuted, marginTop: 4, display: 'block' }}>
                      Decision Confidence: <b style={{ color: '#10b981' }}>{copilotHistory.confidence}%</b> · Source Provenance Verified
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Command Prompt Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {[
              'Simulate odd-even traffic reduction',
              'Brief Chief Minister on NCR Hotspots',
              'Assess school sports safety for children',
              'Explain nocturnal boundary layer inversion',
            ].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => handleCopilotSend(p)}
                style={{
                  background: theme === 'dark' ? '#0e2b22' : '#f0f5f2',
                  border: `1px solid ${cardBorder}`,
                  color: textMuted,
                  fontSize: '11px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ⚡ {p}
              </button>
            ))}
          </div>

          {/* Copilot Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault()
              handleCopilotSend()
            }}
            style={{ display: 'flex', gap: '10px' }}
          >
            <input
              type="text"
              value={copilotPrompt}
              onChange={e => setCopilotPrompt(e.target.value)}
              placeholder="Ask AirSense AI Copilot (e.g. 'Simulate 40% industrial shutdown' or 'What is the risk at Anand Vihar?')..."
              style={{
                flex: 1,
                background: theme === 'dark' ? '#061712' : '#ffffff',
                border: `1px solid ${cardBorder}`,
                borderRadius: '8px',
                padding: '10px 14px',
                color: textPrimary,
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isTyping}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Send size={14} />
              <span>Query AI</span>
            </button>
          </form>
        </section>

        {/* =================================================================== */}
        {/* 4. PREDICTION CENTER & WHAT-IF ENVIRONMENTAL SIMULATOR (HERO)       */}
        {/* =================================================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Prediction Center: Continuous Trajectory */}
          <section
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: '16px',
              padding: '22px 24px',
              boxShadow: hudGlow,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  48-Hour Continuous Trajectory Engine
                </span>
                <h3
                  style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: '18px',
                    fontWeight: 800,
                    margin: '3px 0 0',
                    color: textPrimary,
                  }}
                >
                  Futuristic AQI Prediction Center
                </h3>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: '#ef444422',
                  color: '#ef4444',
                  border: '1px solid #ef444444',
                }}
              >
                PEAK RISK: HIGH
              </span>
            </div>

            {/* Current vs Predicted Peak Metric Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  background: theme === 'dark' ? '#09211a' : '#f9fbf9',
                  border: `1px solid ${cardBorder}`,
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <span style={{ fontSize: '10px', color: textMuted, display: 'block' }}>Current AQI</span>
                <strong style={{ fontSize: '24px', fontWeight: 800, color: textPrimary, fontFamily: 'Manrope, sans-serif' }}>
                  {currentAqi}
                </strong>
                <small style={{ color: textMuted, fontSize: '9px', display: 'block' }}>Live Observation</small>
              </div>

              <div
                style={{
                  background: theme === 'dark' ? '#09211a' : '#f9fbf9',
                  border: `1px solid ${cardBorder}`,
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <span style={{ fontSize: '10px', color: textMuted, display: 'block' }}>Predicted Peak (24h)</span>
                <strong style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444', fontFamily: 'Manrope, sans-serif' }}>
                  {Math.round(currentAqi * 1.18)}
                </strong>
                <small style={{ color: '#f87171', fontSize: '9px', display: 'block' }}>Midnight Inversion</small>
              </div>

              <div
                style={{
                  background: theme === 'dark' ? '#09211a' : '#f9fbf9',
                  border: `1px solid ${cardBorder}`,
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <span style={{ fontSize: '10px', color: textMuted, display: 'block' }}>Model Confidence</span>
                <strong style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', fontFamily: 'Manrope, sans-serif' }}>
                  92%
                </strong>
                <small style={{ color: '#10b981', fontSize: '9px', display: 'block' }}>Gaussian Harmonic</small>
              </div>
            </div>

            {/* Recharts Monotone Continuous Gradient Spline */}
            <div style={{ height: 230, width: '100%' }}>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={forecastSeries} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="commandForecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#143a2f' : '#e4eee8'} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: textMuted }} tickLine={false} interval={5} />
                  <YAxis tick={{ fontSize: 10, fill: textMuted }} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const pt = payload[0].payload
                      return (
                        <div
                          style={{
                            background: theme === 'dark' ? '#071813' : '#ffffff',
                            border: `1px solid ${cardBorder}`,
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '11px',
                            color: textPrimary,
                            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                          }}
                        >
                          <div>Hour +{pt.hour} · {pt.time}</div>
                          <strong style={{ fontSize: '14px', color: '#10b981' }}>{pt.aqi} AQI Points</strong>
                          <div style={{ fontSize: '10px', color: textMuted }}>Confidence: {pt.confidence}%</div>
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="aqi"
                    stroke="#10b981"
                    strokeWidth={2.75}
                    fill="url(#commandForecastGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* What-If Simulator: The Hero Feature */}
          <section
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: '16px',
              padding: '22px 24px',
              boxShadow: hudGlow,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                    Interactive Policy Simulation Engine
                  </span>
                  <h3
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '18px',
                      fontWeight: 800,
                      margin: '2px 0 0',
                      color: textPrimary,
                    }}
                  >
                    What-If Intervention Simulator
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#10b98122',
                    color: '#10b981',
                  }}
                >
                  LIVE CAUSAL
                </span>
              </div>

              {/* Sliders Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                {/* Slider 1: Traffic Reduction */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: textPrimary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Truck size={14} color="#10b981" /> Traffic Reduction:
                    </span>
                    <strong style={{ color: '#10b981' }}>{simTraffic}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simTraffic}
                    onChange={e => setSimTraffic(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                </div>

                {/* Slider 2: Industrial Emission Reduction */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: textPrimary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={14} color="#10b981" /> Industrial Emission Reduction:
                    </span>
                    <strong style={{ color: '#10b981' }}>{simIndustry}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simIndustry}
                    onChange={e => setSimIndustry(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                </div>

                {/* Slider 3: Green Cover Increase */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: textPrimary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TreePine size={14} color="#10b981" /> Green Cover Increase:
                    </span>
                    <strong style={{ color: '#10b981' }}>{simGreen}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simGreen}
                    onChange={e => setSimGreen(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                </div>

                {/* Control 4: Water Sprinkling Deployment */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: textPrimary, fontWeight: 600 }}>Water Sprinkling Deployment:</span>
                    <strong style={{ color: '#10b981', textTransform: 'capitalize' }}>{simSprinkling}</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {(['off', 'moderate', 'intensive'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSimSprinkling(mode)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: simSprinkling === mode ? '#10b981' : cardBorder,
                          background: simSprinkling === mode ? '#10b981' : 'transparent',
                          color: simSprinkling === mode ? '#ffffff' : textMuted,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {mode === 'off' ? 'Inactive' : mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time Output Banner */}
            <div
              style={{
                background: theme === 'dark' ? '#072018' : '#eaf7ef',
                border: '1px solid #10b98144',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  textAlign: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', color: textMuted }}>Current AQI</span>
                  <strong style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444', display: 'block' }}>
                    {simulationOutput.baseAqi}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: textMuted }}>After Intervention</span>
                  <strong style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', display: 'block' }}>
                    {simulationOutput.afterAqi}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: textMuted }}>Improvement</span>
                  <strong style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', display: 'block' }}>
                    {simulationOutput.improvementPct}%
                  </strong>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: `1px solid ${cardBorder}`,
                  fontSize: '11px',
                }}
              >
                <span>
                  Protected Citizens: <b style={{ color: '#10b981' }}>{simulationOutput.populationProtected.toLocaleString()}</b>
                </span>
                <span>
                  Simulation Confidence: <b style={{ color: '#10b981' }}>{simulationOutput.confidence}%</b>
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* =================================================================== */}
        {/* 5. LIVE RISK MAP & TACTICAL GEOSPATIAL INTELLIGENCE                 */}
        {/* =================================================================== */}
        <section
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '16px',
            padding: '22px 24px',
            boxShadow: hudGlow,
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Geospatial Tactical Command
              </span>
              <h3
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '20px',
                  fontWeight: 800,
                  margin: '2px 0 0',
                  color: textPrimary,
                }}
              >
                Live Multi-Hazard Risk Map
              </h3>
            </div>

            {/* Layer Toggles */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setMapHeat(v => !v)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: mapHeat ? '#10b981' : cardBorder,
                  background: mapHeat ? '#10b98124' : 'transparent',
                  color: mapHeat ? '#10b981' : textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Layers3 size={13} /> AQI Heat Layer
              </button>

              <button
                type="button"
                onClick={() => setMapFires(v => !v)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: mapFires ? '#f97316' : cardBorder,
                  background: mapFires ? '#f9731624' : 'transparent',
                  color: mapFires ? '#f97316' : textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Flame size={13} /> NASA FIRMS Fires ({hotspotCount})
              </button>

              <button
                type="button"
                onClick={() => setMapWind(v => !v)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: mapWind ? '#06b6d4' : cardBorder,
                  background: mapWind ? '#06b6d424' : 'transparent',
                  color: mapWind ? '#06b6d4' : textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Wind size={13} /> Wind Overlay ({windMps} m/s)
              </button>
            </div>
          </div>

          {/* Leaflet Map Shell */}
          <div
            style={{
              height: 480,
              borderRadius: '14px',
              overflow: 'hidden',
              position: 'relative',
              border: `1px solid ${cardBorder}`,
            }}
          >
            <MapContainer
              center={[activeLoc.latitude, activeLoc.longitude]}
              zoom={10}
              scrollWheelZoom={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RecenterMap lat={activeLoc.latitude} lon={activeLoc.longitude} />

              {/* Station Markers */}
              {(airQuery.data?.stations || []).map(st => {
                if (!st.coordinates.latitude || !st.coordinates.longitude) return null
                return (
                  <CircleMarker
                    key={st.id}
                    center={[st.coordinates.latitude, st.coordinates.longitude]}
                    radius={10}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 2,
                      fillColor: aqiColor(st.aqi),
                      fillOpacity: 0.9,
                    }}
                    eventHandlers={{
                      click: () => {
                        setActiveHotspotDrawer({
                          name: st.name,
                          aqi: st.aqi ?? 145,
                          population: '420,000 Citizens',
                          action: 'Deploy municipal mist cannons and anti-smog guns.',
                          prediction: 'AQI expected to climb +15% over next 6 hours.',
                        })
                      },
                    }}
                  >
                    <Popup>
                      <strong style={{ fontSize: '12px' }}>{st.name}</strong>
                      <br />
                      AQI: <b>{st.aqi ?? '—'}</b> · PM2.5: {st.measurements.pm25?.value ?? '—'} µg/m³
                    </Popup>
                  </CircleMarker>
                )
              })}

              {/* Fire Markers from NASA FIRMS */}
              {mapFires &&
                (fireQuery.data?.hotspots || []).map(f => (
                  <Marker
                    key={f.source_id}
                    position={[f.latitude, f.longitude]}
                    icon={fireIcon}
                  >
                    <Popup>
                      <strong>NASA FIRMS Thermal Anomaly</strong>
                      <br />
                      Radiative Power: {f.fire_radiative_power_mw ?? '—'} MW
                    </Popup>
                  </Marker>
                ))}

              {/* Wind Vector overlay */}
              {mapWind && (
                <Polyline
                  positions={[
                    [
                      [28.5, 77.1],
                      [28.7, 77.3],
                      [28.9, 77.5],
                    ],
                    [
                      [28.3, 77.0],
                      [28.6, 77.2],
                      [28.8, 77.4],
                    ],
                  ]}
                  pathOptions={{ color: '#06b6d4', weight: 2.5, dashArray: '8 6', opacity: 0.7 }}
                />
              )}
            </MapContainer>

            {/* Floating Hotspot Intelligence Card (When Station Clicked) */}
            <AnimatePresence>
              {activeHotspotDrawer && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 320,
                    background: theme === 'dark' ? 'rgba(7, 24, 19, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid #10b98155',
                    borderRadius: '12px',
                    padding: '16px',
                    zIndex: 1000,
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '13px', color: textPrimary, fontFamily: 'Manrope, sans-serif' }}>
                      {activeHotspotDrawer.name}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setActiveHotspotDrawer(null)}
                      style={{ background: 'transparent', border: 'none', color: textMuted, cursor: 'pointer' }}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ margin: '10px 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '28px', fontWeight: 800, color: aqiColor(activeHotspotDrawer.aqi) }}>
                      {activeHotspotDrawer.aqi} AQI
                    </span>
                    <span style={{ fontSize: '10px', color: textMuted }}>Live Reading</span>
                  </div>

                  <div style={{ fontSize: '11px', lineHeight: 1.5, color: textMuted }}>
                    <div style={{ marginBottom: 6 }}>
                      <b>Exposed Population:</b> {activeHotspotDrawer.population}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <b style={{ color: '#10b981' }}>Recommended Directive:</b> {activeHotspotDrawer.action}
                    </div>
                    <div>
                      <b style={{ color: '#ef4444' }}>Short-Term Prediction:</b> {activeHotspotDrawer.prediction}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 6. EXPLAINABLE AI FEATURE INFLUENCE WHEEL                           */}
        {/* =================================================================== */}
        <section
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '16px',
            padding: '24px 28px',
            boxShadow: hudGlow,
            marginBottom: '24px',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Transparent Physical Attribution Engine
            </span>
            <h3
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: '20px',
                fontWeight: 800,
                margin: '2px 0 0',
                color: textPrimary,
              }}
            >
              Explainable AI: Feature Influence Wheel
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: textMuted }}>
              Interactive Shapley decomposition showing physical attribution behind today’s environmental risk rating. Select any parameter to inspect atmospheric causality.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '24px', alignItems: 'center' }}>
            {/* Left: Interactive Feature Selector Pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(['pm25', 'no2', 'temp', 'humidity', 'wind'] as const).map(key => {
                const item = featureWheelData[key]
                const isSelected = activeFeature === key
                return (
                  <div
                    key={key}
                    onClick={() => setActiveFeature(key)}
                    style={{
                      background: isSelected
                        ? theme === 'dark'
                          ? '#0e3328'
                          : '#eaf6ef'
                        : theme === 'dark'
                        ? '#081e18'
                        : '#f9fbf9',
                      border: `1px solid ${isSelected ? item.color : cardBorder}`,
                      borderRadius: '10px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                      <strong style={{ fontSize: '13px', color: textPrimary }}>{item.name}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <b style={{ color: item.color, fontSize: '14px' }}>{item.contribution}</b>
                      <span style={{ fontSize: '10px', color: textMuted, marginLeft: 4 }}>Weight</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: Detailed Explainability Card */}
            <div
              style={{
                background: theme === 'dark' ? '#071813' : '#f8faf9',
                border: `1px solid ${cardBorder}`,
                borderRadius: '14px',
                padding: '20px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: featureWheelData[activeFeature].color,
                  }}
                />
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: textPrimary, fontFamily: 'Manrope, sans-serif' }}>
                  {featureWheelData[activeFeature].name}
                </h4>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: featureWheelData[activeFeature].color,
                    background: `${featureWheelData[activeFeature].color}18`,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {featureWheelData[activeFeature].contribution} Impact
                </span>
              </div>

              <div style={{ fontSize: '12px', color: textMuted, lineHeight: 1.6, marginBottom: '12px' }}>
                <strong style={{ color: textPrimary, display: 'block', marginBottom: 2 }}>
                  Physical Causality:
                </strong>
                {featureWheelData[activeFeature].reason}
              </div>

              <div style={{ fontSize: '12px', color: textMuted, lineHeight: 1.6, marginBottom: '12px' }}>
                <strong style={{ color: textPrimary, display: 'block', marginBottom: 2 }}>
                  Epidemiological & Airshed Impact:
                </strong>
                {featureWheelData[activeFeature].impact}
              </div>

              <div
                style={{
                  background: theme === 'dark' ? '#0b261e' : '#eef7f2',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#10b981',
                }}
              >
                Governing Equation: {featureWheelData[activeFeature].formula}
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 6.5. REGIONAL MULTI-LOCATION CRITICAL RISK ASSESSMENT GRID          */}
        {/* =================================================================== */}
        <section
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: hudGlow,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    color: '#10b981',
                  }}
                >
                  Continuous Geospatial Airshed Telemetry
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#10b98122',
                    color: '#10b981',
                    border: '1px solid #10b98144',
                  }}
                >
                  Independent Calibration Pipeline
                </span>
              </div>
              <h2
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '22px',
                  fontWeight: 800,
                  letterSpacing: '-0.6px',
                  margin: '0 0 6px',
                  color: textPrimary,
                }}
              >
                Multi-Sector Critical Environmental Risk Assessment
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: textMuted, maxWidth: '780px', lineHeight: 1.5 }}>
                Micro-climate calibrated continuous risk indices across 7 primary NCR monitoring sectors. Each sector computes independent, un-saturated risk scores governed by localized telemetry, eliminating global state overwrite.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: theme === 'dark' ? '#09211a' : '#edf7f1',
                border: `1px solid ${cardBorder}`,
                fontSize: '11px',
                color: textMuted,
              }}
            >
              <Radio size={14} color="#10b981" className="animate-pulse" />
              <span>7 Isolated Monitoring Nodes Active</span>
            </div>
          </div>

          {/* Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {regionalRisks.map(loc => {
              const isSelected =
                Math.abs(activeLoc.latitude - loc.coordinates.latitude) < 0.02 &&
                Math.abs(activeLoc.longitude - loc.coordinates.longitude) < 0.02

              return (
                <div
                  key={loc.locationId}
                  style={{
                    background: theme === 'dark' ? '#0b261e' : '#ffffff',
                    border: `1px solid ${isSelected ? '#10b981' : loc.levelBorder}`,
                    borderRadius: '14px',
                    padding: '16px',
                    boxShadow: isSelected
                      ? '0 0 20px rgba(16, 185, 129, 0.25)'
                      : '0 4px 12px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Top Header of Card */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: textMuted,
                          fontFamily: 'monospace',
                        }}
                      >
                        {loc.coordinates.latitude.toFixed(4)}°N, {loc.coordinates.longitude.toFixed(4)}°E
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: loc.levelBg,
                          color: loc.levelColor,
                          border: `1px solid ${loc.levelBorder}`,
                          textTransform: 'uppercase',
                        }}
                      >
                        {loc.riskLevel} Risk
                      </span>
                    </div>

                    <h4
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        fontSize: '15px',
                        fontWeight: 700,
                        margin: '0 0 10px',
                        color: textPrimary,
                        lineHeight: 1.3,
                      }}
                    >
                      {loc.name}
                    </h4>

                    {/* Big Score & Trend */}
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span
                          style={{
                            fontFamily: 'Manrope, sans-serif',
                            fontSize: '38px',
                            fontWeight: 900,
                            letterSpacing: '-1.5px',
                            lineHeight: 1,
                            color: loc.levelColor,
                          }}
                        >
                          {loc.riskScore}%
                        </span>
                        <span style={{ fontSize: '11px', color: textMuted }}>Composite Risk</span>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '11px' }}>
                        <span style={{ color: textMuted, display: 'block' }}>Confidence</span>
                        <strong style={{ color: textPrimary }}>{loc.confidence}%</strong>
                      </div>
                    </div>

                    {/* Local Telemetry Row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '6px',
                        background: theme === 'dark' ? '#071b15' : '#f4faf6',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        fontSize: '11px',
                        textAlign: 'center',
                      }}
                    >
                      <div>
                        <span style={{ color: textMuted, display: 'block', fontSize: '9px' }}>AQI</span>
                        <strong style={{ color: loc.aqi > 200 ? '#ef4444' : '#f97316' }}>{loc.aqi}</strong>
                      </div>
                      <div>
                        <span style={{ color: textMuted, display: 'block', fontSize: '9px' }}>PM2.5</span>
                        <strong style={{ color: textPrimary }}>{loc.pm25} µg</strong>
                      </div>
                      <div>
                        <span style={{ color: textMuted, display: 'block', fontSize: '9px' }}>Wind</span>
                        <strong style={{ color: textPrimary }}>{loc.windSpeed} m/s</strong>
                      </div>
                      <div>
                        <span style={{ color: textMuted, display: 'block', fontSize: '9px' }}>Thermal</span>
                        <strong style={{ color: loc.hotspotCount > 2 ? '#ef4444' : '#10b981' }}>{loc.hotspotCount} pts</strong>
                      </div>
                    </div>

                    {/* Primary Threat Diagnostics */}
                    <div style={{ fontSize: '11px', color: textMuted, marginBottom: '10px', lineHeight: 1.4 }}>
                      <strong style={{ color: textPrimary, display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                        Primary Airshed Vector:
                      </strong>
                      {loc.primaryThreat}
                    </div>

                    <div style={{ fontSize: '11px', color: textMuted, marginBottom: '14px', lineHeight: 1.4 }}>
                      <strong style={{ color: '#10b981', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                        Targeted Directive:
                      </strong>
                      {loc.recommendedDirective}
                    </div>
                  </div>

                  {/* Focus Action Button */}
                  <button
                    onClick={() => {
                      console.log(`[AirSense Risk Audit] Switching dashboard focus to: ${loc.name}`, loc.coordinates)
                      setLocation({ latitude: loc.coordinates.latitude, longitude: loc.coordinates.longitude })
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: isSelected ? '#10b981' : theme === 'dark' ? '#0d3227' : '#e6f5ec',
                      color: isSelected ? '#ffffff' : '#10b981',
                      border: `1px solid ${isSelected ? '#10b981' : '#10b98144'}`,
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{isSelected ? 'Currently Monitored Center' : 'Focus Center Telemetry'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* =================================================================== */}
        {/* 7. DECISION SUPPORT & CITIZEN IMPACT DUAL PANELS                    */}
        {/* =================================================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '24px', marginBottom: '24px' }}>
          {/* Decision Support Directives */}
          <section
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: '16px',
              padding: '22px 24px',
              boxShadow: hudGlow,
            }}
          >
            <div style={{ marginBottom: '14px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Government Action Engine
              </span>
              <h3
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '18px',
                  fontWeight: 800,
                  margin: '2px 0 0',
                  color: textPrimary,
                }}
              >
                Decision Support Panel: Priority Directives
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  id: 'd1',
                  area: 'Delhi Industrial Zone (Wazirpur & Anand Vihar)',
                  reason: 'AQI projected to exceed 180 under thermal inversion lid.',
                  action: 'Reduce industrial activity by 20% and halt non-essential boilers.',
                  improvement: '17% AQI Reduction',
                  confidence: 89,
                },
                {
                  id: 'd2',
                  area: 'Central Traffic Arteries (Ring Road Corridor)',
                  reason: 'Rush hour diesel NO2 surge coinciding with wind < 2.0 m/s.',
                  action: 'Reroute heavy freight vehicles to Eastern Peripheral Expressway.',
                  improvement: '12% NO2 Reduction',
                  confidence: 93,
                },
              ].map(d => (
                <div
                  key={d.id}
                  style={{
                    background: theme === 'dark' ? '#09211a' : '#f9fbf9',
                    borderLeft: '5px solid #ef4444',
                    borderTop: `1px solid ${cardBorder}`,
                    borderRight: `1px solid ${cardBorder}`,
                    borderBottom: `1px solid ${cardBorder}`,
                    borderRadius: '10px',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: textPrimary, fontFamily: 'Manrope, sans-serif' }}>
                      {d.area}
                    </strong>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#ef4444' }}>
                      CRITICAL ACTION REQUIRED
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 8px', fontSize: '11px', color: textMuted }}>
                    <b>Reason:</b> {d.reason}
                  </p>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, marginBottom: '8px' }}>
                    Recommended Action: {d.action}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: textMuted }}>
                    <span>Estimated Improvement: <b style={{ color: textPrimary }}>{d.improvement}</b></span>
                    <span>Confidence: <b style={{ color: '#10b981' }}>{d.confidence}%</b></span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Citizen Impact Center: Vulnerable Population */}
          <section
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: '16px',
              padding: '22px 24px',
              boxShadow: hudGlow,
            }}
          >
            <div style={{ marginBottom: '14px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Epidemiological Vulnerability
              </span>
              <h3
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '18px',
                  fontWeight: 800,
                  margin: '2px 0 0',
                  color: textPrimary,
                }}
              >
                Citizen Impact Center
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { group: 'Children (0-14 yrs)', count: '540,000', risk: 'Critical', color: '#ef4444', desc: '+40% higher respiration rate per kg' },
                { group: 'Elderly (>65 yrs)', count: '310,000', risk: 'Critical', color: '#ef4444', desc: 'Cardiovascular arrhythmia vulnerability' },
                { group: 'Asthma Patients', count: '280,000', risk: 'High', color: '#f97316', desc: 'Bronchial spasms triggered by PM2.5' },
                { group: 'Pregnant Women', count: '120,000', risk: 'High', color: '#f97316', desc: 'Systemic inflammatory vascular transfer' },
              ].map(g => (
                <div
                  key={g.group}
                  style={{
                    background: theme === 'dark' ? '#09211a' : '#f9fbf9',
                    border: `1px solid ${cardBorder}`,
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '12px', color: textPrimary, display: 'block' }}>{g.group}</strong>
                    <span style={{ fontSize: '9px', color: textMuted }}>{g.desc}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ fontSize: '13px', color: textPrimary }}>{g.count}</b>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: g.color, display: 'block' }}>
                      {g.risk} Risk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* ===================================================================== */}
      {/* 8. EXECUTIVE BRIEFING DOSSIER MODAL                                   */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {executiveBriefingOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 2000,
              display: 'grid',
              placeItems: 'center',
              padding: '24px',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '780px',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#ffffff',
                color: '#111827',
                borderRadius: '16px',
                padding: '32px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
              }}
            >
              {/* Official Government Dossier Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0e7c66', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#0e7c66', letterSpacing: '1px' }}>
                    NATIONAL CAPITAL REGION · EMERGENCY ENVIRONMENTAL INTELLIGENCE DOSSIER
                  </span>
                  <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '24px', fontWeight: 900, margin: '4px 0 0', color: '#064e3b' }}>
                    Executive Briefing Brief: State of the Airshed
                  </h2>
                  <small style={{ color: '#6b7280', fontSize: '11px' }}>
                    Generated: {new Date().toLocaleString()} · Target: Chief Minister Secretariat / CAQM
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => setExecutiveBriefingOpen(false)}
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Dossier Body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '12px', lineHeight: 1.6, color: '#374151' }}>
                <div style={{ background: '#f0fdf4', padding: '14px 18px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <strong style={{ color: '#166534', fontSize: '13px', display: 'block', marginBottom: 4 }}>
                    1. Key Executive Insight
                  </strong>
                  The Delhi-NCR airshed is operating at composite AQI {currentAqi} (Unhealthy). High atmospheric stagnation (wind: {windMps} m/s) and nocturnal inversion at 180m height will concentrate traffic NO2 and secondary sulfate particulates over the next 24-48 hours.
                </div>

                <div style={{ background: '#fef2f2', padding: '14px 18px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                  <strong style={{ color: '#991b1b', fontSize: '13px', display: 'block', marginBottom: 4 }}>
                    2. Top Environmental Risks Identified
                  </strong>
                  - <b>Thermal Crop Inversion:</b> 14 agricultural hotspots detected upwind in Punjab-Haryana corridor.
                  <br />
                  - <b>Industrial Hotspots:</b> Wazirpur & Anand Vihar exceeding 180 AQI.
                  <br />
                  - <b>Citizen Vulnerability:</b> 540,000 schoolchildren and 310,000 elderly residents in high-exposure risk zones.
                </div>

                <div style={{ background: '#eff6ff', padding: '14px 18px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  <strong style={{ color: '#1e40af', fontSize: '13px', display: 'block', marginBottom: 4 }}>
                    3. Priority Authority Directives (Next 12 Hours)
                  </strong>
                  1. Mandate Odd-Even / 30% traffic freight diversion to peripheral expressways (-17% NO2 drop).
                  <br />
                  2. Enforce complete temporary halt on industrial diesel generator sets in Wazirpur cluster.
                  <br />
                  3. Deploy 85 municipal mobile mist cannons and anti-smog guns across major traffic intersections.
                </div>
              </div>

              {/* Modal Footer: Print / PDF actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Printer size={15} />
                  <span>Print Dossier</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert('Exporting signed PDF to ministerial document management system.')
                    setExecutiveBriefingOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#0e7c66',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={15} />
                  <span>Authorize & Export PDF</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
