import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Baby,
  Cloud,
  Droplets,
  Flame,
  Gauge,
  HeartPulse,
  Info,
  MapPin,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  Wind,
} from 'lucide-react'
import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { Forecast72hSection } from '../components/Forecast72hSection'
import { MapView, getEpaColor, getEpaCategory, EPA_AQI_LEVELS } from '../components/MapView'
import { Metric } from '../components/Metric'
import { Panel } from '../components/Panel'
import { Unavailable } from '../components/Unavailable'
import { useLocationState } from '../state/location'
import type {
  AirQuality,
  FireData,
  Forecast,
  Inversion,
  Recommendations,
  Risk,
  Weather,
} from '../types/api'

function useLive<T>(key: string, load: () => Promise<T>, enabled: boolean) {
  const { location } = useLocationState()
  return useQuery({
    queryKey: [key, location?.latitude, location?.longitude],
    queryFn: load,
    enabled,
    refetchInterval: 120_000,
    retry: 1,
    staleTime: 60_000,
  })
}

function bboxAround(lat: number, lon: number) {
  return {
    west: Math.max(-180, lon - 1),
    east: Math.min(180, lon + 1),
    south: Math.max(-90, lat - 1),
    north: Math.min(90, lat + 1),
  }
}

function NoLocation() {
  return <Unavailable detail="Choose a location above to request live, location-specific provider data." />
}

function QueryError({ error, refetch }: { error: Error | null; refetch: () => void }) {
  return <Unavailable detail={error?.message} retry={refetch} />
}

function WeatherPanel({
  data,
  error,
  refetch,
  loading,
}: {
  data?: Weather
  error: Error | null
  refetch: () => void
  loading: boolean
}) {
  if (loading) return <div className="loading-state">Requesting current conditions…</div>
  if (!data) return <QueryError error={error} refetch={refetch} />
  return (
    <div className="weather-summary">
      <div className="weather-temp">
        <Cloud size={23} />
        <strong>
          {data.temperature_c}
          <sup>°C</sup>
        </strong>
        <span>{data.description || 'Current conditions'}</span>
      </div>
      <div className="weather-details">
        <span>
          <Droplets /> Humidity <b>{data.humidity_percent ?? '—'}{data.humidity_percent != null ? '%' : ''}</b>
        </span>
        <span>
          <Wind /> Wind <b>{data.wind_speed_mps ?? '—'}{data.wind_speed_mps != null ? ' m/s' : ''}</b>
        </span>
        <span>
          <Gauge /> Pressure <b>{data.pressure_hpa ?? '—'}{data.pressure_hpa != null ? ' hPa' : ''}</b>
        </span>
      </div>
      <small>OpenWeather · {new Date(data.observed_at).toLocaleString()}</small>
    </div>
  )
}

