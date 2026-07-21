// Systemrevisorns DD-orakel (docs/systemrevisorn.md): adapter mot npm-paketet
// `bridge-dds` — Bo Haglunds riktiga C++-lösare (dds-bridge/dds) kompilerad
// till WebAssembly. Appens egen TS-lösare (dds.ts) är byggd för SLUTSPEL med
// nodbudget och klarar inte hela 13-korts givar i volym (R3-fyndet: 79/80
// sprängde 2M-budgeten) — mätriggen behöver tusentals helgivstabeller, och
// CalcDDTablePBN löser alla 20 (spelförare × strain) på tiotals millisekunder.
// Paketet är ett REN DEV-BEROENDE: bara revisorn importerar det, inget i den
// skeppade appen.
//
// Verifierade konventioner (låsta av revisor-dds.test.ts):
//   resTable[strain][säte] med strain 0=♠ 1=♥ 2=♦ 3=♣ 4=NT, säte 0=N 1=Ö 2=S 3=V.
//   DealerPar-poängen är NS-orienterad (positiv när N/S äger par-resultatet).

import { Dds, loadDds } from 'bridge-dds'
import type { Deal, Hand, Rank, Seat, Suit, Vulnerability } from '../../types/bridge'
import type { Strain } from './play'
import type { DDSolver } from './revisor'

const RANK_DESC: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
const PBN_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const SEAT_ORDER: Seat[] = ['N', 'E', 'S', 'W']
const STRAIN_IDX: Record<Strain, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3, NT: 4 }
const SEAT_IDX: Record<Seat, number> = { N: 0, E: 1, S: 2, W: 3 }
const VUL_IDX: Record<Vulnerability, number> = { none: 0, all: 1, ns: 2, ew: 3 }

/** En hand i PBN-form: färgerna ♠.♥.♦.♣ åtskilda med punkt, tian = "T". */
function handToPbn(hand: Hand): string {
  return PBN_SUITS.map((suit) =>
    RANK_DESC.filter((r) => hand.some((c) => c.suit === suit && c.rank === r))
      .map((r) => (r === '10' ? 'T' : r))
      .join(''),
  ).join('.')
}

/** Hela given i PBN-form, medurs från N: "N:♠.♥.♦.♣ Ö-hand S-hand V-hand". */
export function dealToPbn(deal: Deal): string {
  return 'N:' + SEAT_ORDER.map((s) => handToPbn(deal.hands[s])).join(' ')
}

let ddsPromise: Promise<Dds> | null = null

/** Ladda WASM-lösaren (engångskostnad, delas av alla anrop). */
export function getDds(): Promise<Dds> {
  ddsPromise ??= loadDds().then((m) => new Dds(m))
  return ddsPromise
}

export interface DDOracle {
  /** DD-stick för (spelförare, strain) — slår upp i den färdiga 20-tabellen. */
  solve: DDSolver
  /** Riktig par-poäng (inkl. offringar/dubblingar), sedd från N/S. */
  parNS: number
  /** Par-kontrakten som lösaren anger, t.ex. "NS:NS 24H" (för rapporten). */
  parContracts: string[]
}

/** DD-tabell + par för EN giv. Kastar DdsError om lösaren skulle vägra given. */
export function computeOracle(dds: Dds, deal: Deal): DDOracle {
  const res = dds.CalcDDTablePBN({ cards: dealToPbn(deal) })
  const solve: DDSolver = (declarer, strain) => res.resTable[STRAIN_IDX[strain]][SEAT_IDX[declarer]]
  const par = dds.DealerPar(res, SEAT_IDX[deal.dealer], VUL_IDX[deal.vulnerability])
  return { solve, parNS: par.score, parContracts: par.contracts }
}
