// RKC-TRUMFSONDEN (ägarbeslut 2026-10-02, §6.1): "4NT gäller alltid den senast
// ÄKTA bjudna färgen" — för den som frågar OCH den som svarar. Sonden låter
// bottarna buda ett brett fält givar och jämför, för varje essfråga:
//
//   · svararens trumf  = den trumf svararens rad faktiskt räknar nyckelkort i:
//     slamradens lästa situation (`slamSituation`) när den svarade, annars
//     `slamAskTrump` (raden slam-forts), och
//   · frågarens trumf  = färgen frågaren RÄKNAR svaret i: den essfrågan själv
//     anger ("… ♣ som trumf"), annars färgen hen sedan placerar i.
//
// Olika färger = frågaren läser svaret i en annan trumf än svararen gav det i
// (frö 20437408: 7♠ med ♠KQ ute). Noll är målet.
//
//   $env:RKCTRUMF='1'; npx vitest run src/lib/engine/rkc-trumf.probe.test.ts
//   $env:RKCTRUMF_RANGE='20270001-20470000'   (standard — 200 000 givar)
//
// Utdata: revisor-output/rkc-trumf.txt
import { it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Suit } from '../../types/bridge'
import type { Deal } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { auctionFacts, PARTNER } from './auction-facts'
import { slamSituation } from './auction-decide'
import { auctionComplete, decideCallTraced } from './auction-live'
import { slamAskTrump } from './slam-answer-continuations'
import { senastAktaFarg } from './kontrollbud'
import { dealFromSeed } from './revisor'

/** Bottarnas auktion med källan (tabellraden) per bud. */
function traced(deal: Deal): { history: ResolvedCall[]; källor: string[] } | null {
  const history: ResolvedCall[] = []
  const källor: string[] = []
  while (!auctionComplete(history)) {
    if (history.length >= 60) return null
    const t = decideCallTraced(deal, history, seatAt(deal.dealer, history.length))
    history.push(t.call)
    källor.push(t.källa)
  }
  return { history, källor }
}

const ON = process.env.RKCTRUMF === '1'
const RANGE = process.env.RKCTRUMF_RANGE ?? '20270001-20470000'
const SUIT: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

