import type { Suit } from '../types/bridge'
import { SUIT_INK } from '../lib/suitColors'

const SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

// Fyrfärgslek: ♠ svart, ♥ röd, ♦ orange, ♣ grön — se suitColors.ts.
export function SuitSymbol({ suit, className = '' }: { suit: Suit; className?: string }) {
  return (
    <span className={`${SUIT_INK[suit]} ${className}`}>{SYMBOL[suit]}</span>
  )
}
