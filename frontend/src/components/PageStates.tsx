import { AlertTriangle, CheckCircle2, Clock3, Database, LoaderCircle, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

export function SkeletonCard({className=''}:{className?:string}) { return <div className={`skeleton-card ${className}`}><span/><span/><span/><span/></div> }
export function PageLoader(){ return <div className="page-loader"><div className="page-loader__orbit"><LoaderCircle size={28}/></div><strong>Preparing intelligence</strong><span>Aggregating source observations…</span></div> }
export function StateNotice({type='info',title,detail}:{type?:'info'|'error'|'success';title:string;detail:string}){ const Icon=type==='error'?AlertTriangle:type==='success'?CheckCircle2:Clock3; return <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`state-notice state-notice--${type}`}><span><Icon size={17}/></span><div><strong>{title}</strong><p>{detail}</p></div></motion.div> }
export function DataUnavailable({title='Data unavailable',detail,action}:{title?:string;detail:string;action?:React.ReactNode}){ return <div className="dataset-empty"><span><Database size={24}/></span><strong>{title}</strong><p>{detail}</p>{action}</div> }
export function RetryButton({onRetry}:{onRetry:()=>void}){ return <button className="retry-button" onClick={onRetry}><RefreshCw size={14}/> Retry request</button> }
