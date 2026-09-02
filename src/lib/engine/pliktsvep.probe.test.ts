// PLIKTSVEPET (2026-09-02) — partnerskapsplikter i STÖRD budgivning.
//
// Bakgrund: felrapporterna #55/#56 visade att två grundplikter saknades helt
// (svararens fria bud i 5+ högfärg, advancerns preferens). Ägarbeslut: gå
// igenom plikterna SYSTEMATISKT i stället för att vänta på nästa felrapport.
// Det här svepet är MÄTNINGEN före bygget: motorn bjuder tusentals givar med
// alla fyra sätena som bottar, och varje PASS i en störd auktion prövas mot
// en lista av plikter. Träff = "här hade en människa haft en plikt att bjuda".
//
// Plikterna som prövas (K = kandidat, se docs/senare.md "Svep: …"):
//   K1 passat krav        – partnern bjöd ett krav (rondkrav+), RHO passade, jag passade
//   K2 preferens saknas    – partnern visade två färger, jag passade den andra
//                            med bättre stöd i den första (#56-kriterierna)
//   K3 höjning på visad längd – partnern lovade 5+/6+ i sin senaste färg, jag har
//                            fit (3/2 kort) + stödpoäng och passade en billig höjning
//   K4 tio trumf           – delmängd av K3: 10+ trumf ihop och jag passade
//   K5 fritt bud 2-läget   – INVENTERING (ingen miss): vad gör öppnaren efter
//                            partnerns fria bud på 2-läget? (regelfördelning)
//   K6 svar på cue         – INVENTERING: vad gör inklivaren efter advancerns
//                            cue-höjning när RHO passar? (K1-fixen ska ge 0 pass)
//
// Körs ALDRIG i `npm test`/deploygrinden (skipIf) — bara på begäran:
//   PowerShell:  $env:PLIKT='1'; npx vitest run src/lib/engine/pliktsvep.probe.test.ts
//   Bash:        PLIKT=1 npx vitest run src/lib/engine/pliktsvep.probe.test.ts
// Rattar: PLIKT_DEALS (antal givar, standard 3000), PLIKT_SEED (frö, standard
// 20260721 — samma som regelsvepet), PLIKT_EX (exempel per kategori, 12).
// Resultatet skrivs till `revisor-output/pliktsvep.txt` (gitignorad mapp).
import { it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Bid, Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { dealFromSeed, botAuction } from './revisor'
import { legalCalls } from './auction-live'
import { forcingOf, isAlertRule } from './rules'
import { dummyPoints } from './evaluation'
import { hcp, lengths } from './hand'
import { side, PARTNER_SEAT } from './play'
import { formatHand } from '../felrapport'

const DEALS = Number(process.env.PLIKT_DEALS ?? 3000)
const SEED = Number(process.env.PLIKT_SEED ?? 20260721)
const EX = Number(process.env.PLIKT_EX ?? 12)

const SUIT_OF = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' } as const
type Strain = keyof typeof SUIT_OF

function parse(bid: string): { level: number; strain: string } | null {
  const m = /^([1-7])(C|D|H|S|NT)$/.exec(bid)
  return m ? { level: Number(m[1]), strain: m[2] } : null
}
const gameLevel = (strain: string) => (strain === 'NT' ? 3 : strain === 'H' || strain === 'S' ? 4 : 5)

function cheapestIn(hist: ResolvedCall[], seat: Seat, strain: string): { bid: Bid; level: number } | null {
  const legal = legalCalls(hist, seat)
  for (let level = 1; level <= 7; level++) {
    const bid = `${level}${strain}` as Bid
    if (legal.includes(bid)) return { bid, level }
  }
  return null
}
function theirStrains(hist: ResolvedCall[], seat: Seat): Set<string> {
  return new Set(hist.filter((c) => side(c.seat) !== side(seat) && parse(c.bid)).map((c) => parse(c.bid)!.strain))
}
/** Partnerns naturliga färgbud (ej alert-regel, ej NT, ej deras färg), i ordning. */
function partnerNaturalSuits(hist: ResolvedCall[], seat: Seat): { strain: Strain; level: number; idx: number; rule: string }[] {
  const theirs = theirStrains(hist, seat)
  const out: { strain: Strain; level: number; idx: number; rule: string }[] = []
  hist.forEach((c, idx) => {
    if (c.seat !== PARTNER_SEAT[seat]) return
    const cb = parse(c.bid)
    if (!cb || cb.strain === 'NT' || theirs.has(cb.strain) || isAlertRule(c.rule)) return
    out.push({ strain: cb.strain as Strain, level: cb.level, idx, rule: c.rule ?? '—' })
  })
  return out
}

// Vad ett regelnamn LOVAR i längd (minst) i den bjudna färgen.
const PROMISE: Record<string, number> = {
  '5-korts högfärg': 5,
  'enkelt inkliv': 5,
  'naturligt inkliv': 5,
  'fritt bud': 5,
  '2-över-1 GF': 5,
  hoppinkliv: 6,
  'svag tvåa': 6,
  spärr: 6,
  'rebjuden färg': 6,
  'rebjuden färg (inbjudan)': 6,
  'krav – rebjuder egen färg': 6,
  'öppnaren tävlar (egen 6+ färg)': 6,
  'öppnaren tävlar efter partnerns pass (egen 6+ färg)': 6,
  'öppnaren tävlar i utpassningssits (egen 6+ färg)': 6,
}

interface Hit { seed: number; seat: Seat; idx: number; note: string; sub: string }
const CATS = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'] as const
const hits: Record<string, Hit[]> = Object.fromEntries(CATS.map((k) => [k, []]))
const subTally: Record<string, Map<string, number>> = Object.fromEntries(CATS.map((k) => [k, new Map()]))
function hit(cat: string, h: Hit) {
  hits[cat].push(h)
  subTally[cat].set(h.sub, (subTally[cat].get(h.sub) ?? 0) + 1)
}

function roleOf(hist: ResolvedCall[], seat: Seat): string {
  const open = hist.find((c) => parse(c.bid))
  if (!open) return '?'
  if (open.seat === seat) return 'öppnaren'
  if (open.seat === PARTNER_SEAT[seat]) return 'svararen'
  const partnerDoubled = hist.some((c) => c.seat === PARTNER_SEAT[seat] && c.bid === 'X')
  return partnerDoubled ? 'dubblarens partner' : 'advancern'
}

function checkPass(deal: Deal, history: ResolvedCall[], i: number, seed: number) {
  const seat = history[i].seat
  const prefix = history.slice(0, i)
  const hand = deal.hands[seat]
  const len = lengths(hand)
  const contracts = prefix.filter((c) => parse(c.bid))
  const last = contracts[contracts.length - 1]
  if (!last) return
  // Bara STÖRDA lägen: motståndarna ska ha bjudit (kontraktsbud) FÖRE mitt pass.
  if (!contracts.some((c) => side(c.seat) !== side(seat))) return
  const afterLast = prefix.slice(prefix.indexOf(last) + 1)
  const onlyPassAfterLast = afterLast.every((c) => c.bid === 'P')
  const role = roleOf(prefix, seat)

  // ---- K1: passat krav ---------------------------------------------------
  const lastOurs = [...prefix].reverse().find((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (lastOurs && lastOurs.seat === PARTNER_SEAT[seat]) {
    const f = forcingOf(lastOurs.rule)
    const after = prefix.slice(prefix.indexOf(lastOurs) + 1)
    if ((f === 'krav-1-rond' || f === 'utgangskrav' || f === 'slamintresse') && after.every((c) => c.bid === 'P')) {
      const cb = parse(lastOurs.bid)
      if (!cb || cb.level < gameLevel(cb.strain)) {
        hit('K1', { seed, seat, idx: i, sub: `${role} passar "${lastOurs.rule}" (${f})`, note: `partnerns ${lastOurs.bid} [${lastOurs.rule}] är ${f}` })
      }
    }
  }

  // ---- K2: preferens saknas ---------------------------------------------
  const suits = partnerNaturalSuits(prefix, seat)
  const distinct = [...new Map(suits.map((s) => [s.strain, s])).values()]
  if (distinct.length === 2 && last.seat === PARTNER_SEAT[seat] && onlyPassAfterLast) {
    const lastCb = parse(last.bid)!
    const [A, B] = distinct
    const iBidEither = prefix.some((c) => c.seat === seat && parse(c.bid) && [A.strain, B.strain].includes(parse(c.bid)!.strain as Strain))
    if (lastCb.strain === B.strain && lastCb.level < gameLevel(B.strain) && !iBidEither) {
      const pref = cheapestIn(prefix, seat, A.strain)
      if (pref && pref.level <= gameLevel(A.strain)) {
        const costs = pref.level > lastCb.level
        const better = costs ? len[SUIT_OF[A.strain]] >= len[SUIT_OF[B.strain]] + 2 : len[SUIT_OF[A.strain]] >= len[SUIT_OF[B.strain]]
        if (better && len[SUIT_OF[A.strain]] >= 2) {
          hit('K2', { seed, seat, idx: i, sub: `${role}${costs ? ' (kostar en nivå)' : ' (gratis)'}`, note: `partnern ${A.strain}[${A.rule}] sedan ${B.strain}[${B.rule}]; jag ${len[SUIT_OF[A.strain]]}-${len[SUIT_OF[B.strain]]} → ${pref.bid} var preferensen` })
        }
      }
    }
  }

  // ---- K3/K4: höjning på visad längd ------------------------------------
  const lastSuit = suits[suits.length - 1]
  if (lastSuit && PROMISE[lastSuit.rule] !== undefined && onlyPassAfterLast) {
    const promise = PROMISE[lastSuit.rule]
    const suit = SUIT_OF[lastSuit.strain]
    const iBidIt = prefix.some((c) => c.seat === seat && parse(c.bid)?.strain === lastSuit.strain)
    const partnerRebidLater = prefix.slice(lastSuit.idx + 1).some((c) => c.seat === PARTNER_SEAT[seat] && c.bid !== 'P')
    if (!iBidIt && !partnerRebidLater && len[suit] + promise >= 8) {
      const sp = dummyPoints(hand, suit).dummyPoints
      const raise = cheapestIn(prefix, seat, lastSuit.strain)
      const total = len[suit] + promise
      if (raise && raise.level <= gameLevel(lastSuit.strain)) {
        const cheap = raise.level <= 2 || (raise.level === 3 && total >= 9) || (raise.level === 4 && total >= 10)
        // Ägarens golv (2026-09-02): 6 hp för höjningen — under det är pass rätt.
        if (sp >= 6 && hcp(hand) >= 6 && cheap) {
          const theyLast = side(last.seat) !== side(seat)
          hit('K3', { seed, seat, idx: i, sub: `${role} · partnern "${lastSuit.rule}" (${promise}+) · ${theyLast ? 'efter deras bud' : 'partnerns bud står'}`, note: `${len[suit]} stöd (${total} trumf), ${sp} stödp, ${hcp(hand)} hp; ${raise.bid} var billigaste höjning` })
          if (total >= 10) hit('K4', { seed, seat, idx: i, sub: `${role} · ${total} trumf · ${raise.bid}`, note: `${len[suit]} stöd mot ${promise}+, ${sp} stödp` })
        }
      }
    }
  }
}

function checkFreeBidRebid(history: ResolvedCall[], seed: number) {
  // 1x – (1y) – 2z [fritt bud] – P – öppnarens bud: räkna regeln.
  const contracts = history.filter((c) => parse(c.bid))
  if (contracts.length < 3) return
  const [open, ov, free] = contracts
  if (parse(open.bid)!.level !== 1 || parse(ov.bid)!.level !== 1 || free.rule !== 'fritt bud' || parse(free.bid)!.level !== 2) return
  if (side(ov.seat) === side(open.seat) || free.seat !== PARTNER_SEAT[open.seat]) return
  const freeIdx = history.indexOf(free)
  const next = history[freeIdx + 1]
  const opener = history[freeIdx + 2]
  if (!next || next.bid !== 'P' || !opener || opener.seat !== open.seat) return
  hit('K5', { seed, seat: opener.seat, idx: freeIdx + 2, sub: `${opener.bid} [${opener.rule ?? '—'}]`, note: `${open.bid}–(${ov.bid})–${free.bid}–P → ${opener.bid}` })
}

function checkOvercallerAfterCue(history: ResolvedCall[], seed: number) {
  // Deras öppning – vårt inkliv – (pass) – advancerns cue [cue (limithöjning+)] – RHO pass → inklivarens bud.
  history.forEach((c, idx) => {
    if (c.rule !== 'cue (limithöjning+)') return
    const open = history.find((x) => parse(x.bid))
    if (!open || side(open.seat) === side(c.seat)) return // bara ADVANCERNS cue (de öppnade)
    const rho = history[idx + 1]
    const me = history[idx + 2]
    if (!rho || rho.bid !== 'P' || !me || me.seat !== PARTNER_SEAT[c.seat]) return
    hit('K6', { seed, seat: me.seat, idx: idx + 2, sub: `${me.bid} [${me.rule ?? '—'}]`, note: `advancerns cue ${c.bid} → inklivaren ${me.bid}` })
  })
}

it.skipIf(!process.env.PLIKT)('pliktsvep: partnerskapsplikter i störd budgivning', () => {
  const deals = new Map<number, { deal: Deal; history: ResolvedCall[] }>()
  let contested = 0
  let auktionsfel = 0
  for (let i = 0; i < DEALS; i++) {
    const seed = SEED + i
    const deal = dealFromSeed(seed)
    const history = botAuction(deal)
    if (!history) { auktionsfel++; continue }
    const sides = new Set(history.filter((c) => parse(c.bid)).map((c) => side(c.seat)))
    if (sides.size < 2) continue
    contested++
    deals.set(seed, { deal, history })
    history.forEach((c, idx) => { if (c.bid === 'P') checkPass(deal, history, idx, seed) })
    checkFreeBidRebid(history, seed)
    checkOvercallerAfterCue(history, seed)
  }

  const rader: string[] = [
    `=== PLIKTSVEP: ${DEALS} givar från frö ${SEED} · ${contested} störda auktioner · ${auktionsfel} auktionsfel ===`,
    '',
  ]
  const TITLE: Record<string, string> = {
    K1: 'K1 passat krav (partnerns krav + RHO pass → jag passade)',
    K2: 'K2 preferens saknas (partnern två färger, bättre stöd i den första)',
    K3: 'K3 höjning på visad längd saknas (fit + stödpoäng, billig höjning passad)',
    K4: 'K4 tio trumf ihop och jag passade',
    K5: 'K5 INVENTERING: öppnarens bud efter partnerns fria bud på 2-läget',
    K6: 'K6 INVENTERING: inklivarens bud efter advancerns cue-höjning (RHO passade)',
  }
  for (const cat of CATS) {
    rader.push(`##### ${TITLE[cat]}: ${hits[cat].length} träffar`)
    for (const [sub, n] of [...subTally[cat].entries()].sort((a, b) => b[1] - a[1])) rader.push(`  ${String(n).padStart(5)}  ${sub}`)
    rader.push('')
    for (const h of hits[cat].slice(0, EX)) {
      const { deal, history } = deals.get(h.seed)!
      rader.push(`--- frö ${h.seed} · ${h.seat} passar på plats ${h.idx} · ${h.note}`)
      rader.push(`    ${h.seat}: ${formatHand(deal.hands[h.seat])}   (partnern ${PARTNER_SEAT[h.seat]}: ${formatHand(deal.hands[PARTNER_SEAT[h.seat]])})`)
      rader.push('    ' + history.map((c, idx) => `${idx === h.idx ? '>>' : ''}${c.seat}:${c.bid}${c.rule ? `[${c.rule}]` : ''}`).join(' '))
    }
    rader.push('')
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/pliktsvep.txt', rader.join('\n'), 'utf8')
  expect(auktionsfel).toBe(0)
})
