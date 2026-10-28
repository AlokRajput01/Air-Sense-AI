import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { ToastProvider } from './components/ToastProvider'
import { LocationProvider } from './state/location'
import { AnalyticsPage, ExplainPage, FirePage, ForecastPage, GovernmentPage, HealthPage } from './components/EnterprisePages'
import { DashboardOverview } from './components/DashboardOverview'
import { MapExperience } from './components/MapExperience'
import { GreenNavPage } from './components/GreenNavPage'
import { ReportsPage } from './components/ReportsPage'
import { AlertsPage } from './components/AlertsPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })

export default function App() {
  return <QueryClientProvider client={queryClient}><ToastProvider><LocationProvider><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route element={<Shell/>}><Route index element={<DashboardOverview/>}/><Route path="map" element={<MapExperience/>}/><Route path="green-nav" element={<GreenNavPage/>}/><Route path="forecast" element={<ForecastPage/>}/><Route path="fire-intelligence" element={<FirePage/>}/><Route path="explainable-ai" element={<ExplainPage/>}/><Route path="health-risk" element={<HealthPage/>}/><Route path="government" element={<GovernmentPage/>}/><Route path="analytics" element={<AnalyticsPage/>}/><Route path="reports" element={<ReportsPage/>}/><Route path="alerts" element={<AlertsPage/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></BrowserRouter></LocationProvider></ToastProvider></QueryClientProvider>
}
