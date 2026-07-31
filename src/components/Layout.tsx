import { Suspense, useState } from 'react'
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

/** Diskret laddningsindikator medan en lat-laddad sida hämtas. En snurrande
 *  emerald-ring, centrerad i innehållsytan. */
function PageLoading() {
  return (
    <div className="flex justify-center py-24" role="status" aria-label="Laddar sidan">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-500" />
    </div>
  )
}

/** Appens ram: topbar med meny + ytan där varje sida visas (Outlet).
 *  På mobil (< 640 px) döljs länkraden bakom en ☰-knapp som fäller ut menyn;
 *  på större skärmar visas länkarna i rad som vanligt. */
export function Layout() {
  const [theme, setTheme] = useState(currentTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  // Spelbordet går "full-bleed": duken fyller hela skärmen edge-to-edge utan ram
  // eller marginal (ägarbeslut 2026-07-31). Övriga sidor behåller den centrerade,
  // paddade spalten.
  const immersive = location.pathname === '/spela-kort'

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
    // Aktiv flik: diskret guldmarkering (mjuk guldton + guldtext + fin guldkant)
    // i stället för den skrikiga vita pillen (ägarbeslut 2026-07-31). Inaktiva
    // länkar något dämpade så den aktiva sticker ut lugnt; guldton vid hover.
    return `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gold-400/15 text-gold-100 ring-1 ring-inset ring-gold-400/30'
        : 'text-white/80 hover:bg-white/10 hover:text-gold-100'
    }`
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Guldlinjen under sidhuvudet följer med på VARJE flik = klubbtemat.
          Toppmarginalen = safe-area-inset-top: i PWA-helskärm på iPhone ligger
          innehållet annars under statusraden (klocka/batteri) – marginalen skjuter
          ner sidhuvudet och låter det emerald-gröna fylla ut bakom statusraden.
          Blir 0 i vanlig webbläsare, så inget ändras där. */}
      {/* Spelbordet är helt immersivt (ägarbeslut 2026-07-31): ingen menyrad —
          man tar sig ut via "Avsluta spel" i ⋮-menyn. Övriga sidor har headern. */}
      {!immersive && (
      <header className="border-b border-gold-400/40 bg-brand-bar text-white shadow pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logotypen + ordmärket (tvåfärgat guldserif-skimmer, spader-prick på
              i:et, frameless). "re"/"z" ärver text-white från baren. */}
          <NavLink to="/" className="flex items-center gap-2 whitespace-nowrap">
            <BrandMark bare className="h-7 w-7" />
            <Wordmark className="text-xl" />
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
      )}
      {/* Mobil: mindre luft + safe-area-marginal i botten så iPhones egna
          gränssnitt (verktygsfältet/hemindikatorn) aldrig täcker korten. */}
      {/* Säkra zoner: topp-insättningen ligger på sidhuvudet, botten här. Vänster/
          höger via max(1rem, inset) så innehållet aldrig hamnar under ett sidourtag
          eller rundat hörn i liggande läge — och aldrig mindre än den vanliga
          1rem-marginalen i stående (där sidoinsättningen är 0). */}
      <main
        className={
          immersive
            ? 'w-full'
            : 'max-w-3xl mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:py-8'
        }
      >
        {/* key per adress → innehållet tonar in vid varje sidbyte (page-in). */}
        <div key={location.pathname} className="page-in">
          {/* Sidorna laddas lat (route-baserad kod-uppdelning, konkurrensplanen
              Fas 0 c): varje sida är en egen JS-chunk som hämtas först när man
              går dit. Fallbacken visas de bråkdelar av en sekund det tar första
              gången — menyramen ovanför står kvar hela tiden. */}
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
