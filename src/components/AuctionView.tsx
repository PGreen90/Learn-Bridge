import { useState } from 'react'
import type { Seat, Vulnerability } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import { SEAT_LABEL } from '../lib/bidding'
import { isAlertRule } from '../lib/engine/alerts'
import { BidLabel } from './BidLabel'

// Kolumnordning V N Ö S (medurs), så Syd – din plats – står längst till höger.
const ORDER: Seat[] = ['W', 'N', 'E', 'S']

/** Är platsen i zon (sårbar)? Zon gäller paret, inte en enskild spelare. */
function vulnerable(seat: Seat, v: Vulnerability): boolean {
  if (v === 'all') return true
  if (v === 'ns') return seat === 'N' || seat === 'S'
  if (v === 'ew') return seat === 'E' || seat === 'W'
  return false
}

/** Ett kontraktsbud (nivå + färg/NT), till skillnad från Pass/dubbling. */
function isContractBid(bid: string): boolean {
  return /^[1-7]/.test(bid)
}

/**
 * Budgivningen som ett rutnät: kolumnerna Väst/Nord/Öst/Syd, en rad per varv.
 *  - Sårbart par får RÖD rubrik (zon), annars grå.
 *  - Given märks med "giv ●", din plats (Syd) med "(du)".
 *  - Slutkontraktet (sista kontraktsbudet) ramas in.
 *  - Konstgjorda (konventionella) bud får ett litet blått "A" (alert).
 *  - Klicka ett bud (om det har en förklaring) för att se vad det betydde.
 */
export function AuctionView({
  calls,
  dealer,
  vulnerability = 'none',
}: {
  calls: ResolvedCall[]
  dealer: Seat
  vulnerability?: Vulnerability
}) {
  const [selected, setSelected] = useState<number | null>(null)

  // Buden ligger medurs från given. Lägg tomma rutor före första budet så att
  // varje bud hamnar under rätt kolumn.
  const lead = ORDER.indexOf(dealer)
  const cells: (ResolvedCall | null)[] = [...Array<null>(lead).fill(null), ...calls]
  while (cells.length % 4 !== 0) cells.push(null)

  // Slutkontraktet = sista cellen med ett kontraktsbud.
  let contractCell = -1
  cells.forEach((c, i) => {
    if (c && isContractBid(c.bid)) contractCell = i
  })

  const chosen = selected !== null ? cells[selected] : null
  const chosenAlert = chosen ? isAlertRule(chosen.rule) : false

  return (
    <div className="inline-block">
      <div className="rounded-xl border border-slate-200 overflow-hidden text-center">
        <div className="grid grid-cols-4">
          {ORDER.map((seat) => {
            const vul = vulnerable(seat, vulnerability)
            const mark = dealer === seat ? 'giv ●' : seat === 'S' ? '(du)' : ''
            return (
              <div
                key={seat}
                className={`px-4 pt-1 pb-0.5 text-xs font-semibold ${
                  vul ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                <div>{SEAT_LABEL[seat]}</div>
                <div className="h-3 text-[9px] font-normal leading-none opacity-90">{mark}</div>
              </div>
            )
          })}
          {cells.map((cell, i) => {
            const isSouth = ORDER[i % 4] === 'S'
            const alert = cell ? isAlertRule(cell.rule) : false
            const clickable = !!cell?.explanation
            const isSel = selected === i
            const inner = cell ? (
              i === contractCell ? (
                <span className="inline-block rounded-md border-2 border-emerald-600 px-1.5 font-semibold leading-tight">
                  <BidLabel bid={cell.bid} />
                </span>
              ) : (
                <BidLabel bid={cell.bid} />
              )
            ) : (
              <span className="text-slate-300">·</span>
            )
            return (
              <div
                key={i}
                className={`relative px-4 py-1.5 text-lg border-t border-slate-100 ${
                  isSouth ? 'bg-emerald-50' : 'bg-white'
                } ${isSel ? 'ring-2 ring-sky-400 ring-inset' : ''} ${
                  clickable ? 'cursor-pointer hover:bg-sky-50' : ''
                }`}
                onClick={clickable ? () => setSelected((s) => (s === i ? null : i)) : undefined}
              >
                {inner}
                {alert && (
                  <span
                    className="absolute top-0 right-0.5 text-[9px] font-bold text-sky-600 leading-none"
                    title="Alert: konstgjort (konventionellt) bud"
                  >
                    A
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {chosen && chosen.explanation && (
        <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-left text-sm">
          <span className="font-semibold">{SEAT_LABEL[chosen.seat]} </span>
          <span className="font-semibold text-emerald-700">
            <BidLabel bid={chosen.bid} />
          </span>
          {chosenAlert && (
            <span className="ml-1.5 rounded bg-sky-600 px-1 text-[10px] font-bold text-white align-middle">
              ALERT
            </span>
          )}
          <span className="text-slate-700"> — {chosen.explanation}</span>
        </div>
      )}
    </div>
  )
}
