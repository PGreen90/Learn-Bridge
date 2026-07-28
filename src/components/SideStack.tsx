// En Ö/V-hand som lodrät rad där varje kort ligger VRIDET 90° (Synrey-stil):
// kortets ovansida pekar in mot bordets mitt (Väst medurs, Öst moturs), och
// korten överlappar lodrätt så en index-remsa av varje kort syns. Används av
// både spelvyn (träkarl på sidan) och omspelningen (Väst/Öst upplagda).

import type { Card } from '../types/bridge'
import { PlayingCard } from './PlayingCard'
import type { RegisterCardEl } from '../pages/play/useCardFlight'

export function SideStack({
  cards,
  side,
  registerCardEl,
}: {
  cards: Card[]
  side: 'W' | 'E'
  /** Kortflygningens ref-register (etapp 3) — bara spelvyn skickar den;
   *  omspelningen och budträningen flyger inga kort. */
  registerCardEl?: RegisterCardEl
}) {
  // sm-kortet är 28×40 px; vridet tar det 40×28. Varje kort får en wrapper med
  // de vridna måtten så överlappningen (-mt) räknar på rätt höjd.
  // Valören ska peka IN mot mitten på båda sidor (ägarbeslut 2026-07-02). Ett
  // vridet kort visar indexet i remsans HÖGRA ände (indexen sitter på kortets
  // diagonal, det ändrar ingen rotation) – rätt för Väst, fel för Öst. Östs
  // kort får därför indexen SPEGLADE till andra diagonalen (mirrorCorners) så
  // valören hamnar i vänstra änden = mot mitten.
  // Kortet är större på mobil (`smPlus` = 40×56 → vridet 56×40) och krymper till
  // `sm` (28×40 → vridet 40×28) från `sm:`-brytpunkten. Wrapper-måtten och
  // överlappet (-mt) följer med responsivt så indexremsan blir lika bred.
  return (
    <div className="flex w-14 shrink-0 flex-col items-center sm:w-10">
      {cards.map((c, i) => (
        <div
          key={`${c.suit}${c.rank}`}
          className={`flex h-10 w-14 items-center justify-center sm:h-7 sm:w-10 ${i > 0 ? '-mt-7 sm:-mt-4' : ''}`}
        >
          <PlayingCard
            ref={registerCardEl?.(`${c.suit}${c.rank}`)}
            card={c}
            size="smPlus"
            mirrorCorners={side === 'E'}
            className="rotate-90"
          />
        </div>
      ))}
    </div>
  )
}
