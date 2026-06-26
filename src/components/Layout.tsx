import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Hem', end: true },
  { to: '/budtraning', label: 'Budträning', end: false },
  { to: '/budsystem', label: 'Budsystem', end: false },
  { to: '/installningar', label: 'Inställningar', end: false },
]

/** Appens ram: topbar med meny + ytan där varje sida visas (Outlet). */
export function Layout() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-emerald-800 text-white shadow">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xl font-bold">♠ Learn Bridge</span>
          <nav className="flex flex-wrap gap-1 sm:ml-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-white text-emerald-800' : 'hover:bg-white/10'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
