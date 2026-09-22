// SUNT FÖRNUFT-MÄTNINGEN (NU sedan 2026-09-22, docs/sunt-fornuft-plan.md).
// Ägarens oro: motorn "reagerar svagt" — när ingen tabellrad träffar blir det
// PASS UTAN REGEL, utan tanke. Riggen budar N givar, fångar varje sådant pass
// och klassar LÄGET ur motorns egna fakta (auctionFacts) + egen hand, så att
// hålen kan byggas igen ett i taget, med facit, i stället för en blind catch-all.
//
//   $env:SUNT='1'; npx vitest run src/lib/engine/sunt-fornuft.probe.test.ts
//   $env:SUNT='1'; $env:SUNT_N='20000'; $env:SUNT_FROM='20290001'; …
//
// Utdata: revisor-output/sunt-fornuft.txt (kategorier + exempel) och
// revisor-output/sunt-fornuft.json (alla fångade lägen, för diff före/efter).
// Varje kategori är en HYPOTES om ett hål — inte ett facit. Läs exemplen.

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Seat } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { auctionFacts, parseContractBid, PARTNER, type AuctionFacts } from './auction-facts'
import { auctionComplete, decideCallTraced } from './auction-live'
import { hcp, lengths } from './hand'
import { dealFromSeed } from './revisor'
import { formatHand } from '../felrapport'
import { side } from './play'

const ON = process.env.SUNT === '1'
const N = Number(process.env.SUNT_N ?? 8000)
const FROM = Number(process.env.SUNT_FROM ?? 20290001)

interface Fangat {
  seed: number
  seat: Seat
  hand: string
  hp: number
  auktion: string
  kategori: string
}

const isGame = (bid: string): boolean => {
  const cb = parseContractBid(bid)
  if (!cb) return false
  return (cb.strain === 'NT' && cb.level >= 3) || ((cb.strain === 'H' || cb.strain === 'S') && cb.level >= 4) || cb.level >= 5
}

/**
 * Klassar ett pass utan regel. Ordningen är från "säkert rätt" till "troligen hål";
 * första träffen gäller. Kategorierna är hypoteser — bokstaven är stabil så att
 * rapporterna går att jämföra över tid.
 */
