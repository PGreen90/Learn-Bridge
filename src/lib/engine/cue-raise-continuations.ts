// CUE-HÖJNINGENS FORTSÄTTNING I HÖGFÄRG — Hål D steg 2 (ägarens struktur
// 2026-09-28, systembok §7.8 c). Efter 1M–(inkliv)–cue (limithöjning+) är
// öppnarens styrka INTE avgörande: öppnaren är skyldig att ge partnern chansen
// att fortsätta beskriva, och hoppar aldrig till utgång när ett kontrollbud
// under utgång finns.
//
//   Öppnaren svarar:  ≤12 hp → 3M (minimum, avslag) · 14–15 balanserad med
//                     stopp i deras färg → 3NT (att föredra) · 13+ → billigaste
//                     KONTROLLBUD (ess, singel, renons eller K+Q tillsammans —
//                     `hasRealControl`; Kxx räknas inte) · 13+ utan kontroll → 4M.
//   Höjaren:          efter 3M → som förut (`cueBidderContinues`: limit stannar,
//                     annars 3NT/4M) · efter 3NT → 16+ kontrollbud, annars 4M
//                     med 4+ trumf/ojämn hand, annars pass · efter öppnarens
//                     kontrollbud → cue:ar sin egen kontroll OAVSETT styrka
//                     (11 hp ♦A6 → 4♦, inte 4♥) · ingen kontroll kvar → 4M,
//                     eller 4NT (1430 RKC) med 16+ när alla sidofärger är
//                     kontrollerade mellan oss ("vi klarar 5-läget, inklivaren
//                     har resten av poängen").
//   Öppnaren vidare:  nästa egen kontroll ovanför partnerns cue → kontrollbud,
//                     annars 4M = inget mer att visa · svarar 4NT i 1430-stegen ·
//                     passar partnerns avslut.
//
// Kunskapsfunktioner för beslutstabellen: EGEN hand + auktionen (läsaren
// `cue-raise-sequence.ts`), aldrig någon annan hand. Lågfärgsöppningens svar på
// cue-höjningen (3NT-vägen före 5m, ägarbeslut 2026-07-21) står orört i
// `contested-continuations.ts`.

