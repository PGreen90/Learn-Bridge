import { useState } from 'react'
import type { Deal, Seat, Suit } from '../types/bridge'
import { SEAT_LABEL } from '../lib/bidding'
import { dealRandom } from '../lib/engine/deal'
import { classifyOpening } from '../lib/engine/openings'
import { firstMajorOpeningAuction, dealWithMajorOpening } from '../lib/engine/auction'
import { surveyOpenings, surveyResponses, type OpeningSurvey, type ResponseSurvey } from '../lib/engine/survey'
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
  const [openSurvey, setOpenSurvey] = useState<OpeningSurvey | null>(null)
  const [respSurvey, setRespSurvey] = useState<ResponseSurvey | null>(null)

  const auction = firstMajorOpeningAuction(deal)

  function newDeal() {
    setDeal(dealRandom())
  }

  function newMajorDeal() {
    const found = dealWithMajorOpening()
    if (found) setDeal(found.deal)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Spela mot datorn</h1>
        <p className="text-slate-600">
          Titta-läge: öppningar och svar. Motorn delar ut en riktig giv och visar
          vad varje hand öppnar med – och vid en 1♥/1♠-öppning även partnerns svar
          – enligt systemboken. Bra för att bekräfta systemet och hitta hål.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button onClick={newDeal}>Ny giv →</Button>
        <Button onClick={newMajorDeal}>Högfärgsöppning + svar →</Button>
        <Button variant="secondary" onClick={() => setOpenSurvey(surveyOpenings(2000))}>
          Hålfinnare: öppningar
        </Button>
        <Button variant="secondary" onClick={() => setRespSurvey(surveyResponses(5000))}>
          Hålfinnare: svar
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {SEATS.map((seat) => {
          const hand = deal.hands[seat]
          const r = classifyOpening(hand)
          const isOpener = auction?.openerSeat === seat
          const isResponder = auction?.responderSeat === seat
          return (
            <Panel
              key={seat}
              className={`!p-4 ${isOpener ? 'ring-2 ring-emerald-500' : isResponder ? 'ring-2 ring-sky-400' : ''}`}
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-semibold">
                  {SEAT_LABEL[seat]}
                  {deal.dealer === seat && <span className="ml-2 text-xs text-slate-500">(giv)</span>}
                  {isOpener && <span className="ml-2 text-xs text-emerald-600">öppnare</span>}
                  {isResponder && <span className="ml-2 text-xs text-sky-600">svarare</span>}
                </span>
                <span className="text-lg">
                  <BidTag call={r.call} />
                </span>
              </div>
              <HandView hand={hand} />
              <p className="mt-2 text-sm text-slate-600">
                {r.explanation}
                {r.uncertain && <span className="ml-1 text-amber-600">⚑ osäker – kan vara stark 2♣</span>}
              </p>
            </Panel>
          )
        })}
      </div>

      {auction && (
        <Panel>
          <h2 className="text-lg font-semibold mb-2">Svar på högfärgsöppningen</h2>
          <p className="mb-3">
            {SEAT_LABEL[auction.openerSeat]} öppnar <BidTag call={auction.openCall} />. Partner (
            {SEAT_LABEL[auction.responderSeat]}) svarar <BidTag call={auction.response.call} />.
          </p>
          <div className="flex flex-wrap items-start gap-4">
            <HandView hand={deal.hands[auction.responderSeat]} />
            <p className="text-sm text-slate-600 max-w-sm">
              {auction.response.explanation}
              {auction.response.uncertain && (
                <span className="ml-1 text-amber-600">⚑ osäker – förenkling i motorn</span>
              )}
            </p>
          </div>
        </Panel>
      )}

      {openSurvey && (
        <SurveyTable
          title={`Hålfinnare öppningar – ${openSurvey.hands.toLocaleString('sv-SE')} händer`}
          rows={openSurvey.byRule}
          uncertain={openSurvey.uncertain}
        />
      )}

      {respSurvey && (
        <SurveyTable
          title={`Hålfinnare svar – ${respSurvey.auctions.toLocaleString('sv-SE')} högfärgsöppningar`}
          rows={respSurvey.byRule}
          uncertain={respSurvey.uncertain}
        />
      )}
    </div>
  )
}

function SurveyTable({
  title,
  rows,
  uncertain,
}: {
  title: string
  rows: { rule: string; count: number; pct: number }[]
  uncertain: { notation: string; result: { call: string } }[]
}) {
  return (
    <Panel>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-1">Regel</th>
            <th className="py-1 text-right">Antal</th>
            <th className="py-1 text-right">Andel</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rule} className="border-b border-slate-100">
              <td className="py-1">{row.rule}</td>
              <td className="py-1 text-right tabular-nums">{row.count.toLocaleString('sv-SE')}</td>
              <td className="py-1 text-right tabular-nums">{row.pct} %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="font-medium mb-1">Osäkra händer ({uncertain.length} exempel)</h3>
      {uncertain.length === 0 ? (
        <p className="text-sm text-slate-600">Inga osäkra händer i den här körningen.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {uncertain.map((u, i) => (
            <li key={i} className="text-slate-700">
              <span className="font-mono text-slate-500">{u.notation}</span> →{' '}
              <BidTag call={u.result.call} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
