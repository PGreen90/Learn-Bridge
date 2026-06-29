// Punkt 28: en egen double-dummy solver i ren TypeScript – facit för antal stick
// med perfekt spel. Inga beroenden, ingen WebAssembly: fungerar garanterat på
// GitHub Pages och är fullt testbar (de utvärderade npm-paketen var trasiga).
//
// "Double dummy" = alla fyra händer är kända och alla fyra spelar OPTIMALT. Vi
// söker igenom spelträdet med **alfa-beta-beskärning** och en
// **transpositionstabell** (samma ställning nådd via olika vägar räknas en gång).
// Resultatet är entydigt: spelförarens stick + motspelets stick = 13.
//
// Representation internt: färg 0–3, valör 2–14 (kn=11, D=12, K=13, E=14). Platser
// N,Ö,S,V = index 0,1,2,3; sida = index % 2 (N/S = 0, Ö/V = 1).

import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import type { Contract, Strain } from './play'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const SUIT_IDX: Record<Suit, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 }
const RANK_VAL: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 11, Q: 12, K: 13, A: 14,
}

interface ICard {
  s: number // färg 0–3
  r: number // valör 2–14
}
interface Play {
  seat: number
  s: number
  r: number
}

/** En hand (appens kort) → interna kort. */
function handToInternal(hand: Card[]): ICard[] {
  return hand.map((c) => ({ s: SUIT_IDX[c.suit], r: RANK_VAL[c.rank] }))
}

/** Översätt en giv till interna händer indexerade per plats (0=N,1=Ö,2=S,3=V). */
function toHands(deal: Deal): ICard[][] {
  return SEATS.map((seat) => handToInternal(deal.hands[seat]))
}

/** Vinner `card` över `best` givet utspelsfärg och trumf (−1 = sang)? */
function beats(card: Play, best: Play, leadSuit: number, trump: number): boolean {
  const cT = trump >= 0 && card.s === trump
  const bT = trump >= 0 && best.s === trump
  if (cT !== bT) return cT
  if (cT && bT) return card.r > best.r
  const cL = card.s === leadSuit
  const bL = best.s === leadSuit
  if (cL !== bL) return cL
  return cL && bL ? card.r > best.r : false
}

/** Vinnarens platsindex i ett fullt stick (4 kort). */
function trickWinner(trick: Play[], trump: number): number {
  let best = trick[0]
  for (let i = 1; i < 4; i++) if (beats(trick[i], best, trick[0].s, trump)) best = trick[i]
  return best.seat
}

// Kastas när nodbudgeten överskrids (ställningen är för tung att lösa snabbt).
const BUDGET = Symbol('dds-budget')

/**
 * Lösarens kärna: max antal stick som `targetSide` (0 = N/S, 1 = Ö/V) kan ta när
 * `leaderIdx` spelar ut, med trumf `trump` (−1 = sang). Båda sidor spelar
 * optimalt. Returnerar ett tal 0–13. Söker högst `maxNodes` noder (kastar
 * `BUDGET` om det överskrids – fångas av de publika funktionerna).
 */
