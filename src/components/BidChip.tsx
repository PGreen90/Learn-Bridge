// Ett bud som färgkodat chip i Synrey-stil: pastellplatta med nivå + symbol i
// färgens kulör (NT lila, ♠ blå, ♥ röd, ♦ orange, ♣ grön), PASS grön, X mörkröd,
// XX mörkblå. Används av budlådan (knapparna) och auktionsrutnätet (lagda bud).

import type { Bid } from '../types/bridge'
import { CALL_CHIP, STRAIN_CHIP } from '../lib/suitColors'

const STRAIN_SYMBOL: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }

/** Chip-stilen (bakgrund + textfärg) för ett bud. */
export function bidChipTone(bid: Bid): string {
  if (bid === 'P' || bid === 'X' || bid === 'XX') return CALL_CHIP[bid]
  const strain = bid.slice(1) === 'N' ? 'NT' : bid.slice(1)
  return STRAIN_CHIP[strain as keyof typeof STRAIN_CHIP] ?? 'bg-white text-slate-900'
}

/** Chipets innehåll: "PASS", "X", "XX" eller nivå + symbol (t.ex. 1♠, 3NT). */
export function BidChipContent({ bid }: { bid: Bid }) {
  if (bid === 'P') return <>PASS</>
  if (bid === 'X') return <>X</>
  if (bid === 'XX') return <>XX</>
  const level = bid[0]
  const strain = bid.slice(1)
  if (strain === 'NT' || strain === 'N') return <>{level}NT</>
  return (
    <>
      {level}
      {STRAIN_SYMBOL[strain] ?? strain}
    </>
  )
}

/** Ett lagt bud som litet chip (auktionsrutnätet). */
export function BidChip({ bid, className = '' }: { bid: Bid; className?: string }) {
  const isCall = bid === 'P' || bid === 'X' || bid === 'XX'
  return (
    <span
      className={`inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 font-bold shadow-sm ${
        isCall ? 'text-xs' : 'text-sm'
      } ${bidChipTone(bid)} ${className}`}
    >
      <BidChipContent bid={bid} />
    </span>
  )
}