import type { Bid, Hand, Suit } from '../../types/bridge'
import type { AuctionFacts } from './auction-facts'
import { cheapestBidIn, legalCalls, prettyBid, SWE_SYM } from './auction-rules'
import { cuedSuits, cueRaiseSequenceIn, cueRaiseSteg, cueRank, type CueRaiseSequence } from './cue-raise-sequence'
import { hasRealControl, hcp, isBalanced, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { Kunskap } from './overcall-continuations'
import { respondToRKC } from './slam'

const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

/** Höjarens hp-golv för essfrågan efter kontrollbudsronden (ägarbeslut 2026-09-28). */
export const CUE_RAISE_RKC_HP = 16
/** Öppnarens 3NT-fönster: 14–15 balanserad med stopp i deras färg. */
const OPENER_3NT_MIN = 14
const OPENER_3NT_MAX = 15
/** Öppnaren med högst 12 hp återgår billigast i trumf. */
const OPENER_MINIMUM_MAX = 12

function seqFor(f: AuctionFacts): CueRaiseSequence | null {
  return cueRaiseSequenceIn(f.history, f.seat)
}

/**
 * Billigaste ÄKTA kontroll (ess, singel, renons, K+Q) i en sidofärg som ingen
 * av oss kontrollbjudit, över senaste budet och UNDER utgången i trumf. Att
 * hoppa över en färg förnekar kontroll där. null = inget kontrollbud att visa.
 */
function nextKontrollbud(hand: Hand, seq: CueRaiseSequence, f: AuctionFacts): Bid | null {
  const legal = legalCalls(f.history, f.seat)
  const game = cueRank(`4${seq.trumpStrain}`)
  const shown = cuedSuits(seq)
  let best: Bid | null = null
  for (const s of RANK_ORDER) {
    if (s === seq.trump || shown.has(s) || !hasRealControl(hand, s)) continue
    const bid = cheapestBidIn(f.history, f.seat, LETTER[s])
    if (!bid || cueRank(bid) >= game || !legal.includes(bid)) continue
    // Lägsta BUDET vinner (3♠ före 4♣/4♦ när hjärter är trumf) — ägarens
    // exempel ♠AQ85 ♥AKJ64 ♦3 ♣K84 → 3♠, inte 4♦.
    if (!best || cueRank(bid) < cueRank(best)) best = bid
  }
  return best
}

/** Är alla tre sidofärger kontrollerade mellan oss — kontrollbjudna av någon av oss eller äkta kontroll i egen hand? */
function allaSidofargerKontrollerade(hand: Hand, seq: CueRaiseSequence): boolean {
  const shown = cuedSuits(seq)
  return RANK_ORDER.filter((s) => s !== seq.trump).every((s) => shown.has(s) || hasRealControl(hand, s))
}

function kontrollText(bid: Bid, hand: Hand): string {
  const s = RANK_ORDER.find((x) => LETTER[x] === bid[1])!
  const len = lengths(hand)[s]
  const vad = len === 0 ? 'renons' : len === 1 ? 'singel' : hand.some((c) => c.suit === s && c.rank === 'A') ? 'ess' : 'kung-dam'
  return `${vad} i ${SYM[s]}`
}

/**
 * ÖPPNAREN i cue-höjningssekvensen: första svaret på cuet, kontrollbudsronden,
 * essfrågans svar och passet på partnerns avslut. null = inte det här läget.
 */
export function openerInCueRaise(hand: Hand, f: AuctionFacts): Kunskap | null {
  const seq = seqFor(f)
  if (!seq || f.seat !== seq.opener) return null
  const legal = legalCalls(f.history, f.seat)
  const M = seq.trumpStrain
  const mSym = SWE_SYM[M]
  const game = `4${M}` as Bid
  const p = hcp(hand)

  // Första svaret på cue-höjningen.
  if (seq.after.length === 0) {
    const min = `3${M}` as Bid
    if (p <= OPENER_MINIMUM_MAX && legal.includes(min)) {
      return {
        call: min, rule: 'svar på cue-höjning',
        explanation: `Partnerns cue lovar minst limithöjning i ${mSym} och är krav; med ett minimum (högst 12 hp) återgår jag billigast i vår färg (${prettyBid(min)}).`,
      }
    }
    if (p >= OPENER_3NT_MIN && p <= OPENER_3NT_MAX && isBalanced(hand) && hasStopper(hand, seq.theirSuit) && legal.includes('3NT' as Bid)) {
      return {
        call: '3NT', rule: 'svar på cue-höjning: 3NT (14–15)',
        explanation: `Partnerns cue lovar minst limithöjning i ${mSym}; 14–15 balanserad med stopp i deras ${SWE_SYM[seq.theirStrain]} → 3NT. Partnern väljer: pass, 4${mSym} eller ett kontrollbud.`,
      }
    }
    const cue = nextKontrollbud(hand, seq, f)
    if (cue) {
      return {
        call: cue, rule: 'svar på cue-höjning: kontrollbud',
        explanation: `Partnerns cue lovar minst limithöjning i ${mSym}; 13+ hp → kontrollbud ${prettyBid(cue)} (${kontrollText(cue, hand)}), aldrig hopp till utgång när ett kontrollbud under utgång finns. Partnern cue:ar vidare eller stannar i 4${mSym}.`,
      }
    }
    if (legal.includes(game)) {
      return {
        call: game, rule: 'svar på cue-höjning: utgång (ingen kontroll)',
        explanation: `Partnerns cue lovar minst limithöjning i ${mSym}; 13+ hp men ingen äkta kontroll (ess, singel, renons eller KQ) att visa → ${prettyBid(game)}.`,
      }
    }
    return null
  }

  const last = seq.after[seq.after.length - 1]
  if (last.seat !== seq.raiser) return null
  const steg = cueRaiseSteg(last.bid, seq)

  if (steg === '4NT') {
    // 1430 RKC med trumfen satt av cue-höjningen; partnern lovade 3+ trumf.
    const r = respondToRKC(hand, seq.trump, lengths(hand)[seq.trump] + 3)
    if (!legal.includes(r.call as Bid)) return null
    return { call: r.call, rule: r.rule, explanation: `Partnerns 4NT är essfråga (1430 RKC) med ${mSym} som trumf: ${r.explanation}` }
  }
  if (steg === 'kontrollbud') {
    const cue = nextKontrollbud(hand, seq, f)
    if (cue) {
      return {
        call: cue, rule: 'kontrollbud efter cue-höjning',
        explanation: `Partnern cue-bjöd ${prettyBid(last.bid)}; jag visar min nästa kontroll ${prettyBid(cue)} (${kontrollText(cue, hand)}). Partnern väljer 4${mSym} eller 4NT.`,
      }
    }
    if (legal.includes(game)) {
      return {
        call: game, rule: 'cue-höjning: inget mer att visa',
        explanation: `Partnern cue-bjöd ${prettyBid(last.bid)}; jag har ingen ny kontroll att visa under utgång → ${prettyBid(game)}. Partnern frågar 4NT med 16+ och alla sidofärger kontrollerade, annars pass.`,
      }
    }
    return null
  }
  // Partnern avslutade (4M efter ronden, eller placeringen efter essfrågan) → pass.
  if (steg === 'utgång' || steg === 'övrigt') {
    return { call: 'P', rule: 'cue-höjning: avslutat', explanation: `Partnern placerade kontraktet (${prettyBid(last.bid)}) → pass.` }
  }
  return null
}

/**
 * HÖJAREN (cue-bjudaren) i sekvensen efter öppnarens svar. Efter öppnarens
 * billiga 3M lämnas ordet till `cueBidderContinues` (limit stannar, annars
 * 3NT/4M) — därför null där. null också efter essfrågans svar: placeringen
 * ägs av `competitiveRKCPlace` (raden *konkurrens-slam*, som frågas först).
 */
export function raiserInCueRaise(hand: Hand, f: AuctionFacts): Kunskap | null {
  const seq = seqFor(f)
  if (!seq || f.seat !== seq.raiser || seq.after.length === 0) return null
  const last = seq.after[seq.after.length - 1]
  if (last.seat !== seq.opener) return null
  const steg = cueRaiseSteg(last.bid, seq)
  if (steg === 'minimum' || steg === 'övrigt') return null
  const legal = legalCalls(f.history, f.seat)
  const M = seq.trumpStrain
  const mSym = SWE_SYM[M]
  const game = `4${M}` as Bid
  const p = hcp(hand)
  const stark = p >= CUE_RAISE_RKC_HP

  const rkc = (): Kunskap | null =>
    stark && allaSidofargerKontrollerade(hand, seq) && legal.includes('4NT' as Bid)
      ? {
          call: '4NT', rule: 'konkurrens-slaminvit (RKC)',
          explanation: `${CUE_RAISE_RKC_HP}+ hp mittemot öppningen och alla sidofärger kontrollerade mellan oss (kontrollbuden + min hand) → 4NT (1430 RKC) med ${mSym} som trumf — vi klarar 5-läget, inklivaren har resten av poängen.`,
        }
      : null

  if (steg === '3NT') {
    if (stark) {
      const cue = nextKontrollbud(hand, seq, f)
      if (cue) {
        return {
          call: cue, rule: 'kontrollbud efter cue-höjning',
          explanation: `Öppnarens 3NT visar 14–15 med stopp; med ${CUE_RAISE_RKC_HP}+ hp har jag slamintresse → kontrollbud ${prettyBid(cue)} (${kontrollText(cue, hand)}), ${mSym} är trumf.`,
        }
      }
      const r = rkc()
      if (r) return r
    }
    const len = lengths(hand)[seq.trump]
    if ((len >= 4 || !isBalanced(hand)) && legal.includes(game)) {
      return {
        call: game, rule: 'cue-höjning: rättar till trumf',
        explanation: `Öppnarens 3NT visar 14–15 med stopp; med ${len >= 4 ? '4+ trumf' : 'en ojämn hand'} spelar vi hellre ${prettyBid(game)} → ${prettyBid(game)} (till spel).`,
      }
    }
    return { call: 'P', rule: 'cue-höjning: passar 3NT', explanation: `Öppnarens 3NT visar 14–15 med stopp i deras ${SWE_SYM[seq.theirStrain]}; jämn hand med trekortsstöd → pass, 3NT står.` }
  }

  if (steg === 'kontrollbud') {
    const cue = nextKontrollbud(hand, seq, f)
    if (cue) {
      return {
        call: cue, rule: 'kontrollbud efter cue-höjning',
        explanation: `Öppnaren cue-bjöd ${prettyBid(last.bid)}; jag cue:ar min egen kontroll oavsett styrka → ${prettyBid(cue)} (${kontrollText(cue, hand)}), ${mSym} är trumf.`,
      }
    }
    const r = rkc()
    if (r) return r
    if (legal.includes(game)) {
      return {
        call: game, rule: 'cue-höjning: stannar i utgång',
        explanation: `Öppnaren cue-bjöd ${prettyBid(last.bid)}; jag har ingen ny kontroll att visa under utgång${stark ? ' och inte alla sidofärger är kontrollerade' : ''} → ${prettyBid(game)} (till spel).`,
      }
    }
    return null
  }

  // Öppnarens 4M: inget mer att visa (efter ronden), eller 13+ utan kontroll.
  if (steg === 'utgång') {
    const r = rkc()
    if (r) return r
    return { call: 'P', rule: 'cue-höjning: avslutat', explanation: `Öppnarens ${prettyBid(last.bid)} = inget mer att visa; ${stark ? 'alla sidofärger är inte kontrollerade' : `under ${CUE_RAISE_RKC_HP} hp`} → pass.` }
  }
  return null
}
