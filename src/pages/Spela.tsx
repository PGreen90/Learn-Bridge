import { useState } from 'react'
import type { Deal, Seat } from '../types/bridge'
import { SEAT_LABEL } from '../lib/bidding'
import { dealRandom } from '../lib/engine/deal'
import { classifyOpening, isVulnerable } from '../lib/engine/openings'
import { buildAuction, dealWithAuction } from '../lib/engine/auction'
import { turnsToCalls } from '../lib/engine/auction-contract'
import { surveyOpenings, surveyResponses, type OpeningSurvey, type ResponseSurvey } from '../lib/engine/survey'
import { HandView } from '../components/HandView'
import { AuctionGrid } from '../components/AuctionGrid'
import { Felt } from '../components/Felt'
import { BidChip } from '../components/BidChip'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'

const SEAT_SHORT: Record<Seat, string> = { N: 'N', E: 'Ö', S: 'S', W: 'V' }

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
          ${vul ? 'bg-red-500 text-white' : 'bg-white text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'}`}
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
      <div className="relative h-28 w-28 rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
        {chip('N', 'left-1/2 top-1 -translate-x-1/2')}
        {chip('W', 'left-1 top-1/2 -translate-y-1/2')}
        {chip('E', 'right-1 top-1/2 -translate-y-1/2')}
        {chip('S', 'left-1/2 bottom-1 -translate-x-1/2')}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-500 leading-none">Bricka</span>
          <span className="text-lg font-bold text-slate-700 dark:text-slate-200 leading-tight">{deal.board}</span>
        </div>
      </div>
    </div>
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
    const r = classifyOpening(hand, isVulnerable(seat, deal.vulnerability))
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
            {deal.dealer === seat && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">(giv)</span>}
            {isOpener && <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">öppnare</span>}
            {isResponder && <span className="ml-2 text-xs text-sky-600 dark:text-sky-400">svarare</span>}
          </span>
          <BidChip bid={r.call} />
        </div>
        <HandView hand={hand} showPoints />
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {r.explanation}
          {r.uncertain && <span className="ml-1 text-amber-600">⚑ osäker – kan vara stark 2♣</span>}
        </p>
      </Panel>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Budvisning</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Titta-läge: motorn delar ut en giv, budar alla fyra händerna enligt
          systemboken och förklarar varje bud. Du tittar – datorn budar.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button onClick={newDeal}>Ny giv →</Button>
        <Button onClick={newAuctionDeal}>Öppning + auktion →</Button>
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
          {/* Auktionen på grönt filt med Synrey-chips (klicka ett bud → förklaring). */}
          <Felt rounded="rounded-2xl" className="mb-5 p-2.5">
            <AuctionGrid
              calls={turnsToCalls(auction.turns, deal.dealer)}
              dealer={deal.dealer}
              vulnerability={deal.vulnerability}
            />
          </Felt>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Förklaringar:</p>
          <ol className="space-y-2">
            {auction.turns.map((turn, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-28 shrink-0 text-sm">
                  <span className="font-semibold">{SEAT_LABEL[turn.seat]}</span>{' '}
                  <span className="text-slate-500 dark:text-slate-400">({turn.role})</span>
                </span>
                <span className="w-14 shrink-0">
                  <BidChip bid={turn.call} />
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {turn.explanation}
                  {turn.uncertain && (
                    <span className="ml-1 text-amber-600">⚑ osäker – förenkling i motorn</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {auction.open && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              … auktionen fortsätter – motorn har inte regler för nästa bud ännu.
            </p>
          )}
        </Panel>
      )}

      {/* Hålfinnarna är testverktyg för motorn – hopfällda så de inte stör. */}
      <details className="group rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
          <span>🛠 Hålfinnare – testverktyg för budmotorn</span>
          <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-3">
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Kör tusentals slumphänder genom motorn och visar hur ofta varje regel
            träffar – bra för att hitta hål i systemet.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setOpenSurvey(surveyOpenings(2000))}>
              Hålfinnare: öppningar
            </Button>
            <Button variant="secondary" onClick={() => setRespSurvey(surveyResponses(5000))}>
              Hålfinnare: svar
            </Button>
          </div>
          <div className="mt-4 space-y-4">
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
        </div>
      </details>
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
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-1">Regel</th>
            <th className="py-1 text-right">Antal</th>
            <th className="py-1 text-right">Andel</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rule} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-1">{row.rule}</td>
              <td className="py-1 text-right tabular-nums">{row.count.toLocaleString('sv-SE')}</td>
              <td className="py-1 text-right tabular-nums">{row.pct} %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="font-medium mb-1">Osäkra händer ({uncertain.length} exempel)</h3>
      {uncertain.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Inga osäkra händer i den här körningen.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {uncertain.map((u, i) => (
            <li key={i} className="text-slate-700 dark:text-slate-300">
              <span className="font-mono text-slate-500 dark:text-slate-400">{u.notation}</span> →{' '}
              <BidChip bid={u.result.call} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
