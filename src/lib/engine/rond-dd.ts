// Rondgenomgångens DD-dom (etapp 3). Ren analysmodul: de bokförda sticken
// spelas upp till varje stickgräns och facitlösaren (samma som Facit-knappen)
// svarar hur många stick spelföraren totalt når därifrån med perfekt spel av
// alla. Sjunker facit över ett stick tappade spelförarsidan något; stiger det
// släppte motspelet något. Textraderna vänds sedan till ANVÄNDARENS perspektiv
// (alltid NS) av ddForStick/ddResultatRader.
//
// Kostnadsgräns: gränserna räknas BAKIFRÅN (färst kort = billigast). Första
// ställning som spränger nodbudgeten avbryter — alla tidigare gränser blir
// ärligt null (UI:t säger "analysen når från stick X"). Så kostar en analys i
// värsta fall EN sprängd budget, och fulldeals-DD (som spränger budgeten på
// nästan alla hela givar) försöks aldrig i onödan. Körs i rapport-worker.ts
// så huvudtråden aldrig fryser; useDdAnalys faller tillbaka inline utan worker.

import type { Deal } from '../../types/bridge'
import { doubleDummyDeclarerRemaining } from './dds'
import { playCard, side, startPlay, type Contract, type PlayState, type Trick } from './play'

/** Nodbudget per lösning (jfr Facit-knappens 2M — snäppet snålare, vi löser många). */
export const RAPPORT_BUDGET = 1_500_000

export interface DdAnalys {
  /**
   * Facit per stickgräns: index k = spelförarens totala stick med perfekt spel
   * från läget EFTER k spelade stick (redan vunna + optimala resten).
   * null = ställningen var för tung inom budgeten.
   */
  boundaries: (number | null)[]
  /** Första gränsindex med värde (null-prefixet slutar där), eller null om inget gick. */
  fromBoundary: number | null
  /** Stick (1-baserat) där facit SJÖNK = spelförarsidan tappade `antal` stick. */
  tappade: { trick: number; antal: number }[]
  /** Stick där facit STEG = motspelet släppte `antal` stick. */
  vunna: { trick: number; antal: number }[]
}

export interface DdRad {
  text: string
  ton: 'berom' | 'laxa' | 'neutral'
}

/** "ett stick" / "2 stick" — samma stil som resultatkapitlets övertricksrad. */
function stickText(n: number): string {
  return n === 1 ? 'ett stick' : `${n} stick`
}

/** Antal stick spelförarsidan vunnit i ett läge. */
function declWon(state: PlayState, contract: Contract): number {
  return side(contract.declarer) === 'NS' ? state.tricksNS : state.tricksEW
}

/** Ligger några kort kvar att spela? (Slutgränsen efter 13 stick är trivialt 0 till.) */
function cardsLeft(state: PlayState): boolean {
  return (['N', 'E', 'S', 'W'] as const).some((s) => state.hands[s].length > 0)
}

/**
 * Analysera en färdigspelad (eller claimad) giv. Deterministisk och ren —
 * kastar aldrig på grund av budgeten (för tungt → null-gränser).
 */
export function analyzeDd(
  deal: Deal,
  contract: Contract,
  tricks: Trick[],
  perSolveBudget = RAPPORT_BUDGET,
): DdAnalys {
  // Spela upp de bokförda sticken → ett läge per stickgräns (0..tricks.length).
  const states: PlayState[] = [startPlay(deal, contract)]
  for (const trick of tricks) {
    let st = states[states.length - 1]
    for (const pc of trick.cards) st = playCard(st, pc.card)
    states.push(st)
  }

  // Bakifrån: billigast först, avbryt vid första sprängda budgeten.
  const boundaries: (number | null)[] = states.map(() => null)
  for (let k = states.length - 1; k >= 0; k--) {
    const st = states[k]
    if (!cardsLeft(st)) {
      boundaries[k] = declWon(st, contract)
      continue
    }
    const kvar = doubleDummyDeclarerRemaining(
      st.hands,
      contract.strain,
      contract.declarer,
      [],
      st.toAct,
      perSolveBudget,
    )
    if (kvar === null) break
    boundaries[k] = declWon(st, contract) + kvar
  }

  const fromBoundary = boundaries.findIndex((b) => b !== null)
  const tappade: { trick: number; antal: number }[] = []
  const vunna: { trick: number; antal: number }[] = []
  for (let k = 1; k < boundaries.length; k++) {
    const före = boundaries[k - 1]
    const efter = boundaries[k]
    if (före === null || efter === null) continue
    if (efter < före) tappade.push({ trick: k, antal: före - efter })
    if (efter > före) vunna.push({ trick: k, antal: efter - före })
  }

  return { boundaries, fromBoundary: fromBoundary === -1 ? null : fromBoundary, tappade, vunna }
}

