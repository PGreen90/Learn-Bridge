// Händerna på spelbordet: Nord-sidans öppna hand som färgkolumner, Syds
// kortrad och Ö/V-träkarlarnas kortordning. Två-klicks-spelet: klick i en
// färg väljer (fäller ut) den, klick i vald färg spelar kortet.
// Kortregeln (ägarbeslut 2026-09-15): ENDAST träkarlen ligger som färgkolumner
// (`SuitColumns`), spelföraren ALLTID som kortrad (`SouthFan` med `seat`) —
// oavsett om det är Nord eller Syd. Nord och Syd ligger aldrig i kolumner
// samtidigt (två kolumnhänder ryms inte på en mobilskärm). Kolumnroten bär
// `data-kolumner=<stol>` så facit-testerna kan skilja vyerna.

import { useLayoutEffect, useRef, useState } from 'react'
import type { Card, Hand, Seat, Suit } from '../../types/bridge'
import type { Contract, PlayState } from '../../lib/engine/play'
import { bySuit, FLAT_OVERLAP, handSuitsTrumpFirst } from '../../lib/cardLayout'
import { PlayingCard } from '../../components/PlayingCard'
import { turnInfo } from './common'
import type { FeltTone } from '../../components/Felt'
import { ALLA_FARGER_BREDD, AllaFargerKnapp } from './SpelbordRam'
import type { RegisterCardEl } from './useCardFlight'

/**
 * En öppen hand som färgkolumner (Synrey-träkarlen): en lodrät kolumn per färg,
 * trumfen i vänstra kolumnen, högsta kortet överst. Två-klicks-spelet: klick i
 * en färg väljer den (guldkant på det tryckta kortet; kolumnen ligger stilla),
 * klick i vald färg spelar kortet.
 */
