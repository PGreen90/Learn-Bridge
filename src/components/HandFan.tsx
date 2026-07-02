// En hand som tät solfjäder av riktiga kort (Synrey-stil): färgerna i
// Synrey-ordningen ♠ ♥ ♣ ♦ (HAND_SUITS), högsta kortet till vänster i varje
// färg. Används i budfasen ("Spela kort") och i budträningen.

import type { Hand } from '../types/bridge'
import { bySuit, HAND_SUITS } from '../lib/cardLayout'
import { PlayingCard } from './PlayingCard'

export function HandFan({ hand, size = 'lg' }: { hand: Hand; size?: 'sm' | 'md' | 'lg' }) {
  const cards = HAND_SUITS.flatMap((suit) => bySuit(hand, suit))
  const overlap = size === 'lg' ? '-ml-7' : size === 'md' ? '-ml-6' : '-ml-5'
  return (
    <div className="flex justify-center">
      {cards.map((c, i) => (
        <PlayingCard key={`${c.suit}${c.rank}`} card={c} size={size} className={i > 0 ? overlap : ''} />
      ))}
    </div>
  )
}