/**
 * DD-raden för ett enskilt stick (eller null när facit inte rörde sig där).
 * Perspektivet är användarens: NS spelför → tappat är en läxa; ÖV spelför →
 * spelförarens tapp är motspelets förtjänst.
 */
export function ddForStick(analys: DdAnalys, trick: number, declSide: 'NS' | 'EW'): DdRad | null {
  const tapp = analys.tappade.find((t) => t.trick === trick)
  if (tapp) {
    return declSide === 'NS'
      ? { text: `Facit: här tappade er sida ${stickText(tapp.antal)}.`, ton: 'laxa' }
      : { text: `Facit: spelföraren spelade bort ${stickText(tapp.antal)} här.`, ton: 'berom' }
  }
  const vinst = analys.vunna.find((v) => v.trick === trick)
  if (vinst) {
    return declSide === 'NS'
      ? { text: `Facit: motspelet släppte ${stickText(vinst.antal)} här.`, ton: 'berom' }
      : { text: `Facit: ert motspel släppte ${stickText(vinst.antal)} här.`, ton: 'laxa' }
  }
  return null
}

/**
 * Domen i resultatkapitlet: jämför det spelade utfallet med facit vid den
 * tidigaste gräns som gick att räkna, plus ärliga rader om räckvidd och claim.
 */
export function ddResultatRader(
  analys: DdAnalys,
  declSide: 'NS' | 'EW',
  declarerTricks: number,
  claimed: { total: number; auto: boolean } | null,
): DdRad[] {
  if (analys.fromBoundary === null) {
    return [
      {
        text: 'Facit-analysen var för tung för den här given — ingen stickdom den här gången.',
        ton: 'neutral',
      },
    ]
  }

  const rader: DdRad[] = []
  if (analys.fromBoundary > 0) {
    rader.push({
      text: `Facit-analysen når från stick ${analys.fromBoundary + 1} — tidigare lägen är för tunga att lösa exakt.`,
      ton: 'neutral',
    })
  }

  const baseline = analys.boundaries[analys.fromBoundary]!
  const diff = declarerTricks - baseline
  if (diff === 0) {
    if (analys.tappade.length === 0 && analys.vunna.length === 0) {
      rader.push(
        declSide === 'NS'
          ? { text: 'Facit: ni tog exakt vad som gick att ta — inget stick tappades.', ton: 'berom' }
          : {
              text: 'Facit: motspelet gav inte bort något — spelföraren fick bara vad som gick.',
              ton: 'berom',
            },
      )
    } else {
      rader.push({
        text: 'Facit: slutresultatet landade på facit, men stick byttes på vägen (se ⚠ i Spelföringen).',
        ton: 'neutral',
      })
    }
  } else if (diff < 0) {
    rader.push(
      declSide === 'NS'
        ? {
            text: `Facit: med perfekt spel fanns ${baseline} stick — ${stickText(-diff)} tappades på vägen (se ⚠ i Spelföringen).`,
            ton: 'laxa',
          }
        : {
            text: `Facit: spelföraren slutade ${stickText(-diff)} under sitt facit — bra press av motspelet.`,
            ton: 'berom',
          },
    )
  } else {
    rader.push(
      declSide === 'NS'
        ? {
            text: `Facit: ni tog ${stickText(diff)} mer än facit lovade — motspelet släppte och ni plockade upp. Bra jobbat.`,
            ton: 'berom',
          }
        : {
            text: `Facit: spelföraren fick ${stickText(diff)} mer än facit — motspelet släppte dem (se ⚠ i Spelföringen).`,
            ton: 'laxa',
          },
    )
  }

  // Manuell claim under facit: claimen godkändes (den var säker), men fler
  // stick gick att säkra från claimläget. Auto Claim är per definition exakt.
  if (claimed && !claimed.auto && declSide === 'NS') {
    const sista = analys.boundaries[analys.boundaries.length - 1]
    if (sista !== null && claimed.total < sista) {
      rader.push({
        text: `Claimen tog ${claimed.total} stick, men facit säger att ${sista} gick att säkra härifrån.`,
        ton: 'neutral',
      })
    }
  }

  return rader
}
