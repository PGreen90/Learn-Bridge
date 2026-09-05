// BETYDELSELAGRET (motorbytet etapp 1, docs/motorbyte-plan.md §2 steg 1).
//
// Varje bud i en auktion får sin SYSTEMBETYDELSE ur auktionen ENSAM: regelnamn,
// kravnivå, om budet är konstgjort, och förklaringstexten. Lagret läser bara —
// det väljer inga bud. Samma funktion tjänar bot och människa:
//
//   (1) Bär budet en regel från motorn (`call.rule`) används den — regeln är då
//       en CACHE av vad lagret skulle ha härlett (källa 'regel', säker).
//   (2) Saknas regel (människans bud, eller ett botbud med regeln bortskalad)
//       härleds betydelsen ur buden runt bordet (källa 'härledd').
//
// Kärnlöftet (ärvt från tolkningslagret): ALLTID en förklaring, aldrig tomt.
//
// Målet är att (2) alltid stämmer med (1). Det vaktas av BETYDELSESVEPET
// (`auction-meaning.probe.test.ts`): för varje botbud jämförs den härledda
// kravnivån och alert-flaggan med regelregistrets (`rules.ts`). En avvikelse är
// ett hål i det här lagret — lagas här, inte i motorn. `interpretCall` i
// `auction-interpret.ts` är en tunn läsare av `meaningOf` (texterna vaktas av
// förklaringssvepet och `auction-interpret.test.ts`).

import type { Bid, Forcing, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { forcingOf, isAlertRule, ruleInfo } from './rules'

/** Hur säker tolkningen är. Visas för användaren så hen vet hur mycket att lita på. */
export type Confidence = 'säker' | 'trolig' | 'gissning'

export interface CallInterpretation {
  /** Förklaringstext – ALLTID ifylld. */
  text: string
  confidence: Confidence
  /** Kravnivå om den går att härleda (annars utelämnad). */
  forcing?: Forcing
  /** Regelnamn ur registret (`rules.ts`) när härledningen kan namnge regeln. */
  rule?: string
}

/** Ett buds systembetydelse, läst ur auktionen ensam. */
export interface Meaning extends CallInterpretation {
  /** Konstgjort (alertpliktigt) bud. */
  alert: boolean
  /** 'regel' = ur motorns regel på budet (cache) · 'härledd' = ur auktionen. */
  källa: 'regel' | 'härledd'
}

/**
 * Betydelsen av bud nr `index` i `history`. Läser BARA auktionen — aldrig en
 * hand — vilket kikvakten (`kikvakt.test.ts`) låser fast.
 */
export function meaningOf(history: ResolvedCall[], index: number): Meaning {
  const call = history[index]
  const prior = history.slice(0, index)

  // (1) Motorn satte en regel → använd dess förklaring + kravnivå (säker).
  if (call.rule) {
    const info = ruleInfo(call.rule)
    const text = call.explanation?.trim() || describeRule(call.rule)
    return { rule: call.rule, text, confidence: 'säker', forcing: info.forcing, alert: info.alert, källa: 'regel' }
  }

  // (2) Härledning ur auktionen.
  const d = deriveMeaning(call, prior)
  return { ...d, alert: isAlertRule(d.rule), källa: 'härledd' }
}

function deriveMeaning(call: ResolvedCall, prior: ResolvedCall[]): CallInterpretation {
  if (call.bid === 'P') return interpretPass(call.seat, prior)
  if (call.bid === 'X') return interpretDouble(call.seat, prior)
  if (call.bid === 'XX') return interpretRedouble(call.seat, prior)

  const cb = parseBid(call.bid)
  if (!cb) return { text: 'Bud utan känd betydelse.', confidence: 'gissning' }
  return interpretContractBid(call.seat, cb, prior)
}

const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const SIDE: Record<Seat, 'NS' | 'EW'> = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' }

// Färgsymbol/namn för texterna (samma stil som motorns övriga förklaringar).
const SYMBOL: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'sang' }
const NAME: Record<string, string> = {
  C: 'klöver',
  D: 'ruter',
  H: 'hjärter',
  S: 'spader',
  NT: 'sang',
}

const CONTRACT_BID = /^([1-7])(C|D|H|S|NT)$/

interface ParsedBid {
  level: number
  strain: string // 'C' | 'D' | 'H' | 'S' | 'NT'
}

function parseBid(bid: Bid): ParsedBid | null {
  const m = CONTRACT_BID.exec(bid)
  return m ? { level: Number(m[1]), strain: m[2] } : null
}

/** Utgångsnivå för en färg/sang (3NT, 4 i hf, 5 i lf). */
function isGameLevel(cb: ParsedBid): boolean {
  if (cb.strain === 'NT') return cb.level >= 3
  if (cb.strain === 'H' || cb.strain === 'S') return cb.level >= 4
  return cb.level >= 5 // klöver/ruter
}

// ---- Läsa av historiken (utan att se händerna) -----------------------------

/** Första kontraktsbudet i historiken = öppningen (eller null om passat runt). */
function opening(prior: ResolvedCall[]): { seat: Seat; cb: ParsedBid } | null {
  for (const c of prior) {
    const cb = parseBid(c.bid)
    if (cb) return { seat: c.seat, cb }
  }
  return null
}

/**
 * Vilka färger en Michaels-cue visar, givet öppningsfärgen.
 *  - över 1♥ → spader (+ en minor)   - över 1♠ → hjärter (+ en minor)
 *  - över 1♣/1♦ → BÅDA högfärgerna (♥ och ♠)
 */
function michaelsSuits(openerStrain: string): string[] {
  if (openerStrain === 'H') return ['S']
  if (openerStrain === 'S') return ['H']
  if (openerStrain === 'C' || openerStrain === 'D') return ['H', 'S']
  return []
}

/**
 * Är `c` ett direkt cue-bud i öppningsfärgen (Michaels) av motståndarsidan? Det
 * känns igen på position även utan att motorn satt en regel: samma färg som
 * öppningen, på motståndarsidan, som sidans första aktion.
 */
function isMichaelsCue(c: ResolvedCall, before: ResolvedCall[]): boolean {
  const open = opening(before)
  if (!open || open.cb.level !== 1 || open.cb.strain === 'NT') return false
  const cb = parseBid(c.bid)
  if (!cb || cb.strain !== open.cb.strain) return false
  if (SIDE[c.seat] === SIDE[open.seat]) return false
  // c måste vara sidans FÖRSTA kontraktsbud (inget tidigare på samma sida).
  const earlierForSide = before.some((x) => SIDE[x.seat] === SIDE[c.seat] && parseBid(x.bid))
  return !earlierForSide
}

/**
 * Färgerna som `seat` har VISAT så här långt, läst ur buden. Naturliga färgbud
 * räknas; en Michaels-cue tolkas som de färger den visar (inte cue-färgen
 * bokstavligt); sang räknas inte som en visad färg.
 */
function suitsShown(seat: Seat, prior: ResolvedCall[]): Set<string> {
  const shown = new Set<string>()
  prior.forEach((c, i) => {
    if (c.seat !== seat) return
    const cb = parseBid(c.bid)
    if (!cb || cb.strain === 'NT') return
    const before = prior.slice(0, i)
    if (c.rule?.startsWith('Michaels') || isMichaelsCue(c, before)) {
      const open = opening(before)
      if (open) michaelsSuits(open.cb.strain).forEach((s) => shown.add(s))
      return
    }
    // En cue i motståndarnas färg är inte en egen färg.
    if (!isCueOfOpponentSuit(c.seat, cb.strain, before)) shown.add(cb.strain)
  })
  return shown
}

/** Har motståndarsidan (sett från `seat`) bjudit `strain` som ett kontraktsbud? */
function isCueOfOpponentSuit(seat: Seat, strain: string, prior: ResolvedCall[]): boolean {
  if (strain === 'NT') return false
  return prior.some((c) => {
    const cb = parseBid(c.bid)
    return cb && cb.strain === strain && SIDE[c.seat] !== SIDE[seat]
  })
}

/** Har motståndarsidan (sett från `seat`) gjort något kontraktsbud alls? (konkurrens) */
function opponentsHaveBid(seat: Seat, prior: ResolvedCall[]): boolean {
  return prior.some((c) => SIDE[c.seat] !== SIDE[seat] && parseBid(c.bid))
}

/** Har den EGNA sidan (sett från `seat`) redan gjort ett kontraktsbud? */
function ownSideHasBid(seat: Seat, prior: ResolvedCall[]): boolean {
  return prior.some((c) => SIDE[c.seat] === SIDE[seat] && parseBid(c.bid))
}

/** Färgerna en Michaels-cue visar, i läsbar svensk form (för texten). */
function michaelsPhrase(openerStrain: string): string {
  const suits = michaelsSuits(openerStrain)
  if (suits.length === 2) return `båda högfärgerna (${NAME[suits[0]]} och ${NAME[suits[1]]})`
  return `${NAME[suits[0]]} och en lågfärg`
}

/**
 * Har partnern just gjort en NEGATIV DUBBLING vars visade högfärg(er) `seat`
 * (öppnaren) nu ska välja bland? Mönstret (§7.3): `seat` öppnade 1 i färg,
 * motståndarna klev in i färg, partnerns senaste icke-pass är X. Dubblingen
 * visar 4+ kort i de OBJUDNA högfärgerna – öppnarens färgval där är ett SVAR
 * graderat efter styrka, aldrig en egen spärr (felrapport #9).
 */
function negativeDoubleShown(seat: Seat, prior: ResolvedCall[]): Set<string> {
  const none = new Set<string>()
  const open = opening(prior)
  if (!open || open.seat !== seat || open.cb.level !== 1 || open.cb.strain === 'NT') return none
  const lastNonPass = [...prior].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return none
  // Vår sidas enda kontraktsbud är öppningen (annars är X:et något annat).
  const ourBids = prior.filter((c) => SIDE[c.seat] === SIDE[seat] && parseBid(c.bid))
  if (ourBids.length !== 1) return none
  // Deras inkliv i färg = senaste kontraktsbudet, på motståndarsidan.
  const last = lastContract(prior)
  if (!last || SIDE[last.seat] === SIDE[seat] || last.cb.strain === 'NT') return none
  const shown = new Set<string>()
  for (const m of ['H', 'S']) {
    if (m !== open.cb.strain && m !== last.cb.strain) shown.add(m)
  }
  return shown
}

/**
 * Färg (strain) som BÅDA i paret bjudit naturligt = överenskommen trumf
 * (senast bjudna om flera). null när ingen fit är överenskommen.
 */
function agreedSuit(seat: Seat, prior: ResolvedCall[]): string | null {
  const own = suitsShown(seat, prior)
  const partner = suitsShown(PARTNER[seat], prior)
  const agreed = [...own].filter((s) => partner.has(s))
  if (agreed.length === 0) return null
  for (let i = prior.length - 1; i >= 0; i--) {
    const cb = parseBid(prior[i].bid)
    if (cb && agreed.includes(cb.strain)) return cb.strain
  }
  return agreed[0]
}

const STRAIN_RANK: Record<string, number> = { C: 0, D: 1, H: 2, S: 3, NT: 4 }
/** Rangordning av ett kontraktsbud (nivå + färg) för "under utgång"-jämförelser. */
function bidRank(cb: ParsedBid): number {
  return cb.level * 5 + STRAIN_RANK[cb.strain]
}

/**
 * Högfärgerna som `seat`s EGNA negativa dubbling lovade (4+ i de objudna
 * högfärgerna), eller tom mängd. Mönstret: partnern öppnade 1 i färg, mot-
 * ståndarna klev in i färg, och `seat`s första aktion var X. (Skiljer sig från
 * `negativeDoubleShown`, som ser det från ÖPPNARENS sida när hen väljer färg.)
 */
function negDoubleMajorsBy(seat: Seat, prior: ResolvedCall[]): Set<string> {
  const none = new Set<string>()
  const open = opening(prior)
  if (!open || open.seat !== PARTNER[seat] || open.cb.level !== 1 || open.cb.strain === 'NT') return none
  const myFirst = prior.find((c) => c.seat === seat && c.bid !== 'P')
  if (!myFirst || myFirst.bid !== 'X') return none
  const overcall = prior.find((c) => SIDE[c.seat] !== SIDE[seat] && parseBid(c.bid))
  if (!overcall) return none
  const oc = parseBid(overcall.bid)!
  const shown = new Set<string>()
  for (const m of ['H', 'S']) if (m !== open.cb.strain && m !== oc.strain) shown.add(m)
  return shown
}

/**
 * En ETABLERAD 8-korts HÖGFÄRGSFIT sett från `seat`: antingen en högfärg BÅDA
 * bjudit naturligt, eller en högfärg partnern valt som svar på `seat`s negativa
 * dubbling (dubblingen lovade 4+ i den → 4+4 = fit). Med en sådan fit är trumf
 * redan bestämd, så nya färgbud under utgång blir kontrollbud (cue). null = ingen.
 */
function establishedMajorFit(seat: Seat, prior: ResolvedCall[]): string | null {
  const agreed = agreedSuit(seat, prior)
  if (agreed === 'H' || agreed === 'S') return agreed
  const negMajors = negDoubleMajorsBy(seat, prior)
  if (negMajors.size) {
    const partner = suitsShown(PARTNER[seat], prior)
    for (const m of ['S', 'H']) if (negMajors.has(m) && partner.has(m)) return m
  }
  return null
}

/**
 * Trumfen 4NT-essfrågan gäller när ingen färg är ÖVERENSKOMMEN: sidans senaste
 * naturliga färgbud före frågan (felrapport #10 – 4NT på partnerns spärr).
 * Var sidans senaste bud SANG är 4NT kvantitativt → null.
 */
function askTrumpFallback(seat: Seat, prior: ResolvedCall[]): string | null {
  for (let i = prior.length - 1; i >= 0; i--) {
    const c = prior[i]
    if (SIDE[c.seat] !== SIDE[seat]) continue
    const cb = parseBid(c.bid)
    if (!cb) continue
    if (cb.strain === 'NT') return null
    if (isCueOfOpponentSuit(c.seat, cb.strain, prior.slice(0, i))) continue
    return cb.strain
  }
  return null
}

/**
 * Har partnern (sett från `seat`) visat en NATURLIG 1NT som `seat` nu kan köra
 * 1NT-systemet mot? Sant när partnerns SENASTE kontraktsbud är 1NT (bara pass
 * efter, dvs. ostört) OCH det är partnerns FÖRSTA kontraktsbud – då är 1NT:et en
 * öppning eller ett inkliv (balanserad 15-ish), inte ett 1NT-ÅTERBUD (som i
 * stället visar minimibalans efter egen färg → 2♣ blir checkback, inte Stayman).
 */
function partnerNaturalNT(seat: Seat, prior: ResolvedCall[]): boolean {
  const partner = PARTNER[seat]
  const last = lastContract(prior)
  if (!last || last.seat !== partner || last.cb.strain !== 'NT' || last.cb.level !== 1) return false
  const partnerContracts = prior.filter((c) => c.seat === partner && parseBid(c.bid))
  if (partnerContracts.length !== 1) return false
  // Har JAG redan bjudit ett kontraktsbud är partnerns 1NT ett SVAR på min
  // färg (semi-forcing 1NT, §4.1) — mitt 2♣ är då naturlig ny färg, inte
  // Stayman (felrapport #59: 1♠–1NT–2♣ lästes som Stayman).
  return !prior.some((c) => c.seat === seat && parseBid(c.bid))
}

/**
 * Svararens NY FÄRG efter eget 1NT-svar (1M–1NT–2x–2y, §5.1; felrapport #59):
 * partnern öppnade 1♥/1♠, jag svarade 1NT, partnern bjöd en naturlig ny färg
 * på 2-läget, och jag bjuder nu en tredje färg på 2-läget. Ostört. Naturligt,
 * 5+ kort (oftast 6), svag hand utan stöd — partnern får passa.
 */
function responderNewSuitAfter1NT(seat: Seat, cb: ParsedBid, prior: ResolvedCall[]): boolean {
  if (cb.level !== 2 || cb.strain === 'NT') return false
  const contracts = prior.map((c) => ({ c, cb: parseBid(c.bid) })).filter((x) => x.cb) as { c: ResolvedCall; cb: ParsedBid }[]
  if (contracts.length !== 3) return false
  const [open, nt, rebid] = contracts
  if (open.c.seat !== PARTNER[seat] || open.cb.level !== 1 || (open.cb.strain !== 'H' && open.cb.strain !== 'S')) return false
  if (nt.c.seat !== seat || nt.cb.level !== 1 || nt.cb.strain !== 'NT') return false
  if (rebid.c.seat !== PARTNER[seat] || rebid.cb.level !== 2 || rebid.cb.strain === 'NT' || rebid.cb.strain === open.cb.strain) return false
  return cb.strain !== open.cb.strain && cb.strain !== rebid.cb.strain
}

/**
 * Öppnarens ÅTERBUD i ny färg efter partnerns 1NT-svar (1♥/1♠–1NT–2x, §5.1;
 * felrapport #59): `seat` öppnade 1M, partnern svarade 1NT, ostört, och `seat`
 * bjuder nu en LÄGRE ny färg på 2-läget (2♠ över 1♥ är reverse och lämnas).
 * Naturligt, 3+ kort (2♥ över 1♠: 4+), minimum, ej krav.
 */
function openerNewSuitAfter1NTResponse(seat: Seat, cb: ParsedBid, prior: ResolvedCall[]): boolean {
  if (cb.level !== 2 || cb.strain === 'NT') return false
  const contracts = prior.map((c) => ({ c, cb: parseBid(c.bid) })).filter((x) => x.cb) as { c: ResolvedCall; cb: ParsedBid }[]
  if (contracts.length !== 2) return false
  const [open, nt] = contracts
  if (open.c.seat !== seat || open.cb.level !== 1 || (open.cb.strain !== 'H' && open.cb.strain !== 'S')) return false
  if (nt.c.seat !== PARTNER[seat] || nt.cb.level !== 1 || nt.cb.strain !== 'NT') return false
  return cb.strain !== open.cb.strain && STRAIN_RANK[cb.strain] < STRAIN_RANK[open.cb.strain]
}

/**
 * 4NT över partnerns sang-ÅTERBUD (1x–1M–1NT–4NT, §5.7): frågaren har visat en
 * egen färg och partnern har nekat stöd med sang — 4NT är då essfråga med den
 * egna färgen som trumf (kvantitativt bara över en sangÖPPNING). Sant när
 * partnern bjudit en färg FÖRE sin sang (dvs. ett återbud) och frågarens första
 * kontraktsbud var en färg på 1–2-läget.
 */
