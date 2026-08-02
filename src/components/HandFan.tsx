// En hand som färggrupperad kortrad: färgerna i Synrey-ordning ♠ ♥ ♣ ♦, korten
// överlappar med det delade REST_OVERLAP inom varje färg. Delad look i
// budträningen och budvisningen (ägarbeslut 2026-07-30). Med `flat` ritas i
// stället spelbordets sammanhängande rad (ägarbeslut 2026-08-02, samma som
// `SouthFan` i vila): fasta xl-kort 64×96 och ETT jämnt överlapp utan färgglapp
// (FLAT_OVERLAP → 13 kort = 349 px), så budfas och spelfas ser identiska ut.
// Bara presentation.

import type { Hand } from '../types/bridge'
import { bySuit, FLAT_OVERLAP, HAND_SUITS, REST_OVERLAP } from '../lib/cardLayout'
import { PlayingCard } from './PlayingCard'

export function HandFan({
  hand,
  size = 'md',
  flat = false,
}: {
  hand: Hand
  size?: 'sm' | 'md' | 'lg'
  /** `flat` ritar spelbordets sammanhängande rad: fasta xl-kort med samma
   *  överlapp över hela raden, inga färgglapp (`size` ignoreras). Används av
   *  budfasen så handen ser likadan ut där som i spelfasen. */
  flat?: boolean
}) {
  let dealt = 0 // löpande kortindex över alla färggrupper → utdelningskaskaden
  return (
    <div className="flex items-end justify-center">
      {HAND_SUITS.map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        return (
          <div key={suit} className="flex">
            {cards.map((c, i) => {
              const idx = dealt++
              const ml = flat ? (idx === 0 ? '' : FLAT_OVERLAP) : i === 0 ? '' : REST_OVERLAP
              return (
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  card={c}
                  size={flat ? 'xl' : size}
                  className={`deal-in ${ml}`}
                  style={{ animationDelay: `${idx * 35}ms` }}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
