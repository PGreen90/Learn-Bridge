// MICHAELS-FORTSÄTTNINGEN, OSTÖRD (ägarens live-fynd 2026-09-22 — systemboken
// §7.2). Källa: bridgebum.com/michaels.php + ägarens besked samma dag.
//
//   (1x) – 2x [Michaels] – (pass) – ?      … motståndarna tysta hela vägen.
//
// ADVANCERN (partnern får aldrig passa ostört):
//   • preferens på lägsta nivå = AVSLUT, kan ha 0 poäng; lika längd i partnerns
//     högfärger → den BILLIGARE (hjärter) — flyktvägen till spader finns kvar;
//   • cue i deras färg = 8+ hp med 3+ stöd i en högfärg: utgångsintresse, krav;
//   • hopp 3M = spärr: under 8 hp med fyrkorts stöd (lagen om totala stick);
//   • 3NT = avslut: 15+ hp, inget trekorts stöd, stopp i deras färg;
//   • Michaels visar ALLTID de två HÖGSTA objudna färgerna (ägarbeslut
//     2026-09-22; ovanlig 2NT = de två lägsta): över en högfärg alltså den andra
//     högfärgen + RUTER. Båda färgerna är kända — ingen 2NT-fråga, inget
//     pass-eller-rätta. Utan högfärgsstöd ger advancern preferens till ruter.
// INKLIVAREN:
//   • efter avslutet: t.o.m. 14 hp pass · 15–17 inbjudan (3M) · 18+ 4M
//     (ägarens trösklar — "låga, med lite chansning");
//   • efter cuen: t.o.m. 10 hp billigaste färgen på lägsta nivå; 11+ =
//     utgångskrav: 3♠, eller 4M med sexkorts högfärg;
//   • efter spärrhoppet: 16+ → 4M, annars pass · efter ruterpreferensen: pass.
//   • EGEN FÄRG (ägarbeslut 2026-09-22): advancern introducerar en egen sexkorts-
//     färg BARA med högst ETT kort i BÅDA Michaels-färgerna. Ej krav; inklivaren
//     passar.
//   • SLAM = systems on: ingen Michaels-special. Den vanliga konkurrens-slamraden
//     (competitive-slam.ts: stark, kontroll-komplett kapten → 4NT) gäller;
//     inklivarens starka svar på cuen räknas som "partnern visade extra".
// ADVANCERNS ANDRA TUR: accepterar inbjudan med 8+ hp; efter cuen placerar hon
//   kontraktet i sin fit (mot svagt svar: utgång med 12+, annars stopp).
//
// Blandar sig motståndarna i efter Michaels-budet gäller de äldre reglerna
// (advanceTwoSuiter m.fl.) — modulen svarar då null. Läser BUDEN, aldrig
// regelnamn. Ärlig inferens: bara egen hand + auktionen.

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { competitiveSlamTry } from './competitive-slam'
import { hcp, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { Kunskap } from './overcall-continuations'
import { side } from './play'

/** Ägarens trösklar 2026-09-22 (hp). */
export const MICHAELS = {
  inbjudan: 15, // inklivaren efter avslutet: 15–17 → 3M
  utgang: 18, // … 18+ → 4M
  cue: 8, // advancerns cue: 8+ hp med 3+ stöd
  accept: 8, // advancern accepterar inbjudan
  starkEfterCue: 11, // inklivaren efter cuen: 11+ = utgångskrav
  utgangMotSvag: 12, // advancern mot inklivarens svaga svar
  efterSparr: 16, // inklivaren efter spärrhoppet
  sang: 15, // advancerns 3NT
} as const

interface Lage {
  ink: Seat
  adv: Seat
  their: Suit
  theirL: string
  /** Michaels över lågfärg = båda högfärgerna; över högfärg = den andra högfärgen + ruter. */
  overMinor: boolean
  /** Den kända högfärgen när Michaels ligger över en högfärg. */
  M: Suit | null
  /** Vår sidas bud efter Michaels-budet, i ordning (advancern först). */
  ours: ResolvedCall[]
}

function lage(f: AuctionFacts): Lage | null {
  const open = f.opening
  if (!open || f.weOpened || open.level !== 1 || open.strain === 'NT') return null
  const h = f.history
  const oi = h.findIndex((c) => c.seat === open.seat && parseContractBid(c.bid))
  const ci = h.findIndex((c, i) => i > oi && c.bid !== 'P')
  if (ci < 0) return null
  const cue = h[ci]
  if (side(cue.seat) !== side(f.seat) || cue.bid !== `2${open.strain}`) return null
  const tail = h.slice(ci + 1)
  if (tail.some((c) => side(c.seat) !== side(f.seat) && c.bid !== 'P')) return null // de blandade sig i → äldre regler
  const their = SUIT_OF_LETTER[open.strain]
  const overMinor = their === 'clubs' || their === 'diamonds'
  return {
    ink: cue.seat, adv: PARTNER[cue.seat], their, theirL: open.strain, overMinor,
    M: overMinor ? null : their === 'hearts' ? 'spades' : 'hearts',
    ours: tail.filter((c) => side(c.seat) === side(f.seat)),
  }
}

const sym = (s: Suit) => SWE_SYM[letterOfSuit(s)]
const bud = (n: number, s: Suit) => `${n}${letterOfSuit(s)}` as Bid

/** Advancerns fit-högfärg: den längre av partnerns högfärger, lika → hjärter (den billigare). */
function fitMajor(hand: Hand): Suit {
  const len = lengths(hand)
  return len.spades > len.hearts ? 'spades' : 'hearts'
}

// ---------------------------------------------------------------------------
// Advancerns första tur
// ---------------------------------------------------------------------------

function advancernForst(hand: Hand, f: AuctionFacts, l: Lage): Kunskap | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const legal = legalCalls(f.history, f.seat)
  const cue = `3${l.theirL}` as Bid

  // Egen sexkortsfärg: bara med högst ETT kort i BÅDA partnerns färger.
  const visade: Suit[] = l.overMinor ? ['hearts', 'spades'] : [l.M!, 'diamonds']
  const egen = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).find((s) => s !== l.their && !visade.includes(s))!
  if (len[egen] >= 6 && visade.every((s) => len[s] <= 1)) {
    const b = cheapestBidIn(f.history, f.seat, letterOfSuit(egen))
    if (b && parseContractBid(b)!.level <= 3) {
      return { call: b, rule: 'advance Michaels: egen färg', explanation: `Högst ett kort i båda partnerns färger och en egen sexkorts ${sym(egen)} → ${prettyBid(b)} (naturligt, ej krav).` }
    }
  }

  if (l.overMinor) {
    const fit = fitMajor(hand)
    if (p >= MICHAELS.cue && len[fit] >= 3 && legal.includes(cue)) {
      return { call: cue, rule: 'advance Michaels: cue (utgångsintresse)', explanation: `${MICHAELS.cue}+ hp och 3+ stöd i en av partnerns högfärger → cue ${prettyBid(cue)}: utgångsintresse, krav. Partnern visar sin styrka.` }
    }
    if (p < MICHAELS.cue && len[fit] >= 4) {
      const hopp = bud(3, fit)
      return { call: hopp, rule: 'advance Michaels: spärrhöjning', explanation: `Fyrkorts stöd i partnerns ${sym(fit)} och en svag hand → spärrhopp ${prettyBid(hopp)} (nio trumf; ingen inbjudan).` }
    }
    if (p >= MICHAELS.sang && len[fit] <= 2 && hasStopper(hand, l.their) && legal.includes('3NT' as Bid)) {
      return { call: '3NT', rule: 'advance Michaels: 3NT', explanation: `Stark jämn hand utan stöd i partnerns högfärger och med stopp i deras ${sym(l.their)} → 3NT (avslut).` }
    }
    const pref = bud(2, fit)
    return { call: pref, rule: 'advance tvåfärg (preferens)', explanation: `Preferens till partnerns ${sym(fit)} på lägsta nivå → ${prettyBid(pref)} (avslut; lika längd → den billigare färgen).` }
  }

  // Michaels över högfärg: den andra högfärgen M + ruter (de två högsta objudna).
  const M = l.M!
  if (len[M] >= 3) {
    if (l.their === 'hearts') {
      if (p >= MICHAELS.cue && legal.includes(cue)) {
        return { call: cue, rule: 'advance Michaels: cue (utgångsintresse)', explanation: `${MICHAELS.cue}+ hp och 3+ stöd i partnerns ${sym(M)} → cue ${prettyBid(cue)}: utgångsintresse, krav.` }
      }
      if (len[M] >= 4) {
        return { call: '3S', rule: 'advance Michaels: spärrhöjning', explanation: `Fyrkorts stöd i partnerns ${sym(M)} och en svag hand → spärrhopp 3♠.` }
      }
      return { call: '2S', rule: 'advance tvåfärg (preferens)', explanation: `3+ ${sym(M)} → 2♠ (preferens till partnerns högfärg, avslut).` }
    }
    // Deras spader: preferensen ligger redan på 3-läget — inget rum för cue under utgång.
    if (p >= MICHAELS.utgangMotSvag) {
      return { call: '4H', rule: 'advance Michaels: utgång', explanation: `3+ stöd i partnerns ${sym(M)} och ${MICHAELS.utgangMotSvag}+ hp → 4♥.` }
    }
    return { call: '3H', rule: 'advance tvåfärg (preferens)', explanation: `3+ ${sym(M)} → 3♥ (preferens till partnerns högfärg, avslut).` }
  }
  // Inget högfärgsstöd → preferens till partnerns ruter (tvingat, kan vara 0 poäng).
  if (!legal.includes('3D' as Bid)) return null
  return { call: '3D', rule: 'advance tvåfärg (preferens)', explanation: `Inget stöd i partnerns ${sym(M)} → 3♦ (preferens till partnerns ruter, avslut).` }
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
  const pass = (rule: string, explanation: string): Kunskap => ({ call: 'P', rule, explanation })

  // Partnerns cue: visa styrkan.
  if (acb.strain === l.theirL && acb.level === 3) {
    if (l.overMinor) {
      if (p < MICHAELS.starkEfterCue) return { call: '3H', rule: 'Michaels: svag efter cue', explanation: `Partnerns cue frågar efter styrkan: under ${MICHAELS.starkEfterCue} hp → billigaste färgen på lägsta nivå, 3♥ (säger inget om vilken högfärg som är bäst).` }
      const sex = (['hearts', 'spades'] as Suit[]).find((s) => len[s] >= 6)
      if (sex) return { call: bud(4, sex), rule: 'Michaels: stark efter cue', explanation: `${MICHAELS.starkEfterCue}+ hp och sexkorts ${sym(sex)} → ${prettyBid(bud(4, sex))}.` }
      return { call: '3S', rule: 'Michaels: stark efter cue', explanation: `${MICHAELS.starkEfterCue}+ hp → 3♠: utgångskrav (partnern väljer utgång i sin fit).` }
    }
    return p < MICHAELS.starkEfterCue
      ? { call: '3S', rule: 'Michaels: svag efter cue', explanation: `Partnerns cue frågar efter styrkan: under ${MICHAELS.starkEfterCue} hp → 3♠.` }
      : { call: '4S', rule: 'Michaels: stark efter cue', explanation: `${MICHAELS.starkEfterCue}+ hp mot partnerns utgångsintresse → 4♠.` }
  }
  if (a === '3NT') return pass('pass', 'Partnerns 3NT är ett avslut → pass.')
  if (a === '3D' && !l.overMinor) return pass('Michaels: passar avslutet', 'Partnerns preferens till ruter var tvingad och kan vara 0 poäng → pass.')

  const s = SUIT_OF_LETTER[acb.strain]
  const visad = l.overMinor ? s === 'hearts' || s === 'spades' : s === l.M
  // Partnerns EGEN färg (varken deras eller någon av mina): hon har högst ett kort i båda mina → pass.
  if (!visad && s !== l.their && !(s === 'diamonds' && !l.overMinor)) {
    return pass('pass', `Partnern introducerade en egen sexkorts ${sym(s)} (högst ett kort i båda mina färger) → pass.`)
  }
  if (!visad) return null
  const utgang = bud(4, s)
  if (acb.level >= 4) return pass('pass', 'Partnern har bjudit utgången → pass.')

  // Spärrhoppet: en nivå över den billigaste preferensen.
  const billigast = l.overMinor || l.their === 'hearts' ? 2 : 3
  if (acb.level > billigast) {
    return p >= MICHAELS.efterSparr && legal.includes(utgang)
      ? { call: utgang, rule: 'Michaels: utgång', explanation: `Partnern visade fyrkorts stöd (spärr); ${MICHAELS.efterSparr}+ hp → ${prettyBid(utgang)}.` }
      : pass('Michaels: passar avslutet', `Partnerns hopp var spärr; under ${MICHAELS.efterSparr} hp → pass.`)
  }

  // Avslutet: tvingad preferens som kan vara 0 poäng.
  if (p >= MICHAELS.utgang && legal.includes(utgang)) {
    return { call: utgang, rule: 'Michaels: utgång', explanation: `Partnerns preferens kan vara 0 poäng, men ${MICHAELS.utgang}+ hp och 5-5 → ${prettyBid(utgang)}.` }
  }
  const inbjudan = bud(acb.level + 1, s)
  if (p >= MICHAELS.inbjudan && acb.level + 1 < 4 && legal.includes(inbjudan)) {
    return { call: inbjudan, rule: 'Michaels: inbjudan', explanation: `Partnerns preferens var tvingad (kan vara 0 poäng); ${MICHAELS.inbjudan}–${MICHAELS.utgang - 1} hp → ${prettyBid(inbjudan)} (inbjudan — partnern bjuder utgång med ${MICHAELS.accept}+ hp).` }
  }
  return pass('Michaels: passar avslutet', `Partnerns preferens var tvingad och kan vara 0 poäng; under ${MICHAELS.inbjudan} hp → pass.`)
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
  const pass = (explanation: string, rule = 'pass'): Kunskap => ({ call: 'P', rule, explanation })
  if (!bcb) return b === 'P' ? pass('Partnern passade → pass.') : null

  // Jag cue-bjöd → placera kontraktet i min fit.
  if (acb.strain === l.theirL) {
    const fit: Suit = l.overMinor ? fitMajor(hand) : l.M!
    const utgang = bud(4, fit)
    if (bcb.level >= 4) return pass('Partnern har bjudit utgången → pass.')
    const svagt = l.overMinor ? b === '3H' : b === '3S'
    if (!svagt) {
      // Slam = systems on: den vanliga konkurrens-slamraden, med partnerns starka svar som visad extra.
      const slam = competitiveSlamTry(hand, f, { partnerShowedExtra: true })
      if (slam) return slam
      return legal.includes(utgang) ? { call: utgang, rule: 'Michaels: utgång efter cue', explanation: `Partnern visade ${MICHAELS.starkEfterCue}+ hp (utgångskrav) → ${prettyBid(utgang)} i min fit.` } : null
    }
    if (p >= MICHAELS.utgangMotSvag && legal.includes(utgang)) {
      return { call: utgang, rule: 'Michaels: utgång efter cue', explanation: `Partnern är svag, men ${MICHAELS.utgangMotSvag}+ hp och fit → ${prettyBid(utgang)}.` }
    }
    if (SUIT_OF_LETTER[bcb.strain] === fit) return pass(`Partnern är svag (under ${MICHAELS.starkEfterCue} hp) och budet ligger i min fit → pass.`, 'Michaels: stannar efter cue')
    const stopp = bud(3, fit)
    return legal.includes(stopp) ? { call: stopp, rule: 'Michaels: stannar efter cue', explanation: `Partnern är svag (under ${MICHAELS.starkEfterCue} hp); min fit är ${sym(fit)} → ${prettyBid(stopp)} (till spel).` } : null
  }

  // Jag gjorde avslut → partnern bjöd igen.
  const s = SUIT_OF_LETTER[acb.strain]
  if (bcb.strain !== acb.strain) return null
  if (bcb.level >= 4) return pass('Partnern har bjudit utgången → pass.')
  if (bcb.level === acb.level + 1) {
    const utgang = bud(4, s)
    return p >= MICHAELS.accept && legal.includes(utgang)
      ? { call: utgang, rule: 'Michaels: accepterar inbjudan', explanation: `Partnern inbjöd (${MICHAELS.inbjudan}–${MICHAELS.utgang - 1} hp); ${MICHAELS.accept}+ hp → ${prettyBid(utgang)}.` }
      : pass(`Partnern inbjöd; under ${MICHAELS.accept} hp → pass.`, 'Michaels: avböjer inbjudan')
  }
  return null
}

/** Ingången från raderna *advance*, *inkliv2* och *advance2*. null → övriga regler. */
export function michaelsContinues(hand: Hand, f: AuctionFacts): Kunskap | null {
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
