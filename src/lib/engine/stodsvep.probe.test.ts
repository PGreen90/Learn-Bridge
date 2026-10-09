// STÖDSVEPET (2026-10-08) — lovar varje höjning det antal trumf systemet säger?
//
// Bakgrund: ägarfrågan "en höjning i partnerns färg måste lova ett visst antal
// stöd — hur bjuder vi stöd i dag och vad lovar vi?". Svaret kartlades ur
// docs/budsystem.md + koden; det här svepet MÄTER att motorn håller löftena.
// Motorn bjuder tusentals givar med alla fyra sätena som bottar. Varje bud som
// stödjer partnerns färg fångas (naturlig höjning i partnerns färg, eller ett
// konstgjort stödbud som Jacoby/Bergen/Drury/splinter/cue/Jordan) och prövas:
//
//   A  FACIT   – minsta trumflängd budet lovar. Grundregel: fit = 8 trumf, så
//                löftet = 8 − vad partnerns färgbud lovade (5-korts högfärg → 3,
//                inkliv 5+ → 3, rebjuden färg 6+ → 2, spärr 7+ → 2; lågfärg och
//                4-kortsfärger → 4). Etikettspecifika löften (Jacoby 3, Bergen 4,
//                Drury 2♣ 3 / 2♦ 4, inverterad 4/5 …) går före. Ägarens ja
//                2026-10-08 på tvåkortsfallen: höjning av partnerns rebjudna
//                6+-färg, 4M över partnerns 3-spärr med 16+, konkurrenshöjningen
//                med två kort efter vår svaga tvåa. Ägarbeslut A/B samma dag:
//                dubblaren (upplysande/responsiv) höjer bara med 4+ (svaret
//                lovar 4). C: spärrhöjning av 3-spärren med 2 räcker. D: efter
//                Ogust utan fit får signoff/utgång i svaga tvåan ske på 1+.
//                Hand kortare än facit = LÖGN. Första körningen fann tre:
//                negativ-dubblarens accept på 0–1 trumf, 1M–1NT–3M-accepten på
//                singelton, 5♦ på dubbelton efter 2♣–2♦–2x–3♦ (väntebudet
//                räknat som ruterbud) — facit `auction-stodsvep.test.ts`.
//   B  TEXT    – förklaringstexten lovar själv en längd ("3 stöd", "4+ trumf",
//                "fyrkorts stöd"; satser om partnerns hand räknas inte). Hand
//                kortare än texten = FÖRKLARINGSFEL (texten lovar mer än budet —
//                hör till budförklarings-svepet, inte motorn).
//   C  INVENT  – alla stödbud per (roll · partnerns färgbud · mitt bud [regel]):
//                antal, lägsta längd, facit, textlöfte, fördelning. Lägen utan
//                facit (okänt partnerlöfte) listas separat så facit kan fyllas på.
//
// Körs ALDRIG i `npm test`/deploygrinden (skipIf) — bara på begäran:
//   PowerShell:  $env:STOD='1'; npx vitest run src/lib/engine/stodsvep.probe.test.ts
//   Bash:        STOD=1 npx vitest run src/lib/engine/stodsvep.probe.test.ts
// Rattar: STOD_DEALS (antal givar, standard 20000), STOD_SEED (frö, standard
// 20260721 — samma som regel-/pliktsvepet). Två exempel per läge i rapporten.
// Resultatet skrivs till `revisor-output/stodsvep.txt` (gitignorad mapp).
import { it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { dealFromSeed, botAuction } from './revisor'
import { isAlertRule } from './rules'
import { dummyPoints } from './evaluation'
import { hcp, lengths } from './hand'
import { side, PARTNER_SEAT } from './play'
import { formatHand } from '../felrapport'

const DEALS = Number(process.env.STOD_DEALS ?? 20000)
const SEED = Number(process.env.STOD_SEED ?? 20260721)

const SUIT_OF = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' } as const
type Strain = keyof typeof SUIT_OF

function parse(bid: string): { level: number; strain: string } | null {
  const m = /^([1-7])(C|D|H|S|NT)$/.exec(bid)
  return m ? { level: Number(m[1]), strain: m[2] } : null
}

// ---- Vad PARTNERNS färgbud lovar i längd (regeletikett → minst) -------------
// Lågfärgsöppningen (minor-regeln) kan vara 3 kort, men systemets höjningar av
// den lovar 4+ (inverterad/enkel) — därför 4 här (= "löftet höjningen räknar mot").
const PARTNER_PROMISE: Record<string, number> = {
  '5-korts högfärg': 5,
  'minor-regeln': 4,
  'enkelt inkliv': 5,
  'naturligt inkliv': 5,
  'fritt bud': 5,
  'ny färg (1-läget)': 4,
  'ny färg (2-läget)': 4,
  'ny färg (krav)': 5,
  'ny färg (GF)': 4,
  '2-över-1 GF': 4,
  '2♣-positivt': 5,
  hoppinkliv: 6,
  'svag tvåa': 6,
  spärr: 7,
  'svar på negativ dubbling': 4,
  'svar på New Minor Forcing': 4,
  färgbud: 4, // påtvingat svar på X
  'fritt svar på upplysningsdubbling': 5, // doubles.ts: hoppbud / lång färg / 6–8 med 5+
  'hoppbud (inbjudan)': 4, // doubles.ts: 9–11 med 4+ (påtvingade flödet)
  'rebid: krav-färg': 5,
  'starkt återbud': 5,
  'ny färg': 5,
  'krav – ny färg': 4,
  reverse: 4,
  'rebid: reverse': 4,
  'rebid: ny färg (GF)': 4,
  hoppskift: 4,
  'fit-jump': 5,
  lättöppning: 5,
  'återöppning med högfärg (1NT)': 5,
  'advance Michaels: spärrhöjning': 4,
  'advance ovanlig 2NT: spärrhöjning': 4,
  'rebid: hoppskift': 4,
  'rebid: egen färg (GF)': 6,
  'fullföljd transfer': 5,
  superaccept: 5,
  'advance tvåfärg (preferens)': 5,
  '2NT-återbud (5-3-jakt)': 5,
  'svag rymning': 5,
}

interface PartnerSuit { strain: Strain; level: number; idx: number; rule: string; times: number }
interface Ctx { rule: string; bid: { level: number; strain: string }; target: PartnerSuit; role: string; firstSuit: boolean; partnerReversed: boolean; ogustAsked: boolean }

// ---- A. FACIT: minsta trumflängd MITT stödbud lovar ------------------------
function facitFor(c: Ctx): number | undefined {
  const r = c.rule
  // Etikettspecifika löften (systemboken §4.1/§4.2/§4.5/§6.7/§7)
  if (r === 'Jacoby 2NT') return 3
  if (r.startsWith('Bergen')) return 4
  if (r === 'tvetydig splinter' || r.startsWith('splinter')) return 4
  if (r === 'spärr till utgång') return 5
  if (r === 'Drury 2♣') return 3
  if (r === 'Drury 2♦') return 4
  if (r === 'inverterad minor, svag') return 5
  if (r.startsWith('inverterad')) return 4
  if (r === 'Jordan 2NT') return 4
  if (r === 'svar på stöddubbling') return 3 // §7.4: invithöjning 3m med 4+, eller 3 med honnör
  // Ägarbeslut D (2026-10-08): Ogust med 15+ utan fit, sedan signoff/utgång i
  // partnerns svaga tvåa på 1+ kort — syftet var att pröva färgen för 3NT.
  if (c.target.rule === 'svag tvåa' && c.ogustAsked) return 1
  if (r === 'cue (limithöjning+)') return 3
  // Fjärde färg / NMF / checkback frågar efter 3-korts stöd i svararens 5+ högfärg
  if (r === 'svar på fjärde färg' || r === 'svar på New Minor Forcing' || r.startsWith('svar på 2NT-')) return 3
  // Partnerns löfte känt → fit = 8 trumf. Rebjuden färg (bjuden ≥2 gånger) = 6+.
  // Har partnern reverserat är den FÖRSTA färgen 5+ (§5.2).
  const reversed = c.firstSuit && c.partnerReversed
  const pp = c.target.times >= 2 ? Math.max(6, PARTNER_PROMISE[c.target.rule] ?? 0) : reversed ? Math.max(5, PARTNER_PROMISE[c.target.rule] ?? 0) : PARTNER_PROMISE[c.target.rule]
  if (pp === undefined) return undefined
  // fit = 8 trumf; aldrig under 2 (spärr 7+ → 2, ägarens ja) eller över 5
  return Math.max(2, Math.min(5, 8 - pp))
}

// Bud i partnerns färg som INTE är höjningar (preferens, kontrollbud i partnerns
// sidofärg, RKC-svar) – inventeras men prövas inte.
const EJ_HÖJNING = /preferens|cue-bid|kontrollbud|RKC|Blackwood|trumfdam|svar på återöppningsdubbling|svar på dubblarens cue|checkback|placering/i
// Partnerns bud som INTE är en egen färg (överföringar fullföljer MIN färg).
const EJ_PARTNERFÄRG = /transfer|överföring/i

// ---- B. TEXT: vad förklaringen själv lovar i längd (minst) ----------------
const ORD: Record<string, number> = { två: 2, tre: 3, fyra: 4, fem: 5, sex: 6 }
function textPromise(expl: string | undefined): number | null {
  if (!expl) return null
  const found: number[] = []
  // Satser om partnerns hand räknas inte ("Partnerns hopp visar … 6-korts ♥").
  const clauses = expl.split(/[.;—]|\s–\s/).filter((s) => !/partner/i.test(s))
  for (const s of clauses) {
    for (const m of s.matchAll(/(?<!\d)(\d)\s*(?:\+|–\d)?\s*(?:-korts\s+)?(?:stöd|trumf)(?!poäng)/g)) found.push(Number(m[1]))
    for (const m of s.matchAll(/(?<!\d)(\d)-korts/g)) found.push(Number(m[1]))
    for (const m of s.matchAll(/\b(två|tre|fyra|fem|sex)(?:korts|-korts|\s+kort|\s+trumf|\s+stöd)/gi)) found.push(ORD[m[1].toLowerCase()])
    if (/dubbelton/i.test(s)) found.push(2)
  }
  return found.length ? Math.min(...found) : null
}

// Konstgjorda stödbud: regeletiketten säger "stöd" fast budet inte är i
// partnerns färg. Färgen som stöds = partnerns senaste naturliga färg.
const KONSTGJORDA = new Set(['Jacoby 2NT', 'Bergen limit', 'Bergen konstruktiv', 'Bergen spärr', 'tvetydig splinter', 'Drury 2♣', 'Drury 2♦', 'cue (limithöjning+)', 'Jordan 2NT'])
// (Ogust är INTE ett stödbud: 11+ med 3+ stöd ELLER 15+ utan fit, responses-weak2.ts.)

/** Partnerns naturliga färgbud före plats `upto` (ej alert, ej cue i deras färg), per färg. */
function partnerSuits(hist: ResolvedCall[], seat: Seat, upto: number): PartnerSuit[] {
  const out = new Map<Strain, PartnerSuit>()
  const theirsSoFar = new Set<string>()
  const mineSoFar = new Set<string>()
  for (let i = 0; i < upto; i++) {
    const c = hist[i]
    const cb = parse(c.bid)
    if (!cb) continue
    if (side(c.seat) !== side(seat)) { theirsSoFar.add(cb.strain); continue }
    if (c.seat === seat) { mineSoFar.add(cb.strain); continue }
    if (cb.strain === 'NT' || theirsSoFar.has(cb.strain) || isAlertRule(c.rule) || EJ_PARTNERFÄRG.test(c.rule ?? '')) continue
    if (mineSoFar.has(cb.strain)) continue // partnern höjde MIN färg – ingen partnerfärg
    const st = cb.strain as Strain
    const prev = out.get(st)
    if (prev) prev.times++
    else out.set(st, { strain: st, level: cb.level, idx: i, rule: c.rule ?? '—', times: 1 })
  }
  return [...out.values()]
}

function roleOf(hist: ResolvedCall[], seat: Seat, upto: number): string {
  const open = hist.slice(0, upto).find((c) => parse(c.bid))
  if (!open) return '?'
  if (open.seat === seat) return 'öppnaren'
  if (open.seat === PARTNER_SEAT[seat]) return 'svararen'
  const partnerDoubled = hist.slice(0, upto).some((c) => c.seat === PARTNER_SEAT[seat] && c.bid === 'X')
  return partnerDoubled ? 'dubblarens partner' : 'advancern'
}

/** Regeletikett; fit-raise.ts sätter ingen `rule` → härled ur förklaringen ("Stöd för partnerns ♥ – enkel höjning med fit."). */
function ruleOf(c: ResolvedCall): string {
  if (c.rule) return c.rule
  const m = /– (.+?) med fit\.?$/.exec(c.explanation ?? '')
  return m ? `fit-raise: ${m[1]}` : '—'
}

interface Hit { seed: number; seat: Seat; idx: number; key: string; note: string }
const hits: Record<'A' | 'B', Hit[]> = { A: [], B: [] }
const tallyAB: Record<'A' | 'B', Map<string, number>> = { A: new Map(), B: new Map() }
function hit(cat: 'A' | 'B', h: Hit) {
  hits[cat].push(h)
  tallyAB[cat].set(h.key, (tallyAB[cat].get(h.key) ?? 0) + 1)
}
interface Inv { n: number; min: number; dist: Map<number, number>; textMin: number | null; facit: number | undefined; ex: Hit[] }
const inventory = new Map<string, Inv>()
const noFacit = new Map<string, { n: number; min: number }>()

function checkCall(deal: Deal, history: ResolvedCall[], i: number, seed: number) {
  const c = history[i]
  const cb = parse(c.bid)
  if (!cb) return
  const seat = c.seat
  const rule = ruleOf(c)
  const suits = partnerSuits(history, seat, i)
  if (!suits.length) return
  let target: PartnerSuit | undefined
  if (KONSTGJORDA.has(rule)) target = suits[suits.length - 1]
  else if (cb.strain !== 'NT') target = suits.find((s) => s.strain === cb.strain)
  if (!target) return
  if (history.slice(target.idx + 1, i).some((x) => x.seat === seat && parse(x.bid)?.strain === target!.strain)) return // redan höjt – senare bud är placeringar
  // Trumfen redan satt i MIN färg (partnern höjde den) → bud i partnerns färg är kontroll/placering, ingen höjning.
  const mineBefore = new Set(history.slice(0, i).filter((x) => x.seat === seat).map((x) => parse(x.bid)?.strain).filter(Boolean))
  if (history.slice(0, i).some((x) => x.seat === PARTNER_SEAT[seat] && mineBefore.has(parse(x.bid)?.strain))) return
  // Partnern har visat TVÅ färger och jag bjuder den senare billigast = preferens, ingen höjning.
  const prefLike = suits.length >= 2 && target !== suits[0] && cb.level === target.level + (cb.strain > target.strain ? 0 : 1) && !KONSTGJORDA.has(rule)
  const hand = deal.hands[seat]
  const suit = SUIT_OF[target.strain]
  const len = lengths(hand)[suit]
  const sp = dummyPoints(hand, suit).dummyPoints
  const role = roleOf(history, seat, i)
  const stört = history.slice(0, i).some((x) => side(x.seat) !== side(seat) && x.bid !== 'P')
  const ejHöjning = EJ_HÖJNING.test(rule) || prefLike || /preferens/i.test(c.explanation ?? '')
  const key = `${ejHöjning ? '(ej höjning) ' : ''}${role}${stört ? ' (stört)' : ''} · partnern ${target.level}${target.strain}${target.times > 1 ? `×${target.times}` : ''} [${target.rule}] → ${c.bid} [${rule}]`
  const note = `${len} ${target.strain} · ${hcp(hand)} hp · ${sp} stödp`

  const partnerReversed = history.slice(0, i).some((x) => x.seat === PARTNER_SEAT[seat] && /reverse/i.test(x.rule ?? ''))
  const ogustAsked = history.slice(0, i).some((x) => x.seat === seat && x.rule === 'Ogust')
  const facit = ejHöjning ? undefined : facitFor({ rule, bid: cb, target, role, firstSuit: target === suits[0], partnerReversed, ogustAsked })
  const tp = ejHöjning ? null : textPromise(c.explanation)
  let inv = inventory.get(key)
  if (!inv) { inv = { n: 0, min: 99, dist: new Map(), textMin: tp, facit, ex: [] }; inventory.set(key, inv) }
  inv.n++
  inv.min = Math.min(inv.min, len)
  inv.dist.set(len, (inv.dist.get(len) ?? 0) + 1)
  if (tp !== null && (inv.textMin === null || tp < inv.textMin)) inv.textMin = tp
  if (inv.ex.length < 2) inv.ex.push({ seed, seat, idx: i, key, note })
  if (ejHöjning) return

  if (facit === undefined) {
    const k = `partnern [${target.rule}] → [${rule}]`
    const nf = noFacit.get(k) ?? { n: 0, min: 99 }
    nf.n++
    nf.min = Math.min(nf.min, len)
    noFacit.set(k, nf)
  } else if (len < facit) {
    hit('A', { seed, seat, idx: i, key, note: `${note} — facit ${facit}+` })
  }
  if (tp !== null && len < tp) hit('B', { seed, seat, idx: i, key, note: `${note} — texten lovar ${tp}+: "${c.explanation}"` })
}

it.skipIf(!process.env.STOD)('stödsvep: lovar varje höjning det antal trumf systemet säger?', () => {
  const deals = new Map<number, { deal: Deal; history: ResolvedCall[] }>()
  let auktionsfel = 0
  for (let i = 0; i < DEALS; i++) {
    const seed = SEED + i
    const deal = dealFromSeed(seed)
    const history = botAuction(deal)
    if (!history) { auktionsfel++; continue }
    deals.set(seed, { deal, history })
    history.forEach((_, idx) => checkCall(deal, history, idx, seed))
  }
  const totalStöd = [...inventory.values()].reduce((a, v) => a + v.n, 0)

  const fmtEx = (h: Hit) => {
    const { deal, history } = deals.get(h.seed)!
    return [
      `--- frö ${h.seed} · ${h.seat} bjuder på plats ${h.idx} · ${h.note}`,
      `    ${h.seat}: ${formatHand(deal.hands[h.seat])}   (partnern ${PARTNER_SEAT[h.seat]}: ${formatHand(deal.hands[PARTNER_SEAT[h.seat]])})`,
      '    ' + history.map((c, idx) => `${idx === h.idx ? '>>' : ''}${c.seat}:${c.bid}${c.rule ? `[${c.rule}]` : ''}`).join(' '),
      `    förklaring: ${history[h.idx].explanation ?? '—'}`,
    ]
  }
  const rader: string[] = [
    `=== STÖDSVEP: ${DEALS} givar från frö ${SEED} · ${totalStöd} stödbud · ${auktionsfel} auktionsfel ===`,
    '',
    `##### A LÖGNER (hand kortare än facit): ${hits.A.length}`,
  ]
  for (const [k, n] of [...tallyAB.A.entries()].sort((a, b) => b[1] - a[1])) rader.push(`  ${String(n).padStart(5)}  ${k}`)
  rader.push('')
  for (const k of tallyAB.A.keys()) for (const h of hits.A.filter((x) => x.key === k).slice(0, 2)) rader.push(...fmtEx(h))
  rader.push('', `##### B FÖRKLARINGSFEL (hand kortare än texten lovar): ${hits.B.length}`)
  for (const [k, n] of [...tallyAB.B.entries()].sort((a, b) => b[1] - a[1])) rader.push(`  ${String(n).padStart(5)}  ${k}`)
  rader.push('')
  for (const k of tallyAB.B.keys()) for (const h of hits.B.filter((x) => x.key === k).slice(0, 2)) rader.push(...fmtEx(h))
  rader.push('', `##### LÄGEN UTAN FACIT (okänt partnerlöfte — fyll på PARTNER_PROMISE): ${noFacit.size}`)
  for (const [k, nf] of [...noFacit.entries()].sort((a, b) => b[1].n - a[1].n)) rader.push(`  ${String(nf.n).padStart(5)}  min ${nf.min}  ${k}`)
  rader.push('', `##### C INVENTERING (${inventory.size} lägen): antal · min · facit · text · fördelning`)
  for (const [k, v] of [...inventory.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const dist = [...v.dist.entries()].sort((a, b) => a[0] - b[0]).map(([l, n]) => `${l}:${n}`).join(' ')
    rader.push(`  ${String(v.n).padStart(5)}  min ${v.min}  facit ${v.facit ?? '?'}  text ${v.textMin ?? '?'}  ${k}   {${dist}}`)
  }
  rader.push('', '##### EXEMPEL per läge (två per läge)')
  for (const [, v] of [...inventory.entries()].sort((a, b) => b[1].n - a[1].n)) for (const h of v.ex) rader.push(...fmtEx(h))
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/stodsvep.txt', rader.join('\n'), 'utf8')
  expect(auktionsfel).toBe(0)
}, 0)