it.skipIf(!ON)('rkc-trumfsonden', { timeout: 0 }, () => {
  const m = /^(\d+)-(\d+)$/.exec(RANGE.trim())!
  const [a, b] = [Number(m[1]), Number(m[2])]
  let frågor = 0
  let jämförbara = 0
  let efterKontrollbud = 0
  const utanKontrollbud = new Map<string, number>()
  const olika = new Map<string, { antal: number; exempel: string }>()
  // Andra mätningen: REGELN mot frågarens placering — följer bottarnas egna
  // essfrågor ägarens regel "senast äkta bjudna färg"?
  const regelbrott = new Map<string, { antal: number; exempel: string }>()
  for (let seed = a; seed <= b; seed++) {
    const tr = traced(dealFromSeed(seed))
    if (!tr) continue
    const { history, källor } = tr
    const i = history.findIndex((c) => c.bid === '4NT' && /RKC/.test(c.rule ?? ''))
    if (i < 0) continue
    frågor++
    const asker = history[i].seat
    // Tredje mätningen (ägaren 2026-10-04: "gärna kontrollbud före"): föregicks
    // essfrågan av minst ett kontrollbud från vår sida?
    const medKontrollbud = history.slice(0, i).some((c) => (c.seat === asker || c.seat === PARTNER[asker]) && /cue-bid|kontrollbud/.test(c.rule ?? ''))
    if (medKontrollbud) efterKontrollbud++
    else {
      const väg = history.slice(0, i).filter((c) => c.bid !== 'P').map((c) => c.rule ?? '?').join(' → ')
      utanKontrollbud.set(väg, (utanKontrollbud.get(väg) ?? 0) + 1)
    }
    const svarIdx = history.findIndex((c, k) => k > i && c.seat === PARTNER[asker] && c.bid !== 'P')
    if (svarIdx < 0) continue
    const fSvar = auctionFacts(history.slice(0, svarIdx), PARTNER[asker])
    // Bara de två rader vars trumfläsning sonden kan återskapa (cue-höjningens
    // egen modul m.fl. räknar i sin kända högfärg och jämförs inte här).
    if (källor[svarIdx] !== 'tabell:slam' && källor[svarIdx] !== 'tabell:slam-forts') continue
    const viaSlamraden = källor[svarIdx] === 'tabell:slam'
    const läst = viaSlamraden ? slamSituation(fSvar) : null
    const svararensTrumf = läst?.setup?.trump ?? läst?.trump ?? slamAskTrump(fSvar)
    // Frågarens placering: första färgbudet av frågaren efter svaret som är ett
    // stopp/slamavslut (damfrågan och kungfrågan hoppas över).
    const placering = history.slice(i + 1).find((c) => c.seat === asker && /^[567][CDHS]$/.test(c.bid) && /stopp|slamavslut/.test(c.rule ?? ''))
    if (!placering || !svararensTrumf) continue
    jämförbara++
    const sagd = /([♣♦♥♠]) som trumf/.exec(history[i].explanation ?? '')
    const frågarensTrumf = sagd ? ({ '♣': 'clubs', '♦': 'diamonds', '♥': 'hearts', '♠': 'spades' } as Record<string, Suit>)[sagd[1]] : SUIT[placering.bid[1]]
    const äkta = senastAktaFarg(history, asker, i)
    if (äkta !== frågarensTrumf) {
      const nyckel = history.slice(0, i).filter((c) => c.bid !== 'P').map((c) => c.rule ?? '?').join(' → ')
      const ex = `frö ${seed} · ${history.slice(0, i).filter((c) => c.bid !== 'P').map((c) => `${c.bid}${c.rule ? `[${c.rule}]` : ''}`).join(' · ')} · 4NT … ${placering.bid} — senast äkta färg: ${äkta ?? 'ingen (sang)'}, frågaren placerar i ${frågarensTrumf}`
      const h = regelbrott.get(nyckel)
      if (h) h.antal++
      else regelbrott.set(nyckel, { antal: 1, exempel: ex })
    }
    if (frågarensTrumf === svararensTrumf) continue
    const före = history.slice(0, i).filter((c) => c.bid !== 'P').map((c) => `${c.bid}${c.rule ? `[${c.rule}]` : ''}`).join(' · ')
    const nyckel = history.slice(0, i).filter((c) => c.bid !== 'P').map((c) => c.rule ?? '?').join(' → ')
    const ex = `frö ${seed} · ${före} · 4NT · ${history[svarIdx].bid}<${källor[svarIdx]}> … ${placering.bid}[${placering.rule}] — svararen räknar ${svararensTrumf}, frågaren placerar i ${frågarensTrumf}`
    const h = olika.get(nyckel)
    if (h) h.antal++
    else olika.set(nyckel, { antal: 1, exempel: ex })
  }
  const antal = [...olika.values()].reduce((s, h) => s + h.antal, 0)
  const rader = [
    `RKC-TRUMFSONDEN — frön ${RANGE}: ${frågor} essfrågor, ${jämförbara} med färgplacering, ${antal} där frågare och svarare läser OLIKA trumf (${olika.size} budvägar)`,
    '',
    ...[...olika.entries()].sort((x, y) => y[1].antal - x[1].antal).map(([k, h]) => `  [${String(h.antal).padStart(4)}×] ${k}\n          ${h.exempel}`),
  ]
  const brott = [...regelbrott.values()].reduce((s, h) => s + h.antal, 0)
  rader.push('', `REGELN "senast äkta bjudna färg" mot frågarens placering: ${brott} avvikelser (${regelbrott.size} budvägar)`, '',
    ...[...regelbrott.entries()].sort((x, y) => y[1].antal - x[1].antal).map(([k, h]) => `  [${String(h.antal).padStart(4)}×] ${k}
          ${h.exempel}`))
  rader.push('', `KONTROLLBUD FÖRE ESSFRÅGAN: ${efterKontrollbud} av ${frågor} essfrågor föregicks av minst ett kontrollbud. Vanligaste vägarna UTAN:`, '',
    ...[...utanKontrollbud.entries()].sort((x, y) => y[1] - x[1]).slice(0, 15).map(([k, n]) => `  [${String(n).padStart(4)}×] ${k}`))
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/rkc-trumf.txt', rader.join('\n'), 'utf8')
  expect(antal, 'frågare och svarare ska läsa samma trumf (se revisor-output/rkc-trumf.txt)').toBe(0)
})
