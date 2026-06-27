import { useState } from 'react'
import type { Deal, Seat, Suit } from '../types/bridge'
import { SEAT_LABEL } from '../lib/bidding'
import { dealRandom } from '../lib/engine/deal'
import { classifyOpening } from '../lib/engine/openings'
import { buildAuction, dealWithAuction } from '../lib/engine/auction'
import { surveyOpenings, surveyResponses, type OpeningSurvey, type ResponseSurvey } from '../lib/engine/survey'
import { HandView } from '../components/HandView'
import { SuitSymbol } from '../components/SuitSymbol'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'

const SUIT_OF: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

/** Liten kompass i mitten av bordet (Nord upp, Väst vänster, Öst höger, Syd ner). */
function CompassRose() {
  return (
    <div className="hidden sm:flex items-center justify-center self-stretch">
      <div className="relative h-20 w-20 rounded-md border border-slate-300 text-slate-500 text-sm font-semibold">
        <span className="absolute left-1/2 top-1 -translate-x-1/2">N</span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2">V</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2">Ö</span>
        <span className="absolute left-1/2 bottom-1 -translate-x-1/2">S</span>
      </div>
    </div>
  )
}

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

  const auction = buildAuction(deal)
  const hasResponse = (auction?.turns.length ?? 0) >= 2

  function newDeal() {
    setDeal(dealRandom())
  }

  function newAuctionDeal() {
    const found = dealWithAuction()
    if (found) setDeal(found.deal)
  }

  function seatPanel(seat: Seat) {
    const hand = deal.hands[seat]
    const r = classifyOpening(hand)
    const isOpener = auction?.openerSeat === seat
    const isResponder = hasResponse && auction?.responderSeat === seat
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
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Spela mot datorn</h1>
        <p className="text-slate-600">
          Titta-läge: hela (ostörda) auktioner. Motorn delar ut en riktig giv och
          visar vad varje hand öppnar med – och bygger sedan auktionen öppning →
          svar → öppnarens återbud så långt systemboken räcker. Bra för att
          bekräfta systemet och hitta hål.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button onClick={newDeal}>Ny giv →</Button>
        <Button onClick={newAuctionDeal}>Öppning + auktion →</Button>
        <Button variant="secondary" onClick={() => setOpenSurvey(surveyOpenings(2000))}>
          Hålfinnare: öppningar
        </Button>
        <Button variant="secondary" onClick={() => setRespSurvey(surveyResponses(5000))}>
          Hålfinnare: svar
        </Button>
      </div>

      {/* Händerna placerade som vid ett bridgebord: Nord uppe, Väst vänster,
          Öst höger, Syd nere. På liten skärm staplas de N → V → Ö → S. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:items-start">
        <div className="hidden sm:block" />
        {seatPanel('N')}
        <div className="hidden sm:block" />

        {seatPanel('W')}
        <CompassRose />
        {seatPanel('E')}

        <div className="hidden sm:block" />
        {seatPanel('S')}
        <div className="hidden sm:block" />
      </div>

      {auction && hasResponse && (
        <Panel>
          <h2 className="text-lg font-semibold mb-2">Auktionen (ostörd – motståndarna passar)</h2>
          <ol className="space-y-2">
            {auction.turns.map((turn, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-28 shrink-0 text-sm">
                  <span className="font-semibold">{SEAT_LABEL[turn.seat]}</span>{' '}
                  <span className="text-slate-500">({turn.role})</span>
                </span>
                <span className="w-14 shrink-0 text-lg">
                  <BidTag call={turn.call} />
                </span>
                <span className="text-sm text-slate-600">
                  {turn.explanation}
                  {turn.uncertain && (
                    <span className="ml-1 text-amber-600">⚑ osäker – förenkling i motorn</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {auction.open && (
            <p className="mt-3 text-sm text-slate-500">
              … auktionen fortsätter – motorn har inte regler för nästa bud ännu.
            </p>
          )}
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
