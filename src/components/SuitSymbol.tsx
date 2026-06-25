import type { Suit } from '../types/bridge'

const SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

// Röda färger: hjärter & ruter. Svarta: spader & klöver.
const COLOR: Record<Suit, string> = {
  spades: 'text-slate-900',
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-slate-900',
}

export function SuitSymbol({ suit, className = '' }: { suit: Suit; className?: string }) {
  return <span className={`${COLOR[suit]} ${className}`}>{SYMBOL[suit]}</span>
}