function ownSuitOverNTRebid(asker: Seat, before: ResolvedCall[]): string | null {
  const partner = PARTNER[asker]
  const ours = before.filter((c) => SIDE[c.seat] === SIDE[asker] && parseBid(c.bid))
  const partnerBids = ours.filter((c) => c.seat === partner).map((c) => parseBid(c.bid)!)
  const lastPartner = partnerBids[partnerBids.length - 1]
  if (!lastPartner || lastPartner.strain !== 'NT' || lastPartner.level > 2) return null
  if (!partnerBids.some((cb) => cb.strain !== 'NT')) return null // sangöppning → kvantitativt
  const first = ours.find((c) => c.seat === asker)
  const fcb = first ? parseBid(first.bid) : null
  if (!fcb || fcb.strain === 'NT' || fcb.level > 2) return null
  return fcb.strain
}

/**
 * Essfrågesekvensen (1430 RKC, §6.1) sedd från `seat` (felrapport #60): vår
 * sidas 4NT-essfråga med härledd trumf, partnerns stegsvar (om givet) och om
 * frågaren därefter stannat i 5-trumf. null = ingen essfråga, eller
 * motståndarna har bjudit in i sekvensen.
 */
function rkcSequence(seat: Seat, prior: ResolvedCall[]): { asker: Seat; trump: string; answer?: ParsedBid; signoff: boolean } | null {
  const askIdx = prior.findIndex((c) => c.bid === '4NT' && SIDE[c.seat] === SIDE[seat])
  if (askIdx < 0) return null
  const asker = prior[askIdx].seat
  const before = prior.slice(0, askIdx)
  const trump = agreedSuit(asker, before) ?? askTrumpFallback(asker, before) ?? ownSuitOverNTRebid(asker, before)
  if (!trump) return null
  const after = prior.slice(askIdx + 1).filter((c) => parseBid(c.bid))
  if (after.some((c) => SIDE[c.seat] !== SIDE[seat])) return null
  const answer = after[0] && after[0].seat === PARTNER[asker] ? parseBid(after[0].bid)! : undefined
  const signoff = !!(answer && after[1] && after[1].seat === asker && after[1].bid === `5${trump}`)
  return { asker, trump, answer, signoff }
}

/**
 * Har partnern just bjudit en 2-läges KONVENTION över `seat`s egen naturliga
 * 1NT (öppning eller inkliv) som `seat` nu svarar på? Sant när sidans
 * kontraktsbud är exakt två — `seat`s 1NT och partnerns 2♣/2♦/2♥ — och
 * partnerns bud är auktionens senaste kontraktsbud (ostört). Returnerar
 * partnerns strain ('C' = Stayman, 'D'/'H' = transfer), annars null.
 */
function partnerNTConventionToAnswer(seat: Seat, prior: ResolvedCall[]): string | null {
  const contracts = prior.map((c) => ({ c, cb: parseBid(c.bid) })).filter((x) => x.cb) as { c: ResolvedCall; cb: ParsedBid }[]
  const ours = contracts.filter((x) => SIDE[x.c.seat] === SIDE[seat])
  if (ours.length !== 2) return null
  const [mine, partners] = ours
  if (mine.c.seat !== seat || mine.cb.level !== 1 || mine.cb.strain !== 'NT') return null
  if (partners.c.seat !== PARTNER[seat] || partners.cb.level !== 2 || !['C', 'D', 'H'].includes(partners.cb.strain)) return null
  if (contracts[contracts.length - 1] !== partners) return null // ostört efter konventionen
  if (contracts.indexOf(partners) !== contracts.indexOf(mine) + 1) return null // ostört mellan 1NT och svaret
  return partners.cb.strain
}

/** Senaste kontraktsbudet före `prior`s slut (för pass/dubbel-texter). */
function lastContract(prior: ResolvedCall[]): { seat: Seat; cb: ParsedBid } | null {
  for (let i = prior.length - 1; i >= 0; i--) {
    const cb = parseBid(prior[i].bid)
    if (cb) return { seat: prior[i].seat, cb }
  }
  return null
}

/**
 * Är auktionen (ostört) den kanoniska 1x–1y–2NT-familjen (§5.2, systems on efter
 * naturligt 2NT-återbud)? Läser bara kontraktsbudens mönster: 1-läges färgöppning
 * (öppnaren) – 1-läges HÖGfärgssvar (svararen) – 2NT (samma öppnare). Returnerar
 * öppnare + öppningsfärg + svararens högfärg + alla kontraktsbud, annars null.
 */
function twoNTRebidContext(
  seat: Seat,
  prior: ResolvedCall[],
): { opener: Seat; responder: Seat; opened: string; responderMajor: string; bids: ParsedBid[] } | null {
  if (opponentsHaveBid(seat, prior)) return null
  const cbs: { seat: Seat; cb: ParsedBid }[] = []
  for (const c of prior) {
    const p = parseBid(c.bid)
    if (p) cbs.push({ seat: c.seat, cb: p })
  }
  if (cbs.length < 3) return null
  const [b0, b1, b2] = cbs
  if (b0.cb.level !== 1 || b0.cb.strain === 'NT') return null // 1-läges färgöppning
  if (b1.cb.level !== 1 || (b1.cb.strain !== 'H' && b1.cb.strain !== 'S')) return null // 1-läges HÖGfärgssvar
  if (b2.cb.level !== 2 || b2.cb.strain !== 'NT') return null // 2NT-återbud
  if (b0.seat !== b2.seat || b1.seat !== PARTNER[b0.seat]) return null
  return { opener: b0.seat, responder: b1.seat, opened: b0.cb.strain, responderMajor: b1.cb.strain, bids: cbs.map((x) => x.cb) }
}

// ---- Tolkningen ------------------------------------------------------------

/**
 * Tolka budet på plats `index` i historiken. Returnerar ALLTID en text.
 * Prioritet: (1) motorns egen regel om den finns → säker; annars (2) en
 * heuristisk avläsning ur buden runt bordet → trolig/gissning.
 */
/**
 * Är VÅR sida i 2-över-1-utgångskrav (§4.2), läst enbart ur auktionen?
 * Ostört (inget kontraktsbud från motståndarna), partnerskapets öppning 1 i
 * färg, svararens FÖRSTA bud en ny LÄGRE färg på 2-läget, svararen opassad
 * före sitt svar — och utgång ännu inte nådd. Felrapport #58: kravet syntes
 * inte i förklaringarna (2♣ lästes som "krav 1 rond", 2NT som "inbjudan").
 */
function twoOverOneGameForce(seat: Seat, prior: ResolvedCall[]): boolean {
  const contracts: Array<{ c: ResolvedCall; cb: ParsedBid; i: number }> = []
  prior.forEach((c, i) => {
    const cb = parseBid(c.bid)
    if (cb) contracts.push({ c, cb, i })
  })
  if (contracts.length < 2) return false
  if (contracts.some((x) => SIDE[x.c.seat] !== SIDE[seat])) return false // ostört
  const open = contracts[0]
  if (open.cb.level !== 1 || open.cb.strain === 'NT') return false
  const responder = PARTNER[open.c.seat]
  const resp = contracts.find((x) => x.c.seat === responder)
  if (!resp || resp.cb.level !== 2 || resp.cb.strain === 'NT' || resp.cb.strain === open.cb.strain) return false
  // 2/1 = svararens 2-lägessvar i ny färg: över 1♥/1♠ en LÄGRE färg (2♣/2♦, 2♥ över
  // 1♠); över 1♣/1♦ den andra lågfärgen (1♣–2♦ räknas som 2/1 i systemet, §4.2 —
  // svaga hoppskift finns inte). 2♥/2♠ över 1m är inget 2/1.
  const isMajorOpen = open.cb.strain === 'H' || open.cb.strain === 'S'
  if (isMajorOpen ? rankAbove(resp.cb.strain, open.cb.strain) : resp.cb.strain === 'H' || resp.cb.strain === 'S') return false
  if (prior.slice(0, resp.i).some((c) => c.seat === responder && c.bid === 'P')) return false // passad hand
  return !isGameLevel(contracts[contracts.length - 1].cb)
}

/** Är budet som bjuds NU självt ett 2-över-1-svar (samma villkor som `twoOverOneGameForce`)? */
function isTwoOverOneResponse(seat: Seat, cb: ParsedBid, prior: ResolvedCall[]): boolean {
  if (cb.level !== 2 || cb.strain === 'NT') return false
  const withBid = [...prior, { seat, bid: `2${cb.strain}` } as ResolvedCall]
  return twoOverOneGameForce(seat, withBid)
}

function interpretContractBid(seat: Seat, cb: ParsedBid, prior: ResolvedCall[]): CallInterpretation {
  const raw = interpretContractBidRaw(seat, cb, prior)
  // 2-över-1-utgångskravet (§4.2) färgar VARJE bud under utgång i en ostörd
  // 2/1-auktion: ingen får passa. Kravmärket lyfts till utgångskrav och texten
  // får en rad om den inte redan säger det (felrapport #58).
  if (
    !isGameLevel(cb) &&
    raw.forcing !== 'utgangskrav' &&
    raw.forcing !== 'slamintresse' &&
    twoOverOneGameForce(seat, prior)
  ) {
    const note = /utgångskrav/i.test(raw.text)
      ? ''
      : ' Utgångskravet från 2-över-1 gäller — ingen av er får passa under utgång.'
    return { ...raw, text: raw.text + note, forcing: 'utgangskrav' }
  }
  return raw
}