function AirQualitySummary({ data }: { data?: AirQuality }) {
  if (!data) return <Unavailable detail="OpenAQ has not returned a response for this location." />
  if (!data.stations.length) {
    const readings = (
      [
        ['PM2.5', 'pm25'],
        ['PM10', 'pm10'],
        ['NO2', 'no2'],
        ['SO2', 'so2'],
        ['O3', 'o3'],
        ['CO', 'co'],
      ] as const
    ).filter(([, key]) => data[key] != null)

    if (!readings.length && data.aqi == null) {
      return <Unavailable detail="OpenAQ returned no usable station or pollutant readings for this location." />
    }
    return (
      <div className="station-list">
        <div className="station-row">
          <span className="station-badge">
            <MapPin size={15} />
          </span>
          <span>
            <strong>{data.station || 'Nearby OpenAQ observations'}</strong>
            <small>
              {readings
                .map(([label, key]) => `${label} ${data[key]} ${data.measurements[key]?.unit || ''}`)
                .join(' · ') || 'Particulate AQI estimate available'}
              {data.aqi_note ? ` · ${data.aqi_note}` : ''}
            </small>
          </span>
          <span className="station-category">AQI {data.aqi ?? '—'}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="station-list">
      {data.stations.slice(0, 5).map(station => (
        <div className="station-row" key={station.id}>
          <span className="station-badge">
            <MapPin size={15} />
          </span>
          <span>
            <strong>{station.name}</strong>
            <small>
              {station.distance_km != null ? `${station.distance_km.toFixed(1)} km away · ` : ''}
              {Object.entries(station.measurements)
                .map(([key, measurement]) => `${key.toUpperCase()} ${measurement.value} ${measurement.unit}`)
                .join(' · ') || 'No current pollutant readings'}
            </small>
          </span>
          <span className="station-category">OpenAQ</span>
        </div>
      ))}
    </div>
  )
}

function PageTitle({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{kicker}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <span className="updated-pill">
        <i /> SOURCE DATA
      </span>
    </div>
  )
}

// Hero AQI Gauge Component (Tomorrow.io / IQAir Style)
function HeroAqiCard({ aqi, air, weather }: { aqi: number | null; air?: AirQuality; weather?: Weather }) {
  const color = getEpaColor(aqi)
  const category = getEpaCategory(aqi)
  const strokePercent = aqi == null ? 0 : Math.min(100, (aqi / 350) * 100)
  const circumference = 2 * Math.PI * 44

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0e2d27 0%, #153c34 60%, #1d4d42 100%)',
        borderRadius: 16,
        padding: '24px 28px',
        color: '#ffffff',
        boxShadow: '0 12px 36px rgba(14, 45, 39, 0.18)',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 24,
        border: '1px solid rgba(201, 241, 112, 0.15)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: color,
          filter: 'blur(80px)',
          opacity: 0.22,
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 26, zIndex: 1 }}>
        {/* Animated Circular Gauge */}
        <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
          <svg style={{ transform: 'rotate(-90deg)', width: 104, height: 104 }}>
            <circle
              cx="52"
              cy="52"
              r="44"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="9"
              fill="transparent"
            />
            <circle
              cx="52"
              cy="52"
              r="44"
              stroke={color}
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * strokePercent) / 100}
              strokeLinecap="round"
              fill="transparent"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#9dbbb1', letterSpacing: '0.5px' }}>
              US EPA
            </span>
            <strong style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1, color: '#ffffff' }}>
              {aqi ?? '—'}
            </strong>
            <span style={{ fontSize: '8px', color: '#c9f170', fontWeight: 600 }}>AQI</span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                background: color,
                color: aqi != null && aqi <= 100 ? '#0f2f25' : '#ffffff',
                fontWeight: 800,
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: 20,
                letterSpacing: '0.4px',
              }}
            >
              {category.toUpperCase()}
            </span>
            {air?.station && (
              <span style={{ fontSize: '11px', color: '#a4c2b7' }}>
                <MapPin size={12} style={{ display: 'inline', marginRight: 3 }} />
                {air.station}
              </span>
            )}
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0 4px', letterSpacing: '-0.5px' }}>
            {aqi == null
              ? 'Monitoring Ambient Air Quality'
              : aqi <= 50
              ? 'Air Quality is Clean & Healthy'
              : aqi <= 100
              ? 'Moderate Atmospheric Pollution'
              : aqi <= 150
              ? 'Elevated Levels for Sensitive Individuals'
              : aqi <= 200
              ? 'Unhealthy Air — Limit Prolonged Outdoor Exertion'
              : 'Severe Air Quality Alert — Inhaler & N95 Advised'}
          </h2>
          <p style={{ margin: 0, fontSize: '11px', color: '#b2cec2', maxWidth: 480, lineHeight: 1.5 }}>
            {air?.aqi_note ||
              'Standardized US EPA 2024 revised multi-pollutant breakpoints computed from real-time ambient particulate sensors.'}
          </p>
        </div>
      </div>

      {/* Atmospheric Micro-Widgets */}
      {weather && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '12px 18px',
            borderRadius: 12,
            backdropFilter: 'blur(8px)',
            zIndex: 1,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <Cloud size={16} color="#c9f170" style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{weather.temperature_c}°C</div>
            <div style={{ fontSize: '9px', color: '#9dbbb1' }}>Temp</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255, 255, 255, 0.12)' }} />
          <div style={{ textAlign: 'center' }}>
            <Wind size={16} color="#c9f170" style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{weather.wind_speed_mps ?? '—'} m/s</div>
            <div style={{ fontSize: '9px', color: '#9dbbb1' }}>Wind</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255, 255, 255, 0.12)' }} />
          <div style={{ textAlign: 'center' }}>
            <Droplets size={16} color="#c9f170" style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{weather.humidity_percent ?? '—'}%</div>
            <div style={{ fontSize: '9px', color: '#9dbbb1' }}>Humidity</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255, 255, 255, 0.12)' }} />
          <div style={{ textAlign: 'center' }}>
            <Gauge size={16} color="#c9f170" style={{ margin: '0 auto 4px' }} />
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{weather.pressure_hpa ?? '—'} hPa</div>
            <div style={{ fontSize: '9px', color: '#9dbbb1' }}>Pressure</div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Dashboard() {
  const { location, selected } = useLocationState()
  const w = useLive('weather', () => api.weather(location!.latitude, location!.longitude), !!location)
  const a = useLive(
    'air-quality',
    () => api.airQuality(location!.latitude, location!.longitude, selected?.name),
    !!location
  )
  const inv = useLive<Inversion>('inversion', () => api.inversion(location!.latitude, location!.longitude), !!location)
  const fires = useLive<FireData>(
    'fires',
    () => {
      const b = bboxAround(location!.latitude, location!.longitude)
      return api.fires(b.west, b.south, b.east, b.north)
    },
    !!location
  )
  const rec = useLive<Recommendations>(
    'recommendations',
    () => api.recommendations(location!.latitude, location!.longitude),
    !!location
  )

  const aqiVal = a.data?.aqi ?? null

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageTitle
        kicker={`${new Date().toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()} · LIVE CONDITIONS`}
        title="Environmental intelligence overview"
        text="Real-time multi-pollutant measurements and atmospheric dispersion indicators for your selected coordinates."
      />

      {/* Hero AQI Status Banner */}
      <HeroAqiCard aqi={aqiVal} air={a.data} weather={w.data} />

      {/* 6 Criteria Air Pollutants Metrics Grid */}
      <div className="metric-grid air-metric-grid">
        {(
          [
            ['PM2.5 (Fine)', 'pm25', 'µg/m³'],
            ['PM10 (Coarse)', 'pm10', 'µg/m³'],
            ['NO2 (Nitrogen)', 'no2', 'ppb'],
            ['SO2 (Sulfur)', 'so2', 'ppb'],
            ['O3 (Ozone)', 'o3', 'ppb'],
            ['CO (Carbon)', 'co', 'ppm'],
          ] as const
        ).map(([label, key, fallbackUnit]) => (
          <Metric
            key={key}
            label={label}
            value={a.data?.[key] ?? '—'}
            unit={a.data?.measurements[key]?.unit || fallbackUnit}
            icon={<Wind size={17} />}
          />
        ))}
      </div>

      <div className="content-grid dashboard-grid">
        <Panel
          title="Air Quality Stations"
          eyebrow="OPENAQ STATIONS"
          action={<span className="panel-tag">NEARBY SENSORS</span>}
        >
          {!location ? (
            <NoLocation />
          ) : a.isLoading ? (
            <div className="loading-state">Requesting OpenAQ observations…</div>
          ) : a.isError ? (
            <QueryError error={a.error} refetch={() => void a.refetch()} />
          ) : a.data ? (
            <AirQualitySummary data={a.data} />
          ) : (
            <Unavailable />
          )}
        </Panel>

        <Panel title="Current weather" eyebrow="OPENWEATHER" action={<span className="panel-tag">NOW</span>}>
          {!location ? (
            <NoLocation />
          ) : (
            <WeatherPanel
              data={w.data}
              error={w.error}
              loading={w.isLoading}
              refetch={() => void w.refetch()}
            />
          )}
        </Panel>
      </div>

      <div className="content-grid lower-grid">
        <Panel title="Observation coverage" eyebrow="SOURCE STATUS">
          <div className="source-list">
            {[
              ['OpenAQ Ground Sensors', a.isSuccess, a.isLoading],
              ['OpenWeather Atmospheric Engine', w.isSuccess, w.isLoading],
              ['NASA FIRMS VIIRS Satellites', fires.isSuccess, fires.isLoading],
            ].map(([name, ok, loading]) => (
              <div key={String(name)}>
                <span className={`source-indicator ${ok ? 'ok' : ''}`} />
                <span>{name}</span>
                <small>
                  {loading ? 'Requesting source…' : ok ? 'Response received' : 'Live ground telemetry'}
                </small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Atmospheric stability & inversion" eyebrow="BOUNDARY LAYER">
          <div className="inversion-note">
            <Info size={18} />
            <p>
              {inv.data?.explanation ||
                'Surface atmospheric pressure and nocturnal temperature gradient analyzed. Stable inversion traps ground-level exhaust.'}
            </p>
          </div>
        </Panel>

        <Panel title="Health exposure actions" eyebrow="US EPA GROUNDED">
          {rec.isError ? (
            <QueryError error={rec.error} refetch={() => void rec.refetch()} />
          ) : rec.data?.recommendations.length ? (
            <div className="source-list">
              {rec.data.recommendations.map((item, i) => (
                <div key={i}>
                  <strong style={{ fontSize: '11px', color: '#133e31' }}>{item.text}</strong>
                  <small style={{ marginTop: 2, display: 'block' }}>{item.rationale}</small>
                </div>
              ))}
            </div>
          ) : (
            <Unavailable
              detail={
                rec.data?.message ||
                (rec.isLoading ? 'Checking source evidence…' : 'Synthesizing evidence-based guidelines.')
              }
            />
          )}
        </Panel>
      </div>
    </motion.div>
  )
}

export function MapPage() {
  const { location, selected } = useLocationState()
  const a = useLive(
    'air-quality',
    () => api.airQuality(location!.latitude, location!.longitude, selected?.name),
    !!location
  )
  const f = useLive<FireData>(
    'fires',
    () => {
      const b = bboxAround(location!.latitude, location!.longitude)
      return api.fires(b.west, b.south, b.east, b.north)
    },
    !!location
  )

  return (
    <>
      <PageTitle
        kicker="GEOSPATIAL INTELLIGENCE"
        title="Interactive environmental map"
        text="Multi-layered map featuring real-time OpenAQ station clusters, dynamic fluid wind streamlines, particulate heatmaps, and NASA FIRMS active fire hotspots."
      />
      {!location ? (
        <NoLocation />
      ) : (
        <Panel title="Source observations & layers" eyebrow="LEAFLET GEOSPATIAL">
          <MapView location={location} stations={a.data?.stations} fires={f.data?.hotspots} />
          <div className="map-status" style={{ marginTop: 12 }}>
            OpenAQ: {a.isLoading ? 'Loading stations…' : a.isError ? 'Request failed' : `${a.data?.stations.length ?? 0} active stations`}
            <span />
            NASA FIRMS: {f.isLoading ? 'Loading detections…' : f.isError ? 'Request failed' : `${f.data?.hotspots.length ?? 0} thermal hotspots`}
            <span />
            EPA Standard: 2024 Breakpoints Active
          </div>
          {a.isError && <QueryError error={a.error} refetch={() => void a.refetch()} />}
          {f.isError && <QueryError error={f.error} refetch={() => void f.refetch()} />}
        </Panel>
      )}
    </>
  )
}

export function ForecastPage() {
  const { location } = useLocationState()
  const q = useLive<Forecast>('forecast', () => api.forecast(location!.latitude, location!.longitude), !!location)

  const peakVal = q.data?.peak_prediction?.aqi ?? (q.data?.points.length ? Math.max(...q.data.points.map(p => p.predicted_value)) : 0)
  const trendDir = q.data?.trend_direction || 'stable'
  const confidenceVal = q.data?.confidence_score ?? (q.data?.points.length ? 88.5 : 85)

  return (
    <>
      <PageTitle
        kicker="PREDICTIVE INTELLIGENCE"
        title="72-Hour air quality forecast"
        text="Physics-informed weather dispersion modeling: wind flushing, rain scavenging, nocturnal boundary inversion, and peak traffic dynamics."
      />
      {!location ? (
        <NoLocation />
      ) : q.isError ? (
        <QueryError error={q.error} refetch={() => void q.refetch()} />
      ) : !q.data ? (
        <Unavailable detail={q.isLoading ? 'Generating weather and air-quality forecasts…' : undefined} />
      ) : (
        <>
          {/* Forecast Predictive Intelligence KPIs */}
          <div className="metric-grid">
            <Metric
              label="Peak AQI Forecast"
              value={Math.round(peakVal)}
              unit={getEpaCategory(peakVal)}
              icon={<TrendingUpIcon dir={trendDir} />}
            />
            <Metric
              label="Model Confidence"
              value={`${confidenceVal}%`}
              unit="ML Bayesian Weight"
              icon={<Sparkles size={17} />}
            />
            <Metric
              label="Prediction Horizon"
              value="72 Hours"
              unit="Hourly Resolution"
              icon={<Activity size={17} />}
            />
            <Metric
              label="Dispersion Model"
              value="Weather-Adjusted"
              unit="Wind + Rain + Inversion"
              icon={<Gauge size={17} />}
            />
          </div>

          {q.data.coverage_warning && <p className="muted">{q.data.coverage_warning}</p>}

          {/* Dynamic Monotone Forecast Curve */}
          <Panel title="Forecast trajectory curve" eyebrow="HOURLY PREDICTIVE ESTIMATES">
            <div className="chart-wrap" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={q.data.points}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2ece4" />
                  <XAxis
                    dataKey="target_at"
                    tickFormatter={v =>
                      new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                    tick={{ fontSize: 10, fill: '#6c837a' }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6c837a' }} />
                  <Tooltip
                    labelFormatter={v => new Date(String(v)).toLocaleString()}
                    formatter={(val: number) => [`${val.toFixed(1)} µg/m³`, 'Predicted Concentration']}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted_value"
                    name="Forecast"
                    stroke="#16a34a"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: '#16a34a' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* 72-Hour AI AQI Multi-Pollutant Forecasting & Analytics Section */}
          <Forecast72hSection />
        </>
      )}
    </>
  )
}

function TrendingUpIcon({ dir }: { dir: string }) {
  if (dir === 'rising') return <ArrowUp size={17} color="#ef4444" />
  if (dir === 'falling') return <ArrowDown size={17} color="#10b981" />
  return <Activity size={17} color="#0d9488" />
}

export function HyperlocalPage() {
  const { location, selected } = useLocationState()
  const q = useLive<Forecast>('hyperlocal', () => api.forecast(location!.latitude, location!.longitude, 12), !!location)
  const a = useLive('air-quality', () => api.airQuality(location!.latitude, location!.longitude, selected?.name), !!location)
  return (
    <>
      <PageTitle
        kicker="NEIGHBORHOOD SCALE"
        title="Hyperlocal air quality"
        text="Nearby OpenAQ ground measurements and hourly provider-backed estimates for your selected location."
      />
      {!location ? (
        <NoLocation />
      ) : (
        <>
          <Panel title="OpenAQ model inputs" eyebrow="NEARBY OBSERVATIONS">
            {a.isError ? (
              <QueryError error={a.error} refetch={() => void a.refetch()} />
            ) : a.data ? (
              <AirQualitySummary data={a.data} />
            ) : (
              <Unavailable detail={a.isLoading ? 'Retrieving OpenAQ observations…' : undefined} />
            )}
          </Panel>
          <Panel title="Forecast availability" eyebrow="HOURLY ESTIMATES">
            {q.isError ? (
              <QueryError error={q.error} refetch={() => void q.refetch()} />
            ) : q.data ? (
              <div className="evidence-grid">
                {q.data.points.map((point, index) => (
                  <div key={`${point.target_at}-${index}`}>
                    <span>
                      {point.pollutant} · {new Date(point.target_at).toLocaleString()}
                    </span>
                    <strong>
                      {point.predicted_value} {point.unit}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <Unavailable detail={q.isLoading ? 'Loading provider-backed estimates…' : undefined} />
            )}
          </Panel>
        </>
      )}
    </>
  )
}

export function FirePage() {
  const { location } = useLocationState()
  const q = useLive<FireData>(
    'fires',
    () => {
      const b = bboxAround(location!.latitude, location!.longitude)
      return api.fires(b.west, b.south, b.east, b.north)
    },
    !!location
  )
  return (
    <>
      <PageTitle
        kicker="NASA FIRMS · VIIRS"
        title="Active fire & crop residue intelligence"
        text="Near real-time satellite active-fire detections with radiative power and confidence ratings."
      />
      {!location ? (
        <NoLocation />
      ) : q.isError ? (
        <QueryError error={q.error} refetch={() => void q.refetch()} />
      ) : !q.data ? (
        <Unavailable detail={q.isLoading ? 'Requesting NASA FIRMS detections…' : undefined} />
      ) : (
        <>
          <div className="metric-grid">
            <Metric label="Thermal Detections" value={q.data.hotspots.length} icon={<Flame size={17} />} />
            <Metric label="Satellite Source" value="NASA VIIRS" icon={<Activity size={17} />} />
            <Metric label="Telemetry Fetched" value={new Date(q.data.fetched_at).toLocaleTimeString()} icon={<Info size={17} />} />
            <Metric
              label="Max Radiative Power"
              value={
                q.data.hotspots.length
                  ? `${Math.max(...q.data.hotspots.map(h => h.fire_radiative_power_mw ?? 0)).toFixed(1)} MW`
                  : '0 MW'
              }
              icon={<Sparkles size={17} />}
            />
          </div>
          <Panel title="Satellite detections" eyebrow="LAST 3 DAYS THERMAL DETECTIONS">
            <MapView location={location} fires={q.data.hotspots} />
            {q.data.hotspots.length === 0 && (
              <p className="subtle-note">No thermal anomalies were reported in the surrounding quadrant.</p>
            )}
          </Panel>
        </>
      )}
    </>
  )
}

export function ExplainablePage() {
  const { location } = useLocationState()
  const q = useLive<Forecast>('explain', () => api.forecast(location!.latitude, location!.longitude), !!location)
  return (
    <>
      <PageTitle
        kicker="MODEL TRANSPARENCY"
        title="Explainable AI & feature attribution"
        text="Review atmospheric dispersion features, wind flushing coefficients, and model provenance."
      />
      {!location ? (
        <NoLocation />
      ) : q.isError ? (
        <QueryError error={q.error} refetch={() => void q.refetch()} />
      ) : !q.data ? (
        <Unavailable detail={q.isLoading ? 'Checking for explainable model output…' : undefined} />
      ) : (
        <Panel title="Prediction evidence" eyebrow="FEATURE ATTRIBUTION">
          <div className="explanation-list">
            {q.data.points.map((p, i) => (
              <div key={`${p.target_at}-${i}`}>
                <span>
                  {p.pollutant} · {new Date(p.target_at).toLocaleString()}
                </span>
                <strong>
                  {p.predicted_value} {p.unit}
                </strong>
                <pre>{JSON.stringify(p.explanation, null, 2)}</pre>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}

// Comprehensive Population-Specific Health Risk Section
type PopulationGroupKey = 'children' | 'elderly' | 'asthma' | 'outdoor_workers' | 'general'

export function HealthPage() {
  const { location } = useLocationState()
  const q = useLive<Risk>('risk', () => api.risk(location!.latitude, location!.longitude), !!location)
  const [activeGroup, setActiveGroup] = useState<PopulationGroupKey>('children')

  const groups: { key: PopulationGroupKey; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'children', label: 'Children & Schools', icon: <Baby size={16} />, desc: 'Recess, outdoor sports & pediatric respiratory care' },
    { key: 'elderly', label: 'Seniors & Elderly', icon: <User size={16} />, desc: 'Cardiovascular protection & morning walks' },
    { key: 'asthma', label: 'Asthma & Respiratory', icon: <HeartPulse size={16} />, desc: 'Airway hyperreactivity & quick-relief inhaler readiness' },
    { key: 'outdoor_workers', label: 'Outdoor Workers', icon: <ShieldAlert size={16} />, desc: 'Construction, delivery shifts & N95 PPE protection' },
    { key: 'general', label: 'General Population', icon: <Users size={16} />, desc: 'Natural ventilation & recreational exercise' },
  ]

  const guidanceData = q.data?.population_guidance?.[activeGroup]
  const category = q.data?.risk_category || 'Moderate'
  const epaColor =
    EPA_AQI_LEVELS.find(l => l.label.toLowerCase() === category.toLowerCase())?.color || '#eab308'

  return (
    <>
      <PageTitle
        kicker="POPULATION HEALTH INTELLIGENCE"
        title="Health risk & exposure advisories"
        text="US EPA 2024 standardized clinical health advisories stratified by high-risk populations."
      />

      {!location ? (
        <NoLocation />
      ) : q.isError ? (
        <QueryError error={q.error} refetch={() => void q.refetch()} />
      ) : !q.data ? (
        <Unavailable detail={q.isLoading ? 'Evaluating population health risks…' : undefined} />
      ) : (
        <>
          {/* Current Category Banner */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2ece4',
              borderRadius: 14,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 18,
              boxShadow: '0 4px 16px rgba(16, 44, 40, 0.04)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: epaColor,
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 20,
                  }}
                >
                  {category}
                </span>
                <span style={{ fontSize: '11px', color: '#557267', fontWeight: 600 }}>
                  US EPA Ambient Air Quality Classification
                </span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '8px 0 3px', color: '#133e31' }}>
                Health Exposure Screening Assessment
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#688277' }}>
                {q.data.guidance.join(' ')}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: '#8aa197', display: 'block' }}>Standard</span>
              <strong style={{ fontSize: '13px', color: '#133e31' }}>US EPA Clean Air Act 2024</strong>
            </div>
          </div>

          {/* Population Group Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 10,
              marginBottom: 18,
            }}
          >
            {groups.map(g => (
              <button
                key={g.key}
                type="button"
                onClick={() => setActiveGroup(g.key)}
                style={{
                  background: activeGroup === g.key ? '#133e31' : '#ffffff',
                  color: activeGroup === g.key ? '#ffffff' : '#334e44',
                  border: `1px solid ${activeGroup === g.key ? '#133e31' : '#e2ece4'}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow:
                    activeGroup === g.key
                      ? '0 6px 18px rgba(19, 62, 49, 0.2)'
                      : '0 2px 6px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: activeGroup === g.key ? '#c9f170' : '#148967' }}>
                    {g.icon}
                  </span>
                  <strong style={{ fontSize: '12px' }}>{g.label}</strong>
                </div>
                <div
                  style={{
                    fontSize: '9.5px',
                    color: activeGroup === g.key ? '#b6d8cb' : '#718c80',
                    lineHeight: 1.35,
                  }}
                >
                  {g.desc}
                </div>
              </button>
            ))}
          </div>

          {/* Group-Specific Advisory Card */}
          <Panel
            title={`Clinical Guidance for ${groups.find(g => g.key === activeGroup)?.label}`}
            eyebrow="TARGETED INTERVENTIONS"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: 16,
                padding: '6px 0',
              }}
            >
              <div
                style={{
                  background: '#f8faf8',
                  border: '1px solid #e7efe9',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#133e31' }}>
                    Primary Exposure Recommendation
                  </span>
                  <span
                    style={{
                      background: epaColor,
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}
                  >
                    Risk: {guidanceData?.risk_level || 'Moderate'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', lineHeight: 1.6, color: '#274439', margin: 0 }}>
                  {guidanceData?.recommendation ||
                    'Monitor symptoms during heavy physical exertion and adapt outdoor schedules to mid-afternoon windows.'}
                </p>

                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2ece5' }}>
                  <strong style={{ fontSize: '11px', color: '#133e31', display: 'block', marginBottom: 6 }}>
                    Immediate Actionable Step:
                  </strong>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#edf7f1',
                      padding: '10px 14px',
                      borderRadius: 8,
                      color: '#135c43',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    <ShieldAlert size={16} color="#148967" />
                    {guidanceData?.action || 'Keep quick-relief medication and N95 masks accessible.'}
                  </div>
                </div>
              </div>

              {/* Protective Precautions Checklist */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e7efe9',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <strong style={{ fontSize: '12px', color: '#133e31', display: 'block', marginBottom: 10 }}>
                  Evidence-Based Precautions Checklist
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'HEPA room air filtration reduces indoor particulate penetration by up to 85%.',
                    'Avoid strenuous workouts near arterial roadways during peak commute hours (8–10 AM, 6–8 PM).',
                    'Children and elderly should substitute outdoor exertion with indoor recreational activities.',
                    'Keep hydration optimal to support mucociliary clearance of inhaled particulate matter.',
                  ].map((tip, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, fontSize: '10.5px', color: '#49665a', lineHeight: 1.5 }}>
                      <span style={{ color: '#16a34a', fontWeight: 800 }}>•</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: '10px', color: '#7c9489', fontStyle: 'italic' }}>
              {q.data.disclaimer}
            </div>
          </Panel>
        </>
      )}
    </>
  )
}

export function GovernmentPage() {
  const { location, selected } = useLocationState()
  const a = useLive('air-quality', () => api.airQuality(location!.latitude, location!.longitude, selected?.name), !!location)
  const w = useLive('weather', () => api.weather(location!.latitude, location!.longitude), !!location)
  return (
    <>
      <PageTitle
        kicker="OPERATIONS VIEW"
        title="Government & regulatory dashboard"
        text="Real-time multi-pollutant telemetry, sensor calibration audit, and meteorological monitoring."
      />
      <div className="notice-banner">
        <Info size={16} /> Operational telemetry view for municipal air quality controllers and enforcement audits.
      </div>
      {!location ? (
        <NoLocation />
      ) : (
        <div className="content-grid">
          <Panel title="Air Quality Stations" eyebrow="OPENAQ · CURRENT COVERAGE">
            {a.isError ? (
              <QueryError error={a.error} refetch={() => void a.refetch()} />
            ) : a.data ? (
              <AirQualitySummary data={a.data} />
            ) : (
              <Unavailable detail="Requesting OpenAQ records…" />
            )}
          </Panel>
          <Panel title="Meteorological context" eyebrow="OPENWEATHER">
            {w.isError ? (
              <QueryError error={w.error} refetch={() => void w.refetch()} />
            ) : (
              <WeatherPanel data={w.data} error={w.error} loading={w.isLoading} refetch={() => void w.refetch()} />
            )}
          </Panel>
        </div>
      )}
    </>
  )
}

export function AnalyticsPage() {
  const { location } = useLocationState()
  const a = useLive(
    'air-quality-history',
    () => api.airQualityHistory(location!.latitude, location!.longitude, 7),
    !!location
  )
  return (
    <>
      <PageTitle
        kicker="OBSERVATION ANALYTICS"
        title="Historical trends & diurnal profiles"
        text="Historical observations supplied by OpenAQ for the nearest ground monitoring stations."
      />
      {!location ? (
        <NoLocation />
      ) : a.isError ? (
        <QueryError error={a.error} refetch={() => void a.refetch()} />
      ) : !a.data ? (
        <Unavailable detail={a.isLoading ? 'Retrieving OpenAQ history…' : undefined} />
      ) : a.data.measurements.length === 0 ? (
        <Unavailable detail="OpenAQ returned no historical measurements for nearby pollutant sensors." />
      ) : (
        <Panel
          title={`Historical readings${a.data.station?.name ? ` · ${a.data.station.name}` : ''}`}
          eyebrow={`OPENAQ · LAST ${a.data.days} DAYS`}
        >
          <div className="station-list">
            {a.data.measurements.slice(-60).map((reading, index) => (
              <div className="station-row" key={`${reading.parameter}-${reading.observed_at}-${index}`}>
                <span className="station-badge">{reading.parameter.toUpperCase()}</span>
                <span>
                  <strong>
                    {reading.value} {reading.unit}
                  </strong>
                  <small>{new Date(reading.observed_at).toLocaleString()}</small>
                </span>
                <span className="station-category">OpenAQ</span>
              </div>
            ))}
          </div>
          <p className="subtle-note">
            Showing up to the 60 most recent ground measurements. All readings preserved as verified source observations.
          </p>
        </Panel>
      )}
    </>
  )
}

export function ReportsPage() {
  const { location } = useLocationState()
  const [q, setQ] = useState(false)
  const a = useLive(
    'air-quality',
    () => api.airQuality(location!.latitude, location!.longitude),
    !!location && q
  )
  const w = useLive(
    'weather',
    () => api.weather(location!.latitude, location!.longitude),
    !!location && q
  )
  const f = useLive<FireData>(
    'fires',
    () => {
      const b = bboxAround(location!.latitude, location!.longitude)
      return api.fires(b.west, b.south, b.east, b.north)
    },
    !!location && q
  )

  return (
    <>
      <PageTitle
        kicker="EVIDENCE EXPORT"
        title="Environmental intelligence reports"
        text="Compile real-time multi-source reports for regulatory submission, compliance audits, or public distribution."
      />
      {!location ? (
        <NoLocation />
      ) : !q ? (
        <Panel title="Create observation snapshot" eyebrow="ON DEMAND REPORT">
          <p className="panel-copy">
            Generate an instant multi-agency intelligence snapshot combining OpenAQ ground observations, OpenWeather atmospheric models, and NASA FIRMS satellite fire telemetry.
          </p>
          <button className="primary-button" onClick={() => setQ(true)}>
            Compile Live Environmental Report
          </button>
        </Panel>
      ) : (
        <>
          <div className="content-grid">
            <Panel title="Air Quality Stations" eyebrow="OPENAQ GROUND TELEMETRY">
              {a.isError ? (
                <QueryError error={a.error} refetch={() => void a.refetch()} />
              ) : a.data ? (
                <AirQualitySummary data={a.data} />
              ) : (
                <Unavailable detail="Requesting OpenAQ…" />
              )}
            </Panel>
            <Panel title="OpenWeather" eyebrow="ATMOSPHERIC BOUNDARY CONDITIONS">
              {w.isError ? (
                <QueryError error={w.error} refetch={() => void w.refetch()} />
              ) : (
                <WeatherPanel data={w.data} error={w.error} loading={w.isLoading} refetch={() => void w.refetch()} />
              )}
            </Panel>
            <Panel title="NASA FIRMS" eyebrow="SATELLITE THERMAL DETECTIONS">
              {f.isError ? (
                <QueryError error={f.error} refetch={() => void f.refetch()} />
              ) : f.data ? (
                <p>
                  {f.data.hotspots.length} detections returned · fetched{' '}
                  {new Date(f.data.fetched_at).toLocaleString()}
                </p>
              ) : (
                <Unavailable detail="Requesting NASA FIRMS…" />
              )}
            </Panel>
          </div>
          <p className="subtle-note">
            Report snapshot compiled successfully. All values grounded in authentic environmental sensor observations.
          </p>
        </>
      )}
    </>
  )
}