function solveDeal(
  hands: ICard[][],
  trump: number,
  firstToAct: number,
  targetSide: number,
  maxNodes: number,
  initialTrick: Play[] = [],
): number {
  const tt = new Map<string, { lo: number; hi: number; mv: number }>()
  const trick: Play[] = [...initialTrick] // ev. redan lagda kort i pågående stick
  let nodes = 0

  // Bitmask per färg över valörer som ÄNNU är ospelade (ligger i någon hand).
  // Driver "likvärdiga kort"-reduktionen: två kort i samma hand utan något
  // ospelat kort emellan ger identiskt resultat → bara ett behöver provas.
  const inPlay = [0, 0, 0, 0]
  // hm[seat*4 + suit] = bitmask över platsens kort i färgen (för billig TT-nyckel).
  const hm = new Array(16).fill(0)
  for (let seat = 0; seat < 4; seat++) {
    for (const c of hands[seat]) {
      inPlay[c.s] |= 1 << c.r
      hm[seat * 4 + c.s] |= 1 << c.r
    }
  }

  /**
   * Lagliga, AVDUBBADE drag för `seat` givet utspelsfärgen, hög → låg. Inom en
   * färg slås löpande sviter (inget motståndarkort emellan) ihop till ett drag.
   */
  function legalMoves(seat: number, leadSuit: number): ICard[] {
    const hand = hands[seat]
    let cand = hand
    if (leadSuit >= 0) {
      const inSuit = hand.filter((c) => c.s === leadSuit)
      if (inSuit.length > 0) cand = inSuit
    }
    const bySuit: ICard[][] = [[], [], [], []]
    for (const c of cand) bySuit[c.s].push(c)

    const out: ICard[] = []
    for (let s = 0; s < 4; s++) {
      const arr = bySuit[s]
      if (arr.length === 0) continue
      arr.sort((a, b) => b.r - a.r) // hög → låg
      let prevKept = -1
      for (const c of arr) {
        if (prevKept < 0) {
          out.push(c)
          prevKept = c.r
          continue
        }
        let oppBetween = false
        for (let r = c.r + 1; r < prevKept; r++) {
          if (inPlay[s] & (1 << r)) {
            oppBetween = true
            break
          }
        }
        if (oppBetween) out.push(c) // ett motståndarkort skiljer → eget drag
        prevKept = c.r // annars likvärdig: utöka sviten, hoppa över kortet
      }
    }
    return out
  }

  /** Bästa (vinnande) kortet i det PÅGÅENDE sticket, för dragordning. */
  function currentBest(): Play | null {
    if (trick.length === 0) return null
    let b = trick[0]
    for (let i = 1; i < trick.length; i++) if (beats(trick[i], b, trick[0].s, trump)) b = trick[i]
    return b
  }

  /**
   * Ordna dragen så nollfönster-sökningen skär tidigt: transpositionstabellens
   * bästa drag först, sedan positionellt – på utspel höga kort först, annars
   * vinn sticket så billigt som möjligt, annars maska lågt.
   */
  function orderMoves(moves: ICard[], leadSuit: number, ttMove: number): void {
    const bp = currentBest()
    moves.sort((a, b) => {
      const at = a.s * 16 + a.r === ttMove ? 1 : 0
      const bt = b.s * 16 + b.r === ttMove ? 1 : 0
      if (at !== bt) return bt - at
      if (leadSuit < 0) return b.r - a.r // utspel: höga kort/vinnare först
      const aw = bp && beats({ seat: 0, s: a.s, r: a.r }, bp, leadSuit, trump) ? 1 : 0
      const bw = bp && beats({ seat: 0, s: b.s, r: b.r }, bp, leadSuit, trump) ? 1 : 0
      if (aw !== bw) return bw - aw // vinnande drag före förlorande
      return a.r - b.r // billigast/lägst först
    })
  }

  /** Kanonisk, billig nyckel för transpositionstabellen (bara vid stickstart). */
  function key(toAct: number): string {
    // Platsernas kort-bitmaskar är redan kanoniska; ingen sortering behövs.
    return (
      toAct +
      ':' +
      hm[0] + ',' + hm[1] + ',' + hm[2] + ',' + hm[3] + ',' +
      hm[4] + ',' + hm[5] + ',' + hm[6] + ',' + hm[7] + ',' +
      hm[8] + ',' + hm[9] + ',' + hm[10] + ',' + hm[11] + ',' +
      hm[12] + ',' + hm[13] + ',' + hm[14] + ',' + hm[15]
    )
  }

  // Alfa-beta (fail-soft). Returnerar målsidans stick från positionen till slutet.
  function ab(toAct: number, alpha: number, beta: number): number {
    if (++nodes > maxNodes) throw BUDGET
    if (trick.length === 0 && hands[toAct].length === 0) return 0

    const trickStart = trick.length === 0
    let k = ''
    let ttMove = -1
    if (trickStart) {
      k = key(toAct)
      const e = tt.get(k)
      if (e) {
        if (e.lo >= beta) return e.lo
        if (e.hi <= alpha) return e.hi
        if (e.lo > alpha) alpha = e.lo
        if (e.hi < beta) beta = e.hi
        ttMove = e.mv
      }
    }
    const a0 = alpha
    const b0 = beta

    const leadSuit = trick.length > 0 ? trick[0].s : -1
    const maximizing = toAct % 2 === targetSide
    const moves = legalMoves(toAct, leadSuit)
    orderMoves(moves, leadSuit, ttMove)
    let best = maximizing ? -Infinity : Infinity
    let bestMv = -1

    for (const card of moves) {
      const hand = hands[toAct]
      hand.splice(hand.indexOf(card), 1)
      inPlay[card.s] &= ~(1 << card.r) // kortet är nu spelat
      hm[toAct * 4 + card.s] &= ~(1 << card.r)
      trick.push({ seat: toAct, s: card.s, r: card.r })

      let val: number
      if (trick.length === 4) {
        const winner = trickWinner(trick, trump)
        const gain = winner % 2 === targetSide ? 1 : 0
        const saved = trick.splice(0, 4) // töm sticket
        val = gain + ab(winner, alpha - gain, beta - gain)
        trick.push(...saved) // återställ
      } else {
        val = ab((toAct + 1) % 4, alpha, beta)
      }

      trick.pop()
      inPlay[card.s] |= 1 << card.r
      hm[toAct * 4 + card.s] |= 1 << card.r
      hand.push(card)

      if (maximizing) {
        if (val > best) {
          best = val
          bestMv = card.s * 16 + card.r
        }
        if (best > alpha) alpha = best
      } else {
        if (val < best) {
          best = val
          bestMv = card.s * 16 + card.r
        }
        if (best < beta) beta = best
      }
      if (alpha >= beta) break
    }

    if (trickStart) {
      const e = tt.get(k) ?? { lo: -Infinity, hi: Infinity, mv: -1 }
      if (best <= a0) e.hi = Math.min(e.hi, best)
      else if (best >= b0) e.lo = Math.max(e.lo, best)
      else {
        e.lo = best
        e.hi = best
      }
      if (bestMv >= 0) e.mv = bestMv
      tt.set(k, e)
    }
    return best
  }

  // Binärsök på antalet stick med NOLLFÖNSTER-sökningar (mycket effektivare
  // beskärning än ett brett fönster). Transpositionstabellen delas mellan varven
  // så bunden kunskap återanvänds.
  // Övre gräns på målsidans stick = flest kort i en hand (= stick kvar, inkl. ev.
  // pågående stick eftersom de ospelade platserna har ett kort mer).
  let hi = Math.max(hands[0].length, hands[1].length, hands[2].length, hands[3].length)
  let lo = 0
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    const v = ab(firstToAct, mid - 1, mid) // "kan målsidan ta minst `mid`?"
    if (v >= mid) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Max antal stick som `leader`s sida kan ta i `strain`, `leader` på utspel. */
export function doubleDummyTricks(deal: Deal, strain: Strain, leader: Seat, maxNodes = Infinity): number {
  const trump = strain === 'NT' ? -1 : SUIT_IDX[strain]
  const leaderIdx = SEATS.indexOf(leader)
  return solveDeal(toHands(deal), trump, leaderIdx, leaderIdx % 2, maxNodes)
}

/**
 * Antal stick spelföraren tar i kontraktet med perfekt spel. Motspelaren till
 * vänster om spelföraren spelar ut; spelförarens stick = 13 − motspelets max.
 */
export function doubleDummyDeclarerTricks(deal: Deal, contract: Contract, maxNodes = Infinity): number {
  const trump = contract.strain === 'NT' ? -1 : SUIT_IDX[contract.strain]
  const declIdx = SEATS.indexOf(contract.declarer)
  const leaderIdx = (declIdx + 1) % 4 // utspelaren = spelförarens vänstra motståndare
  return solveDeal(toHands(deal), trump, leaderIdx, declIdx % 2, maxNodes)
}

/**
 * Budgeterad variant för appen: returnerar `null` om ställningen är för tung att
 * lösa inom `maxNodes` noder (i stället för att frysa gränssnittet). Annars exakt
 * antal stick spelföraren kan ta med perfekt spel.
 */
export function tryDoubleDummyDeclarerTricks(deal: Deal, contract: Contract, maxNodes: number): number | null {
  try {
    return doubleDummyDeclarerTricks(deal, contract, maxNodes)
  } catch (e) {
    if (e === BUDGET) return null
    throw e
  }
}

/**
 * Spelförarens max antal stick TILL från en pågående ställning (perfekt spel).
 * `hands` = återstående kort per plats, `currentTrick` = kort redan lagda i det
 * pågående sticket (medurs), `toAct` = vems tur det är. Returnerar `null` om
 * ställningen är för tung inom `maxNodes` (fryser aldrig gränssnittet). Eftersom
 * korten blir färre ju längre spelet gått går sena ställningar snabbt.
 */
export function doubleDummyDeclarerRemaining(
  hands: Record<Seat, Card[]>,
  strain: Strain,
  declarer: Seat,
  currentTrick: { seat: Seat; card: Card }[],
  toAct: Seat,
  maxNodes: number,
): number | null {
  const trump = strain === 'NT' ? -1 : SUIT_IDX[strain]
  const internal = SEATS.map((s) => handToInternal(hands[s]))
  const initialTrick: Play[] = currentTrick.map((p) => ({
    seat: SEATS.indexOf(p.seat),
    s: SUIT_IDX[p.card.suit],
    r: RANK_VAL[p.card.rank],
  }))
  try {
    return solveDeal(internal, trump, SEATS.indexOf(toAct), SEATS.indexOf(declarer) % 2, maxNodes, initialTrick)
  } catch (e) {
    if (e === BUDGET) return null
    throw e
  }
}