function interpretContractBidRaw(seat: Seat, cb: ParsedBid, prior: ResolvedCall[]): CallInterpretation {
  const sym = SYMBOL[cb.strain]
  const name = NAME[cb.strain]
  const competitive = opponentsHaveBid(seat, prior)
  const partnerSuits = suitsShown(PARTNER[seat], prior)
  const ownSuits = suitsShown(seat, prior)

  // Öppningsbud (inget kontraktsbud före)? Nivån avgör (§3): 1-läget =
  // öppningshand, 2♣ = stark konstgjord, 2♦/2♥/2♠ = svag tvåa, 3-läget = spärr
  // (7-korts), 4-läget = spärr (8+). Felrapport #54: 3♣ kallades "öppningshand".
  if (!opening(prior)) {
    if (cb.strain === 'NT') {
      const range = cb.level === 1 ? '15–17 hp' : cb.level === 2 ? '20–21 hp' : '25–27 hp'
      return R(cb.level === 1 ? '1NT' : cb.level === 2 ? '2NT' : '3NT', `Öppningsbud ${cb.level} sang — balanserad hand, ${range}.`)
    }
    if (cb.level === 1) {
      const major = cb.strain === 'H' || cb.strain === 'S'
      return R(major ? '5-korts högfärg' : 'minor-regeln', `Öppningsbud 1${sym} — visar en öppningshand (12+ hp) med ${major ? '5+' : '3+'} ${name}.`)
    }
    if (cb.level === 2 && cb.strain === 'C') {
      return R('stark 2♣', `Öppningsbud 2♣ — stark, konstgjord öppning (22+ hp eller ~8½+ spelstick), krav. Säger inget om klöver.`)
    }
    if (cb.level === 2) {
      return R('svag tvåa', `Öppningsbud 2${sym} — svag tvåöppning: 6–11 hp med en 6-korts ${name}.`)
    }
    if (cb.level === 3) {
      return R('spärr', `Öppningsbud 3${sym} — spärröppning: svag hand (under öppningsstyrka) med 7-korts ${name}.`)
    }
    if (cb.level === 4 && (cb.strain === 'H' || cb.strain === 'S')) {
      return R('spärr', `Öppningsbud 4${sym} — spärr till utgång: svag hand med lång ${name} (8+ kort, ~7+ spelstick).`)
    }
    return R('spärr', `Öppningsbud ${cb.level}${sym} — spärröppning: svag hand med mycket lång ${name} (8+ kort).`)
  }

  // Essfrågesekvensen (1430 RKC, §6.1) — felrapport #60: svaret 5♣ lästes som
  // "naturlig klöver", stoppbudet 5♥ och rättelsen 6♥ som utgångshöjningar.
  const rkc = cb.level >= 5 ? rkcSequence(seat, prior) : null
  if (rkc) {
    const tsym = SYMBOL[rkc.trump]
    if (!rkc.answer && seat === PARTNER[rkc.asker] && cb.level === 5) {
      const step: Record<string, string> = {
        C: '1 eller 4 nyckelkort', D: '0 eller 3 nyckelkort',
        H: '2 (eller 5) nyckelkort utan trumfdam', S: '2 (eller 5) nyckelkort med trumfdam',
      }
      if (step[cb.strain]) {
        return R('1430 RKC', `5${sym} — svar på essfrågan: ${step[cb.strain]} (1430 RKC, ${NAME[rkc.trump]} som trumf). Säger inget om ${name}.`)
      }
    }
    if (rkc.answer && !rkc.signoff && seat === rkc.asker && cb.strain === rkc.trump) {
      if (cb.level === 5) {
        return R(
          'RKC: stopp',
          `5${tsym} — stopp efter essfrågan: räknat lågt saknas två nyckelkort. ` +
            `Partnern passar med det låga antalet i sitt svar och bjuder 6${tsym} med det höga.`,
          'avslut',
        )
      }
      if (cb.level === 6) {
        return R('slamavslut', `6${tsym} — lillslam: nyckelkortssvaret räckte (högst ett nyckelkort saknas).`)
      }
    }
    if (rkc.answer && rkc.signoff && seat === PARTNER[rkc.asker] && cb.level === 6 && cb.strain === rkc.trump) {
      const high = rkc.answer.strain === 'C' ? '4' : rkc.answer.strain === 'D' ? '3' : '5'
      return R('RKC: rättelse', `6${tsym} — rättelse över stoppbudet: svaret 5${SYMBOL[rkc.answer.strain]} var tvetydigt och jag har det höga antalet (${high} nyckelkort).`)
    }
  }

  // Öppnarens återbud i ny färg efter partnerns 1NT-svar (1M–1NT–2x, §5.1;
  // felrapport #59: lästes som Stayman / "minst 4 kort, krav 1 rond").
  if (!competitive && openerNewSuitAfter1NTResponse(seat, cb, prior)) {
    const minLen = cb.strain === 'H' ? '4+' : '3+ (oftast 4+)'
    return {
      rule: 'rebid: ny färg',
      text: `2${sym} — återbud i ny färg efter partnerns 1 sang: naturligt, ${minLen} ${name}, minimum (~12–15 hp). Partnern får passa.`,
      confidence: 'trolig',
      forcing: 'ej-krav',
    }
  }

  // Svararens ny färg efter eget 1NT-svar (1M–1NT–2x–2y, §5.1; felrapport #59).
  // Regelnamnet är motorns (`responderSecondBid`) — öppnarens tredje bud dispatchar på det.
  if (!competitive && responderNewSuitAfter1NT(seat, cb, prior)) {
    return {
      rule: 'ny färg efter 1NT',
      text: `2${sym} — egen färg efter 1 sang-svaret: naturligt, 5+ ${name} (oftast 6), svag hand utan stöd för partnern. Partnern får passa.`,
      confidence: 'trolig',
      forcing: 'ej-krav',
    }
  }

  // Direkt cue i motståndarnas öppningsfärg, innan vår sida bjudit = Michaels
  // (tvåfärgshand). Kan inte vara stöd – vi har ju inte bjudit något ännu.
  if (cb.strain !== 'NT' && isCueOfOpponentSuit(seat, cb.strain, prior) && !ownSideHasBid(seat, prior)) {
    const open = opening(prior)!
    return R('Michaels', `Michaels cue-bud (${cb.level}${sym}) — tvåfärgshand: ${michaelsPhrase(open.cb.strain)}, oftast 5–5.`)
  }

  // Systems on över partnerns naturliga 1NT (öppning ELLER inkliv): på 2-läget
  // är klöver/ruter/hjärter/spader KONVENTION, inte naturliga färger (felrapport
  // #53 + systems-on-bygget). 2♣ = Stayman, 2♦/2♥ = Jacoby-transfer, 2♠ = Minor
  // Suit Stayman. Betydelsen läses ur budet, aldrig ur handen.
  if (cb.level === 2 && partnerNaturalNT(seat, prior)) {
    if (cb.strain === 'C') {
      return R(
        'Stayman',
        `2♣ — Stayman: frågar efter partnerns 4-korts högfärg (svar 2♦ = ingen, ` +
          `2♥/2♠ = den högfärgen). Säger inget om klöver.`,
      )
    }
    if (cb.strain === 'D' || cb.strain === 'H') {
      const target = cb.strain === 'D' ? 'hjärter' : 'spader'
      return R('Jacoby-transfer', `2${sym} — Jacoby-transfer: visar 5+ ${target}, partnern bjuder ${target} (säger inget om ${name}).`)
    }
    if (cb.strain === 'S') {
      return R('Minor Suit Stayman', `2♠ — Minor Suit Stayman: 5-4+ i lågfärgerna utan högfärg, utgångs-/slamintresse (säger inget om spader).`)
    }
  }

  // Sangöppnarens/-inklivarens SVAR på partnerns konvention (felrapport #57:
  // 2♦ på Stayman lästes som "naturligt, minst 4 ruter"). Svaret på Stayman är
  // konvention (§4.3); fullföljd transfer lovar inget om egen längd.
  const conv = partnerNTConventionToAnswer(seat, prior)
  if (conv === 'C' && cb.level === 2) {
    if (cb.strain === 'D') {
      return R('Stayman-svar', `2♦ — svar på Stayman: ingen 4-korts högfärg. Säger inget om ruter.`)
    }
    if (cb.strain === 'H') {
      return R('Stayman-svar', `2♥ — svar på Stayman: 4 hjärter (kan ha 4 spader också).`)
    }
    if (cb.strain === 'S') {
      return R('Stayman-svar', `2♠ — svar på Stayman: 4 spader, förnekar 4 hjärter.`)
    }
  }
  if ((conv === 'D' && cb.strain === 'H') || (conv === 'H' && cb.strain === 'S')) {
    if (cb.level === 2) {
      return R('fullföljd transfer', `2${sym} — fullföljer partnerns Jacoby-transfer (partnern visade 5+ ${name}). Säger inget om egen längd i ${name}.`)
    }
    if (cb.level === 3) {
      return R('superaccept', `3${sym} — superaccept av transfern: 4-korts ${name} och maximum, inbjuder utgång.`, 'inbjudan')
    }
  }

  // Systems on efter naturligt 2NT-återbud (1x–1y–2NT, §5.2). Checkbacken och
  // 5-3-jakten är KONVENTION — 3♣ är inte naturlig klöver. Läses ur sekvensen.
  const twoNT = twoNTRebidContext(seat, prior)
  if (twoNT) {
    const otherMajor = twoNT.responderMajor === 'H' ? 'S' : 'H'
    const n = twoNT.bids.length // antal kontraktsbud FÖRE detta
    const last = twoNT.bids[n - 1]

    // Steg 1 – svararens bud direkt efter 2NT (tre kontraktsbud före).
    if (n === 3 && seat === twoNT.responder) {
      if (cb.level === 3 && cb.strain === 'C') {
        return R('2NT-checkback', `3♣ — checkback efter partnerns 2NT-återbud (18–19 balanserad): frågar efter en dold 4-korts ${NAME[otherMajor]} eller 3-korts stöd i din ${NAME[twoNT.responderMajor]} (5+). Konstgjort — säger inget om klöver.`)
      }
      if (cb.level === 3 && cb.strain === twoNT.responderMajor) {
        return R('2NT-återbud (5-3-jakt)', `3${sym} — visar en 5-korts ${name} och söker partnerns dolda 3-korts stöd (5-3-fit). Partnern höjer 4${sym} med stöd, annars 3NT.`)
      }
      if (cb.level === 3 && cb.strain === 'NT') {
        return R('3NT till spel', `3NT — till spel mittemot 18–19 balanserad; ingen högfärgsfit att jaga.`)
      }
    }

    // Steg 2 – öppnarens svar på 3♣-checkbacken (sista budet före = 3♣).
    if (n === 4 && seat === twoNT.opener && last.level === 3 && last.strain === 'C') {
      if (cb.level === 3 && cb.strain === otherMajor) {
        return R('svar på 2NT-checkback', `3${sym} — svar på checkbacken: visar din dolda 4-korts ${name} (4-4-fit).`)
      }
      if (cb.level === 3 && cb.strain === twoNT.responderMajor) {
        return R('svar på 2NT-checkback', `3${sym} — svar på checkbacken: 3-korts stöd i partnerns ${name} (5-3-fit).`)
      }
      if (cb.level === 3 && cb.strain === 'NT') {
        return R('svar på 2NT-checkback', `3NT — svar på checkbacken: varken dold 4-korts ${NAME[otherMajor]} eller 3-stöd i ${NAME[twoNT.responderMajor]}.`, 'avslut')
      }
    }

    // Steg 2b – öppnarens svar på svararens direkta 3M (5-3-jakt).
    if (n === 4 && seat === twoNT.opener && last.level === 3 && last.strain === twoNT.responderMajor) {
      if (cb.level === 4 && cb.strain === twoNT.responderMajor) {
        return R('svar på 2NT-återbud (5-3-jakt)', `4${sym} — höjer partnerns 5-korts ${name} med 3-korts stöd (5-3-fit, till spel).`)
      }
      if (cb.level === 3 && cb.strain === 'NT') {
        return R('svar på 2NT-återbud (5-3-jakt)', `3NT — bara 2-korts ${NAME[twoNT.responderMajor]}, ingen 5-3-fit → till spel i sang.`)
      }
    }

    // Steg 3 – svararen placerar den hittade högfärgsfiten (4♥/4♠).
    if (n === 5 && seat === twoNT.responder && cb.level === 4 && cb.strain !== 'NT') {
      return R('placering efter 2NT-checkback', `Utgång 4${sym} — placerar den högfärgsfit checkbacken hittade.`)
    }
  }

  // Den OSTÖRDA 2/1-auktionen (motorbytet etapp 1): systembokens struktur §4–§6.
  if (!competitive) {
    const u = undisturbed(seat, prior)
    if (u) {
      const r = undisturbedMeaning(seat, cb, u, prior)
      if (r) return r
    }
  }

  // Svar på partnerns NEGATIVA dubbling: X:et visade 4+ kort i objudna
  // högfärger – öppnarens färgval är ett graderat SVAR, ingen egen spärr
  // (felrapport #9: 3♥/4♥ lästes som "lång färg, begränsad styrka").
  const negDblSuits = negativeDoubleShown(seat, prior)
  if (cb.strain !== 'NT' && negDblSuits.has(cb.strain)) {
    const last = lastContract(prior)!
    const minLevel = last.cb.level + (rankAbove(cb.strain, last.cb.strain) ? 0 : 1)
    if (isGameLevel(cb)) {
      return {
        text: `Svar på partnerns negativa dubbling — utgång i ${name} (${cb.level}${sym}): partnern visade 4+ ${name}, du har fit och utgångsvärden.`,
        confidence: 'trolig',
        forcing: 'avslut',
      }
    }
    if (cb.level > minLevel) {
      return {
        text: `Svar på partnerns negativa dubbling — hoppet till ${cb.level}${sym} är INBJUDANDE: partnern visade 4+ ${name}, du har fit och extra styrka (~16+).`,
        confidence: 'trolig',
        forcing: 'inbjudan',
      }
    }
    return {
      text: `Svar på partnerns negativa dubbling — ${cb.level}${sym} väljer ${name} (partnern visade 4+ kort) med minimihand.`,
      confidence: 'trolig',
    }
  }

  // Med en ETABLERAD 8-korts högfärgsfit är trumf redan bestämd. Ett nytt
  // FÄRGBUD under utgång (4♣/4♦/4♥ när spader är trumf) är då ett KONTROLLBUD
  // (cue) som visar första-rondskontroll och slamintresse – inte en färghöjning
  // och inte en höjning av partnerns andra färg. (Ägarrapport 2026-08-05, giv
  // 20261272: 4♣ lästes felaktigt som "stark höjning av partnerns ruter".)
  const majorFit = establishedMajorFit(seat, prior)
  if (
    majorFit &&
    cb.strain !== 'NT' &&
    cb.strain !== majorFit &&
    cb.level === 4 &&
    bidRank(cb) < bidRank({ level: 4, strain: majorFit })
  ) {
    return R('cue-bid', `Kontrollbud (${cb.level}${sym}) — ${NAME[majorFit]} är redan trumf (8-korts fit), så ${cb.level}${sym} visar första-rondskontroll (ess eller renons) i ${name} och slamintresse. Partnern cue:ar tillbaka en egen kontroll eller stannar i 4${SYMBOL[majorFit]}.`)
  }

  // Stöd/höjning i partnerns visade färg.
  if (cb.strain !== 'NT' && partnerSuits.has(cb.strain)) {
    const comp = competitive ? ' Samtidigt tar du budet vidare i konkurrensen.' : ''
    if (isGameLevel(cb)) {
      return {
        text: `Utgångsbud i ${name} (${cb.level}${sym}) — du stöder partnerns ${name} och höjer till utgång.${comp}`,
        confidence: 'trolig',
        forcing: 'avslut',
      }
    }
    if (isJumpRaise(cb, PARTNER[seat], prior)) {
      return {
        text: `Inbjudande höjning i ${name} (${cb.level}${sym}) — bra stöd men begränsad styrka. Partnern kan stanna eller gå vidare mot utgång (och slam med kontrollbud).${comp}`,
        confidence: 'trolig',
        forcing: 'inbjudan',
      }
    }
    return {
      text: `Höjning i ${name} (${cb.level}${sym}) — du har stöd för partnerns färg.${comp}`,
      confidence: 'trolig',
    }
  }

  // Äkta cue i motståndarnas färg när vår sida redan bjudit = stark höjning av
  // partnerns färg (minst limithöjning, krav). Partnern får stanna eller cue:a vidare.
  if (cb.strain !== 'NT' && isCueOfOpponentSuit(seat, cb.strain, prior)) {
    const partnerSuit = [...partnerSuits][0]
    const where = partnerSuit ? ` av partnerns ${NAME[partnerSuit]}` : ''
    return {
      text: `Cue-bud i motståndarnas ${name} (${cb.level}${sym}) — stark höjning${where} (minst limithöjning, krav). Partnern kan stanna eller gå vidare mot slam med kontrollbud.`,
      confidence: 'trolig',
      forcing: 'krav-1-rond',
    }
  }

  // Rebjuden egen färg.
  if (cb.strain !== 'NT' && ownSuits.has(cb.strain)) {
    return {
      text: `Rebjuder ${name} (${cb.level}${sym}) — visar extra längd i färgen (oftast 6+ kort).`,
      confidence: 'trolig',
    }
  }

  // Sangbud.
  if (cb.strain === 'NT') {
    // 4NT med ÖVERENSKOMMEN trumf (båda i paret har bjudit färgen) är aldrig
    // naturligt: essfrågan 1430 RKC (§6.1). Felrapport #9. Utan överenskommen
    // trumf gäller standardregeln (felrapport #10): essfråga även när sidans
    // senaste naturliga bud var en FÄRG (t.ex. 4NT på partnerns spärr) –
    // kvantitativt bara över sang.
    if (cb.level === 4) {
      const trump = agreedSuit(seat, prior) ?? askTrumpFallback(seat, prior)
      if (trump) {
        return R(
          '1430 RKC',
          `4 sang — essfråga (1430 RKC) med ${NAME[trump]} som trumf. ` +
            `Partnern svarar i steg: 5♣ = 1/4 nyckelkort, 5♦ = 0/3, 5♥ = 2 utan trumfdam, 5♠ = 2 med.`,
        )
      }
    }
    const stopp = competitive ? ' (lovar stopp i motståndarnas färg)' : ''
    // 1NT-INKLIV: motståndarna öppnade och vår sida är ännu objuden. Ett direkt
    // 1NT-inkliv visar 15–18 balanserad med stopp i deras färg (kör 1NT-systemet);
    // i balansering (deras öppning har gått pass runt) 11–14. Felrapport #52 –
    // lästes felaktigt som ett svagt svar (6–11 hp). Facit: overcalls.ts §7.
    if (cb.level === 1 && !ownSideHasBid(seat, prior)) {
      const open = opening(prior)!
      const theirSuit = open.cb.strain !== 'NT' ? NAME[open.cb.strain] : 'motståndarnas färg'
      const balancing = prior.some((c) => c.bid === 'P')
      const range = balancing ? '11–14 hp' : '15–18 hp'
      const kind = balancing ? '1NT-inkliv i balansering (återöppning)' : '1NT-inkliv'
      return {
        text: `1 sang — ${kind}: ${range}, balanserad med stopp i ${theirSuit} (kör 1NT-systemet).`,
        confidence: 'trolig',
      }
    }
    if (cb.level >= 3) {
      return { text: `${cb.level} sang — till spel, balanserad hand${stopp}.`, confidence: 'trolig', forcing: 'avslut' }
    }
    // Öppnarens EGET sangåterbud efter att ha öppnat i FÄRG beskriver styrka/form
    // (budsystem.md §5.2), inte en svag hand: 1NT = balanserad minimihand
    // (~12–14 hp; 15–17 hade öppnat 1NT), 2NT = stark balanserad (~18–19 hp).
    // Felrapport #24: 1NT-återbudet kallades felaktigt "svag balanserad hand".
    const open = opening(prior)
    // Öppnarens 2NT-återbud efter partnerns 2-ÖVER-1 (§5.3, felrapport #58):
    // ingen hoppstyrka utan "balanserad utan extra form" — och hela auktionen
    // är utgångskrav, så partnern får aldrig passa.
    if (cb.level === 2 && open && open.seat === seat && open.cb.strain !== 'NT' && twoOverOneGameForce(seat, prior)) {
      return {
        text: `Återbud 2 sang efter partnerns 2-över-1 — balanserad hand utan extra form (~12–15 hp). Utgångskravet gäller: partnern får inte passa.`,
        confidence: 'trolig',
        forcing: 'utgangskrav',
      }
    }
    if (open && open.seat === seat && open.cb.strain !== 'NT') {
      if (cb.level === 1) {
        return {
          text: `Återbud 1 sang — balanserad minimihand (~12–14 hp; 15–17 hade öppnat 1 sang)${stopp}.`,
          confidence: 'trolig',
        }
      }
      // 2NT-återbud (hopp) = 18–19 hp, för stark för 1NT-öppning, inbjuder utgång.
      return {
        text: `Återbud 2 sang — stark balanserad hand (~18–19 hp), inbjuder utgång${stopp}.`,
        confidence: 'trolig',
        forcing: 'inbjudan',
      }
    }
    // Övriga sangbud (svararens/advancerns): begränsat svar, inte en spärr.
    const range = cb.level === 1 ? '6–11 hp, balanserad, saknar stöd och bättre bud' : 'inbjudande balanserad hand (~11–12 hp)'
    return { text: `${cb.level} sang — ${range}${stopp}.`, confidence: 'trolig', forcing: cb.level === 2 ? 'inbjudan' : undefined }
  }

  // 2-ÖVER-1 (§4.2, felrapport #58): svararens FÖRSTA bud, en ny LÄGRE färg
  // på 2-läget över partnerns 1-färgsöppning, ostört och opassad = utgångskrav.
  if (isTwoOverOneResponse(seat, cb, prior)) {
    return {
      text: `${cb.level}${sym} — 2-över-1: naturligt, 4+ (oftast 5+) ${name} och 12+ hp. Utgångskrav — ingen av er får passa under utgång.`,
      confidence: 'trolig',
      forcing: 'utgangskrav',
    }
  }

  // Ny färg med hopp = svagt hoppskift: lång egen färg, begränsad styrka.
  const last = lastContract(prior)
  const isJump = last ? cb.level > last.cb.level + (rankAbove(cb.strain, last.cb.strain) ? 0 : 1) : false
  if (isJump) {
    const partnerSuit = [...partnerSuits][0]
    const short = partnerSuit ? `, ofta kort i partnerns ${NAME[partnerSuit]}` : ''
    return {
      text: `Hoppbud i ${name} (${cb.level}${sym}) — lång färg (6+ kort, gärna 7) med begränsad styrka (~7–10 hp)${short}; inbjuder till utgång i ${name}.`,
      confidence: 'trolig',
      forcing: 'inbjudan',
    }
  }
  return {
    text: `Ny färg ${name} (${cb.level}${sym}) — naturligt, visar minst 4 kort i ${name}.`,
    confidence: 'trolig',
    forcing: competitive ? undefined : 'krav-1-rond',
  }
}

/** Rankar `a` direkt över `b` på samma nivå (för hopp-bedömning)? */
function rankAbove(a: string, b: string): boolean {
  const order = ['C', 'D', 'H', 'S', 'NT']
  return order.indexOf(a) > order.indexOf(b)
}

/** Är budet en HÖJNING med hopp i `partner`s färg (mer än enkel höjning)? */
function isJumpRaise(cb: ParsedBid, partner: Seat, prior: ResolvedCall[]): boolean {
  let partnerLevel = 0
  for (const c of prior) {
    const p = parseBid(c.bid)
    if (c.seat === partner && p && p.strain === cb.strain) partnerLevel = p.level
  }
  return partnerLevel > 0 && cb.level > partnerLevel + 1
}

function interpretPass(seat: Seat, prior: ResolvedCall[]): CallInterpretation {
  if (!opening(prior)) {
    return { text: 'Pass — avstår från att öppna (handen når inte öppningskraven).', confidence: 'trolig', forcing: 'avslut' }
  }
  const trailing = countTrailingPasses(prior)
  if (trailing >= 2) {
    const last = lastContract(prior)
    const where = last ? ` Ni stannar i ${last.cb.level}${SYMBOL[last.cb.strain]}.` : ''
    return { text: `Pass — budgivningen är slut.${where}`, confidence: 'säker', forcing: 'avslut' }
  }
  if (opponentsHaveBid(seat, prior)) {
    return { text: 'Pass — ingen ytterligare handling i den här ronden.', confidence: 'trolig' }
  }
  return { text: 'Pass.', confidence: 'trolig' }
}

function countTrailingPasses(prior: ResolvedCall[]): number {
  let n = 0
  for (let i = prior.length - 1; i >= 0 && prior[i].bid === 'P'; i--) n++
  return n
}

/** Färgerna motståndarsidan (sett från `seat`) har bjudit naturligt. */
function opponentSuits(seat: Seat, prior: ResolvedCall[]): Set<string> {
  const s = new Set<string>()
  for (const c of prior) {
    const cb = parseBid(c.bid)
    if (cb && cb.strain !== 'NT' && SIDE[c.seat] !== SIDE[seat]) s.add(cb.strain)
  }
  return s
}

/**
 * Tolka en dubbling UR AUKTIONEN (ägarprincip 2026-08-19: inga gissningar –
 * betydelsen härleds, aldrig "straff" på måfå). Kategorierna skiljs på VEM som
 * öppnade och om partnern hunnit svara:
 *   negativ (partnern öppnade, jag ännu objuden) · stöd (jag öppnade, partnern
 *   svarade i färg) · återöppning (jag öppnade, partnern passade) · upplysning
 *   (ingen egen budgivning) · straff (1NT / utgång) · utgångsförsök (fit finns) ·
 *   kooperativ (låg dubbling utan fit, båda sidor har bjudit).
 */
