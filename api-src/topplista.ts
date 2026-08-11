// Beslut B etapp 2 (Led 3) — topplistan för dagens tävling.
//
// Läser alla GODKÄNDA inskick för dagens tävling (service-nyckeln — klienter når
// aldrig andras rader), räknar matchpoäng per giv (matchpoints.ts) och snittar
// per spelare i procent. Minst två spelare på en giv krävs för att den ska ge
// poäng (annars "väntar på fler"). Provisorisk under dagen; slutlig efter
// midnatt + valideringssvep (docs/beslut-b-plan.md, 2b).
//
// Bara visningsnamn + procent lämnas ut — inga privata uppgifter — så endpointen
// kräver ingen inloggning.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { stockholmDateISO } from '../src/lib/engine/daily'
import { matchpointsForBoard, type GivPoäng } from '../src/lib/engine/matchpoints'

async function restGet(base: string, key: string, pathWithQuery: string): Promise<unknown> {
  const r = await fetch(`${base}/rest/v1/${pathWithQuery}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`${pathWithQuery}: ${r.status} ${await r.text()}`)
  return r.json()
}

const MIN_PER_GIV = 2

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const json = (status: number, data: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return json(500, { ok: false, fel: 'Saknar SUPABASE_URL / SERVICE_ROLE_KEY' })

  try {
    const today = stockholmDateISO()
    const sets = (await restGet(
      base,
      key,
      `daily_sets?comp_date=eq.${today}&select=id,daily_number,size`,
    )) as Array<{ id: string; daily_number: number; size: number }>
    if (!sets.length) return json(404, { ok: false, fel: 'Ingen tävling idag' })
    const set = sets[0]

    const results = (await restGet(
      base,
      key,
      `daily_results?set_id=eq.${set.id}&status=eq.godkand&select=board,user_id,ns_score,declarer_tricks,passed_out`,
    )) as Array<{
      board: number
      user_id: string
      ns_score: number | null
      declarer_tricks: number | null
      passed_out: boolean
    }>

    // Matchpoäng per giv → summera procent per spelare (bara givar med ≥2 spelare).
    const perSpelare = new Map<string, { summa: number; antal: number }>()
    const brickor = new Map<number, GivPoäng[]>()
    for (const r of results) {
      const lista = brickor.get(r.board) ?? []
      lista.push({ spelare: r.user_id, poäng: r.ns_score ?? 0 })
      brickor.set(r.board, lista)
    }
    let poängsattaGivar = 0
    for (const [, entries] of brickor) {
      if (entries.length < MIN_PER_GIV) continue
      poängsattaGivar++
      for (const mp of matchpointsForBoard(entries)) {
        const nu = perSpelare.get(mp.spelare) ?? { summa: 0, antal: 0 }
        nu.summa += mp.procent
        nu.antal += 1
        perSpelare.set(mp.spelare, nu)
      }
    }

    // Visningsnamn för spelarna på listan.
    const ids = [...perSpelare.keys()]
    const namn = new Map<string, string>()
    if (ids.length) {
      const inList = ids.map((id) => `"${id}"`).join(',')
      const profiler = (await restGet(
        base,
        key,
        `profiles?id=in.(${inList})&select=id,display_name`,
      )) as Array<{ id: string; display_name: string }>
      for (const p of profiler) namn.set(p.id, p.display_name)
    }

    const topplista = [...perSpelare.entries()]
      .map(([id, v]) => ({
        namn: namn.get(id) ?? '—',
        snitt: v.antal ? v.summa / v.antal : 0,
        antalGivar: v.antal,
      }))
      .sort((a, b) => b.snitt - a.snitt)

    // TILLFÄLLIG DIAGNOSTIK (2026-08-11): rå poäng per spelare/giv, för att
    // bekräfta att två konton faktiskt fick olika poäng. TAS BORT efter kollen.
    const _diag = results
      .map((r) => ({
        namn: namn.get(r.user_id) ?? r.user_id.slice(0, 8),
        board: r.board,
        nsScore: r.ns_score,
        stick: r.declarer_tricks,
        passad: r.passed_out,
      }))
      .sort((a, b) => a.board - b.board || a.namn.localeCompare(b.namn))

    return json(200, {
      ok: true,
      nummer: set.daily_number,
      storlek: set.size,
      poängsattaGivar,
      minPerGiv: MIN_PER_GIV,
      topplista,
      _diag,
    })
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
