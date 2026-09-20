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
// VERSIONSMEDVETEN (2026-09-20): "exakt" gäller per MOTORVERSION. Ett inskick
// som avviker mot dagens motor prövas därför om mot de versioner som varit live
// — inskickets motorstämpel först (payload.motor = byggets commit-SHA), sedan de
// senaste motorversionerna på main — var och en i ett eget git-arbetsträd
// (tavlingsomprov.probe.test.ts). Bara om INGEN version lade korten flyttas
// inskicket. Bakgrund + domslogik: tavlingsgranskning.ts. Kräver full
// git-historik (Actions: fetch-depth 0).
//
// OMPROVA_FLYTTADE=1 tar dessutom med de inskick en TIDIGARE nattgranskning
// flyttat (status 'granskning', skäl "nattgranskning …") och ÅTERSTÄLLER dem
// till 'godkand' om en live-version visar sig ha lagt korten.
//
// Utfall: avvikande inskick flyttas till status 'granskning' med skäl (ägarens
// grindbeslut: rapport i nattvakten, inget eget UI). Körningen blir RÖD enbart
// vid haverier (nät/DB/motorfel) — fynd är rapport, inte larm.
//
// Utdata: konsolen + revisor-output/tavlingsgranskning-<datum>.json (gitignorad).

import { expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { playSeedForBoard, seedForBoard } from '../../../api-src/_lib/seed'
import { dealFromSeed } from './deal'
import { botCardSmart } from './play-bot'
import {
  botAvvikelser,
  domOverVersioner,
  type GranskadPayload,
  type Omprovsinskick,
  type Versionsprov,
} from './tavlingsgranskning'

const DATUM = process.env.GRANSKA_TAVLING ?? ''
const OMPROVA_FLYTTADE = process.env.OMPROVA_FLYTTADE === '1'
/** Så många motorversioner före tävlingsdagens slut är kandidater för ostämplade inskick. */
const KANDIDATFONSTER = 12

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

const git = (args: string, cwd = process.cwd()) =>
  execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/** Motorns identitet i en commit = trädhashen för src/lib (docs-/UI-commits
 *  delar motor med sin förälder och behöver aldrig ett eget omprov). */
const motortrad = (sha: string) => git(`rev-parse ${sha}:src/lib`)

interface Rad {
  id: string
  board: number
  status: string
  payload: GranskadPayload | null
}

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

  // 1) Dagens set + inskicken: de godkända, och (OMPROVA_FLYTTADE) de en tidigare
  //    nattgranskning flyttat.
  const sets = (await rest(`daily_sets?comp_date=eq.${DATUM}&select=id`)) as Array<{ id: string }>
  const rader: string[] = [`=== NATTLIG DJUPGRANSKNING ${DATUM} ===`]
  const fynd: string[] = []
  let granskade = 0
  let flyttade = 0
  let friade = 0
  let aterstallda = 0
  let ejJamforbara = 0

  if (!sets.length) {
    rader.push('Ingen tävling den dagen — inget att granska.')
  } else {
    const kolumner = 'select=id,board,status,payload'
    const inskick = (await rest(
      `daily_results?set_id=eq.${sets[0].id}&status=eq.godkand&${kolumner}`,
    )) as Rad[]
    rader.push(`${inskick.length} godkända inskick att granska.`)
    if (OMPROVA_FLYTTADE) {
      const tidigare = (await rest(
        `daily_results?set_id=eq.${sets[0].id}&status=eq.granskning&reason=like.nattgranskning*&${kolumner}`,
      )) as Rad[]
      rader.push(`${tidigare.length} tidigare flyttade inskick omprövas.`)
      inskick.push(...tidigare)
    }

    // 2) Omspelning mot DAGENS motor. Träff = klart; avvikelse = omprov (steg 3).
    const radPerId = new Map(inskick.map((r) => [r.id, r]))
    const attOmprova: Omprovsinskick[] = []
    const aterstall: string[] = []
    for (const rad of inskick) {
      granskade++
      const deal = dealFromSeed(seedForBoard(secret!, DATUM, rad.board), rad.board)
      const playSeed = playSeedForBoard(secret!, DATUM, rad.board)
      const avvikelser = botAvvikelser(deal, playSeed, rad.payload, botCardSmart)
      if (avvikelser.length) {
        attOmprova.push({ id: rad.id, board: rad.board, headAvvikelser: avvikelser, motor: rad.payload?.motor })
      } else if (rad.status === 'granskning') {
        aterstall.push(rad.id)
      }
    }

    // 3) Omprov mot äldre motorversioner — var och en i ett eget arbetsträd.
    if (attOmprova.length) {
      const headTrad = motortrad('HEAD')
      const kandaCommits = new Set(git('rev-list HEAD').split('\n'))
      const dagslut = new Date(new Date(`${DATUM}T00:00:00Z`).getTime() + 27 * 3600_000).toISOString()
      const settaTrad = new Set([headTrad])
      const kandidater = git(
        `log --first-parent --format=%H -n ${KANDIDATFONSTER} --until=${dagslut} HEAD -- src/lib`,
      )
        .split('\n')
        .filter(Boolean)
        .filter((sha) => {
          const trad = motortrad(sha)
          if (settaTrad.has(trad)) return false
          settaTrad.add(trad)
          return true
        })

      // Två commits med samma motorträd (stämpel från en docs-deploy + kandidaten
      // före den) delar utfall — listan krymper bara, så det första svaret räcker.
      const utfallPerTrad = new Map<string, Record<string, string[]>>()
      const prova: Versionsprov = async (sha, lista) => {
        const trad = motortrad(sha)
        // Samma motor som HEAD → HEAD-domen står.
        if (trad === headTrad) return Object.fromEntries(lista.map((i) => [i.id, i.headAvvikelser]))
        if (utfallPerTrad.has(trad)) return utfallPerTrad.get(trad)!
        const wt = join(tmpdir(), `rebidz-omprov-${sha.slice(0, 12)}`)
        const infil = join(wt, 'omprov-in.json')
        const utfil = join(wt, 'omprov-ut.json')
        try {
          rmSync(wt, { recursive: true, force: true })
          git('worktree prune')
          git(`worktree add --detach "${wt}" ${sha}`)
          for (const fil of ['tavlingsgranskning.ts', 'tavlingsomprov.probe.test.ts']) {
            copyFileSync(join(process.cwd(), 'src/lib/engine', fil), join(wt, 'src/lib/engine', fil))
          }
          writeFileSync(
            infil,
            JSON.stringify({
              datum: DATUM,
              inskick: lista.map((i) => ({ id: i.id, board: i.board, payload: radPerId.get(i.id)!.payload })),
            }),
          )
          const kor = (cmd: string) =>
            execSync(cmd, {
              cwd: wt,
              stdio: ['ignore', 'pipe', 'pipe'],
              maxBuffer: 64 * 1024 * 1024,
              env: { ...process.env, DAILY_SEED_SECRET: secret!, OMPROV_FIL: infil, OMPROV_UT: utfil, GRANSKA_TAVLING: '' },
            })
          kor('npm ci --no-audit --no-fund --prefer-offline')
          kor('npx vitest run src/lib/engine/tavlingsomprov.probe.test.ts')
          const { resultat } = JSON.parse(readFileSync(utfil, 'utf8')) as { resultat: Record<string, string[]> }
          utfallPerTrad.set(trad, resultat)
          return resultat
        } catch (err) {
          const text = String(err instanceof Error ? err.message : err).split('\n')[0]
          rader.push(`⚠ omprov i ${sha.slice(0, 7)} havererade: ${text}`)
          return 'fel'
        } finally {
          try {
            git(`worktree remove --force "${wt}"`)
          } catch {
            rmSync(wt, { recursive: true, force: true })
          }
        }
      }

      const dom = await domOverVersioner(attOmprova, kandidater, kandaCommits, prova)
      rader.push(
        `Omprov: ${attOmprova.length} inskick avvek mot dagens motor · prövade versioner: ` +
          (dom.provade.map((s) => s.slice(0, 7)).join(', ') || '—'),
      )

      for (const f of dom.friade) {
        friade++
        if (radPerId.get(f.id)!.status === 'granskning') aterstall.push(f.id)
        rader.push(`  ✓ bricka ${radPerId.get(f.id)!.board}, inskick ${f.id}: spelat med motorn i ${f.sha.slice(0, 7)} — ärligt`)
      }
      for (const e of dom.ejJamforbara) {
        ejJamforbara++
        rader.push(`  ? bricka ${e.board}, inskick ${e.id}: ej jämförbart (${e.skal}) — INTE flyttat`)
      }
      for (const f of dom.flytta) {
        fynd.push(`bricka ${f.board}, inskick ${f.id}: ${f.avvikelser.join(' · ')} (ingen av ${f.provade} äldre versioner lade korten)`)
        if (radPerId.get(f.id)!.status === 'granskning') continue // redan flyttat — står kvar
        // Flytta till granskning med skälet — ägaren läser rapporten.
        const skal = `nattgranskning ${DATUM}: ${f.avvikelser.slice(0, 3).join(' · ')}`
        await rest(`daily_results?id=eq.${f.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'granskning', reason: skal }),
        })
        flyttade++
      }
    }

    // 4) Återställ det en tidigare granskning flyttat på fel grund (versionsbyte).
    for (const id of aterstall) {
      await rest(`daily_results?id=eq.${id}&status=eq.granskning`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'godkand', reason: null }),
      })
      aterstallda++
    }
  }

  rader.push(
    `Granskade: ${granskade} · flyttade till 'granskning': ${flyttade}` +
      ` · friade av äldre motorversion: ${friade} · återställda: ${aterstallda} · ej jämförbara: ${ejJamforbara}`,
  )
  if (fynd.length) {
    rader.push('', 'FYND:', ...fynd.map((f) => `  · ${f}`))
  } else if (granskade > 0 && !ejJamforbara) {
    rader.push('Alla botkort var motorns egna val. ✓')
  }

  mkdirSync(join(process.cwd(), 'revisor-output'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsgranskning-${DATUM}.json`),
    JSON.stringify({ datum: DATUM, granskade, flyttade, friade, aterstallda, ejJamforbara, fynd }, null, 2),
  )
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsgranskning-${DATUM}.txt`),
    rader.join('\n') + '\n',
  )
  console.log(rader.join('\n'))
  // Fynd är rapport, inte larm — körningen är grön så länge inget havererade.
})
