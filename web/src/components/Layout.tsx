import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, BarChart3,
  Settings, Bell, Plus,
} from 'lucide-react'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/cases',    icon: FolderOpen,       label: 'Cases' },
  { to: '/reports',  icon: BarChart3,        label: 'Reports' },
  { to: '/settings', icon: Settings,         label: 'Settings' },
]

const PAGE_TITLES: Record<string, string> = {
  '/':          'Dashboard',
  '/new-case':  'New Case',
  '/cases':     'Cases',
  '/reports':   'Reports',
  '/settings':  'Settings',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate  = useNavigate()

  const pageTitle = (() => {
    if (location.pathname.startsWith('/case/')) return 'Case Detail'
    return PAGE_TITLES[location.pathname] ?? 'ClaimIQ'
  })()

  return (
    <div className="flex min-h-screen w-full">
      {/* ── Sidebar ── */}
      <aside className="w-64 shrink-0 bg-white flex flex-col" style={{ borderRight: '1px solid #EBEBEB' }}>

        {/* Wordmark */}
        <div className="px-6 pt-7 pb-5">
          <p className="text-[26px] font-extrabold tracking-tight text-gray-900 leading-none select-none">
            ClaimIQ
          </p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5 tracking-widest uppercase">
            RCM Tool
          </p>
        </div>

        {/* New Case CTA */}
        <div className="px-4 mb-6">
          <button
            onClick={() => navigate('/new-case')}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-gray-700 transition-colors w-full justify-center"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Case
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 flex flex-col gap-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors
                ${isActive
                  ? 'bg-[#EEF2FF] text-[#1a3fcc]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.8} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 mt-4" style={{ borderTop: '1px solid #EBEBEB' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
              <span className="text-white text-[11px] font-bold">CG</span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 truncate leading-none">City Hospital</p>
              <p className="text-[11px] text-gray-400 mt-0.5">RCM Billing</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-[68px] bg-white flex items-center justify-between px-8 shrink-0" style={{ borderBottom: '1px solid #EBEBEB' }}>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {pageTitle}
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 font-medium">RCM Billing</span>

            <div style={{ width: 1, height: 20, background: '#E5E7EB' }} />

            <button className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell size={19} className="text-gray-600" strokeWidth={1.8} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>

            <div style={{ width: 1, height: 20, background: '#E5E7EB' }} />

            <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center cursor-pointer">
              <span className="text-white text-xs font-bold">CG</span>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
