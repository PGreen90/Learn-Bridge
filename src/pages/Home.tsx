import { Link } from 'react-router-dom'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'

export function Home() {
  return (
    <div className="space-y-6">
      <Panel>
        <h1 className="text-2xl font-bold mb-2">Välkommen! ♠ ♥ ♦ ♣</h1>
        <p className="text-slate-600 mb-4">
          Lär dig att buda och spela bridge enligt 2/1-systemet – steg för steg,
          i din egen takt.
        </p>
        <Link to="/budtraning">
          <Button>Börja budträna →</Button>
        </Link>
      </Panel>
      <Panel>
        <h2 className="text-lg font-semibold mb-2">Så funkar appen</h2>
        <ul className="list-disc list-inside text-slate-600 space-y-1">
          <li><b>Budträning</b> – öva på att hitta rätt bud.</li>
          <li><b>Budsystem</b> – hela 2/1-systemet att läsa, sektion för sektion.</li>
          <li><b>Inställningar</b> – hantera dina sparade framsteg.</li>
        </ul>
      </Panel>
    </div>
  )
}
