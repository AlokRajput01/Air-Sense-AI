import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bell, BellRing, Check, CircleHelp, MapPin, Settings2 } from 'lucide-react'
import { api } from '../api/client'
import { useLocationState } from '../state/location'
import type { AirQuality } from '../types/api'

type RuleId = 'aqi' | 'pm25'
type AlertRule = { enabled: boolean; threshold: number }
type AlertRules = Record<RuleId, AlertRule>
const STORAGE_KEY = 'airsense.alertRules.v1'
const DEFAULT_RULES: AlertRules = {
  aqi: { enabled: true, threshold: 100 },
  pm25: { enabled: true, threshold: 35 },
}
const RULE_INFO: Record<RuleId, { label: string; detail: string; unit: string }> = {
  aqi: { label: 'Air Quality Index', detail: 'Alert when the reported AQI reaches this level.', unit: 'AQI' },
  pm25: { label: 'PM2.5 concentration', detail: 'Alert when fine particle concentration reaches this level.', unit: 'µg/m³' },
}

function loadRules(): AlertRules {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<AlertRules> | null
    if (!stored) return DEFAULT_RULES
    return {
      aqi: { ...DEFAULT_RULES.aqi, ...stored.aqi },
      pm25: { ...DEFAULT_RULES.pm25, ...stored.pm25 },
    }
  } catch {
    return DEFAULT_RULES
  }
}

function valueFor(data: AirQuality, id: RuleId) {
  return id === 'aqi' ? data.aqi : data.pm25
}