function interpretDouble(seat: Seat, prior: ResolvedCall[]): CallInterpretation {
  const open = opening(prior)
  const last = lastContract(prior)
  if (!last) return { text: 'Dubbelt.', confidence: 'trolig' }

  const partner = PARTNER[seat]
  const ours = prior.filter((c) => SIDE[c.seat] === SIDE[seat] && parseBid(c.bid))
  const ownHasBid = ours.length > 0
  const seatHasBid = prior.some((c) => c.seat === seat && parseBid(c.bid))
  const doubledIsOpp = SIDE[last.seat] !== SIDE[seat]
  const doubledName = last.cb.strain === 'NT' ? 'sang' : NAME[last.cb.strain]

  // (1) NEGATIV DUBBLING — partnern öppnade 1 i färg, motståndaren klev in, och
  //     detta är svararens FÖRSTA aktion. Visar 4+ i objuden högfärg (takeout).
  if (
    open && open.seat === partner && open.cb.level === 1 && open.cb.strain !== 'NT' &&
    !seatHasBid && ours.length === 1 &&
    doubledIsOpp && last.cb.strain !== 'NT' && last.cb.level <= 3
  ) {
    const oppSuits = opponentSuits(seat, prior)
    const majors = ['H', 'S'].filter((m) => m !== open.cb.strain && !oppSuits.has(m))
    const shown =
      majors.length === 2
        ? 'båda de objudna högfärgerna (hjärter och spader)'
        : majors.length === 1
          ? `4+ ${NAME[majors[0]]} (den objudna högfärgen)`
          : 'de objudna färgerna'
    return {
      text: `Negativ dubbling — visar ${shown} och ungefär svarsstyrka; takeout-artad, ber partnern välja färg (INTE straff).`,
      confidence: 'trolig',
      forcing: 'krav-1-rond',
    }
  }

  // (2) STÖDDUBBLING — jag öppnade, partnern svarade i NY färg, motståndaren klev
  //     in ≤ 2 av svararens färg. Visar exakt 3-korts stöd i partnerns färg.
  if (open && open.seat === seat && open.cb.level === 1 && open.cb.strain !== 'NT') {
    const partnerBid = prior.find((c) => c.seat === partner && parseBid(c.bid))
    const pcb = partnerBid ? parseBid(partnerBid.bid) : null
    if (
      pcb && pcb.strain !== 'NT' && pcb.strain !== open.cb.strain &&
      ours.length === 2 && doubledIsOpp &&
      bidRank(last.cb) <= bidRank({ level: 2, strain: pcb.strain })
    ) {
      return {
        text: `Stöddubbling — visar exakt 3-korts stöd i partnerns ${NAME[pcb.strain]} (med 4-korts stöd höjer man färgen i stället).`,
        confidence: 'trolig',
      }
    }
  }

  // (3) ÅTERÖPPNINGSDUBBLING — jag öppnade, motståndarna klev in och partnern
  //     passade; det kom tillbaka till mig. Takeout, extra värden, säljer inte billigt.
  if (
    open && open.seat === seat && ours.length === 1 &&
    doubledIsOpp && last.cb.strain !== 'NT' &&
    prior.some((c) => c.seat === partner && c.bid === 'P')
  ) {
    return {
      text: `Återöppningsdubbling — takeout: du öppnade, motståndarna klev in och partnern passade. Du återöppnar med kort i ${doubledName} och extra värden och ber partnern välja (partnern kan sitta kvar för straff).`,
      confidence: 'trolig',
      forcing: 'krav-1-rond',
    }
  }

  // (4) UPPLYSNINGSDUBBLING — vår sida har inte bjudit; direkt takeout av
  //     motståndarnas färgbud på låg nivå (i balansering lättare styrka).
  if (!ownHasBid && doubledIsOpp && last.cb.strain !== 'NT' && last.cb.level <= 2) {
    const balancing = prior.some((c) => SIDE[c.seat] === SIDE[seat] && c.bid === 'P')
    const bal = balancing ? ' i balansering' : ''
    const extra = balancing ? ' (lättare styrka, återöppnar budgivningen)' : ''
    return {
      text: `Upplysningsdubbling${bal} — ber partnern välja färg: kort i ${doubledName}, stöd i de övriga${extra}.`,
      confidence: 'trolig',
      forcing: 'krav-1-rond',
    }
  }

  // (5) STRAFF mot 1 sang — visar styrka, inte takeout.
  if (last.cb.strain === 'NT' && last.cb.level === 1 && !ownHasBid) {
    return {
      text: 'Straffdubbling av 1 sang — visar styrka (~15+, ofta en bättre hand än 1NT-budgivaren); ni tar poäng på att straffa.',
      confidence: 'trolig',
    }
  }

  // (6) STRAFF mot utgång/slam — motståndarna når spel eller offrar.
  if (isGameLevel(last.cb)) {
    return {
      text: `Straffdubbling — du tror motståndarnas ${last.cb.level}${SYMBOL[last.cb.strain]} går bet.`,
      confidence: 'trolig',
    }
  }

  // (7) UTGÅNGSFÖRSÖK (maximal) — ni har en högfärgsfit och motståndarna trängde
  //     upp budet; dubblingen ber partnern bjuda utgången med det övre av sitt spann.
  const agreed = agreedSuit(seat, prior)
  if (agreed && (agreed === 'H' || agreed === 'S') && doubledIsOpp) {
    return {
      text: `Utgångsförsök via dubbling (maximal) — ni har en ${NAME[agreed]}fit och motståndarna trängde upp budgivningen. Dubblingen ber partnern bjuda utgången i ${NAME[agreed]} med det övre av sin styrka, annars passa.`,
      confidence: 'trolig',
    }
  }

  // (8) KOOPERATIV DUBBLING — låg dubbling där vår sida redan bjudit men ingen fit
  //     är etablerad: värden + kort i färgen, partnern väljer straff eller bud.
  return {
    text: `Kooperativ dubbling — visar värden och oftast kort i ${doubledName}. Ingen ren straffdubbling: partnern väljer att straffa, bjuda vidare eller passa.`,
    confidence: 'trolig',
  }
}

function interpretRedouble(_seat: Seat, _prior: ResolvedCall[]): CallInterpretation {
  return {
    text: 'Redubbelt — visar styrka (oftast 10+ hp), ofta efter motståndarnas upplysningsdubbling.',
    confidence: 'trolig',
    forcing: 'krav-1-rond',
  }
}

// ==== Den ostörda auktionen (motorbytet etapp 1) =============================
// Läser 2/1-systemets ostörda struktur (docs/budsystem.md §4–§6) ur buden
// ensamma: vem öppnade, vad svararen svarade, var i auktionen vi står. Där
// systemboken namnger en konvention sätts regelnamnet ur registret (`rules.ts`),
// så kravnivå och alert kommer ur SAMMA källa som motorns egna bud.
// Betydelsesvepet (`auction-meaning.probe.test.ts`) vaktar att läsningen
// stämmer med regeln motorn satte.

interface OurBid {
  seat: Seat
  cb: ParsedBid
}

interface Undisturbed {
  opener: Seat
  responder: Seat
  /** Vår sidas kontraktsbud i ordning; [0] är öppningen. */
  bids: OurBid[]
  /** Svararen passade före öppningen (passad hand → Drury, inga kravsvar). */
  responderPassed: boolean
}

/** Auktionen sedd från `seat`s sida när motståndarna bara passat, annars null. */
function undisturbed(seat: Seat, prior: ResolvedCall[]): Undisturbed | null {
  const open = opening(prior)
  if (!open || SIDE[open.seat] !== SIDE[seat]) return null
  const responder = PARTNER[open.seat]
  const bids: OurBid[] = []
  let responderPassed = false
  for (const c of prior) {
    if (c.bid === 'P') {
      if (bids.length === 0 && c.seat === responder) responderPassed = true
      continue
    }
    if (SIDE[c.seat] !== SIDE[seat]) return null // motståndarna har bjudit/dubblat
    const cb = parseBid(c.bid)
    if (!cb) return null // egen X/XX — ingen ostörd auktion
    bids.push({ seat: c.seat, cb })
  }
  return { opener: open.seat, responder, bids, responderPassed }
}

const isMajor = (s: string) => s === 'H' || s === 'S'
const isMinor = (s: string) => s === 'C' || s === 'D'
const otherMajor = (s: string) => (s === 'H' ? 'S' : 'H')
const same = (a: ParsedBid, level: number, strain: string) => a.level === level && a.strain === strain
/** "3♥" / "2 sang" */
const B = (cb: ParsedBid) => (cb.strain === 'NT' ? `${cb.level} sang` : `${cb.level}${SYMBOL[cb.strain]}`)
/** Lägsta nivån `strain` kan bjudas på över `over`. */
const minLevelOver = (over: ParsedBid, strain: string) => over.level + (rankAbove(strain, over.strain) ? 0 : 1)
const isJumpOver = (over: ParsedBid, cb: ParsedBid) => cb.level > minLevelOver(over, cb.strain)
const gameIn = (strain: string): ParsedBid => ({ level: strain === 'NT' ? 3 : isMajor(strain) ? 4 : 5, strain })

/** Ett bud med regelnamn ur registret — kravnivå + alert kommer därifrån. */
function R(rule: string, text: string, forcing: Forcing | undefined = forcingOf(rule)): CallInterpretation {
  return { text, confidence: 'trolig', rule, forcing }
}
/** Ett naturligt bud utan namngiven regel. */
function N(text: string, forcing?: Forcing): CallInterpretation {
  return { text, confidence: 'trolig', forcing }
}
/** Utgång eller högre = till spel; annars den angivna kravnivån. */
const below = (cb: ParsedBid, forcing: Forcing): Forcing => (isGameLevel(cb) ? 'avslut' : forcing)

/** Trumf som satts konventionellt (Jacoby/Bergen/splinter/inverterad/höjning), utan att båda bjudit färgen. */
function conventionalTrump(u: Undisturbed): string | null {
  if (u.bids.length < 2) return null
  const open = u.bids[0].cb
  const resp = u.bids[1].cb
  if (open.level === 1 && isMajor(open.strain)) {
    if (resp.strain === open.strain) return open.strain // höjning
    if (same(resp, 2, 'NT') && !u.responderPassed) return open.strain // Jacoby 2NT
    if (resp.level === 3 && (resp.strain === 'C' || resp.strain === 'D' || isMajor(resp.strain))) return open.strain // Bergen / tvetydig splinter
    if (u.responderPassed && resp.level === 2 && isMinor(resp.strain)) return open.strain // Drury
  }
  if (open.level === 1 && isMinor(open.strain) && resp.strain === open.strain) return open.strain // inverterad
  if (open.level >= 2 && open.strain !== 'NT' && resp.strain === open.strain) return open.strain
  return null
}

/** Är vår sida i utgångskrav (läst ur buden)? */
function gameForced(u: Undisturbed, seat: Seat, prior: ResolvedCall[]): boolean {
  const open = u.bids[0].cb
  const resp = u.bids[1]?.cb
  if (same(open, 2, 'C')) {
    // 2♣: krav tills utgång, utom efter 2NT/3NT-återbudet (ej krav) och efter andra negativa.
    if (u.bids.length >= 3 && resp && same(resp, 2, 'D') && u.bids[2].cb.strain === 'NT') return false
    if (secondNegativeIndex(u) >= 0) return false
    return true
  }
  if (!resp) return false
  if (open.level === 1 && isMajor(open.strain) && !u.responderPassed) {
    if (same(resp, 2, 'NT')) return true // Jacoby 2NT
    if (resp.level === 3 && isMajor(resp.strain) && resp.strain !== open.strain) return true // tvetydig splinter
  }
  if (twoOverOneGameForce(seat, prior)) return true
  // Hoppskift av öppnaren (1x–1y–3z i ny färg).
  if (u.bids.length >= 3) {
    const reb = u.bids[2].cb
    if (reb.strain !== 'NT' && reb.strain !== open.strain && reb.strain !== resp.strain && isJumpOver(resp, reb)) return true
    // Fjärde färg krav av svararen.
    if (u.bids.length >= 4 && isFourthSuit(u, u.bids[3].cb)) return true
    // NMF + öppnarens visade stöd (1x–1M–1NT–2m–2M/3M): fördröjt högfärgsstöd, GF
    // och cue-ronden öppen (§6.2 "New Minor Forcing → öppnarens fördröjda högfärgsstöd").
    if (u.bids.length >= 5 && isNMF(u, u.bids[3].cb) && u.bids[4].cb.strain === resp.strain) return true
    // Öppnarens NYA (fjärde) färg i rond 3 efter svararens preferens = krav.
    if (u.bids.length >= 5 && u.bids[4].seat === u.opener) {
      const w5 = u.bids[4].cb
      const shown = new Set(u.bids.slice(0, 4).map((b) => b.cb.strain))
      if (w5.strain !== 'NT' && !shown.has(w5.strain)) return true
    }
  }
  return false
}

/** Index i `u.bids` för svararens ANDRA NEGATIVA efter 2♣–2♦–färg, eller −1. */
function secondNegativeIndex(u: Undisturbed): number {
  const b = u.bids
  if (b.length < 4 || !same(b[0].cb, 2, 'C') || !same(b[1].cb, 2, 'D')) return -1
  const reb = b[2].cb
  if (reb.strain === 'NT') return -1
  return isSecondNegative(reb, b[3].cb) ? 3 : -1
}

/** Svararens andra negativa: 3♣ över öppnarens 2♥/2♠-kravfärg (2♣–2♦–2M–3♣). Motorn spelar den bara där. */
function isSecondNegative(rebid: ParsedBid, cb: ParsedBid): boolean {
  return rebid.level === 2 && isMajor(rebid.strain) && same(cb, 3, 'C')
}

/** Fjärde färg (§6.6): tre färger bjudna av oss, detta är den fjärde, inte alla på 1-läget, opassad hand, ingen reverse före. */
function isFourthSuit(u: Undisturbed, cb: ParsedBid): boolean {
  if (u.bids.length < 3 || cb.strain === 'NT' || u.responderPassed) return false
  const [open, resp, reb] = u.bids.map((b) => b.cb)
  const suits = new Set([open.strain, resp.strain, reb.strain].filter((s) => s !== 'NT'))
  if (suits.size !== 3 || suits.has(cb.strain)) return false
  // Motorn spelar fjärde färg även efter en reverse (boken §6.6 undantar den —
  // avvikelse noterad i motorbytets logg 2026-09-04; lagret följer motorn).
  return cb.level > 1
}

/** New Minor Forcing (§5.7): efter 1x–1M–1NT bjuder svararen en obruten lågfärg på 2-läget. */
function isNMF(u: Undisturbed, cb: ParsedBid): boolean {
  // `cb` är (kandidaten till) svararens ANDRA bud — anropas både när det bjuds
  // (n = 3) och senare i auktionen med u.bids[3].
  if (u.bids.length < 3 || cb.level !== 2 || !isMinor(cb.strain) || u.responderPassed) return false
  const [open, resp, reb] = u.bids.map((b) => b.cb)
  if (!same(reb, 1, 'NT') || resp.level !== 1 || !isMajor(resp.strain)) return false
  return cb.strain !== open.strain
}

function undisturbedMeaning(seat: Seat, cb: ParsedBid, u: Undisturbed, prior: ResolvedCall[]): CallInterpretation | null {
  const open = u.bids[0].cb
  const ntBase = naturalNTBase(u)
  return (
    slamZone(seat, cb, u, prior) ??
    (ntBase >= 0 ? overNaturalNT(seat, cb, u, ntBase) : null) ??
    (same(open, 2, 'C') ? afterStrongTwoClubs(seat, cb, u) : null) ??
    (open.level === 1 && isMajor(open.strain) ? afterOneMajor(seat, cb, u, prior) : null) ??
    (open.level === 1 && isMinor(open.strain) ? afterOneMinor(seat, cb, u, prior) : null) ??
    (open.level === 2 && open.strain !== 'NT' ? afterWeakTwo(seat, cb, u) : null) ??
    (open.level >= 3 && open.strain !== 'NT' ? afterPreempt(seat, cb, u) : null)
  )
}

/** Index i `u.bids` för den naturliga sang som sangsystemet spelas mot (1NT/2NT/3NT-öppning, 2♣–2♦–2NT/3NT), eller −1. */
function naturalNTBase(u: Undisturbed): number {
  const b = u.bids
  if (b[0].cb.strain === 'NT') return 0
  if (b.length >= 3 && same(b[0].cb, 2, 'C') && same(b[1].cb, 2, 'D') && b[2].cb.strain === 'NT') return 2
  return -1
}

// ---- Slamzonen: essfrågor, cue-bud, kvantitativa bud, avslut ---------------

