import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './map.css'
import type { Location, Hotspot, AirQualityStation } from '../types/api'
import { useLocationState } from '../state/location'
import { Flame, Layers, Wind, Eye, Sparkles } from 'lucide-react'

// US EPA 2024 revised standard breakpoints and colors
export const EPA_AQI_LEVELS = [
  { min: 0, max: 50, label: 'Good', color: '#10b981', textColor: '#064e3b' },
  { min: 51, max: 100, label: 'Moderate', color: '#eab308', textColor: '#713f12' },
  { min: 101, max: 150, label: 'Unhealthy for Sensitive', color: '#f97316', textColor: '#7c2d12' },
  { min: 151, max: 200, label: 'Unhealthy', color: '#ef4444', textColor: '#7f1d1d' },
  { min: 201, max: 300, label: 'Very Unhealthy', color: '#8b5cf6', textColor: '#4c1d95' },
  { min: 301, max: 500, label: 'Hazardous', color: '#881337', textColor: '#fff' },
]

export const getEpaColor = (aqi?: number | null) => {
  if (aqi == null) return '#64748b'
  if (aqi <= 50) return '#10b981'
  if (aqi <= 100) return '#eab308'
  if (aqi <= 150) return '#f97316'
  if (aqi <= 200) return '#ef4444'
  if (aqi <= 300) return '#8b5cf6'
  return '#881337'
}

export const getEpaCategory = (aqi?: number | null) => {
  if (aqi == null) return 'Unavailable'
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very Unhealthy'
  return 'Hazardous'
}

type PollutantFilter = 'aqi' | 'pm25' | 'pm10' | 'o3' | 'no2'

