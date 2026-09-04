// AUKTIONSDIFFEN (motorbytet, docs/motorbyte-plan.md §3) — jämför två körningar
// av auktionsdumpens intervall-läge och listar varje giv där auktionen ÄNDRATS,
// med regel och källa per bud, så att varje ändring kan klassas:
//   (a) samma bud · (b) bättre enligt boken · (c) sämre = fel som lagas före merge.
//
//   node scripts/auktionsdiff.mjs <före.json> <efter.json> [utfil]
//
// Indata: JSON från
//   $env:DUMP_RANGE='20270001-20273000'; $env:DUMP_OUT='revisor-output/auktionsdump-baslinje.json'
//   npx vitest run src/lib/engine/auktionsdump.probe.test.ts
// (baslinjen tas på mergepunkten FÖRE ändringen, efter-filen på arbetsträdet).
//
// Utdata: sammanfattning i konsolen + full lista i utfilen (standard
// revisor-output/auktionsdiff.txt). Avslutar med kod 1 om något bud ändrats,
// så att skriptet kan stå i en grind. "Samma bud men annan regel/källa"
// räknas separat och ger INTE kod 1 — det är klass (a), men syns i listan.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const [föreFil, efterFil, utFil = 'revisor-output/auktionsdiff.txt'] = process.argv.slice(2)
if (!föreFil || !efterFil) {
  console.error('Användning: node scripts/auktionsdiff.mjs <före.json> <efter.json> [utfil]')
  process.exit(2)
}

const läs = (fil) => new Map(JSON.parse(readFileSync(fil, 'utf8')).map((d) => [d.seed, d]))
const före = läs(föreFil)
const efter = läs(efterFil)

/** Auktionen som en rad: "N 1H [regel] <källa> · E P · …" */
const budrad = (calls) =>
  calls === null
    ? '!! auktionen tog aldrig slut'
    : calls.map((c) => `${c.seat} ${c.bid}${c.rule ? ` [${c.rule}]` : ''} <${c.källa}>`).join(' · ')

const buden = (calls) => (calls ?? []).map((c) => `${c.seat}${c.bid}`)
const regler = (calls) => (calls ?? []).map((c) => `${c.seat}${c.bid}|${c.rule ?? ''}|${c.källa}`)

const sammaLista = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

const ändrade = [] // olika bud
const omregel = [] // samma bud, annan regel/källa
const saknas = [] // bara i den ena filen
let lika = 0

for (const [seed, f] of före) {
  const e = efter.get(seed)
  if (!e) {
    saknas.push(`frö ${seed}: finns bara i ${föreFil}`)
    continue
  }
  if (!sammaLista(buden(f.calls), buden(e.calls))) ändrade.push({ seed, f, e })
  else if (!sammaLista(regler(f.calls), regler(e.calls))) omregel.push({ seed, f, e })
  else lika++
}
for (const seed of efter.keys()) if (!före.has(seed)) saknas.push(`frö ${seed}: finns bara i ${efterFil}`)

const rader = []
rader.push(`AUKTIONSDIFF  före: ${föreFil}  efter: ${efterFil}`)
rader.push(`  jämförda givar: ${lika + ändrade.length + omregel.length}`)
rader.push(`  oförändrade: ${lika}`)
rader.push(`  ÄNDRAT BUD: ${ändrade.length}`)
rader.push(`  samma bud, annan regel/källa: ${omregel.length}`)
if (saknas.length) rader.push(`  bara i ena filen: ${saknas.length}`)
rader.push('')

if (ändrade.length) {
  rader.push('=== GIVAR MED ÄNDRAT BUD (klassa varje: a/b/c) ===')
  for (const { seed, f, e } of ändrade) {
    const fb = buden(f.calls)
    const eb = buden(e.calls)
    let i = 0
    while (i < fb.length && i < eb.length && fb[i] === eb[i]) i++
    const fc = f.calls?.[i]
    const ec = e.calls?.[i]
    rader.push(`\n--- frö ${seed} · giv ${f.dealer} · zon ${f.vulnerability} ---`)
    for (const s of ['N', 'E', 'S', 'W']) rader.push(`  ${s}: ${f.hands[s]}`)
    rader.push(`  före:  ${budrad(f.calls)}`)
    rader.push(`  efter: ${budrad(e.calls)}`)
    rader.push(`  första skillnaden: bud ${i + 1} (${fc?.seat ?? ec?.seat ?? '?'})`)
    if (fc) rader.push(`    före  ${fc.bid.padEnd(4)} [${fc.rule ?? '—'}] <${fc.källa}> ${fc.explanation ?? ''}`)
    else rader.push('    före  (auktionen var slut)')
    if (ec) rader.push(`    efter ${ec.bid.padEnd(4)} [${ec.rule ?? '—'}] <${ec.källa}> ${ec.explanation ?? ''}`)
    else rader.push('    efter (auktionen är slut)')
  }
  rader.push('')
}

if (omregel.length) {
  rader.push('=== SAMMA BUD, ANNAN REGEL/KÄLLA (klass a — kontrollera att förklaringen håller) ===')
  for (const { seed, f, e } of omregel) {
    const fr = regler(f.calls)
    const er = regler(e.calls)
    const i = fr.findIndex((x, k) => x !== er[k])
    const fc = f.calls[i]
    const ec = e.calls[i]
    rader.push(`  frö ${seed} bud ${i + 1}: ${fc.seat} ${fc.bid}  [${fc.rule ?? '—'}] <${fc.källa}>  →  [${ec.rule ?? '—'}] <${ec.källa}>`)
  }
  rader.push('')
}

if (saknas.length) {
  rader.push('=== BARA I ENA FILEN ===')
  rader.push(...saknas.map((s) => `  ${s}`))
  rader.push('')
}

mkdirSync(dirname(utFil), { recursive: true })
writeFileSync(utFil, rader.join('\n'), 'utf8')

// Konsolen får sammanfattningen + de första ändrade givarna; resten i utfilen.
console.log(rader.slice(0, 7).join('\n'))
if (ändrade.length) {
  console.log(`Ändrade frön: ${ändrade.map((x) => x.seed).slice(0, 40).join(', ')}${ändrade.length > 40 ? ', …' : ''}`)
}
console.log(`Full lista: ${utFil}`)
process.exit(ändrade.length ? 1 : 0)
