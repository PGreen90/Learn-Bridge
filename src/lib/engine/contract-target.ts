// Kontraktväljaren (träningsmål i "Spela kort") – STEG 1: filtret.
//
// Idé: din sida (NS) ska med god budgivning nå ett visst mål-kontrakt. Vi
// slumpar givar, låter budmotorn bygga parets kanoniska auktion och behåller
// bara de givar där SLUTKONTRAKTET matchar målet. Sen budar du (Syd) själv –
// bjuder du rätt hamnar du där motorn hade hamnat.
//
// Filen innehåller den rena ja/nej-frågan `matchesTarget`, en läsbar etikett,
// och sökaren `dealForTarget` (slumpa tills en giv matchar målet).

import type { Deal } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { auctionComplete, contractFromCalls, decideCall, seatToAct } from './auction-live'
import { dealRandom } from './deal'
import { side, type Contract } from './play'

/**
 * Ett träningsmål. `random` går aldrig genom filtret (= dagens slumpade giv);
 * de övriga beskriver ett kontrakt DIN sida (NS) ska nå.
 */
export type ContractTarget =
  | 'random'
  | 'major-game' // 4♥ / 4♠
  | 'minor-game' // 5♣ / 5♦
  | 'nt-game' // 3NT
  | 'small-slam' // vilken färg/NT som helst på 6-läget
  | 'grand-slam' // vilken färg/NT som helst på 7-läget
  | 'competitive' // valfritt NS-kontrakt där motståndarna störde

/** Kort, läsbar rubrik per mål (till menyn och "Mål:"-raden under spelet). */
export function describeTarget(target: ContractTarget): string {
  switch (target) {
    case 'random':
      return 'Slumpad giv'
    case 'major-game':
      return 'Utgång i högfärg (4♥/4♠)'
    case 'minor-game':
      return 'Utgång i lågfärg (5♣/5♦)'
    case 'nt-game':
      return 'Sang-utgång (3NT)'
    case 'small-slam':
      return 'Lillslam (6-läget)'
    case 'grand-slam':
      return 'Storslam (7-läget)'
    case 'competitive':
      return 'Med störning från motståndarna'
  }
}

/** Matchar ett FÄRDIGT NS-kontrakt en av de kontraktsbestämda måltyperna? */
function contractMatches(contract: Contract, target: ContractTarget): boolean {
  const { strain, level } = contract
  switch (target) {
    case 'major-game':
      return level === 4 && (strain === 'hearts' || strain === 'spades')
    case 'minor-game':
      return level === 5 && (strain === 'clubs' || strain === 'diamonds')
    case 'nt-game':
      return level === 3 && strain === 'NT'
    case 'small-slam':
      return level === 6
    case 'grand-slam':
      return level === 7
    default:
      return false
  }
}

/**
 * Spelar upp HELA den levande auktionen för given – motorn (`decideCall`) budar
 * varje plats i tur och ordning tills tre pass avslutar. Detta är EXAKT det som
 * händer i "Spela kort" om alla följer systemet, och till skillnad från
 * `finalContract` fångar det svararens placeringsbud (3NT/5m osv.) korrekt.
 */
export function simulateAuction(deal: Deal): ResolvedCall[] {
  const history: ResolvedCall[] = []
  let guard = 0
  while (!auctionComplete(history) && guard++ < 40) {
    const seat = seatToAct(deal.dealer, history.length)
    history.push(decideCall(deal, history, seat))
  }
  return history
}

/**
 * Säger ja om givens levande auktion landar i ett kontrakt som matchar målet.
 * Krav som gäller ALLA mål: auktionen ska nå ett kontrakt och DIN sida (NS) ska
 * äga det – annars kan du inte träna på att bjuda fram det. `random` matchar
 * aldrig (den måltypen går inte via filtret).
 */
export function matchesTarget(deal: Deal, target: ContractTarget): boolean {
  if (target === 'random') return false

  const calls = simulateAuction(deal)
  const contract = contractFromCalls(calls)
  if (!contract) return false // utpassad – inget kontrakt

  // Din sida måste äga kontraktet (du sitter Syd och budar fram det).
  if (side(contract.declarer) !== 'NS') return false

  if (target === 'competitive') {
    // Valfritt NS-kontrakt, men motståndarna (Ö/V) måste ha stört med ett
    // riktigt bud någonstans i auktionen (inte bara passat).
    return calls.some((c) => side(c.seat) === 'EW' && c.bid !== 'P')
  }

  return contractMatches(contract, target)
}

/**
 * Slumpar givar tills en matchar målet (`matchesTarget`), eller ger upp efter
 * `maxTries`. `random` returnerar en vanlig slumpgiv direkt. Returnerar `null`
 * om inget hittades inom budgeten – då kan anroparen visa "hittade ingen".
 *
 * Simuleringen är billig (~0,04 ms/giv), så även storslam (~1 per 1500) hittas
 * på bråkdelen av en sekund. Vanliga mål hittas nästan omedelbart. UI:t kör
 * ändå sökningen i småbatchar (setTimeout) så sidan aldrig fryser vid ett
 * sällsynt mål – se `Play.tsx`.
 */
export function dealForTarget(
  target: ContractTarget,
  maxTries = 40000,
  rng: () => number = Math.random,
): Deal | null {
  if (target === 'random') return dealRandom(rng)
  for (let i = 0; i < maxTries; i++) {
    const deal = dealRandom(rng)
    if (matchesTarget(deal, target)) return deal
  }
  return null
}
