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
import { currentWinner, PARTNER_SEAT, side, type PlayState } from './play'
import type { HandModel, Markeringslasning } from './hand-model'
import { lenMin, suitHcpFloor } from './hand-model'
import { foljBetydelse, foljKort, type FoljLage } from './signals'

const RANK_LOW_TO_HIGH: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: Rank) => RANK_LOW_TO_HIGH.indexOf(r)
const SUIT_RANK_LOW_TO_HIGH: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
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
  opts: { humanSeat?: Seat; budstyrt?: boolean } = {},
): HandModel {
  const humanSeat = opts.humanSeat ?? 'S'
  const lead = openingLead(state)
  if (!lead) return model
  const leader = lead.seat
  if (leader === humanSeat) return model // människans markering avkodas inte
  // MC-urfallet fix 3 (2026-08-13): inferenserna nedan gäller BARA när utspelet
  // följde "längsta färgen"-doktrinen. Mot TRUMF väljer §8.3 "minst riskabla
  // färgen" (kan vara K från K-6 dubbelton — frö 20260731), och ett BUDSTYRT
  // utspel (partnerns färg / undvik deras — hål A–G) väljer färg av helt andra
  // skäl. Att anta längd/honnör där satte falska golv som gjorde Monte-Carlo-
  // samplingen omöjlig. Hellre färre inferenser än falska.
  if (state.trump !== null) return model
  if (opts.budstyrt) return model
  // Bara motspelarens utspel (utspelaren är alltid en försvarare, men vaktar
  // ändå: spelföraren/träkarlen "leder" aldrig trick 1).
  const suit = lead.card.suit

  // (1) Längd: boten leder ur sin längsta färg → utspelsfärgen har ≥4 kort.
  lenMin(model[leader], suit, 4)

  // (2) Honnör: bara om det utspelade kortet bevisligen är utspelarens högsta i
  // färgen – dvs. varje HÖGRE kort i färgen syns redan för `seat` (egen hand +
  // träkarl + spelade). Då kan det inte vara ett spotutspel (3:e/5:e bästa), så
  // honnörsutspelsdoktrinen gäller → den touchérande honnören hålls. Vakt (fix
  // 3): syns den touchérande honnören redan någon annanstans kan utspelaren
  // omöjligt hålla den → inget golv (skydd mot doktrin-drift).
  if (hcpOf(lead.card.rank) > 0) {
    const seen = new Set<string>()
    for (const c of playedCards(state)) if (c.suit === suit) seen.add(c.rank)
    for (const v of visibleSeats(state, seat)) for (const c of state.hands[v]) if (c.suit === suit) seen.add(c.rank)
    const higher = RANK_LOW_TO_HIGH.slice(rankVal(lead.card.rank) + 1)
    const allHigherSeen = higher.every((r) => seen.has(r))
    const touching = RANK_LOW_TO_HIGH[rankVal(lead.card.rank) - 1]
    const touchingElsewhere = touching !== undefined && seen.has(touching)
    if (allHigherSeen && !touchingElsewhere) suitHcpFloor(model[leader], suit, sequenceHcpFloor(lead.card.rank))
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
  // Konflikt HP-golv > tak: taket (signal/hård fakta) vinner, golvet sänks.
  if (c.suitHcp[suit].min > c.suitHcp[suit].max) c.suitHcp[suit].min = c.suitHcp[suit].max
}

/** Markeringar läggs bara medan tumreglerna spelar: de fem första sticken
 *  (mer än åtta kort på handen). Därefter väljer Monte-Carlo kortet och då bär
 *  det ingen markering. */
const MARKERINGSSTICK = 5

/**
 * Stämmer den lästa markeringen med den här (tänkta) ursprungshanden? Frågan en
 * människa ställer vid bordet: "skulle partnern ha lagt det där kortet från den
 * där handen?" Svaret ges av SAMMA regel som den som markerar använder
 * (`foljBetydelse`/`foljKort`): handen stryks bara när den hade haft ett val och
 * regeln hade valt det MOTSATTA kortet — ♥2 från ♥D-5-2 (hade uppmuntrat med
 * femman), ♠7 från ♠7-4-3 (udda antal lägger lågt). Ett tvingat kort (♥2 ur
 * ♥D-2) och ett kort regeln inte känner igen (ett mellankort) stryker ingenting:
 * hellre en missad läsning än en falsk.
 */
export function markeringStammer(m: Markeringslasning, ursprungshand: Card[]): boolean {
  const suit = m.card.suit
  const borta = new Set(m.tidigare.map((c) => c.rank))
  const iFargen = ursprungshand.filter((c) => c.suit === suit && !borta.has(c.rank))
  if (!iFargen.some((c) => c.rank === m.card.rank)) return true // kortet finns inte här: inget att pröva
  const tak = m.under === null ? null : rankVal(m.under)
  const kandidater = tak === null ? iFargen : iFargen.filter((c) => rankVal(c.rank) < tak)
  if (kandidater.length < 2) return true // inget val
  const lage: FoljLage = {
    iFargen,
    kandidater,
    spelade: m.spelade,
    partnerLedde: m.kind === 'attitude',
    trumfkontrakt: m.trumfkontrakt,
    trumfFargen: m.trumfFargen,
    utspel: m.utspel,
  }
  const vill = foljBetydelse(lage)
  if (!vill) return true
  const lagsta = kandidater.reduce((lo, c) => (rankVal(c.rank) < rankVal(lo.rank) ? c : lo))
  const ratt = foljKort(lage, vill.kind, vill.hogt) ?? lagsta
  const tvartom = foljKort(lage, vill.kind, !vill.hogt) ?? lagsta
  if (ratt.rank === tvartom.rank) return true // tvingat kort: ingen markering
  return m.card.rank !== tvartom.rank
}

/**
 * Signalavkodning under spelets gång (docs/budsystem.md §8.5). Läser
 * motspelarnas FÖLJEMARKERINGAR — attityd på partnerns utspel (högt uppmuntrar:
 * dam eller högre, kort färg i trumfkontrakt, längd i sang mot honnörsutspel)
 * och räkning på spelförarens (högt = jämnt antal, lågt = udda; aldrig i
 * trumffärgen) — och lägger dem i hand-modellen som `markeringar`. Monte-Carlo-
 * samplaren stryker sedan varje tänkt hand som skulle ha markerat tvärtom
 * (`markeringStammer`).
 *
 * Bara kort som KAN vara en markering registreras: en hacka (under tian), lagd
 * av en motspelare som följde färg under de fem första sticken, de två första
 * gångerna färgen spelas, utan att ta sticket och — i tredje och fjärde hand —
 * utan att gå över det kort som låg högst (det är ett försök att vinna sticket,
 * ingen markering).
 *
 * Järnprincip (ingen tjuvkik): bara ärligt synliga kort avkodas, aldrig den
 * agerande platsens egen hand (den samplas inte). Sedan felrapport #96
 * (ägarbeslut 2026-10-06) läses ÄVEN människans markeringar — antagandet är att
 * hon spelar appens §8-system (`opts.humanSeat` finns kvar bara för tester som
 * vill stänga av det). Partnerns Lavinthal-sak höjer dessutom honnörsgolvet i
 * den önskade färgen (minst en dam) — `partnerLavinthalRequest`.
 */
export function applySignalReads(
  model: HandModel,
  state: PlayState,
  seat: Seat,
  opts: { humanSeat?: Seat | null } = {},
): HandModel {
  const humanSeat = opts.humanSeat === undefined ? null : opts.humanSeat
  const declarer = state.contract.declarer
  const spelade: Card[] = []
  const tidigare: Record<Seat, Card[]> = { N: [], E: [], S: [], W: [] }
  const gangerLedd: Partial<Record<Suit, number>> = {}
  state.completedTricks.forEach((trick, stick) => {
    if (trick.cards.length === 0) return
    const ledSuit = trick.cards[0].card.suit
    const leader = trick.cards[0].seat
    trick.cards.forEach((pc, plats) => {
      const s = pc.seat
      const fore = trick.cards.slice(0, plats)
      const kanVaraMarkering =
        plats > 0 &&
        stick < MARKERINGSSTICK &&
        (gangerLedd[ledSuit] ?? 0) < 2 && // §8.1: bara de två första gångerna färgen spelas
        side(s) !== side(declarer) && // bara motspelet markerar
        s !== seat &&
        !(humanSeat !== null && s === humanSeat) && // aldrig egen hand
        s !== leader &&
        s !== trick.winner && // utspel / vinnare markerar inte
        pc.card.suit === ledSuit && // bara när platsen följde färg
        rankVal(pc.card.rank) < rankVal('10') // bara hackor bär markeringar
      if (kanVaraMarkering) {
        const partnerLedde = side(leader) === side(s)
        const vinnare = currentWinner(fore, state.trump)
        const hogst = fore.find((f) => f.seat === vinnare)!.card
        // Tredje/fjärde hand: ett kort som går över det högsta i sticket är ett
        // försök att vinna, ingen markering.
        const gickOver = plats >= 2 && hogst.suit === ledSuit && rankVal(pc.card.rank) > rankVal(hogst.rank)
        const trumfFargen = state.trump !== null && ledSuit === state.trump
        if (!gickOver && !(trumfFargen && !partnerLedde)) {
          const lasning: Markeringslasning = {
            card: pc.card,
            kind: partnerLedde ? 'attitude' : 'count',
            tidigare: tidigare[s].filter((c) => c.suit === ledSuit),
            spelade: [...spelade],
            under: side(vinnare) === side(s) && hogst.suit === ledSuit ? hogst.rank : null,
            trumfkontrakt: state.trump !== null,
            trumfFargen,
            utspel: trick.cards[0].card.rank,
          }
          ;(model[s].markeringar ??= []).push(lasning)
        }
      }
      spelade.push(pc.card)
    })
    for (const pc of trick.cards) tidigare[pc.seat].push(pc.card)
    gangerLedd[ledSuit] = (gangerLedd[ledSuit] ?? 0) + 1
  })
  // Partnerns Lavinthal-sak: den önskade färgen bär minst en dam.
  // Bara en HÖG sak lovar något (inventeringen 2026-11-22): en färg begärs med
  // dam eller högre i den. En låg sak betyder "den lägre färgen, eller ingenting"
  // — den som inte har något att be om lägger också lågt — så den höjer inget golv.
  const sak = partnerLavinthalSak(state, seat)
  if (sak?.hogt) {
    suitHcpFloor(model[PARTNER_SEAT[seat]], sak.suit, 2)
    clampSeat(model, PARTNER_SEAT[seat], sak.suit)
  }
  return model
}

/**
 * Partnerns LAVINTHAL-SAK (§8.2/§8.5), läst ur `seat`s synvinkel (felrapport
 * #96, ägarbeslut 2026-10-06 — bottarna läser även människans markeringar,
 * under antagandet att hon spelar appens §8-system). Partnerns FÖRSTA sak i
 * given (följde inte färg, trumfade inte) ber om en färg: ett högt kort (7+)
 * = den HÖGSTA av de andra färgerna, ett lågt (5 eller lägre) = den LÄGSTA —
 * exakt så som encodern `defenderFirstDiscardSignal` väljer bland alla färger
 * utom sakfärgen och trumfen (i sang alltså tre färger). En sexa är oläsbar.
 * Bara motspelet markerar: spelförarsidan läser inget.
 */
export function partnerLavinthalRequest(state: PlayState, seat: Seat): Suit | null {
  return partnerLavinthalSak(state, seat)?.suit ?? null
}

/** Partnerns första sak, läst: vilken färg den pekar på och om kortet var HÖGT
 *  (en riktig begäran, som lovar dam eller högre) eller lågt (lovar ingenting).
 *  En sak pekar på en av TVÅ färger — aldrig sakfärgen, aldrig trumfen och, i
 *  SANG, aldrig färgen som spelades ut i sticket (där är partnern renons). I
 *  trumfkontrakt räknas utspelsfärgen med: att be om den är att be om en stöld.
 *  Blir det inte exakt två färger kvar finns inget att läsa. */
export function partnerLavinthalSak(state: PlayState, seat: Seat): { suit: Suit; hogt: boolean } | null {
  const declarer = state.contract.declarer
  if (side(seat) === side(declarer)) return null
  const partner = PARTNER_SEAT[seat]
  for (const trick of state.completedTricks) {
    const led = trick.cards[0]?.card.suit
    if (!led) continue
    const pc = trick.cards.find((c) => c.seat === partner)
    if (!pc || pc.card.suit === led) continue
    if (state.trump !== null && pc.card.suit === state.trump) return null // stöld, inte sak
    const r = rankVal(pc.card.rank)
    const others = SUIT_RANK_LOW_TO_HIGH.filter(
      (s) => s !== pc.card.suit && s !== state.trump && (state.trump !== null || s !== led),
    )
    if (others.length !== 2) return null
    if (r >= rankVal('7')) return { suit: others[1], hogt: true }
    if (r <= rankVal('5')) return { suit: others[0], hogt: false }
    return null // sexan säger inget säkert
  }
  return null
}

/**
 * AVSKRÄCKTE partnern mitt öppningsutspel (§8.5, ägarbeslut 2026-11-24)? Läst
 * som vid bordet, utan sampling: partnerns kort i stick 1 var en hacka som inte
 * försökte ta sticket och som BEVISLIGEN är partnerns lägsta — alla lägre kort
 * i färgen syns för mig (egen hand, träkarlen, spelade). Dessutom ska minst två
 * högre hackor vara osedda, så att partnern kan ha haft något att uppmuntra med.
 * Ett kort som inte säkert är det lägsta läses inte: då fortsätter jag som förr.
 */
export function partnerAvskrackteUtspelet(state: PlayState, seat: Seat): boolean {
  const t = state.completedTricks[0]
  if (!t || t.cards.length < 4 || t.cards[0].seat !== seat) return false
  if (side(seat) === side(state.contract.declarer)) return false
  const partner = PARTNER_SEAT[seat]
  const suit = t.cards[0].card.suit
  const plats = t.cards.findIndex((pc) => pc.seat === partner)
  if (plats < 1) return false
  const kort = t.cards[plats].card
  if (kort.suit !== suit || t.winner === partner || rankVal(kort.rank) >= rankVal('10')) return false
  const fore = t.cards.slice(0, plats)
  const hogst = fore.find((f) => f.seat === currentWinner(fore, state.trump))!.card
  if (hogst.suit === suit && rankVal(kort.rank) > rankVal(hogst.rank)) return false // försökte ta sticket
  const sedda = new Set<Rank>()
  for (const c of playedCards(state)) if (c.suit === suit) sedda.add(c.rank)
  for (const v of visibleSeats(state, seat)) for (const c of state.hands[v]) if (c.suit === suit) sedda.add(c.rank)
  const r = rankVal(kort.rank)
  const lagreOsedda = RANK_LOW_TO_HIGH.slice(0, r).some((x) => !sedda.has(x))
  const hogreHackor = RANK_LOW_TO_HIGH.slice(r + 1, rankVal('10')).filter((x) => !sedda.has(x)).length
  return !lagreOsedda && hogreHackor >= 2
}
