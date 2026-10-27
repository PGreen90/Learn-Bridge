// Jämför två speldiagnos-körningar (fyra skivor var, se docs/speldiagnos.md):
//   node scripts/jamfor-speldiagnos.mjs s9a s9c
// Läser revisor-output/speldiagnos-<pre>-<a|b|c|d>.json och skriver aggregat + per giv
// där spelförarens faktiska stick ändrats (samma kontrakt).
import { readFileSync } from 'node:fs'
const [A, B] = process.argv.slice(2)
if (!A || !B) { console.error('användning: node scripts/jamfor-speldiagnos.mjs <prefixA> <prefixB>'); process.exit(1) }
const dir = 'revisor-output/'
const load = (pre) => ['a', 'b', 'c', 'd'].map((x) => JSON.parse(readFileSync(`${dir}speldiagnos-${pre}-${x}.json`, 'utf8')))
const a = load(A), b = load(B)
const sum = (runs, f) => runs.reduce((n, r) => n + f(r), 0)
const roll = (runs, namn, falt) => sum(runs, (r) => (r.spel.perRoll.find((p) => p.roll === namn)?.[falt] ?? 0))
const rad = (p, r) => `${p}: rent spelade ${sum(r, (x) => x.spel.rentSpelade)}/${sum(r, (x) => x.spel.spelade)} · spelförare stick ${roll(r, 'spelforare', 'stick')} (fel ${roll(r, 'spelforare', 'fel')}) · försvar stick ${roll(r, 'forsvar', 'stick')} (fel ${roll(r, 'forsvar', 'fel')}) · utspel ${roll(r, 'utspel', 'stick')}`
console.log(rad(A, a))
console.log(rad(B, b))
const da = new Map(a.flatMap((r) => r.domar).map((d) => [d.seed, d]))
const db = new Map(b.flatMap((r) => r.domar).map((d) => [d.seed, d]))
let netto = 0, plus = 0, minus = 0, andradeKontrakt = 0
const diffs = []
for (const [seed, x] of da) {
  const y = db.get(seed)
  if (!y) continue
  if (x.kontrakt !== y.kontrakt) { andradeKontrakt++; continue }
  const d = (y.actualTricks ?? 0) - (x.actualTricks ?? 0)
  if (d !== 0) { diffs.push({ seed, kontrakt: x.kontrakt, d, ddTricks: x.ddTricks, fran: x.actualTricks, till: y.actualTricks }); netto += d; if (d > 0) plus++; else minus++ }
}
console.log(`spelförarens faktiska stick netto ${netto >= 0 ? '+' : ''}${netto} (${plus} givar fler, ${minus} färre; ${andradeKontrakt} med annat kontrakt)`)
const avst = (m) => [...m.values()].reduce((n, d) => n + Math.abs((d.actualTricks ?? 0) - (d.ddTricks ?? 0)), 0)
console.log(`summa |spelat − DD|: ${A} ${avst(da)} · ${B} ${avst(db)}`)
for (const x of diffs.sort((p, q) => q.d - p.d)) console.log(`  ${x.seed} ${x.kontrakt}: ${x.fran} → ${x.till} (DD ${x.ddTricks}) ${x.d > 0 ? '+' : ''}${x.d}`)
