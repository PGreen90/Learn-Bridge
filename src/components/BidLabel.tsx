import type { Bid, Suit } from '../types/bridge'
import { SUIT_TEXT } from '../lib/suitColors'

const STRAIN: Record<string, { sym: string; suit: Suit }> = {
  C: { sym: '♣', suit: 'clubs' },
  D: { sym: '♦', suit: 'diamonds' },
  H: { sym: '♥', suit: 'hearts' },
  S: { sym: '♠', suit: 'spades' },
}

/** Visar ett bud snyggt: "1H" -> 1♥, "P" -> Pass. Fyrfärgslek via suitColors.ts.
 *  Pass = grön, dubbling = röd, redubbling = blå (samma färger som budlådan). */
export function BidLabel({ bid }: { bid: Bid }) {
  if (bid === 'P') return <span className="text-accent">Pass</span>
  if (bid === 'X') return <span className="text-danger">Dbl</span>
  if (bid === 'XX') return <span className="text-blue-600 dark:text-blue-400">Redbl</span>

  const level = bid[0]
  const strain = bid.slice(1)

  if (strain === 'NT' || strain === 'N') return <span>{level}NT</span>

  const s = STRAIN[strain]
  if (!s) return <span>{bid}</span>

  return (
    <span>
      {level}
      <span className={SUIT_TEXT[s.suit]}>{s.sym}</span>
    </span>
  )
}
