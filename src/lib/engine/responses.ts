// Budmotorns andra del: svararens första bud efter att partnern öppnat 1♥/1♠.
// Härlett ur systemboken §4.1. Prioriteringsordningen är det viktiga: vi testar
// fit-svaren först (splinter → Jacoby → Bergen), sedan färgsvar och NT.

import type { Bid, Forcing, Hand, Suit } from '../../types/bridge'
import { dummyPoints } from './evaluation'
import { hcp, isBalanced, lengths } from './hand'

export type Major = 'hearts' | 'spades'
export type Minor = 'clubs' | 'diamonds'

export interface ResponseResult {
  /**
   * `rule` är budets STABILA identitet (kort regelnamn, t.ex. "Jacoby 2NT").
   * Skild från den användarvända `explanation`. Regelregistret (`rules.ts`)
   * nycklas på den och härleder kravnivå (`forcing`) + alert ur SAMMA regel –
   * målet med FAS 1.
   */
  call: Bid
  rule: string
  explanation: string
  uncertain?: boolean
  /** Budets kravnivå (§2). Frivilligt tills regelregistret fyllt i det. */
  forcing?: Forcing
}

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }

function otherMajor(m: Major): Major {
  return m === 'hearts' ? 'spades' : 'hearts'
}

/** Vad svarar man på partnerns 1♥/1♠ (ostörd, ohöjd hand)? */
export function respondToMajor(hand: Hand, opened: Major): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[opened]
  const other = otherMajor(opened)
  const sideSuits = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).filter((s) => s !== opened)
  const shortness = sideSuits.some((s) => len[s] <= 1)
  const M = BID[opened]
  const MSYM = opened === 'hearts' ? '♥' : '♠'

  // STÖDPOÄNG (TP-steg B, ägarens beslut 2026-06-30): vid fit räknar svararen
  // stödpoäng (Bergen: singel +3 m. 4 trumf, dubbel +1 …) i stället för rå hp –
  // MEN aldrig under hp (en hand nedgraderas aldrig av sin form). Korthet/längd
  // får alltså LYFTA en höjning över inbjudan→utgång-gränsen (t.ex. 11 hp + singel
  // + 4 trumf → splinter), men en platt övervärderad hand stannar på hp-golvet.
  const sp = Math.max(p, dummyPoints(hand, opened).dummyPoints)
  const spTxt = sp > p ? `${p} hp / ${sp} stödp.` : `${p} hp`

  if (p < 6) return { call: 'P', rule: 'pass', explanation: `${p} hp – för svagt för att svara → pass.` }

  // ---- Fit: 4+ stöd (stödpoäng styr nivån) ----
  if (support >= 4) {
    if (sp >= 12 && shortness) {
      const call = opened === 'hearts' ? '3S' : '3H'
      const sym = opened === 'hearts' ? '3♠' : '3♥'
      return { call, rule: 'tvetydig splinter', explanation: `${spTxt}, ${support} stöd + kortfärg → ${sym} (tvetydig splinter, GF).` }
    }
    if (sp >= 13) {
      return { call: '2NT', rule: 'Jacoby 2NT', explanation: `${spTxt}, ${support} stöd, ingen kortfärg → 2NT (Jacoby, GF).` }
    }
    if (support === 4) {
      if (sp >= 10) return { call: '3D', rule: 'Bergen limit', explanation: `${spTxt}, 4 stöd → 3♦ (Bergen, limithöjning).` }
      if (sp >= 7) return { call: '3C', rule: 'Bergen konstruktiv', explanation: `${spTxt}, 4 stöd → 3♣ (Bergen, konstruktiv).` }
      return { call: `3${M}`, rule: 'Bergen spärr', explanation: `${spTxt}, 4 stöd → 3${MSYM} (Bergen, spärrhöjning).` }
    }
    // 5+ stöd, ej GF
    if (sp <= 9) return { call: `4${M}`, rule: 'spärr till utgång', explanation: `${spTxt}, ${support} stöd – spärr → 4${MSYM}.` }
    return { call: '3D', rule: 'Bergen limit', explanation: `${spTxt}, ${support} stöd → 3♦ (limithöjning).`, uncertain: true }
  }

  // ---- 3-korts stöd (stödpoäng styr; korthet lyfter mot limithöjning) ----
  if (support === 3) {
    if (sp <= 9) return { call: `2${M}`, rule: 'enkel höjning', explanation: `${spTxt}, 3 stöd → 2${MSYM} (enkel höjning).` }
    if (sp <= 12) return { call: '1NT', rule: 'semi-forcing 1NT', explanation: `${spTxt}, 3-korts limithöjning → 1NT (semi-forcing), höjer sedan.` }
    // 13+ stödpoäng med 3 stöd → faller vidare till 2/1.
  }

  // ---- Ny färg på 1-läget: bara spader över 1♥ ----
  if (opened === 'hearts') {
    if (len.spades >= 6 && p <= 10) return { call: '2S', rule: 'svagt hoppskift', explanation: `${p} hp, 6-korts spader → 2♠ (svagt hoppskift).` }
    if (len.spades >= 4) return { call: '1S', rule: 'ny färg (1-läget)', explanation: `${p} hp, 4+ spader → 1♠ (krav 1 rond).` }
  }

  // ---- 2-över-1 GF med en 5+ färg ----
  if (p >= 12) {
    const s5 = bestSuit(len, opened, 5)
    if (s5) return { call: `2${BID[s5]}`, rule: '2-över-1 GF', explanation: `${p} hp med ${len[s5]}-korts ${NAME[s5]} → 2${BID[s5]} (2-över-1, GF).` }
  }

  // ---- 3NT: 13–15 balanserad, exakt 2 i öppningsfärgen, ingen 4-korts annan högfärg ----
  if (isBalanced(hand) && p >= 13 && p <= 15 && support <= 2 && len[other] < 4) {
    return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp balanserad utan fit → 3NT (till spel).` }
  }

  // ---- 2-över-1 med en 4-korts färg (tunnare – flaggas) ----
  if (p >= 12) {
    const s4 = bestSuit(len, opened, 4)
    if (s4) return { call: `2${BID[s4]}`, rule: '2-över-1 GF', explanation: `${p} hp med 4-korts ${NAME[s4]} → 2${BID[s4]} (2-över-1, GF).`, uncertain: true }
  }

  // ---- Semi-forcing 1NT (6–11, inget bättre) ----
  if (p <= 11) return { call: '1NT', rule: 'semi-forcing 1NT', explanation: `${p} hp utan fit eller 2/1 → 1NT (semi-forcing).` }

  // ---- Kvar: 12+ utan tydlig fortsättning → flaggas ----
  return { call: '1NT', rule: 'oklart', explanation: `${p} hp – motorn hittar inget tydligt svar (förenkling).`, uncertain: true }
}

/** Vad svarar man på partnerns 1♣/1♦ (ostörd, ohöjd hand)? Systembok §4.2. */
export function respondToMinor(hand: Hand, opened: Minor): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[opened]
  const bal = isBalanced(hand)
  const m = BID[opened]
  const msym = opened === 'clubs' ? '♣' : '♦'
  const otherMinor: Minor = opened === 'clubs' ? 'diamonds' : 'clubs'
  const oBID = BID[otherMinor]
  const osym = otherMinor === 'clubs' ? '♣' : '♦'

  // ---- Svag spärrhöjning (inverterad minor, svag): 5+ stöd, 0–6 hp ----
  if (support >= 5 && p <= 6) {
    return { call: `3${m}`, rule: 'inverterad minor, svag', explanation: `${p} hp, ${support} stöd → 3${msym} (svag spärrhöjning).` }
  }

  if (p < 6) return { call: 'P', rule: 'pass', explanation: `${p} hp – för svagt för att svara → pass.` }

  // ---- Svagt hoppskift: 6-korts högfärg, 6–10 hp ----
  {
    const major: Major | null = len.spades >= 6 ? 'spades' : len.hearts >= 6 ? 'hearts' : null
    if (major && p <= 10) {
      const sym = major === 'spades' ? '♠' : '♥'
      return { call: `2${BID[major]}`, rule: 'svagt hoppskift', explanation: `${p} hp med 6-korts ${NAME[major]} → 2${sym} (svagt hoppskift).` }
    }
  }

  // ---- 4-korts högfärg på 1-läget (längst först, lika → hjärter billigast), 6+ hp ----
  {
    const major = pickMajorToBid(len)
    if (major) {
      const sym = major === 'spades' ? '♠' : '♥'
      return { call: `1${BID[major]}`, rule: 'ny färg (1-läget)', explanation: `${p} hp med ${len[major]}-korts ${NAME[major]} → 1${sym} (4-korts högfärg upp, krav 1 rond).` }
    }
  }

  // Härefter: ingen biudbar 4-korts högfärg.

  // ---- Stark inverterad höjning: 4+ stöd, 10+ hp (ingen högfärg) ----
  if (support >= 4 && p >= 10) {
    if (bal && p >= 13 && p <= 15) {
      return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp balanserad utan högfärg → 3NT (till spel).` }
    }
    return { call: `2${m}`, rule: 'inverterad minor', explanation: `${p} hp, ${support} stöd, ingen högfärg → 2${msym} (inverterad minor, krav).` }
  }

  // ---- 3NT till spel: 13–15 balanserad, ingen högfärg ----
  if (bal && p >= 13 && p <= 15) {
    return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp balanserad utan högfärg → 3NT (till spel).` }
  }

  // ---- 2-över-1 GF: 5+ kort i den andra minorn, 12+ hp ----
  if (len[otherMinor] >= 5 && p >= 12) {
    return { call: `2${oBID}`, rule: '2-över-1 GF', explanation: `${p} hp med ${len[otherMinor]}-korts ${NAME[otherMinor]} → 2${osym} (2-över-1, GF).` }
  }

  // ---- 2NT inbjudan: 11–12 balanserad, stopp, ingen högfärg ----
  if (bal && p >= 11 && p <= 12) {
    return { call: '2NT', rule: '2NT inbjudan', explanation: `${p} hp balanserad, ingen högfärg → 2NT (inbjudan).` }
  }

  // ---- Gap-handen: 7–9 hp med stöd men utan högfärg (för svagt för inverterad) → 1NT ----
  if (support >= 4 && p >= 7 && p <= 9) {
    return { call: '1NT', rule: 'gap-hand 1NT', explanation: `${p} hp med stöd men utan högfärg (för svagt för inverterad) → 1NT.` }
  }

  // ---- 1NT naturlig: 6–10 hp, ingen högfärg ----
  if (p <= 10) {
    return { call: '1NT', rule: '1NT', explanation: `${p} hp utan högfärg → 1NT (naturligt, ej krav).` }
  }

  // ---- Kvar: 11+ utan tydlig fortsättning → flaggas ----
  return { call: '1NT', rule: 'oklart', explanation: `${p} hp – motorn hittar inget tydligt svar (förenkling).`, uncertain: true }
}

/** Vilken 4-korts högfärg bjuds på 1-läget: längst först, lika längd → hjärter (billigast). */
function pickMajorToBid(len: Record<Suit, number>): Major | null {
  const h = len.hearts >= 4
  const s = len.spades >= 4
  if (h && s) return len.spades > len.hearts ? 'spades' : 'hearts'
  if (h) return 'hearts'
  if (s) return 'spades'
  return null
}

/** Längsta biudbara 2/1-färgen (under öppningsfärgen) med minst `min` kort. */
function bestSuit(len: Record<Suit, number>, opened: Major, min: number): Suit | null {
  const candidates: Suit[] = opened === 'spades' ? ['hearts', 'diamonds', 'clubs'] : ['diamonds', 'clubs']
  let best: Suit | null = null
  for (const s of candidates) {
    if (len[s] >= min && (best === null || len[s] > len[best])) best = s
  }
  return best
}
