// BOT-DELTAGAREN I DAGLIGA TÄVLINGEN (ägarbeslut 2026-08-31) — nattjobbet som
// låter "rebidz-bot" spela dagens 12 tävlingsgivar och skickar in resultaten.
//
// Varför: med 1–3 mänskliga spelare är matchpoängen ofta meningslös (ensam på
// en giv = ingen jämförelse). Boten garanterar minst två resultat per giv, så
// MP% betyder något varje dag — och det är roligare att mäta sig mot någon.
//
// Körs ALDRIG i `npm test`/deploygrinden (skipIf) — bara på schemat/begäran:
//
//   PowerShell:  $env:BOT_TAVLING='2026-08-31'; npx vitest run src/lib/engine/tavlingsbot.probe.test.ts
//   Bash:        BOT_TAVLING=2026-08-31 npx vitest run src/lib/engine/tavlingsbot.probe.test.ts
//
// Kräver DAILY_SEED_SECRET + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (miljön
// eller .env.local — ALDRIG i spårade filer).
//
// Principer:
//   • SAMMA VÄG SOM MÄNNISKOR: botens spel (botspelare.ts) valideras av samma
//     validera() och skrivs i samma daily_results-form som skicka-in.ts. Boten
//     har ingen egen poängväg. Ett avvisat botinskick är en motorbugg — det
//     skrivs som 'avvisad' (påverkar inte MP) och rapporteras som FYND.
//   • IDEMPOTENT: allt är deterministiskt ur (hemlighet, datum, bricka) och
//     inserten ignorerar dubbletter — en omkörning ändrar ingenting.
//   • Bot-kontot är ett vanligt konto (auth.users + profiles) som skapas här
//     via admin-API:t första gången (slumplösenord som aldrig loggas, ingen
//     kan logga in som boten) och flaggas is_bot (migration 0010).
//
// RÖD körning = enbart haveri (nät/DB/motorfel/ingen tävling) → GitHub mejlar
// ägaren. Fynd (avvisade/skenande givar) gör ALDRIG körningen röd.
//
// Utdata: konsolen + revisor-output/tavlingsbot-<datum>.{json,txt} (gitignorat).

import { expect, it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { playSeedForBoard, seedForBoard } from '../../../api-src/_lib/seed'
import { validera } from '../../../api-src/_lib/validera'
import { spelaBotGiv } from './botspelare'

const DATUM = process.env.BOT_TAVLING ?? ''
const BOT_NAMN = 'rebidz-bot' // max 10 tecken (profiles-constrainten), gemener.
const BOT_EPOST = 'bot@rebidz.com'

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

it.skipIf(!DATUM)('bot-deltagaren spelar dagens tävling', { timeout: 0 }, async () => {
  expect(/^\d{4}-\d{2}-\d{2}$/.test(DATUM), `BOT_TAVLING måste vara YYYY-MM-DD (fick "${DATUM}")`).toBe(true)
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

  // 1) Dagens tävling MÅSTE finnas — saknas den har Vercel-cronen fallerat,
  //    och det ska bli rött (mejl till ägaren), inte tyst grönt.
  const sets = (await rest(`daily_sets?comp_date=eq.${DATUM}&select=id,size`)) as Array<{
    id: string
    size: number
  }>
  expect(sets.length, `Ingen tävling ${DATUM} — har givgenereringen (Vercel-cron) fallerat?`).toBeGreaterThan(0)
  const set = sets[0]

  // 2) Bot-kontot: hitta via is_bot-flaggan, annars via namnet (rad från före
  //    migration 0010), annars skapa via admin-API:t (triggern i migration 0001
  //    skapar profilen ur metadatan). Idempotent alla vägar.
  let botId: string | null = null
  const flaggade = (await rest(`profiles?is_bot=eq.true&select=id&limit=1`)) as Array<{ id: string }>
  if (flaggade.length) {
    botId = flaggade[0].id
  } else {
    const viaNamn = (await rest(
      `profiles?display_name=eq.${BOT_NAMN}&select=id`,
    )) as Array<{ id: string }>
    if (viaNamn.length) {
      botId = viaNamn[0].id
    } else {
      const skapa = await fetch(`${base}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: BOT_EPOST,
          // Slumplösenord som slängs direkt — ingen ska kunna logga in som boten.
          password: randomBytes(24).toString('hex'),
          email_confirm: true,
          user_metadata: { display_name: BOT_NAMN, is_13_plus: true },
        }),
      })
      if (!skapa.ok) throw new Error(`skapa bot-konto: ${skapa.status} ${await skapa.text()}`)
      botId = ((await skapa.json()) as { id?: string }).id ?? null
    }
    if (!botId) throw new Error('bot-kontot fick inget id')
    await rest(`profiles?id=eq.${botId}`, { method: 'PATCH', body: JSON.stringify({ is_bot: true }) })
  }

  // 3) Redan inskickade brickor (omkörning) hoppas över.
  const redan = (await rest(
    `daily_results?set_id=eq.${set.id}&user_id=eq.${botId}&select=board`,
  )) as Array<{ board: number }>
  const klara = new Set(redan.map((r) => r.board))

  // 4) Spela varje bricka och skicka in — samma radform som skicka-in.ts.
  const rader: string[] = [`=== BOT-DELTAGAREN ${DATUM} (${BOT_NAMN}) ===`]
  const fynd: string[] = []
  let spelade = 0
  let hoppade = 0
  for (let board = 1; board <= set.size; board++) {
    if (klara.has(board)) {
      hoppade++
      continue
    }
    const inskick = spelaBotGiv(
      seedForBoard(secret!, DATUM, board),
      playSeedForBoard(secret!, DATUM, board),
      board,
    )
    if (!inskick) {
      fynd.push(`bricka ${board}: auktionen skenade — inget botinskick (motorbugg, repro: frö ur ${DATUM}:${board})`)
      continue
    }
    const v = validera(secret!, DATUM, inskick)
    if (!v.giltig) {
      fynd.push(`bricka ${board}: botinskicket AVVISADES av validera — motorbugg: ${v.skäl}`)
    }
    const rad = {
      set_id: set.id,
      board,
      user_id: botId,
      status: v.giltig ? 'godkand' : 'avvisad',
      ns_score: v.giltig ? (v.passad ? 0 : v.nsScore) : null,
      declarer_tricks: v.giltig && !v.passad ? v.declarerTricks : null,
      passed_out: v.giltig ? v.passad : false,
      reason: v.giltig ? null : v.skäl,
      payload: { history: inskick.history, plays: inskick.plays, declarerTricks: inskick.declarerTricks },
    }
    await rest(`daily_results?on_conflict=set_id,board,user_id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify([rad]),
    })
    spelade++
    rader.push(
      `bricka ${board}: ${rad.status}` +
        (v.giltig && !v.passad ? ` · ${v.declarerTricks} spelförarstick · NS ${v.nsScore}` : '') +
        (v.giltig && v.passad ? ' · utpassad' : ''),
    )
  }

  rader.push(`Spelade: ${spelade} · redan inne (omkörning): ${hoppade} · av ${set.size}`)
  if (fynd.length) rader.push('', 'FYND (motorbuggar att granska):', ...fynd.map((f) => `  · ${f}`))

  mkdirSync(join(process.cwd(), 'revisor-output'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsbot-${DATUM}.json`),
    JSON.stringify({ datum: DATUM, spelade, hoppade, fynd }, null, 2),
  )
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsbot-${DATUM}.txt`),
    rader.join('\n') + '\n',
  )
  console.log(rader.join('\n'))
  // Fynd är rapport, inte larm — körningen är grön så länge inget havererade.
})
