// Tolkningslagret (pivot mot en TOLKANDE budmotor, steg 1).
//
// Skillnaden mot resten av motorn: de andra filerna är GENERATIVA (hand → bud
// längs en kanonisk systemlinje). Den här filen är TOLKANDE (bud + historik →
// vad budet betyder). Den läser bara – den väljer inga bud och ändrar inget i
// appen. Därför kan den inte orsaka regressioner.
//
// Kärnlöftet: `interpretCall` ger ALLTID en förklaring – aldrig tomt, aldrig
// "utanför systemlinjen". När motorn själv satt en `rule` på budet används den
// (säker tolkning). Saknas regel (t.ex. ett eget off-book-bud) härleds en
// bästa-möjliga tolkning ur buden runt bordet, med ärlig säkerhetsgradering.
//
// GRÄNS (R2-fynd #2, håll denna): heuristiken nedan (interpretContractBid m.fl.)
// är en SEPARAT, förenklad läsning av budbetydelsen och gäller BARA bud UTAN
// motor-regel – i praktiken människans egna off-book-bud. Bottarnas bud bär alltid
// en `rule` och tolkas via gren (1) ovan, dvs. ur motorn. Följd: när en NY
// konvention läggs till lär sig motorn den automatiskt, men heuristiken här måste
// läras samma konvention SEPARAT – annars glider förklaringen av ett mänskligt bud
// isär från vad motorn faktiskt menar. Skyddsnät: `auction-interpret.test.ts`
// vaktar att ett bud MED regel alltid tolkas ur regeln (säker + samma kravnivå).