function klassa(f: AuctionFacts, hand: ReturnType<typeof dealFromSeed>['hands'][Seat]): string {
  const p = hcp(hand)
  const len = lengths(hand)
  const last = f.lastContract
  if (!last) return 'A öppningsläge (ingen har bjudit)'
  const ourLast = side(last.seat) === side(f.seat)
  const myBids = f.history.filter((c) => c.seat === f.seat && c.bid !== 'P')
  const partnerBids = f.history.filter((c) => c.seat === PARTNER[f.seat] && c.bid !== 'P')
  const level = parseContractBid(last.bid)!.level
  const fit = f.partnerLastSuit && f.partnerLastSuit.strain !== 'NT' ? len[({ C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' } as const)[f.partnerLastSuit.strain as 'C' | 'D' | 'H' | 'S']] : 0
  const longest = Math.max(len.clubs, len.diamonds, len.hearts, len.spades)
  const doubledByThem = f.lastNonPass?.bid === 'X' && side(f.lastNonPass.seat) !== side(f.seat)
  const partnerDoubled = f.lastNonPass?.bid === 'X' && f.lastNonPass.seat === PARTNER[f.seat]

  if (f.force && !f.partnerSignedOff) return 'K KRAV ligger på mig — pass är systemfel'
  if (partnerDoubled) return 'L partnern dubblade senast, jag passar (straff? eller tappat svar på X)'
  if (ourLast && isGame(last.bid)) return 'B vi står i utgång eller högre'
  if (ourLast && f.partnerSignedOff) return 'C partnern avslutade'
  if (ourLast && doubledByThem) return 'M de dubblade vårt bud — pass utan regel (XX/flykt/ok?)'
  if (ourLast && myBids.length === 0 && partnerBids.length > 0) return p < 6 ? 'D1 partnern bjöd, jag objuden och svag (<6)' : `D2 partnern bjöd, jag OBJUDEN med ${p >= 12 ? '12+' : '6–11'} hp`
  if (ourLast) return p >= 12 ? 'E2 partnern bjöd senast, jag har bjudit, 12+ hp' : 'E1 partnern bjöd senast, jag har bjudit, <12 hp'
  // Motståndarna bjöd senast.
  if (isGame(last.bid)) return p >= 14 ? 'F2 de står i utgång+, jag har 14+ (straff/offring?)' : 'F1 de står i utgång+'
  if (myBids.length === 0 && partnerBids.length === 0 && p >= 12) return 'G1 de bjöd, vår sida helt tyst, jag har 12+ (inkliv/X saknas?)'
  if (myBids.length === 0 && p >= 12) return 'G2 de bjöd, partnern har bjudit, jag objuden med 12+'
  if (fit >= 3 && p >= 6 && level <= 3) return `H de bjöd på ${level}-läget, jag har ${fit}-korts fit med partnern och ${p} hp`
  if (longest >= 6 && p >= 8 && level <= 3) return `I de bjöd på ${level}-läget, egen ${longest}-kortsfärg och 8+ hp`
  if (f.passOut && p >= 10) return 'N utpassningssits med 10+ hp (balansering saknas?)'
  return 'J de bjöd, inget att säga (<12, ingen fit, ingen färg)'
}

it.skipIf(!ON)('sunt förnuft: mät pass utan regel', () => {
  const fangat: Fangat[] = []
  let bud = 0
  for (let seed = FROM; seed < FROM + N; seed++) {
    const deal = dealFromSeed(seed)
    const history: ResolvedCall[] = []
    let guard = 0
    while (!auctionComplete(history) && guard++ < 60) {
      const seat = seatAt(deal.dealer, history.length)
      const t = decideCallTraced(deal, history, seat)
      bud++
      if (t.källa === 'pass (ingen regel)') {
        const f = auctionFacts(history, seat)
        fangat.push({
          seed, seat, hand: formatHand(deal.hands[seat]), hp: hcp(deal.hands[seat]),
          auktion: history.map((c) => `${c.seat}:${c.bid}`).join(' '),
          kategori: klassa(f, deal.hands[seat]),
        })
      }
      history.push(t.call)
    }
  }
  const per = new Map<string, Fangat[]>()
  for (const x of fangat) per.set(x.kategori, [...(per.get(x.kategori) ?? []), x])
  const rader = [`Sunt förnuft-mätningen: ${N} givar från ${FROM}, ${bud} bud, ${fangat.length} pass utan regel`, '']
  const nyckel = (k: string) => k.replace(/\d+-korts fit|\d+-kortsfärg|\d+ hp|\d-läget/g, (m) => m.replace(/\d+/, '#'))
  const grupp = new Map<string, Fangat[]>()
  for (const [k, v] of per) grupp.set(nyckel(k), [...(grupp.get(nyckel(k)) ?? []), ...v])
  for (const [k, v] of [...grupp].sort((a, b) => a[0].localeCompare(b[0]))) {
    rader.push(`${String(v.length).padStart(6)}  ${k}`)
  }
  rader.push('', '=== Exempel per kategori (upp till 8) ===')
  for (const [k, v] of [...grupp].sort((a, b) => a[0].localeCompare(b[0]))) {
    rader.push('', `--- ${k} (${v.length})`)
    for (const x of v.slice(0, 8)) rader.push(`${x.seed} ${x.seat} ${x.hand} (${x.hp})  |  ${x.auktion}`)
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/sunt-fornuft.txt', rader.join('\n'))
  writeFileSync('revisor-output/sunt-fornuft.json', JSON.stringify(fangat))
}, 600_000)
