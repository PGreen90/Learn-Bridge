// CLAIM VID BORDET — DD-DOMEN (bordens SENARE-lista etapp 3, ägarbeslut
// 2026-09-14: "när DD vill claima ska den göra det, men människan ska få
// välja OK eller spela klart"). Ren funktion ovanpå bridge-dds: vid ett
// stickstart frågar servern lösaren om SPELFÖRARSIDAN tar ALLA återstående
// stick mot bästa motspel från exakt den här ställningen (SolveBoardPBN med
// bara de återstående korten). Ja → bordet föreslår claimen (bord-motor.ts
// bokför 'claim-forslag'). Anropet är synkront när lösaren väl är laddad
// (getDds cachar instansen) och tar millisekunder — därför kan drivFram
// (ren, synkron) få den som injicerad `claimKontroll`. Lösarfel → false
// (ingen claim, spelet fortsätter som vanligt).

import type { Dds } from 'bridge-dds'
import type { Deal, Seat } from '../../src/types/bridge'
import { remainingTricks } from '../../src/lib/engine/claim'
import { computeOracle, dealToPbn, getDds } from '../../src/lib/engine/revisor-dds'
import type { BudOrakel } from './bord-motor'
import { side, type PlayState, type Strain } from '../../src/lib/engine/play'

const STRAIN_IDX: Record<Strain, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3, NT: 4 }
const SEAT_IDX: Record<Seat, number> = { N: 0, E: 1, S: 2, W: 3 }

/** Tar spelförarsidan alla återstående stick med perfekt spel på båda sidor?
 *  Bara vid STICKSTART (pågående stick spelas alltid klart). */
export function spelforarenTarResten(dds: Dds, state: PlayState): boolean {
  if (state.currentTrick.length > 0) return false
  const kvar = remainingTricks(state)
  if (kvar === 0) return false
  try {
    const svar = dds.SolveBoardPBN(
      {
        trump: STRAIN_IDX[state.contract.strain],
        first: SEAT_IDX[state.toAct],
        currentTrickSuit: [],
        currentTrickRank: [],
        remainCards: dealToPbn({ hands: state.hands } as Deal),
      },
      -1, // target −1 = hitta maximala antalet stick …
      1, // … för ett (det bästa) kortet
      0, // mode 0: ingen återanvändning av tidigare lösning
    )
    const ledarSidansStick = svar.score[0] ?? 0
    const spelforarensStick =
      side(state.toAct) === side(state.contract.declarer) ? ledarSidansStick : kvar - ledarSidansStick
    return spelforarensStick === kvar
  } catch {
    return false
  }
}

/** Resonemangslagrets DD-orakel för bordets bottar (ägarbeslut 2026-09-24:
 *  bottarna bjuder som i tävlingen). Samma lösare och samma tabelluppslag som
 *  klientens webworker (resonemang-worker.ts) → samma bud för samma läge.
 *  null om lösaren inte går att ladda: då bjuder bottarna ur tabellen. */
export async function budOrakel(): Promise<BudOrakel | null> {
  try {
    const dds = await getDds()
    return (d) => computeOracle(dds, d).solve
  } catch {
    return null
  }
}

/** Den injicerbara kontrollen för drivFram — lösaren laddas (en gång per varm
 *  instans) och bakas in i en synkron funktion. null om lösaren inte går att
 *  ladda: då föreslås inga claims, spelet är opåverkat. */
export async function claimKontrollen(): Promise<((state: PlayState) => boolean) | null> {
  try {
    const dds = await getDds()
    return (state) => spelforarenTarResten(dds, state)
  } catch {
    return null
  }
}