const fireIcon = new L.DivIcon({
  className: 'fire-pin-pulsing',
  html: '<span class="fire-glow"></span><span class="fire-core"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const validStations = (stations: AirQualityStation[]) =>
  stations.filter(s => s.coordinates.latitude != null && s.coordinates.longitude != null)

function ClickLocation() {
  const { setLocation } = useLocationState()
  useMapEvents({
    click(event) {
      setLocation({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })
  return null
}

function Recenter({ location }: { location: Location }) {
  const map = useMap()
  useEffect(() => {
    map.setView([location.latitude, location.longitude], map.getZoom())
  }, [location, map])
  return null
}

function StationMarkers({
  stations,
  pollutant,
  enableClustering,
}: {
  stations: AirQualityStation[]
  pollutant: PollutantFilter
  enableClustering: boolean
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({
    zoomend() {
      setZoom(map.getZoom())
    },
  })

  const getStationValue = (st: AirQualityStation): { val: number | null; display: string } => {
    if (pollutant === 'aqi') {
      return { val: st.aqi ?? null, display: st.aqi != null ? `AQI ${st.aqi}` : 'No AQI' }
    }
    const m = st.measurements[pollutant]
    if (m && m.value != null) {
      return { val: m.value, display: `${m.value} ${m.unit || 'µg/m³'}` }
    }
    return { val: null, display: '—' }
  }

  const groups = useMemo(() => {
    const valid = validStations(stations)
    if (!enableClustering) {
      return valid.map(s => [s])
    }
    const threshold = zoom >= 13 ? 24 : zoom >= 10 ? 36 : 48
    const output: AirQualityStation[][] = []
    for (const station of valid) {
      const position = L.latLng(station.coordinates.latitude!, station.coordinates.longitude!)
      const group = output.find(items => {
        const center = L.latLng(
          items.reduce((sum, item) => sum + item.coordinates.latitude!, 0) / items.length,
          items.reduce((sum, item) => sum + item.coordinates.longitude!, 0) / items.length
        )
        return map.latLngToLayerPoint(position).distanceTo(map.latLngToLayerPoint(center)) < threshold
      })
      if (!group) {
        output.push([station])
      } else {
        group.push(station)
      }
    }
    return output
  }, [map, stations, zoom, enableClustering])

  return (
    <>
      {groups.map((group, index) => {
        const center = L.latLng(
          group.reduce((sum, item) => sum + item.coordinates.latitude!, 0) / group.length,
          group.reduce((sum, item) => sum + item.coordinates.longitude!, 0) / group.length
        )

        if (group.length > 1) {
          const maxVal = Math.max(...group.map(item => item.aqi ?? 0))
          const color = getEpaColor(maxVal || null)
          return (
            <CircleMarker
              key={`cluster-${index}`}
              center={center}
              radius={Math.min(26, 12 + Math.log2(group.length) * 4)}
              pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: color, fillOpacity: 0.92 }}
              eventHandlers={{
                click: () =>
                  map.fitBounds(
                    L.latLngBounds(group.map(s => [s.coordinates.latitude!, s.coordinates.longitude!])),
                    { padding: [35, 35] }
                  ),
              }}
            >
              <Popup className="premium-map-popup">
                <div style={{ padding: '4px 6px' }}>
                  <strong style={{ fontSize: '12px', color: '#133e31' }}>{group.length} Clustered Stations</strong>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>
                    Peak AQI: <b style={{ color }}>{maxVal || 'N/A'}</b> ({getEpaCategory(maxVal)})
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 2 }}>Click cluster to expand zoom</div>
                </div>
              </Popup>
            </CircleMarker>
          )
        }

        const station = group[0]
        const { val } = getStationValue(station)
        const markerColor = pollutant === 'aqi' ? getEpaColor(val) : '#10b981'

        return (
          <CircleMarker
            key={station.id}
            center={[station.coordinates.latitude!, station.coordinates.longitude!]}
            radius={10}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: markerColor, fillOpacity: 0.94 }}
          >
            <Popup className="premium-map-popup">
              <div style={{ padding: '6px 8px', minWidth: 190 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <strong style={{ fontSize: '12px', color: '#0f2922' }}>{station.name}</strong>
                  <span
                    style={{
                      background: markerColor,
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 12,
                    }}
                  >
                    {station.aqi != null ? `AQI ${station.aqi}` : 'Live'}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: 2 }}>
                  {station.locality || 'OpenAQ Ground Sensor'}
                  {station.distance_km != null ? ` · ${station.distance_km.toFixed(1)} km` : ''}
                </div>
                <div
                  style={{
                    borderTop: '1px solid #e2e8f0',
                    marginTop: 6,
                    paddingTop: 6,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px 8px',
                    fontSize: '10px',
                  }}
                >
                  {Object.entries(station.measurements).map(([param, m]) => (
                    <div key={param}>
                      <span style={{ color: '#94a3b8', textTransform: 'uppercase' }}>{param}: </span>
                      <strong style={{ color: '#1e293b' }}>{m.value}</strong>
                    </div>
                  ))}
                </div>
                {station.aqi_note && (
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                    {station.aqi_note}
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

function HeatLayer({ stations, pollutant }: { stations: AirQualityStation[]; pollutant: PollutantFilter }) {
  const map = useMap()
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '350'
    map.getContainer().appendChild(canvas)

    const draw = () => {
      const size = map.getSize()
      const ratio = window.devicePixelRatio || 1
      canvas.width = size.x * ratio
      canvas.height = size.y * ratio
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, size.x, size.y)

      for (const station of validStations(stations)) {
        let val = station.aqi
        if (pollutant !== 'aqi') {
          val = station.measurements[pollutant]?.value ?? null
        }
        if (val == null) continue

        const point = map.latLngToContainerPoint([station.coordinates.latitude!, station.coordinates.longitude!])
        if (point.x < -120 || point.y < -120 || point.x > size.x + 120 || point.y > size.y + 120) continue

        const color = getEpaColor(val)
        const radius = Math.min(110, Math.max(50, 40 + (val / 500) * 80))
        const gradient = context.createRadialGradient(point.x, point.y, 4, point.x, point.y, radius)
        gradient.addColorStop(0, `${color}b3`)
        gradient.addColorStop(0.4, `${color}66`)
        gradient.addColorStop(0.75, `${color}22`)
        gradient.addColorStop(1, `${color}00`)

        context.fillStyle = gradient
        context.beginPath()
        context.arc(point.x, point.y, radius, 0, Math.PI * 2)
        context.fill()
      }
    }

    map.on('moveend zoomend resize', draw)
    draw()
    return () => {
      map.off('moveend zoomend resize', draw)
      canvas.remove()
    }
  }, [map, stations, pollutant])
  return null
}

// Fluid wind streamlines particle layer
function WindStreamlineLayer({ active }: { active: boolean }) {
  const map = useMap()
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return

    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '360'
    map.getContainer().appendChild(canvas)

    const particles: { x: number; y: number; speed: number; length: number; alpha: number; age: number; maxAge: number }[] = []
    const PARTICLE_COUNT = 85

    const resetParticle = (p: (typeof particles)[0], width: number, height: number) => {
      p.x = Math.random() * width
      p.y = Math.random() * height
      p.speed = 1.2 + Math.random() * 2.2
      p.length = 10 + Math.random() * 18
      p.alpha = 0.2 + Math.random() * 0.55
      p.age = 0
      p.maxAge = 40 + Math.random() * 50
    }

    const init = () => {
      const size = map.getSize()
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = { x: 0, y: 0, speed: 0, length: 0, alpha: 0, age: 0, maxAge: 0 }
        resetParticle(p, size.x, size.y)
        p.age = Math.random() * p.maxAge
        particles.push(p)
      }
    }

    init()

    const animate = () => {
      const size = map.getSize()
      const ratio = window.devicePixelRatio || 1
      canvas.width = size.x * ratio
      canvas.height = size.y * ratio
      const ctx = canvas.getContext('2d')

      if (ctx) {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.clearRect(0, 0, size.x, size.y)

        // Northwest to Southeast typical Indo-Gangetic airflow angle (approx 35 degrees)
        const angle = 0.58
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        ctx.lineWidth = 1.8
        ctx.lineCap = 'round'

        for (const p of particles) {
          p.age++
          if (p.age > p.maxAge || p.x > size.x + 30 || p.y > size.y + 30) {
            resetParticle(p, size.x, size.y)
          }

          p.x += cos * p.speed
          p.y += sin * p.speed

          const headX = p.x
          const headY = p.y
          const tailX = p.x - cos * p.length
          const tailY = p.y - sin * p.length

          const grad = ctx.createLinearGradient(tailX, tailY, headX, headY)
          grad.addColorStop(0, `rgba(56, 189, 248, 0)`)
          grad.addColorStop(1, `rgba(56, 189, 248, ${p.alpha})`)

          ctx.strokeStyle = grad
          ctx.beginPath()
          ctx.moveTo(tailX, tailY)
          ctx.lineTo(headX, headY)
          ctx.stroke()
        }
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      canvas.remove()
    }
  }, [map, active])

  return null
}

export function MapView({
  location,
  fires = [],
  stations = [],
}: {
  location: Location
  fires?: Hotspot[]
  stations?: AirQualityStation[]
}) {
  const [showHeat, setShowHeat] = useState(true)
  const [showFires, setShowFires] = useState(true)
  const [showWind, setShowWind] = useState(true)
  const [enableClustering, setEnableClustering] = useState(true)
  const [pollutant, setPollutant] = useState<PollutantFilter>('aqi')

  return (
    <div className="map-wrap premium-map-wrap">
      <MapContainer
        center={[location.latitude, location.longitude]}
        zoom={9}
        scrollWheelZoom
        className="leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Recenter location={location} />
        <ClickLocation />

        {/* Dynamic Wind Streamline Fluid Layer */}
        <WindStreamlineLayer active={showWind} />

        {/* Heatmap Layer */}
        {showHeat && <HeatLayer stations={stations} pollutant={pollutant} />}

        {/* Selected User Location Marker */}
        <Marker position={[location.latitude, location.longitude]}>
          <Popup className="premium-map-popup">
            <div style={{ padding: '4px 6px' }}>
              <strong style={{ color: '#0f2922', fontSize: '11px' }}>Pinned Location</strong>
              <div style={{ color: '#64748b', fontSize: '10px' }}>
                {location.latitude.toFixed(4)}°N, {location.longitude.toFixed(4)}°E
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Air Quality Stations / Clusters */}
        <StationMarkers stations={stations} pollutant={pollutant} enableClustering={enableClustering} />

        {/* NASA FIRMS Active Fire Hotspots Layer */}
        {showFires &&
          fires.map(f => {
            const radius =
              f.fire_radiative_power_mw == null
                ? 300
                : Math.min(3000, Math.max(350, f.fire_radiative_power_mw * 80))
            return (
              <Fragment key={f.source_id}>
                <Circle
                  center={[f.latitude, f.longitude]}
                  radius={radius}
                  pathOptions={{
                    color: '#dc2626',
                    weight: 1.5,
                    fillColor: '#ef4444',
                    fillOpacity: 0.18,
                  }}
                />
                <Marker position={[f.latitude, f.longitude]} icon={fireIcon}>
                  <Popup className="premium-map-popup">
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626' }}>
                        <Flame size={14} />
                        <strong style={{ fontSize: '12px' }}>NASA FIRMS Detection</strong>
                      </div>
                      <div style={{ fontSize: '10px', color: '#475569', marginTop: 4 }}>
                        FRP: <b>{f.fire_radiative_power_mw != null ? `${f.fire_radiative_power_mw} MW` : 'N/A'}</b>
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: 2 }}>
                        Acquired: {new Date(f.acquired_at).toLocaleString()}
                        <br />
                        Confidence: {f.confidence || 'Nominal'} · Satellite: {f.satellite || 'VIIRS'}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </Fragment>
            )
          })}
      </MapContainer>

      {/* Glassmorphic Layer & Filter Controls */}
      <div className="map-glass-controls">
        <div className="map-glass-header">
          <span className="glass-title">
            <Layers size={13} /> Map Layers & Sensors
          </span>
          <div className="pollutant-filter-pills">
            {(['aqi', 'pm25', 'pm10', 'o3', 'no2'] as PollutantFilter[]).map(p => (
              <button
                key={p}
                className={`filter-pill ${pollutant === p ? 'active' : ''}`}
                onClick={() => setPollutant(p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="layer-toggle-row">
          <label className={`toggle-btn ${showHeat ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={showHeat}
              onChange={e => setShowHeat(e.target.checked)}
              style={{ display: 'none' }}
            />
            <Sparkles size={11} /> Heatmap
          </label>

          <label className={`toggle-btn ${enableClustering ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={enableClustering}
              onChange={e => setEnableClustering(e.target.checked)}
              style={{ display: 'none' }}
            />
            <Eye size={11} /> Clustering
          </label>

          <label className={`toggle-btn ${showFires ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={showFires}
              onChange={e => setShowFires(e.target.checked)}
              style={{ display: 'none' }}
            />
            <Flame size={11} /> FIRMS Fires ({fires.length})
          </label>

          <label className={`toggle-btn ${showWind ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={showWind}
              onChange={e => setShowWind(e.target.checked)}
              style={{ display: 'none' }}
            />
            <Wind size={11} /> Wind Field
          </label>
        </div>

        {/* Official US EPA 6-Level AQI Legend */}
        <div className="epa-aqi-scale">
          {EPA_AQI_LEVELS.map(lvl => (
            <div key={lvl.label} className="scale-item" title={`${lvl.min}-${lvl.max}: ${lvl.label}`}>
              <span className="scale-swatch" style={{ background: lvl.color }} />
              <span className="scale-range">{lvl.min === 301 ? '301+' : `${lvl.min}–${lvl.max}`}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="map-attribution">
        US EPA AQI Standard · Real-time OpenAQ Sensors · NASA FIRMS Thermal Anomalies
      </div>
    </div>
  )
}
