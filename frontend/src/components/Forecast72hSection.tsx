import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Gauge,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api } from '../api/client'
import { useLocationState } from '../state/location'
import { Metric } from './Metric'
import { Panel } from './Panel'
import { Unavailable } from './Unavailable'

const NCR_CITIES: Record<string, { lat: number; lon: number }> = {
  Delhi: { lat: 28.6139, lon: 77.209 },
  Noida: { lat: 28.5355, lon: 77.391 },
  Gurugram: { lat: 28.4595, lon: 77.0266 },
  Ghaziabad: { lat: 28.6692, lon: 77.4538 },
  Faridabad: { lat: 28.4089, lon: 77.3178 },
}

const getAqiColor = (aqi?: number | null) => {
  if (aqi == null) return '#94a3b8'
  if (aqi <= 50) return '#10b981'
  if (aqi <= 100) return '#84cc16'
  if (aqi <= 200) return '#eab308'
  if (aqi <= 300) return '#f97316'
  if (aqi <= 400) return '#ef4444'
  return '#7f1d1d'
}

type MetricKey = 'aqi' | 'pm25' | 'pm10' | 'o3' | 'no2' | 'confidence'

export function Forecast72hSection() {
  const { location, setLocation } = useLocationState()
  const [isOpen, setIsOpen] = useState(true)
  const [selectedCity, setSelectedCity] = useState<string>('Delhi')
  const [activeMetric, setActiveMetric] = useState<MetricKey>('aqi')

  const targetCoords =
    NCR_CITIES[selectedCity] ||
    (location
      ? { lat: location.latitude, lon: location.longitude }
      : NCR_CITIES['Delhi'])

  const q = useQuery({
    queryKey: ['forecast72h', targetCoords.lat, targetCoords.lon, selectedCity],
    queryFn: () => api.forecast72h(targetCoords.lat, targetCoords.lon, selectedCity),
    refetchInterval: 120_000,
    staleTime: 60_000,
  })

  const handleCityChange = (cityName: string) => {
    setSelectedCity(cityName)
    const coords = NCR_CITIES[cityName]
    if (coords) {
      setLocation(
        { latitude: coords.lat, longitude: coords.lon },
        `${cityName}, Delhi NCR`,
        'city'
      )
    }
  }

  const forecastData = q.data?.forecast || []
  const chartPoints = forecastData.map((p) => ({
    ...p,
    displayTime: new Date(p.time).toLocaleTimeString([], {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    dateStr: new Date(p.time).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    }),
  }))

  const avg24h =
    chartPoints.length > 0
      ? Math.round(
          chartPoints
            .slice(0, 24)
            .reduce((sum, p) => sum + (p.aqi || 0), 0) /
            Math.min(24, chartPoints.length)
        )
      : 0

  const peakPoint =
    chartPoints.length > 0
      ? chartPoints.reduce(
          (max, p) => (p.aqi > max.aqi ? p : max),
          chartPoints[0]
        )
      : null

  const avgConfidence =
    chartPoints.length > 0
      ? Math.round(
          chartPoints.reduce((sum, p) => sum + (p.confidence || 85), 0) /
            chartPoints.length
        )
      : 88

  const optimalWin = q.data?.optimal_windows?.[0]
  const earlyWarnings = q.data?.early_warnings || []
  const recommendations = q.data?.recommendations || []
  const analytics = q.data?.analytics
  const grapStage = q.data?.grap_stage || 'Stage I (Poor)'
  const regionalComp = q.data?.regional_ncr_comparison || []

  const metricConfigs = {
    aqi: {
      name: 'Overall AQI',
      key: 'aqi',
      unit: 'CPCB AQI',
      color: '#16a34a',
    },
    pm25: {
      name: 'PM2.5 (Fine Particles)',
      key: 'pm25',
      unit: 'µg/m³',
      color: '#e11d48',
    },
    pm10: {
      name: 'PM10 (Coarse Particles)',
      key: 'pm10',
      unit: 'µg/m³',
      color: '#d97706',
    },
    o3: {
      name: 'Ground-level Ozone (O₃)',
      key: 'o3',
      unit: 'µg/m³',
      color: '#2563eb',
    },
    no2: {
      name: 'Nitrogen Dioxide (NO₂)',
      key: 'no2',
      unit: 'µg/m³',
      color: '#9333ea',
    },
    confidence: {
      name: 'Model Confidence',
      key: 'confidence',
      unit: '%',
      color: '#0d9488',
    },
  }

  const currentCfg = metricConfigs[activeMetric]

  return (
    <div style={{ marginTop: 24 }}>
      {/* Collapsible Section Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'linear-gradient(135deg, #102c28 0%, #173d36 100%)',
          color: '#fff',
          padding: '14px 20px',
          borderRadius: isOpen ? '10px 10px 0 0' : 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(16,44,40,0.15)',
          userSelect: 'none',
          transition: 'border-radius 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#c9f170',
              color: '#102c28',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Zap size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  color: '#ffffff',
                }}
              >
                72-Hour AI Multi-Pollutant Forecast
              </span>
              <span
                style={{
                  background: '#245244',
                  color: '#c9f170',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                DELHI NCR · ML ENGINE
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#9fbdb2' }}>
              Hourly PM2.5, PM10, O₃, NO₂, CPCB AQI, confidence scores, and
              early warnings
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#c9f170', fontWeight: 600 }}>
            {isOpen ? 'Collapse Section' : 'Expand 72h Forecast'}
          </span>
          {isOpen ? (
            <ChevronUp size={18} color="#c9f170" />
          ) : (
            <ChevronDown size={18} color="#c9f170" />
          )}
        </div>
      </div>

      {/* Collapsible Content Body */}
      {isOpen && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e1e7e1',
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            padding: 16,
          }}
        >
          {/* Delhi NCR City Quick-Selector */}
          <div className="ncr-city-bar" style={{ marginTop: 0 }}>
            <span className="ncr-city-label">
              <Compass
                size={13}
                style={{ display: 'inline', marginRight: 4 }}
              />
              DELHI NCR CITIES:
            </span>
            {Object.keys(NCR_CITIES).map((cityName) => (
              <button
                key={cityName}
                type="button"
                className={`ncr-city-pill ${
                  selectedCity === cityName ? 'active' : ''
                }`}
                onClick={() => handleCityChange(cityName)}
              >
                {cityName}
              </button>
            ))}
            {grapStage && grapStage !== 'None' && (
              <span className="grap-badge" style={{ marginLeft: 'auto' }}>
                <ShieldAlert size={14} /> GRAP {grapStage}
              </span>
            )}
          </div>

          {/* Early Warning System (EWS) Alert Banners */}
          {earlyWarnings.map((warn, i) => (
            <div key={i} className={`early-warning-banner ${warn.severity}`}>
              <div className="ew-header">
                <span className="ew-title">
                  <AlertTriangle size={18} />
                  {warn.title}
                </span>
                <span className="ew-lead">
                  <Clock
                    size={12}
                    style={{ display: 'inline', marginRight: 4 }}
                  />
                  {warn.lead_time_hours}h Advance Detection
                </span>
              </div>
              <p className="ew-message">{warn.message}</p>
            </div>
          ))}

          {q.isError ? (
            <Unavailable
              detail={q.error?.message || 'Forecast service error.'}
              retry={() => void q.refetch()}
            />
          ) : q.isLoading ? (
            <div className="loading-state">
              Analyzing historical records and generating 72-hour AI forecast
              for {selectedCity}…
            </div>
          ) : !chartPoints.length ? (
            <Unavailable detail="72-Hour forecast currently unavailable." />
          ) : (
            <>
              {/* Key Metric Highlights */}
              <div className="metric-grid">
                <Metric
                  label="Next 24h Average AQI"
                  value={avg24h}
                  unit="CPCB Index"
                  icon={<Activity size={17} />}
                />
                <Metric
                  label="72h Peak AQI Forecast"
                  value={peakPoint ? peakPoint.aqi : '—'}
                  unit={
                    peakPoint
                      ? `${peakPoint.category} (${peakPoint.displayTime})`
                      : ''
                  }
                  icon={<TrendingUp size={17} />}
                />
                <Metric
                  label="Safest Outdoor Window"
                  value={
                    optimalWin
                      ? optimalWin.time_window.split('at')[1] ||
                        optimalWin.time_window
                      : '1:00 PM – 4:00 PM'
                  }
                  unit={
                    optimalWin
                      ? `AQI ~${optimalWin.aqi}`
                      : 'Mid-day solar mixing'
                  }
                  icon={<CheckCircle2 size={17} />}
                />
                <Metric
                  label="Model Confidence Score"
                  value={`${avgConfidence}%`}
                  unit="Horizon-weighted"
                  icon={<Gauge size={17} />}
                />
              </div>

              {/* 72-Hour AQI Category Timeline (Visual Risk Ribbon) */}
              <Panel
                title={`72-Hour AQI Risk Timeline · ${selectedCity}`}
                eyebrow="HOURLY RISK TRAJECTORY"
              >
                <p className="panel-copy" style={{ marginBottom: 8 }}>
                  Continuous hourly risk classification mapped against India
                  CPCB standards. Hover any hour for details.
                </p>
                <div className="risk-ribbon-wrap">
                  <div className="risk-ribbon">
                    {chartPoints.map((p, idx) => (
                      <div
                        key={idx}
                        className="risk-segment"
                        style={{ backgroundColor: getAqiColor(p.aqi) }}
                        title={`${p.displayTime}: AQI ${p.aqi} (${p.category}) · Dominant: ${p.dominant_pollutant}`}
                      />
                    ))}
                  </div>
                  <div className="ribbon-labels">
                    <span>DAY 1 (Hours 0–24)</span>
                    <span>DAY 2 (Hours 24–48)</span>
                    <span>DAY 3 (Hours 48–72)</span>
                  </div>
                </div>
                <div
                  className="aqi-legend"
                  style={{ justifyContent: 'flex-start', marginTop: 4 }}
                >
                  <span style={{ background: '#10b981' }} />
                  Good (0–50)
                  <span style={{ background: '#84cc16' }} />
                  Satisfactory (51–100)
                  <span style={{ background: '#eab308' }} />
                  Moderate (101–200)
                  <span style={{ background: '#f97316' }} />
                  Poor (201–300)
                  <span style={{ background: '#ef4444' }} />
                  Very Poor (301–400)
                  <span style={{ background: '#7f1d1d' }} />
                  Severe (401+)
                </div>
              </Panel>

              {/* Multi-Pollutant Interactive Forecasting Chart */}
              <Panel
                title={`${currentCfg.name} — Next 72 Hours (${selectedCity})`}
                eyebrow="TIME-SERIES ML PREDICTIONS"
              >
                <div className="chart-tab-bar">
                  {(
                    [
                      'aqi',
                      'pm25',
                      'pm10',
                      'o3',
                      'no2',
                      'confidence',
                    ] as const
                  ).map((mKey) => (
                    <button
                      key={mKey}
                      type="button"
                      className={`chart-tab ${
                        activeMetric === mKey ? 'active' : ''
                      }`}
                      onClick={() => setActiveMetric(mKey)}
                    >
                      {metricConfigs[mKey].name}
                    </button>
                  ))}
                </div>

                <div className="chart-wrap" style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartPoints}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="metricGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={currentCfg.color}
                            stopOpacity={0.45}
                          />
                          <stop
                            offset="95%"
                            stopColor={currentCfg.color}
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2ece4"
                      />
                      <XAxis
                        dataKey="displayTime"
                        interval={5}
                        tick={{ fontSize: 9, fill: '#6c837a' }}
                      />
                      <YAxis
                        domain={
                          activeMetric === 'confidence'
                            ? [60, 100]
                            : ['auto', 'auto']
                        }
                        tick={{ fontSize: 10, fill: '#6c837a' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload
                          return (
                            <div
                              style={{
                                background: '#102c28',
                                color: '#fff',
                                padding: '10px 14px',
                                borderRadius: 8,
                                fontSize: 11,
                                minWidth: 200,
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                              }}
                            >
                              <strong
                                style={{
                                  display: 'block',
                                  color: '#c9f170',
                                  marginBottom: 4,
                                }}
                              >
                                {d.displayTime}
                              </strong>
                              <div>
                                Overall AQI: <b>{d.aqi}</b> ({d.category})
                              </div>
                              <div>
                                PM2.5: <b>{d.pm25} µg/m³</b> · PM10:{' '}
                                <b>{d.pm10} µg/m³</b>
                              </div>
                              <div>
                                O₃: <b>{d.o3} µg/m³</b> · NO₂:{' '}
                                <b>{d.no2} µg/m³</b>
                              </div>
                              <div>
                                Dominant:{' '}
                                <b style={{ color: '#fed7aa' }}>
                                  {d.dominant_pollutant}
                                </b>
                              </div>
                              <div
                                style={{
                                  marginTop: 4,
                                  paddingTop: 4,
                                  borderTop: '1px solid #23483f',
                                  fontSize: 10,
                                  color: '#9bbab0',
                                }}
                              >
                                Confidence: <b>{d.confidence}%</b>
                                {d.weather &&
                                  ` · Wind: ${d.weather.wind_speed_mps} m/s · Temp: ${d.weather.temperature_c}°C`}
                              </div>
                            </div>
                          )
                        }}
                      />
                      {activeMetric === 'aqi' && (
                        <>
                          <ReferenceLine
                            y={100}
                            stroke="#84cc16"
                            strokeDasharray="3 3"
                            label={{
                              value: 'Satisfactory (100)',
                              fill: '#84cc16',
                              fontSize: 9,
                            }}
                          />
                          <ReferenceLine
                            y={200}
                            stroke="#eab308"
                            strokeDasharray="3 3"
                            label={{
                              value: 'Moderate (200)',
                              fill: '#eab308',
                              fontSize: 9,
                            }}
                          />
                          <ReferenceLine
                            y={300}
                            stroke="#f97316"
                            strokeDasharray="3 3"
                            label={{
                              value: 'Poor (300)',
                              fill: '#f97316',
                              fontSize: 9,
                            }}
                          />
                          <ReferenceLine
                            y={400}
                            stroke="#ef4444"
                            strokeDasharray="3 3"
                            label={{
                              value: 'Severe (400)',
                              fill: '#ef4444',
                              fontSize: 9,
                            }}
                          />
                        </>
                      )}
                      <Area
                        type="monotone"
                        dataKey={currentCfg.key}
                        name={currentCfg.name}
                        stroke={currentCfg.color}
                        strokeWidth={2.5}
                        fill="url(#metricGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              {/* AI Analytics & Future-Grounded Recommendations */}
              <div className="content-grid">
                <Panel
                  title="AI Data Analytics & Weather Impact"
                  eyebrow="HISTORICAL CORRELATIONS"
                >
                  {analytics?.insights?.map((ins, idx) => (
                    <div key={idx} className="insight-card">
                      <p>
                        <Sparkles
                          size={14}
                          style={{
                            color: '#236a54',
                            display: 'inline',
                            marginRight: 6,
                          }}
                        />
                        {ins}
                      </p>
                    </div>
                  ))}
                  {analytics?.pollutant_correlations && (
                    <div className="corr-grid">
                      <div className="corr-box">
                        <span>PM2.5 vs Wind Speed</span>
                        <strong style={{ color: '#047857' }}>
                          {analytics.pollutant_correlations[
                            'pm25_vs_wind_speed'
                          ] ?? -0.58}
                        </strong>
                      </div>
                      <div className="corr-box">
                        <span>PM2.5 vs Humidity</span>
                        <strong style={{ color: '#b45309' }}>
                          {analytics.pollutant_correlations[
                            'pm25_vs_humidity'
                          ] ?? 0.46}
                        </strong>
                      </div>
                      <div className="corr-box">
                        <span>NO₂ vs Ozone (O₃)</span>
                        <strong style={{ color: '#4338ca' }}>
                          {analytics.pollutant_correlations[
                            'no2_vs_o3'
                          ] ?? -0.42}
                        </strong>
                      </div>
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Predictive Action Plan"
                  eyebrow="PREVENTIVE RECOMMENDATIONS"
                >
                  <p className="panel-copy" style={{ marginBottom: 6 }}>
                    AI-synthesized measures derived directly from 72-hour forecast
                    trajectory (not just current conditions).
                  </p>
                  <div className="rec-grid">
                    {recommendations.slice(0, 4).map((rec, idx) => (
                      <div key={idx} className={`rec-item ${rec.urgency}`}>
                        <strong>
                          <Zap
                            size={13}
                            style={{ display: 'inline', marginRight: 5 }}
                          />
                          {rec.action}
                        </strong>
                        <p>{rec.rationale}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {/* Delhi NCR Regional Comparison */}
              {regionalComp.length > 0 && (
                <Panel
                  title="Delhi NCR Regional Hotspots Forecast"
                  eyebrow="REGIONAL COMPARISON"
                >
                  <p className="panel-copy">
                    72-hour air quality forecast across the National Capital
                    Region. Click any city to inspect its localized trajectory.
                  </p>
                  <div className="regional-ncr-grid">
                    {regionalComp.map((rc) => (
                      <div
                        key={rc.city}
                        className={`regional-ncr-card ${
                          selectedCity === rc.city ? 'active' : ''
                        }`}
                        onClick={() => handleCityChange(rc.city)}
                      >
                        <span>{rc.city}</span>
                        <strong style={{ color: getAqiColor(rc.avg_aqi_72h) }}>
                          {rc.avg_aqi_72h}
                        </strong>
                        <small>
                          Peak: {rc.peak_aqi_72h} · {rc.category}
                        </small>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

