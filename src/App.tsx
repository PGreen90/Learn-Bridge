import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { BiddingPractice } from './pages/BiddingPractice'
import { Learn } from './pages/Learn'
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
          <Route path="lar-dig" element={<Learn />} />
          <Route path="installningar" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
