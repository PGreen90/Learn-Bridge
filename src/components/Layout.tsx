import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { currentTheme, toggleTheme } from '../lib/theme'
import { NY_VERSION_EVENT, type NyVersionDetail } from '../lib/sw-events'
import { BrandMark, Wordmark } from './BrandMark'
import { useAuth } from './AuthProvider'
// Versionsnumret i sidfoten läses ur package.json — EN sanning, aldrig
// hårdkodat i UI:t (ägarbeslut 2026-08-02: © + grundår + version i sidfoten).
import pkg from '../../package.json'

const NAV = [
  { to: '/', label: 'Hem', end: true },
  { to: '/budtraning', label: 'Budträning', end: false },
  { to: '/budvisning', label: 'Budvisning', end: false },
  { to: '/spela-kort', label: 'Spela kort', end: false },
  { to: '/spela-med-vanner', label: 'Spela med vänner', end: false },
  { to: '/budsystem', label: 'Budsystem', end: false },
  { to: '/installningar', label: 'Inställningar', end: false },
]

/** Diskret laddningsindikator medan en lat-laddad sida hämtas: guldspadern
 *  som andas mjukt (faceliften 2026-08-02 — ersatte den generiska snurrande
 *  ringen; sådana detaljer gör "app" av en webbsida). */
function PageLoading() {
  return (
    <div className="flex justify-center py-24" role="status" aria-label="Laddar sidan">
      <BrandMark bare className="gold-pulse h-10 w-10" />
    </div>
  )
}

/** Appens ram: topbar med meny + ytan där varje sida visas (Outlet).
 *  På mobil (< 640 px) döljs länkraden bakom en ☰-knapp som fäller ut menyn;
 *  på större skärmar visas länkarna i rad som vanligt. */
