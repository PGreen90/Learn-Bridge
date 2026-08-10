import { lazy } from 'react'
import { HashRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'

// Route-baserad kod-uppdelning (konkurrensplanen Fas 0 c): varje sida blir en
// egen JS-chunk som hämtas först när man går dit, så första laddningen av
// startsidan blir mindre. Home är EJ lat — den är landningssidan och ska ritas
// direkt. Suspense-gränsen + fallbacken ligger i Layout (runt <Outlet/>).
const BiddingPractice = lazy(() =>
  import('./pages/BiddingPractice').then((m) => ({ default: m.BiddingPractice })),
)
const BiddingSession = lazy(() =>
  import('./pages/BiddingSession').then((m) => ({ default: m.BiddingSession })),
)
const BudSystem = lazy(() => import('./pages/BudSystem').then((m) => ({ default: m.BudSystem })))
const Spela = lazy(() => import('./pages/Spela').then((m) => ({ default: m.Spela })))
const Play = lazy(() => import('./pages/Play').then((m) => ({ default: m.Play })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const DagensArkiv = lazy(() =>
  import('./pages/DagensArkiv').then((m) => ({ default: m.DagensArkiv })),
)
const SpelHistorik = lazy(() =>
  import('./pages/SpelHistorik').then((m) => ({ default: m.SpelHistorik })),
)
const Om = lazy(() => import('./pages/Om').then((m) => ({ default: m.Om })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

// Konton (Beslut B etapp 1): inloggning, registrering och länklandningen.
const LoggaIn = lazy(() => import('./pages/auth/LoggaIn').then((m) => ({ default: m.LoggaIn })))
const Registrera = lazy(() =>
  import('./pages/auth/Registrera').then((m) => ({ default: m.Registrera })),
)
const GlomtLosenord = lazy(() =>
  import('./pages/auth/GlomtLosenord').then((m) => ({ default: m.GlomtLosenord })),
)
const NyttLosenord = lazy(() =>
  import('./pages/auth/NyttLosenord').then((m) => ({ default: m.NyttLosenord })),
)
const AuthCallback = lazy(() =>
  import('./pages/auth/AuthCallback').then((m) => ({ default: m.AuthCallback })),
)
const Konto = lazy(() => import('./pages/auth/Konto').then((m) => ({ default: m.Konto })))
const Integritet = lazy(() =>
  import('./pages/auth/Integritet').then((m) => ({ default: m.Integritet })),
)
const Villkor = lazy(() => import('./pages/auth/Villkor').then((m) => ({ default: m.Villkor })))

/** Dagens giv-rutten: `?dag=N` (kalenderarkivet 2026-08-03) spelar en tidigare
 *  dags giv. Dagen ingår i React-nyckeln så ett dagbyte i arkivet monterar om
 *  Play — annars satt gårdagens giv kvar när man valde en ny dag. */
function PlayDagens() {
  const [params] = useSearchParams()
  return <Play key={`dagens-${params.get('dag') ?? 'idag'}`} daily />
}

/** Frispelet: nyckeln bär fröet + dev-stolen (?giv=&sitt=), så att BYTA giv via
 *  adressen monterar om Play och läser den nya given (annars satt förra given
 *  kvar — konstant nyckel). Internt "Ny giv" byter inte adressen via routern
 *  (replaceState), så slumpgivar remountar inte i onödan. */
function PlayFri() {
  const [params] = useSearchParams()
  return <Play key={`fri-${params.get('giv') ?? 'x'}-${params.get('sitt') ?? 'S'}`} />
}

// HashRouter används med flit: det fungerar felfritt på GitHub Pages utan
// extra serverinställningar (adresserna får ett #, t.ex. .../#/budtraning).
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="budtraning" element={<BiddingPractice />} />
          <Route path="budtraning/:themeId" element={<BiddingSession />} />
          <Route path="budsystem" element={<BudSystem />} />
          {/* Budvisning = titta-läget. Routen hette förr "spela" men det krockade
              med "spela-kort" (det riktiga spelet); "budvisning" matchar etiketten
              (R3-fynd #7). Gamla /spela-länkar redirectar hit. */}
          <Route path="budvisning" element={<Spela />} />
          <Route path="spela" element={<Navigate to="/budvisning" replace />} />
          <Route path="spela-kort" element={<PlayFri />} />
          {/* Dagens giv (2026-08-02): samma sida, men given kommer ur datumfröet.
              Egna key:ar → React monterar om Play vid byte mellan lägena (annars
              behålls gamla givens state eftersom komponenten är densamma). */}
          <Route path="spela-kort/dagens" element={<PlayDagens />} />
          {/* Kalenderarkivet (2026-08-03): alla dagars givar sedan premiären —
              spelade dagar visar resultatet, missade går att spela i efterhand. */}
          <Route path="spela-kort/dagens/arkiv" element={<DagensArkiv />} />
          {/* Frispelets resultathistorik (2026-08-03): senaste givarna, alla
              omspelbara via sitt frö. */}
          <Route path="spela-kort/historik" element={<SpelHistorik />} />
          <Route path="installningar" element={<Settings />} />
          {/* Om rebidz (Etapp D): onboardingen — nås från startsidan + sidfoten. */}
          <Route path="om" element={<Om />} />
          {/* Konton (Beslut B etapp 1): inloggning, registrering, kontosida och
              inloggningslänkarnas landning (auth/callback). */}
          <Route path="logga-in" element={<LoggaIn />} />
          <Route path="registrera" element={<Registrera />} />
          <Route path="glomt-losenord" element={<GlomtLosenord />} />
          <Route path="nytt-losenord" element={<NyttLosenord />} />
          <Route path="auth/callback" element={<AuthCallback />} />
          <Route path="konto" element={<Konto />} />
          {/* GDPR-sidorna (måste finnas före första registreringen). */}
          <Route path="integritet" element={<Integritet />} />
          <Route path="villkor" element={<Villkor />} />
          {/* Catch-all: alla adresser utanför tabellen (felskrivning, död
              länk) landar mjukt på 404-sidan i stället för på en tom sida
              (konkurrensplanen Fas 0 c). Facit: not-found.test.tsx. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
