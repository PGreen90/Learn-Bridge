// TREBOTTARNA I DAGLIGA TÄVLINGEN (ägarbeslut 2026-08-31 + 2026-09-01) —
// nattjobbet som låter de tre bottarna (botniva.ts: Gunnar52/Lasse68/Emma03,
// expert/medel/nybörjare) spela dagens 12 tävlingsgivar och skickar in
// resultaten.
//
// Varför: med 1–3 mänskliga spelare är matchpoängen ofta meningslös (ensam på
// en giv = ingen jämförelse). Bottarna garanterar minst fyra resultat per giv,
// så MP% betyder något varje dag — och det finns alltid någon i sin egen
// styrkeklass att mäta sig mot.
//
// Körs ALDRIG i `npm test`/deploygrinden (skipIf) — bara på schemat/begäran:
//
//   PowerShell:  $env:BOT_TAVLING='2026-09-02'; npx vitest run src/lib/engine/tavlingsbot.probe.test.ts
//   Bash:        BOT_TAVLING=2026-09-02 npx vitest run src/lib/engine/tavlingsbot.probe.test.ts
//
// Kräver DAILY_SEED_SECRET + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (miljön
// eller .env.local — ALDRIG i spårade filer).
//
// Principer:
//   • SAMMA VÄG SOM MÄNNISKOR: varje bots spel (botspelare.ts) valideras av
//     samma validera() och skrivs i samma daily_results-form som skicka-in.ts.
//     Ingen bot har en egen poängväg. Ett avvisat botinskick är en motorbugg —
//     det skrivs som 'avvisad' (påverkar inte MP) och rapporteras som FYND.
//   • NIVÅN RÖR BARA SYDS SÄTEN (spelaBotGiv): N/Ö/V spelas av standardmotorn
//     med playSeed-fröna, så nattgranskningens exakta replay godkänner alla
//     nivåers rader av sig själv.
//   • IDEMPOTENT: allt är deterministiskt ur (hemlighet, datum, bricka, nivå)
//     och inserten ignorerar dubbletter — en omkörning ändrar ingenting.
//   • Bot-kontona är vanliga konton (auth.users + profiles) som skapas här via
//     admin-API:t första gången (slumplösenord som aldrig loggas, ingen kan
//     logga in som dem) och flaggas is_bot (migration 0010). Gunnar52 ärver
//     rebidz-bots befintliga konto — hittas det under det gamla namnet döps det
//     om via service-nyckeln (UPDATE-granten, migration 0011); namnbytet slår
//     igenom retroaktivt eftersom listorna slår upp namn via id.
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
import { nivaSmartOpts, TAVLINGSBOTTAR, type Tavlingsbot } from './botniva'
import { spelaBotGiv } from './botspelare'

const DATUM = process.env.BOT_TAVLING ?? ''

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

it.skipIf(!DATUM)('trebottarna spelar dagens tävling', { timeout: 0 }, async () => {
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

  /** Bot-kontots id — hitta under nuvarande namn, annars gamla namnet (döp om),
   *  annars skapa via admin-API:t. Idempotent alla vägar. */
  const sakerstallKonto = async (bot: Tavlingsbot): Promise<string> => {
    const viaNamn = (await rest(
      `profiles?display_name=eq.${bot.namn}&select=id`,
    )) as Array<{ id: string }>
    if (viaNamn.length) return viaNamn[0].id

    if (bot.gammaltNamn) {
      const viaGammalt = (await rest(
        `profiles?display_name=eq.${bot.gammaltNamn}&select=id`,
      )) as Array<{ id: string }>
      if (viaGammalt.length) {
        const id = viaGammalt[0].id
        await rest(`profiles?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ display_name: bot.namn, is_bot: true }),
        })
        return id
      }
    }

    const skapa = await fetch(`${base}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bot.epost,
        // Slumplösenord som slängs direkt — ingen ska kunna logga in som boten.
        password: randomBytes(24).toString('hex'),
        email_confirm: true,
        user_metadata: { display_name: bot.namn, is_13_plus: true },
      }),
    })
    if (!skapa.ok) throw new Error(`skapa ${bot.namn}: ${skapa.status} ${await skapa.text()}`)
    const id = ((await skapa.json()) as { id?: string }).id ?? null
    if (!id) throw new Error(`${bot.namn} fick inget id`)
    await rest(`profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_bot: true }) })
    return id
  }

  // 1) Dagens tävling MÅSTE finnas — saknas den har Vercel-cronen fallerat,
  //    och det ska bli rött (mejl till ägaren), inte tyst grönt.
  const sets = (await rest(`daily_sets?comp_date=eq.${DATUM}&select=id,size`)) as Array<{
    id: string
    size: number
  }>
  expect(sets.length, `Ingen tävling ${DATUM} — har givgenereringen (Vercel-cron) fallerat?`).toBeGreaterThan(0)
  const set = sets[0]

  const rader: string[] = [`=== TREBOTTARNA ${DATUM} ===`]
  const fynd: string[] = []

  for (const bot of TAVLINGSBOTTAR) {
    const botId = await sakerstallKonto(bot)
    const opts = nivaSmartOpts(bot.niva)

    // Redan inskickade brickor (omkörning) hoppas över.
    const redan = (await rest(
      `daily_results?set_id=eq.${set.id}&user_id=eq.${botId}&select=board`,
    )) as Array<{ board: number }>
    const klara = new Set(redan.map((r) => r.board))

    // Spela varje bricka och skicka in — samma radform som skicka-in.ts.
    let spelade = 0
    let hoppade = 0
    rader.push('', `--- ${bot.namn} (${bot.niva}) ---`)
    for (let board = 1; board <= set.size; board++) {
      if (klara.has(board)) {
        hoppade++
        continue
      }
      const inskick = spelaBotGiv(
        seedForBoard(secret!, DATUM, board),
        playSeedForBoard(secret!, DATUM, board),
        board,
        opts,
      )
      if (!inskick) {
        fynd.push(
          `${bot.namn} bricka ${board}: auktionen skenade — inget botinskick (motorbugg, repro: frö ur ${DATUM}:${board})`,
        )
        continue
      }
      const v = validera(secret!, DATUM, inskick)
      if (!v.giltig) {
        fynd.push(`${bot.namn} bricka ${board}: botinskicket AVVISADES av validera — motorbugg: ${v.skäl}`)
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
  }

  if (fynd.length) rader.push('', 'FYND (motorbuggar att granska):', ...fynd.map((f) => `  · ${f}`))

  mkdirSync(join(process.cwd(), 'revisor-output'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsbot-${DATUM}.json`),
    JSON.stringify({ datum: DATUM, bottar: TAVLINGSBOTTAR.map((b) => b.namn), fynd }, null, 2),
  )
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsbot-${DATUM}.txt`),
    rader.join('\n') + '\n',
  )
  console.log(rader.join('\n'))
  // Fynd är rapport, inte larm — körningen är grön så länge inget havererade.
})
