import type { Suit } from '../types/bridge'
import { SUIT_TEXT } from '../lib/suitColors'

const SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

// Fyrfärgslek (Synrey-stil): ♠ blå, ♥ röd, ♦ orange, ♣ grön — se suitColors.ts.
export function SuitSymbol({ suit, className = '' }: { suit: Suit; className?: string }) {
  return <span className={`${SUIT_TEXT[suit]} ${className}`}>{SYMBOL[suit]}</span>
}
