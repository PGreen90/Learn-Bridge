// Händerna på spelbordet: Nord-sidans öppna hand som färgkolumner, Syds
// solfjäder och Ö/V-träkarlarnas kortordning. Två-klicks-spelet: klick i en
// färg väljer (fäller ut) den, klick i vald färg spelar kortet.

import type { Card, Hand, Seat, Suit } from '../../types/bridge'
import type { Contract, PlayState } from '../../lib/engine/play'
import { bySuit, FLAT_OVERLAP, handSuitsTrumpFirst } from '../../lib/cardLayout'
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
                // dimning borttagen, korten alltid fullt synliga. Fasta xl-kort
                // (64×96) med FAST 60 px synlig remsa per täckt kort (-mt-9 =
                // 36 px överlapp; ägarbeslut 2026-08-02 "C, fast" — remsan gör
                // att täckta kort läser som kort, inte stubbar). Vald färg
                // (spread) visar 68 px.
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  ref={registerCardEl?.(`${c.suit}${c.rank}`)}
                  card={c}
                  size="xl"
                  playable={playable}
                  onClick={playable ? () => onCardClick(c) : undefined}
                  className={i > 0 ? (spread ? '-mt-7' : '-mt-9') : ''}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Motståndarnas träkarl på sin RIKTIGA sida, som Synrey (ägarbeslut 2026-08-02):
 * en HÖG per färg, högarna staplade lodrätt, korten ROTERADE 90°. HÖGSTA kortet
 * ligger UNDERST i högen mot bordets utkant (bara valörremsan sticker ut); de
 * lägre läggs ovanpå inåt så det LÄGSTA kortet ligger överst, fullt synligt,
 * närmast mitten. Sticket flyttar samtidigt mot spelförarens sida (se Play.tsx)
 * så högarna får en stor yta → större kort än gamla sidostapeln. Trumfen ligger
 * "till vänster" ur träkarlens EGET perspektiv: Öst (höger sida) → trumfen
 * ÖVERST i bild, Väst → NEDERST. Bara visning — spelföraren (boten) spelar
 * träkarlens kort; ref:arna registreras så kortflygningen hittar startläget.
 */
export function SideDummyPiles({
  hand,
  contract,
  side,
  registerCardEl,
}: {
  hand: Hand
  contract: Contract
  side: 'W' | 'E'
  registerCardEl?: RegisterCardEl
}) {
  const suits = handSuitsTrumpFirst(contract.strain)
  const rows = side === 'E' ? suits : [...suits].reverse()
  return (
    <div className={`flex flex-col gap-1 ${side === 'E' ? 'items-end' : 'items-start'}`}>
      {rows.map((suit) => {
        const cards = bySuit(hand, suit) // högst → lägst
        if (cards.length === 0) return null
        // Högsta UNDERST mot utkanten, lägsta ÖVERST närmast mitten:
        //  - Öst (höger): stigande vänster→höger; OMVÄND målordning (z-index) så
        //    det vänstra (lägsta) kortet ligger överst → varje täckt korts
        //    HÖGERremsa sticker ut mot utkanten. Rotation +90° lägger valören
        //    ytterst i den remsan.
        //  - Väst (vänster): spegelvänt — fallande vänster→höger, vanlig
        //    målordning (sista/lägsta överst) → VÄNSTERremsorna syns, och
        //    rotation −90° lägger valören ytterst.
        const ordered = side === 'E' ? [...cards].reverse() : cards
        return (
          <div key={suit} className="flex">
            {ordered.map((c, i) => (
              // Fasta xl-kort 64×96 (ägarbeslut 2026-08-02 "C, fast"); vridet
              // tar kortet 96×64 — wrappern har de vridna måtten så överlappet
              // (-ml-20 = 80 px → 16 px synlig valörremsa) räknar på rätt bredd.
              <div
                key={`${c.suit}${c.rank}`}
                className={`relative flex h-16 w-24 items-center justify-center ${i > 0 ? '-ml-20' : ''}`}
                style={side === 'E' ? { zIndex: cards.length - i } : undefined}
              >
                <PlayingCard
                  ref={registerCardEl?.(`${c.suit}${c.rank}`)}
                  card={c}
                  size="xl"
                  className={side === 'E' ? 'rotate-90' : '-rotate-90'}
                />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
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

/** Din hand som kortrad (Syd): färgsorterad med trumf längst till vänster,
 *  ETT jämnt överlapp över hela raden (inget glapp mellan färgerna), vald färg
 *  visas ensam och utfälld. */
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
            className={`flex transition-all ${spread ? '-translate-y-1.5 z-10' : ''}`}
          >
            {cards.map((c, i) => {
              const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
              const idx = dealt++
              // Fasta xl-kort (64×96). Vilande: det delade FLAT_OVERLAP —
              // samma överlapp över hela raden, inga färgglapp (måtten och
              // ägarbesluten står i cardLayout.ts). Vald färg (spread): visas
              // ensam → luftig utfällning.
              const ml = spread ? (i === 0 ? '' : '-ml-2') : idx === 0 ? '' : FLAT_OVERLAP
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
