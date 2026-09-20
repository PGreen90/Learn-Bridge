// NATTGRANSKNINGENS KÄRNA — omspelningen mot EN motor + den versionsmedvetna
// domen. Ren logik (ingen DB, ingen git): riggen runt bor i
// tavlingsgranskning.probe.test.ts, omprovet i en äldre motorversion i
// tavlingsomprov.probe.test.ts.
//
// VARFÖR VERSIONER (systemkontrollen 2026-09-20): botkorten är deterministiska
// ur (playSeed, beslutsindex) — men bara för EN motorversion. Granskningen körde
// med motorn på main vid granskningstillfället, så varje spelmotor-deploy mitt
// på en tävlingsdag fällde de inskick som spelats FÖRE deployen (bottarnas
// nattspel, tidiga människor): 29 ärliga inskick flyttades på fyra dagar. Nu
// flaggas ett inskick bara om INGEN motorversion som varit live lagt korten.
//
// OBS — filen kopieras in i ÄLDRE arbetsträd vid omprovet. Importera därför bara
// motorns långlivade moduler (play, play-bot, play-seed, deal, auction-live).

import type { Card, Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { contractFromCalls } from './auction-live'
import { mulberry32 } from './deal'
import { legalCards, playCard, side, startPlay, type PlayState } from './play'
import { botDecisionSeed, playIndexOf } from './play-seed'

/** Motorns kortval i ett läge — `botCardSmart` i den version som prövas. */
export type Motor = (
  state: PlayState,
  seat: Seat,
  history: ResolvedCall[],
  opts: { rng: () => number },
) => Card

export interface GranskadPayload {
  history: ResolvedCall[]
  plays: Card[]
  /** Motorstämpeln: commit-SHA för bygget given spelades med (klienten/botjobbet). */
  motor?: unknown
}

const sammaKort = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank
const kortText = (c: Card) => `${c.rank}${c.suit[0].toUpperCase()}`

/** En hel commit-SHA (40 hex, gemener) — det enda en motorstämpel får vara.
 *  Strikt form: värdet används som git-argument i nattjobbet. */
export function giltigMotorstampel(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{40}$/.test(v)
}

/**
 * Spela om ett inskick och lista de BOTKORT som inte var `motor`s eget val.
 * Människan är Syd: hen styr S, och N när N/S är spelförande sida — de sätena
 * jämförs aldrig. Tom lista = alla botkort var motorns egna.
 */
export function botAvvikelser(
  deal: Deal,
  playSeed: number,
  payload: GranskadPayload | null | undefined,
  motor: Motor,
): string[] {
  if (!payload || !Array.isArray(payload.history) || !Array.isArray(payload.plays)) {
    return ['payload saknas/trasig — kan inte spelas om']
  }
  const avvikelser: string[] = []
  const contract = contractFromCalls(payload.history)
  if (!contract || !payload.plays.length) return avvikelser

  const manniskanStyr = (seat: Seat) =>
    side(contract.declarer) === 'NS' ? side(seat) === 'NS' : seat === 'S'
  let state = startPlay(deal, contract)
  for (const spelat of payload.plays) {
    const seat = state.toAct
    if (!manniskanStyr(seat)) {
      const index = playIndexOf(state.completedTricks.length, state.currentTrick.length)
      const rng = mulberry32(botDecisionSeed(playSeed, index))
      const motorns = motor(state, seat, payload.history, { rng })
      if (!sammaKort(motorns, spelat)) {
        avvikelser.push(`kort ${index + 1} (${seat}): spelat ${kortText(spelat)}, motorn ${kortText(motorns)}`)
      }
    }
    if (!legalCards(state, seat).some((c) => sammaKort(c, spelat))) {
      avvikelser.push(`kort olagligt i omspelningen (${kortText(spelat)}) — avbryter`)
      break
    }
    state = playCard(state, spelat)
  }
  return avvikelser
}

// ---------------------------------------------------------------------------
// Den versionsmedvetna domen
// ---------------------------------------------------------------------------

/** Ett inskick som avvek mot HEAD-motorn och ska prövas mot äldre versioner. */
export interface Omprovsinskick {
  id: string
  board: number
  headAvvikelser: string[]
  /** Inskickets motorstämpel (ogranskad — valideras mot main i domen). */
  motor?: unknown
}

/** Pröva en lista inskick mot motorn i commit `sha`: avvikelser per inskick-id
 *  (tom lista = den versionen lade korten), eller 'fel' om omprovet havererade. */
export type Versionsprov = (
  sha: string,
  inskick: Omprovsinskick[],
) => Promise<Record<string, string[]> | 'fel'>

export interface Versionsdom {
  /** Ingen prövad version lade korten → flyttas till 'granskning'. */
  flytta: Array<{ id: string; board: number; avvikelser: string[]; provade: number }>
  /** En äldre live-version lade exakt de korten → ärligt inskick. */
  friade: Array<{ id: string; sha: string }>
  /** Omprov havererade och ingen version friade → rapporteras, flyttas INTE. */
  ejJamforbara: Array<{ id: string; board: number; skal: string }>
  /** Versionerna som prövades, i ordning. */
  provade: string[]
}

/** Nattjobbets tidsbudget: så många äldre versioner prövas som mest. */
export const MAX_VERSIONER = 6

/**
 * Döm de inskick som avvek mot HEAD. Ordningen: inskickens STÄMPLAR först (det
 * exakta svaret), sedan `kandidater` (de senaste motorversionerna på main,
 * nyast först — fångar ostämplade inskick från äldre klienter). En stämpel som
 * inte är en commit på main (`kandaCommits`) ignoreras — en påhittad stämpel får
 * aldrig bli en genväg förbi granskningen. Ett friat inskick prövas inte vidare.
 */
export async function domOverVersioner(
  inskick: Omprovsinskick[],
  kandidater: string[],
  kandaCommits: ReadonlySet<string>,
  prova: Versionsprov,
  maxVersioner: number = MAX_VERSIONER,
): Promise<Versionsdom> {
  const stamplar = inskick
    .map((i) => i.motor)
    .filter((m): m is string => giltigMotorstampel(m) && kandaCommits.has(m))
  const versioner = [...new Set([...stamplar, ...kandidater])].slice(0, maxVersioner)

  const dom: Versionsdom = { flytta: [], friade: [], ejJamforbara: [], provade: [] }
  let kvar = [...inskick]
  const havererade: string[] = []
  for (const sha of versioner) {
    if (!kvar.length) break
    dom.provade.push(sha)
    const utfall = await prova(sha, kvar)
    if (utfall === 'fel') {
      havererade.push(sha)
      continue
    }
    kvar = kvar.filter((i) => {
      const avv = utfall[i.id]
      if (avv && avv.length === 0) {
        dom.friade.push({ id: i.id, sha })
        return false
      }
      return true
    })
  }

  for (const i of kvar) {
    if (havererade.length) {
      dom.ejJamforbara.push({
        id: i.id,
        board: i.board,
        skal: `omprov havererade för ${havererade.map((s) => s.slice(0, 7)).join(', ')}`,
      })
    } else {
      dom.flytta.push({ id: i.id, board: i.board, avvikelser: i.headAvvikelser, provade: dom.provade.length })
    }
  }
  return dom
}