export function Layout() {
  const [theme, setTheme] = useState(currentTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  // "Ny version finns"-raden (Etapp A 2026-08-02): pwa-update.ts skickar en
  // window-händelse när en ny version av appen väntar. null = ingen rad.
  const [nyVersion, setNyVersion] = useState<NyVersionDetail | null>(null)
  useEffect(() => {
    const onNyVersion = (e: Event) => {
      setNyVersion((e as CustomEvent<NyVersionDetail>).detail)
    }
    window.addEventListener(NY_VERSION_EVENT, onNyVersion)
    return () => window.removeEventListener(NY_VERSION_EVENT, onNyVersion)
  }, [])
  // Kontot (Beslut B etapp 1): topbaren visar "Logga in" när man är utloggad,
  // och visningsnamnet (→ Mitt konto) när man är inloggad. Under laddningen
  // visas inget så det inte blinkar till fel läge.
  const { loading: authLoading, signedIn, profile } = useAuth()

  const location = useLocation()
  // Spelbordet går "full-bleed": duken fyller hela skärmen edge-to-edge utan ram
  // eller marginal (ägarbeslut 2026-07-31). Övriga sidor behåller den centrerade,
  // paddade spalten.
  // startsWith: även Dagens giv (/spela-kort/dagens) spelas i helskärm.
  // /bord/ = vänner-bordet (Beslut B etapp 4) — samma helskärm, vinröd duk.
  const immersive =
    location.pathname.startsWith('/spela-kort') || location.pathname.startsWith('/bord/')

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

  function menuLinkClass(isActive: boolean): string {
    // Glasmenyns länkar (2026-08-02): EGEN färgsättning skild från emerald-
    // barens vita — iOS-materialens grej är mörk text på ljust glas (ljust
    // läge) resp. ljus text på mörkt glas. text-ink följer läget via tokens.
    return `block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gold-400/20 text-gold-700 ring-1 ring-inset ring-gold-400/30 dark:text-gold-200'
        : 'text-ink hover:bg-hover-veil'
    }`
  }

  // Kontopillret i topbaren: guldkantad så det står lugnt skilt från de vita
  // navlänkarna. Samma stil för "Logga in" och för visningsnamnet.
  function accountPillClass(isActive: boolean): string {
    return `ml-1 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-gold-400/40 transition-colors ${
      isActive ? 'bg-gold-400/15 text-gold-100' : 'text-white/90 hover:bg-white/10 hover:text-gold-100'
    }`
  }

  // Kontots mål + etikett beror på inloggningsläget.
  const accountTo = signedIn ? '/konto' : '/logga-in'
  const accountLabel = signedIn ? (profile?.display_name ?? 'Mitt konto') : 'Logga in'

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
      <header className="relative border-b border-gold-400/40 bg-brand-bar text-white shadow pt-[env(safe-area-inset-top)]">
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
            {!authLoading && (
              <NavLink
                to={accountTo}
                className={({ isActive }) => accountPillClass(isActive)}
              >
                {accountLabel}
              </NavLink>
            )}
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

        {/* Mobil: den utfällda menyn (faceliften 2026-08-02, "iphone glass"):
            en frostad glaslista som SVÄVAR över sidinnehållet (absolut position
            — trycker aldrig ner sidan) och glider ner mjukt ur ☰-knappen
            (menu-drop). Glaset: halvgenomskinlig brand-bar + backdrop-blur, så
            innehållet bakom skymtar suddigt igenom. Guldhårlinje i ramen.
            Klick utanför (det osynliga heltäckande lagret) stänger; val av
            sida stänger som förr. */}
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Stäng menyn"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-30 cursor-default sm:hidden"
            />
            {/* iOS-materialen (ägarfeedback 2026-08-02 "får inte iphone-
                känslan"): ljust läge = LJUST glas (vit/65) med mörk text —
                som iOS:s egna menyer — mörkt läge = mörkt glas (club-900/55)
                med ljus text. Då kan glaset vara riktigt genomskinligt utan
                att texten blir oläslig, och blur-2xl ger ordentlig frost. */}
            <nav className="menu-drop absolute right-3 top-full z-40 mt-2 flex w-60 flex-col gap-1 rounded-2xl bg-white/65 p-2 shadow-xl ring-1 ring-gold-400/30 backdrop-blur-2xl backdrop-saturate-150 dark:bg-club-900/55 sm:hidden">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => menuLinkClass(isActive)}
                >
                  {item.label}
                </NavLink>
              ))}
              {!authLoading && (
                <NavLink
                  to={accountTo}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => menuLinkClass(isActive)}
                >
                  {accountLabel}
                </NavLink>
              )}
            </nav>
          </>
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
      {/* Sidfoten (faceliften 2026-08-02): klubbsignaturen ger varje sida ett
          golv — guldhårlinje + ordmärket i serifen, som kolofonen i en bok.
          Inte i spelvyn (immersiv) — där finns inget att scrolla förbi. */}
      {/* "Ny version finns"-raden: en diskret glaspill i nederkant, samma
          material som mobilmenyn. Visas på ALLA sidor (även spelbordet — där
          är den extra viktig: gamla versionens sidor kan sluta gå att ladda).
          Ingen auto-omladdning: användaren väljer själv när (en pågående giv
          ska aldrig kastas av en uppdatering). ✕ döljer raden för sessionen. */}
      {nyVersion !== null && (
        <div className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white/75 px-4 py-2 shadow-xl ring-1 ring-gold-400/40 backdrop-blur-2xl backdrop-saturate-150 dark:bg-club-900/70">
            <span className="text-sm text-ink">Ny version finns</span>
            <button
              type="button"
              onClick={() => nyVersion.update()}
              className="rounded-lg bg-emerald-700 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
            >
              Uppdatera
            </button>
            <button
              type="button"
              onClick={() => setNyVersion(null)}
              aria-label="Dölj uppdateringsraden"
              className="text-sm text-ink-faint hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {!immersive && (
        <footer className="pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
            {/* "Est." (ägarbeslut 2026-08-02, valt framför "grundat"/"sedan"):
                klubbskyltarnas graverade stämpel — och behöver aldrig
                översättas när engelskan kommer (Fas 5). */}
            <p className="text-xs text-ink-faint">
              © <span className="font-brand text-sm">rebidz</span> · Est. 2026 ·
              v{pkg.version} ·{' '}
              <NavLink to="/om" className="underline underline-offset-2 hover:text-ink">
                Om rebidz
              </NavLink>{' '}
              ·{' '}
              <NavLink to="/integritet" className="underline underline-offset-2 hover:text-ink">
                Integritet
              </NavLink>{' '}
              ·{' '}
              <NavLink to="/villkor" className="underline underline-offset-2 hover:text-ink">
                Villkor
              </NavLink>
            </p>
          </div>
        </footer>
      )}
    </div>
  )
}