function slamZone(seat: Seat, cb: ParsedBid, u: Undisturbed, prior: ResolvedCall[]): CallInterpretation | null {
  const n = u.bids.length
  const last = u.bids[n - 1].cb
  const partnerLast = u.bids[n - 1].seat === PARTNER[seat]
  const gf = gameForced(u, seat, prior)
  const nat = naturalSuits(u, gf)
  const own = nat.suits.get(seat)!
  const partnerS = nat.suits.get(PARTNER[seat])!
  const agreed = nat.agreed
  const trump = nat.trump
  const sym = SYMBOL[cb.strain]
  const name = NAME[cb.strain]
  const lastWasCue = partnerLast && nat.cues.has(n - 1)

  // Sjöbergs 5NT (§6.3): frågaren bjuder 5NT efter nyckelkortssvaret.
  const rkc = rkcSequence(seat, prior)
  if (rkc && rkc.answer && seat === rkc.asker && same(cb, 5, 'NT')) {
    return R('Sjöberg 5NT', `5 sang — kungfråga (Sjöberg): alla nyckelkort är på plats och trumfdamen under kontroll; partnern visar VILKEN kung (6 i färgen, 6 i trumf = ingen).`)
  }
  if (rkc && rkc.answer && cb.level >= 6 && same(last, 5, 'NT') && seat === PARTNER[rkc.asker]) {
    const tsym = SYMBOL[rkc.trump]
    if (cb.strain === rkc.trump && cb.level === 6) return R('Sjöberg 5NT', `6${tsym} — svar på kungfrågan: ingen sidokung.`)
    if (cb.strain === rkc.trump && cb.level === 7) return R('Sjöberg 5NT', `7${tsym} — svar på kungfrågan: två eller alla tre användbara kungar.`)
    return R('Sjöberg 5NT', `${B(cb)} — svar på kungfrågan: kungen i ${name}.`)
  }
  // Slam i överenskommen trumf = avslut.
  if (cb.level >= 6 && cb.strain !== 'NT' && (trump === cb.strain || (rkc && rkc.trump === cb.strain))) {
    return R('slamavslut', `${B(cb)} — ${cb.level === 7 ? 'storslam' : 'lillslam'} i ${name}, till spel.`)
  }
  if (same(cb, 6, 'NT')) return R('6NT till spel', `6 sang — lillslam i sang, till spel.`)
  if (same(cb, 7, 'NT')) return R('slamavslut', `7 sang — storslam i sang, till spel.`)

  // Gerber (§6.4): hopp till 4♣ direkt över partnerns naturliga 1NT/2NT (öppning eller återbud).
  const partnerNT = partnerLast && last.strain === 'NT' && isNaturalNT(u, n - 1)
  if (partnerNT && last.level <= 2 && same(cb, 4, 'C')) {
    return R('Gerber', `4♣ — Gerber: essfråga över partnerns sang. Partnern svarar 4♦ = 0/4 ess, 4♥ = 1, 4♠ = 2, 4NT = 3. Säger inget om klöver.`)
  }
  if (n >= 2 && same(last, 4, 'C') && partnerLast && u.bids[n - 2].seat === seat && u.bids[n - 2].cb.strain === 'NT' && u.bids[n - 2].cb.level <= 2 && isNaturalNT(u, n - 2) && cb.level === 4) {
    const ess: Record<string, string> = { D: '0 eller 4 ess', H: '1 ess', S: '2 ess', NT: '3 ess' }
    if (ess[cb.strain]) return R('Gerber', `${B(cb)} — svar på Gerber: ${ess[cb.strain]}. Säger inget om ${cb.strain === 'NT' ? 'sang' : name}.`)
  }

  // 4NT: kvantitativt över partnerns sangöppning/3NT utan trumf — annars essfråga
  // (över ett 1NT/2NT-ÅTERBUD med egen visad färg som trumf, §5.7).
  if (same(cb, 4, 'NT')) {
    const ntBase = naturalNTBase(u)
    if (partnerNT && !trump && (ntBase === n - 1 || last.level === 3)) {
      return last.level === 3 && ntBase < 0
        ? R('slamtrevare efter 3NT', `4 sang — slamtrevare över partnerns 3 sang: kvantitativ inbjudan, bjud 6 sang med maximum, passa annars.`)
        : R('4NT kvantitativ', `4 sang — kvantitativ slaminbjudan över partnerns sang: bjud 6 sang med maximum, passa med minimum.`)
    }
    const ownLast = [...u.bids].reverse().find((b) => b.seat === seat && own.has(b.cb.strain))?.cb.strain ?? null
    const t = trump ?? ownLast ?? askTrumpFallback(seat, prior)
    if (t) {
      return R('1430 RKC', `4 sang — essfråga (1430 RKC) med ${NAME[t]} som trumf. Partnern svarar i steg: 5♣ = 1/4 nyckelkort, 5♦ = 0/3, 5♥ = 2 utan trumfdam, 5♠ = 2 med.`)
    }
    return R('4NT kvantitativ', `4 sang — kvantitativ slaminbjudan: bjud 6 sang med maximum, passa annars.`)
  }
  if (n >= 2 && same(last, 4, 'NT') && partnerLast && !trump && u.bids[n - 2].cb.strain === 'NT' && u.bids[n - 2].seat === seat) {
    if (same(cb, 6, 'NT')) return R('accepterar slaminbjudan', `6 sang — accepterar den kvantitativa slaminbjudan (maximum).`)
  }

  // Slaminbjudan 5M (kaptensregeln 31–32) och accepten 6M.
  if (!rkc && cb.level === 5 && isMajor(cb.strain)) {
    return R('slaminbjudan', `5${sym} — slaminbjudan i ${name}: bjud 6${sym} med mer än blott minimum, passa annars.`)
  }
  if (trump && isMajor(trump) && same(cb, 6, trump) && partnerLast && same(last, 5, trump)) {
    return R('slaminbjudan: accept', `6${sym} — accepterar slaminbjudan.`)
  }

  // Avslut i trumf efter partnerns kontrollbud.
  if (trump && lastWasCue && cb.strain === trump && isGameLevel(cb)) {
    return R('cue: avslut', `${B(cb)} — stannar i utgång efter kontrollbuden: inget mer att visa.`)
  }

  // Kontrollbud som SÄTTER trumfen (utgångskrav utan satt trumf): svararens
  // 4-lägesbud över 3NT under utgång i partnerns färg (regeln i impliedCueTrump).
  if (!trump && gf && seat === u.responder) {
    const ps = [...u.bids].reverse().find((b) => b.seat === PARTNER[seat] && partnerS.has(b.cb.strain))?.cb.strain ?? null
    const balanced = u.bids.length > 1 && same(u.bids[0].cb, 2, 'C') && same(u.bids[1].cb, 2, 'NT')
    const ownTimes = u.bids.filter((b) => b.seat === seat && b.cb.strain === cb.strain).length
    const t = impliedCueTrump(cb, ps, partnerS, own, balanced, ownTimes)
    if (t) {
      return R('cue-bid', `Kontrollbud ${B(cb)} — sätter partnerns ${NAME[t]} som trumf och visar kontroll (ess/renons) i ${name}, slamintresse. Partnern cue:ar en egen kontroll eller stannar i ${gameIn(t).level}${SYMBOL[t]}.`)
    }
  }

  // Cue-bud (§6.2): trumf satt, ny färg under utgång i trumfen — i minorfit bara ÖVER 3NT.
  // (Är trumfen satt av båda och partnern just cue:at svarar motorn med cue även i en
  // egen visad färg: 1♥–1♠–1NT–2♦–2♠–3♦–3♥. Utan pågående cue-rond är egen färg naturlig.)
  if (trump && cb.strain !== 'NT' && cb.strain !== trump && n >= 2 && ((agreed && lastWasCue) || !own.has(cb.strain))) {
    const game = gameIn(trump)
    const ok =
      bidRank(cb) < bidRank(game) &&
      (isMajor(trump) ? cb.level === 4 || (cb.level === 3 && gf && n >= 3) : bidRank(cb) > bidRank({ level: 3, strain: 'NT' }))
    // Öppnarens svar på Jacoby 2NT och kortfärgssvaren på splinterreläet är egna regler (afterOneMajor).
    const jacobyReply = n === 2 && same(u.bids[1].cb, 2, 'NT') && seat === u.opener
    const splinterReply = n === 3 && u.bids[1].cb.level === 3 && isMajor(u.bids[1].cb.strain) && u.bids[1].cb.strain !== u.bids[0].cb.strain && seat === u.responder
    // I partnerns färg är budet ett cue bara när trumfen är satt på riktigt (annars en höjning).
    const inPartnerSuit = partnerS.has(cb.strain)
    if (ok && !jacobyReply && !splinterReply && (!inPartnerSuit || agreed)) {
      const tsym = SYMBOL[trump]
      return R('cue-bid', `Kontrollbud ${B(cb)} — ${NAME[trump]} är trumf, så budet visar kontroll (ess/renons, senare kung/singel) i ${name} och slamintresse. Partnern cue:ar en egen kontroll eller stannar i ${game.level}${tsym}.`)
    }
  }
  return null
}

/**
 * Svararens 4-lägesbud i UTGÅNGSKRAV utan satt trumf (2♣-auktioner, 2/1) som
 * cue:ar och sätter partnerns senaste färg som trumf — så som motorn spelar det:
 *  · över 3NT och under utgång i partnerns färg,
 *  · partnerns färg HÖGfärg: alltid ett cue (även i egen visad färg: 2♣–3♦–3♠–4♦),
 *  · partnerns färg LÅGfärg: bara när svararen inte visat någon egen färg
 *    (2♣–2NT–3♦–4♣); annars är budet naturligt (andra färgen / egen färg).
 * 2♣-öppnarens 4-lägesfärger är alltid naturliga (§4.4 "naturlig färgrebud").
 * Returnerar trumfen eller null.
 */
function impliedCueTrump(cb: ParsedBid, partnerSuit: string | null, partnerShown: Set<string>, ownShown: Set<string>, balancedResponder: boolean, ownTimes: number): string | null {
  if (!partnerSuit || cb.strain === 'NT' || cb.level < 3) return null
  if (partnerShown.has(cb.strain)) return null // höjning/placering, inte cue
  if (isGameLevel(cb) && ownShown.size > 0) return null // utgång i egen visad färg = placering (2♣–2♥–2♠–3♥–3♠–4♥)
  if (ownTimes >= 2) return null // tredje budet i egen färg är en rebud (1♠–2♣–2♠–3♣–3♠–4♣), inte ett cue
  if (bidRank(cb) >= bidRank(gameIn(partnerSuit))) return null
  if (isMajor(partnerSuit)) {
    if (cb.level === 4) return partnerSuit
    return balancedResponder ? partnerSuit : null // 3-läget: bara den balanserade svararen (2♣–2NT–3♥–3♠); efter 2♦ är ny färg naturlig
  }
  if (bidRank(cb) <= bidRank({ level: 3, strain: 'NT' })) return null
  return ownShown.size === 0 ? partnerSuit : null
}

interface NaturalSuits {
  suits: Map<Seat, Set<string>>
  /** Index i `u.bids` för buden som var kontrollbud. */
  cues: Set<number>
  /** Trumf satt genom att båda bjudit färgen naturligt. */
  agreed: string | null
  /** Trumf: äkta överenskommen, konventionellt satt (Jacoby/Bergen/…) eller underförstådd av ett kontrollbud. */
  trump: string | null
}

/**
 * Vår sidas NATURLIGA färger per stol (konstgjorda bud räknas inte: 2♣/2♦-
 * väntebud, Stayman/transfer/MSS/Texas/Gerber, Bergen, tvetydig splinter,
 * Drury, kortfärgs- och stoppvisningar, NMF, fjärde färg, checkback) — plus
 * kontrollbuden och den trumf de förutsätter. Räknas i EN genomgång av buden.
 */
function naturalSuits(u: Undisturbed, gf: boolean): NaturalSuits {
  const suits = new Map<Seat, Set<string>>([[u.opener, new Set()], [u.responder, new Set()]])
  const cues = new Set<number>()
  const open = u.bids[0].cb
  const ntBase = naturalNTBase(u)
  let agreed: string | null = null
  let trump: string | null = null
  const lastSuit = new Map<Seat, string>()
  u.bids.forEach((b, k) => {
    const cb = b.cb
    if (cb.strain === 'NT') {
      if (k === 1 && !trump) trump = conventionalTrump(u) // Jacoby 2NT
      return
    }
    const mine = suits.get(b.seat)!
    const theirs = suits.get(PARTNER[b.seat])!
    const artificial = (): boolean => {
      if (k === 0) return same(cb, 2, 'C')
      if (same(open, 2, 'C') && k === 1 && same(cb, 2, 'D')) return true
      if (ntBase >= 0) {
        const L = u.bids[ntBase].cb.level
        if (k === ntBase + 1) return cb.level === L + 1 || (cb.level === 4 && (cb.strain === 'C' || cb.strain === 'D' || cb.strain === 'H'))
        if (k === ntBase + 2) {
          const r = u.bids[ntBase + 1].cb
          if (same(r, L + 1, 'C') && cb.strain === 'D') return true // Stayman: ingen högfärg
          if ((same(r, L + 1, 'D') || same(r, L + 1, 'H')) && cb.level >= L + 1) return true // fullföljd transfer / superaccept
          if (same(r, 2, 'S') && L === 1 && isMajor(cb.strain)) return true // MSS: stoppvisning
        }
      }
      if (open.level === 1 && isMajor(open.strain)) {
        if (k === 1 && cb.level === 3 && cb.strain !== open.strain) return true // Bergen / tvetydig splinter
        if (k === 1 && u.responderPassed && cb.level === 2 && isMinor(cb.strain)) return true // Drury
        if (k === 2 && same(u.bids[1].cb, 2, 'NT') && !u.responderPassed && cb.level === 3 && cb.strain !== open.strain) return true // Jacoby: kortfärg
        if (k === 3 && u.bids[1].cb.level === 3 && isMajor(u.bids[1].cb.strain) && u.bids[1].cb.strain !== open.strain && cb.level === 4) return true // kortfärgssvar
      }
      if (open.level === 1 && isMinor(open.strain) && u.bids.length > 1 && same(u.bids[1].cb, 2, open.strain)) {
        if (k >= 2 && cb.strain !== open.strain && bidRank(cb) < bidRank({ level: 3, strain: 'NT' })) return true // stoppvisning
      }
      if (k === 3 && (isNMF(u, cb) || isFourthSuit(u, cb))) return true
      if (k === 3 && u.bids[2].cb.strain === 'NT' && u.bids[2].cb.level === 2 && same(cb, 3, 'C') && u.bids[1].cb.level === 1) return true // checkback
      return false
    }
    if (artificial()) return
    const above3NT = bidRank(cb) > bidRank({ level: 3, strain: 'NT' })
    // Kontrollbud med satt trumf.
    if (trump && cb.strain !== trump && ((agreed && cues.has(k - 1)) || !mine.has(cb.strain)) && k >= 2) {
      const belowGame = bidRank(cb) < bidRank(gameIn(trump))
      if (belowGame && ((isMajor(trump) && (cb.level === 4 || (cb.level === 3 && gf))) || (isMinor(trump) && above3NT))) {
        cues.add(k)
        return
      }
    }
    // Svararens kontrollbud som SÄTTER trumfen i utgångskrav.
    if (!trump && gf && k >= 2 && b.seat === u.responder) {
      const balanced = same(open, 2, 'C') && same(u.bids[1].cb, 2, 'NT')
      const ownTimes = u.bids.slice(0, k).filter((x) => x.seat === b.seat && x.cb.strain === cb.strain).length
      const t = impliedCueTrump(cb, lastSuit.get(u.opener) ?? null, theirs, mine, balanced, ownTimes)
      if (t) {
        cues.add(k)
        trump = t
        return
      }
    }
    mine.add(cb.strain)
    lastSuit.set(b.seat, cb.strain)
    if (theirs.has(cb.strain)) {
      agreed = cb.strain
      trump = cb.strain
    } else if (k === 1 && !trump) trump = conventionalTrump(u)
  })
  return { suits, cues, agreed, trump }
}

/** Är sang nr `k` i `u.bids` en NATURLIG sang (öppning, 2♣–2♦–2NT/3NT, sangåterbud) — inte Jacoby 2NT/Ogust/relä? */
function isNaturalNT(u: Undisturbed, k: number): boolean {
  const cb = u.bids[k].cb
  if (cb.strain !== 'NT') return false
  if (k === 0) return true
  const open = u.bids[0].cb
  if (k === 1) {
    if (open.level === 1 && isMajor(open.strain) && cb.level === 2) return u.responderPassed // Jacoby (opassad)
    if (open.level === 2 && open.strain !== 'NT' && cb.level === 2) return false // Ogust
    return true
  }
  if (same(open, 2, 'C') && k === 2) return true
  return true
}

// ---- Sangsystemet (§4.3) över 1NT / 2NT / 2♣–2♦–2NT ----------------------

function overNaturalNT(seat: Seat, cb: ParsedBid, u: Undisturbed, k: number): CallInterpretation | null {
  const rel = u.bids.slice(k)
  const base = rel[0].cb
  const L = base.level
  const m = rel.length
  const ntOpener = rel[0].seat
  const meOpener = seat === ntOpener
  const sym = SYMBOL[cb.strain]
  const name = NAME[cb.strain]
  const mot = L === 1 ? '15–17' : L === 2 && k === 0 ? '20–21' : L === 2 ? '22–24' : '25–27'

  if (m === 1 && !meOpener) {
    // Svararens första bud över sangen.
    if (cb.level === L + 1) {
      if (cb.strain === 'C') return R(L === 1 ? 'Stayman' : 'Stayman (2NT)', `${B(cb)} — Stayman: frågar efter partnerns 4-korts högfärg (svar ${L + 1}♦ = ingen, ${L + 1}♥/${L + 1}♠ = den högfärgen). Säger inget om klöver.`)
      if (cb.strain === 'D' || cb.strain === 'H') {
        const target = cb.strain === 'D' ? 'hjärter' : 'spader'
        return R(L === 1 ? 'Jacoby-transfer' : 'transfer (2NT)', `${B(cb)} — Jacoby-transfer: visar 5+ ${target}, partnern bjuder ${target} (säger inget om ${name}).`)
      }
      if (cb.strain === 'S') {
        return L === 1
          ? R('Minor Suit Stayman', `2♠ — Minor Suit Stayman: 5-4+ i lågfärgerna utan högfärg, utgångs-/slamintresse (säger inget om spader).`)
          : R('minorfråga (2NT)', `3♠ — minorfråga: 5-4+ i lågfärgerna, slamintresse. Säger inget om spader.`)
      }
      if (cb.strain === 'NT' && L === 1) return R('inbjudan', `2 sang — inbjudan till 3 sang: 8–9 hp balanserad, ingen 4-korts högfärg.`)
      if (cb.strain === 'NT' && L === 2) return R('3NT till spel', `3 sang — till spel mittemot ${mot} balanserad.`)
    }
    if (cb.level === L + 2 && cb.strain !== 'NT' && L === 1) {
      return N(`3${sym} — naturligt: 6+ ${name} med utgångsstyrka och slamintresse. Utgångskrav.`, 'utgangskrav')
    }
    if (same(cb, 3, 'NT')) return R('3NT till spel', `3 sang — till spel: balanserad utgångshand mittemot ${mot}, ingen 4-korts högfärg att leta.`)
    if (cb.level === 4 && (cb.strain === 'D' || cb.strain === 'H')) {
      const target = cb.strain === 'D' ? 'hjärter' : 'spader'
      return R(L === 1 ? 'Texas' : 'Texas (2NT)', `${B(cb)} — Texas-transfer: 6+ ${target} med utgångsstyrka utan slamintresse; partnern bjuder 4 ${target}. Säger inget om ${name}.`)
    }
    if (same(cb, 4, 'S') || same(cb, 4, 'H')) return N(`${B(cb)} — till spel: lång ${name}, utgång utan slamintresse.`, 'avslut')
    if (cb.level === 5 && isMinor(cb.strain)) return N(`${B(cb)} — till spel i ${name}.`, 'avslut')
    return null
  }

  if (m === 2 && meOpener) {
    // Sangöppnarens svar på svararens konvention.
    const r = rel[1].cb
    if (same(r, L + 1, 'C')) {
      if (cb.level === L + 1 && cb.strain === 'D') return R('Stayman-svar', `${B(cb)} — svar på Stayman: ingen 4-korts högfärg. Säger inget om ruter.`)
      if (cb.level === L + 1 && cb.strain === 'H') return R('Stayman-svar', `${B(cb)} — svar på Stayman: 4 hjärter (kan ha 4 spader också).`)
      if (cb.level === L + 1 && cb.strain === 'S') return R('Stayman-svar', `${B(cb)} — svar på Stayman: 4 spader, förnekar 4 hjärter.`)
    }
    if (same(r, L + 1, 'D') || same(r, L + 1, 'H')) {
      const target = r.strain === 'D' ? 'H' : 'S'
      if (cb.strain === target && cb.level === L + 1) return R('fullföljd transfer', `${B(cb)} — fullföljer partnerns Jacoby-transfer (partnern visade 5+ ${name}). Säger inget om egen längd i ${name}.`)
      if (cb.strain === target && cb.level === L + 2) return R('superaccept', `${B(cb)} — superaccept av transfern: 4-korts ${name} och maximum, inbjuder utgång.`)
    }
    if (same(r, 2, 'S') && L === 1) {
      const svar: Record<string, string> = {
        '2NT': 'ingen 4-korts lågfärg, båda högfärgerna stoppade',
        '3C': '4+ klöver',
        '3D': '4+ ruter, förnekar 4 klöver',
        '3H': 'stopp i hjärter (letar 3 sang)',
        '3S': 'stopp i spader (letar 3 sang)',
        '3NT': 'ingen 4-korts lågfärg, maximum, båda högfärgerna stoppade',
        '4C': '4+ klöver, maximum',
        '4D': '4+ ruter, maximum',
      }
      const key = `${cb.level}${cb.strain}`
      if (svar[key]) return R('MSS-svar', `${B(cb)} — svar på Minor Suit Stayman: ${svar[key]}.`)
    }
    if (same(r, 3, 'S') && L === 2) {
      return R('minorsvar', `${B(cb)} — svar på minorfrågan: ${cb.strain === 'NT' ? 'ingen 4-korts lågfärg' : `4+ ${name}`}.`)
    }
    if (r.level === 4 && (r.strain === 'D' || r.strain === 'H') && cb.level === 4 && cb.strain === (r.strain === 'D' ? 'H' : 'S')) {
      return R('fullföljd Texas', `${B(cb)} — fullföljer Texas-transfern; partnern visade 6+ ${name}, till spel.`)
    }
    if (same(r, L + 1, 'NT') && L === 1) {
      if (same(cb, 3, 'NT')) return R('accepterar inbjudan', `3 sang — accepterar inbjudan (16–17 hp).`)
    }
    if (r.level === 3 && r.strain !== 'NT' && L === 1) {
      if (same(cb, 3, 'NT')) return N(`3 sang — inget stöd för partnerns ${NAME[r.strain]}; till spel i sang.`, 'avslut')
      if (cb.strain === r.strain) return N(`${B(cb)} — höjer partnerns 6-korts ${name}${isGameLevel(cb) ? ', till spel' : ' — stöd, slamintresse'}.`, below(cb, 'utgangskrav'))
    }
    return null
  }

  if (m === 3 && !meOpener) {
    // Svararens andra bud.
    const mine = rel[1].cb
    const ans = rel[2].cb
    if (same(mine, L + 1, 'C')) {
      // Efter Stayman.
      if (ans.strain === 'D') {
        if (cb.level === L + 1 && isMajor(cb.strain) && L === 1) return R('inbjudan', `${B(cb)} — 5-korts ${name} (5-4 i högfärgerna), inbjudan (8–9 hp).`)
        if (cb.level === L + 1 && isMajor(cb.strain) && L === 2) return R('Smolen', `${B(cb)} — Smolen över 2 sang: 4 ${name} och 5 ${NAME[otherMajor(cb.strain)]}, utgångskrav. Partnern bjuder 4 ${NAME[otherMajor(cb.strain)]} med 3-korts stöd, annars 3 sang.`)
        if (cb.level === L + 2 && isMajor(cb.strain) && L === 1) return R('Smolen', `${B(cb)} — Smolen: 4 ${name} och 5 ${NAME[otherMajor(cb.strain)]}, utgångskrav. Partnern bjuder 4 ${NAME[otherMajor(cb.strain)]} med 3-korts stöd, annars 3 sang.`)
      }
      if (isMajor(ans.strain) && cb.strain === ans.strain) {
        if (isGameLevel(cb)) return R('till spel', `${B(cb)} — utgång i den hittade ${name}fiten.`)
        return R('inbjudan', `${B(cb)} — höjer partnerns ${name} till 3: inbjudan (4 stöd, 8–9 hp).`)
      }
      // 3 sang är alltid till spel — även över 2 sang, där L + 1 = 3 (annars lästes den som inbjudan).
      if (same(cb, 3, 'NT')) return R('3NT till spel', `3 sang — till spel: ingen högfärgsfit hittad.`)
      if (same(cb, L + 1, 'NT')) return R('inbjudan', `${B(cb)} — inbjudan utan högfärgsfit (8–9 hp).`)
      if (isMajor(cb.strain) && isGameLevel(cb)) return R('till spel', `${B(cb)} — utgång i ${name}.`)
    }
    if (same(mine, L + 1, 'D') || same(mine, L + 1, 'H')) {
      // Efter transfer + fullföljd (eller superaccept).
      const target = mine.strain === 'D' ? 'H' : 'S'
      if (cb.strain === target) {
        if (isGameLevel(cb)) return R('till spel', `${B(cb)} — 6+ ${name}, utgång till spel.`)
        return R('inbjudan', `${B(cb)} — 6+ ${name}, inbjudan till utgång.`)
      }
      // 3 sang före inbjudan: över 2 sang är L + 1 = 3, och 3 sang är till spel.
      if (same(cb, 3, 'NT')) return R('till spel', `3 sang — 5 ${NAME[target]}, balanserad utgångshand; partnern väljer 3 sang eller 4 ${NAME[target]}.`)
      if (same(cb, L + 1, 'NT')) return R('inbjudan', `${B(cb)} — 5 ${NAME[target]}, balanserad, inbjudan (8–9 hp). Partnern väljer sang eller ${NAME[target]}.`)
      if (same(cb, 2, 'S') && target === 'H' && L === 1) return R('inbjudan', `2♠ — 5 hjärter och 5 spader, inbjudan (8–9 hp).`)
      if (same(cb, 3, 'H') && target === 'S' && L === 1) return R('ny färg (GF)', `3♥ — 5 spader och 5 hjärter, utgångskrav: partnern väljer högfärg.`)
      if (cb.level === L + 2 && cb.strain !== 'NT' && cb.strain !== target) return R('ny färg (GF)', `${B(cb)} — 5+ ${NAME[target]} och 4+ ${name}, utgångskrav.`)
    }
    if (same(mine, 2, 'S') && L === 1) {
      if (same(cb, 3, 'NT')) return R('till spel', `3 sang — till spel efter Minor Suit Stayman.`)
      if (isMinor(cb.strain)) return N(`${B(cb)} — ${isGameLevel(cb) ? 'utgång i' : 'naturligt, sätter'} ${name} som trumf${isGameLevel(cb) ? '' : ' — utgångskrav'}.`, below(cb, 'utgangskrav'))
    }
    if (same(mine, 3, 'S') && L === 2) {
      if (same(cb, 3, 'NT')) return R('till spel', `3 sang — till spel efter minorfrågan.`)
      if (isMinor(cb.strain)) return N(`${B(cb)} — sätter ${name} som trumf, slamintresse.`, below(cb, 'slamintresse'))
    }
    if (mine.level === 3 && mine.strain !== 'NT' && L === 1 && (cb.strain === mine.strain || cb.strain === 'NT') && isGameLevel(cb)) {
      return R('till spel', `${B(cb)} — utgång till spel.`)
    }
    return null
  }

  if (m === 4 && meOpener) {
    const inv = rel[3].cb
    if (isGameLevel(cb)) return R('accepterar inbjudan', `${B(cb)} — accepterar partnerns inbjudan (mer än minimum).`)
    if (cb.strain === inv.strain || (isMajor(cb.strain) && cb.level === 3)) return R('preferens', `${B(cb)} — minimum: väljer ${name} som slutkontrakt (3-korts stöd). Ej krav.`)
    return null
  }

  if (m >= 5) {
    if (isGameLevel(cb)) return R('till spel', `${B(cb)} — placerar utgången.`)
  }
  return null
}

