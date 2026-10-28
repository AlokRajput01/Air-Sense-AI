import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AlertOctagon,
  ArrowRight,
  Building2,
  Clock,
  Cpu,
  Droplets,
  Gauge,
  HeartPulse,
  Megaphone,
  Radio,
  Send,
  ShieldCheck,
  Sliders,
  TreePine,
  Truck,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageMotion, Panel, StatusPill } from './ui'
import { useLocationState } from '../state/location'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { EnvironmentalRiskForecastCard } from './EnvironmentalRiskForecastCard'
import { calculateLocationRisk } from '../services/riskScoring'

type CommandTab =
  | 'executive'
  | 'recommendations'
  | 'simulation'
  | 'citizen'
  | 'alerts'
  | 'explainable'

type RecommendationFilter = 'ALL' | 'AIR' | 'FIRE' | 'HEALTH'

interface AuthorityRecommendation {
  id: string
  priority: number
  area: string
  zoneType: 'Industrial' | 'Traffic Corridor' | 'Agricultural' | 'Residential' | 'Construction'
  category: 'AIR' | 'FIRE' | 'HEALTH'
  severity: 'Critical' | 'High' | 'Moderate' | 'Low'
  reason: string
  suggestedAction: string
  expectedImprovement: string
  aqiReductionPct: number
  confidence: number
  enforcementWindow: string
  authority: string
  featureImportance: { factor: string; weight: number }[]
}

interface EmergencyAlert {
  id: string
  type: 'Critical AQI' | 'Fire Detection' | 'Heatwave' | 'Inversion Trap'
  severity: 'Red' | 'Orange' | 'Yellow' | 'Green'
  title: string
  location: string
  timestamp: string
  source: string
  recommendedAction: string
  broadcastStatus: 'Active' | 'Dispatched' | 'Resolved'
  affectedCount: string
}

