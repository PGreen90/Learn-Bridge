// OVANLIG 2NT — FORTSÄTTNINGEN, OSTÖRD (systemboken §7.2). Ägarbeslut
// 2026-09-21/22: "ta så mycket från Michaels som går att anpassa hit" + fyra
// besked om lågfärgsfiten. Förebild: michaels-continuations.ts.
//
//   (1x) – 2NT [två LÄGSTA objudna] – (pass) – ?   … motståndarna tysta hela vägen.
//   över 1♥/1♠ = ♣+♦ · över 1♦ = ♣+♥ · över 1♣ = ♦+♥.
//
// ADVANCERN (partnern får aldrig passa ostört):
//   • preferens på lägsta nivå (3-läget) = AVSLUT, kan ha 0 poäng; 3+ hjärter →
//     hjärter (som Michaels-högfärgen), annars den längre färgen, lika → den
//     BILLIGARE;
//   • cue i deras färg = utgångsintresse, krav. HJÄRTERFIT (över 1♣/1♦): 8+ hp
//     och 3+ hjärter, som Michaels. LÅGFÄRGSFIT över 1♥/1♠: cuen (3♥/3♠) ligger
//     ÖVER preferensnivån och tvingar till 4-läget → 11+ hp och 3+ stöd (ägarbesked);
//   • hopp 4m = spärr: under 8 hp med fyrkorts stöd;
//   • 5m direkt = stöd och 12+ hp (över en högfärg: FYRKORTS stöd — med trekorts
//     stöd frågar cuen först; över en lågfärg finns ingen lågfärgscue);
//   • 3NT = avslut: 15+ hp, inget trekorts stöd, stopp i deras färg;
//   • EGEN FÄRG: sexkortsfärg BARA med högst ETT kort i BÅDA partnerns färger.
// INKLIVAREN efter avslutet:
//   • lågfärg (ägarbesked, "ett snäpp högre" — elva stick): t.o.m. 16 hp pass ·
//     17–19 inbjudan 4m · 20+ 5m;
//   • hjärter: preferensen ligger redan på 3-läget → 18+ 4♥, annars pass (Michaels);
//   • efter cuen: t.o.m. 10 hp billigaste färgen på lägsta nivå; 11+ = utgångskrav
//     (hjärterfit: 4♥ · lågfärg: 4♦, eller 5m med sexkorts lågfärg);
//   • efter spärrhoppet: 16+ → 5m, annars pass.
// ADVANCERNS ANDRA TUR: accepterar 4m-inbjudan med 8+ hp; efter cuen placerar hon
//   kontraktet i sin fit (mot svagt svar: 4♥ med 12+ / 5m med 15+, annars stopp).
// SLAM = systems on (ägarbeslut 2026-09-21): är poängen BEKRÄFTADE för slam (egen
//   hp + partnerns visade minimum ≥ 33) och vi ligger på 4-läget → 4NT (1430 RKC),
//   även med lågfärg som trumf. Dessutom den vanliga konkurrens-slamraden vid hjärterfit.
//
// Blandar sig motståndarna i efter 2NT gäller de äldre reglerna (advanceTwoSuiter,
// twoSuiterContinues) — modulen svarar då null. Läser BUDEN, aldrig regelnamn.
// Ärlig inferens: bara egen hand + auktionen.

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { competitiveSlamTry, confirmedSlamAsk } from './competitive-slam'
import { hcp, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { Kunskap } from './overcall-continuations'
import { side } from './play'

/** Trösklar (hp). Michaels-värdena där de går att föra över; lågfärgstrappan = ägarbesked. */
export const OVANLIG_2NT = {
  cueHjarter: 8, // advancerns cue med hjärterfit (Michaels)
  cueLag: 11, // advancerns cue över 1♥/1♠ (ägarbesked: högre golv)
  sparr: 8, // spärrhoppet: UNDER 8 hp
  direktUtgang: 12, // advancerns 5m direkt
  sang: 15, // advancerns 3NT
  inbjudanLag: 17, // inklivaren efter 3m: 17–19 → 4m
  utgangLag: 20, // … 20+ → 5m
  utgangHjarter: 18, // inklivaren efter 3♥: 18+ → 4♥
  accept: 8, // advancern accepterar 4m
  starkEfterCue: 11, // inklivaren efter cuen: 11+ = utgångskrav
  utgangMotSvagHjarter: 12, // advancern mot svagt svar: 4♥
  utgangMotSvagLag: 15, // … 5m
  efterSparr: 16, // inklivaren efter spärrhoppet
} as const

const ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

interface Lage {
  ink: Seat
  adv: Seat
  their: Suit
  theirL: string
  /** Partnerns två färger, den billigare först. */
  visade: [Suit, Suit]
  /** Den fjärde färgen (varken deras eller partnerns). */
  fjarde: Suit
  /** Visar 2NT hjärter (deras öppning var en lågfärg)? */
  hjarter: boolean
  /** Vår sidas bud efter 2NT, i ordning (advancern först). */
  ours: ResolvedCall[]
}

function lage(f: AuctionFacts): Lage | null {
  const open = f.opening
  if (!open || f.weOpened || open.level !== 1 || open.strain === 'NT') return null
  const h = f.history
  const oi = h.findIndex((c) => c.seat === open.seat && parseContractBid(c.bid))
  const ci = h.findIndex((c, i) => i > oi && c.bid !== 'P')
  if (ci < 0) return null
  const nt = h[ci]
  if (side(nt.seat) !== side(f.seat) || nt.bid !== '2NT') return null
  const tail = h.slice(ci + 1)
  if (tail.some((c) => side(c.seat) !== side(f.seat) && c.bid !== 'P')) return null // de blandade sig i → äldre regler
  const their = SUIT_OF_LETTER[open.strain]
  const objudna = ORDER.filter((s) => s !== their)
  return {
    ink: nt.seat, adv: PARTNER[nt.seat], their, theirL: open.strain,
    visade: [objudna[0], objudna[1]], fjarde: objudna[2],
    hjarter: objudna[1] === 'hearts',
    ours: tail.filter((c) => side(c.seat) === side(f.seat)),
  }
}

const sym = (s: Suit) => SWE_SYM[letterOfSuit(s)]
const bud = (n: number, s: Suit) => `${n}${letterOfSuit(s)}` as Bid
const arLag = (s: Suit) => s === 'clubs' || s === 'diamonds'

/** Advancerns fit: 3+ hjärter → hjärter; annars den längre av partnerns färger, lika → den billigare. */
function fitFarg(hand: Hand, l: Lage): Suit {
  const len = lengths(hand)
  if (l.hjarter && len.hearts >= 3) return 'hearts'
  return len[l.visade[1]] > len[l.visade[0]] ? l.visade[1] : l.visade[0]
}

// ---------------------------------------------------------------------------
// Advancerns första tur
// ---------------------------------------------------------------------------

function advancernForst(hand: Hand, f: AuctionFacts, l: Lage): Kunskap | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const legal = legalCalls(f.history, f.seat)
  const cue = `3${l.theirL}` as Bid
  const O = OVANLIG_2NT

  // Egen sexkortsfärg: bara med högst ETT kort i BÅDA partnerns färger.
  if (len[l.fjarde] >= 6 && l.visade.every((s) => len[s] <= 1)) {
    const b = bud(3, l.fjarde)
    if (legal.includes(b)) {
      return { call: b, rule: 'advance ovanlig 2NT: egen färg', explanation: `Högst ett kort i båda partnerns färger och en egen sexkorts ${sym(l.fjarde)} → ${prettyBid(b)} (naturligt, ej krav).` }
    }
  }
  if (p >= O.sang && l.visade.every((s) => len[s] <= 2) && hasStopper(hand, l.their) && legal.includes('3NT' as Bid)) {
    return { call: '3NT', rule: 'advance ovanlig 2NT: 3NT', explanation: `Stark hand utan trekorts stöd i partnerns färger och med stopp i deras ${sym(l.their)} → 3NT (avslut).` }
  }

  const fit = fitFarg(hand, l)
  const pref = bud(3, fit)
  const preferens = (text: string): Kunskap | null =>
    legal.includes(pref) ? { call: pref, rule: 'advance tvåfärg (preferens)', explanation: text } : null

  if (fit === 'hearts') {
    if (len.hearts >= 3 && p >= O.cueHjarter && legal.includes(cue)) {
      return { call: cue, rule: 'advance ovanlig 2NT: cue (utgångsintresse)', explanation: `${O.cueHjarter}+ hp och 3+ stöd i partnerns ${sym('hearts')} → cue ${prettyBid(cue)}: utgångsintresse, krav. Partnern visar sin styrka.` }
    }
    return preferens(`Preferens till partnerns ${sym('hearts')} på lägsta nivå → 3♥ (avslut; budet är tvingat).`)
  }

  // Lågfärgsfit.
  const utgang = bud(5, fit)
  const stodForUtgang = l.hjarter ? 3 : 4 // över en högfärg frågar cuen först med trekorts stöd
  if (p >= O.direktUtgang && len[fit] >= stodForUtgang && legal.includes(utgang)) {
    return { call: utgang, rule: 'advance ovanlig 2NT: utgång', explanation: `Stöd i partnerns ${sym(fit)} och ${O.direktUtgang}+ hp → ${prettyBid(utgang)}.` }
  }
  if (!l.hjarter && p >= O.cueLag && len[fit] >= 3 && legal.includes(cue)) {
    return { call: cue, rule: 'advance ovanlig 2NT: cue (utgångsintresse)', explanation: `${O.cueLag}+ hp och 3+ stöd i en av partnerns lågfärger → cue ${prettyBid(cue)}: utgångsintresse, krav (cuen tvingar till 4-läget, därför ${O.cueLag}+). Partnern visar sin styrka.` }
  }
  const hopp = bud(4, fit)
  if (p < O.sparr && len[fit] >= 4 && legal.includes(hopp)) {
    return { call: hopp, rule: 'advance ovanlig 2NT: spärrhöjning', explanation: `Fyrkorts stöd i partnerns ${sym(fit)} och en svag hand → spärrhopp ${prettyBid(hopp)} (ingen inbjudan).` }
  }
  return preferens(`Preferens till partnerns ${sym(fit)} på lägsta nivå → ${prettyBid(pref)} (avslut; budet är tvingat — lika längd → den billigare färgen).`)
}

