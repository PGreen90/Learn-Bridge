import type { Seat } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import { SEAT_LABEL } from '../lib/bidding'
import { BidLabel } from './BidLabel'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']

/** Visar budgivningen i en tabell med kolumnerna Nord/Öst/Syd/Väst. */
export function AuctionView({ calls, dealer }: { calls: ResolvedCall[]; dealer: Seat }) {
  // Buden ligger medurs från given. Lägg tomma rutor före första budet så att
  // varje bud hamnar under rätt kolumn.
  const lead = ORDER.indexOf(dealer)
  const cells: (ResolvedCall | null)[] = [...Array<null>(lead).fill(null), ...calls]
  while (cells.length % 4 !== 0) cells.push(null)

  return (
    <div className="inline-block rounded-xl border border-slate-200 overflow-hidden text-center">
      <div className="grid grid-cols-4">
        {ORDER.map((seat) => (
          <div
            key={seat}
            className={`px-4 py-1.5 text-xs font-semibold ${
              seat === 'S' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {SEAT_LABEL[seat]}
          </div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`px-4 py-1.5 text-lg border-t border-slate-100 ${
              ORDER[i % 4] === 'S' ? 'bg-emerald-50 font-semibold' : 'bg-white'
            }`}
          >
            {cell ? <BidLabel bid={cell.bid} /> : <span className="text-slate-300">·</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
