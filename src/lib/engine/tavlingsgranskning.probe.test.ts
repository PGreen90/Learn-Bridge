// NATTLIG DJUPGRANSKNING (Beslut B etapp 3, grindbeslut 2026-08-18) — spelar om
// gårdagens GODKÄNDA tävlingsinskick och kontrollerar att varje BOTKORT var
// motorns eget val. Inskickets snabbvalidering (validera.ts) kontrollerar buden
// och kortens laglighet men inte botarnas kortVAL — en manipulerad klient kunde
// ge bottarna sämre kort och sig själv omärkta övertrick. Den luckan stängs här,
// där beräkningen är gratis (Actions) i stället för på serverless-tid.
//
// Körs ALDRIG i `npm test`/deploygrinden (skipIf) — bara på begäran/schemat:
//
//   PowerShell:  $env:GRANSKA_TAVLING='2026-08-17'; npx vitest run src/lib/engine/tavlingsgranskning.probe.test.ts
//   Bash:        GRANSKA_TAVLING=2026-08-17 npx vitest run src/lib/engine/tavlingsgranskning.probe.test.ts
//
// Kräver DAILY_SEED_SECRET + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (miljön
// eller .env.local — ALDRIG i spårade filer). Botarnas beslut är deterministiska
// ur (playSeed, beslutsindex) — exakt samma väg som klienten (usePlayTable) och
// samma standardbudget — så jämförelsen är EXAKT, inte statistisk.
//
// Utfall: avvikande inskick flyttas till status 'granskning' med skäl (ägarens
// grindbeslut: rapport i nattvakten, inget eget UI). Körningen blir RÖD enbart
// vid haverier (nät/DB/motorfel) — fynd är rapport, inte larm.
//
// Utdata: konsolen + revisor-output/tavlingsgranskning-<datum>.json (gitignorad).

import { expect, it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Card, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { playSeedForBoard, seedForBoard } from '../../../api-src/_lib/seed'
import { dealFromSeed, mulberry32 } from './deal'
import { contractFromCalls } from './auction-live'
import { legalCards, playCard, side, startPlay } from './play'
import { botCardSmart } from './play-bot'
import { botDecisionSeed, playIndexOf } from './play-seed'

const DATUM = process.env.GRANSKA_TAVLING ?? ''

/** En hemlighet ur miljön eller .env.local — utan att någonsin skrivas ut. */
function lasHemlighet(namn: string): string | null {
  if (process.env[namn]) return process.env[namn]!
  try {
    const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^${namn}=(.+)$`, 'm'))
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

const sammaKort = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank
const kortText = (c: Card) => `${c.rank}${c.suit[0].toUpperCase()}`

it.skipIf(!DATUM)('nattlig djupgranskning av tävlingsinskick', { timeout: 0 }, async () => {
  expect(/^\d{4}-\d{2}-\d{2}$/.test(DATUM), `GRANSKA_TAVLING måste vara YYYY-MM-DD (fick "${DATUM}")`).toBe(true)
  const secret = lasHemlighet('DAILY_SEED_SECRET')
  const base = lasHemlighet('SUPABASE_URL')
  const key = lasHemlighet('SUPABASE_SERVICE_ROLE_KEY')
  expect(secret, 'DAILY_SEED_SECRET saknas (miljön eller .env.local)').toBeTruthy()
  expect(base, 'SUPABASE_URL saknas (miljön eller .env.local)').toBeTruthy()
  expect(key, 'SUPABASE_SERVICE_ROLE_KEY saknas (miljön eller .env.local)').toBeTruthy()

  const rest = async (pathWithQuery: string, init?: RequestInit): Promise<unknown> => {
    const r = await fetch(`${base}/rest/v1/${pathWithQuery}`, {
      ...init,
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    if (!r.ok) throw new Error(`${pathWithQuery}: ${r.status} ${await r.text()}`)
    const text = await r.text()
    return text ? JSON.parse(text) : null
  }

  // 1) Dagens set + de godkända inskicken.
  const sets = (await rest(`daily_sets?comp_date=eq.${DATUM}&select=id`)) as Array<{ id: string }>
  const rader: string[] = [`=== NATTLIG DJUPGRANSKNING ${DATUM} ===`]
  const fynd: string[] = []
  let granskade = 0
  let flyttade = 0

  if (!sets.length) {
    rader.push('Ingen tävling den dagen — inget att granska.')
  } else {
    const inskick = (await rest(
      `daily_results?set_id=eq.${sets[0].id}&status=eq.godkand&select=id,board,user_id,payload`,
    )) as Array<{
      id: string
      board: number
      user_id: string
      payload: { history: ResolvedCall[]; plays: Card[] } | null
    }>
    rader.push(`${inskick.length} godkända inskick att granska.`)

    for (const rad of inskick) {
      granskade++
      const avvikelser: string[] = []
      const payload = rad.payload
      if (!payload || !Array.isArray(payload.history) || !Array.isArray(payload.plays)) {
        avvikelser.push('payload saknas/trasig — kan inte spelas om')
      } else {
        const deal = dealFromSeed(seedForBoard(secret!, DATUM, rad.board), rad.board)
        const playSeed = playSeedForBoard(secret!, DATUM, rad.board)
        const contract = contractFromCalls(payload.history)
        if (contract && payload.plays.length) {
          // Människan är Syd: hen styr S, och N när N/S är spelförande sida.
          const manniskanStyr = (seat: Seat) =>
            side(contract.declarer) === 'NS' ? side(seat) === 'NS' : seat === 'S'
          let state = startPlay(deal, contract)
          for (const spelat of payload.plays) {
            const seat = state.toAct
            if (!manniskanStyr(seat)) {
              const index = playIndexOf(state.completedTricks.length, state.currentTrick.length)
              const rng = mulberry32(botDecisionSeed(playSeed, index))
              const motorns = botCardSmart(state, seat, payload.history, { rng })
              if (!sammaKort(motorns, spelat)) {
                avvikelser.push(
                  `kort ${index + 1} (${seat}): spelat ${kortText(spelat)}, motorn ${kortText(motorns)}`,
                )
              }
            }
            if (!legalCards(state, seat).some((c) => sammaKort(c, spelat))) {
              avvikelser.push(`kort olagligt i omspelningen (${kortText(spelat)}) — avbryter`)
              break
            }
            state = playCard(state, spelat)
          }
        }
      }

      if (avvikelser.length) {
        // Flytta till granskning med skälet — ägaren läser rapporten.
        const skal = `nattgranskning ${DATUM}: ${avvikelser.slice(0, 3).join(' · ')}`
        await rest(`daily_results?id=eq.${rad.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'granskning', reason: skal }),
        })
        flyttade++
        fynd.push(`bricka ${rad.board}, inskick ${rad.id}: ${avvikelser.join(' · ')}`)
      }
    }
  }

  rader.push(`Granskade: ${granskade} · flyttade till 'granskning': ${flyttade}`)
  if (fynd.length) {
    rader.push('', 'FYND:', ...fynd.map((f) => `  · ${f}`))
  } else if (granskade > 0) {
    rader.push('Alla botkort var motorns egna val. ✓')
  }

  mkdirSync(join(process.cwd(), 'revisor-output'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsgranskning-${DATUM}.json`),
    JSON.stringify({ datum: DATUM, granskade, flyttade, fynd }, null, 2),
  )
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsgranskning-${DATUM}.txt`),
    rader.join('\n') + '\n',
  )
  console.log(rader.join('\n'))
  // Fynd är rapport, inte larm — körningen är grön så länge inget havererade.
})
