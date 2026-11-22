// STÖRD INVERTERAD LÅGFÄRGSHÖJNING — 1m–2m–(inkliv på 2-läget)
// (felrapport #129, ägarstruktur 2026-11-22; docs/budsystem.md §4.2).
//
//     Nord   Öst    Syd    Väst
//     1♣     pass   2♣     2♥
//     pass   pass   pass ???         ← 32 hp och elva klöver såldes ut i 2♥
//
// Hålet: efter den inverterade höjningen (krav) och ett inkliv fanns ingen rad
// alls — både öppnaren och svararen föll till "pass (ingen regel)".
//
// Ägarens struktur för ÖPPNAREN:
//   pass  = svagast (12–13): ingen stopp, ingen ny fyrkortsfärg, inte styrka
//           att bjuda om färgen. KRAV — frågar svararen efter stopp.
//   X     = samma handtyp, något starkare (14–15). INTE straff.
//   2NT   = stopp i deras färg, 12–15 · 3NT = stopp, 16+
//   ny färg = naturlig fyrkortsfärg, fem i lågfärgen, krav en rond
//   3m    = fem kort, 12–15, ej krav
//   3 i deras färg = utgångskrav: 16+, 5+ i lågfärgen
//   hopp i ny färg = kontrollbud (kortfärg): 16+, lång lågfärg, slamintresse —
//           "när sang inte ser ut som slutbudet"
// SVARAREN efter pass/X passar aldrig: med stopp 2NT (10–12) / 3NT (13+); utan
// stopp 3m (minimum) / 3 i deras färg (13+).
// ÖPPNARENS tredje tur: svararens 2NT höjs till 3NT av X-handen (14–15) och
// passas av pass-handen; svararens 3m passas.
//
// EFTER KONTROLLHOPPET (ägarens budgång på rapportens giv: 4♦–4♠–4NT): svararen
// visar sin billigaste kontroll (ess, kung, singel eller renons) under 5m —
// utan kontroll 5m — och öppnaren frågar 4NT (1430, lågfärgen trumf) när alla
// sidofärger är kontrollerade, annars 5m.
//
// Avgränsning: bara inkliv i FÄRG på 2-läget direkt över höjningen. 3-läget,
// deras dubbling och fortsättningen efter svararens bud i deras färg är inte
// beslutade än och lämnas orörda.
//
// Alla funktioner läser EN hand + auktionen (ärlig inferens).

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { bidValue, cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { hcp, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { Kunskap } from './overcall-continuations'
import { side } from './play'

const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

/** Läget: vem öppnade, lågfärgen, deras inkliv och var i historiken det står. */
export interface StördInverterad {
  opener: Seat
  minor: Suit
  their: { suit: Suit; bid: string }
  /** Index för deras inkliv i historiken. */
  inklivIdx: number
}

/**
 * Är auktionen 1m–(P)–2m (INVERTERAD enligt betydelselagret — inte passad
 * hand) följd direkt av motståndarens färginkliv på 2-läget, och har de inte
 * bjudit något mer kontraktsbud? Läses ur buden, aldrig ur korten.
 */
export function stördInverterad(f: AuctionFacts): StördInverterad | null {
  const open = f.opening
  if (!open || !f.weOpened || open.level !== 1 || (open.strain !== 'C' && open.strain !== 'D')) return null
  const ours = f.ourContractBids
  if (ours.length < 2) return null
  const höjning = ours[1]
  if (höjning.seat !== PARTNER[open.seat] || höjning.bid !== `2${open.strain}`) return null
  const hIdx = f.history.indexOf(höjning)
  if (f.meaning(hIdx).rule !== 'inverterad minor') return null
  const inkliv = f.history[hIdx + 1]
  if (!inkliv || f.theirContractBids.length !== 1 || f.theirContractBids[0] !== inkliv) return null
  const cb = parseContractBid(inkliv.bid)
  if (!cb || cb.level !== 2 || cb.strain === 'NT') return null
  return { opener: open.seat, minor: SUIT_OF_LETTER[open.strain], their: { suit: SUIT_OF_LETTER[cb.strain], bid: inkliv.bid }, inklivIdx: hIdx + 1 }
}

/** Öppnarens tur direkt över inklivet (inget har hänt sedan dess). */
export function stördInverteradÖppnaren(f: AuctionFacts): StördInverterad | null {
  const l = stördInverterad(f)
  if (!l || l.opener !== f.seat || f.history.length !== l.inklivIdx + 1) return null
  return l
}

/** Öppnarens bud över inklivet — se strukturen i filhuvudet. */
export function stördInverteradÖppnarenBjuder(hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = stördInverteradÖppnaren(f)
  if (!l) return null
  const len = lengths(hand)
  const p = hcp(hand)
  const legal = legalCalls(f.history, f.seat)
  const m = letterOfSuit(l.minor)
  const mSym = SWE_SYM[m]
  const dSym = SWE_SYM[letterOfSuit(l.their.suit)]
  const deras = prettyBid(l.their.bid)
  const stopp = hasStopper(hand, l.their.suit)
  const sido = RANK_ORDER.filter((s) => s !== l.minor && s !== l.their.suit)

  if (p >= 16 && len[l.minor] >= 5) {
    // Hopp i kortfärgen = kontrollbud med slamintresse (sang ser inte ut som slutbudet).
    const kort = sido.filter((s) => len[s] <= 1).sort((a, b) => len[a] - len[b])[0]
    if (kort) {
      const billigast = cheapestBidIn(f.history, f.seat, letterOfSuit(kort))
      const nivå = billigast ? Number(billigast[0]) + 1 : 9
      const hopp = `${nivå}${letterOfSuit(kort)}` as Bid
      if (nivå <= 4 && legal.includes(hopp)) {
        return {
          call: hopp, rule: 'störd inverterad: kontrollhopp',
          explanation: `Stark hand (16+) med ${len[l.minor]} ${mSym} och ${len[kort] === 0 ? 'renons' : 'singel'} i ${SWE_SYM[letterOfSuit(kort)]}: sang ser inte ut som slutbudet → hopp till ${prettyBid(hopp)} (kontrollbud, slamintresse).`,
        }
      }
    }
  }
  if (stopp) {
    const bud = (p >= 16 ? ['3NT'] : ['2NT', '3NT']).find((b) => legal.includes(b as Bid))
    if (bud) {
      return {
        call: bud, rule: 'störd inverterad: sang',
        explanation: `Stopp i deras ${dSym} och ${p >= 16 ? '16+' : '12–15'} hp → ${bud} direkt över ${deras}.`,
      }
    }
  }
  if (p >= 16 && len[l.minor] >= 5) {
    const cue = `3${letterOfSuit(l.their.suit)}` as Bid
    if (legal.includes(cue)) {
      return {
        call: cue, rule: 'störd inverterad: utgångskrav',
        explanation: `16+ hp och ${len[l.minor]} ${mSym} utan stopp i ${dSym} → ${prettyBid(cue)} (utgångskrav, visar styrkan och längden).`,
      }
    }
  }
  if (len[l.minor] >= 5) {
    // Naturlig fyrkortsfärg bredvid femkortslågfärgen — billigast först, högst 3-läget.
    const ny = sido
      .filter((s) => len[s] >= 4)
      .map((s) => ({ s, bud: cheapestBidIn(f.history, f.seat, letterOfSuit(s)) }))
      .filter((x): x is { s: Suit; bud: Bid } => x.bud !== null && Number(x.bud[0]) <= 3)
      .sort((a, b) => legal.indexOf(a.bud) - legal.indexOf(b.bud))[0]
    if (ny) {
      return {
        call: ny.bud, rule: 'störd inverterad: ny färg',
        explanation: `Fyra ${SWE_SYM[letterOfSuit(ny.s)]} bredvid ${len[l.minor]} ${mSym}, ingen stopp i ${dSym} → ${prettyBid(ny.bud)} (naturligt, krav en rond).`,
      }
    }
    const om = `3${m}` as Bid
    if (legal.includes(om)) {
      return {
        call: om, rule: 'störd inverterad: minimum',
        explanation: `${len[l.minor]} ${mSym} och 12–15 hp, ingen stopp i ${dSym} och ingen ny färg → ${prettyBid(om)} (ej krav).`,
      }
    }
  }
  if (p >= 14 && legal.includes('X')) {
    return {
      call: 'X', rule: 'störd inverterad: dubbling',
      explanation: `Ingen stopp i ${dSym}, ingen ny färg och inte fem ${mSym}, men 14+ hp → X (inte straff: starkare än pass, frågar efter stopp).`,
    }
  }
  return {
    call: 'P', rule: 'störd inverterad: pass',
    explanation: `Minimum utan stopp i ${dSym}, utan ny färg och utan femte ${mSym} → pass (krav: partnern bjuder sang med stopp, annars ${prettyBid(`3${m}`)}).`,
  }
}

/**
 * Svararens tur: öppnaren passade eller dubblade inklivet, motståndaren till
 * höger passade — inget annat har hänt. Returnerar läget + öppnarens val.
 */
export function stördInverteradSvararen(f: AuctionFacts): (StördInverterad & { öppnaren: 'P' | 'X' }) | null {
  const l = stördInverterad(f)
  if (!l || PARTNER[l.opener] !== f.seat || f.history.length !== l.inklivIdx + 3) return null
  const ö = f.history[l.inklivIdx + 1]
  const rho = f.history[l.inklivIdx + 2]
  if (ö.seat !== l.opener || (ö.bid !== 'P' && ö.bid !== 'X') || rho.bid !== 'P') return null
  return { ...l, öppnaren: ö.bid }
}

/** Svararen passar aldrig: sang med stopp, annars 3m / 3 i deras färg. */
export function stördInverteradSvararenBjuder(hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = stördInverteradSvararen(f)
  if (!l) return null
  const p = hcp(hand)
  const legal = legalCalls(f.history, f.seat)
  const m = letterOfSuit(l.minor)
  const dSym = SWE_SYM[letterOfSuit(l.their.suit)]
  const fråga = l.öppnaren === 'P' ? 'pass' : 'dubbling'
  if (hasStopper(hand, l.their.suit)) {
    const bud = (p >= 13 ? ['3NT'] : ['2NT', '3NT']).find((b) => legal.includes(b as Bid))
    if (bud) {
      return {
        call: bud, rule: 'störd inverterad: svararen med stopp',
        explanation: `Partnerns ${fråga} frågar efter stopp i ${dSym}: jag har den, ${p >= 13 ? '13+' : '10–12'} hp → ${bud}.`,
      }
    }
  }
  const cue = `3${letterOfSuit(l.their.suit)}` as Bid
  if (p >= 13 && legal.includes(cue)) {
    return {
      call: cue, rule: 'störd inverterad: svararen utan stopp (13+)',
      explanation: `Partnerns ${fråga} frågar efter stopp i ${dSym}: ingen stopp, men 13+ hp → ${prettyBid(cue)} (utgångskrav).`,
    }
  }
  const om = `3${m}` as Bid
  if (!legal.includes(om)) return null
  return {
    call: om, rule: 'störd inverterad: svararen utan stopp (minimum)',
    explanation: `Partnerns ${fråga} frågar efter stopp i ${dSym}: ingen stopp och minimum → ${prettyBid(om)} (ej krav).`,
  }
}

/**
 * Öppnarens TREDJE tur: jag passade/dubblade inklivet, svararen svarade 2NT
 * eller 3m, motståndaren passade.
 */
export function stördInverteradÖppnarenIgen(f: AuctionFacts): (StördInverterad & { mitt: 'P' | 'X'; svar: string }) | null {
  const l = stördInverterad(f)
  if (!l || l.opener !== f.seat || f.history.length !== l.inklivIdx + 5) return null
  const mitt = f.history[l.inklivIdx + 1]
  const svar = f.history[l.inklivIdx + 3]
  if ((mitt.bid !== 'P' && mitt.bid !== 'X') || f.history[l.inklivIdx + 2].bid !== 'P' || f.history[l.inklivIdx + 4].bid !== 'P') return null
  if (svar.bid !== '2NT' && svar.bid !== `3${letterOfSuit(l.minor)}`) return null
  if (side(svar.seat) !== side(f.seat)) return null
  return { ...l, mitt: mitt.bid, svar: svar.bid }
}

export function stördInverteradÖppnarenAvslutar(_hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = stördInverteradÖppnarenIgen(f)
  if (!l) return null
  if (l.svar === '2NT' && l.mitt === 'X') {
    return {
      call: '3NT', rule: 'störd inverterad: öppnaren höjer sangen',
      explanation: 'Min dubbling visade 14–15, partnern har stopp och 10–12 → 3NT.',
    }
  }
  return {
    call: 'P', rule: 'störd inverterad: öppnaren passar',
    explanation: l.svar === '2NT'
      ? 'Mitt pass visade minimum, partnerns 2NT visade 10–12 med stopp → pass.'
      : `Partnern har ingen stopp och minimum → ${prettyBid(l.svar)} står.`,
  }
}

// ---- Svararen efter öppnarens nya färg -------------------------------------

/** Svararens tur: öppnaren bjöd en ny fyrkortsfärg (krav en rond), motståndaren passade. */
export function stördInverteradEfterNyFärg(f: AuctionFacts): (StördInverterad & { ny: Suit }) | null {
  const l = stördInverterad(f)
  if (!l || PARTNER[l.opener] !== f.seat || f.history.length !== l.inklivIdx + 3) return null
  if (f.history[l.inklivIdx + 2].bid !== 'P') return null
  if (f.meaning(l.inklivIdx + 1).rule !== 'störd inverterad: ny färg') return null
  const cb = parseContractBid(f.history[l.inklivIdx + 1].bid)
  if (!cb || cb.strain === 'NT') return null
  return { ...l, ny: SUIT_OF_LETTER[cb.strain] }
}

/**
 * Ägarbeslut 2026-11-22: samma trappa som efter pass/X, plus höjning med fyra
 * korts stöd (högfärg: 13+ → utgång, annars enkel höjning). Tre kort höjs aldrig.
 */
export function stördInverteradSvarPåNyFärg(hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = stördInverteradEfterNyFärg(f)
  if (!l) return null
  const p = hcp(hand)
  const len = lengths(hand)
  const legal = legalCalls(f.history, f.seat)
  const m = letterOfSuit(l.minor)
  const n = letterOfSuit(l.ny)
  const dSym = SWE_SYM[letterOfSuit(l.their.suit)]
  const högfärg = l.ny === 'hearts' || l.ny === 'spades'
  if (len[l.ny] >= 4) {
    const enkel = cheapestBidIn(f.history, f.seat, n)
    const bud = (högfärg && p >= 13 ? `4${n}` : enkel) as Bid | null
    if (bud && legal.includes(bud)) {
      return {
        call: bud, rule: 'störd inverterad: svararen stöder nya färgen',
        explanation: `Fyra kort i partnerns ${SWE_SYM[n]} → ${prettyBid(bud)} (${högfärg && p >= 13 ? '13+, utgång' : 'stöd, 10–12'}).`,
      }
    }
  }
  if (hasStopper(hand, l.their.suit)) {
    const bud = (p >= 13 ? ['3NT'] : ['2NT']).find((b) => legal.includes(b as Bid))
    if (bud) {
      return {
        call: bud, rule: 'störd inverterad: svararen med stopp',
        explanation: `Partnerns nya färg nekade stopp i ${dSym}: jag har den, ${p >= 13 ? '13+' : '10–12'} hp → ${bud}.`,
      }
    }
  }
  const cue = cheapestBidIn(f.history, f.seat, letterOfSuit(l.their.suit))
  if (p >= 13 && cue && Number(cue[0]) === 3 && legal.includes(cue)) {
    return {
      call: cue, rule: 'störd inverterad: svararen utan stopp (13+)',
      explanation: `Ingen stopp i ${dSym} och inte fyra kort i partnerns ${SWE_SYM[n]}, men 13+ hp → ${prettyBid(cue)} (utgångskrav).`,
    }
  }
  const om = cheapestBidIn(f.history, f.seat, m)
  if (!om || !legal.includes(om)) return null
  return {
    call: om, rule: 'störd inverterad: svararen utan stopp (minimum)',
    explanation: `Ingen stopp i ${dSym}, inte fyra kort i partnerns ${SWE_SYM[n]} och minimum → ${prettyBid(om)} (ej krav).`,
  }
}

// ---- Utgångskravet står: 4m passas aldrig ---------------------------------

const UTGÅNGSKRAV = new Set(['störd inverterad: utgångskrav', 'störd inverterad: svararen utan stopp (13+)'])

/**
 * Jag bjöd 3 i deras färg (utgångskrav), partnern svarade 4m utan stopp och
 * motståndaren passade: 4m är inte utgång, så jag får inte passa.
 */
export function stördInverteradUtgångskravStår(f: AuctionFacts): StördInverterad | null {
  const l = stördInverterad(f)
  if (!l) return null
  const n = f.history.length
  if (n < l.inklivIdx + 5 || f.history[n - 1].bid !== 'P') return null
  const svar = f.history[n - 2]
  const cue = f.history[n - 4]
  if (svar.seat !== PARTNER[f.seat] || svar.bid !== `4${letterOfSuit(l.minor)}`) return null
  if (cue.seat !== f.seat || f.history[n - 3].bid !== 'P' || !UTGÅNGSKRAV.has(f.meaning(n - 4).rule ?? '')) return null
  return l
}

/** Ingen av oss har stopp → utgång i lågfärgen. */
export function stördInverteradBjuderUtgång(_hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = stördInverteradUtgångskravStår(f)
  if (!l) return null
  const m = letterOfSuit(l.minor)
  const utgång = `5${m}` as Bid
  if (!legalCalls(f.history, f.seat).includes(utgång)) return null
  return {
    call: utgång, rule: 'störd inverterad: utgång efter utgångskravet',
    explanation: `Mitt bud i deras färg var utgångskrav och partnerns ${prettyBid(`4${m}`)} nekade stopp: sang är borta → ${prettyBid(utgång)}.`,
  }
}

// ---- Efter öppnarens kontrollhopp -----------------------------------------

/** Ett buds plats i budstegen (nivå + benämning). */
const värde = (bud: string): number => bidValue(Number(bud[0]), bud.slice(1))

const harKontroll = (hand: Hand, suit: Suit): boolean =>
  lengths(hand)[suit] <= 1 || hand.some((c) => c.suit === suit && (c.rank === 'A' || c.rank === 'K'))

/** Svararens tur efter öppnarens kontrollhopp (motståndaren passade). */
export function stördInverteradKontrollhoppAttSvara(f: AuctionFacts): (StördInverterad & { hopp: Suit }) | null {
  const l = stördInverterad(f)
  if (!l || PARTNER[l.opener] !== f.seat || f.history.length !== l.inklivIdx + 3) return null
  if (f.history[l.inklivIdx + 2].bid !== 'P') return null
  if (f.meaning(l.inklivIdx + 1).rule !== 'störd inverterad: kontrollhopp') return null
  const cb = parseContractBid(f.history[l.inklivIdx + 1].bid)
  if (!cb || cb.strain === 'NT') return null
  return { ...l, hopp: SUIT_OF_LETTER[cb.strain] }
}

/** Billigaste kontrollen under 5m — annars 5m. */
export function stördInverteradSvarPåKontrollhopp(hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = stördInverteradKontrollhoppAttSvara(f)
  if (!l) return null
  const m = letterOfSuit(l.minor)
  const tak = värde(`5${m}`)
  const legal = legalCalls(f.history, f.seat)
  const val = RANK_ORDER.filter((s) => s !== l.minor && s !== l.hopp && harKontroll(hand, s))
    .map((s) => ({ s, bud: cheapestBidIn(f.history, f.seat, letterOfSuit(s)) }))
    .filter((x): x is { s: Suit; bud: Bid } => x.bud !== null && värde(x.bud) < tak)
    .sort((a, b) => värde(a.bud) - värde(b.bud))[0]
  if (val) {
    return {
      call: val.bud, rule: 'svar på kontrollhopp: kontrollbud',
      explanation: `Partnerns hopp visade slamintresse med kort ${SWE_SYM[letterOfSuit(l.hopp)]}: min billigaste kontroll är ${SWE_SYM[letterOfSuit(val.s)]} → ${prettyBid(val.bud)} (kontrollbud).`,
    }
  }
  const stopp = `5${m}` as Bid
  if (!legal.includes(stopp)) return null
  return {
    call: stopp, rule: 'svar på kontrollhopp: ingen kontroll',
    explanation: `Partnerns hopp visade slamintresse, men jag har ingen kontroll att visa → ${prettyBid(stopp)}.`,
  }
}

/** Öppnarens tur efter svararens kontrollbud (motståndaren passade). */
export function stördInverteradEfterKontrollsvar(f: AuctionFacts): (StördInverterad & { hopp: Suit; svar: Suit }) | null {
  const l = stördInverterad(f)
  if (!l || l.opener !== f.seat || f.history.length !== l.inklivIdx + 5) return null
  if (f.history[l.inklivIdx + 2].bid !== 'P' || f.history[l.inklivIdx + 4].bid !== 'P') return null
  if (f.meaning(l.inklivIdx + 1).rule !== 'störd inverterad: kontrollhopp') return null
  if (f.meaning(l.inklivIdx + 3).rule !== 'svar på kontrollhopp: kontrollbud') return null
  const hopp = parseContractBid(f.history[l.inklivIdx + 1].bid)
  const svar = parseContractBid(f.history[l.inklivIdx + 3].bid)
  if (!hopp || !svar || hopp.strain === 'NT' || svar.strain === 'NT') return null
  return { ...l, hopp: SUIT_OF_LETTER[hopp.strain], svar: SUIT_OF_LETTER[svar.strain] }
}

/** Alla sidofärger kontrollerade → 4NT (1430 med lågfärgen som trumf), annars 5m. */
export function stördInverteradFrågarEss(hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = stördInverteradEfterKontrollsvar(f)
  if (!l) return null
  const m = letterOfSuit(l.minor)
  const legal = legalCalls(f.history, f.seat)
  const lucka = RANK_ORDER.filter((s) => s !== l.minor && s !== l.hopp && s !== l.svar).find((s) => !harKontroll(hand, s))
  if (!lucka && legal.includes('4NT')) {
    return {
      call: '4NT', rule: '1430 RKC',
      explanation: `Partnern visade kontroll i ${SWE_SYM[letterOfSuit(l.svar)]} och jag håller resten: alla färger kontrollerade → 4NT (essfråga, ${SWE_SYM[m]} trumf).`,
    }
  }
  const stopp = `5${m}` as Bid
  if (!legal.includes(stopp)) return null
  return {
    call: stopp, rule: 'efter kontrollsvaret: stannar i utgång',
    explanation: lucka
      ? `Ingen av oss kontrollerar ${SWE_SYM[letterOfSuit(lucka)]} → ${prettyBid(stopp)}.`
      : `Essfrågan ryms inte → ${prettyBid(stopp)}.`,
  }
}
