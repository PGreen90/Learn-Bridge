import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { currentTheme, toggleTheme } from '../lib/theme'
import { BrandMark, Wordmark } from './BrandMark'

const NAV = [
  { to: '/', label: 'Hem', end: true },
  { to: '/budtraning', label: 'Budträning', end: false },
  { to: '/budvisning', label: 'Budvisning', end: false },
  { to: '/spela-kort', label: 'Spela kort', end: false },
  { to: '/budsystem', label: 'Budsystem', end: false },
  { to: '/installningar', label: 'Inställningar', end: false },
]

/** Appens ram: topbar med meny + ytan där varje sida visas (Outlet).
 *  På mobil (< 640 px) döljs länkraden bakom en ☰-knapp som fäller ut menyn;
 *  på större skärmar visas länkarna i rad som vanligt. */
export function Layout() {
  const [theme, setTheme] = useState(currentTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Ljust/mörkt läge: månen tänder mörkret, solen släcker det.
  const themeButton = (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-base hover:bg-white/10 transition-colors"
      aria-label={theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
      title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )

  function navLinkClass(isActive: boolean): string {
    return `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-white text-emerald-800' : 'hover:bg-white/10'
    }`
  }

  return (
    <div className="min-h-screen bg-club-50 text-slate-900 dark:bg-club-950 dark:text-slate-100">
      {/* Guldlinjen under sidhuvudet följer med på VARJE flik = klubbtemat.
          Toppmarginalen = safe-area-inset-top: i PWA-helskärm på iPhone ligger
          innehållet annars under statusraden (klocka/batteri) – marginalen skjuter
          ner sidhuvudet och låter det emerald-gröna fylla ut bakom statusraden.
          Blir 0 i vanlig webbläsare, så inget ändras där. */}
      <header className="border-b border-gold-400/40 bg-emerald-900 text-white shadow dark:bg-club-900 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logotypen + inramade ordmärket (guldserif, spader-prick på i:et). */}
          <NavLink to="/" className="flex items-center gap-2 whitespace-nowrap">
            <BrandMark className="h-7 w-7" />
            <Wordmark framed className="text-xl" />
          </NavLink>

          {/* Större skärmar: alla länkar i rad. */}
          <nav className="hidden sm:flex flex-wrap items-center gap-1 ml-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                {item.label}
              </NavLink>
            ))}
            {themeButton}
          </nav>

          {/* Mobil: temaknappen + ☰ som fäller ut menyn. */}
          <div className="ml-auto flex items-center gap-1 sm:hidden">
            {themeButton}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-white/10 transition-colors"
              aria-label={menuOpen ? 'Stäng menyn' : 'Öppna menyn'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobil: den utfällda menyn – stängs när man valt en sida. */}
        {menuOpen && (
          <nav className="sm:hidden border-t border-white/15 px-4 pb-3 pt-2 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `block ${navLinkClass(isActive)}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      {/* Mobil: mindre luft + safe-area-marginal i botten så iPhones egna
          gränssnitt (verktygsfältet/hemindikatorn) aldrig täcker korten. */}
      <main className="max-w-3xl mx-auto px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:py-8">
        {/* key per adress → innehållet tonar in vid varje sidbyte (page-in). */}
        <div key={location.pathname} className="page-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
