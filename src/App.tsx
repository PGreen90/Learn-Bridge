import { lazy } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
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
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

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
          <Route path="spela-kort" element={<Play key="fri" />} />
          {/* Dagens giv (2026-08-02): samma sida, men given kommer ur datumfröet.
              Egna key:ar → React monterar om Play vid byte mellan lägena (annars
              behålls gamla givens state eftersom komponenten är densamma). */}
          <Route path="spela-kort/dagens" element={<Play key="dagens" daily />} />
          <Route path="installningar" element={<Settings />} />
          {/* Catch-all: alla adresser utanför tabellen (felskrivning, död
              länk) landar mjukt på 404-sidan i stället för på en tom sida
              (konkurrensplanen Fas 0 c). Facit: not-found.test.tsx. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
