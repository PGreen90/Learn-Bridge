// FÖRKLARINGSSVEPET (FAS 1 i budförklarings-revisionen) — täckningsmätning.
//
// Frågan ägaren ställde: "har vi missat att förklara något bud någonstans?"
// Det här svepet svarar objektivt. Det låter motorn buda ett brett fält givar
// (botAuction, alla fyra säten) och klassar VARJE bud efter förklaringens
// kvalitet, ur BÅDA ytorna spelaren möter:
//
//   (A) Generativ förklaring — texten för DINA egna bud (call.explanation).
//       Flaggas: tom, eller ett "osäkert" fall (rule 'oklart' / uncertain-fraser).
//   (B) Systemisk tolkning — texten motståndarnas bud får i dolda-händer-spel
//       (tolkningslagret läser bara auktionen). Flaggas: confidence 'gissning'.
//
// Utöver hålen bygger svepet en INVENTERING: alla distinkta förklarings-
// skelett per regel (siffror/färger bortnormaliserade), med ett läsbart exempel
// och en frekvens. Det är råmaterialet till FAS 2-katalogen.
//
// Kör:  $env:FORKLARINGSSVEP='1'; npx vitest run src/lib/engine/forklaringssvep.probe.test.ts
// Antal frön styrs av $env:SVEP_N (default 4000).
// Utdata: revisor-output/forklaringssvep.txt (rapport) + .json (inventering).
import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dealFromSeed, botAuction } from './revisor'
import { interpretCall } from './auction-interpret'
import type { ResolvedCall } from '../bidding'

const ON = process.env.FORKLARINGSSVEP === '1'
const N = Number(process.env.SVEP_N ?? 4000)

// "Osäkra" generativa förklaringar bär en av dessa fraser (uncertain-flaggan
// följer inte med in i ResolvedCall, men texten gör det).
const OSAKER_FRAS = [
  'motorn hittar inget tydligt',
  'inget tydligt återbud',
  '3NT osäker',
  'osäker)',
  'storslam kan finnas, men exakt fråga',
]

/** Normaliserar en förklaring till ett SKELETT: siffror→#, färger→⟨färg⟩. Så att
 *  "17 hp, 4+ hjärter → 1♥ (ny färg…)" och samma text med spader delar signatur. */
function skelett(text: string): string {
  return text
    .replace(/\d+/g, '#')
    .replace(/[♣♦♥♠]/g, '♦')
    .replace(/klöver|ruter|hjärter|spader/g, 'färg')
    .replace(/högfärg|lågfärg/g, 'färg')
    .trim()
}

interface Bucket {
  rule: string
  skelett: string
  exempel: string
  antal: number
  froExempel: number
}

/** Tolkar budet systemiskt (regel + förklaring bortskalade) — det motståndaren
 *  ser i dolda-händer-spel. Speglar systemicText() i AuctionGrid. */
function systemisk(calls: ResolvedCall[], index: number) {
  const stripped = calls.map((c, i) => (i === index ? { seat: c.seat, bid: c.bid } : c))
  return interpretCall(stripped, index)
}

it.skipIf(!ON)('förklaringssvep', () => {
  const inventering = new Map<string, Bucket>() // alla generativa förklaringar
  const hal = {
    tom: [] as string[], // saknar/tom förklaring
    osaker: new Map<string, Bucket>(), // 'oklart'/uncertain-fraser
    gissning: new Map<string, Bucket>(), // systemisk tolkning = gissning
  }
  let givar = 0
  let bud = 0

  const bumpa = (map: Map<string, Bucket>, rule: string, text: string, seed: number) => {
    const sk = skelett(text)
    const key = `${rule}||${sk}`
    const b = map.get(key)
    if (b) b.antal++
    else map.set(key, { rule, skelett: sk, exempel: text, antal: 1, froExempel: seed })
  }

  for (let seed = 1; seed <= N; seed++) {
    let history: ResolvedCall[] | null = null
    try {
      history = botAuction(dealFromSeed(seed))
    } catch {
      continue // enskild giv kraschar → hoppa (räknas inte som förklaringshål)
    }
    if (!history) continue
    givar++
    history.forEach((call, i) => {
      if (call.bid === 'P') return // pass förklaras separat, sällan intressant här
      bud++
      const rule = call.rule ?? '—'
      const text = (call.explanation ?? '').trim()

      // (A) Generativ förklaring
      if (!text) {
        hal.tom.push(`frö ${seed} · ${call.seat} ${call.bid} [${rule}]`)
      } else {
        bumpa(inventering, rule, text, seed)
        if (OSAKER_FRAS.some((f) => text.toLowerCase().includes(f.toLowerCase()))) {
          bumpa(hal.osaker, rule, text, seed)
        }
      }

      // (B) Systemisk tolkning (motståndarens vy)
      try {
        const s = systemisk(history!, i)
        if (s.confidence === 'gissning') bumpa(hal.gissning, rule, s.text, seed)
      } catch {
        /* tolkningen ska aldrig kasta; om den gör det är det värt en separat bugg */
      }
    })
  }

  const sorterat = (m: Map<string, Bucket>) => [...m.values()].sort((a, b) => b.antal - a.antal)
  const rader: string[] = []
  rader.push(`FÖRKLARINGSSVEP — ${givar} budade givar, ${bud} icke-pass-bud, frön 1..${N}`)
  rader.push(`Distinkta generativa förklarings-skelett: ${inventering.size}`)
  rader.push('')
  rader.push(`### HÅL 1 — helt utan förklaring (${hal.tom.length} bud)`)
  hal.tom.slice(0, 40).forEach((r) => rader.push(`  ${r}`))
  rader.push('')
  rader.push(`### HÅL 2 — "osäkra" förklaringar (motorn erkänner att den famlar) — ${sorterat(hal.osaker).length} skelett`)
  sorterat(hal.osaker).forEach((b) => rader.push(`  [${b.antal}×] (${b.rule}) ${b.exempel}   ⟨frö ${b.froExempel}⟩`))
  rader.push('')
  rader.push(`### HÅL 3 — systemisk tolkning blir GISSNING (motståndarens vy) — ${sorterat(hal.gissning).length} skelett`)
  sorterat(hal.gissning).forEach((b) => rader.push(`  [${b.antal}×] (${b.rule}) ${b.exempel}   ⟨frö ${b.froExempel}⟩`))
  rader.push('')
  rader.push(`### INVENTERING — alla distinkta generativa förklarings-skelett (för FAS 2)`)
  sorterat(inventering).forEach((b) => rader.push(`  [${b.antal}×] (${b.rule}) ${b.exempel}`))

  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/forklaringssvep.txt', rader.join('\n'), 'utf8')
  writeFileSync(
    'revisor-output/forklaringssvep.json',
    JSON.stringify(
      {
        givar,
        bud,
        distinktaSkelett: inventering.size,
        hal: {
          tom: hal.tom,
          osaker: sorterat(hal.osaker),
          gissning: sorterat(hal.gissning),
        },
        inventering: sorterat(inventering),
      },
      null,
      2,
    ),
    'utf8',
  )
})
