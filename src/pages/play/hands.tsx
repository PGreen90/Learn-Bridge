// Händerna på spelbordet: Nord-sidans öppna hand som färgkolumner, Syds
// solfjäder och Ö/V-träkarlarnas kortordning. Två-klicks-spelet: klick i en
// färg väljer (fäller ut) den, klick i vald färg spelar kortet.

import type { Card, Hand, Seat, Suit } from '../../types/bridge'
import type { Contract, PlayState } from '../../lib/engine/play'
import { bySuit, handSuitsTrumpFirst } from '../../lib/cardLayout'
import { PlayingCard } from '../../components/PlayingCard'
import { turnInfo } from './common'
import type { RegisterCardEl } from './useCardFlight'

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
  registerCardEl,
}: {
  hand: Hand
  contract: Contract
  play: PlayState
  seat: Seat
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
  /** Kortflygningens ref-register (etapp 3): källkortets läge mäts härifrån. */
  registerCardEl?: RegisterCardEl
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, seat)
  return (
    <div className="flex items-start justify-center gap-1.5">
      {handSuitsTrumpFirst(contract.strain).map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        const spread = myTurn && suit === selectedSuit
        return (
          <div
            key={suit}
            className={`flex flex-col transition-all ${spread ? '-translate-y-1 z-10' : ''}`}
          >
            {cards.map((c, i) => {
              const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
              return (
                // Träkarlen: aldrig transparenta kort (ägarbeslut 2026-07-31) —
                // dimning borttagen, korten alltid fullt synliga.
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  ref={registerCardEl?.(`${c.suit}${c.rank}`)}
                  card={c}
                  size="smPlus"
                  playable={playable}
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

/**
 * Nedåtvänd solfjäder för en DOLD hand (spelföraren/din partner) — fyller
 * plats-zonen med rebidz guld-baksidor så bordet blir balanserat och den tomma
 * gröna ytan försvinner (ägarbeslut 2026-07-31, som Synrey/BBO). Visar bara
 * kortantalet (krymper i takt med given), avslöjar ingenting.
 * `orientation` 'h' = topp (Nord, vågrätt), 'v' = sida (Öst/Väst, lodrätt).
 */
export function FaceDownFan({ count, orientation }: { count: number; orientation: 'h' | 'v' }) {
  if (count <= 0) return null
  const horizontal = orientation === 'h'
  return (
    <div className={horizontal ? 'flex justify-center' : 'flex flex-col items-center'}>
      {Array.from({ length: count }).map((_, i) => (
        <PlayingCard
          key={i}
          faceDown
          size="smPlus"
          className={i > 0 ? (horizontal ? '-ml-8' : '-mt-12') : ''}
        />
      ))}
    </div>
  )
}

/** Din hand som solfjäder (Syd): färggrupper, vald färg lyfts, trumf vänster. */
export function SouthFan({
  hand,
  contract,
  play,
  onCardClick,
  selectedSuit,
  registerCardEl,
}: {
  hand: Hand
  contract: Contract
  play: PlayState
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
  /** Kortflygningens ref-register (etapp 3): källkortets läge mäts härifrån. */
  registerCardEl?: RegisterCardEl
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, 'S')
  let dealt = 0 // löpande kortindex över alla färggrupper → utdelningskaskaden
  return (
    <div className="flex items-end justify-center">
      {handSuitsTrumpFirst(contract.strain).map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        const spread = myTurn && suit === selectedSuit
        // Tryck på en färg → visa BARA den färgen (Synrey, ägarbeslut 2026-07-31):
        // övriga färger göms helt (inte nedtonade) tills man går tillbaka.
        if (myTurn && selectedSuit !== null && !spread) return null
        return (
          <div
            key={suit}
            className={`flex transition-all ${spread ? '-translate-y-1.5 z-10 sm:gap-1 sm:mx-1' : ''}`}
          >
            {cards.map((c, i) => {
              const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
              // Stora kort (xl). Vilande: eget större överlapp (SouthFan är nu
              // större än budgivningens HandFan). Vald färg (spread): visas ensam
              // → luftig utfällning så korten blir rejält stora och lättträffade.
              const ml = i === 0 ? '' : spread ? '-ml-2 sm:ml-0' : '-ml-12 sm:-ml-6'
              return (
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  ref={registerCardEl?.(`${c.suit}${c.rank}`)}
                  card={c}
                  size="xl"
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