// ---- Stark 2♣ (§4.4) --------------------------------------------------------

function afterStrongTwoClubs(seat: Seat, cb: ParsedBid, u: Undisturbed): CallInterpretation | null {
  const b = u.bids
  const n = b.length
  const isOpener = seat === u.opener
  const name = NAME[cb.strain]

  if (n === 1 && !isOpener) {
    if (same(cb, 2, 'D')) return R('2♦ väntebud', `2♦ — väntebud på stark 2♣: 0–7 hp, konstgjort. Säger inget om ruter.`)
    if ((cb.level === 2 && isMajor(cb.strain)) || (cb.level === 3 && isMinor(cb.strain))) return R('2♣-positivt', `${B(cb)} — positivt svar på 2♣: 8+ hp med 5+ ${name}. Utgångskrav.`)
    if (same(cb, 2, 'NT')) return R('2♣-positivt', `2 sang — positivt svar på 2♣: 8+ hp, balanserad. Utgångskrav.`)
    return null
  }
  const waiting = same(b[1].cb, 2, 'D')
  if (n === 2 && isOpener) {
    if (waiting) {
      if (same(cb, 2, 'NT')) return R('rebid: 2NT (22–24)', `Återbud 2 sang efter 2♣–2♦: 22–24 hp balanserad. Ej krav — partnern passar med 0–2 hp, annars sangsystemet (Stayman/transfer).`)
      if (same(cb, 3, 'NT')) return R('rebid: 3NT (28–30)', `Återbud 3 sang efter 2♣–2♦: 28–30 hp balanserad.`)
      if (cb.strain !== 'NT') return R('rebid: krav-färg', `${B(cb)} — naturlig färg (5+) efter 2♣: krav 1 rond. Partnern letar utgång.`)
      return null
    }
    // Positivt svar → utgångskrav.
    const resp = b[1].cb
    if (resp.strain !== 'NT' && cb.strain === resp.strain) return R('rebid: stöd (GF)', `${B(cb)} — stöd i partnerns ${name}${isGameLevel(cb) ? ', minimum (snabb utgång)' : ' — trumfen satt, slamutredning kan följa'}.`, below(cb, 'utgangskrav'))
    if (same(cb, 3, 'NT')) return R('rebid: 3NT (GF)', `3 sang — balanserad efter positivt svar, ingen egen 5-färg. Utgångskravet står; partnern går vidare med slamintresse.`, below(cb, 'utgangskrav'))
    if (cb.strain === 'NT') return R('rebid: 2NT (GF)', `${B(cb)} — balanserad efter positivt svar. Utgångskravet står.`, below(cb, 'utgangskrav'))
    return R('rebid: ny färg (GF)', `${B(cb)} — naturlig färg (5+) efter positivt svar. Utgångskravet står.`, below(cb, 'utgangskrav'))
  }
  const secondNeg = secondNegativeIndex(u)
  if (n === 3 && !isOpener && waiting) {
    const reb = b[2].cb
    if (reb.strain !== 'NT' && isSecondNegative(reb, cb)) return R('andra negativa', `${B(cb)} — andra negativa: billigaste lågfärg = 0–3 hp, riktig bottenhand. Säger inget om ${name}. Öppnaren får stanna lågt.`)
    if (cb.strain === reb.strain) return R('höjning (GF)', `${B(cb)} — stöd i partnerns ${name}${isGameLevel(cb) ? ', minimum (snabb utgång)' : ', utgångskravet står'}.`, below(cb, 'utgangskrav'))
    if (cb.strain === 'NT') return isGameLevel(cb) ? R('3NT till spel', `3 sang — till spel, ingen fit.`) : R('ny färg (GF)', `${B(cb)} — naturlig sang efter kravfärgen, utgångskravet står.`, 'utgangskrav')
    return R('ny färg (GF)', `${B(cb)} — ny färg (5+, eller 4-korts högfärg under 3 sang) efter kravfärgen. Utgångskravet står.`, below(cb, 'utgangskrav'))
  }
  if (n >= 3) {
    if (secondNeg >= 0) {
      // Efter andra negativa: öppnaren får stanna lågt.
      const own = b[2].cb
      if (isOpener && cb.strain === own.strain && !isGameLevel(cb)) return R('rebid: egen färg', `${B(cb)} — rebjuder färgen lågt efter andra negativa: ej krav, partnern får passa.`)
      if (isGameLevel(cb)) return R('utgång', `${B(cb)} — utgång på egen hand.`)
      return N(`${B(cb)} — naturligt efter andra negativa.`, 'ej-krav')
    }
    // Utgångskravet står tills utgång.
    if (isGameLevel(cb)) return R('utgång', `${B(cb)} — utgång${cb.strain === 'NT' ? ' i sang' : ` i ${name}`}.`)
    // 2♣ är ingen klöverfärg och 2♦ ingen ruterfärg (§4.4) — bara äkta färger räknas.
    const äkta = b.filter((_, k) => !(k === 0) && !(k === 1 && waiting))
    const partnerSuits = new Set(äkta.filter((x) => x.seat === PARTNER[seat]).map((x) => x.cb.strain))
    const ownSuits = new Set(äkta.filter((x) => x.seat === seat).map((x) => x.cb.strain))
    if (cb.strain !== 'NT' && partnerSuits.has(cb.strain)) return R('höjning (GF)', `${B(cb)} — stöd i partnerns ${name}, utgångskravet står.`, 'utgangskrav')
    if (cb.strain !== 'NT' && ownSuits.has(cb.strain)) return R('rebid: egen färg (GF)', `${B(cb)} — rebjuder egen ${name} (6+), utgångskravet står.`, 'utgangskrav')
    if (cb.strain === 'NT') return R('rebid: 2NT (GF)', `${B(cb)} — naturlig sang, utgångskravet står.`, 'utgangskrav')
    return R('ny färg (GF)', `${B(cb)} — ny färg, naturligt. Utgångskravet står.`, 'utgangskrav')
  }
  return null
}

// ---- Efter 1♥ / 1♠ (§4.1, §5.1) ---------------------------------------------

