// AVBLOCKERINGS-RIGGEN (NU 2026-10-10, ägaren efter Dagens tävling bricka 7) —
// körs ALDRIG i `npm test`/deploygrinden (skipIf), bara på uttrycklig begäran:
//
//   PowerShell:  $env:AVBLOCK='1'; npx vitest run src/lib/engine/avblock.probe.test.ts
//   Bash:        AVBLOCK=1 npx vitest run src/lib/engine/avblock.probe.test.ts
//
// Vad den mäter: givarna spelas med den skarpa boten (avblockeringen PÅ). I
// VARJE beslut räknas också vad tumregeln/bot-hjärnan valt UTAN filtret och vad
// varje ingångsvariant (A / AB / ABC, unblock.ts) hade valt. Där något skiljer
// sig döms korten mot double-dummy (solveAllCards: DD-poängen för varje lagligt
// kort). Ut faller per variant: antal byten, hur många DD vann/förlorade och
// nettot i stick. DD ser alla kort — en kostnad är en larmklocka, inte en dom;
// en avblockering vinner ofta först när spelföraren släpper in partnern (DD
// "vet" att han inte behöver), så nollor är väntade.
//
// Rattar: AVBLOCK_DEALS (200), AVBLOCK_SEED (20260721), AVBLOCK_OFFSET (0),
// AVBLOCK_OUT (avblock-latest.txt), AVBLOCK_BILLIG=1 (tumregler hela vägen).
// Utdata: revisor-output/ (gitignorad).

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Card, Rank, Suit } from '../../types/bridge'
import { contractFromCalls } from './auction-contract'
import { mulberry32 } from './deal'
import { buildHandModel } from './hand-model'
import { botCardSmartBase, botCardSmartReasoned, budstyrtOpeningLead, type SmartOpts } from './play-bot'
import { currentWinner, isComplete, legalCards, PARTNER_SEAT, playCard, side, startPlay } from './play'
import { botDecisionSeed, playIndexOf } from './play-seed'
import { shownVoids } from './card-counting'
import { applyOpeningLeadSignal } from './signal-decode'
import { botAuction, dealFromSeed } from './revisor'
import { getDds, solveAllCards } from './revisor-dds'
import { avblockering, type Ingangslagen } from './unblock'

const DEALS = Number(process.env.AVBLOCK_DEALS ?? 200)
const SEED = Number(process.env.AVBLOCK_SEED ?? 20260721)
const OFFSET = Number(process.env.AVBLOCK_OFFSET ?? 0)
const OUT = process.env.AVBLOCK_OUT ?? 'avblock-latest.txt'
const BILLIG = process.env.AVBLOCK_BILLIG === '1'

const SUIT_CHAR: Record<Suit, string> = { spades: 'S', hearts: 'H', diamonds: 'D', clubs: 'C' }
const RANK_ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const kort = (c: Card) => SUIT_CHAR[c.suit] + (c.rank === '10' ? 'T' : c.rank)
const fargStr = (cards: Card[], suit: Suit) =>
  cards
    .filter((c) => c.suit === suit)
    .sort((a, b) => RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank))
    .map((c) => (c.rank === '10' ? 'T' : c.rank))
    .join('') || '-'

const VARIANTER: Ingangslagen[] = ['A', 'AB', 'ABC']

