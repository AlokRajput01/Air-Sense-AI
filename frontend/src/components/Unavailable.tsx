import { motion } from 'framer-motion'
import { RefreshCw, WifiOff } from 'lucide-react'
export function Unavailable({ detail, retry }: { detail?: string; retry?: () => void }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="empty-state">
    <span className="empty-icon"><WifiOff size={19} /></span><strong>Data Currently Unavailable</strong>
    <p>{detail || 'A live source has not returned usable data for this view.'}</p>
    {retry && <button className="retry-button" onClick={retry}><RefreshCw size={14} /> Retry request</button>}
  </motion.div>
}
