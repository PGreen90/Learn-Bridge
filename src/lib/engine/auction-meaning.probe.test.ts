// BETYDELSESVEPET (motorbytet etapp 1, docs/motorbyte-plan.md §3).
//
// Frågan: stämmer betydelselagrets HÄRLEDDA betydelse (regeln bortskalad, som
// för ett människobud) med regeln motorn faktiskt satte? Mätt på två axlar som
// regelregistret (`rules.ts`) kan svara på: KRAVNIVÅ och ALERT. En avvikelse är
// ett hål i `auction-meaning.ts` — lagas där, aldrig i motorn.
//
// Grinden för etapp 1 är noll avvikelser på OSTÖRDA auktioner (bara en sida
// bjöd). Störda auktioner mäts också men får sitt svep i etapp 4.
//
//   $env:BETYDELSE='1'; npx vitest run src/lib/engine/auction-meaning.probe.test.ts
//   $env:BETYDELSE_RANGE='20270001-20273000'   (standard — samma frön som auktionsdumpen)
//
// Utdata: revisor-output/betydelsesvep.txt
import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { ResolvedCall } from '../bidding'
import { meaningOf } from './auction-meaning'
import { forcingOf, isAlertRule } from './rules'
import { botAuction, dealFromSeed } from './revisor'

const ON = process.env.BETYDELSE === '1'
const RANGE = process.env.BETYDELSE_RANGE ?? '20270001-20273000'

