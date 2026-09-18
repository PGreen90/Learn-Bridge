// TREDJE-HAND-RIGGEN (NU 2026-09-18, efter felrapport #75) — körs ALDRIG i
// vanliga `npm test`/deploygrinden (skipIf), bara på uttrycklig begäran:
//
//   PowerShell:  $env:TREDJEHAND='1'; npx vitest run src/lib/engine/tredjehand.probe.test.ts
//   Bash:        TREDJEHAND=1 npx vitest run src/lib/engine/tredjehand.probe.test.ts
//
// Vad den mäter: varje läge där en FÖRSVARARE är tredje hand (partnern ledde,
// två kort ligger) jämförs botens kort mot DD-poängen för VARJE lagligt kort
// (SolveBoardPBN, konventionen låst i revisor-dds-solve.test.ts). Ut faller hur
// ofta valet skiljer sig från DD-bästa, vad det kostar netto och VILKA
// hållmönster som missar — uppdelat på tumregel-fönstret (9–13 kort, där
// generaliseringen ska bo) och MC-fönstret (≤8 kort), och på om den som spelar
// efter mig är den DOLDA spelföraren eller den öppna träkarlen.
//
// ÄGARPRINCIPEN (docs/speldiagnos.md): DD ser alla 52 korten — en kostnad är en
// LARMKLOCKA att granska, aldrig en dom. Klassningen systemfel/ärlig miss görs
// av agenten, inte av siffrorna. Aggregaten är trendmätare mellan körningar.
//
// Rattar (miljövariabler):
//   TREDJEHAND_DEALS    antal givar (standard 200)
//   TREDJEHAND_SEED     basfrö (standard 20260721 — samma givuniversum som S-serien)
//   TREDJEHAND_OFFSET   hoppa fram i frö-serien (parallella skivor som speldiagnosen)
//   TREDJEHAND_BILLIG   =1 → tumregler hela vägen (maxCardsForMC 0): snabbt, men
//                       slutspelslinjerna blir andra än i skarp körning
//   TREDJEHAND_EXEMPEL  max värsta-exempel i rapporten (standard 12)
//   TREDJEHAND_OUT      filnamn för latest-JSON (standard tredjehand-latest.json)
//
// Linjen är 100 % reproducerbar: samma per-beslut-frön som spelaMedFro/tävlingen
// (botDecisionSeed). Repro av ett exempel: DUMP_SPEL=<frö> speldump.probe.
// Utdata: revisor-output/ (gitignorad) — JSON + läsbar rapport (vitest sväljer
// console.log, så rapporten skrivs alltid till fil).

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { contractFromCalls } from './auction-contract'
import { mulberry32 } from './deal'
import { botCardSmartReasoned, usesMonteCarlo, type SmartOpts } from './play-bot'
import {
  currentWinner,
  dummyOf,
  isComplete,
  legalCards,
  PARTNER_SEAT,
  playCard,
  side,
  startPlay,
  type PlayState,
} from './play'
import { botDecisionSeed, playIndexOf } from './play-seed'
import { botAuction, dealFromSeed } from './revisor'
import { getDds, solveAllCards } from './revisor-dds'

const DEALS = Number(process.env.TREDJEHAND_DEALS ?? 200)
const SEED = Number(process.env.TREDJEHAND_SEED ?? 20260721)
const OFFSET = Number(process.env.TREDJEHAND_OFFSET ?? 0)
const BILLIG = process.env.TREDJEHAND_BILLIG === '1'
const EXEMPEL = Number(process.env.TREDJEHAND_EXEMPEL ?? 12)
const OUT = process.env.TREDJEHAND_OUT ?? 'tredjehand-latest.json'

const RANK_ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: Rank) => RANK_ORDER.indexOf(r)
const SUIT_CHAR: Record<Suit, string> = { spades: 'S', hearts: 'H', diamonds: 'D', clubs: 'C' }
const rankStr = (r: Rank) => (r === '10' ? 'T' : r)
const cardStr = (c: Card) => SUIT_CHAR[c.suit] + rankStr(c.rank)
/** Rangerna i en färg, högst först, som kompakt sträng ("KQ74"); "-" om tom. */
const ranksDesc = (cards: Card[], suit: Suit) => {
  const r = cards.filter((c) => c.suit === suit).sort((a, b) => rankVal(b.rank) - rankVal(a.rank))
  return r.length ? r.map((c) => rankStr(c.rank)).join('') : '-'
}

