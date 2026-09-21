// STÖRD ÖVERFÖRING EFTER VÅRT 1NT (ägarens regler 2026-09-20, live-fynd
// tävlingsbricka 5 — systemboken §7.5). Fjärde hand bjuder en färg EFTER
// svararens överföring:
//
//   1NT – (pass / X / 2x) – överföring – (färgbud) – ?
//
//   • Öppnaren med 3–4 korts stöd i den överförda färgen låter POÄNGEN styra —
//     räknade med fördelning (Bergenpoäng, fiten är känd) och med oskyddade
//     honnörer i DERAS bjudna färger nedvärderade: under 16 → tävlar med lägsta
//     bud i färgen så länge det ryms på 3-läget, 16+ → utgång.
//   • Öppnaren utan stöd (högst två kort) passar; den allmänna straffdubblingen
//     med säkra trumfstick i deras färg finns kvar.
//   • Svararen: skräpöverföring (målet var att spela 2M) är tyst. Med 8+ hp
//     eller 10+ med fördelning tar svararen oss till utgång: 4M över partnerns
//     tävlingsbud; efter partnerns pass 4M med sexkorts färg, 3NT med fem.
//   • Öppnarens X är STRAFF (ägarbeslut 2026-09-21) — den allmänna straff-
//     dubblingen med säkra trumfstick, ingen konstgjord betydelse.
//
// Gäller lika om 1NT var ostört (1NT–P–2♥–(3♣)) eller stört i direkt sits
// (1NT–(2♣)–2♥–(3♣), inkl. stulet bud X = hjärteröverföring över deras 2♦).
// Dubblar fjärde hand själva överföringsbudet gäller systems on — det ägs av
// nt-systems-on.ts / den ostörda vägen, inte av den här modulen.
//
// Modulen läser BUDEN, aldrig regelnamn — fungerar lika med en människa på
// platsen. Ärlig inferens: bara egen hand + auktionen.

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { maybePenaltyDouble } from './catch-all-continuations'
import { bergenPoints, dummyPoints, unguardedHonorsInTheirSuit } from './evaluation'
import { hcp, lengths } from './hand'
import { side } from './play'

const NEXT: Record<Seat, Seat> = { N: 'E', E: 'S', S: 'W', W: 'N' }
const sym = (s: Suit) => SWE_SYM[letterOfSuit(s)]

/** Gränsen för öppnarens utgångsbud (ägarens regel): 16+ med fördelning. */
export const STORD_OVERFORING_UTGANG = 16
/** Svararens utgångskrav (ägarens regel): 8+ hp ELLER 10+ med fördelning. */
export const SVARARE_UTGANG_HP = 8
export const SVARARE_UTGANG_TP = 10

interface StordOverforing {
  opener: Seat
  /** Den överförda högfärgen. */
  mal: Suit
  /** Allt efter fjärde hands färgbud. */
  after: ResolvedCall[]
}

function lage(f: AuctionFacts): StordOverforing | null {
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1 || !f.weOpened) return null
  const h = f.history
  const i = h.findIndex((c) => c.seat === open.seat && c.bid === '1NT')
  if (i < 0 || h.length < i + 4) return null
  const [inter, resp, fjarde] = [h[i + 1], h[i + 2], h[i + 3]]
  if (inter.seat !== NEXT[open.seat] || resp.seat !== PARTNER[open.seat]) return null

  // Överföringen: 2♦/2♥ (ostört, över deras X eller över ett lägre bud), eller
  // stulet bud X = hjärteröverföring över deras 2♦.
  let mal: Suit | null = null
  if (inter.bid === 'P' || inter.bid === 'X' || inter.bid === '2C') {
    if (resp.bid === '2D') mal = 'hearts'
    else if (resp.bid === '2H') mal = 'spades'
  } else if (inter.bid === '2D') {
    if (resp.bid === 'X') mal = 'hearts'
    else if (resp.bid === '2H') mal = 'spades'
  }
  if (!mal) return null

  // Fjärde hand: ett FÄRGbud i en annan färg än vår (sang/cue i vår färg → utanför).
  const cb = parseContractBid(fjarde.bid)
  if (!cb || cb.strain === 'NT' || SUIT_OF_LETTER[cb.strain] === mal) return null
  return { opener: open.seat, mal, after: h.slice(i + 4) }
}

/** Oskyddade honnörer i alla färger motståndarna bjudit (poäng att dra ifrån). */
function nedvardering(hand: Hand, f: AuctionFacts): number {
  const farger = new Set<Suit>()
  for (const c of f.history) {
    if (side(c.seat) === side(f.seat)) continue
    const cb = parseContractBid(c.bid)
    if (cb && cb.strain !== 'NT') farger.add(SUIT_OF_LETTER[cb.strain])
  }
  let avdrag = 0
  for (const s of farger) avdrag += unguardedHonorsInTheirSuit(hand, s)
  return avdrag
}

