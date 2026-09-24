// KONTROLLBUDSSVEPET (2026-09-24, ägarbeslut "ny färg när färgen är satt = alltid
// kontrollbud, tillsvidare på 4-läget"): budar givar med fyra bottar, hittar varje
// läge där vår sida satt en färg ostört, lägger ett kontrollbud på 4-läget (som en
// människa kunde) och läser partnerns svar. HÅL = pass; KONSTIGT = varken en
// kontroll på 4-läget eller trumffärgen. Före/efter-mätning av den allmänna regeln.
//   $env:KONTROLL='1'; npx vitest run src/lib/engine/kontrollbud.probe.test.ts
// Utdata: revisor-output/kontrollbud.txt
import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { formatHand } from '../felrapport'
import { auctionComplete, decideCall, decideCallTraced } from './auction-live'
import { legalCalls } from './auction-rules'
import { parseContractBid, PARTNER } from './auction-facts'
import { dealFromSeed } from './revisor'
import { kontrollbudslage, sattFarg } from './kontrollbud'

const ON = process.env.KONTROLL === '1'
const N = Number(process.env.KONTROLL_N ?? 4000)
const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const side = (s: Seat) => (s === 'N' || s === 'S' ? 'NS' : 'EW')

it.skipIf(!ON)('kontrollbudssvepet', () => {
  const stat = new Map<string, number>()
  const ex = new Map<string, string[]>()
  let lagen = 0
  for (let seed = 20290001; seed < 20290001 + N; seed++) {
    const deal = dealFromSeed(seed)
    const h: ResolvedCall[] = []
    let guard = 0
    let prövad = false
    while (!auctionComplete(h) && guard++ < 60 && !prövad) {
      const seat = SEATS[(SEATS.indexOf(deal.dealer) + h.length) % 4]
      const ostört = !h.some((c) => side(c.seat) !== side(seat) && c.bid !== 'P')
      const satt = ostört ? sattFarg(h, seat) : null
      if (satt) {
        const T = satt.trump[0].toUpperCase()
        const legal = legalCalls(h, seat)
        for (const cue of legal.filter((b) => { const c = parseContractBid(b); return c && ((c.level === 4 && c.strain !== 'NT' && c.strain !== T) || (b === '3S' && T === 'H')) })) {
          const h2 = [...h, { seat, bid: cue }, { seat: SEATS[(SEATS.indexOf(seat) + 1) % 4], bid: 'P' }] as ResolvedCall[]
          if (!kontrollbudslage(h2, seat)) continue
          prövad = true
          lagen++
          const p = PARTNER[seat]
          const t = decideCallTraced(deal, h2, p)
          const svar = t.call.bid
          const sc = parseContractBid(svar)
          const klass = svar === "P" ? "HÅL (pass)" : sc && sc.strain === T ? "trumf" : svar === "4NT" ? "4NT (essfrågan)" : sc && sc.level === 4 && sc.strain !== "NT" ? "kontroll 4-läget" : `KONSTIGT (${svar})`
          const k = `${klass} · ${t.källa}`
          stat.set(k, (stat.get(k) ?? 0) + 1)
          const lista = ex.get(klass) ?? []
          if (lista.length < 6) lista.push(`${seed} ${p} ${formatHand(deal.hands[p])} | ${h2.map((c) => `${c.seat}:${c.bid}`).join(' ')} → ${svar} (${t.källa}${t.call.rule ? ' / ' + t.call.rule : ''})`)
          ex.set(klass, lista)
        }
      }
      if (prövad) break
      h.push(decideCall(deal, h, seat))
    }
  }
  const ut = [`Kontrollbudssvepet: ${N} givar, ${lagen} provade kontrollbud`, '', ...[...stat].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${String(v).padStart(5)}  ${k}`), '']
  for (const [k, l] of ex) ut.push(`== ${k}`, ...l, '')
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/kontrollbud.txt', ut.join('\n'))
}, 3_600_000)