type Lager = 'tumregel' | 'MC'
type Fjarde = 'spelforare' | 'trakarl'
type VinnerNu = 'partner' | 'trakarl' | 'spelforare'
type Riktning = 'underspel' | 'överspel' | 'annat' | '-'

interface Position {
  seed: number
  trick: number
  seat: Seat
  kontrakt: string
  strain: 'NT' | 'trumf'
  ledArTrumf: boolean
  cardsLeft: number
  lager: Lager
  /** Vem spelar EFTER mig: den dolda spelföraren eller den öppna träkarlen. */
  fjarde: Fjarde
  /** Vem "vinner" sticket när jag ska lägga. */
  vinnerNu: VinnerNu
  /** Följer jag färg (annars sak/ruff-beslut)? */
  foljer: boolean
  /** Ärlig information vid beslutet: mina kort i ledd färg, partnerns utspel,
   *  träkarlens kort i ledd färg (hela innehavet, inkl. ev. redan lagt), bordets
   *  lagda kort i sticket (om träkarlen spelat) och det kort som leder sticket. */
  mina: string
  partnerLed: string
  trakarlLed: string
  bordetLagt: string | null
  bestCard: string
  valt: string
  skal: string
  /** DD-bästa kort (alla med maxpoäng) och kostnaden i stick mot dem. */
  ddBast: string[]
  kostnad: number
  riktning: Riktning
}

function skalTag(reason: string): string {
  return reason.replace(/\s+/g, ' ').slice(0, 44).trim()
}

/** Mät ett tredje-hands-läge: botens val mot DD-poängen för varje lagligt kort. */
function matLage(
  dds: Awaited<ReturnType<typeof getDds>>,
  st: PlayState,
  seat: Seat,
  seed: number,
  valt: Card,
  skal: string,
): Position {
  const led = st.currentTrick[0].card.suit
  const bestSeat = currentWinner(st.currentTrick, st.trump)
  const bestCard = st.currentTrick.find((pc) => pc.seat === bestSeat)!.card
  const dummy = dummyOf(st.contract)
  const yetToPlay = (['N', 'E', 'S', 'W'] as Seat[]).find(
    (s) => s !== seat && !st.currentTrick.some((pc) => pc.seat === s),
  )!
  const bordet = st.currentTrick.find((pc) => pc.seat === dummy)?.card ?? null
  const legal = legalCards(st, seat)
  const foljer = legal.some((c) => c.suit === led)

  const poang = solveAllCards(dds, st)
  const scoreOf = (c: Card) => poang.find((p) => p.card.suit === c.suit && p.card.rank === c.rank)?.score ?? -1
  const best = Math.max(...poang.map((p) => p.score))
  const ddBastKort = poang.filter((p) => p.score === best).map((p) => p.card)
  const kostnad = best - scoreOf(valt)

  let riktning: Riktning = '-'
  if (kostnad > 0) {
    const iLed = ddBastKort.filter((c) => c.suit === led)
    if (foljer && iLed.length === ddBastKort.length) {
      const vals = iLed.map((c) => rankVal(c.rank))
      riktning =
        rankVal(valt.rank) < Math.min(...vals) ? 'underspel' : rankVal(valt.rank) > Math.max(...vals) ? 'överspel' : 'annat'
    } else riktning = 'annat'
  }

  const c = st.contract
  return {
    seed,
    trick: st.completedTricks.length + 1,
    seat,
    kontrakt: `${c.level}${c.strain === 'NT' ? 'NT' : SUIT_CHAR[c.strain]} ${c.declarer}`,
    strain: st.trump === null ? 'NT' : 'trumf',
    ledArTrumf: st.trump !== null && led === st.trump,
    cardsLeft: st.hands[seat].length,
    // Lagret klassas ur STANDARD-fönstret (≤8 kort = MC) oavsett körläge, så en
    // BILLIG-körning ändå delar upp rätt. I tumregel-fönstret (9–13 kort =
    // stick 1–5) är BILLIG-linjen identisk med skarp körning — MC kickar in
    // först vid ≤8 — så de raderna är EXAKTA; bara MC-fönstrets rader skiljer.
    lager: usesMonteCarlo(st, seat, {}) ? 'MC' : 'tumregel',
    fjarde: yetToPlay === dummy ? 'trakarl' : 'spelforare',
    vinnerNu: bestSeat === PARTNER_SEAT[seat] ? 'partner' : bestSeat === dummy ? 'trakarl' : 'spelforare',
    foljer,
    mina: ranksDesc(st.hands[seat], led),
    partnerLed: rankStr(st.currentTrick[0].card.rank),
    trakarlLed: ranksDesc([...st.hands[dummy], ...(bordet ? [bordet] : [])], led),
    bordetLagt: bordet ? cardStr(bordet) : null,
    bestCard: cardStr(bestCard),
    valt: cardStr(valt),
    skal: skalTag(skal),
    ddBast: ddBastKort.map(cardStr),
    kostnad,
    riktning,
  }
}