it.skipIf(!process.env.AVBLOCK)(`avblockerings-riggen: ${DEALS} givar, frö ${SEED}+${OFFSET}`, { timeout: 0 }, async () => {
  const t0 = Date.now()
  const dds = await getDds()
  const stat = Object.fromEntries(VARIANTER.map((v) => [v, { byten: 0, vinst: 0, forlust: 0, netto: 0 }]))
  const rader: string[] = []
  const katStat = new Map<string, { byten: number; vinst: number; forlust: number; netto: number }>()
  let beslut = 0

  for (let i = 0; i < DEALS; i++) {
    const seed = SEED + OFFSET + i
    const deal = dealFromSeed(seed)
    const history = botAuction(deal)
    const contract = history && contractFromCalls(history)
    if (!history || !contract) continue
    let st = startPlay(deal, contract)
    let guard = 0
    while (!isComplete(st) && guard++ < 60) {
      const seat = st.toAct
      const mk = () => mulberry32(botDecisionSeed(seed, playIndexOf(st.completedTricks.length, st.currentTrick.length)))
      const smart: SmartOpts = BILLIG ? { rng: mk(), maxCardsForMC: 0 } : { rng: mk() }
      const skarp = botCardSmartReasoned(st, seat, history, smart)
      const forsta = st.completedTricks.length === 0 && st.currentTrick.length === 0
      if (!forsta && legalCards(st, seat).length > 1) {
        beslut++
        const bas = botCardSmartBase(st, seat, history, BILLIG ? { rng: mk(), maxCardsForMC: 0 } : { rng: mk() })
        const model = buildHandModel(history, { voids: shownVoids(st) })
        applyOpeningLeadSignal(model, st, seat, { budstyrt: budstyrtOpeningLead(st, history) })
        const val: Record<string, Card> = {}
        for (const v of VARIANTER) val[v] = avblockering(st, seat, bas.card, model, { lagen: v })?.card ?? bas.card
        const skiljer = VARIANTER.filter((v) => kort(val[v]) !== kort(bas.card))
        if (skiljer.length > 0) {
          const poang = solveAllCards(dds, st)
          const sc = (c: Card) => poang.find((p) => kort(p.card) === kort(c))?.score ?? NaN
          const b = sc(bas.card)
          const delar: string[] = []
          for (const v of skiljer) {
            const d = sc(val[v]) - b
            const s = stat[v]
            s.byten++
            s.netto += d
            if (d > 0) s.vinst++
            if (d < 0) s.forlust++
            delar.push(`${v}:${kort(val[v])}(${d >= 0 ? '+' : ''}${d})`)
          }
          const led = st.currentTrick[0]?.card.suit ?? bas.card.suit
          // Kategori: kontraktstyp × typ av byte (ur ABC-valet = skarpa standarden).
          const typ = st.trump === null ? 'sang' : led === st.trump ? 'trumffärgen' : 'trumf-sidofärg'
          let slag = 'utspel'
          if (st.currentTrick.length > 0) {
            const w = currentWinner(st.currentTrick, st.trump)
            const wc = st.currentTrick.find((p) => p.seat === w)!.card
            const slar = (c: Card) => c.suit === wc.suit && RANK_ORDER.indexOf(c.rank) > RANK_ORDER.indexOf(wc.rank)
            const egen = side(w) === side(seat)
            slag = egen ? (w === PARTNER_SEAT[seat] && slar(val.ABC) ? 'över partnern' : 'partnern vinner') : slar(val.ABC) ? (slar(bas.card) ? 'högre vinnare' : 'tar sticket') : 'ren avblockering'
          }
          if (kort(val.ABC) !== kort(bas.card)) {
            const d = sc(val.ABC) - b
            for (const key of [typ + ' · ' + slag, typ, slag]) {
              const k = katStat.get(key) ?? { byten: 0, vinst: 0, forlust: 0, netto: 0 }
              k.byten++; k.netto += d; if (d > 0) k.vinst++; if (d < 0) k.forlust++
              katStat.set(key, k)
            }
          }
          const roll = side(seat) === side(contract.declarer) ? 'spelförarsidan' : 'försvaret'
          rader.push(
            `frö ${seed} stick ${st.completedTricks.length + 1} ${seat} (${roll}, ${contract.level}${contract.strain === 'NT' ? 'NT' : SUIT_CHAR[contract.strain]}${contract.declarer}) ` +
              `färg ${SUIT_CHAR[led]}: mina ${fargStr(st.hands[seat], led)} · sticket ${st.currentTrick.map((p) => p.seat + kort(p.card)).join(' ') || '(leder)'} · ` +
              `bas ${kort(bas.card)} → ${delar.join(' ')}`,
          )
        }
      }
      st = playCard(st, skarp.card)
    }
  }

  const L: string[] = []
  L.push(`AVBLOCKERINGS-RIGGEN — ${DEALS} givar, frö ${SEED + OFFSET}..${SEED + OFFSET + DEALS - 1}${BILLIG ? ' · BILLIG' : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  L.push(`Beslut med val (ej öppningsutspel, 2+ lagliga kort): ${beslut}`)
  L.push('DD-dom per byte mot baskortet (+ = avblockeringen vann stick enligt DD, − = kostade):')
  for (const v of VARIANTER) {
    const s = stat[v]
    L.push(`  ${v.padEnd(4)} byten ${String(s.byten).padStart(4)} · DD vinst ${s.vinst} · förlust ${s.forlust} · netto ${s.netto >= 0 ? '+' : ''}${s.netto}`)
  }
  L.push('')
  L.push('ABC per kategori:')
  for (const [k, v] of [...katStat.entries()].sort()) L.push(`  ${k.padEnd(40)} byten ${String(v.byten).padStart(4)} · vinst ${v.vinst} · förlust ${v.forlust} · netto ${v.netto}`)
  L.push('')
  L.push(...rader)
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync(join('revisor-output', OUT), L.join('\n') + '\n', 'utf8')
})
