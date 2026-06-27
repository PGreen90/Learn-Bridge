import type { Hand, Suit, Rank } from '../types/bridge'
import { SuitSymbol } from './SuitSymbol'

// Bridge-konvention: visa färgerna i ordningen spader, hjärter, ruter, klöver,
// och korten från högst (A) till lägst (2).
const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANK_ORDER: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

function sortRanks(ranks: Rank[]): Rank[] {
  return [...ranks].sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b))
}

/** Visar en hand grupperad per färg, som man skriver upp en bridge-hand. */
export function HandView({ hand }: { hand: Hand }) {
  return (
    <div className="w-full bg-emerald-50 rounded-xl p-3">
      {SUIT_ORDER.map((suit) => {
        const ranks = sortRanks(hand.filter((c) => c.suit === suit).map((c) => c.rank))
        return (
          <div key={suit} className="flex items-center gap-2 text-xl leading-relaxed whitespace-nowrap">
            <SuitSymbol suit={suit} className="w-5 shrink-0 text-center" />
            <span className="font-mono tracking-normal text-slate-800">
              {ranks.length ? ranks.join(' ') : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