function afterOneMajor(seat: Seat, cb: ParsedBid, u: Undisturbed, prior: ResolvedCall[]): CallInterpretation | null {
  const b = u.bids
  const n = b.length
  const M = b[0].cb.strain
  const msym = SYMBOL[M]
  const mname = NAME[M]
  const isOpener = seat === u.opener
  const name = NAME[cb.strain]

  if (n === 1 && !isOpener) {
    if (same(cb, 1, 'S') && M === 'H') return R('ny färg (1-läget)', `1♠ — 4+ spader, 6+ hp. Krav 1 rond.`)
    if (same(cb, 1, 'NT')) {
      return R('semi-forcing 1NT', `1 sang — semi-forcing: 6–11 hp, ingen 2-över-1 (kan dölja en 3-korts limithöjning). Öppnaren får passa bara med minimum balanserad hand.`)
    }
    if (cb.level === 2 && cb.strain !== 'NT' && cb.strain !== M && !rankAbove(cb.strain, M)) {
      if (u.responderPassed) {
        if (isMinor(cb.strain)) return R('Drury', `${B(cb)} — Drury (passad hand): limithöjning av ${mname} (~10–12 hp) med ${cb.strain === 'C' ? 'exakt 3' : '4+'} trumf. Säger inget om ${name}.`)
        return N(`${B(cb)} — naturligt, 5+ ${name}, passad hand: ej krav.`, 'ej-krav')
      }
      return R('2-över-1 GF', `${B(cb)} — 2-över-1: naturligt, 4+ (oftast 5+) ${name} och 12+ hp. Utgångskrav — ingen av er får passa under utgång.`)
    }
    if (same(cb, 2, M)) return R('enkel höjning', `${B(cb)} — enkel höjning av ${mname}: 3 stöd, 6–9 hp. Ej krav.`)
    if (same(cb, 2, 'NT')) {
      return u.responderPassed
        ? R('inbjudan', `2 sang — 11–12 hp balanserad, passad hand: inbjudan.`)
        : R('Jacoby 2NT', `2 sang — Jacoby 2NT: 4+ ${mname}, 13+ hp, balanserad (ingen kortfärg). Utgångskrav med slamintresse. Säger inget om sang.`)
    }
    if (same(cb, 3, 'C')) return R('Bergen konstruktiv', `3♣ — Bergen: 4 ${mname}, 7–9 hp (konstruktiv höjning). Säger inget om klöver. Inbjudan.`)
    if (same(cb, 3, 'D')) return R('Bergen limit', `3♦ — Bergen: 4 ${mname}, 10–12 hp (limithöjning). Säger inget om ruter. Inbjudan.`)
    if (same(cb, 3, M)) return R('Bergen spärr', `${B(cb)} — spärrhöjning: 4 trumf, 0–6 hp. Avslut.`)
    if (same(cb, 3, otherMajor(M))) return R('tvetydig splinter', `${B(cb)} — tvetydig splinter: 4+ ${mname}, 12+ hp och en kort färg (singel, ej A/K, eller renons) som partnern frågar efter med ett relä. Utgångskrav, slamintresse. Säger inget om ${name}.`)
    if (same(cb, 3, 'NT')) return R('3NT till spel', `3 sang — 13–15 hp balanserad med exakt 2 ${mname}, till spel.`)
    if (same(cb, 4, M)) return R('spärr till utgång', `${B(cb)} — spärr till utgång: 4+ stöd, högst ~10 hp. Avslut.`)
    return null
  }

  const resp = b[1].cb
  if (n === 2 && isOpener) {
    if (same(resp, 1, 'S') || same(resp, 1, 'NT') && u.responderPassed) return openerRebidAfterOneLevel(seat, cb, u)
    if (same(resp, 1, 'NT')) {
      // Efter semi-forcing 1NT (§5.1).
      if (same(cb, 2, M)) return R('rebid: egen färg', `${B(cb)} — 6+ ${mname}, minimum (12–15 hp). Ej krav.`)
      if (cb.level === 2 && cb.strain !== 'NT' && rankAbove(cb.strain, M)) return R('reverse', `${B(cb)} — reverse: 16+ hp, 5 ${mname} och 4 ${name}. Krav 1 rond.`)
      if (same(cb, 2, 'NT')) return R('rebid: 2NT (18–19)', `Återbud 2 sang — 18–19 hp balanserad, inbjuder 3 sang.`)
      if (cb.level === 3 && cb.strain !== 'NT' && cb.strain !== M) return R('rebid: hoppskift', `${B(cb)} — hoppskift: 16+ hp, 5 ${mname} och 4+ ${name}. Utgångskrav.`)
      if (same(cb, 3, M)) return R('hopp i egen färg (inbjudan)', `${B(cb)} — 6+ ${mname}, 16–18 hp. Inbjudan.`)
      if (same(cb, 4, M)) return R('rebid: utgång', `${B(cb)} — 6+ ${mname}, ~19+ hp. Till spel.`)
      if (same(cb, 3, 'NT')) return N(`3 sang — till spel.`, 'avslut')
      return null
    }
    if (resp.level === 2 && resp.strain !== 'NT' && resp.strain !== M && !rankAbove(resp.strain, M) && !u.responderPassed) return openerRebidAfter2over1(seat, cb, u)
    if (same(resp, 2, M)) {
      if (same(cb, 2, 'NT')) return R('Bergen game try', `2 sang — Bergen game try: konstgjort utgångsförsök (~15–17 hp), ber partnern beskriva handen. Krav. Säger inget om sang.`)
      if (same(cb, 3, M)) return N(`${B(cb)} — inbjudan till utgång i ${mname}.`, 'inbjudan')
      if (same(cb, 4, M)) return R('rebid: utgång', `${B(cb)} — utgång i ${mname}.`)
      if (cb.level === 3 && cb.strain !== 'NT') return N(`${B(cb)} — utgångsförsök: hjälpfärg/kortfärg i ${name}, inbjudan.`, 'inbjudan')
      if (same(cb, 3, 'NT')) return N(`3 sang — till spel.`, 'avslut')
      return null
    }
    if (same(resp, 2, 'NT') && !u.responderPassed) {
      // Öppnarens svar på Jacoby 2NT.
      if (cb.level === 3 && cb.strain !== 'NT' && cb.strain !== M) return R('Jacoby: kortfärg', `${B(cb)} — kort färg (singel/renons) i ${name} efter Jacoby 2NT. Utgångskravet står.`)
      if (same(cb, 3, M)) return R('Jacoby: slamintresse', `${B(cb)} — 16+ hp, slamintresse: frågar partnern vidare.`)
      if (same(cb, 3, 'NT')) return R('Jacoby: 3NT', `3 sang — 14–15 hp balanserad efter Jacoby 2NT. Partnern placerar utgången i ${mname}.`)
      if (cb.level === 4 && cb.strain !== 'NT' && cb.strain !== M) return R('Jacoby: sidofärg', `${B(cb)} — 5+ kort i ${name} (sidofärg med topphonnör) efter Jacoby 2NT.`)
      if (same(cb, 4, M)) return R('Jacoby: minimum', `${B(cb)} — minimum 12–14 balanserad, signoff i utgång.`)
      return null
    }
    if (same(resp, 2, 'NT') && u.responderPassed) {
      if (isGameLevel(cb)) return R('accepterar inbjudan', `${B(cb)} — accepterar inbjudan.`)
      if (same(cb, 3, M)) return N(`${B(cb)} — avböjer inbjudan, 6+ ${mname}.`, 'avslut')
      return null
    }
    if (resp.level === 3 && (resp.strain === 'C' || resp.strain === 'D')) {
      // Efter Bergen 3♣/3♦.
      if (same(cb, 3, M)) return R('rebid: stanna', `${B(cb)} — minimum, stannar i ${mname}. Partnern passar.`)
      if (same(cb, 4, M)) return R('rebid: utgång', `${B(cb)} — utgång i ${mname}.`)
      if (cb.level === 3 && cb.strain !== 'NT' && cb.strain !== M) return N(`${B(cb)} — utgångsförsök via ${name} efter Bergen-höjningen. Inbjudan.`, 'inbjudan')
      if (same(cb, 3, 'NT')) return N(`3 sang — till spel.`, 'avslut')
      return null
    }
    if (same(resp, 3, M)) {
      if (same(cb, 4, M)) return R('rebid: utgång', `${B(cb)} — utgång trots spärrhöjningen (~18+ hp).`)
      return null
    }
    if (same(resp, 3, otherMajor(M))) {
      // Öppnarens svar på tvetydig splinter: relä eller signoff.
      if ((M === 'H' && same(cb, 3, 'NT')) || (M === 'S' && same(cb, 3, 'S'))) return R('splinter-relä', `${B(cb)} — relä: frågar vilken färg partnern är kort i (splintern). Säger inget om ${cb.strain === 'NT' ? 'sang' : name}.`)
      if (same(cb, 4, M)) return R('rebid: signoff', `${B(cb)} — signoff i utgång: handen passar inte för slam.`)
      return null
    }
    if (same(resp, 3, 'NT')) {
      if (same(cb, 4, M)) return R('till spel', `${B(cb)} — väljer högfärgsutgången (5-korts ${mname} mot partnerns dubbelton).`)
      return null
    }
    if (u.responderPassed && resp.level === 2 && isMinor(resp.strain)) {
      // Öppnarens svar på Drury.
      if (same(cb, 2, M)) return R('Drury: lätt öppning', `${B(cb)} — lätt öppning, signoff. Partnern passar.`)
      if (same(cb, 4, M)) return R('Drury: riktig öppning', `${B(cb)} — riktig öppning, accepterar utgång.`)
      if (cb.level < 4) return R('Drury: utgångsförsök', `${B(cb)} — riktig öppning, visar värden/utgångsförsök.`)
      return null
    }
    return null
  }

  if (n === 3 && !isOpener) {
    const reb = b[2].cb
    if (same(resp, 1, 'S') || (same(resp, 1, 'NT') && u.responderPassed)) return responderSecondAfterOneLevel(seat, cb, u, prior)
    if (resp.level === 2 && resp.strain !== 'NT' && resp.strain !== M && !rankAbove(resp.strain, M) && !u.responderPassed) return responderSecondAfter2over1(seat, cb, u, prior)
    if (same(resp, 1, 'NT')) {
      // Svararens andra bud efter semi-forcing 1NT (§5.1).
      if (reb.level === 3 && reb.strain !== 'NT' && reb.strain !== M) {
        // Hoppskiftet: svararen placerar (GF).
        if (isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången efter hoppskiftet.`)
        return N(`${B(cb)} — naturligt efter hoppskiftet; utgångskravet står.`, 'utgangskrav')
      }
      if (same(reb, 2, 'NT')) {
        if (same(cb, 3, 'NT')) return R('3NT till spel', `3 sang — till spel mittemot 18–19.`)
        if (same(cb, 3, M)) return N(`${B(cb)} — 3-korts stöd, utgångskrav: partnern väljer 3 sang eller 4${msym}.`, 'utgangskrav')
        if (same(cb, 4, M)) return R('utgång', `${B(cb)} — utgång i ${mname} (3-korts stöd).`)
        return null
      }
      if (reb.level === 2 && reb.strain !== 'NT' && reb.strain !== M && rankAbove(reb.strain, M)) {
        // Efter öppnarens reverse (krav) svarar svararen i krav.
        if (isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången efter reversen.`)
        return R('krav-svar', `${B(cb)} — svar på partnerns reverse (16+): ${cb.strain === 'NT' ? 'balanserat, inget stöd' : cb.strain === M ? `preferens till ${mname}` : `${name}`}. Krav 1 rond.`)
      }
      if (same(cb, 2, M)) return R('preferens', `${B(cb)} — preferens till ${mname} (2–3 kort), svag hand. Ej krav.`)
      if (same(cb, 3, M)) return R('inbjudan (limithöjning)', `${B(cb)} — 3-korts limithöjning: 10–12 hp med stöd i ${mname}. Inbjudan.`)
      if (same(cb, 4, M)) return R('utgång', `${B(cb)} — utgång i ${mname}.`)
      if (same(cb, 2, 'NT')) return R('inbjudan', `2 sang — 11–12 hp balanserad, inbjudan.`)
      if (same(cb, 3, 'NT')) return R('3NT till spel', `3 sang — till spel.`)
      if (cb.strain === reb.strain && !isGameLevel(cb)) return R('inbjudan', `${B(cb)} — höjer partnerns ${name}: 11–12 hp med stöd, inbjudan.`)
      if (cb.strain === reb.strain) return R('utgång', `${B(cb)} — utgång i ${name}.`)
      // Svararens egen färg på 2-LÄGET läses av `responderNewSuitAfter1NT`
      // (före den här läsaren). En ny färg på 3-läget saknar regel i motorn
      // (standard: inbjudan med 6+ kort — fynd i motorbytets logg 2026-09-05).
      return null
    }
    if (same(resp, 2, M)) {
      if (same(reb, 2, 'NT')) {
        // Svar på Bergen game try (§4.1): beskriver handen, öppnaren placerar.
        if (same(cb, 3, M)) return N(`${B(cb)} — jämn hand, minimum (6–7 hp). Partnern placerar.`, 'ej-krav')
        if (same(cb, 3, 'NT')) return N(`3 sang — jämn hand, maximum (8–9 hp). Partnern placerar.`, 'avslut')
        if (same(cb, 4, M)) return N(`${B(cb)} — maximum (8–9 hp), ojämn hand.`, 'avslut')
        if (cb.level === 3 && cb.strain !== 'NT') return N(`${B(cb)} — singel/renons i ${name}, minimum (6–7 hp). Partnern placerar.`, 'ej-krav')
        return null
      }
      if (reb.level === 3 && reb.strain !== 'NT') {
        if (same(cb, 4, M)) return R('accepterar inbjudan', `${B(cb)} — accepterar utgångsförsöket.`)
        if (same(cb, 3, M)) return N(`${B(cb)} — avböjer utgångsförsöket.`, 'avslut')
        return null
      }
      return null
    }
    if (same(resp, 2, 'NT') && !u.responderPassed) {
      // Svararens fortsättning efter Jacoby 2NT + öppnarens beskrivning.
      if (same(cb, 4, M)) return R('utgång', `${B(cb)} — placerar utgången i ${mname}, inget slamintresse.`)
      if (cb.strain !== 'NT' && cb.strain !== M) return R('cue-bid', `Kontrollbud ${B(cb)} — första-rondskontroll (ess/renons) i ${name}, slamintresse mot ${mname}trumfen.`)
      if (same(cb, 3, M)) return N(`${B(cb)} — minimum för Jacoby 2NT, inget slamintresse; partnern placerar.`, 'utgangskrav')
      if (same(cb, 3, 'NT')) return N(`3 sang — förslag till spel i sang trots fiten.`, 'avslut')
      return null
    }
    if (resp.level === 3 && (resp.strain === 'C' || resp.strain === 'D')) {
      if (same(cb, 4, M)) return R('accepterar inbjudan', `${B(cb)} — accepterar utgångsförsöket efter Bergen.`)
      if (same(cb, 3, M)) return N(`${B(cb)} — avböjer utgångsförsöket, stannar.`, 'avslut')
      return null
    }
    if (same(resp, 3, otherMajor(M))) {
      // Kortfärgssvaren på reläet: motorn visar kortfärgen upp-the-line i stegen
      // 4♣/4♦/4♥ = de tre icke-trumffärgerna i rangordning (responder-rebids.ts;
      // boken §4.1 har en annan tabell för 1♠–3♥ — avvikelse noterad 2026-09-04).
      const short: Record<string, string> = M === 'H' ? { '4C': 'klöver', '4D': 'ruter', '4H': 'spader' } : { '4C': 'klöver', '4D': 'ruter', '4H': 'hjärter' }
      const key = `${cb.level}${cb.strain}`
      if (short[key]) return R('splinter: kortfärg', `${B(cb)} — svar på reläet: den korta färgen är ${short[key]}. Säger inget om ${cb.strain === 'NT' ? 'sang' : name}.`)
      return null
    }
    if (u.responderPassed && resp.level === 2 && isMinor(resp.strain)) {
      if (same(cb, 4, M)) return R('Drury: accepterar utgångsförsök', `${B(cb)} — accepterar utgångsförsöket.`, 'avslut')
      if (same(cb, 3, M)) return N(`${B(cb)} — avböjer, stannar under utgång.`, 'avslut')
      return null
    }
    return null
  }

  if (n === 4 && isOpener && (same(resp, 1, 'S') || (same(resp, 1, 'NT') && u.responderPassed))) return openerThirdAfterOneLevel(seat, cb, u, prior)
  if (n >= 4) return lateUndisturbed(seat, cb, u, prior)
  return null
}

// ---- Efter 1♣ / 1♦ (§4.2, §5.2) ---------------------------------------------

function afterOneMinor(seat: Seat, cb: ParsedBid, u: Undisturbed, prior: ResolvedCall[]): CallInterpretation | null {
  const b = u.bids
  const n = b.length
  const m = b[0].cb.strain
  const mname = NAME[m]
  const isOpener = seat === u.opener
  const name = NAME[cb.strain]

  if (n === 1 && !isOpener) {
    if (cb.level === 1 && cb.strain !== 'NT') return R('ny färg (1-läget)', `${B(cb)} — 4+ ${name}, 6+ hp. Krav 1 rond.`)
    if (same(cb, 1, 'NT')) return R('NT-svar', `1 sang — 6–10 hp balanserad, ingen 4-korts högfärg. Ej krav.`)
    // Motorn spelar den inverterade höjningen även med passad hand.
    if (same(cb, 2, m)) return R('inverterad minor', `${B(cb)} — inverterad höjning: 4+ ${mname}, 10+ hp, ingen 4-korts högfärg. Krav 1 rond — paret letar 3 sang.`)
    if (same(cb, 3, m)) return R('inverterad minor, svag', `${B(cb)} — svag spärrhöjning: 5+ ${mname}, 0–6 hp. Avslut.`)
    if (cb.level === 2 && isMinor(cb.strain) && cb.strain !== m) {
      return u.responderPassed
        ? N(`${B(cb)} — naturligt, 5+ ${name}, passad hand: ej krav.`, 'ej-krav')
        : R('2-över-1 GF', `${B(cb)} — 2-över-1: naturligt, 4+ (oftast 5+) ${name} och 12+ hp. Utgångskrav — ingen av er får passa under utgång.`)
    }
    if (same(cb, 2, 'NT')) return R('2NT inbjudan', `2 sang — 11–12 hp balanserad med stopp, ingen 4-korts högfärg. Inbjudan.`)
    if (same(cb, 3, 'NT')) return R('3NT till spel', `3 sang — 13–15 hp balanserad, till spel.`)
    return null
  }

  const resp = b[1].cb
  if (n === 2 && isOpener) {
    if (resp.level === 1) return openerRebidAfterOneLevel(seat, cb, u)
    if (same(resp, 2, m)) {
      // Öppnarens fortsättning efter inverterad höjning (§4.2).
      if (cb.strain !== 'NT' && cb.strain !== m && !isGameLevel(cb)) return R('inverterad: stopp-visning', `${B(cb)} — visar äkta stopp i ${name} (12+), letar 3 sang. Krav 1 rond. Säger inget om längd.`)
      if (same(cb, 2, 'NT')) return R('inverterad: 2NT', `2 sang — balanserad 12–14 hp, ingen utgångsiver. Ej krav.`)
      if (same(cb, 3, m)) return R('inverterad: minimum', `${B(cb)} — minimum 12–14 utan stopp att visa. Ej krav.`)
      if (same(cb, 3, 'NT')) return R('inverterad: 3NT', `3 sang — balanserad 18–19 hp, till spel.`)
      return null
    }
    if (same(resp, 3, m)) {
      if (isGameLevel(cb)) return R('utgång', `${B(cb)} — utgång trots den svaga höjningen.`)
      return null
    }
    if (resp.level === 2 && isMinor(resp.strain) && resp.strain !== m && !u.responderPassed) return openerRebidAfter2over1(seat, cb, u)
    if (same(resp, 2, 'NT')) {
      if (same(cb, 3, 'NT')) return R('accepterar inbjudan', `3 sang — accepterar inbjudan.`)
      if (same(cb, 3, m)) return N(`${B(cb)} — avböjer inbjudan, 6+ ${mname}.`, 'avslut')
      if (cb.strain !== 'NT' && !isGameLevel(cb)) return N(`${B(cb)} — naturligt, ${name}; letar bästa utgång.`, 'krav-1-rond')
      return null
    }
    return null
  }

  if (n === 3 && !isOpener) {
    if (resp.level === 1) return responderSecondAfterOneLevel(seat, cb, u, prior)
    if (same(resp, 2, m)) {
      if (same(cb, 3, m)) return R('inverterad: broms', `${B(cb)} — "bara minimum" (10–12) efter partnerns stopp-visning. Ej krav — partnern passar med 12–14, driver med 15+.`)
      if (same(cb, 3, 'NT')) return R('inverterad: 3NT', `3 sang — övriga sidofärger täckta, till spel.`)
      if (cb.strain !== 'NT' && cb.strain !== m && !isGameLevel(cb) && bidRank(cb) < bidRank({ level: 3, strain: 'NT' })) return R('inverterad: stopp-visning', `${B(cb)} — visar stopp i ${name}, letar 3 sang. Krav 1 rond.`)
      if (same(cb, 5, m)) return R('utgång', `${B(cb)} — lågfärgsutgång: stoppen räcker inte till 3 sang.`)
      if (same(cb, 4, m)) return N(`${B(cb)} — sätter ${mname} som trumf över 3 sang, slamintresse.`, 'slamintresse')
      return null
    }
    if (resp.level === 2 && isMinor(resp.strain) && resp.strain !== m && !u.responderPassed) return responderSecondAfter2over1(seat, cb, u, prior)
    return null
  }

  if (n === 4 && isOpener && resp.level === 1) return openerThirdAfterOneLevel(seat, cb, u, prior)
  if (n === 4 && isOpener && same(resp, 2, m)) {
    // Öppnarens andra bud efter den inverterade höjningen + svararens broms/stopp (§4.2).
    if (same(cb, 3, 'NT')) return R('inverterad: 3NT', `3 sang — sidofärgerna täckta, till spel.`)
    if (same(cb, 5, m)) return R('utgång', `${B(cb)} — lågfärgsutgång: stoppen räcker inte till 3 sang.`)
    if (cb.strain !== 'NT' && cb.strain !== m && bidRank(cb) < bidRank({ level: 3, strain: 'NT' })) return R('inverterad: stopp-visning', `${B(cb)} — andra stopp-visningen (15+): visar stopp i ${name}, letar 3 sang. Krav 1 rond.`)
    if (same(cb, 4, m)) return N(`${B(cb)} — sätter ${mname} som trumf över 3 sang, slamintresse.`, 'slamintresse')
  }
  if (n >= 4) return lateUndisturbed(seat, cb, u, prior)
  return null
}

// ---- Öppnarens återbud efter 1x–1y (§5.2) ----------------------------------

function openerRebidAfterOneLevel(_seat: Seat, cb: ParsedBid, u: Undisturbed): CallInterpretation | null {
  const open = u.bids[0].cb
  const resp = u.bids[1].cb
  const name = NAME[cb.strain]
  const oname = NAME[open.strain]
  const respSuit = resp.strain !== 'NT'

  if (respSuit && cb.strain === resp.strain) {
    if (isGameLevel(cb)) return R('rebid: utgång', `${B(cb)} — höjning till utgång: 4-korts stöd, ~19+ hp.`)
    if (cb.level === minLevelOver(resp, cb.strain)) return R('rebid: stöd', `${B(cb)} — höjning: 4-korts stöd i ${name}, minimum 12–15. Ej krav.`)
    return R('hopphöjning (inbjudan)', `${B(cb)} — hopphöjning: 4-korts stöd i ${name}, 16–18. Inbjudan.`)
  }
  if (cb.strain === open.strain) {
    if (isGameLevel(cb)) return R('rebid: utgång', `${B(cb)} — 6+ ${oname}, 19+ startpoäng. Till spel.`)
    if (cb.level === minLevelOver(resp, cb.strain)) return R('rebid: egen färg', `${B(cb)} — rebjuder ${oname}: 6+ kort, minimum 12–15. Ej krav.`)
    return R('hopp i egen färg (inbjudan)', `${B(cb)} — hopp i egen ${oname}: 6+ kort, 16+ startpoäng. Inbjudan.`)
  }
  if (cb.strain === 'NT') {
    if (cb.level === 1) return R('1NT (12–14)', `Återbud 1 sang — balanserad minimihand (12–14 hp; 15–17 hade öppnat 1 sang).`)
    if (cb.level === 2) return R('rebid: 2NT (18–19)', `Återbud 2 sang — 18–19 hp balanserad, inbjuder utgång.`)
    return R('rebid: 3NT', `3 sang — till spel (~18+ hp balanserad mot partnerns begränsade svar).`)
  }
  // Ny färg.
  const minL = minLevelOver(resp, cb.strain)
  if (cb.level > minL + 1) return N(`${B(cb)} — splinter: 4-korts stöd i partnerns ${respSuit ? NAME[resp.strain] : 'färg'}, kort ${name} och extra styrka. Utgångskrav.`, 'utgangskrav')
  if (cb.level > minL) return R('hoppskift', `${B(cb)} — hoppskift i ny färg: 19+ hp, 4+ ${name}. Utgångskrav.`)
  if (cb.level === 1) return R('ny färg (1-läget)', `${B(cb)} — ny färg billigt: 4+ ${name} (4-korts upp), 12+ hp. Krav 1 rond.`)
  if (rankAbove(cb.strain, open.strain)) return R('reverse', `${B(cb)} — reverse: 16+ hp, 4+ ${name} och längre ${oname}. Krav 1 rond.`)
  return R('ny färg (2-läget)', `${B(cb)} — ny lägre färg på 2-läget: 4+ ${name}, 12+ hp. Ej krav.`)
}

