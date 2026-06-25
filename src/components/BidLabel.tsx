import type { Bid, Suit } from '../types/bridge'

const STRAIN: Record<string, { sym: string; suit: Suit }> = {
  C: { sym: '♣', suit: 'clubs' },
  D: { sym: '♦', suit: 'diamonds' },
  H: { sym: '♥', suit: 'hearts' },
  S: { sym: '♠', suit: 'spades' },
}

/** Visar ett bud snyggt: "1H" -> 1♥ (rött), "P" -> Pass, "1NT" -> 1NT. */
export function BidLabel({ bid }: { bid: Bid }) {
  if (bid === 'P') return <span>Pass</span>
  if (bid === 'X') return <span>Dbl</span>
  if (bid === 'XX') return <span>Redbl</span>

  const level = bid[0]
  const strain = bid.slice(1)

  if (strain === 'NT' || strain === 'N') return <span>{level}NT</span>

  const s = STRAIN[strain]
  if (!s) return <span>{bid}</span>

  const color = s.suit === 'hearts' || s.suit === 'diamonds' ? 'text-red-600' : 'text-slate-900'
  return (
    <span>
      {level}
      <span className={color}>{s.sym}</span>
    </span>
  )
}
