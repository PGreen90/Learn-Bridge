import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { BiddingPractice } from './pages/BiddingPractice'
import { BiddingSession } from './pages/BiddingSession'
import { BudSystem } from './pages/BudSystem'
import { Spela } from './pages/Spela'
import { Play } from './pages/Play'
import { Settings } from './pages/Settings'

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
          <Route path="spela" element={<Spela />} />
          <Route path="spela-kort" element={<Play />} />
          <Route path="installningar" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