/** Öppnarens återbud efter partnerns 2-över-1 (§5.3): allt är utgångskrav. */
function openerRebidAfter2over1(_seat: Seat, cb: ParsedBid, u: Undisturbed): CallInterpretation | null {
  const open = u.bids[0].cb
  const resp = u.bids[1].cb
  const name = NAME[cb.strain]
  if (cb.strain === resp.strain) return R('rebid: stöd (GF)', `${B(cb)} — stöd i partnerns ${name}: fit${isGameLevel(cb) ? ', minimum (snabb utgång)' : ''}. ${isGameLevel(cb) ? '' : 'Utgångskravet står.'}`.trim(), below(cb, 'utgangskrav'))
  if (cb.strain === open.strain) return R('rebid: egen färg (GF)', `${B(cb)} — rebjuder egen ${name}: 6+ kort. Utgångskravet står.`, below(cb, 'utgangskrav'))
  if (same(cb, 2, 'NT')) return R('rebid: 2NT (GF)', `Återbud 2 sang efter partnerns 2-över-1 — balanserad hand utan extra form (~12–15 hp). Utgångskravet gäller: partnern får inte passa.`)
  if (same(cb, 3, 'NT')) return R('rebid: 3NT (GF)', `3 sang — balanserad, sidofärgerna täckta; till spel om partnern inte har slamintresse.`)
  if (cb.strain !== 'NT') {
    if (isJumpOver(resp, cb)) return R('splinter: kortfärg', `${B(cb)} — splinter: 4-korts stöd i partnerns ${NAME[resp.strain]}, kort ${name}, slamintresse.`)
    return R('rebid: ny färg (GF)', `${B(cb)} — naturlig ny färg (4+ ${name}), form först. Utgångskravet står.`)
  }
  return null
}

/** Svararens andra bud efter eget 2-över-1 (§5.3): allt under utgång är krav. */
function responderSecondAfter2over1(_seat: Seat, cb: ParsedBid, u: Undisturbed, _prior: ResolvedCall[]): CallInterpretation | null {
  const open = u.bids[0].cb
  const reb = u.bids[2].cb
  const name = NAME[cb.strain]
  if (isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången${cb.strain === 'NT' ? ' i sang' : ` i ${name}`}.`)
  if (cb.strain === open.strain) {
    // Försenat stöd är det BILLIGA 3m (felrapport #58); ett hopp till 4m är stöd i kravet, inget öppnaren har en beskrivning för.
    if (same(reb, 2, 'NT') && isMinor(open.strain) && cb.level === 3) return R('2/1: försenat stöd', `${B(cb)} — försenat stöd i ${name} med slamintresse: sätter trumf i utgångskravet.`)
    return R('2/1: fortsättning', `${B(cb)} — stöd i partnerns ${name}. Utgångskravet står.`, 'utgangskrav')
  }
  if (cb.strain === u.bids[1].cb.strain) return R('2/1: fortsättning', `${B(cb)} — rebjuder egen ${name} (6+). Utgångskravet står.`, 'utgangskrav')
  if (cb.strain === reb.strain && reb.strain !== 'NT') return R('2/1: fortsättning', `${B(cb)} — stöd i partnerns ${name}. Utgångskravet står.`, 'utgangskrav')
  if (cb.strain === 'NT') return R('2/1: fortsättning', `${B(cb)} — naturlig sang, balanserad. Utgångskravet står.`, 'utgangskrav')
  if (isFourthSuit(u, cb)) return R('fjärde färg krav', `${B(cb)} — fjärde färg: konstgjort, ber partnern beskriva (stopp för 3 sang / gömd fit). Utgångskrav. Säger inget om ${name}.`)
  return R('2/1: fortsättning', `${B(cb)} — ny färg, naturligt (4+ ${name}). Utgångskravet står.`, 'utgangskrav')
}

// ---- Svararens andra bud efter 1x–1y–z (§5.2, §5.7, §6.6) -------------------

function responderSecondAfterOneLevel(_seat: Seat, cb: ParsedBid, u: Undisturbed, _prior: ResolvedCall[]): CallInterpretation | null {
  const [open, resp, reb] = u.bids.map((x) => x.cb)
  const name = NAME[cb.strain]
  const raised = resp.strain !== 'NT' && reb.strain === resp.strain
  const reverse = !raised && reb.level === 2 && reb.strain !== 'NT' && reb.strain !== open.strain && rankAbove(reb.strain, open.strain)
  const jumpShift = !raised && reb.strain !== 'NT' && reb.strain !== open.strain && isJumpOver(resp, reb)

  // Slamport efter reversen (§5): hopphöjning till 4m i öppnarens andra färg = slaminbjudan.
  if (reverse && cb.level === 4 && isMinor(cb.strain) && cb.strain === reb.strain) {
    return R('slaminbjudan', `${B(cb)} — hopphöjning av ${name} efter reversen: slaminbjudan (31–32 mot visade 16). Partnern accepterar med extra.`)
  }
  if (isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången${cb.strain === 'NT' ? ' i sang' : ` i ${name}`}.`)
  if (jumpShift) return N(`${B(cb)} — naturligt efter hoppskiftet; utgångskravet står.`, 'utgangskrav')
  if (isNMF(u, cb)) return R('New Minor Forcing', `${B(cb)} — New Minor Forcing: konstgjort, krav. Frågar efter 3-korts stöd i min högfärg eller en dold 4-korts högfärg. Säger inget om ${name}.`)
  if (isFourthSuit(u, cb)) return R('fjärde färg krav', `${B(cb)} — fjärde färg: konstgjort, ber partnern beskriva (stopp för 3 sang / gömd fit). Utgångskrav. Säger inget om ${name}.`)
  if (cb.strain === 'NT') {
    if (cb.level === 2) return R('inbjudan', `2 sang — 11–12 hp balanserad, inbjudan.`)
    return null
  }
  if (raised) {
    // Öppnaren höjde min färg (1x–1y–2y).
    if (cb.strain === resp.strain) return R('inbjudan', `${B(cb)} — höjer vidare efter partnerns höjning: inbjudan till utgång (10–12 stödpoäng).`)
    return N(`${B(cb)} — ny färg efter partnerns höjning: utgångsförsök som visar värden i ${name}. Krav.`, 'krav-1-rond')
  }
  if (reb.strain !== 'NT' && cb.strain === reb.strain && reb.strain !== open.strain) {
    // Höjning av öppnarens andra färg (§6.6-stegen). Motorn spelar den billigaste
    // höjningen som ej krav även efter en reverse (boken säger krav — noterat 2026-09-04).
    if (cb.level === minLevelOver(reb, cb.strain)) return R('höjning', `${B(cb)} — höjer partnerns ${name}: 4+ stöd, under 10 stödpoäng. Ej krav.`)
    return R('hopphöjning (inbjudan)', `${B(cb)} — hopphöjning av partnerns ${name}: 4+ stöd, 10–12 stödpoäng. Inbjudan.`)
  }
  if (cb.strain === open.strain) {
    if (cb.level === minLevelOver(reb, cb.strain)) return R('preferens', `${B(cb)} — preferens till partnerns ${name} (oftast 2–3 kort), svag hand. Ej krav.`)
    return R('inbjudan (limithöjning)', `${B(cb)} — hopp till ${name}: stöd och inbjudan (10–12).`)
  }
  if (cb.strain === resp.strain) {
    if (cb.level === minLevelOver(reb, cb.strain)) return R('rebjuden färg', `${B(cb)} — rebjuder ${name}: 6+ kort, högst ~10 hp. Öppnaren får passa.`)
    return R('rebjuden färg (inbjudan)', `${B(cb)} — hoppinvit i egen ${name}: 6+ kort, 11–12 hp. Inbjudan.`)
  }
  // Ny färg (ej fjärde färg / NMF).
  if (isJumpOver(reb, cb)) return R('hoppskift', `${B(cb)} — hoppskift av svararen: 5+ ${name}, utgångskrav.`)
  return R('ny färg (krav)', `${B(cb)} — ny färg av svararen: naturligt, 4+ ${name}. Krav 1 rond.`)
}

/** Öppnarens tredje bud efter 1x–1y–z–w. */
function openerThirdAfterOneLevel(_seat: Seat, cb: ParsedBid, u: Undisturbed, _prior: ResolvedCall[]): CallInterpretation | null {
  const [open, resp, reb, w] = u.bids.map((x) => x.cb)
  const name = NAME[cb.strain]
  if (isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången${cb.strain === 'NT' ? ' i sang' : ` i ${name}`}.`)
  if (isNMF(u, w)) {
    if (cb.strain === resp.strain) return R('svar på New Minor Forcing', `${B(cb)} — svar på NMF: 3-korts stöd i partnerns ${name}${cb.level === 2 ? ' (minimum)' : ' (maximum)'}.`, 'ej-krav')
    if (cb.strain === 'NT') return R('svar på New Minor Forcing', `${B(cb)} — svar på NMF: stopp i den objudna färgen, inget stöd${cb.level === 2 ? ' (minimum)' : ' (maximum)'}.`, 'ej-krav')
    if (cb.strain === w.strain) return R('svar på New Minor Forcing', `${B(cb)} — svar på NMF: 4 kort i ${name}.`, 'ej-krav')
    if (cb.strain === open.strain) return R('svar på New Minor Forcing', `${B(cb)} — svar på NMF: inget av det efterfrågade, rebjuder egen ${name}.`, 'ej-krav')
    return R('svar på New Minor Forcing', `${B(cb)} — svar på NMF: 4-korts ${name} (jagar 4-4).`, 'ej-krav')
  }
  if (isFourthSuit(u, w)) {
    if (cb.strain === resp.strain) return R('svar på fjärde färg', `${B(cb)} — svar på fjärde färg: 3-korts stöd i partnerns ${name}. Utgångskravet står.`, 'utgangskrav')
    if (cb.strain === 'NT') return R('svar på fjärde färg', `${B(cb)} — svar på fjärde färg: stopp i ${NAME[w.strain]}.`, below(cb, 'utgangskrav'))
    return R('svar på fjärde färg', `${B(cb)} — svar på fjärde färg: ${cb.strain === w.strain ? `4 kort i ${name}` : `extra längd i ${name}`}. Utgångskravet står.`, 'utgangskrav')
  }
  const invite = same(w, 2, 'NT') || (w.strain !== 'NT' && isJumpOver(reb, w) && (w.strain === reb.strain || w.strain === open.strain || w.strain === resp.strain))
  if (invite) return R('rebid: stanna', `${B(cb)} — avböjer inbjudan, stannar under utgång.`)
  if (w.strain !== 'NT' && w.strain !== open.strain && w.strain !== resp.strain && w.strain !== reb.strain) {
    // Svararens nya färg (krav 1 rond) — öppnaren beskriver.
    return N(`${B(cb)} — beskriver handen efter partnerns nya färg${cb.strain === 'NT' ? ' (stopp i den objudna färgen)' : ` (${name})`}.`, 'ej-krav')
  }
  if (w.strain === open.strain && w.level === minLevelOver(reb, w.strain)) {
    return N(`${B(cb)} — fortsätter efter partnerns preferens: extra styrka, inbjudan.`, 'inbjudan')
  }
  return N(`${B(cb)} — naturlig fortsättning.`, 'ej-krav')
}

/** Sena bud (n ≥ 4) i ostörda auktioner utanför de namngivna sekvenserna. */
function lateUndisturbed(seat: Seat, cb: ParsedBid, u: Undisturbed, prior: ResolvedCall[]): CallInterpretation | null {
  const name = NAME[cb.strain]
  if (isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången${cb.strain === 'NT' ? ' i sang' : ` i ${name}`}.`)
  if (gameForced(u, seat, prior)) return N(`${B(cb)} — naturligt; utgångskravet står.`, 'utgangskrav')
  const last = u.bids[u.bids.length - 1].cb
  const partnerInvited = same(last, 2, 'NT') || (u.bids.length >= 2 && last.strain !== 'NT' && isJumpOver(u.bids[u.bids.length - 2].cb, last))
  if (partnerInvited) return R('rebid: stanna', `${B(cb)} — avböjer inbjudan, stannar under utgång.`)
  return null
}

// ---- Svaga tvåor (§4.5) och spärrar (§4.6) ---------------------------------

function afterWeakTwo(seat: Seat, cb: ParsedBid, u: Undisturbed): CallInterpretation | null {
  const b = u.bids
  const n = b.length
  const W = b[0].cb.strain
  const wname = NAME[W]
  const isOpener = seat === u.opener
  const name = NAME[cb.strain]
  if (n === 1 && !isOpener) {
    if (same(cb, 2, 'NT')) return R('Ogust', `2 sang — Ogust: konstgjord fråga om styrka och färgkvalitet (svar 3♣ = min/dålig, 3♦ = min/bra, 3♥ = max/dålig, 3♠ = max/bra, 3NT = max/utmärkt). Krav. Säger inget om sang.`)
    if (cb.strain === W) return isGameLevel(cb) ? R('spärr till utgång', `${B(cb)} — höjer spärren till utgång: stöd, till spel (tvetydig för motståndarna).`) : R('spärrhöjning', `${B(cb)} — spärrhöjning: stöd, höjer trycket. Ej inbjudan, avslut.`)
    if (same(cb, 4, 'NT')) return R('1430 RKC', `4 sang — essfråga (1430 RKC) med ${wname} som trumf. Partnern svarar i steg: 5♣ = 1/4 nyckelkort, 5♦ = 0/3, 5♥ = 2 utan trumfdam, 5♠ = 2 med.`)
    if (same(cb, 3, 'NT')) return R('3NT till spel', `3 sang — till spel, räknar med 9 stick.`)
    if (cb.strain !== 'NT' && !isGameLevel(cb)) return R('ny färg (krav)', `${B(cb)} — naturligt, 5+ ${name}. Krav 1 rond.`)
    if (isGameLevel(cb)) return N(`${B(cb)} — till spel i ${name}.`, 'avslut')
    return null
  }
  const resp = b[1].cb
  if (n === 2 && isOpener) {
    if (same(resp, 2, 'NT')) {
      const svar: Record<string, [string, string]> = {
        '3C': ['Ogust: min/dålig', 'minimum (6–8 hp), dålig färg (1 topphonnör)'],
        '3D': ['Ogust: min/bra', 'minimum (6–8 hp), bra färg (2 topphonnörer)'],
        '3H': ['Ogust: max/dålig', 'maximum (9–11 hp), dålig färg (1 topphonnör)'],
        '3S': ['Ogust: max/bra', 'maximum (9–11 hp), bra färg (2 topphonnörer)'],
        '3NT': ['Ogust: max/utmärkt', 'maximum (9–11 hp), utmärkt färg (alla tre topphonnörerna)'],
      }
      const s = svar[`${cb.level}${cb.strain}`]
      if (s) return R(s[0], `${B(cb)} — svar på Ogust: ${s[1]}. Säger inget om ${cb.strain === 'NT' ? 'sang' : name}.`)
      return null
    }
    if (resp.strain !== 'NT' && resp.strain !== W && !isGameLevel(resp)) {
      if (cb.strain === resp.strain) return R('rebid: stöd', `${B(cb)} — stöd i partnerns ${name}.`, below(cb, 'ej-krav'))
      if (cb.strain === W) return R('rebid: egen färg', `${B(cb)} — rebjuder ${wname}: minimum, ingen fit. Ej krav.`)
      if (cb.strain === 'NT') return N(`${B(cb)} — sang: stopp och maximum.`, below(cb, 'ej-krav'))
      return R('rebid: feature', `${B(cb)} — feature: sidohonnör i ${name}, maximum. Ej krav.`)
    }
    return null
  }
  if (n === 3 && !isOpener) {
    if (isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången${cb.strain === 'NT' ? ' i sang' : ` i ${name}`}.`)
    return R('svararens signoff', `${B(cb)} — signoff: ingen utgång, stannar i ${name}.`)
  }
  if (n >= 4 && isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången.`)
  return null
}

function afterPreempt(seat: Seat, cb: ParsedBid, u: Undisturbed): CallInterpretation | null {
  const b = u.bids
  const n = b.length
  const P = b[0].cb.strain
  const isOpener = seat === u.opener
  const name = NAME[cb.strain]
  if (n === 1 && !isOpener) {
    if (cb.strain === P) return isGameLevel(cb) ? R('höjning till utgång', `${B(cb)} — höjer spärren till utgång: stöd, till spel.`) : R('spärrhöjning', `${B(cb)} — spärrhöjning: höjer trycket. Avslut.`)
    if (same(cb, 4, 'NT')) return R('1430 RKC', `4 sang — essfråga (1430 RKC) med ${NAME[P]} som trumf: stor fit-hand mot spärren. Partnern svarar i steg: 5♣ = 1/4 nyckelkort, 5♦ = 0/3, 5♥ = 2 utan trumfdam, 5♠ = 2 med.`)
    if (same(cb, 3, 'NT')) return N(`3 sang — till spel: stopp i sidofärgerna, räknar med 9 stick.`, 'avslut')
    if (cb.strain !== 'NT' && !isGameLevel(cb)) return R('ny färg (krav)', `${B(cb)} — naturligt, 5+ ${name}. Krav 1 rond.`)
    if (isGameLevel(cb)) return N(`${B(cb)} — till spel i ${name}.`, 'avslut')
    return null
  }
  const resp = b[1].cb
  if (n === 2 && isOpener && resp.strain !== 'NT' && resp.strain !== P) {
    if (cb.strain === resp.strain) return R('rebid: stöd', `${B(cb)} — stöd i partnerns ${name}.`, below(cb, 'ej-krav'))
    if (cb.strain === P) return R('rebid: egen färg', `${B(cb)} — rebjuder spärrfärgen: minimum, ingen fit. Ej krav.`)
    if (cb.strain === 'NT') return N(`${B(cb)} — sang: maximum med stopp.`, below(cb, 'ej-krav'))
    return R('rebid: feature', `${B(cb)} — feature: sidohonnör i ${name}, maximum. Ej krav.`)
  }
  if (n >= 3 && !isOpener) {
    if (isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången.`)
    return R('svararens signoff', `${B(cb)} — signoff under utgång.`)
  }
  if (n >= 3 && isGameLevel(cb)) return R('utgång', `${B(cb)} — placerar utgången.`)
  return null
}

/** Sista utväg: gör regelnamnet läsbart om budet saknar egen förklaringstext. */
function describeRule(rule: string): string {
  return `${rule.charAt(0).toUpperCase()}${rule.slice(1)}.`
}