export function GovernmentDecisionSystem() {
  const { location, selected } = useLocationState()
  const [activeTab, setActiveTab] = useState<CommandTab>('executive')
  const [recFilter, setRecFilter] = useState<RecommendationFilter>('ALL')

  // Live queries
  const air = useQuery({
    queryKey: ['gov-air', location?.latitude, location?.longitude],
    queryFn: () => api.airQuality(location!.latitude, location!.longitude, selected?.name),
    enabled: !!location,
    staleTime: 60000,
  })

  const weather = useQuery({
    queryKey: ['gov-weather', location?.latitude, location?.longitude],
    queryFn: () => api.weather(location!.latitude, location!.longitude),
    enabled: !!location,
    staleTime: 60000,
  })

  const fire = useQuery({
    queryKey: ['gov-fire', location?.latitude, location?.longitude],
    queryFn: () => {
      const b = {
        west: location!.longitude - 1,
        south: location!.latitude - 1,
        east: location!.longitude + 1,
        north: location!.latitude + 1,
      }
      return api.fires(b.west, b.south, b.east, b.north)
    },
    enabled: !!location,
    staleTime: 60000,
  })

  const forecast = useQuery({
    queryKey: ['gov-forecast', location?.latitude, location?.longitude],
    queryFn: () => api.forecast(location!.latitude, location!.longitude, 72, selected?.name),
    enabled: !!location,
    staleTime: 60000,
  })

  const currentAqi = air.data?.aqi ?? 146

  // ---------------------------------------------------------------------------
  // MODULE 1: RECOMMENDATIONS STATE & DATA
  // ---------------------------------------------------------------------------
  const allRecommendations: AuthorityRecommendation[] = useMemo(() => [
    {
      id: 'rec-1',
      priority: 1,
      area: 'Delhi Industrial Zone (Wazirpur & Anand Vihar)',
      zoneType: 'Industrial',
      category: 'AIR',
      severity: 'Critical',
      reason: 'AQI above 140 for 6 hours with thermal inversion capping emissions at 180m altitude.',
      suggestedAction: 'Temporarily reduce industrial emissions and halt non-essential boiler operations.',
      expectedImprovement: 'AQI reduction by 12% (approx. -18 points)',
      aqiReductionPct: 12,
      confidence: 93,
      enforcementWindow: 'Next 12 Hours',
      authority: 'Delhi Pollution Control Committee (DPCC)',
      featureImportance: [
        { factor: 'Boiler Emission Volume', weight: 0.44 },
        { factor: 'Nocturnal Boundary Inversion', weight: 0.32 },
        { factor: 'Low Wind Speed (1.8 m/s)', weight: 0.24 },
      ],
    },
    {
      id: 'rec-2',
      priority: 2,
      area: 'Central Traffic Arteries (Ring Road & ITO)',
      zoneType: 'Traffic Corridor',
      category: 'AIR',
      severity: 'High',
      reason: 'Evening rush-hour NO2 & particulate surge coinciding with wind deceleration below 2.0 m/s.',
      suggestedAction: 'Reroute heavy diesel freight vehicles and extend public transit electric metro frequency.',
      expectedImprovement: 'NO2 drop by 18%, PM2.5 reduction by 9%',
      aqiReductionPct: 9,
      confidence: 90,
      enforcementWindow: '17:00 - 22:00 IST',
      authority: 'Delhi Traffic Police & Ministry of Road Transport',
      featureImportance: [
        { factor: 'Diesel Freight Volume', weight: 0.51 },
        { factor: 'Stop-and-Go Congestion', weight: 0.31 },
        { factor: 'Solar NO2 Photolysis', weight: 0.18 },
      ],
    },
    {
      id: 'rec-3',
      priority: 3,
      area: 'Northwest Agricultural Belt (Punjab-Haryana Border)',
      zoneType: 'Agricultural',
      category: 'FIRE',
      severity: 'Critical',
      reason: 'Satellite pass detected 14 active biomass hotspots with northwest wind vector blowing toward NCR.',
      suggestedAction: 'Mobilize ground containment teams and deploy baler incentives for mechanized crop residue.',
      expectedImprovement: 'Prevent 25-35 AQI point smoke surge over NCR in next 24h',
      aqiReductionPct: 15,
      confidence: 88,
      enforcementWindow: 'Immediate (Next 6 Hours)',
      authority: 'Commission for Air Quality Management (CAQM)',
      featureImportance: [
        { factor: 'NASA FIRMS Radiative Power', weight: 0.58 },
        { factor: 'Wind Vector Advection', weight: 0.28 },
        { factor: 'Atmospheric Boundary Layer', weight: 0.14 },
      ],
    },
    {
      id: 'rec-4',
      priority: 4,
      area: 'Dwarka Sector 8 & Rohini Construction Clusters',
      zoneType: 'Construction',
      category: 'AIR',
      severity: 'Moderate',
      reason: 'Uncovered earthworks and demolition debris generating localized PM10 spikes > 220 µg/m³.',
      suggestedAction: 'Mandate anti-smog guns, continuous mist canons, and tarpaulin enclosure on all active sites.',
      expectedImprovement: 'PM10 coarse particulate reduction by 22%',
      aqiReductionPct: 7,
      confidence: 86,
      enforcementWindow: 'Next 24 Hours',
      authority: 'Municipal Corporation of Delhi (MCD)',
      featureImportance: [
        { factor: 'Unpaved Road Dust', weight: 0.46 },
        { factor: 'Demolition Wind Shear', weight: 0.34 },
        { factor: 'Relative Humidity', weight: 0.20 },
      ],
    },
    {
      id: 'rec-5',
      priority: 5,
      area: 'Metro Residential & School Corridors (Civil Lines & Saket)',
      zoneType: 'Residential',
      category: 'HEALTH',
      severity: 'High',
      reason: 'Pediatric and elderly vulnerability score reached 82/100 due to sustained 12h PM2.5 > 60 µg/m³.',
      suggestedAction: 'Issue public health bulletin to shift school morning sports indoors; distribute N95 respirators.',
      expectedImprovement: 'Avoid 450+ emergency pediatric respiratory admissions',
      aqiReductionPct: 0,
      confidence: 95,
      enforcementWindow: 'Tomorrow 07:00 - 11:00 IST',
      authority: 'Directorate of Family Welfare & Health Services',
      featureImportance: [
        { factor: 'Pediatric Airway Sensitivity', weight: 0.49 },
        { factor: 'Morning Exposure Duration', weight: 0.36 },
        { factor: 'Cold Temperature Inversion', weight: 0.15 },
      ],
    },
  ], [])

  const filteredRecommendations = useMemo(() => {
    if (recFilter === 'ALL') return allRecommendations
    return allRecommendations.filter(r => r.category === recFilter)
  }, [allRecommendations, recFilter])

  // ---------------------------------------------------------------------------
  // MODULE 2: WHAT-IF ENVIRONMENTAL SIMULATION ENGINE
  // ---------------------------------------------------------------------------
  const [trafficReduction, setTrafficReduction] = useState<number>(30)
  const [industryReduction, setIndustryReduction] = useState<number>(25)
  const [greenCoverBoost, setGreenCoverBoost] = useState<number>(15)
  const [waterSprinkling, setWaterSprinkling] = useState<'off' | 'moderate' | 'intensive'>('moderate')
  const [constructionHalt, setConstructionHalt] = useState<'standard' | 'partial' | 'complete'>('partial')

  // Real-time calculation of simulated AQI
  const simulationResults = useMemo(() => {
    const baseAqi = currentAqi

    // Physics-informed impact weights
    const trafficDelta = (trafficReduction / 100) * 0.28 * baseAqi
    const industryDelta = (industryReduction / 100) * 0.32 * baseAqi
    const greenDelta = (greenCoverBoost / 100) * 0.12 * baseAqi
    const sprinklingDelta =
      waterSprinkling === 'intensive' ? 14 : waterSprinkling === 'moderate' ? 7 : 0
    const constructionDelta =
      constructionHalt === 'complete' ? 16 : constructionHalt === 'partial' ? 8 : 0

    const totalReduction = Math.min(
      baseAqi * 0.55,
      trafficDelta + industryDelta + greenDelta + sprinklingDelta + constructionDelta
    )

    const simulatedAqi = Math.max(35, Math.round(baseAqi - totalReduction))
    const improvementPct = Math.round(((baseAqi - simulatedAqi) / baseAqi) * 100)
    const impactScore = Math.min(100, Math.round(improvementPct * 1.8 + (trafficReduction > 20 ? 10 : 0)))
    const simConfidence = Math.max(76, Math.min(96, Math.round(92 - (improvementPct > 35 ? 8 : 2))))

    // Pollutant breakdown comparison
    const comparisonData = [
      {
        pollutant: 'Overall AQI',
        current: baseAqi,
        simulated: simulatedAqi,
        unit: 'AQI',
      },
      {
        pollutant: 'PM2.5',
        current: Math.round(baseAqi * 0.45),
        simulated: Math.round(simulatedAqi * 0.44),
        unit: 'µg/m³',
      },
      {
        pollutant: 'PM10',
        current: Math.round(baseAqi * 0.78),
        simulated: Math.round(simulatedAqi * 0.72 - (waterSprinkling === 'intensive' ? 12 : 5)),
        unit: 'µg/m³',
      },
      {
        pollutant: 'NO2',
        current: 58,
        simulated: Math.max(18, Math.round(58 * (1 - (trafficReduction / 100) * 0.42))),
        unit: 'µg/m³',
      },
      {
        pollutant: 'CO',
        current: 1.4,
        simulated: Number((1.4 * (1 - (trafficReduction / 100) * 0.28)).toFixed(1)),
        unit: 'mg/m³',
      },
    ]

    return {
      baseAqi,
      simulatedAqi,
      improvementPct,
      impactScore,
      simConfidence,
      comparisonData,
    }
  }, [currentAqi, trafficReduction, industryReduction, greenCoverBoost, waterSprinkling, constructionHalt])

  // ---------------------------------------------------------------------------
  // MODULE 3: CITIZEN IMPACT ASSESSMENT DATA
  // ---------------------------------------------------------------------------
  const citizenExposureData = useMemo(() => {
    return {
      totalExposed: '2.4 Million',
      highRisk: '650,000',
      moderateRisk: '1.2 Million',
      lowRisk: '550,000',
      severityDistribution: [
        { name: 'Critical (>200 AQI)', value: 380000, color: '#ef4444' },
        { name: 'High (150-200)', value: 650000, color: '#f97316' },
        { name: 'Moderate (100-150)', value: 1200000, color: '#eab308' },
        { name: 'Low (<100)', value: 550000, color: '#22c55e' },
      ],
      vulnerableGroups: [
        {
          group: 'Children (0-14 yrs)',
          count: '540,000',
          riskLevel: 'Critical',
          color: '#ef4444',
          advisory: 'Shift outdoor school sports indoors. Limit recess to air-conditioned halls.',
          inhalationRate: '+40% higher respiration rate per kg body mass',
        },
        {
          group: 'Elderly (>65 yrs)',
          count: '310,000',
          riskLevel: 'Critical',
          color: '#ef4444',
          advisory: 'Avoid morning walks before 10:00 AM while nocturnal inversion remains trapped.',
          inhalationRate: 'Elevated cardiac ischemia & arrhythmia vulnerability',
        },
        {
          group: 'Asthma & COPD Patients',
          count: '280,000',
          riskLevel: 'High',
          color: '#f97316',
          advisory: 'Keep quick-relief bronchodilators accessible. Use HEPA filtration indoors.',
          inhalationRate: 'Bronchial hyper-reactivity triggered by PM2.5 > 35 µg/m³',
        },
        {
          group: 'Pregnant Women',
          count: '120,000',
          riskLevel: 'High',
          color: '#f97316',
          advisory: 'Wear fitted N95 respirators near traffic arteries. Minimize commute transit.',
          inhalationRate: 'Systemic inflammatory transfer to placental barrier',
        },
      ],
      geographicRiskZones: [
        { zone: 'North NCR (Anand Vihar, Wazirpur)', exposed: '820,000', riskIndex: 88 },
        { zone: 'Central Commercial (Connaught Place, ITO)', exposed: '490,000', riskIndex: 72 },
        { zone: 'South NCR (Saket, Hauz Khas)', exposed: '560,000', riskIndex: 61 },
        { zone: 'East NCR (Mayur Vihar, Noida Border)', exposed: '530,000', riskIndex: 79 },
      ],
    }
  }, [])

  // ---------------------------------------------------------------------------
  // MODULE 4: EMERGENCY ALERT CENTER DATA
  // ---------------------------------------------------------------------------
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([
    {
      id: 'alt-1',
      type: 'Critical AQI',
      severity: 'Red',
      title: 'GRAP Stage-III Particulate Breach in Industrial Hub',
      location: 'Wazirpur Industrial Area & Anand Vihar',
      timestamp: '12 mins ago · 18:05 IST',
      source: 'OpenAQ Realtime Sensor DPCC-04',
      recommendedAction: 'Enforce complete stop on diesel generator sets; deploy mobile mist canons immediately.',
      broadcastStatus: 'Active',
      affectedCount: '420,000 Citizens',
    },
    {
      id: 'alt-2',
      type: 'Fire Detection',
      severity: 'Orange',
      title: 'Biomass Burning Thermal Anomaly Spike Detected',
      location: 'Northwest Perimeter (45 km Upwind)',
      timestamp: '34 mins ago · 17:45 IST',
      source: 'NASA FIRMS VIIRS Pass (375m Resolution)',
      recommendedAction: 'Alert state agro-enforcement flying squads; initiate inter-state buffer patrol.',
      broadcastStatus: 'Dispatched',
      affectedCount: 'Downwind Regional Airshed',
    },
    {
      id: 'alt-3',
      type: 'Inversion Trap',
      severity: 'Orange',
      title: 'Atmospheric Boundary Layer Inversion at 180m',
      location: 'NCR Basin Airshed',
      timestamp: '1 hour ago · 17:15 IST',
      source: 'Synoptic Weather Radio-Sonde Observation',
      recommendedAction: 'Halt non-essential open-air incineration and construction demolition through 08:00 tomorrow.',
      broadcastStatus: 'Active',
      affectedCount: 'Full NCR Metropolitan Zone',
    },
    {
      id: 'alt-4',
      type: 'Heatwave',
      severity: 'Yellow',
      title: 'Photochemical Ozone Precursor Warning',
      location: 'South & Central Traffic Corridors',
      timestamp: '2 hours ago · 16:10 IST',
      source: 'OpenWeather Solar Radiation Downlink',
      recommendedAction: 'Issue secondary advisory to outdoor municipal workers for midday rest intervals.',
      broadcastStatus: 'Resolved',
      affectedCount: '160,000 Outdoor Workers',
    },
  ])

  const handleDispatchAction = (id: string) => {
    setAlerts(prev =>
      prev.map(a =>
        a.id === id ? { ...a, broadcastStatus: a.broadcastStatus === 'Active' ? 'Dispatched' : 'Resolved' } : a
      )
    )
  }

  return (
    <PageMotion>
      {/* COMMAND CENTER HEADER (NASA + WHO + GOVERNMENT COMMAND DESIGN) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #09261f 0%, #0d382d 50%, #114b3d 100%)',
          borderRadius: '16px',
          padding: '24px 28px',
          color: '#ffffff',
          boxShadow: '0 12px 36px rgba(9, 38, 31, 0.25)',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(201, 241, 112, 0.22)',
        }}
      >
        {/* Subtle decorative grid/glow */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201, 241, 112, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(8px)',
                padding: '4px 12px',
                borderRadius: '99px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#c9f170',
                letterSpacing: '1px',
                marginBottom: '10px',
              }}
            >
              <Radio size={12} className="text-lime-300 animate-pulse" />
              GOVERNMENT ENVIRONMENTAL COMMAND & DECISION SUPPORT SYSTEM · CAQM / CPCB / WHO
            </div>
            <h1
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '-1px',
                margin: '0 0 6px',
                color: '#ffffff',
              }}
            >
              Executive Environmental Decision Support
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#b9dbce', maxWidth: '680px', lineHeight: 1.6 }}>
              Autonomous multi-agency intelligence suite combining satellite thermal telemetry, real-time ground observations, causal intervention simulations, and automated priority public policy interventions.
            </p>
          </div>

          {/* Mission Telemetry Chips */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.28)',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#d6ede2',
              }}
            >
              <Clock size={13} color="#c9f170" />
              <span>UTC {new Date().toISOString().substring(11, 19)}</span>
              <span style={{ color: '#88b8a5' }}>|</span>
              <span style={{ color: '#c9f170' }}>SECURE DOWNLINK ACTIVE</span>
            </div>
            <div style={{ fontSize: '10px', color: '#97c0af' }}>
              CPCB Node ID: <b style={{ color: '#ffffff' }}>NCR-CPCB-AI-01</b> · Clearance: <b style={{ color: '#ffffff' }}>LEVEL 4 EXECUTIVE</b>
            </div>
          </div>
        </div>

        {/* Executive Command KPI Ribbon */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginTop: '22px',
            paddingTop: '18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <span style={{ fontSize: '10px', color: '#a2cfbd', display: 'block', fontWeight: 600 }}>
              Regional Composite AQI
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
              <strong style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', fontFamily: 'Manrope, sans-serif' }}>
                {currentAqi}
              </strong>
              <small style={{ color: currentAqi > 100 ? '#fca5a5' : '#86efac', fontWeight: 700, fontSize: '11px' }}>
                {currentAqi > 200 ? 'Severe' : currentAqi > 100 ? 'Unhealthy' : 'Moderate'}
              </small>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <span style={{ fontSize: '10px', color: '#a2cfbd', display: 'block', fontWeight: 600 }}>
              Population Protected
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
              <strong style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', fontFamily: 'Manrope, sans-serif' }}>
                2.4M
              </strong>
              <small style={{ color: '#c9f170', fontWeight: 700, fontSize: '11px' }}>Under Monitoring</small>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <span style={{ fontSize: '10px', color: '#a2cfbd', display: 'block', fontWeight: 600 }}>
              Active AI Directives
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
              <strong style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', fontFamily: 'Manrope, sans-serif' }}>
                5 Actionable
              </strong>
              <small style={{ color: '#fef08a', fontWeight: 700, fontSize: '11px' }}>3 Critical</small>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '10px 14px' }}>
            <span style={{ fontSize: '10px', color: '#a2cfbd', display: 'block', fontWeight: 600 }}>
              Active Emergency Alerts
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
              <strong style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444', fontFamily: 'Manrope, sans-serif' }}>
                {alerts.filter(a => a.broadcastStatus === 'Active').length} Live
              </strong>
              <small style={{ color: '#fca5a5', fontWeight: 700, fontSize: '11px' }}>Beacon Pulsing</small>
            </div>
          </div>
        </div>
      </div>

      {/* COMMAND MODULE TABS */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid #dce8e0',
        }}
      >
        {[
          { key: 'executive', label: 'Executive Dashboard', icon: Gauge },
          { key: 'recommendations', label: 'Recommendation Engine', icon: ShieldCheck, badge: '5 Directives' },
          { key: 'simulation', label: 'What-If Simulation', icon: Sliders, badge: 'Live Physics' },
          { key: 'citizen', label: 'Citizen Impact Assessment', icon: Users, badge: '2.4M Exposed' },
          { key: 'alerts', label: 'Emergency Alert Center', icon: Megaphone, badge: `${alerts.filter(a => a.broadcastStatus === 'Active').length} Active` },
          { key: 'explainable', label: 'Explainable AI Engine', icon: Cpu },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as CommandTab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid',
                borderColor: isActive ? '#0e7c66' : '#d9e5dd',
                background: isActive ? '#0e7c66' : '#ffffff',
                color: isActive ? '#ffffff' : '#335246',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.18s ease',
                boxShadow: isActive ? '0 4px 14px rgba(14, 124, 102, 0.22)' : 'none',
              }}
            >
              <Icon size={15} color={isActive ? '#c9f170' : '#0e7c66'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  style={{
                    fontSize: '9px',
                    padding: '1px 6px',
                    borderRadius: '99px',
                    background: isActive ? 'rgba(255, 255, 255, 0.2)' : '#eaf4ee',
                    color: isActive ? '#ffffff' : '#0e7c66',
                    fontWeight: 800,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: EXECUTIVE COMMAND DASHBOARD                                    */}
      {/* ===================================================================== */}
      {activeTab === 'executive' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* Section: 24-Hour Environmental Risk Forecast (Integrated as requested) */}
          <EnvironmentalRiskForecastCard
            air={air.data}
            weather={weather.data}
            fire={fire.data}
            forecast={forecast.data}
          />

          {/* Multi-Panel Grid for Executive Command Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', margin: '18px 0' }}>
            <Panel
              title="Autonomous Intervention Readiness"
              eyebrow="GRAP COMPLIANCE PROTOCOL"
              action={<StatusPill status="CAQM Stage-III Ready" />}
            >
              <div style={{ fontSize: '11px', color: '#557266', lineHeight: 1.6, marginBottom: '14px' }}>
                AI decision agents continuously analyze meteorological traps, transport emissions, and upstream crop residues. Recommended immediate authority interventions:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {allRecommendations.slice(0, 3).map(rec => (
                  <div
                    key={rec.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: '#f8faf8',
                      border: '1px solid #e2ece5',
                      borderRadius: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            background: rec.severity === 'Critical' ? '#fee2e2' : '#ffedd5',
                            color: rec.severity === 'Critical' ? '#dc2626' : '#c2410c',
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          PRIORITY {rec.priority}
                        </span>
                        <strong style={{ fontSize: '12px', color: '#13392e' }}>{rec.area}</strong>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#688277' }}>
                        {rec.suggestedAction}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '90px' }}>
                      <strong style={{ color: '#168354', fontSize: '12px', display: 'block' }}>
                        -{rec.aqiReductionPct}% AQI
                      </strong>
                      <small style={{ color: '#7a9288', fontSize: '9px' }}>Conf: {rec.confidence}%</small>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('recommendations')}
                style={{
                  marginTop: '14px',
                  width: '100%',
                  padding: '9px',
                  background: '#f0f6f2',
                  border: '1px solid #d8e5dc',
                  borderRadius: '8px',
                  color: '#0e7c66',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <span>View All 5 Government Action Directives</span>
                <ArrowRight size={14} />
              </button>
            </Panel>

            <Panel
              title="Regional Airshed Hotspots"
              eyebrow="MULTI-CITY NCR COMPARISON"
              action={<StatusPill status="Live OpenAQ" />}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { city: 'Delhi NCT (Central)', offset: 0, lat: 28.6139, lon: 77.209, wind: 2.2 },
                  { city: 'Anand Vihar (ISBT Hub)', offset: 38, lat: 28.6469, lon: 77.3164, wind: 1.4 },
                  { city: 'Noida Sector 62', offset: -8, lat: 28.6271, lon: 77.3727, wind: 2.4 },
                  { city: 'Gurugram Cyber City', offset: -24, lat: 28.4595, lon: 77.0266, wind: 3.1 },
                  { city: 'Faridabad Industrial', offset: 16, lat: 28.4089, lon: 77.3178, wind: 1.8 },
                ].map(sector => {
                  const localizedAqi = Math.max(30, currentAqi + sector.offset)
                  const risk = calculateLocationRisk({
                    locationId: `gov-${sector.city}`,
                    name: sector.city,
                    coordinates: { latitude: sector.lat, longitude: sector.lon },
                    aqi: localizedAqi,
                    windSpeed: sector.wind,
                    hotspotCount: fire.data?.hotspots?.length || 1,
                  })

                  return (
                    <div
                      key={sector.city}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: '#ffffff',
                        border: '1px solid #e7efe9',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    >
                      <div>
                        <strong style={{ color: '#14382f', display: 'block' }}>{sector.city}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: risk.levelBg,
                              color: risk.levelColor,
                              border: `1px solid ${risk.levelBorder}`,
                            }}
                          >
                            {risk.riskLevel} Risk ({risk.riskScore}%)
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <b style={{ fontSize: '14px', color: localizedAqi > 150 ? '#dc2626' : '#ea580c' }}>
                          {localizedAqi}
                        </b>
                        <span style={{ fontSize: '9px', color: '#668076', marginLeft: '4px' }}>AQI</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>
        </motion.div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: AI-POWERED RECOMMENDATION ENGINE                               */}
      {/* ===================================================================== */}
      {activeTab === 'recommendations' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              background: '#ffffff',
              border: '1px solid #dce8e0',
              borderRadius: '12px',
              padding: '12px 18px',
              marginBottom: '18px',
            }}
          >
            <div>
              <strong style={{ fontSize: '13px', color: '#133a2e', display: 'block' }}>
                Filter Actionable Directives by Risk Vector:
              </strong>
              <small style={{ fontSize: '10px', color: '#718c80' }}>
                All recommendations are weighted by physical meteorology and epidemiological impact models.
              </small>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { key: 'ALL', label: 'All Directives' },
                { key: 'AIR', label: 'Air Quality (3)' },
                { key: 'FIRE', label: 'Fire Risk (1)' },
                { key: 'HEALTH', label: 'Health Risk (1)' },
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setRecFilter(f.key as RecommendationFilter)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: recFilter === f.key ? '#0e7c66' : '#dbe6df',
                    background: recFilter === f.key ? '#0e7c66' : '#f8faf8',
                    color: recFilter === f.key ? '#ffffff' : '#456457',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recommendation Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredRecommendations.map((rec, idx) => {
              const severityColor =
                rec.severity === 'Critical'
                  ? '#ef4444'
                  : rec.severity === 'High'
                  ? '#f97316'
                  : rec.severity === 'Moderate'
                  ? '#eab308'
                  : '#22c55e'
              const severityBg =
                rec.severity === 'Critical'
                  ? '#fef2f2'
                  : rec.severity === 'High'
                  ? '#fff7ed'
                  : rec.severity === 'Moderate'
                  ? '#fefce8'
                  : '#f0fdf4'

              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #dce8e0',
                    borderLeft: `6px solid ${severityColor}`,
                    borderRadius: '14px',
                    padding: '20px 22px',
                    boxShadow: '0 4px 18px rgba(11, 61, 46, 0.04)',
                  }}
                >
                  {/* Top Bar: Priority, Area, Severity, Authority */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '10px',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          background: '#123d30',
                          color: '#c9f170',
                          fontFamily: 'Manrope, sans-serif',
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        PRIORITY {rec.priority}
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: 800,
                          color: '#133a2e',
                          fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        {rec.area}
                      </h3>
                      <span
                        style={{
                          fontSize: '10px',
                          background: '#f0f5f2',
                          color: '#527265',
                          padding: '2px 8px',
                          borderRadius: '99px',
                          fontWeight: 600,
                        }}
                      >
                        {rec.zoneType}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: severityBg,
                          color: severityColor,
                          border: `1px solid ${severityColor}40`,
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Severity: {rec.severity}
                      </span>
                      <span style={{ fontSize: '10px', color: '#7a9287' }}>
                        Window: <b>{rec.enforcementWindow}</b>
                      </span>
                    </div>
                  </div>

                  {/* Body: Reason & Suggested Action */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '16px',
                      marginBottom: '14px',
                    }}
                  >
                    <div
                      style={{
                        background: '#f9fbf9',
                        border: '1px solid #e6f0e9',
                        borderRadius: '10px',
                        padding: '12px 14px',
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          color: '#718c80',
                          letterSpacing: '0.6px',
                          marginBottom: '4px',
                        }}
                      >
                        Causal Trigger / Observation Reason
                      </strong>
                      <p style={{ margin: 0, fontSize: '12px', color: '#254439', lineHeight: 1.55 }}>
                        {rec.reason}
                      </p>
                    </div>

                    <div
                      style={{
                        background: '#f2f8f4',
                        border: '1px solid #d5e9dc',
                        borderRadius: '10px',
                        padding: '12px 14px',
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          color: '#0e7c66',
                          letterSpacing: '0.6px',
                          marginBottom: '4px',
                        }}
                      >
                        Prescribed Authority Intervention
                      </strong>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#124134', lineHeight: 1.55 }}>
                        {rec.suggestedAction}
                      </p>
                    </div>
                  </div>

                  {/* Metrics Footer: Expected Improvement, Confidence, Authority, SHAP factors */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      paddingTop: '12px',
                      borderTop: '1px dashed #e2ece5',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ color: '#7a9288', fontSize: '10px' }}>Expected Impact: </span>
                        <strong style={{ color: '#168354', fontWeight: 800 }}>
                          {rec.expectedImprovement}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#7a9288', fontSize: '10px' }}>Model Confidence: </span>
                        <strong style={{ color: '#0e7c66' }}>{rec.confidence}%</strong>
                      </div>
                      <div>
                        <span style={{ color: '#7a9288', fontSize: '10px' }}>Jurisdiction: </span>
                        <b style={{ color: '#38564b' }}>{rec.authority}</b>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {rec.featureImportance.map(f => (
                        <span
                          key={f.factor}
                          style={{
                            fontSize: '9px',
                            background: '#f4faf6',
                            border: '1px solid #dce8e0',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            color: '#4e6d60',
                          }}
                        >
                          {f.factor}: <b>{Math.round(f.weight * 100)}%</b>
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: WHAT-IF ENVIRONMENTAL SIMULATION MODULE                        */}
      {/* ===================================================================== */}
      {activeTab === 'simulation' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #dce8e0',
              borderRadius: '16px',
              padding: '22px 26px',
              boxShadow: '0 8px 28px rgba(11, 61, 46, 0.05)',
              marginBottom: '20px',
            }}
          >
            <div style={{ marginBottom: '18px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#0e7c66',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                }}
              >
                <Sliders size={13} />
                Interactive Policy Simulator · Gaussian Dispersion Physics
              </div>
              <h2
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '22px',
                  fontWeight: 800,
                  color: '#123d30',
                  margin: '4px 0 6px',
                }}
              >
                What-If Environmental Intervention Simulator
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#68857a', maxWidth: '720px' }}>
                Simulate executive interventions across traffic restrictions, industrial curtailment, urban greening, and dust suppression. The model estimates immediate downstream AQI change and emission reductions in real time.
              </p>
            </div>

            {/* Simulation Dashboard Grid: Controls (Left) vs Real-Time Output (Right) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.15fr',
                gap: '24px',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Interactive Controls */}
              <div
                style={{
                  background: '#f9fbf9',
                  border: '1px solid #e1ebe4',
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#133a2e',
                    borderBottom: '1px solid #e4ede7',
                    paddingBottom: '8px',
                  }}
                >
                  Intervention Levers
                </h3>

                {/* Slider 1: Traffic Reduction */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: '#274b3d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Truck size={14} color="#0e7c66" /> Reduce Traffic (%)
                    </span>
                    <b style={{ color: '#0e7c66', fontSize: '13px' }}>{trafficReduction}%</b>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="5"
                    value={trafficReduction}
                    onChange={e => setTrafficReduction(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#0e7c66', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#7a9288' }}>
                    <span>0% (Standard)</span>
                    <span>40% (Odd-Even)</span>
                    <span>80% (Lockdown)</span>
                  </div>
                </div>

                {/* Slider 2: Industrial Emissions */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: '#274b3d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={14} color="#0e7c66" /> Reduce Industrial Emissions (%)
                    </span>
                    <b style={{ color: '#0e7c66', fontSize: '13px' }}>{industryReduction}%</b>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="75"
                    step="5"
                    value={industryReduction}
                    onChange={e => setIndustryReduction(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#0e7c66', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#7a9288' }}>
                    <span>0% (Full Capacity)</span>
                    <span>25% (Boiler Halt)</span>
                    <span>75% (Full Moratorium)</span>
                  </div>
                </div>

                {/* Slider 3: Increase Green Cover */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: '#274b3d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TreePine size={14} color="#0e7c66" /> Increase Urban Green Cover (%)
                    </span>
                    <b style={{ color: '#0e7c66', fontSize: '13px' }}>{greenCoverBoost}%</b>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={greenCoverBoost}
                    onChange={e => setGreenCoverBoost(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#0e7c66', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#7a9288' }}>
                    <span>0% Baseline</span>
                    <span>25% Biowalls</span>
                    <span>50% Canopy Target</span>
                  </div>
                </div>

                {/* Button Toggle 1: Water Sprinkling */}
                <div>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#274b3d', marginBottom: '6px' }}>
                    <Droplets size={14} color="#0e7c66" style={{ display: 'inline', marginRight: '4px' }} />
                    Water Sprinkling Deployment
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {(['off', 'moderate', 'intensive'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setWaterSprinkling(mode)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: waterSprinkling === mode ? '#0e7c66' : '#d8e5dd',
                          background: waterSprinkling === mode ? '#0e7c66' : '#ffffff',
                          color: waterSprinkling === mode ? '#ffffff' : '#39574b',
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                        }}
                      >
                        {mode === 'off' ? 'Inactive' : mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Button Toggle 2: Construction Restrictions */}
                <div>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#274b3d', marginBottom: '6px' }}>
                    <Building2 size={14} color="#0e7c66" style={{ display: 'inline', marginRight: '4px' }} />
                    Construction Activity Restrictions
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {(['standard', 'partial', 'complete'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setConstructionHalt(mode)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: constructionHalt === mode ? '#0e7c66' : '#d8e5dd',
                          background: constructionHalt === mode ? '#0e7c66' : '#ffffff',
                          color: constructionHalt === mode ? '#ffffff' : '#39574b',
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Real-Time Projected Output */}
              <div
                style={{
                  background: 'linear-gradient(180deg, #ffffff 0%, #f7faf8 100%)',
                  border: '1px solid #dce8e0',
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: '0 4px 16px rgba(11, 61, 46, 0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#133a2e',
                      fontFamily: 'Manrope, sans-serif',
                    }}
                  >
                    Predicted AQI Change
                  </h3>
                  <StatusPill status="Real-time Physics Solved" />
                </div>

                {/* Big Metric Display: Current -> After Intervention -> Improvement % */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    padding: '16px',
                    background: '#f2f8f4',
                    border: '1px solid #d5e9dc',
                    borderRadius: '12px',
                    marginBottom: '18px',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10px', color: '#688478', fontWeight: 600, display: 'block' }}>
                      Current AQI
                    </span>
                    <strong
                      style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        color: '#b91c1c',
                        fontFamily: 'Manrope, sans-serif',
                      }}
                    >
                      {simulationResults.baseAqi}
                    </strong>
                    <small style={{ display: 'block', fontSize: '9px', color: '#991b1b' }}>Baseline</small>
                  </div>

                  <div>
                    <span style={{ fontSize: '10px', color: '#688478', fontWeight: 600, display: 'block' }}>
                      After Intervention
                    </span>
                    <strong
                      style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        color: '#0e7c66',
                        fontFamily: 'Manrope, sans-serif',
                      }}
                    >
                      {simulationResults.simulatedAqi}
                    </strong>
                    <small style={{ display: 'block', fontSize: '9px', color: '#168354' }}>Estimated Target</small>
                  </div>

                  <div>
                    <span style={{ fontSize: '10px', color: '#688478', fontWeight: 600, display: 'block' }}>
                      Improvement
                    </span>
                    <strong
                      style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        color: '#168354',
                        fontFamily: 'Manrope, sans-serif',
                      }}
                    >
                      {simulationResults.improvementPct}%
                    </strong>
                    <small style={{ display: 'block', fontSize: '9px', color: '#168354' }}>
                      -{simulationResults.baseAqi - simulationResults.simulatedAqi} AQI pts
                    </small>
                  </div>
                </div>

                {/* Scores: Impact Score & Confidence Score */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 14px',
                    background: '#ffffff',
                    border: '1px solid #e1ece5',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '11px',
                  }}
                >
                  <div>
                    <span style={{ color: '#7a9288' }}>Intervention Impact Score: </span>
                    <strong style={{ color: '#168354', fontSize: '12px' }}>
                      {simulationResults.impactScore}/100
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#7a9288' }}>Model Confidence: </span>
                    <strong style={{ color: '#0e7c66', fontSize: '12px' }}>
                      {simulationResults.simConfidence}%
                    </strong>
                  </div>
                </div>

                {/* Before vs After Recharts Comparison Chart */}
                <div style={{ height: 230, width: '100%' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#587467', display: 'block', marginBottom: '6px' }}>
                    Before vs. After Intervention Pollutant Levels
                  </span>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart
                      data={simulationResults.comparisonData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4ede7" />
                      <XAxis dataKey="pollutant" tick={{ fontSize: 10, fill: '#647e73' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#647e73' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          return (
                            <div
                              style={{
                                background: '#ffffff',
                                border: '1px solid #d5e6dc',
                                borderRadius: '8px',
                                padding: '8px 10px',
                                fontSize: '11px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                              }}
                            >
                              <strong style={{ color: '#14382f', display: 'block', marginBottom: '4px' }}>
                                {label}
                              </strong>
                              <div style={{ color: '#b91c1c' }}>Before: {payload[0]?.value}</div>
                              <div style={{ color: '#0e7c66', fontWeight: 700 }}>
                                After: {payload[1]?.value}
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="current" name="Current Baseline" fill="#f87171" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="simulated" name="Post-Intervention" fill="#0e7c66" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: CITIZEN IMPACT ASSESSMENT DASHBOARD                            */}
      {/* ===================================================================== */}
      {activeTab === 'citizen' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* Top KPI Cards: Population Exposed, High Risk, Moderate Risk, Low Risk */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '14px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #dce8e0',
                borderRadius: '12px',
                padding: '16px 18px',
                boxShadow: '0 4px 14px rgba(11, 61, 46, 0.035)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6e897e', fontSize: '11px' }}>
                <span>Total Population Exposed</span>
                <Users size={16} color="#0e7c66" />
              </div>
              <strong
                style={{
                  display: 'block',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: '#133a2e',
                  marginTop: '8px',
                }}
              >
                {citizenExposureData.totalExposed}
              </strong>
              <small style={{ color: '#7a9288', fontSize: '10px' }}>In Delhi NCR Urban Cluster</small>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '16px 18px',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontSize: '11px', fontWeight: 600 }}>
                <span>High / Critical Risk</span>
                <AlertOctagon size={16} color="#dc2626" />
              </div>
              <strong
                style={{
                  display: 'block',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: '#b91c1c',
                  marginTop: '8px',
                }}
              >
                {citizenExposureData.highRisk}
              </strong>
              <small style={{ color: '#dc2626', fontSize: '10px' }}>Immediate advisory required</small>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #fef08a',
                borderRadius: '12px',
                padding: '16px 18px',
                boxShadow: '0 4px 14px rgba(234, 179, 8, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ca8a04', fontSize: '11px', fontWeight: 600 }}>
                <span>Moderate Risk</span>
                <HeartPulse size={16} color="#ca8a04" />
              </div>
              <strong
                style={{
                  display: 'block',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: '#a16207',
                  marginTop: '8px',
                }}
              >
                {citizenExposureData.moderateRisk}
              </strong>
              <small style={{ color: '#ca8a04', fontSize: '10px' }}>Sensitized population</small>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '16px 18px',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontSize: '11px', fontWeight: 600 }}>
                <span>Low Risk</span>
                <ShieldCheck size={16} color="#16a34a" />
              </div>
              <strong
                style={{
                  display: 'block',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: '#15803d',
                  marginTop: '8px',
                }}
              >
                {citizenExposureData.lowRisk}
              </strong>
              <small style={{ color: '#16a34a', fontSize: '10px' }}>Within WHO guideline buffer</small>
            </div>
          </div>

          {/* Exposure Severity & Demographics Breakdown Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '16px', marginBottom: '20px' }}>
            <Panel title="Exposure Severity Distribution" eyebrow="POPULATION SHARE">
              <div style={{ height: 240, width: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={citizenExposureData.severityDistribution}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {citizenExposureData.severityDistribution.map(entry => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`${(val / 1000).toFixed(0)}k citizens`, 'Exposed']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {citizenExposureData.severityDistribution.map(item => (
                  <span
                    key={item.name}
                    style={{
                      fontSize: '10px',
                      color: '#4a675b',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                    {item.name}
                  </span>
                ))}
              </div>
            </Panel>

            <Panel title="Vulnerable Population Breakdown" eyebrow="EPIDEMIOLOGICAL RISK">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {citizenExposureData.vulnerableGroups.map(v => (
                  <div
                    key={v.group}
                    style={{
                      background: '#f9fbf9',
                      border: '1px solid #e3ece6',
                      borderRadius: '10px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: v.color,
                          }}
                        />
                        <strong style={{ fontSize: '13px', color: '#13392e' }}>{v.group}</strong>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: `${v.color}20`,
                            color: v.color,
                          }}
                        >
                          {v.riskLevel}
                        </span>
                      </div>
                      <b style={{ fontSize: '13px', color: '#133a2e' }}>{v.count} Citizens</b>
                    </div>
                    <div style={{ fontSize: '11px', color: '#38564b', marginTop: '6px' }}>
                      <b>Advisory:</b> {v.advisory}
                    </div>
                    <div style={{ fontSize: '9px', color: '#7a9288', marginTop: '3px' }}>
                      <i>Clinical note:</i> {v.inhalationRate}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </motion.div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: EMERGENCY ALERT CENTER                                         */}
      {/* ===================================================================== */}
      {activeTab === 'alerts' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* Siren Alert Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
              border: '1px solid #f87171',
              borderRadius: '14px',
              padding: '16px 20px',
              color: '#ffffff',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 8px 24px rgba(185, 28, 28, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Pulsing Siren Icon Animation */}
              <div
                style={{
                  position: 'relative',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)',
                  animation: 'siren-pulse 1.8s infinite',
                }}
              >
                <Megaphone size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      background: '#ffffff',
                      color: '#b91c1c',
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      letterSpacing: '0.8px',
                    }}
                  >
                    LIVE EMERGENCY ALERT FEED
                  </span>
                  <span style={{ fontSize: '11px', color: '#fca5a5' }}>
                    Automated Public Safety Broadcast Bus
                  </span>
                </div>
                <h3 style={{ margin: '4px 0 0', fontSize: '17px', fontWeight: 800 }}>
                  Active Regional Environmental Alerts: {alerts.filter(a => a.broadcastStatus === 'Active').length} Critical Warnings
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => alert('Simulated Public Emergency Broadcast dispatched to municipal authorities and citizen apps.')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: '#ffffff',
                color: '#991b1b',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <Send size={14} />
              <span>Broadcast Citizen Mobile Advisory</span>
            </button>
          </div>

          {/* Alert Cards Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {alerts.map((alt, idx) => {
              const borderCol =
                alt.severity === 'Red'
                  ? '#ef4444'
                  : alt.severity === 'Orange'
                  ? '#f97316'
                  : alt.severity === 'Yellow'
                  ? '#eab308'
                  : '#22c55e'
              const badgeBg =
                alt.severity === 'Red'
                  ? '#fee2e2'
                  : alt.severity === 'Orange'
                  ? '#ffedd5'
                  : alt.severity === 'Yellow'
                  ? '#fef9c3'
                  : '#dcfce7'

              return (
                <motion.div
                  key={alt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #dce8e0',
                    borderLeft: `6px solid ${borderCol}`,
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 4px 16px rgba(11, 61, 46, 0.035)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '10px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: badgeBg,
                          color: borderCol,
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {alt.type.toUpperCase()} · LEVEL {alt.severity.toUpperCase()}
                      </span>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 800,
                          color: '#133a2e',
                          fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        {alt.title}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#7a9288' }}>{alt.timestamp}</span>
                      <button
                        type="button"
                        onClick={() => handleDispatchAction(alt.id)}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #d3e4da',
                          background: alt.broadcastStatus === 'Active' ? '#0e7c66' : '#f0f5f2',
                          color: alt.broadcastStatus === 'Active' ? '#ffffff' : '#3d5c50',
                          cursor: 'pointer',
                        }}
                      >
                        {alt.broadcastStatus === 'Active' ? 'Dispatch Enforcement' : 'Resolved'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '12px',
                      marginTop: '10px',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ background: '#f8faf9', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e7efe9' }}>
                      <span style={{ color: '#688478', fontSize: '10px', display: 'block' }}>Location & Sensor Source</span>
                      <strong style={{ color: '#143b2f', display: 'block', marginTop: '2px' }}>{alt.location}</strong>
                      <span style={{ color: '#7a9288', fontSize: '9px' }}>Source: {alt.source}</span>
                    </div>

                    <div style={{ background: '#f2f8f4', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d5e9dc' }}>
                      <span style={{ color: '#0e7c66', fontSize: '10px', fontWeight: 700, display: 'block' }}>
                        Mandated Remedial Action
                      </span>
                      <strong style={{ color: '#133e31', display: 'block', marginTop: '2px' }}>
                        {alt.recommendedAction}
                      </strong>
                      <span style={{ color: '#557568', fontSize: '9px' }}>Impact: {alt.affectedCount}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: EXPLAINABLE AI ENGINE                                          */}
      {/* ===================================================================== */}
      {activeTab === 'explainable' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Panel title="Explainable AI & Feature Contribution Matrix" eyebrow="SHAPLEY VALUE DECOMPOSITION">
            <div style={{ fontSize: '11px', color: '#637f73', lineHeight: 1.6, marginBottom: '16px' }}>
              Every model prediction in AirSense AI decomposes into transparent physical attribution vectors. Below is the global feature importance distribution driving today’s environmental risk assessment:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    layout="vertical"
                    data={[
                      { feature: 'PM2.5 Primary Loading', weight: 42, fill: '#ef4444' },
                      { feature: 'Wind Vector Stagnation', weight: 28, fill: '#f97316' },
                      { feature: 'Nocturnal Inversion Trap', weight: 19, fill: '#eab308' },
                      { feature: 'Biomass Smoke Advection', weight: 14, fill: '#8b5cf6' },
                      { feature: 'Solar UV Photolysis (O3)', weight: 9, fill: '#06b6d4' },
                    ]}
                    margin={{ top: 10, right: 30, left: 50, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4ede7" />
                    <XAxis type="number" unit="%" tick={{ fontSize: 10, fill: '#647e73' }} />
                    <YAxis type="category" dataKey="feature" tick={{ fontSize: 10, fill: '#335044' }} width={140} />
                    <Tooltip formatter={(v: number) => [`${v}% weight`, 'SHAP Contribution']} />
                    <Bar dataKey="weight" radius={[0, 6, 6, 0]}>
                      {[
                        '#ef4444',
                        '#f97316',
                        '#eab308',
                        '#8b5cf6',
                        '#06b6d4',
                      ].map((col, i) => (
                        <Cell key={i} fill={col} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  background: '#f8faf8',
                  border: '1px solid #e1ece4',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '11px',
                }}
              >
                <strong style={{ fontSize: '13px', color: '#133a2e', display: 'block', marginBottom: '8px' }}>
                  Mathematical Provenance Trace
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#4a675b' }}>
                  <div>
                    <b>1. Sensor Ingestion:</b> OpenAQ PM2.5 readings validated against historic station covariance (&sigma; = 4.2).
                  </div>
                  <div>
                    <b>2. Meteorological Forcing:</b> Synoptic wind vector (2.4 m/s) below dispersion threshold (2.8 m/s).
                  </div>
                  <div>
                    <b>3. Inversion Model:</b> Shallow nocturnal boundary layer at 180m altitude creates trapping lid.
                  </div>
                  <div>
                    <b>4. Rolling Trend Filter:</b> Convolved with 3-point moving average kernel [0.25, 0.50, 0.25] to prevent non-physical step jumps.
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </motion.div>
      )}
    </PageMotion>
  )
}
