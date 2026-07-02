import type { Suit } from '../types/bridge'
import { SUIT_TEXT, SUIT_TEXT_DARK } from '../lib/suitColors'

const SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

// Fyrfärgslek (Synrey-stil): ♠ blå, ♥ röd, ♦ orange, ♣ grön — se suitColors.ts.
export function SuitSymbol({ suit, className = '' }: { suit: Suit; className?: string }) {
  return (
    <span className={`${SUIT_TEXT[suit]} ${SUIT_TEXT_DARK[suit]} ${className}`}>{SYMBOL[suit]}</span>
  )
}
