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
  // Väst och Öst är SPEGELBILDER (ägarbeslut 2026-08-02 — förr roterades båda
  // åt samma håll och Öst fick hörnen speglade, vilket gav fel orientering):
  //  - Väst (+90°, medurs): indexremsan hamnar i kortets ÖVERKANT med valören i
  //    högra änden = mot bordets mitt. Senare kort målas ovanpå → överkanterna syns.
  //  - Öst (−90°, moturs): indexremsan hamnar i UNDERKANTEN med valören i vänstra
  //    änden = mot mitten. Därför målas Östs kort i OMVÄND ordning (z-index:
  //    första kortet överst) så det är underkanterna som syns.
  // Kortet är större på mobil (`smPlus` = 40×56 → vridet 56×40) och krymper till
  // `sm` (28×40 → vridet 40×28) från `sm:`-brytpunkten. Wrapper-måtten och
  // överlappet (-mt) följer med responsivt så indexremsan blir lika bred.
  return (
    <div className="flex w-14 shrink-0 flex-col items-center sm:w-10">
      {cards.map((c, i) => (
        <div
          key={`${c.suit}${c.rank}`}
          className={`relative flex h-10 w-14 items-center justify-center sm:h-7 sm:w-10 ${i > 0 ? '-mt-7 sm:-mt-4' : ''}`}
          style={side === 'E' ? { zIndex: cards.length - i } : undefined}
        >
          <PlayingCard
            ref={registerCardEl?.(`${c.suit}${c.rank}`)}
            card={c}
            size="smPlus"
            className={side === 'E' ? '-rotate-90' : 'rotate-90'}
          />
        </div>
      ))}
    </div>
  )
}
