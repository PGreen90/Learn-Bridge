// Påbyggnad 3 (livskvalitetssvepet, ägarbeslut 2026-09-13) — tävlingshistoriken
// + medaljtabellen.
//
// Svarar med alla AVSLUTADE tävlingsdagar (före idag, Stockholm; nyast först)
// med kallarens egen placering, och topp 5 i guld/silver/brons över alla dagar.
// Källan är `daily_standings` (den slutliga ställningen som nattjobbet fryser
// efter granskningen). Dagar som ännu inte frusits (i regel bara gårdagen
// mellan midnatt och nattjobbet) räknas i farten ur daily_results — men bara de
// tre senaste sådana, så anropet aldrig växer med historikens längd.
//
// Kräver inloggning (dina egna placeringar) + anropskvot. Bottarna (profiles
// .is_bot) utesluts ur medaljtabellen SERVER-SIDE — flaggan lämnar aldrig
// svaret (ägarbeslut 2026-09-01: bottarna har människonamn och pekas aldrig ut).

import type { IncomingMessage, ServerResponse } from 'node:http'
import { stockholmDateISO } from '../src/lib/engine/daily'
import type { Tävlingsrad } from '../src/lib/engine/matchpoints'
import { byggStallning, MIN_PER_GIV, raknaMedaljer } from '../src/lib/engine/tavlingsavslut'
import { kvotOk } from './_lib/kvot'
import { restGet, restGetAlla } from './_lib/supabase-rest'

/** Så många ofrusna dagar räknas i farten (resten listas utan siffror). */
const I_FARTEN_MAX = 3

interface SetRad {
  id: string
  comp_date: string
  daily_number: number
  size: number
}
interface StandingRad {
  set_id: string
  user_id: string
  placering: number
  snitt: number
  spelade: number
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const json = (status: number, data: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }
  if (req.method !== 'GET') return json(405, { ok: false, fel: 'Bara GET' })

  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return json(500, { ok: false, fel: 'Saknar SUPABASE_URL / SERVICE_ROLE_KEY' })

  try {
    // Vem frågar? Inloggning KRÄVS (dina placeringar).
    const authz = req.headers.authorization
    const token = authz && authz.startsWith('Bearer ') ? authz.slice(7) : null
    if (!token) return json(401, { ok: false, fel: 'Inte inloggad' })
    const userRes = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    })
    if (!userRes.ok) return json(401, { ok: false, fel: 'Ogiltig session' })
    const meId = ((await userRes.json()) as { id?: string }).id
    if (!meId) return json(401, { ok: false, fel: 'Ogiltig session' })

    if (!(await kvotOk(base, key, meId, 'tavling-historik'))) {
      return json(429, { ok: false, fel: 'För många anrop — vänta en liten stund' })
    }

    const idag = stockholmDateISO()
    const sets = await restGetAlla<SetRad>(
      base,
      key,
      `daily_sets?comp_date=lt.${idag}&select=id,comp_date,daily_number,size&order=comp_date.desc`,
    )

    // Frusna ställningar. Tabellen kan saknas tills migration 0012 körts →
    // tom lista (historiken räknas då i farten för de senaste dagarna).
    let standings: StandingRad[] = []
    try {
      standings = await restGetAlla<StandingRad>(
        base,
        key,
        'daily_standings?select=set_id,user_id,placering,snitt,spelade',
      )
    } catch {
      standings = []
    }
    const perSet = new Map<string, StandingRad[]>()
    for (const r of standings) {
      const lista = perSet.get(r.set_id) ?? []
      lista.push(r)
      perSet.set(r.set_id, lista)
    }

    // Dagslistan: frusen → ur standings; annars i farten (max I_FARTEN_MAX).
    let iFarten = 0
    const dagar = []
    for (const set of sets) {
      const frusna = perSet.get(set.id)
      if (frusna && frusna.length) {
        const min = frusna.find((r) => r.user_id === meId)
        dagar.push({
          dag: set.comp_date,
          nummer: set.daily_number,
          storlek: set.size,
          antalSpelare: frusna.length,
          slutlig: true,
          du: min ? { placering: min.placering, snitt: Number(min.snitt), spelade: min.spelade } : null,
        })
        continue
      }
      if (iFarten >= I_FARTEN_MAX) {
        dagar.push({ dag: set.comp_date, nummer: set.daily_number, storlek: set.size, antalSpelare: null, slutlig: false, du: null })
        continue
      }
      iFarten++
      const results = (await restGet(
        base,
        key,
        `daily_results?set_id=eq.${set.id}&status=eq.godkand&select=board,user_id,ns_score`,
      )) as Array<{ board: number; user_id: string; ns_score: number | null }>
      const rader: Tävlingsrad[] = results.map((r) => ({ board: r.board, spelare: r.user_id, poäng: r.ns_score ?? 0 }))
      const st = byggStallning(rader, MIN_PER_GIV, set.size)
      const min = st.find((r) => r.spelare === meId)
      dagar.push({
        dag: set.comp_date,
        nummer: set.daily_number,
        storlek: set.size,
        antalSpelare: st.length,
        slutlig: false,
        du: min ? { placering: min.placering, snitt: min.snitt, spelade: min.spelade } : null,
      })
    }

    // Medaljtabellen ur de frusna ställningarna. Bottarna utesluts här —
    // is_bot läses server-side och serialiseras ALDRIG.
    const ids = [...new Set(standings.map((r) => r.user_id))]
    const namn = new Map<string, string>()
    const bottar = new Set<string>()
    if (ids.length) {
      const inList = ids.map((id) => `"${id}"`).join(',')
      const profiler = await restGetAlla<{ id: string; display_name: string; is_bot: boolean | null }>(
        base,
        key,
        `profiles?id=in.(${inList})&select=id,display_name,is_bot`,
      )
      for (const p of profiler) {
        namn.set(p.id, p.display_name)
        if (p.is_bot) bottar.add(p.id)
      }
    }
    // (En dag med bara en spelare i ställningen delar inte ut medaljer.)
    const medaljer = raknaMedaljer(
      standings.map((r) => ({ set: r.set_id, spelare: r.user_id, placering: r.placering })),
      bottar,
    ).map((m) => ({
      namn: namn.get(m.spelare) ?? '—',
      guld: m.guld,
      silver: m.silver,
      brons: m.brons,
      jag: m.spelare === meId,
    }))

    return json(200, { ok: true, idag, dagar, medaljer })
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
