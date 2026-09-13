// TÄVLINGSAVSLUTET (Påbyggnad 3, ägarbeslut 2026-09-13) — skriver den SLUTLIGA
// ställningen för avslutade tävlingsdagar till `daily_standings` (migration
// 0012): tävlingshistoriken och medaljtabellen läser härifrån.
//
// Körs ALDRIG i `npm test`/deploygrinden (skipIf) — bara på begäran/schemat,
// som ett steg i tavling-granskning.yml EFTER djupgranskningen (den kan flytta
// inskick till 'granskning', och de ska inte räknas i slutställningen):
//
//   PowerShell:  $env:AVSLUTA_TAVLING='1'; npx vitest run src/lib/engine/tavlingsavslut.probe.test.ts
//   Bash:        AVSLUTA_TAVLING=1 npx vitest run src/lib/engine/tavlingsavslut.probe.test.ts
//
// Kräver SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (miljön eller .env.local —
// ALDRIG i spårade filer).
//
// Självläkande & idempotent: tar ALLA dagar före idag (Stockholm) som saknar
// ställning — så första körningen fyller hela historiken och en röd natt
// hämtas ikapp — och skriver dessutom OM de tre senaste dagarna (upsert), så
// en sen granskningsflytt eller omkörning alltid landar. Spelare som fallit ur
// en dags ställning (allt flyttat till granskning) tas bort ur den dagen.
// Körningen blir RÖD enbart vid haverier (nät/DB). Rapport: konsolen +
// revisor-output/tavlingsavslut-<datum>.{txt,json} (gitignorad).

import { expect, it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stockholmDateISO } from './daily'
import type { Tävlingsrad } from './matchpoints'
import { byggStallning, MIN_PER_GIV } from './tavlingsavslut'

const AKTIV = process.env.AVSLUTA_TAVLING === '1'
/** Så många av de senaste dagarna skrivs alltid om (utöver saknade). */
const OMSKRIV_DAGAR = 3

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

/** Datumet N dagar före ett ISO-datum (kalenderdagar, tidszonsfritt). */
function dagarFore(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

it.skipIf(!AKTIV)('tävlingsavslutet: slutlig ställning → daily_standings', { timeout: 0 }, async () => {
  const base = lasHemlighet('SUPABASE_URL')
  const key = lasHemlighet('SUPABASE_SERVICE_ROLE_KEY')
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
  /** Läs ALLA rader sida för sida (PostgREST Range) — historiken växer utan tak. */
  const restAlla = async <T>(pathWithQuery: string, sida = 1000): Promise<T[]> => {
    const alla: T[] = []
    for (let from = 0; ; from += sida) {
      const del = (await rest(pathWithQuery, {
        headers: { Range: `${from}-${from + sida - 1}`, 'Range-Unit': 'items' },
      })) as T[]
      alla.push(...del)
      if (del.length < sida) return alla
    }
  }

  const idag = stockholmDateISO()
  const rader: string[] = [`=== TÄVLINGSAVSLUT ${idag} (dagar före idag, Stockholm) ===`]

  // 1) Alla avslutade dagar + vilka som redan har en ställning.
  const sets = await restAlla<{ id: string; comp_date: string; size: number; daily_number: number }>(
    `daily_sets?comp_date=lt.${idag}&select=id,comp_date,size,daily_number&order=comp_date.asc`,
  )
  const harStallning = new Set(
    (await restAlla<{ set_id: string }>('daily_standings?select=set_id')).map((r) => r.set_id),
  )
  const grans = dagarFore(idag, OMSKRIV_DAGAR)
  const attGora = sets.filter((s) => !harStallning.has(s.id) || s.comp_date >= grans)
  rader.push(`${sets.length} avslutade dagar · ${harStallning.size} med ställning · ${attGora.length} att skriva.`)

  let skrivna = 0
  let tomma = 0
  for (const set of attGora) {
    const results = await restAlla<{ board: number; user_id: string; ns_score: number | null }>(
      `daily_results?set_id=eq.${set.id}&status=eq.godkand&select=board,user_id,ns_score`,
    )
    const tavlingsrader: Tävlingsrad[] = results.map((r) => ({
      board: r.board,
      spelare: r.user_id,
      poäng: r.ns_score ?? 0,
    }))
    const stallning = byggStallning(tavlingsrader, MIN_PER_GIV, set.size)
    if (!stallning.length) {
      tomma++
      rader.push(`${set.comp_date} (#${set.daily_number}): inga godkända inskick — ingen ställning.`)
      // En tidigare skriven ställning för dagen är då fel — rensa den.
      if (harStallning.has(set.id)) await rest(`daily_standings?set_id=eq.${set.id}`, { method: 'DELETE' })
      continue
    }
    const body = stallning.map((r) => ({
      set_id: set.id,
      user_id: r.spelare,
      placering: r.placering,
      snitt: Math.round(r.snitt * 100) / 100,
      antal_givar: r.antalGivar,
      spelade: r.spelade,
    }))
    await rest('daily_standings?on_conflict=set_id,user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    })
    // Spelare som inte längre är med i dagens ställning (allt flyttat till
    // granskning) ska inte ligga kvar med en gammal placering.
    if (harStallning.has(set.id)) {
      const kvar = stallning.map((r) => `"${r.spelare}"`).join(',')
      await rest(`daily_standings?set_id=eq.${set.id}&user_id=not.in.(${kvar})`, { method: 'DELETE' })
    }
    skrivna++
    const etta = stallning[0]
    rader.push(
      `${set.comp_date} (#${set.daily_number}): ${stallning.length} spelare · etta ${etta.snitt.toFixed(1)} % (${etta.spelade}/${set.size} givar)`,
    )
  }
  rader.push(`Skrivna dagar: ${skrivna} · tomma: ${tomma}`)

  mkdirSync(join(process.cwd(), 'revisor-output'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'revisor-output', `tavlingsavslut-${idag}.json`),
    JSON.stringify({ datum: idag, dagar: sets.length, skrivna, tomma }, null, 2),
  )
  writeFileSync(join(process.cwd(), 'revisor-output', `tavlingsavslut-${idag}.txt`), rader.join('\n') + '\n')
  console.log(rader.join('\n'))
})
