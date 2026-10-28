import type { ReactNode } from 'react'
export function Metric({ label, value, unit, icon }: { label: string; value: string | number; unit?: string; icon: ReactNode }) {
  return <article className="metric-card"><div className="metric-heading"><span>{label}</span><i>{icon}</i></div><div className="metric-value">{value}<small>{unit}</small></div></article>
}