function seeds(range: string): number[] {
  const m = /^(\d+)-(\d+)$/.exec(range.trim())
  if (!m) throw new Error(`BETYDELSE_RANGE ska vara 'från-till' (fick '${range}')`)
  const [a, b] = [Number(m[1]), Number(m[2])]
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

const SIDE = (s: string) => (s === 'N' || s === 'S' ? 'NS' : 'EW')

/** Ostörd = alla bud som inte är pass kommer från samma sida. */
function ostörd(history: ResolvedCall[]): boolean {
  return new Set(history.filter((c) => c.bid !== 'P').map((c) => SIDE(c.seat))).size <= 1
}

/** Utgång eller högre i sin egen strain (3NT, 4♥/4♠, 5♣/5♦)? */
function isGameLevel(bid: string): boolean {
  const m = /^([1-7])(C|D|H|S|NT)$/.exec(bid)
  if (!m) return false
  const level = Number(m[1])
  const s = m[2]
  return s === 'NT' ? level >= 3 : s === 'H' || s === 'S' ? level >= 4 : level >= 5
}

const auktion = (history: ResolvedCall[], i: number) =>
  history
    .slice(0, i + 1)
    .map((c, k) => (k === i ? `[${c.seat} ${c.bid}]` : `${c.seat} ${c.bid}`))
    .join(' · ')

interface Hål {
  nyckel: string
  antal: number
  exempel: string
}

/**
 * KÄNDA MOTORAVVIKELSER: bud där MOTORN (inte lagret) avviker från systemboken,
 * så att regeln motorn satte inte kan vara lagrets facit. Varje rad har sitt
 * facit-fall i motorbyte-facit.test.ts och lagas när familjen kommer (etapp 3).
 * Raden räknas i sin egen sektion, aldrig i grinden. Lägg ALDRIG till en rad
 * här för att få grinden grön utan ett facit-fall.
 */
const KÄNDA_MOTORAVVIKELSER: { rule: string; bid?: RegExp; explanation?: RegExp; facit: string }[] = [
  {
    rule: 'ny färg (GF)',
    bid: /^3C$/,
    explanation: /5\+ ♣ → 3♣ \(naturlig, utgångskrav\)/,
    facit: '2♣–2♦–2M–3♣ bjuds som naturlig klöver med 4+ hp, men budet ÄR andra negativa (§4.4) — facit i motorbyte-facit.test.ts (2♣-familjen)',
  },
  {
    rule: 'rebid: stöd',
    bid: /^5[HS]$/,
    facit: 'öppnaren höjer partnerns kravfärg till 5M över svag tvåa (4M är utgången) — facit i motorbyte-facit.test.ts (svaga tvåor)',
  },
  {
    rule: 'krav – rebjuder egen färg',
    bid: /^4[CD]$/,
    facit: 'kravstegets tvångsbud rebjuder egen lågfärg på 4-läget i cue-zonen (2♣–3♦–3♥–4♦, frö 20271084) medan manuset cue:ar samma form (2♣–3♦–3♠–4♦, frö 20271411): en auktion, två betydelser — facit i motorbyte-facit.test.ts (2♣-familjen)',
  },
]

it.skipIf(!ON)('betydelsesvepet', { timeout: 0 }, () => {
  const hål = {
    krav: new Map<string, Hål>(), // härledd kravnivå ≠ registrets (ostört)
    alert: new Map<string, Hål>(), // härledd alert ≠ registrets (ostört)
    register: new Map<string, Hål>(), // regeln saknar kravnivå i registret (ostört)
    registerStört: new Map<string, Hål>(),
    kravStört: new Map<string, Hål>(),
    alertStört: new Map<string, Hål>(),
    pass: new Map<string, Hål>(), // pass med regel: härledd kravnivå ≠ registrets
    kända: new Map<string, Hål>(), // kända motoravvikelser (facit i motorbyte-facit.test.ts)
  }
  const bumpa = (m: Map<string, Hål>, nyckel: string, exempel: string) => {
    const h = m.get(nyckel)
    if (h) h.antal++
    else m.set(nyckel, { nyckel, antal: 1, exempel })
  }

  let givar = 0
  let ostörda = 0
  let bud = 0
  let budOstörda = 0

  for (const seed of seeds(RANGE)) {
    const history = botAuction(dealFromSeed(seed))
    if (!history) continue
    givar++
    const lugn = ostörd(history)
    if (lugn) ostörda++
    history.forEach((call, i) => {
      if (!call.rule) return
      const reg = forcingOf(call.rule)
      const regAlert = isAlertRule(call.rule)
      const stripped = history.map((c, k) => (k === i ? { seat: c.seat, bid: c.bid } : c))
      const m = meaningOf(stripped, i)
      const ex = `frö ${seed} · ${auktion(history, i)} → "${m.text}"`

      if (call.bid === 'P') {
        if (reg !== undefined && m.forcing !== reg) bumpa(hål.pass, `${call.rule} | härlett ${m.forcing ?? '—'} ≠ register ${reg}`, ex)
        return
      }
      bud++
      if (lugn) budOstörda++
      if (reg === undefined) {
        bumpa(lugn ? hål.register : hål.registerStört, call.rule, ex)
        return
      }
      // Kravnivån jämförs UNDER utgång (där "får partnern passa?" är frågan) och
      // för slamintresse på alla nivåer. På utgångsnivån och över är budet i sig
      // en placering; registrets regelnamn skiljer inte "4♠ som avslut" från
      // "4♠ i utgångskravet", så där skulle jämförelsen mäta namnets lossighet,
      // inte lagrets kunskap.
      const under = !isGameLevel(call.bid)
      const känd = KÄNDA_MOTORAVVIKELSER.find((k) => k.rule === call.rule && (!k.bid || k.bid.test(call.bid)) && (!k.explanation || k.explanation.test(call.explanation ?? '')))
      if (känd) {
        bumpa(hål.kända, `${call.rule} | ${känd.facit}`, ex)
      } else if (call.rule.startsWith('krav – ')) {
        // Kravstegets tvångsbud ("auktionen är krav – jag får inte passa") bär
        // kravet som redan finns, inte en egen kravnivå — jämförs bara på alert.
      } else if (under || reg === 'slamintresse' || m.forcing === 'slamintresse') {
        if (m.forcing !== reg) bumpa(lugn ? hål.krav : hål.kravStört, `${call.rule} | härlett ${m.forcing ?? '—'} ≠ register ${reg}`, ex)
      }
      if (m.alert !== regAlert) bumpa(lugn ? hål.alert : hål.alertStört, `${call.rule} | härlett alert=${m.alert} ≠ register ${regAlert}`, ex)
    })
  }

  const summa = (m: Map<string, Hål>) => [...m.values()].reduce((s, h) => s + h.antal, 0)
  const lista = (m: Map<string, Hål>) =>
    [...m.values()]
      .sort((a, b) => b.antal - a.antal)
      .map((h) => `  [${String(h.antal).padStart(5)}×] ${h.nyckel}\n          ${h.exempel}`)

  const rader = [
    `BETYDELSESVEPET — frön ${RANGE}: ${givar} givar (${ostörda} ostörda), ${bud} botbud med regel (${budOstörda} i ostörda auktioner)`,
    '',
    `GRIND (ostörda auktioner): kravnivå-avvikelser ${summa(hål.krav)} bud i ${hål.krav.size} mönster · alert-avvikelser ${summa(hål.alert)} bud i ${hål.alert.size} mönster · registerhål ${summa(hål.register)} bud i ${hål.register.size} regler`,
    `Störda auktioner (etapp 4): kravnivå ${summa(hål.kravStört)} bud i ${hål.kravStört.size} mönster · alert ${summa(hål.alertStört)} bud i ${hål.alertStört.size} mönster · registerhål ${summa(hål.registerStört)} bud i ${hål.registerStört.size} regler`,
    `Pass med regel: ${summa(hål.pass)} bud i ${hål.pass.size} mönster (informativt)`,
    `Kända motoravvikelser (facit i motorbyte-facit.test.ts, utanför grinden): ${summa(hål.kända)} bud i ${hål.kända.size} mönster`,
    '',
    '=== KÄNDA MOTORAVVIKELSER ===',
    ...lista(hål.kända),
    '',
    '=== KRAVNIVÅ (ostört) ===',
    ...lista(hål.krav),
    '',
    '=== ALERT (ostört) ===',
    ...lista(hål.alert),
    '',
    '=== REGISTERHÅL (regel utan kravnivå i rules.ts) ===',
    ...lista(hål.register),
    '',
    '=== KRAVNIVÅ (stört) ===',
    ...lista(hål.kravStört),
    '',
    '=== ALERT (stört) ===',
    ...lista(hål.alertStört),
    '',
    '=== REGISTERHÅL (stört) ===',
    ...lista(hål.registerStört),
    '',
    '=== PASS MED REGEL ===',
    ...lista(hål.pass),
  ]
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/betydelsesvep.txt', rader.join('\n'), 'utf8')
})