function oppnaren(hand: Hand, f: AuctionFacts, l: StordOverforing): ResolvedCall | null {
  if (l.after.length !== 0) return null
  const { seat } = f
  const stod = lengths(hand)[l.mal]
  if (stod < 3) {
    // Inget stöd → ingen plikt att tävla. Uttryckligt pass (annars läser reserv-
    // logiken partnerns överföringsbud som naturlig färg) — men straffdubblingen
    // med säkra trumfstick i deras färg står kvar.
    return maybePenaltyDouble(hand, f) ?? { seat: f.seat, bid: 'P', rule: 'pass', explanation: `Högst två kort i partnerns ${sym(l.mal)} → ingen plikt att tävla, pass.` }
  }

  const L = letterOfSuit(l.mal)
  const legal = legalCalls(f.history, seat)
  const lagsta = ([2, 3, 4] as const).map((n) => `${n}${L}` as Bid).find((b) => legal.includes(b))
  if (!lagsta) return null // de har redan passerat 4M
  const utgang = `4${L}` as Bid

  const avdrag = nedvardering(hand, f)
  const poang = Math.max(hcp(hand), bergenPoints(hand, l.mal).bergenPoints) - avdrag
  const avdragText = avdrag ? `, oskyddade honnörer i deras färg borträknade` : ''

  if (poang >= STORD_OVERFORING_UTGANG) {
    return { seat, bid: utgang, rule: 'störd överföring: utgång', explanation: `3–4 korts stöd i partnerns ${sym(l.mal)} och ${STORD_OVERFORING_UTGANG}+ med fördelning${avdragText} → ${prettyBid(utgang)}.` }
  }
  if (lagsta === utgang) {
    return { seat, bid: 'P', rule: 'pass', explanation: `Stöd i partnerns ${sym(l.mal)} men under ${STORD_OVERFORING_UTGANG} med fördelning${avdragText} — och deras bud har tagit 3-läget → pass.` }
  }
  return { seat, bid: lagsta, rule: 'störd överföring: tävlar', explanation: `3–4 korts stöd i partnerns ${sym(l.mal)}, under ${STORD_OVERFORING_UTGANG} med fördelning${avdragText} → tävlar ${prettyBid(lagsta)} (ingen inbjudan; partnern går till utgång med ${SVARARE_UTGANG_HP}+ hp).` }
}

function svararen(hand: Hand, f: AuctionFacts, l: StordOverforing): ResolvedCall | null {
  // [öppnarens bud, pass] — blandar sig motståndarna i igen ligger det utanför.
  if (l.after.length !== 2 || l.after[0].seat !== l.opener || l.after[1].bid !== 'P') return null
  const { seat } = f
  const oppnarens = l.after[0].bid
  const L = letterOfSuit(l.mal)
  const utgang = `4${L}` as Bid

  if (oppnarens === utgang) {
    return { seat, bid: 'P', rule: 'svararens pass', explanation: `Partnern har bjudit utgången → pass.` }
  }
  const tavlade = oppnarens === `2${L}` || oppnarens === `3${L}`
  if (!tavlade && oppnarens !== 'P') return null // X m.m. — inte reglerat här

  const avdrag = nedvardering(hand, f)
  const p = hcp(hand) - avdrag
  const tp = Math.max(hcp(hand), dummyPoints(hand, l.mal).dummyPoints) - avdrag
  const stark = p >= SVARARE_UTGANG_HP || tp >= SVARARE_UTGANG_TP
  if (!stark) {
    return { seat, bid: 'P', rule: 'svararens pass', explanation: `Överföringen var till spel (under ${SVARARE_UTGANG_HP} hp och under ${SVARARE_UTGANG_TP} med fördelning) → tyst.` }
  }
  const legal = legalCalls(f.history, seat)
  if (tavlade) {
    if (!legal.includes(utgang)) return null
    return { seat, bid: utgang, rule: 'störd överföring: till utgång', explanation: `Partnern visade 3–4 korts stöd; ${SVARARE_UTGANG_HP}+ hp eller ${SVARARE_UTGANG_TP}+ med fördelning → ${prettyBid(utgang)}.` }
  }
  // Öppnaren passade = högst två kort i färgen. Sexkorts färg → 4M (åtta trumf
  // säkrade); femkorts färg → 3NT (ägarbeslut 2026-09-21).
  if (lengths(hand)[l.mal] >= 6) {
    if (!legal.includes(utgang)) return null
    return { seat, bid: utgang, rule: 'störd överföring: till utgång', explanation: `6+ ${sym(l.mal)} och ${SVARARE_UTGANG_HP}+ hp eller ${SVARARE_UTGANG_TP}+ med fördelning → ${prettyBid(utgang)} (partnern har minst två).` }
  }
  if (!legal.includes('3NT' as Bid)) return null
  return { seat, bid: '3NT', rule: 'störd överföring: till utgång', explanation: `Partnern passade (högst två ${sym(l.mal)}); fem ${sym(l.mal)} och ${SVARARE_UTGANG_HP}+ hp eller ${SVARARE_UTGANG_TP}+ med fördelning → 3NT.` }
}

/** Ingången från raden *vårt-1nt-stört*. null → övriga lager. */
export function stordOverforing(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const l = lage(f)
  if (!l) return null
  if (f.seat === l.opener) return oppnaren(hand, f, l)
  if (f.seat === PARTNER[l.opener]) return svararen(hand, f, l)
  return null
}