// ---------------------------------------------------------------------------
// Inklivarens andra tur
// ---------------------------------------------------------------------------

function inklivarenAndra(hand: Hand, f: AuctionFacts, l: Lage): Kunskap | null {
  const a = l.ours[0].bid
  const acb = parseContractBid(a)
  if (!acb) return null
  const p = hcp(hand)
  const len = lengths(hand)
  const legal = legalCalls(f.history, f.seat)
  const O = OVANLIG_2NT
  const pass = (rule: string, explanation: string): Kunskap => ({ call: 'P', rule, explanation })

  // Partnerns cue: visa styrkan.
  if (acb.strain === l.theirL && acb.level === 3) {
    if (p < O.starkEfterCue) {
      // Billigaste färgen på lägsta nivå: den första lagliga av 3x/4x i mina färger.
      const svagt = [3, 4].flatMap((n) => l.visade.map((s) => bud(n, s))).find((b) => legal.includes(b))
      return svagt ? { call: svagt, rule: 'efter ovanlig 2NT: svag efter cue', explanation: `Partnerns cue frågar efter styrkan: under ${O.starkEfterCue} hp → billigaste färgen på lägsta nivå, ${prettyBid(svagt)}.` } : null
    }
    if (l.hjarter) return { call: '4H', rule: 'efter ovanlig 2NT: stark efter cue', explanation: `${O.starkEfterCue}+ hp mot partnerns utgångsintresse med hjärterstöd → 4♥.` }
    const sex = l.visade.find((s) => len[s] >= 6)
    if (sex) return { call: bud(5, sex), rule: 'efter ovanlig 2NT: stark efter cue', explanation: `${O.starkEfterCue}+ hp och sexkorts ${sym(sex)} → ${prettyBid(bud(5, sex))}.` }
    return { call: '4D', rule: 'efter ovanlig 2NT: stark efter cue', explanation: `${O.starkEfterCue}+ hp → 4♦: utgångskrav (partnern väljer utgång i sin fit; 4♣ hade varit det svaga svaret).` }
  }
  if (a === '3NT') return pass('pass', 'Partnerns 3NT är ett avslut → pass.')

  const s = SUIT_OF_LETTER[acb.strain]
  if (s === l.fjarde) return pass('pass', `Partnern introducerade en egen sexkorts ${sym(s)} (högst ett kort i båda mina färger) → pass.`)
  if (!l.visade.includes(s)) return null

  if (s === 'hearts') {
    if (acb.level >= 4) return pass('pass', 'Partnern har bjudit utgången → pass.')
    return p >= O.utgangHjarter && legal.includes('4H' as Bid)
      ? { call: '4H', rule: 'efter ovanlig 2NT: utgång', explanation: `Partnerns preferens kan vara 0 poäng, men ${O.utgangHjarter}+ hp och 5-5 → 4♥.` }
      : pass('efter ovanlig 2NT: passar avslutet', `Partnerns preferens var tvingad och kan vara 0 poäng; under ${O.utgangHjarter} hp → pass.`)
  }

  // Lågfärg: utgången ligger på 5-läget.
  const utgang = bud(5, s)
  if (acb.level >= 5) return pass('pass', 'Partnern har bjudit utgången → pass.')
  if (acb.level === 4) {
    return p >= O.efterSparr && legal.includes(utgang)
      ? { call: utgang, rule: 'efter ovanlig 2NT: utgång', explanation: `Partnern visade fyrkorts stöd (spärr); ${O.efterSparr}+ hp → ${prettyBid(utgang)}.` }
      : pass('efter ovanlig 2NT: passar avslutet', `Partnerns hopp var spärr; under ${O.efterSparr} hp → pass.`)
  }
  if (p >= O.utgangLag && legal.includes(utgang)) {
    return { call: utgang, rule: 'efter ovanlig 2NT: utgång', explanation: `Partnerns preferens kan vara 0 poäng, men ${O.utgangLag}+ hp och 5-5 → ${prettyBid(utgang)}.` }
  }
  const inbjudan = bud(4, s)
  if (p >= O.inbjudanLag && legal.includes(inbjudan)) {
    return { call: inbjudan, rule: 'efter ovanlig 2NT: inbjudan', explanation: `Partnerns preferens var tvingad (kan vara 0 poäng); ${O.inbjudanLag}–${O.utgangLag - 1} hp → ${prettyBid(inbjudan)} (inbjudan — partnern bjuder utgång med ${O.accept}+ hp).` }
  }
  return pass('efter ovanlig 2NT: passar avslutet', `Partnerns preferens var tvingad och kan vara 0 poäng; under ${O.inbjudanLag} hp → pass.`)
}

