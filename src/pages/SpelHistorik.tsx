// Dina senaste givar — frispelets resultathistorik (granskningsputsen
// 2026-08-03, fynd #4: "fritt spel sparar ingenting alls"). Varje färdigspelad
// fri giv bokfördes med sitt frö i resultatögonblicket (Play.tsx), så varje
// rad här går att spela om EXAKT via #/spela-kort?giv=frö. Dagens giv har sin
// egen historik i kalenderarkivet — den blandas inte in här.

import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { BidChip } from '../components/BidChip'
import { SEAT_LABEL } from '../lib/bidding'
import { validHistorik, type SpelResultat } from '../lib/engine/spel-historik'
import { loadSpelHistorik } from '../lib/backend'

/** "3 aug 14:02" — kort nog för en rad, tydligt nog för att minnas kvällen. */
function whenLabel(when: number): string {
  return new Date(when).toLocaleString('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ResultRow({ r }: { r: SpelResultat }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-panel p-3 ring-1 ring-line">
      <div className="flex shrink-0 items-center gap-1">
        <BidChip bid={r.bid} />
        {r.doubled && <span className="text-sm font-bold text-danger">{r.doubled}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${r.win ? 'text-accent' : 'text-danger'}`}>
          {r.headline}
        </div>
        <div className="text-xs text-ink-muted">
          av {SEAT_LABEL[r.declarer]} · {r.myTricks} stick till er
          {r.scoreLabel ? ` · ${r.scoreLabel}` : ''} · {whenLabel(r.when)}
        </div>
      </div>
      <Link
        to={`/spela-kort?giv=${r.seed}`}
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink ring-1 ring-line transition-colors hover:bg-surface"
      >
        Spela om →
      </Link>
    </li>
  )
}

export function SpelHistorik() {
  const stored = loadSpelHistorik()
  const list = validHistorik(stored) ? stored : []

  return (
    <div className="space-y-6">
      <PageHeader title="Dina senaste givar">
        Frispelets resultat, nyast överst. Varje giv sparas med sitt frö — så "Spela om" ger dig
        exakt samma kort igen. Dagens giv bokförs i stället i{' '}
        <Link to="/spela-kort/dagens/arkiv" className="font-semibold text-ink underline underline-offset-2">
          kalenderarkivet
        </Link>
        .
      </PageHeader>

      {list.length === 0 ? (
        <p className="text-ink-soft">
          Inga spelade givar ännu.{' '}
          <Link to="/spela-kort" className="font-semibold text-ink underline underline-offset-2">
            Spela en fri giv
          </Link>{' '}
          så hamnar den här.
        </p>
      ) : (
        <ul className="mx-auto w-full max-w-xl space-y-2">
          {list.map((r) => (
            <ResultRow key={`${r.seed}-${r.when}`} r={r} />
          ))}
        </ul>
      )}
    </div>
  )
}
