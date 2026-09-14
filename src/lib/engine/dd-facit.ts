// DD-FACIT FÖR EN GIV (bordens SENARE-lista etapp 2, ägarbeslut 2026-09-14):
// den delade, RENA formen av "hur bra spelade vi mot facit". Servern räknar
// tabellen med bridge-dds (WASM) när given blir klar och bakar in den i
// giv-klar-händelsen (`api-src/_lib/dd-facit.ts`); klienten läser bara.
// Konventionen är lösarens egen (låst av revisor-dds.test.ts):
//   tabell[strain][säte] med strain 0=♠ 1=♥ 2=♦ 3=♣ 4=NT och säte 0=N 1=Ö 2=S 3=V.

import type { Seat } from '../../types/bridge'
import type { Contract, Strain } from './play'

export interface DdFacit {
  /** DD-stick för varje (strain, spelförare): 5 rader × 4 säten. */
  tabell: number[][]
  /** Par-poängen sedd från N/S (positiv = N/S äger par-resultatet). */
  parNS: number
  /** Par-kontrakten som lösaren anger, t.ex. "4H-NS" (kan vara flera). */
  parKontrakt: string[]
}

const STRAIN_IDX: Record<Strain, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3, NT: 4 }
const SEAT_IDX: Record<Seat, number> = { N: 0, E: 1, S: 2, W: 3 }

/** Max antal stick spelföraren kan ta i strainen med perfekt spel på båda sidor. */
export function ddStick(dd: DdFacit, declarer: Seat, strain: Strain): number | null {
  const v = dd.tabell[STRAIN_IDX[strain]]?.[SEAT_IDX[declarer]]
  return typeof v === 'number' ? v : null
}

/** Jämförelsen för det SPELADE kontraktet: facit-stick och skillnaden mot vad
 *  spelföraren faktiskt tog (positiv = fler än facit, dvs. motspelet släppte). */
export function ddJamforelse(
  dd: DdFacit,
  contract: Contract,
  declarerTricks: number,
): { facit: number; diff: number } | null {
  const facit = ddStick(dd, contract.declarer, contract.strain)
  if (facit === null) return null
  return { facit, diff: declarerTricks - facit }
}

const SYM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣', N: 'NT' }

/** Lösarens par-kontrakt ("4H-NS", "3Nx-EW") som läsbar text ("4♥ NS", "3NTx ÖV").
 *  Okänt format lämnas som det är. */
export function formateraParKontrakt(s: string): string {
  const m = /^(\d)([SHDCN])(x{0,2})-(NS|EW)$/i.exec(s.trim())
  if (!m) return s
  const [, level, strain, dbl, sida] = m
  return `${level}${SYM[strain.toUpperCase()]}${dbl.toLowerCase()} ${sida.toUpperCase() === 'EW' ? 'ÖV' : 'NS'}`
}

/** Par-raden: kontrakt(en) + poängen sedd från den sida som äger den. */
export function parText(dd: DdFacit): string {
  const kontrakt = dd.parKontrakt.map(formateraParKontrakt).join(' / ')
  const poang = dd.parNS === 0 ? '±0' : dd.parNS > 0 ? `NS +${dd.parNS}` : `ÖV +${-dd.parNS}`
  return kontrakt ? `${kontrakt} (${poang})` : poang
}
