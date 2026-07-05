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

/** Senaste kontraktsbudet före `prior`s slut (för pass/dubbel-texter). */
function lastContract(prior: ResolvedCall[]): { seat: Seat; cb: ParsedBid } | null {
  for (let i = prior.length - 1; i >= 0; i--) {
    const cb = parseBid(prior[i].bid)
    if (cb) return { seat: prior[i].seat, cb }
  }
  return null
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

  // Öppningsbud (inget kontraktsbud före)?
  if (!opening(prior)) {
    if (cb.strain === 'NT') {
      const range = cb.level === 1 ? '15–17 hp' : cb.level === 2 ? '20–21 hp' : 'stark balanserad hand'
      return { text: `Öppningsbud ${cb.level} sang — balanserad hand, ${range}.`, confidence: 'trolig' }
    }
    return {
      text: `Öppningsbud ${cb.level}${sym} — visar en öppningshand med ${name}.`,
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

function interpretDouble(seat: Seat, prior: ResolvedCall[]): CallInterpretation {
  const last = lastContract(prior)
  const ownHasBid = prior.some((c) => SIDE[c.seat] === SIDE[seat] && parseBid(c.bid))
  if (last && !ownHasBid && last.cb.level <= 2) {
    return {
      text: 'Dubbelt — upplysningsdubbling: ber partnern välja färg (kort i den dubblade färgen, stöd för de övriga).',
      confidence: 'trolig',
      forcing: 'krav-1-rond',
    }
  }
  return {
    text: 'Dubbelt — straffdubbling: du tror motståndarnas kontrakt går bet.',
    confidence: 'gissning',
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
