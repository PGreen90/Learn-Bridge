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
import { fronyckel, playSeedForBoard, seedForBoard } from '../../../api-src/_lib/seed'
import { validera } from '../../../api-src/_lib/validera'
import { nivaSmartOpts, TAVLINGSBOTTAR, type Tavlingsbot } from './botniva'
import { giltigMotorstampel } from './tavlingsgranskning'
import { spelaBotGiv } from './botspelare'
import { botBud } from './resonemang'
import { computeOracle, getDds } from './revisor-dds'

const DATUM = process.env.BOT_TAVLING ?? ''
/** Vilken av dagens två tävlingar (Dagens IMP, 2026-09-26): TAVLING_FORM=imp
 *  → IMP-tävlingen (egna givar ur frönyckeln "datum#imp"), annars MP som förr.
 *  Nattjobbet kör proben en gång per form. */
const FORM = process.env.TAVLING_FORM === 'imp' ? 'imp' : 'mp'
const NYCKEL = DATUM ? fronyckel(DATUM, FORM) : ''
const SUFFIX = FORM === 'imp' ? '-imp' : ''

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
  // Tänkande bottar (2026-09-24): samma budfunktion som klientens worker och
  // nattgranskningen. Auktionen är lika för alla tre nivåer → minnet delas.
  const dds = await getDds()
  const budMinne = new Map<string, ReturnType<typeof botBud>>()
  const tankandeBud = (d: Parameters<typeof botBud>[0], h: Parameters<typeof botBud>[1], s: Parameters<typeof botBud>[2]) => {
    const k = `${d.board}|${h.map((c) => c.bid).join(',')}`
    const minne = budMinne.get(k)
    if (minne) return minne
    const b = botBud(d, h, s, (x) => computeOracle(dds, x).solve)
    budMinne.set(k, b)
    return b
  }
  expect(/^\d{4}-\d{2}-\d{2}$/.test(DATUM), `BOT_TAVLING måste vara YYYY-MM-DD (fick "${DATUM}")`).toBe(true)
  const secret = lasHemlighet('DAILY_SEED_SECRET')
  const base = lasHemlighet('SUPABASE_URL')
  const key = lasHemlighet('SUPABASE_SERVICE_ROLE_KEY')
  expect(secret, 'DAILY_SEED_SECRET saknas (miljön eller .env.local)').toBeTruthy()
  expect(base, 'SUPABASE_URL saknas (miljön eller .env.local)').toBeTruthy()
  expect(key, 'SUPABASE_SERVICE_ROLE_KEY saknas (miljön eller .env.local)').toBeTruthy()

  // Transient Supabase-hicka (504 Gateway Timeout, nätfel) ska INTE blanka en
  // hel natt (2026-09-13: ett enda 504 på Gunnar52-uppslaget rev körningen).
  // Vi försöker om på 5xx/429 och nätfel med växande paus; 4xx (äkta fel) och
  // sista försöket kastar som förr. Idempotent hot-path (GET + upsert-radform),
  // så en omförsökt skrivning är ofarlig.
  const sov = (ms: number) => new Promise((res) => setTimeout(res, ms))
  const rest = async (pathWithQuery: string, init?: RequestInit, forsok = 4): Promise<unknown> => {
    for (let i = 1; ; i++) {
      let r: Response
      try {
        r = await fetch(`${base}/rest/v1/${pathWithQuery}`, {
          ...init,
          headers: {
            apikey: key!,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
          },
        })
      } catch (e) {
        if (i >= forsok) throw e
        await sov(1000 * i * i)
        continue
      }
      if (r.ok) {
        const text = await r.text()
        return text ? JSON.parse(text) : null
      }
      const transient = r.status === 429 || r.status >= 500
      if (transient && i < forsok) {
        await r.text().catch(() => undefined) // töm kroppen innan nästa försök
        await sov(1000 * i * i)
        continue
      }
      throw new Error(`${pathWithQuery}: ${r.status} ${await r.text()}`)
    }
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
  const sets = (await rest(`daily_sets?comp_date=eq.${DATUM}&form=eq.${FORM}&select=id,size`)) as Array<{
    id: string
    size: number
  }>
  if (FORM === 'imp' && !sets.length) {
    // IMP-setet finns först när migration 0014 släppt den gamla "en per dag"-
    // nyckeln (docs/imp-tavling-plan.md, deploy-sekvensen). Tills dess: grönt
    // med besked — MP-setet är kärnjobbet och vaktas av raden nedan.
    console.log(`Ingen IMP-tävling ${DATUM} än (0014 ej körd?) — inget att spela.`)
    return
  }
  expect(sets.length, `Ingen tävling ${DATUM} — har givgenereringen (Vercel-cron) fallerat?`).toBeGreaterThan(0)
  const set = sets[0]

  const rader: string[] = [`=== TREBOTTARNA ${DATUM} (${FORM.toUpperCase()}-tävlingen) ===`]
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
        seedForBoard(secret!, NYCKEL, board),
        playSeedForBoard(secret!, NYCKEL, board),
        board,
        opts,
        tankandeBud,
      )
      if (!inskick) {
        fynd.push(
          `${bot.namn} bricka ${board}: auktionen skenade — inget botinskick (motorbugg, repro: frö ur ${NYCKEL}:${board})`,
        )
        continue
      }
      const v = validera(secret!, NYCKEL, inskick)
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
        // Motorstämpeln: nattjobbets commit (GITHUB_SHA i Actions) — så ett
        // spelmotor-byte senare samma dag inte fäller bottarnas inskick i
        // nattgranskningen (tavlingsgranskning.ts).
        payload: {
          history: inskick.history,
          plays: inskick.plays,
          declarerTricks: inskick.declarerTricks,
          ...(giltigMotorstampel(process.env.GITHUB_SHA) ? { motor: process.env.GITHUB_SHA } : {}),
        },
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
    join(process.cwd(), 'revisor-output', `tavlingsbot-${DATUM}${SUFFIX}.json`),
    JSON.stringify({ datum: DATUM, form: FORM, bottar: TAVLINGSBOTTAR.map((b) => b.namn), fynd }, null, 2),
  )
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsbot-${DATUM}${SUFFIX}.txt`),
    rader.join('\n') + '\n',
  )
  console.log(rader.join('\n'))
  // Fynd är rapport, inte larm — körningen är grön så länge inget havererade.
})
