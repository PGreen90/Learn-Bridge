// En hand som färggrupperad kortrad — SAMMA layout som spelbordets vilande hand
// (`SouthFan` i pages/play/hands.tsx): färgerna i Synrey-ordning ♠ ♥ ♣ ♦, luft
// mellan färgerna, korten överlappar med det delade REST_OVERLAP inom varje färg.
// Delad look så handen ser IDENTISK ut i budgivningen, budträningen, budvisningen
// och vid spelbordet — ingen "hopp"-känsla mellan vyer (ägarbeslut 2026-07-30).
// Bara presentation.

import type { Hand } from '../types/bridge'
import { bySuit, HAND_SUITS, REST_OVERLAP } from '../lib/cardLayout'
import { PlayingCard } from './PlayingCard'

export function HandFan({
  hand,
  size = 'md',
  spread = false,
}: {
  hand: Hand
  size?: 'sm' | 'md' | 'lg'
  /** `spread` breddar raden till budlådans bredd (max-w-md) och sprider ut
   *  färggrupperna med justify-between → luftigare, tydligare hand (ägarbeslut).
   *  Överlappet inom en färg är oförändrat, så mobilen aldrig svämmar över. */
  spread?: boolean
}) {
  let dealt = 0 // löpande kortindex över alla färggrupper → utdelningskaskaden
  return (
    <div
      className={
        spread
          ? 'mx-auto flex w-full max-w-md items-end justify-between'
          : 'flex items-end justify-center'
      }
    >
      {HAND_SUITS.map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        return (
          <div key={suit} className="flex">
            {cards.map((c, i) => (
              <PlayingCard
                key={`${c.suit}${c.rank}`}
                card={c}
                size={size}
                className={`deal-in ${i > 0 ? REST_OVERLAP : ''}`}
                style={{ animationDelay: `${dealt++ * 35}ms` }}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