export function AlertsPage() {
  const { location, selected } = useLocationState()
  const [rules, setRules] = useState<AlertRules>(loadRules)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  )
  const notified = useRef(new Set<string>())
  const air = useQuery({
    queryKey: ['alerts-air-quality', location?.latitude, location?.longitude, selected?.name],
    queryFn: () => api.airQuality(location!.latitude, location!.longitude, selected?.name),
    enabled: Boolean(location),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  })

  const activeAlerts = useMemo(() => {
    if (!air.data) return []
    return (Object.keys(rules) as RuleId[]).flatMap(id => {
      const rule = rules[id]
      const value = valueFor(air.data, id)
      return rule.enabled && value !== null && Number.isFinite(value) && value >= rule.threshold
        ? [{ id, value, threshold: rule.threshold, ...RULE_INFO[id] }]
        : []
    })
  }, [air.data, rules])

  useEffect(() => {
    if (permission !== 'granted' || !air.data || activeAlerts.length === 0) return
    const observedAt = air.data.timestamp || air.data.fetched_at
    activeAlerts.forEach(alert => {
      const key = `${location?.latitude}:${location?.longitude}:${alert.id}:${observedAt}`
      if (notified.current.has(key)) return
      notified.current.add(key)
      if (notified.current.size > 40) notified.current.delete(notified.current.values().next().value as string)
      new Notification(`AirSense alert: ${alert.label}`, {
        body: `${selected?.name || 'Selected location'} — ${alert.value} ${alert.unit} (your threshold: ${alert.threshold} ${alert.unit}).`,
        tag: key,
      })
    })
  }, [activeAlerts, air.data, location, permission, selected?.name])

  function updateRule(id: RuleId, changes: Partial<AlertRule>) {
    setRules(current => {
      const next = { ...current, [id]: { ...current[id], ...changes } }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* Alerts remain usable for this session. */ }
      return next
    })
  }

  async function enableNotifications() {
    if (permission === 'unsupported') return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  return <div className="alerts-page">
    <div className="page-title">
      <div><span className="eyebrow">PERSONAL AIR QUALITY MONITORING</span><h1>Alerts</h1><p>Choose the air quality levels you want to watch at your selected location.</p></div>
      <span className="updated-pill"><i /> Saved on this device</span>
    </div>

    {activeAlerts.length > 0 && <section className="alerts-active" aria-live="polite">
      <div className="alerts-active__icon"><AlertTriangle size={20}/></div>
      <div className="alerts-active__body"><strong>{activeAlerts.length} alert{activeAlerts.length === 1 ? '' : 's'} active</strong><p>{activeAlerts.map(alert => `${alert.label}: ${alert.value} ${alert.unit}`).join(' · ')}</p><small>Based on the latest available reading{air.data?.timestamp ? ` from ${new Date(air.data.timestamp).toLocaleString()}` : ''}.</small></div>
    </section>}

    <div className="alerts-layout">
      <section className="panel alerts-rules">
        <div className="panel-header"><div><span className="eyebrow">THRESHOLDS</span><h2>Alert rules</h2></div><Settings2 size={17} color="#779184"/></div>
        {(Object.keys(RULE_INFO) as RuleId[]).map(id => {
          const rule = rules[id]
          const reading = air.data ? valueFor(air.data, id) : null
          return <div className="alert-rule" key={id}>
            <div className="alert-rule__top"><div><strong>{RULE_INFO[id].label}</strong><small>{RULE_INFO[id].detail}</small></div><label className="alert-toggle"><input type="checkbox" checked={rule.enabled} onChange={event => updateRule(id, { enabled: event.target.checked })}/><span/><b>{rule.enabled ? 'On' : 'Off'}</b></label></div>
            <div className="alert-rule__controls"><label htmlFor={`${id}-threshold`}>Notify me at or above</label><div><input id={`${id}-threshold`} type="number" min="0" step={id === 'aqi' ? '1' : '0.1'} value={rule.threshold} onChange={event => updateRule(id, { threshold: Math.max(0, Number(event.target.value)) })} disabled={!rule.enabled}/><span>{RULE_INFO[id].unit}</span></div><small>{reading === null || reading === undefined ? 'Current reading unavailable' : `Current reading: ${reading} ${RULE_INFO[id].unit}`}</small></div>
          </div>
        })}
        <p className="alerts-source-note"><CircleHelp size={14}/> Alerts use the latest provider reading. Missing or stale readings do not trigger alerts.</p>
      </section>

      <section className="panel alerts-delivery">
        <div className="panel-header"><div><span className="eyebrow">DELIVERY</span><h2>Browser notifications</h2></div><Bell size={17} color="#779184"/></div>
        <p>Get a desktop notification when a new reading crosses one of your enabled thresholds. Keep AirSense open to check for new readings.</p>
        <div className="notification-status">
          <span className={`notification-status__icon notification-status__icon--${permission}`}>
            {permission === 'granted' ? <Check size={17}/> : <BellRing size={17}/>}
          </span>
          <div><strong>{permission === 'granted' ? 'Notifications enabled' : permission === 'denied' ? 'Notifications blocked' : permission === 'unsupported' ? 'Not supported in this browser' : 'Notifications are off'}</strong><small>{permission === 'denied' ? 'Allow notifications for this site in your browser settings.' : permission === 'granted' ? 'You’ll be notified when an incoming reading crosses a threshold.' : permission === 'unsupported' ? 'You can still see active alerts here while the app is open.' : 'Permission is requested only when you choose to enable them.'}</small></div>
        </div>
        {permission !== 'granted' && permission !== 'denied' && permission !== 'unsupported' && <button className="primary-button alerts-enable" onClick={enableNotifications}><Bell size={15}/> Enable browser notifications</button>}
        <div className="alerts-location"><MapPin size={15}/><span><small>WATCHING LOCATION</small><strong>{selected?.name || (location ? `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}` : 'Choose a location above')}</strong></span></div>
      </section>
    </div>

    <section className="panel alerts-current">
      <div className="panel-header"><div><span className="eyebrow">LIVE STATUS</span><h2>Current conditions</h2></div><button className="retry-button" onClick={() => void air.refetch()} disabled={air.isFetching}>{air.isFetching ? 'Updating…' : 'Refresh'}</button></div>
      {!location ? <div className="alerts-empty"><MapPin size={19}/><strong>Select a location to monitor</strong><p>Use the location search above to load nearby air quality readings.</p></div>
        : air.isLoading ? <div className="loading-state">Loading the latest air quality reading…</div>
          : air.error ? <div className="alerts-empty"><CircleHelp size={19}/><strong>Air quality data unavailable</strong><p>{air.error.message}. Alerts will resume when a provider reading is available.</p></div>
            : <div className="alerts-readings">
              <div><span>Air Quality Index</span><strong>{air.data?.aqi ?? '—'} <small>AQI</small></strong><em>{air.data?.aqi_note || 'Reported by provider'}</em></div>
              <div><span>PM2.5</span><strong>{air.data?.pm25 ?? '—'} <small>µg/m³</small></strong><em>{air.data?.station || 'Nearest available station'}</em></div>
              <div><span>Observation time</span><strong className="alerts-time">{air.data?.timestamp ? new Date(air.data.timestamp).toLocaleString() : 'Unavailable'}</strong><em>{air.data?.source || 'Provider data'}</em></div>
            </div>}
    </section>
  </div>
}
