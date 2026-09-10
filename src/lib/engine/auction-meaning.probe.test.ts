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
import { it, expect } from 'vitest'
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
  // (2♣–2♦–2M–3♣-raden borttagen 2026-09-07: §5b beslut 6 gjorde 3♣ naturligt, andra negativa = 2NT.)
  {
    rule: 'rebid: stöd',
    bid: /^5[HS]$/,
    facit: 'öppnaren höjer partnerns kravfärg till 5M över svag tvåa (4M är utgången) — facit i motorbyte-facit.test.ts (svaga tvåor)',
  },
]

// STÖRDA UNDANTAG (motorbytet etapp 4 familj 9, ägarbeslut 2026-09-10: "noll på
// det avgörbara + lista resten"). Störda lägen där den HÄRLEDDA betydelsen inte
// KAN stämma med registret ur den nakna auktionen ensam — golvet som ärlig
// inferens själv sätter. De räknas UTANFÖR grinden (som de kända motoravvikelserna
// på ostörda auktioner), aldrig utan ett skäl. Nyckeln är exakt den rad
// betydelsesvepet skriver. Lägg ALDRIG till en rad här för att dölja ett
// STRUKTURELLT hål (ett som går att avgöra ur budgivningen) — laga det i stället.
//
// Skälkoder:
//   K = kortberoende styrkeval (samma auktion = minimum/inbjudan/stark beror på handen)
//   C = cue-buds/-svars exakta kravnivå (kontext- och styrkeberoende)
//   D = kortberoende konvention-vs-naturligt (samma bud = DONT-tvåfärg eller naturligt)
//   L = Lebensohl-fortsättning över 1NT (bägge sidors relä/rättelse/3NT) — ej modellerad i läsaren
//   M = motoravvikelse (motorn namnger konventionssvaret generiskt i störd auktion; läsaren mer exakt)
const STÖRDA_UNDANTAG: Record<string, string> = {
  // K — kortberoende styrkeval
  'fritt bud: rebjuder egen färg | härlett ej-krav ≠ register inbjudan': 'K',
  'fritt svar på upplysningsdubbling | härlett inbjudan ≠ register ej-krav': 'K',
  'negativ-dubblarens invit-fortsättning | härlett ej-krav ≠ register inbjudan': 'K',
  'svar på negativ dubbling | härlett inbjudan ≠ register ej-krav': 'K',
  '2NT inbjudan | härlett ej-krav ≠ register inbjudan': 'K',
  'svar på återöppningsdubbling | härlett inbjudan ≠ register ej-krav': 'K',
  'svar på återöppningsdubbling | härlett krav-1-rond ≠ register ej-krav': 'K',
  'starkt återbud | härlett inbjudan ≠ register krav-1-rond': 'K',
  'starkt återbud (lägsta) | härlett ej-krav ≠ register krav-1-rond': 'K',
  'starkt återbud (lägsta) | härlett inbjudan ≠ register krav-1-rond': 'K',
  'öppnarens återöppningsdubbling (partnern passade) | härlett ej-krav ≠ register krav-1-rond': 'K',
  'höjning efter negativ dubbling (inbjudan) | härlett ej-krav ≠ register inbjudan': 'K',
  'öppnarens 2NT-inbjudan i konkurrens | härlett ej-krav ≠ register inbjudan': 'K',
  'stödhöjning – hopphöjning (inbjudan) | härlett ej-krav ≠ register inbjudan': 'K',
  'öppnaren tävlar (stödjer partnern) | härlett inbjudan ≠ register ej-krav': 'K',
  'inbjudan efter höjt fritt bud | härlett ej-krav ≠ register inbjudan': 'K',
  'fritt bud: inbjudande höjning | härlett ej-krav ≠ register inbjudan': 'K',
  'upplysningsdubbling | härlett ej-krav ≠ register krav-1-rond': 'K',
  'straff/värden | härlett krav-1-rond ≠ register ej-krav': 'K',
  'straffdubbling | härlett inbjudan ≠ register ej-krav': 'K',
  'tvångssvar (utan stöd) | härlett ej-krav ≠ register krav-1-rond': 'K',
  'tvångssvar (utan stöd) | härlett alert=true ≠ register false': 'K',
  'avböjer game-try | härlett ej-krav ≠ register avslut': 'K',
  'färgbud | härlett krav-1-rond ≠ register ej-krav': 'K',
  // C — cue-buds/-svars exakta kravnivå
  'cue (krav) | härlett krav-1-rond ≠ register utgangskrav': 'C',
  'cue (limithöjning+) | härlett ej-krav ≠ register krav-1-rond': 'C',
  'cue (limithöjning+) | härlett alert=false ≠ register true': 'C',
  'öppnarens cue (extra i konkurrens) | härlett utgangskrav ≠ register krav-1-rond': 'C',
  'svar på dubblarens cue | härlett inbjudan ≠ register utgangskrav': 'C',
  'svar på dubblarens cue | härlett krav-1-rond ≠ register utgangskrav': 'C',
  'svar på tvåfärgs-cue | härlett ej-krav ≠ register utgangskrav': 'C',
  'svar på tvåfärgs-cue | härlett krav-1-rond ≠ register utgangskrav': 'C',
  'svar på partnerns cue | härlett ej-krav ≠ register krav-1-rond': 'C',
  'dubblarens svar på cue | härlett inbjudan ≠ register utgangskrav': 'C',
  'dubblarens svar på cue | härlett krav-1-rond ≠ register utgangskrav': 'C',
  'stöd-cue (slamintresse) | härlett krav-1-rond ≠ register slamintresse': 'C',
  'fritt bud: cue (utgångskrav) | härlett krav-1-rond ≠ register utgangskrav': 'C',
  // D — kortberoende konvention-vs-naturligt över deras 1NT
  'advancern tävlar till fiten (lagen om totala stick) | härlett inbjudan ≠ register ej-krav': 'D',
  'advancern tävlar till fiten (lagen om totala stick) | härlett alert=true ≠ register false': 'D',
  'naturligt inkliv (1NT) | härlett alert=true ≠ register false': 'D',
  'naturligt (to play) | härlett alert=true ≠ register false': 'D',
  'naturligt (to play) | härlett utgangskrav ≠ register ej-krav': 'D',
  'DONT 2♠ (spader) | härlett alert=false ≠ register true': 'D',
  // L — Lebensohl-fortsättning över 1NT (ej modellerad)
  'Lebensohl 3NT (utgång) | härlett alert=false ≠ register true': 'L',
  'Lebensohl 3NT (öppnaren väljer utgång) | härlett alert=false ≠ register true': 'L',
  'Lebensohl 3♣ (tvunget relä-svar) | härlett alert=false ≠ register true': 'L',
  'Lebensohl 3-läge (svag, rättar) | härlett alert=false ≠ register true': 'L',
  'Lebensohl naturligt 2-läge | härlett alert=false ≠ register true': 'L',
  // M — motoravvikelse (motorn generisk, läsaren mer exakt)
  'krav – ny färg | härlett alert=true ≠ register false': 'M',
  'upplysningsdubbling | härlett alert=false ≠ register true': 'M',
  'svar på återöppningsdubbling | härlett alert=true ≠ register false': 'M',
}

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
    undantag: new Map<string, Hål>(), // störda undantag (dokumenterade, utanför grinden)
  }
  const bumpa = (m: Map<string, Hål>, nyckel: string, exempel: string) => {
    const h = m.get(nyckel)
    if (h) h.antal++
    else m.set(nyckel, { nyckel, antal: 1, exempel })
  }
  // Störd avvikelse: dokumenterade undantag (STÖRDA_UNDANTAG) räknas utanför
  // grinden; övriga i grindkartan (som ska drivas till noll).
  const bumpStört = (grind: Map<string, Hål>, nyckel: string, exempel: string) => {
    const skäl = STÖRDA_UNDANTAG[nyckel]
    if (skäl) bumpa(hål.undantag, `[${skäl}] ${nyckel}`, exempel)
    else bumpa(grind, nyckel, exempel)
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
        if (m.forcing !== reg) {
          const key = `${call.rule} | härlett ${m.forcing ?? '—'} ≠ register ${reg}`
          if (lugn) bumpa(hål.krav, key, ex)
          else bumpStört(hål.kravStört, key, ex)
        }
      }
      if (m.alert !== regAlert) {
        const key = `${call.rule} | härlett alert=${m.alert} ≠ register ${regAlert}`
        if (lugn) bumpa(hål.alert, key, ex)
        else bumpStört(hål.alertStört, key, ex)
      }
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
    `GRIND (störda auktioner, familj 9): kravnivå ${summa(hål.kravStört)} bud i ${hål.kravStört.size} mönster · alert ${summa(hål.alertStört)} bud i ${hål.alertStört.size} mönster · registerhål ${summa(hål.registerStört)} bud i ${hål.registerStört.size} regler`,
    `Störda undantag (dokumenterade, utanför grinden — ärlig inferens golv): ${summa(hål.undantag)} bud i ${hål.undantag.size} mönster`,
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
    '=== STÖRDA UNDANTAG (utanför grinden, dokumenterade) ===',
    ...lista(hål.undantag),
    '',
    '=== PASS MED REGEL ===',
    ...lista(hål.pass),
  ]
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/betydelsesvep.txt', rader.join('\n'), 'utf8')

  // GRINDEN: ostörda OCH störda auktioner ska vara noll på det avgörbara. De
  // störda undantagen (kortberoende/cue-nivå/Lebensohl/motoravvikelse) är listade
  // separat ovan (ägarbeslut 2026-09-10). Ett NYTT strukturellt hål (inte i
  // STÖRDA_UNDANTAG) gör svepet rött — laga det, lägg inte till en undantagsrad.
  const grind =
    summa(hål.krav) + summa(hål.alert) + summa(hål.register) + summa(hål.kravStört) + summa(hål.alertStört) + summa(hål.registerStört)
  expect(grind, `betydelsesvepets grind ska vara 0 (se revisor-output/betydelsesvep.txt)`).toBe(0)
  // Varje undantagsrad måste faktiskt förekomma — inga döda rader som ruttnar.
  const döda = Object.keys(STÖRDA_UNDANTAG).filter((k) => ![...hål.undantag.values()].some((h) => h.nyckel.endsWith(k)))
  expect(döda, 'döda STÖRDA_UNDANTAG-rader (förekommer inte längre — ta bort dem)').toEqual([])
})
