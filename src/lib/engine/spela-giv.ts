// DELAD HELGIVSSPELARE (Speldiagnosen steg 1). En enda funktion som spelar en
// giv färdigt med bot-hjärnan — ersätter de fyra kopierade looparna i
// play-quality.probe, play-establish.probe, lead-quality.probe och
// play-bot-technique.test. Ren modul: ingen I/O, ingen global slump om ett frö
// ges.
//
// Två nivåer:
//   • spelaVidare(state, …)  — spelar färdigt från VALFRI ställning (teknik-
//     testerna startar i fabricerade slutspel).
//   • spelaHelGiv(deal, …)   — hel giv från utspelet.
//   • spelaMedFro(deal, …)   — hel giv där varje botbeslut får sitt eget frö via
//     botDecisionSeed (SAMMA väg som tävlingsspelet i usePlayTable) → hela
//     genomspelningen är 100 % reproducerbar ur (giv, playSeed) ensamt, utan att
//     mocka Math.random.
//
// Kroken `cardFor` låter en probe byta ut enskilda kort (t.ex. ENBART utspelet i
// lead-quality-proben): returnera ett kort för att tvinga det, null för botens
// eget val.

import type { Card, Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { botCardSmart, type SmartOpts } from './play-bot'
import { contractResult, isComplete, playCard, startPlay, type Contract, type PlayState, type Trick } from './play'
import { mulberry32 } from './deal'
import { botDecisionSeed, playIndexOf } from './play-seed'

export interface SpelaGivOpts {
  /** Botens inställningar; en funktion får räkna fram dem PER BESLUT (så
   *  spelaMedFro kan ge varje beslut sitt eget frö). */
  smart?: SmartOpts | ((st: PlayState) => SmartOpts)
  /** Byt ut enskilda kort: returnera ett kort för att spela det i stället för
   *  botens val, null/undefined för att låta boten välja. */
  cardFor?: (st: PlayState, seat: Seat) => Card | null | undefined
}

export interface SpeladGiv {
  /** De spelade sticken i ordning (13 vid hel giv). */
  tricks: Trick[]
  /** Slutställningen (för contractResult, poäng m.m.). */
  finalState: PlayState
  /** Spelförarsidans stick. */
  declarerTricks: number
}

/** Spela färdigt från en godtycklig ställning. Vakten (60) täcker en hel giv
 *  (52 kort) med marginal och skyddar mot oändlig loop vid motorfel. */
export function spelaVidare(state: PlayState, calls: ResolvedCall[], opts: SpelaGivOpts = {}): SpeladGiv {
  let st = state
  let guard = 0
  while (!isComplete(st) && guard++ < 60) {
    const seat = st.toAct
    const forced = opts.cardFor?.(st, seat)
    const smart = typeof opts.smart === 'function' ? opts.smart(st) : opts.smart
    st = playCard(st, forced ?? botCardSmart(st, seat, calls, smart))
  }
  return { tricks: st.completedTricks, finalState: st, declarerTricks: contractResult(st).declarerTricks }
}

/** Spela en hel giv från utspelet. */
export function spelaHelGiv(deal: Deal, contract: Contract, calls: ResolvedCall[], opts: SpelaGivOpts = {}): SpeladGiv {
  return spelaVidare(startPlay(deal, contract), calls, opts)
}

/**
 * Spela en hel giv deterministiskt: varje botbeslut får ett friskt frö härlett ur
 * (playSeed, beslutsindex) — exakt som tävlingsspelet. Två körningar med samma
 * (giv, playSeed, inställningar) ger identisk kortföljd.
 */
export function spelaMedFro(
  deal: Deal,
  contract: Contract,
  calls: ResolvedCall[],
  playSeed: number,
  smart: SmartOpts = {},
  cardFor?: SpelaGivOpts['cardFor'],
): SpeladGiv {
  return spelaHelGiv(deal, contract, calls, {
    cardFor,
    smart: (st) => ({
      ...smart,
      rng: mulberry32(botDecisionSeed(playSeed, playIndexOf(st.completedTricks.length, st.currentTrick.length))),
    }),
  })
}
