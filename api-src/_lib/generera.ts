// Beslut B etapp 2 — dagens tävlingsgivar (ren funktion, delas av genererings-
// endpointen och den kommande omspelningsvalideringen).

import type { Deal } from '../../src/types/bridge'
import { dealFromSeed } from '../../src/lib/engine/deal'
import { seedForBoard } from './seed'

/** Brickorna 1..size för en tävling, var och en deterministisk ur det hemliga
 *  fröet för (frönyckel, bricka). `nyckel` = `fronyckel(dag, form)` (seed.ts):
 *  MP = datumet, IMP = "datum#imp". Samma hemlighet + nyckel ⇒ exakt samma
 *  givar, både när dagen skapas och när ett inskick spelas om vid valideringen. */
export function genereraGivar(secret: string, nyckel: string, size = 12): Deal[] {
  const deals: Deal[] = []
  for (let board = 1; board <= size; board++) {
    deals.push(dealFromSeed(seedForBoard(secret, nyckel, board), board))
  }
  return deals
}