// ---------------------------------------------------------------------------
// Advancerns andra tur
// ---------------------------------------------------------------------------

function advancernAndra(hand: Hand, f: AuctionFacts, l: Lage): Kunskap | null {
  const [a, b] = [l.ours[0].bid, l.ours[1].bid]
  const acb = parseContractBid(a)
  const bcb = parseContractBid(b)
  if (!acb) return null
  const p = hcp(hand)
  const legal = legalCalls(f.history, f.seat)
  const O = OVANLIG_2NT
  const pass = (explanation: string, rule = 'pass'): Kunskap => ({ call: 'P', rule, explanation })
  if (!bcb) return b === 'P' ? pass('Partnern passade → pass.') : null

  // Jag cue-bjöd → placera kontraktet i min fit.
  if (acb.strain === l.theirL) {
    const fit = fitFarg(hand, l)
    const hj = fit === 'hearts'
    const utgang = bud(hj ? 4 : 5, fit)
    const stark = l.hjarter ? bcb.level >= 4 : b !== '4C'
    if (stark) {
      // Slam = systems on. Poängbekräftad (33+ mot partnerns visade 11) → 4NT i fiten, när
      // partnerns bud ligger i den (essfrågan läser sidans senaste naturliga färg som trumf).
      if (SUIT_OF_LETTER[bcb.strain] === fit) {
        const bekraftad = confirmedSlamAsk(hand, f, O.starkEfterCue, fit)
        if (bekraftad) return bekraftad
      }
      if (hj) {
        // Den vanliga konkurrens-slamraden, med partnerns starka svar som visad extra.
        const slam = competitiveSlamTry(hand, f, { partnerShowedExtra: true })
        if (slam) return slam
      }
      if (b === utgang || bcb.level >= 5) return pass('Partnern har bjudit utgången → pass.')
      return legal.includes(utgang) ? { call: utgang, rule: 'efter ovanlig 2NT: utgång efter cue', explanation: `Partnern visade ${O.starkEfterCue}+ hp (utgångskrav) → ${prettyBid(utgang)} i min fit.` } : null
    }
    const grans = hj ? O.utgangMotSvagHjarter : O.utgangMotSvagLag
    if (p >= grans && legal.includes(utgang)) {
      return { call: utgang, rule: 'efter ovanlig 2NT: utgång efter cue', explanation: `Partnern är svag, men ${grans}+ hp och fit → ${prettyBid(utgang)}.` }
    }
    if (SUIT_OF_LETTER[bcb.strain] === fit) return pass(`Partnern är svag (under ${O.starkEfterCue} hp) och budet ligger i min fit → pass.`, 'efter ovanlig 2NT: stannar efter cue')
    const stopp = bud(bcb.level, fit)
    return legal.includes(stopp) ? { call: stopp, rule: 'efter ovanlig 2NT: stannar efter cue', explanation: `Partnern är svag (under ${O.starkEfterCue} hp); min fit är ${sym(fit)} → ${prettyBid(stopp)} (till spel).` } : null
  }

  // Jag gjorde avslut → partnern bjöd igen i samma färg.
  const s = SUIT_OF_LETTER[acb.strain]
  if (bcb.strain !== acb.strain) return null
  if (bcb.level >= (arLag(s) ? 5 : 4)) return pass('Partnern har bjudit utgången → pass.')
  if (arLag(s) && acb.level === 3 && bcb.level === 4) {
    // Partnerns inbjudan visar 17+: poängbekräftad slam → 4NT, systems on (lågfärgen är överenskommen).
    const bekraftad = confirmedSlamAsk(hand, f, O.inbjudanLag, s)
    if (bekraftad) return bekraftad
    const utgang = bud(5, s)
    return p >= O.accept && legal.includes(utgang)
      ? { call: utgang, rule: 'efter ovanlig 2NT: accepterar inbjudan', explanation: `Partnern inbjöd (${O.inbjudanLag}–${O.utgangLag - 1} hp); ${O.accept}+ hp → ${prettyBid(utgang)}.` }
      : pass(`Partnern inbjöd; under ${O.accept} hp → pass.`, 'efter ovanlig 2NT: avböjer inbjudan')
  }
  return null
}

/** Ingången från raderna *advance*, *inkliv2* och *advance2*. null → övriga regler. */
export function unusual2NTContinues(hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = lage(f)
  if (!l) return null
  const n = l.ours.length
  if (f.seat === l.adv) {
    if (n === 0) return advancernForst(hand, f, l)
    if (n === 2) return advancernAndra(hand, f, l)
    return null
  }
  if (f.seat === l.ink) {
    if (n === 1) return inklivarenAndra(hand, f, l)
    // Tredje turen: partnern har placerat kontraktet → pass.
    // (4NT är essfrågan från den vanliga slamraden — den besvaras av slamreglerna, inte här.)
    if (n === 3 && parseContractBid(l.ours[2].bid) && l.ours[2].bid !== '4NT') return { call: 'P', rule: 'pass', explanation: 'Partnern har placerat kontraktet → pass.' }
  }
  return null
}