import type { Bid, Forcing, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { ruleInfo } from './rules'

/** Hur säker tolkningen är. Visas för användaren så hen vet hur mycket att lita på. */
export type Confidence = 'säker' | 'trolig' | 'gissning'

export interface CallInterpretation {
  /** Förklaringstext – ALLTID ifylld. */
  text: string
  confidence: Confidence
  /** Kravnivå om den går att härleda (annars utelämnad). */
  forcing?: Forcing
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
  return partnerContracts.length === 1
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
export function interpretCall(history: ResolvedCall[], index: number): CallInterpretation {
  const call = history[index]
  const prior = history.slice(0, index)

  // (1) Motorn satte en regel → använd dess förklaring + kravnivå (säker).
  if (call.rule) {
    const info = ruleInfo(call.rule)
    const text = call.explanation?.trim() || describeRule(call.rule)
    return { text, confidence: 'säker', forcing: info.forcing }
  }

  // (2) Heuristik utifrån budtyp.
  if (call.bid === 'P') return interpretPass(call.seat, prior)
  if (call.bid === 'X') return interpretDouble(call.seat, prior)
  if (call.bid === 'XX') return interpretRedouble(call.seat, prior)

  const cb = parseBid(call.bid)
  if (!cb) return { text: 'Bud utan känd betydelse.', confidence: 'gissning' }
  return interpretContractBid(call.seat, cb, prior)
}

/** Tolka det SENASTE budet i historiken (vanligaste anropet). */
export function interpretLastCall(history: ResolvedCall[]): CallInterpretation | null {
  if (history.length === 0) return null
  return interpretCall(history, history.length - 1)
}

function interpretContractBid(seat: Seat, cb: ParsedBid, prior: ResolvedCall[]): CallInterpretation {
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
      return { text: `Öppningsbud ${cb.level} sang — balanserad hand, ${range}.`, confidence: 'trolig' }
    }
    if (cb.level === 1) {
      const minLen = cb.strain === 'H' || cb.strain === 'S' ? '5+' : '3+'
      return {
        text: `Öppningsbud 1${sym} — visar en öppningshand (12+ hp) med ${minLen} ${name}.`,
        confidence: 'trolig',
      }
    }
    if (cb.level === 2 && cb.strain === 'C') {
      return {
        text: `Öppningsbud 2♣ — stark, konstgjord öppning (22+ hp eller ~8½+ spelstick), krav. Säger inget om klöver.`,
        confidence: 'trolig',
        forcing: 'utgangskrav',
      }
    }
    if (cb.level === 2) {
      return {
        text: `Öppningsbud 2${sym} — svag tvåöppning: 6–11 hp med en 6-korts ${name}.`,
        confidence: 'trolig',
      }
    }
    if (cb.level === 3) {
      return {
        text: `Öppningsbud 3${sym} — spärröppning: svag hand (under öppningsstyrka) med 7-korts ${name}.`,
        confidence: 'trolig',
      }
    }
    if (cb.level === 4 && (cb.strain === 'H' || cb.strain === 'S')) {
      return {
        text: `Öppningsbud 4${sym} — spärr till utgång: svag hand med lång ${name} (8+ kort, ~7+ spelstick).`,
        confidence: 'trolig',
        forcing: 'avslut',
      }
    }
    return {
      text: `Öppningsbud ${cb.level}${sym} — spärröppning: svag hand med mycket lång ${name} (8+ kort).`,
      confidence: 'trolig',
    }
  }

  // Direkt cue i motståndarnas öppningsfärg, innan vår sida bjudit = Michaels
  // (tvåfärgshand). Kan inte vara stöd – vi har ju inte bjudit något ännu.
  if (cb.strain !== 'NT' && isCueOfOpponentSuit(seat, cb.strain, prior) && !ownSideHasBid(seat, prior)) {
    const open = opening(prior)!
    return {
      text: `Michaels cue-bud (${cb.level}${sym}) — tvåfärgshand: ${michaelsPhrase(open.cb.strain)}, oftast 5–5.`,
      confidence: 'trolig',
    }
  }

  // Systems on över partnerns naturliga 1NT (öppning ELLER inkliv): på 2-läget
  // är klöver/ruter/hjärter/spader KONVENTION, inte naturliga färger (felrapport
  // #53 + systems-on-bygget). 2♣ = Stayman, 2♦/2♥ = Jacoby-transfer, 2♠ = Minor
  // Suit Stayman. Betydelsen läses ur budet, aldrig ur handen.
  if (cb.level === 2 && partnerNaturalNT(seat, prior)) {
    if (cb.strain === 'C') {
      return {
        text:
          `2♣ — Stayman: frågar efter partnerns 4-korts högfärg (svar 2♦ = ingen, ` +
          `2♥/2♠ = den högfärgen). Säger inget om klöver.`,
        confidence: 'trolig',
        forcing: 'krav-1-rond',
      }
    }
    if (cb.strain === 'D' || cb.strain === 'H') {
      const target = cb.strain === 'D' ? 'hjärter' : 'spader'
      return {
        text: `2${sym} — Jacoby-transfer: visar 5+ ${target}, partnern bjuder ${target} (säger inget om ${name}).`,
        confidence: 'trolig',
        forcing: 'krav-1-rond',
      }
    }
    if (cb.strain === 'S') {
      return {
        text: `2♠ — Minor Suit Stayman: 5-4+ i lågfärgerna utan högfärg, utgångs-/slamintresse (säger inget om spader).`,
        confidence: 'trolig',
        forcing: 'krav-1-rond',
      }
    }
  }

  // Sangöppnarens/-inklivarens SVAR på partnerns konvention (felrapport #57:
  // 2♦ på Stayman lästes som "naturligt, minst 4 ruter"). Svaret på Stayman är
  // konvention (§4.3); fullföljd transfer lovar inget om egen längd.
  const conv = partnerNTConventionToAnswer(seat, prior)
  if (conv === 'C' && cb.level === 2) {
    if (cb.strain === 'D') {
      return { text: `2♦ — svar på Stayman: ingen 4-korts högfärg. Säger inget om ruter.`, confidence: 'trolig' }
    }
    if (cb.strain === 'H') {
      return { text: `2♥ — svar på Stayman: 4 hjärter (kan ha 4 spader också).`, confidence: 'trolig' }
    }
    if (cb.strain === 'S') {
      return { text: `2♠ — svar på Stayman: 4 spader, förnekar 4 hjärter.`, confidence: 'trolig' }
    }
  }
  if ((conv === 'D' && cb.strain === 'H') || (conv === 'H' && cb.strain === 'S')) {
    if (cb.level === 2) {
      return {
        text: `2${sym} — fullföljer partnerns Jacoby-transfer (partnern visade 5+ ${name}). Säger inget om egen längd i ${name}.`,
        confidence: 'trolig',
      }
    }
    if (cb.level === 3) {
      return {
        text: `3${sym} — superaccept av transfern: 4-korts ${name} och maximum, inbjuder utgång.`,
        confidence: 'trolig',
        forcing: 'inbjudan',
      }
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
        return {
          text: `3♣ — checkback efter partnerns 2NT-återbud (18–19 balanserad): frågar efter en dold 4-korts ${NAME[otherMajor]} eller 3-korts stöd i din ${NAME[twoNT.responderMajor]} (5+). Konstgjort — säger inget om klöver.`,
          confidence: 'trolig',
          forcing: 'krav-1-rond',
        }
      }
      if (cb.level === 3 && cb.strain === twoNT.responderMajor) {
        return {
          text: `3${sym} — visar en 5-korts ${name} och söker partnerns dolda 3-korts stöd (5-3-fit). Partnern höjer 4${sym} med stöd, annars 3NT.`,
          confidence: 'trolig',
          forcing: 'krav-1-rond',
        }
      }
      if (cb.level === 3 && cb.strain === 'NT') {
        return { text: `3NT — till spel mittemot 18–19 balanserad; ingen högfärgsfit att jaga.`, confidence: 'trolig', forcing: 'avslut' }
      }
    }

    // Steg 2 – öppnarens svar på 3♣-checkbacken (sista budet före = 3♣).
    if (n === 4 && seat === twoNT.opener && last.level === 3 && last.strain === 'C') {
      if (cb.level === 3 && cb.strain === otherMajor) {
        return { text: `3${sym} — svar på checkbacken: visar din dolda 4-korts ${name} (4-4-fit).`, confidence: 'trolig' }
      }
      if (cb.level === 3 && cb.strain === twoNT.responderMajor) {
        return { text: `3${sym} — svar på checkbacken: 3-korts stöd i partnerns ${name} (5-3-fit).`, confidence: 'trolig' }
      }
      if (cb.level === 3 && cb.strain === 'NT') {
        return { text: `3NT — svar på checkbacken: varken dold 4-korts ${NAME[otherMajor]} eller 3-stöd i ${NAME[twoNT.responderMajor]}.`, confidence: 'trolig', forcing: 'avslut' }
      }
    }

    // Steg 2b – öппnarens svar på svararens direkta 3M (5-3-jakt).
    if (n === 4 && seat === twoNT.opener && last.level === 3 && last.strain === twoNT.responderMajor) {
      if (cb.level === 4 && cb.strain === twoNT.responderMajor) {
        return { text: `4${sym} — höjer partnerns 5-korts ${name} med 3-korts stöd (5-3-fit, till spel).`, confidence: 'trolig', forcing: 'avslut' }
      }
      if (cb.level === 3 && cb.strain === 'NT') {
        return { text: `3NT — bara 2-korts ${NAME[twoNT.responderMajor]}, ingen 5-3-fit → till spel i sang.`, confidence: 'trolig', forcing: 'avslut' }
      }
    }

    // Steg 3 – svararen placerar den hittade högfärgsfiten (4♥/4♠).
    if (n === 5 && seat === twoNT.responder && cb.level === 4 && cb.strain !== 'NT') {
      return { text: `Utgång 4${sym} — placerar den högfärgsfit checkbacken hittade.`, confidence: 'trolig', forcing: 'avslut' }
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
    return {
      text: `Kontrollbud (${cb.level}${sym}) — ${NAME[majorFit]} är redan trumf (8-korts fit), så ${cb.level}${sym} visar första-rondskontroll (ess eller renons) i ${name} och slamintresse. Partnern cue:ar tillbaka en egen kontroll eller stannar i 4${SYMBOL[majorFit]}.`,
      confidence: 'trolig',
      forcing: 'krav-1-rond',
    }
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
        return {
          text:
            `4 sang — essfråga (1430 RKC) med ${NAME[trump]} som trumf. ` +
            `Partnern svarar i steg: 5♣ = 1/4 nyckelkort, 5♦ = 0/3, 5♥ = 2 utan trumfdam, 5♠ = 2 med.`,
          confidence: 'trolig',
          forcing: 'krav-1-rond',
        }
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

/** Sista utväg: gör regelnamnet läsbart om budet saknar egen förklaringstext. */
function describeRule(rule: string): string {
  return `${rule.charAt(0).toUpperCase()}${rule.slice(1)}.`
}
