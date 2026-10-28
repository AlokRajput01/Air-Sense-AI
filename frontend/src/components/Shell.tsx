import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Bell,
  BrainCircuit,
  CloudSun,
  Flame,
  HeartPulse,
  Home,
  Map,
  Menu,
  Navigation,
  Shield,
  Sparkles,
  FileText,
  X,
} from 'lucide-react'
import { LocationForm } from './LocationForm'

const citizenNav = [
  { to: '/', label: 'Air Today', icon: Home },
  { to: '/green-nav', label: 'Green Nav Route', icon: Navigation },
  { to: '/map', label: 'Live Map', icon: Map },
  { to: '/forecast', label: '3-Day Forecast', icon: CloudSun },
  { to: '/alerts', label: 'Air Alerts', icon: Bell },
]

const authorityNav = [
  { to: '/government', label: 'Government DSS', icon: Shield },
  { to: '/analytics', label: 'Trends & Analytics', icon: BarChart3 },
  { to: '/fire-intelligence', label: 'NASA Fire Hotspots', icon: Flame },
  { to: '/explainable-ai', label: 'Explainable AI', icon: BrainCircuit },
  { to: '/health-risk', label: 'Health Risk', icon: HeartPulse },
  { to: '/reports', label: 'Export Reports', icon: FileText },
]

const allNav = [...citizenNav, ...authorityNav]

export function Shell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const active =
    allNav.find(item => (item.to === '/' ? location.pathname === '/' : location.pathname === item.to))
      ?.label || 'Air Today'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <Activity size={20} />
          </span>
          <div>
            <strong>
              AirSense <em>AI</em>
            </strong>
            <small>ENVIRONMENTAL INTELLIGENCE</small>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section 1: Citizen Everyday Tools */}
        <div className="workspace-label text-[9px] font-bold tracking-wider text-emerald-400/80 px-2.5 mb-1.5 uppercase">
          Citizen Essentials
        </div>
        <nav aria-label="Citizen navigation" className="mb-4">
          {citizenNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Section 2: Authority & Research Tools */}
        <div className="workspace-label text-[9px] font-bold tracking-wider text-emerald-400/80 px-2.5 mb-1.5 uppercase">
          Science & Policy
        </div>
        <nav aria-label="Authority navigation">
          {authorityNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer mt-auto">
          <div className="system-chip">
            <span className="live-dot" /> Live Sensors Connected
          </div>
          <small>
            OpenAQ · OpenWeather
            <br />
            NASA FIRMS Satellite
          </small>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>

          <div className="breadcrumb">
            <span>AirSense AI</span>
            <b>/</b>
            <strong>{active}</strong>
          </div>

          <div className="top-actions">
            <span className="provider-status">
              <i /> Providers Online
            </span>
            <NavLink className="icon-button" to="/alerts" aria-label="Open alerts">
              <Bell size={17} />
            </NavLink>
            <div className="avatar">AS</div>
          </div>
        </header>

        <section className="page-frame">
          <div className="global-location">
            <LocationForm />
          </div>
          <Outlet />
        </section>

        <footer className="footer-note">
          <span>
            <Sparkles size={13} /> Sourced from OpenAQ, OpenWeather & NASA FIRMS Satellites
          </span>
          <span>AirSense AI · Smart India Hackathon SIH26082</span>
        </footer>
      </main>
    </div>
  )
}
