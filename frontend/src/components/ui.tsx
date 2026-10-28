import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageMotion({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }} className={className}>{children}</motion.div>
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="section-actions">{action}</div>}</div>
}

export function Panel({ children, className = '', title, eyebrow, action, compact = false }: { children: ReactNode; className?: string; title?: string; eyebrow?: string; action?: ReactNode; compact?: boolean }) {
  return <motion.section whileHover={{ y: -2 }} transition={{ duration: 0.2 }} className={`surface-panel ${compact ? 'surface-panel--compact' : ''} ${className}`}><div className="surface-panel__header">{(title || eyebrow) && <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h2>{title}</h2>}</div>}{action && <div>{action}</div>}</div>{children}</motion.section>
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const normalized = status.toLowerCase()
  const tone = normalized.includes('good') || normalized.includes('low') ? 'positive' : normalized.includes('moderate') || normalized.includes('high') ? 'warning' : normalized.includes('critical') || normalized.includes('poor') ? 'danger' : 'neutral'
  return <span className={`status-pill status-pill--${tone}`}>{label || status}</span>
}

export function MetricCard({ label, value, unit, icon, trend, tone = 'green', loading = false }: { label: string; value: string | number; unit?: string; icon: ReactNode; trend?: string; tone?: 'green' | 'blue' | 'amber' | 'rose'; loading?: boolean }) {
  return <motion.article whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className={`metric-card metric-card--${tone}`}><div className="metric-card__top"><span>{label}</span><span className="metric-card__icon">{icon}</span></div>{loading ? <div className="metric-card__skeleton"/> : <><strong>{value}{unit && <small>{unit}</small>}</strong>{trend && <span className="metric-card__trend">{trend}</span>}</>}</motion.article>
}

export function AQIGauge({ value, category, size = 190 }: { value?: number | null; category?: string; size?: number }) {
  const safe = value ?? 0
  const tone = safe <= 50 ? '#22c55e' : safe <= 100 ? '#84cc16' : safe <= 200 ? '#f4b942' : safe <= 300 ? '#f97316' : '#ef4444'
  const circumference = 2 * Math.PI * 74
  const offset = circumference * (1 - Math.min(safe, 500) / 500)
  return <div className="aqi-gauge" style={{ width: size, height: size }}><svg viewBox="0 0 180 180" role="img" aria-label={`AQI ${value ?? 'unavailable'}`}><circle cx="90" cy="90" r="74" className="aqi-gauge__track"/><motion.circle cx="90" cy="90" r="74" className="aqi-gauge__value" stroke={tone} strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.2, ease: 'easeOut' }}/></svg><div className="aqi-gauge__content"><span>AQI</span><strong>{value ?? '—'}</strong><small>{category || 'Awaiting data'}</small></div></div>
}

export function Sparkline({ data, color = '#22c55e', height = 42 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return <span className="sparkline sparkline--empty" />
  const width = 120; const max = Math.max(...data); const min = Math.min(...data); const range = max - min || 1
  const points = data.map((value, index) => `${(index / Math.max(data.length - 1, 1)) * width},${height - ((value - min) / range) * (height - 5) - 2}`).join(' ')
  return <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><polyline points={`${points} ${width},${height} 0,${height}`} fill={color} fillOpacity=".08" stroke="none"/></svg>
}

export function LoadingPanel({ rows = 4 }: { rows?: number }) { return <div className="loading-panel" aria-label="Loading data"><div className="loading-panel__shimmer"/><div className="loading-panel__shimmer"/><div className="loading-panel__shimmer"/>{Array.from({ length: Math.max(0, rows - 3) }).map((_, index) => <div key={index} className="loading-panel__shimmer"/>)}</div> }
export function EmptyState({ title = 'No data available', description, action }: { title?: string; description: string; action?: ReactNode }) { return <div className="state-card state-card--empty"><span><Info size={20}/></span><strong>{title}</strong><p>{description}</p>{action}</div> }
export function ErrorState({ title = 'Data unavailable', description, retry }: { title?: string; description: string; retry?: () => void }) { return <div className="state-card state-card--error"><span><AlertCircle size={20}/></span><strong>{title}</strong><p>{description}</p>{retry && <button onClick={retry}><RefreshCw size={14}/> Retry</button>}</div> }
export function NetworkState({ loading, error, retry, children }: { loading: boolean; error?: unknown; retry?: () => void; children: ReactNode }) { if (loading) return <LoadingPanel/>; if (error) return <ErrorState description={error instanceof Error ? error.message : 'The live data source could not be reached.'} retry={retry}/>; return children }
export function Toast({ title, message, onClose }: { title: string; message: string; onClose: () => void }) { return <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="toast"><span><CheckCircle2 size={18}/></span><div><strong>{title}</strong><p>{message}</p></div><button onClick={onClose} aria-label="Dismiss notification">×</button></motion.div> }
export function LoadingSpinner({ size = 18 }: { size?: number }) { return <LoaderCircle size={size} className="spin"/> }
export function DataNote({ children }: { children: ReactNode }) { return <div className="data-note"><WifiOff size={14}/><span>{children}</span></div> }
