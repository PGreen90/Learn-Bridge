import { useState } from 'react'
import type { Deal, Seat, Suit } from '../types/bridge'
import { SEAT_LABEL } from '../lib/bidding'
import { dealRandom } from '../lib/engine/deal'
import { classifyOpening } from '../lib/engine/openings'
import { surveyOpenings, type OpeningSurvey } from '../lib/engine/survey'
import { HandView } from '../components/HandView'
import { SuitSymbol } from '../components/SuitSymbol'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const SUIT_OF: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

/** Visar ett bud snyggt: "Pass", "1 NT" eller "1 ♠" (med färgsymbol). */
function BidTag({ call }: { call: string }) {
  if (call === 'P') return <span className="font-bold text-slate-600">Pass</span>
  const m = call.match(/^(\d)(C|D|H|S|NT)$/)
  if (!m) return <span className="font-bold">{call}</span>
  const [, level, suit] = m
  return (
    <span className="font-bold text-emerald-700">
      {level} {suit === 'NT' ? 'NT' : <SuitSymbol suit={SUIT_OF[suit]} />}
    </span>
  )
}

export function Spela() {
  const [deal, setDeal] = useState<Deal>(() => dealRandom())
  const [survey, setSurvey] = useState<OpeningSurvey | null>(null)

  function newDeal() {
    setDeal(dealRandom())
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Spela mot datorn</h1>
        <p className="text-slate-600">
          Titta-läge: öppningar. Motorn delar ut en riktig giv och visar vad
          varje hand öppnar med enligt systemboken. Bra för att bekräfta systemet
          och hitta hål.
        </p>
      </header>

      <div className="flex gap-3">
        <Button onClick={newDeal}>Ny giv →</Button>
        <Button variant="secondary" onClick={() => setSurvey(surveyOpenings(2000))}>
          Kör hålfinnare (2000 givar)
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {SEATS.map((seat) => {
          const hand = deal.hands[seat]
          const r = classifyOpening(hand)
          return (
            <Panel key={seat} className="!p-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-semibold">
                  {SEAT_LABEL[seat]}
                  {deal.dealer === seat && (
                    <span className="ml-2 text-xs text-slate-500">(giv)</span>
                  )}
                </span>
                <span className="text-lg">
                  <BidTag call={r.call} />
                </span>
              </div>
              <HandView hand={hand} />
              <p className="mt-2 text-sm text-slate-600">
                {r.explanation}
                {r.uncertain && (
                  <span className="ml-1 text-amber-600">⚑ osäker – kan vara stark 2♣</span>
                )}
              </p>
            </Panel>
          )
        })}
      </div>

      {survey && (
        <Panel>
          <h2 className="text-lg font-semibold mb-3">
            Hålfinnare – {survey.hands.toLocaleString('sv-SE')} händer
          </h2>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1">Regel</th>
                <th className="py-1 text-right">Antal</th>
                <th className="py-1 text-right">Andel</th>
              </tr>
            </thead>
            <tbody>
              {survey.byRule.map((row) => (
                <tr key={row.rule} className="border-b border-slate-100">
                  <td className="py-1">{row.rule}</td>
                  <td className="py-1 text-right tabular-nums">{row.count.toLocaleString('sv-SE')}</td>
                  <td className="py-1 text-right tabular-nums">{row.pct} %</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="font-medium mb-1">
            Osäkra händer ({survey.uncertain.length} exempel)
          </h3>
          {survey.uncertain.length === 0 ? (
            <p className="text-sm text-slate-600">Inga osäkra händer i den här körningen.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {survey.uncertain.map((u, i) => (
                <li key={i} className="text-slate-700">
                  <span className="font-mono text-slate-500">{u.notation}</span> →{' '}
                  <BidTag call={u.result.call} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  )
}
