import { AnimatePresence } from 'framer-motion'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Toast } from './ui'

type ToastContextValue={show:(title:string,message:string)=>void}
const ToastContext=createContext<ToastContextValue|null>(null)
export function ToastProvider({children}:{children:ReactNode}) {
  const [toasts,setToasts]=useState<Array<{id:number;title:string;message:string}>>([])
  const show=(title:string,message:string)=>{const id=Date.now();setToasts(current=>[...current,{id,title,message}]);window.setTimeout(()=>setToasts(current=>current.filter(item=>item.id!==id)),4200)}
  return <ToastContext.Provider value={{show}}><>{children}<AnimatePresence>{toasts.map(toast=><Toast key={toast.id} title={toast.title} message={toast.message} onClose={()=>setToasts(current=>current.filter(item=>item.id!==toast.id))}/>)}</AnimatePresence></></ToastContext.Provider>
}
export function useToast(){const value=useContext(ToastContext);if(!value)throw new Error('useToast requires ToastProvider');return value}
