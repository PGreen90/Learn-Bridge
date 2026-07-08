// Händerna på spelbordet: Nord-sidans öppna hand som färgkolumner, Syds
// solfjäder och Ö/V-träkarlarnas kortordning. Två-klicks-spelet: klick i en
// färg väljer (fäller ut) den, klick i vald färg spelar kortet.

import type { Card, Hand, Seat, Suit } from '../../types/bridge'
import type { Contract, PlayState } from '../../lib/engine/play'
import { bySuit, handSuitsTrumpFirst } from '../../lib/cardLayout'
import { PlayingCard } from '../../components/PlayingCard'
import { turnInfo } from './common'

/**
 * En öppen hand som färgkolumner (Synrey-träkarlen): en lodrät kolumn per färg,
 * trumfen i vänstra kolumnen, högsta kortet överst. Två-klicks-spelet: klick i
 * en färg väljer kolumnen som då EXPANDERAR på höjden (samma tanke som Syds
 * solfjäder fast lodrätt), klick i vald färg spelar kortet.
 */
export function SuitColumns({
  hand,
  contract,
  play,
  seat,
  onCardClick,
  selectedSuit,
}: {
  hand: Hand
  contract: Contract
  play: PlayState
  seat: Seat
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, seat)
  return (
    <div className="flex items-start justify-center gap-1.5">
      {handSuitsTrumpFirst(contract.strain).map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        const spread = myTurn && suit === selectedSuit
        const dim = myTurn && selectedSuit !== null && !spread
        return (
          <div
            key={suit}
            className={`flex flex-col transition-all ${spread ? '-translate-y-1 z-10' : ''} ${dim ? 'opacity-50' : ''}`}
          >
            {cards.map((c, i) => {
              const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
              return (
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  card={c}
                  size="smPlus"
                  playable={playable}
                  dimmed={myTurn && !playable}
                  onClick={playable ? () => onCardClick(c) : undefined}
                  className={i > 0 ? (spread ? '-mt-7 sm:-mt-3' : '-mt-8 sm:-mt-7') : ''}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** En Ö/V-träkarls kort i visningsordning (trumf överst) för SideStack. */
export function sideCards(hand: Hand, contract: Contract): Card[] {
  return handSuitsTrumpFirst(contract.strain).flatMap((suit) => bySuit(hand, suit))
}

/** Din hand som solfjäder (Syd): färggrupper, vald färg lyfts, trumf vänster. */
export function SouthFan({
  hand,
  contract,
  play,
  onCardClick,
  selectedSuit,
}: {
  hand: Hand
  contract: Contract
  play: PlayState
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, 'S')
  let dealt = 0 // löpande kortindex över alla färggrupper → utdelningskaskaden
  return (
    <div className="flex items-end justify-center">
      {handSuitsTrumpFirst(contract.strain).map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        const spread = myTurn && suit === selectedSuit
        const dim = myTurn && selectedSuit !== null && !spread
        return (
          <div
            key={suit}
            className={`flex transition-all ${spread ? '-translate-y-1.5 z-10 sm:gap-1 sm:mx-1' : ''} ${dim ? 'opacity-50' : ''}`}
          >
            {cards.map((c, i) => {
              const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
              // Mobil: de större korten (48px) gör att en utfälld färg annars
              // knuffar ytterkorten utanför kanten. Håll allt på skärmen genom att
              // fälla ut MED måttlig överlappning och samtidigt PRESSA ihop de
              // nedtonade färgerna. Desktop oförändrat (container-gap + full utfällning).
              const ml = i === 0 ? '' : spread ? '-ml-4 sm:ml-0' : dim ? '-ml-10 sm:-ml-6' : '-ml-8 sm:-ml-6'
              return (
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  card={c}
                  size="md"
                  playable={playable}
                  dimmed={myTurn && !playable}
                  onClick={playable ? () => onCardClick(c) : undefined}
                  className={`deal-in ${ml}`}
                  style={{ animationDelay: `${dealt++ * 35}ms` }}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