export function SuitColumns({
  hand,
  contract,
  play,
  seat,
  onCardClick,
  selectedSuit,
  registerCardEl,
  kompakt = false,
  onDeselect,
  tone = 'club',
}: {
  /** Tillbaka till alla färger — ritar "◀ Alla färger" intill handen. */
  onDeselect?: () => void
  tone?: FeltTone
  hand: Hand
  contract: Contract
  play: PlayState
  seat: Seat
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
  /** Kortflygningens ref-register (etapp 3): källkortets läge mäts härifrån. */
  registerCardEl?: RegisterCardEl
  /** Kompakt (uppvändningen på telefon, ägarbeslut 2026-09-24): lg-kort 48×64
   *  med 24 px synlig remsa (-mt-10) — bordets geometri ryms på en telefon. */
  kompakt?: boolean
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, seat)
  // Kortet du tryckte på när färgen valdes → guldkant (etapp B).
  const [armed, setArmed] = useState<string | null>(null)
  const valdHar = myTurn && selectedSuit !== null && bySuit(hand, selectedSuit).length > 0
  return (
    <div data-kolumner={seat} className={`relative flex items-start justify-center ${kompakt ? 'gap-1' : 'gap-1.5'}`}>
      {valdHar && onDeselect && (
        <AllaFargerKnapp tone={tone} plats={seat === 'N' ? 'under' : 'over'} onClick={onDeselect} />
      )}
      {handSuitsTrumpFirst(contract.strain).map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        const spread = myTurn && suit === selectedSuit
        return (
          <div
            key={suit}
            className="flex flex-col"
          >
            {cards.map((c, i) => {
              const key = `${c.suit}${c.rank}`
              const playable = myTurn && legalSet.has(key)
              return (
                // Träkarlen: aldrig transparenta kort (ägarbeslut 2026-07-31) —
                // dimning borttagen, korten alltid fullt synliga. Fasta xl-kort
                // (64×96) med FAST 60 px synlig remsa per täckt kort (-mt-9 =
                // 36 px överlapp; ägarbeslut 2026-08-02 "C, fast" — remsan gör
                // att täckta kort läser som kort, inte stubbar). Vald färg
                // ligger STILLA (etapp A 2026-11-15; förut expanderade kolumnen
                // till 68 px och lyftes, så kortet gled undan under pekaren) —
                // valet syns på guldkanten runt det tryckta kortet.
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  ref={registerCardEl?.(`${c.suit}${c.rank}`)}
                  card={c}
                  size={kompakt ? 'lg' : 'xl'}
                  playable={playable}
                  vald={spread && playable && armed === key}
                  onClick={
                    playable
                      ? () => {
                          if (selectedSuit !== c.suit) setArmed(key)
                          onCardClick(c)
                        }
                      : undefined
                  }
                  className={i > 0 ? (kompakt ? '-mt-10' : '-mt-9') : ''}
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
  kompakt = false,
}: {
  hand: Hand
  contract: Contract
  side: 'W' | 'E'
  registerCardEl?: RegisterCardEl
  /** Kompakt (uppvändningen på telefon, 2026-09-24): lg-kort (vridna 64×48) med
   *  16 px valörremsa (-ml-12) — samma proportion som xl-högarna. */
  kompakt?: boolean
}) {
  const suits = handSuitsTrumpFirst(contract.strain)
  const rows = side === 'E' ? suits : [...suits].reverse()
  return (
    <div className={`flex flex-col ${kompakt ? 'gap-0.5' : 'gap-1'} ${side === 'E' ? 'items-end' : 'items-start'}`}>
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
                className={`relative flex items-center justify-center ${kompakt ? `h-12 w-16 ${i > 0 ? '-ml-12' : ''}` : `h-16 w-24 ${i > 0 ? '-ml-20' : ''}`}`}
                style={side === 'E' ? { zIndex: cards.length - i } : undefined}
              >
                <PlayingCard
                  ref={registerCardEl?.(`${c.suit}${c.rank}`)}
                  card={c}
                  size={kompakt ? 'lg' : 'xl'}
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

/** Spelförarens hand som kortrad: färgsorterad med trumf längst till vänster,
 *  ETT jämnt överlapp över hela raden (inget glapp mellan färgerna), vald färg
 *  visas ensam och utfälld. Normalt din egen hand (Syd); när Nord spelför och
 *  Syd är träkarl ritas Nords hand med samma kortrad upptill (`seat="N"`). */
export function SouthFan({
  hand,
  contract,
  play,
  seat = 'S',
  onCardClick,
  selectedSuit,
  registerCardEl,
  onDeselect,
  tone = 'club',
}: {
  /** Tillbaka till alla färger — ritar "◀ Alla färger" intill vald färg. */
  onDeselect?: () => void
  tone?: FeltTone
  hand: Hand
  contract: Contract
  play: PlayState
  /** Vems hand raden är (turen + lagliga kort räknas för den stolen). */
  seat?: Seat
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
  /** Kortflygningens ref-register (etapp 3): källkortets läge mäts härifrån. */
  registerCardEl?: RegisterCardEl
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, seat)
  // Utfällningen ankras på det TRYCKTA kortet (ägarkrav 2026-11-15): kortet ska
  // ligga kvar under fingret/pekaren när färgen fälls ut, i stället för att
  // färgen centreras på skärmen. Vid trycket mäts kortets vänsterkant; raden
  // skjuts sedan i sidled så samma kort hamnar på samma ställe. Raden hålls
  // innanför ytan — i en smal kant kan kortet därför inte alltid ligga exakt
  // kvar. Tillbaka till alla färger GLIDER på samma sätt (etapp B): kortet
  // startar där det låg utfällt och glider hem till sin plats i raden.
  const rowRef = useRef<HTMLDivElement>(null)
  const groupEls = useRef(new Map<Suit, HTMLDivElement>())
  const anchor = useRef<{ suit: Suit; index: number; left: number; antal: number } | null>(null)
  const forraSpread = useRef<Suit | null>(null)
  // Kortet du tryckte på när färgen valdes → guldkant (etapp B).
  const [armed, setArmed] = useState<string | null>(null)
  const spreadSuit = myTurn ? selectedSuit : null
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const a = anchor.current
    const fran = forraSpread.current
    forraSpread.current = spreadSuit
    const farg = spreadSuit ?? fran
    const group = farg ? groupEls.current.get(farg) : undefined
    const kort = group ? group.querySelectorAll<HTMLElement>('[data-kort]') : undefined
    // Samma färg och samma antal kort som vid trycket — annars (kortet spelades,
    // ny giv) finns inget att ankra på och raden nollställs bara.
    const cardEl = a && kort && a.suit === farg && kort.length === a.antal ? kort[a.index] : undefined
    const fore = cardEl?.getBoundingClientRect().left
    row.style.transition = 'none'
    row.style.left = ''
    if (!spreadSuit) anchor.current = null
    if (!a || !cardEl || !kort || fore === undefined) return
    // Korten har en CSS-övergång på överlappet (PlayingCard: transition-all),
    // så layouten är inte framme här. Raden får därför glida med SAMMA övergång
    // som korten:
    //  1) startläge (ingen övergång): kortet exakt där det låg nyss,
    //  2) slutläge (med övergång): utfällt = kortets plats vid trycket (räknas
    //     ut: kortbredd + utfällt överlapp, gruppen centrerad); hopfällt = 0.
    const nu = cardEl.getBoundingClientRect().left
    let start: number
    let slut = 0
    if (spreadSuit) {
      const UTFALLT_OVERLAPP = 8 // -ml-2 i kortraden nedan
      const rowBox = row.getBoundingClientRect()
      const w = cardEl.offsetWidth
      const steg = w - UTFALLT_OVERLAPP
      const bredd = w + (kort.length - 1) * steg
      const gruppVanster = rowBox.left + (rowBox.width - bredd) / 2
      start = a.left - nu
      slut = a.left - (gruppVanster + a.index * steg)
      // Håll den utfällda färgen innanför ytan (smal skärm, kort nära kanten) —
      // och "◀ Alla färger" ovanför den, som kan vara bredare än ett ensamt kort.
      const kant = 4 + Math.max(0, (ALLA_FARGER_BREDD - bredd) / 2)
      const minSlut = rowBox.left + kant - gruppVanster
      const maxSlut = rowBox.right - kant - (gruppVanster + bredd)
      slut = minSlut > maxSlut ? 0 : Math.min(maxSlut, Math.max(minSlut, slut))
    } else {
      start = fore - nu
    }
    row.style.left = `${start}px`
    row.getBoundingClientRect() // lås startläget innan övergången slås på
    const kortStil = getComputedStyle(cardEl)
    row.style.transition = `left ${kortStil.transitionDuration.split(',')[0]} ${kortStil.transitionTimingFunction.split(/,(?![^(]*\))/)[0]}`
    row.style.left = `${Math.round(slut)}px`
  }, [spreadSuit])
  const klick = (c: Card, index: number) => {
    if (selectedSuit !== c.suit) {
      const kort = groupEls.current.get(c.suit)?.querySelectorAll<HTMLElement>('[data-kort]')
      const el = kort?.[index]
      anchor.current = el && kort ? { suit: c.suit, index, left: el.getBoundingClientRect().left, antal: kort.length } : null
      setArmed(`${c.suit}${c.rank}`)
    }
    onCardClick(c)
  }
  let dealt = 0 // löpande kortindex över alla färggrupper → utdelningskaskaden
  return (
    <div
      ref={rowRef}
      className="relative flex items-end justify-center"
    >
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
            ref={(el) => {
              if (el) groupEls.current.set(suit, el)
              else groupEls.current.delete(suit)
            }}
            className={`relative flex transition-all ${spread ? '-translate-y-1.5 z-10' : ''}`}
          >
            {spread && onDeselect && (
              <AllaFargerKnapp tone={tone} plats={seat === 'N' ? 'under' : 'over'} onClick={onDeselect} />
            )}
            {cards.map((c, i) => {
              const key = `${c.suit}${c.rank}`
              const playable = myTurn && legalSet.has(key)
              const vald = spread && playable && armed === key
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
                  vald={vald}
                  onClick={playable ? () => klick(c, i) : undefined}
                  className={`deal-in ${ml} ${vald ? '-translate-y-2 shadow-lg z-20' : ''}`}
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
