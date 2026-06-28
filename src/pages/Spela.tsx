import { useState } from 'react'
import type { Deal, Seat, Suit, Vulnerability } from '../types/bridge'
import { SEAT_LABEL, seatAt, type ResolvedCall } from '../lib/bidding'
import { dealRandom } from '../lib/engine/deal'
import { classifyOpening } from '../lib/engine/openings'
import { buildAuction, dealWithAuction, type AuctionTurn } from '../lib/engine/auction'
import { surveyOpenings, surveyResponses, type OpeningSurvey, type ResponseSurvey } from '../lib/engine/survey'
import { HandView } from '../components/HandView'
import { AuctionView } from '../components/AuctionView'
import { SuitSymbol } from '../components/SuitSymbol'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'

/**
 * Motorns `turns` listar bara budsidans bud (öppnare/svarare + ev. ett inkliv).
 * För rutnätet behövs HELA medurs-följden från given, så vi fyller i de
 * mellanliggande motståndarpassarna.
 */
function turnsToCalls(turns: AuctionTurn[], dealer: Seat): ResolvedCall[] {
  const calls: ResolvedCall[] = []
  let idx = 0
  for (const turn of turns) {
    let guard = 0
    while (seatAt(dealer, idx) !== turn.seat && guard++ < 8) {
      calls.push({ seat: seatAt(dealer, idx), bid: 'P' })
      idx++
    }
    calls.push({ seat: turn.seat, bid: turn.call })
    idx++
  }
  return calls
}

const SUIT_OF: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

const SEAT_SHORT: Record<Seat, string> = { N: 'N', E: 'Ö', S: 'S', W: 'V' }

/** Är platsen i zon (sårbar) givet givens sårbarhet? */
function isVulnerable(seat: Seat, v: Vulnerability): boolean {
  if (v === 'all') return true
  if (v === 'ns') return seat === 'N' || seat === 'S'
  if (v === 'ew') return seat === 'E' || seat === 'W'
  return false
}

/**
 * BBO-liknande brickmarkör i mitten av bordet: varje väderstreck rött i zon,
 * vitt utanför zon. Giv märks med "D". Bricknumret står i mitten.
 */
function BoardMarker({ deal }: { deal: Deal }) {
  function chip(seat: Seat, pos: string) {
    const vul = isVulnerable(seat, deal.vulnerability)
    return (
      <div
        className={`absolute ${pos} flex h-8 w-8 flex-col items-center justify-center rounded text-xs font-bold leading-none
          ${vul ? 'bg-red-500 text-white' : 'bg-white text-slate-600 border border-slate-300'}`}
      >
        <span>{SEAT_SHORT[seat]}</span>
        {deal.dealer === seat && (
          <span className="mt-0.5 text-[8px] font-semibold opacity-80">D</span>
        )}
      </div>
    )
  }
  return (
    <div className="hidden sm:flex items-center justify-center self-stretch">
      <div className="relative h-28 w-28 rounded-md border border-slate-300 bg-slate-50">
        {chip('N', 'left-1/2 top-1 -translate-x-1/2')}
        {chip('W', 'left-1 top-1/2 -translate-y-1/2')}
        {chip('E', 'right-1 top-1/2 -translate-y-1/2')}
        {chip('S', 'left-1/2 bottom-1 -translate-x-1/2')}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] uppercase tracking-wide text-slate-400 leading-none">Bricka</span>
          <span className="text-lg font-bold text-slate-700 leading-tight">{deal.board}</span>
        </div>
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
        className={`!p-4 w-full sm:w-72 ${isOpener ? 'ring-2 ring-emerald-500' : isResponder ? 'ring-2 ring-sky-400' : ''}`}
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
        <HandView hand={hand} showPoints />
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
      <div className="space-y-4">
        <div className="flex justify-center">{seatPanel('N')}</div>
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          {seatPanel('W')}
          <BoardMarker deal={deal} />
          {seatPanel('E')}
        </div>
        <div className="flex justify-center">{seatPanel('S')}</div>
      </div>

      {auction && hasResponse && (
        <Panel>
          <h2 className="text-lg font-semibold mb-3">Auktionen (ostörd – motståndarna passar)</h2>
          <div className="mb-5 flex justify-center">
            <AuctionView
              calls={turnsToCalls(auction.turns, deal.dealer)}
              dealer={deal.dealer}
              vulnerability={deal.vulnerability}
            />
          </div>
          <p className="text-sm text-slate-500 mb-2">Förklaringar:</p>
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