interface Grupp { n: number; larm: number; kostnad: number }
const grupp = (): Grupp => ({ n: 0, larm: 0, kostnad: 0 })
const addTo = (m: Map<string, Grupp>, key: string, p: Position) => {
  const g = m.get(key) ?? grupp()
  g.n++
  if (p.kostnad > 0) { g.larm++; g.kostnad += p.kostnad }
  m.set(key, g)
}
const sortByKostnad = (m: Map<string, Grupp>) => [...m.entries()].sort((a, b) => b[1].kostnad - a[1].kostnad)
/** En tabell med nyckelkolumnen bred nog för längsta nyckeln (så kolumnerna passar). */
const tabell = (rader: [string, Grupp][]): string[] => {
  const w = Math.max(20, ...rader.map(([k]) => k.length))
  return rader.map(
    ([k, g]) =>
      `  ${k.padEnd(w)}  lägen ${String(g.n).padStart(5)}  larm ${String(g.larm).padStart(4)}  kostnad ${String(g.kostnad).padStart(4)}`,
  )
}

it.skipIf(!process.env.TREDJEHAND)(
  `tredje-hand-riggen: ${DEALS} givar, frö ${SEED}+${OFFSET}${BILLIG ? ' (BILLIG)' : ''}`,
  { timeout: 0 },
  async () => {
    const t0 = Date.now()
    const dds = await getDds()
    const positioner: Position[] = []
    let auktionsfel = 0
    let utpassade = 0
    let spelade = 0

    for (let i = 0; i < DEALS; i++) {
      const seed = SEED + OFFSET + i
      const deal = dealFromSeed(seed)
      const history = botAuction(deal)
      if (!history) { auktionsfel++; continue }
      const contract = contractFromCalls(history)
      if (!contract) { utpassade++; continue }
      spelade++

      let st = startPlay(deal, contract)
      let guard = 0
      while (!isComplete(st) && guard++ < 60) {
        const seat = st.toAct
        const rng = mulberry32(botDecisionSeed(seed, playIndexOf(st.completedTricks.length, st.currentTrick.length)))
        const smart: SmartOpts = BILLIG ? { rng, maxCardsForMC: 0 } : { rng }
        const val = botCardSmartReasoned(st, seat, history, smart)

        const forsvarare = side(seat) !== side(contract.declarer)
        const tredjeHand = st.currentTrick.length === 2 && side(st.currentTrick[0].seat) === side(seat)
        if (forsvarare && tredjeHand && legalCards(st, seat).length > 1) {
          positioner.push(matLage(dds, st, seat, seed, val.card, val.reason))
        }
        st = playCard(st, val.card)
      }
      if ((i + 1) % 10 === 0 || i + 1 === DEALS) console.log(`  ...${i + 1}/${DEALS} givar`)
    }

    // ---- Aggregat -----------------------------------------------------------
    const perLager = new Map<string, Grupp>()
    const perLagerFjarde = new Map<string, Grupp>()
    const perRiktning = new Map<string, Grupp>()
    const perSkal = new Map<string, Grupp>()
    const perMonster = new Map<string, Grupp>()
    for (const p of positioner) {
      addTo(perLager, p.lager, p)
      addTo(perLagerFjarde, `${p.lager} · efter mig: ${p.fjarde} · ${p.strain}`, p)
      if (p.kostnad > 0) addTo(perRiktning, `${p.lager} · ${p.riktning}`, p)
      addTo(perSkal, `${p.lager} · ${p.skal}`, p)
      if (p.foljer) addTo(perMonster, `${p.lager} · ${p.fjarde} · vinner:${p.vinnerNu} · ${p.mina}/${p.partnerLed}/bord ${p.trakarlLed}`, p)
    }
    const larm = positioner.filter((p) => p.kostnad > 0)
    const kostnadTot = larm.reduce((s, p) => s + p.kostnad, 0)
    const exempel = [...larm].sort((a, b) => b.kostnad - a.kostnad || a.seed - b.seed).slice(0, EXEMPEL)

    const L: string[] = []
    L.push(`TREDJE-HAND-RIGGEN — ${DEALS} givar, frö ${SEED + OFFSET}..${SEED + OFFSET + DEALS - 1}${BILLIG ? ' · BILLIG (tumregler hela vägen)' : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s`)
    L.push(`Spelade ${spelade} · utpassade ${utpassade} · auktionsfel ${auktionsfel}`)
    L.push('DD ser alla kort: en kostnad är en larmklocka att granska, aldrig en dom (docs/speldiagnos.md).')
    L.push('')
    L.push(`Försvarets tredje-hands-lägen: ${positioner.length} · larm (kostnad > 0): ${larm.length} · kostnad totalt ${kostnadTot} stick`)
    L.push('')
    L.push('Per lager (tumregel = 9–13 kort, där generaliseringen ska bo; MC = ≤8 kort):')
    L.push(...tabell(sortByKostnad(perLager)))
    L.push('')
    L.push('Per lager × vem som spelar efter mig × strain:')
    L.push(...tabell(sortByKostnad(perLagerFjarde)))
    L.push('')
    L.push('Larmens riktning (underspel = mitt kort lägre än alla DD-bästa, överspel = högre):')
    L.push(...tabell(sortByKostnad(perRiktning)))
    L.push('')
    L.push('Per regel/skäl boten angav (topp 15 efter kostnad):')
    L.push(...tabell(sortByKostnad(perSkal).slice(0, 15)))
    L.push('')
    L.push('Hållmönster med störst kostnad (mina/partnerns utspel/bordets kort i färgen; topp 25):')
    L.push(...tabell(sortByKostnad(perMonster).slice(0, 25)))
    L.push('')
    L.push(`Värsta exempel (${exempel.length}; repro: DUMP_SPEL=<frö> npx vitest run src/lib/engine/speldump.probe.test.ts):`)
    for (const p of exempel) {
      L.push(
        `  frö ${p.seed} stick ${p.trick} ${p.seat} · ${p.kontrakt} · ${p.lager} · efter mig ${p.fjarde} · vinner ${p.vinnerNu}` +
          ` · mina ${p.mina} / partner ${p.partnerLed} / bord ${p.trakarlLed}${p.bordetLagt ? ` (lagt ${p.bordetLagt})` : ''}` +
          ` · valt ${p.valt} · DD ${p.ddBast.join('/')} · −${p.kostnad} (${p.riktning}) · "${p.skal}"`,
      )
    }

    const rapport = L.join('\n')
    console.log('\n' + rapport + '\n')
    const dir = join(process.cwd(), 'revisor-output')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const json = {
      deals: DEALS, seed: SEED + OFFSET, billig: BILLIG, spelade, utpassade, auktionsfel,
      lagen: positioner.length, larm: larm.length, kostnad: kostnadTot,
      perLager: Object.fromEntries(perLager), perLagerFjarde: Object.fromEntries(perLagerFjarde),
      perRiktning: Object.fromEntries(perRiktning), perSkal: Object.fromEntries(perSkal),
      perMonster: Object.fromEntries(perMonster), positioner,
    }
    writeFileSync(join(dir, `tredjehand-${stamp}.json`), JSON.stringify(json, null, 2), 'utf8')
    writeFileSync(join(dir, OUT), JSON.stringify(json, null, 2), 'utf8')
    writeFileSync(join(dir, `tredjehand-${stamp}.txt`), rapport, 'utf8')
    writeFileSync(join(dir, 'tredjehand-latest.txt'), rapport, 'utf8')
    console.log(`Rapport: revisor-output/tredjehand-${stamp}.txt · JSON: ${OUT}`)
  },
)
