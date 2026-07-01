// Signalavkodning (docs/bot-hjarna.md, Steg 3 / FAS 11 pt 50). Motspelaren
// *läser* partnerns markering och matar in slutsatsen i hand-modellen, så
// Monte-Carlo-samplaren delar ut de dolda händerna troligare.
//
// Just nu avkodar vi det STARKASTE, mest entydiga kortet: ÖPPNINGSUTSPELET.
// Bottarna spelar ut deterministiskt enligt §8.3 (`signals.leadFromSuit` på den
// längsta färgen), så deras utspel bär ärlig information:
//
//   • LÄNGD – ett 13-kortshand har alltid en färg med ≥4 kort, och boten leder
//     ur sin längsta. Alltså har utspelaren ≥4 kort i utspelsfärgen. Vattentätt.
//   • HONNÖR – en bot leder ALDRIG sitt högsta kort i en färg som spotkort
//     (3:e/5:e bästa är aldrig det högsta), bara `honorLead` (topp av sekvens)
//     gör det. Så om det utspelade kortet bevisligen är utspelarens högsta i
//     färgen (alla högre kort syns för den agerande platsen) och det är en
//     honnör → utspelaren håller den touchérande honnören under. Bara då.
//
// Järnprincip (ingen tjuvkik): vi avkodar BARA bottars utspel (deterministisk
// §8.3), aldrig människans (Syd) – vi känner inte hennes markeringsmetod. Och
// honnörsslutsatsen dras bara när den är entydig, aldrig på en gissning.

import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { playedCards, visibleSeats } from './card-counting'
import type { PlayState } from './play'
import type { HandModel } from './hand-model'
import { lenMin, suitHcpFloor } from './hand-model'

const RANK_LOW_TO_HIGH: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: Rank) => RANK_LOW_TO_HIGH.indexOf(r)
const HCP_BY_RANK: Partial<Record<Rank, number>> = { A: 4, K: 3, Q: 2, J: 1 }
const hcpOf = (r: Rank) => HCP_BY_RANK[r] ?? 0

/**
 * Värdet på topp-sekvensen ett honnörsutspel visar = det utspelade kortet +
 * den touchérande honnören precis under (den boten garanterat också håller).
 * A→A-K (7), K→K-D (5), D→D-kn (3), kn→kn-10 (1). Icke-honnör → 0.
 */
function sequenceHcpFloor(led: Rank): number {
  const below = RANK_LOW_TO_HIGH[rankVal(led) - 1]
  return hcpOf(led) + (below ? hcpOf(below) : 0)
}

/** Kortet utspelaren la på trick 1 (första kortet i första sticket) + platsen. */
function openingLead(state: PlayState): { seat: Seat; card: Card } | null {
  const first = state.completedTricks[0]
  if (first && first.cards.length > 0) return { seat: first.cards[0].seat, card: first.cards[0].card }
  // Trick 1 kan pågå (avkodas sällan i det läget, men var robust):
  if (state.completedTricks.length === 0 && state.currentTrick.length > 0) {
    return { seat: state.currentTrick[0].seat, card: state.currentTrick[0].card }
  }
  return null
}

/**
 * Skärper `model` med det som öppningsutspelet ärligt avslöjar, sett ur `seat`s
 * (den agerande platsens) synvinkel. Muterar modellen och returnerar den.
 *
 * `opts.humanSeat` (default 'S') avkodas ALDRIG – vi antar bara den
 * deterministiska §8.3-doktrinen för bottarna, aldrig för människan.
 */
export function applyOpeningLeadSignal(
  model: HandModel,
  state: PlayState,
  seat: Seat,
  opts: { humanSeat?: Seat } = {},
): HandModel {
  const humanSeat = opts.humanSeat ?? 'S'
  const lead = openingLead(state)
  if (!lead) return model
  const leader = lead.seat
  if (leader === humanSeat) return model // människans markering avkodas inte
  // Bara motspelarens utspel (utspelaren är alltid en försvarare, men vaktar
  // ändå: spelföraren/träkarlen "leder" aldrig trick 1).
  const suit = lead.card.suit

  // (1) Längd: boten leder ur sin längsta färg → utspelsfärgen har ≥4 kort.
  lenMin(model[leader], suit, 4)

  // (2) Honnör: bara om det utspelade kortet bevisligen är utspelarens högsta i
  // färgen – dvs. varje HÖGRE kort i färgen syns redan för `seat` (egen hand +
  // träkarl + spelade). Då kan det inte vara ett spotutspel (3:e/5:e bästa), så
  // honnörsutspelsdoktrinen gäller → den touchérande honnören hålls.
  if (hcpOf(lead.card.rank) > 0) {
    const seen = new Set<string>()
    for (const c of playedCards(state)) if (c.suit === suit) seen.add(c.rank)
    for (const v of visibleSeats(state, seat)) for (const c of state.hands[v]) if (c.suit === suit) seen.add(c.rank)
    const higher = RANK_LOW_TO_HIGH.slice(rankVal(lead.card.rank) + 1)
    const allHigherSeen = higher.every((r) => seen.has(r))
    if (allHigherSeen) suitHcpFloor(model[leader], suit, sequenceHcpFloor(lead.card.rank))
  }

  // Håll golv ≤ tak (signalen kan i teorin krocka med budinferensen; då vinner
  // den lägre gränsen och samplaren faller tillbaka på tumregler om omöjligt).
  clampSeat(model, leader, suit)
  return model
}

/** Klampa längd- och färg-HP-golv mot taket för en plats/färg efter skärpning. */
function clampSeat(model: HandModel, seat: Seat, suit: Suit): void {
  const c = model[seat]
  if (c.length[suit].min > c.length[suit].max) c.length[suit].min = c.length[suit].max
  if (c.suitHcp[suit].min > c.suitHcp[suit].max) c.suitHcp[suit].min = c.suitHcp[suit].max
}
