// Beslut B etapp 2 (tävlings-UI-polish steg 6) — "traveller": hela fältets
// resultat på EN bricka i dagens tävling.
//
// När man spelat en giv vill man se hur alla andra gjorde den. Endpointen svarar
// med varje spelares kontrakt · resultat · matchpoäng på brickan (byggBrickresultat
// räknar matematiken; contractFromCalls tolkar auktionen ur den lagrade payloaden).
//
// Integritet: kräver inloggning OCH att kallaren SJÄLV har ett godkänt resultat
// på brickan — annars 403. Så kan man aldrig tjuvkika på en giv man inte spelat
// (travellern skulle avslöja att brickan är en slam m.m.). Bara visningsnamn +
// publika brickresultat lämnas ut, inga privata uppgifter.

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedCall } from '../src/lib/bidding'
import { stockholmDateISO } from '../src/lib/engine/daily'
import { byggBrickresultat, type Brickrad } from '../src/lib/engine/brickresultat'
import { kvotOk } from './_lib/kvot'

async function restGet(base: string, key: string, pathWithQuery: string): Promise<unknown> {
  const r = await fetch(`${base}/rest/v1/${pathWithQuery}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`${pathWithQuery}: ${r.status} ${await r.text()}`)
  return r.json()
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const json = (status: number, data: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return json(500, { ok: false, fel: 'Saknar SUPABASE_URL / SERVICE_ROLE_KEY' })

  try {
    // Vilken bricka? (?board=N)
    const url = new URL(req.url ?? '', 'http://x')
    const board = Number(url.searchParams.get('board'))
    if (!Number.isInteger(board) || board < 1) return json(400, { ok: false, fel: 'Ogiltig bricka' })

    // Vem frågar? Inloggning KRÄVS (travellern är post-spel).
    const authz = req.headers.authorization
    const token = authz && authz.startsWith('Bearer ') ? authz.slice(7) : null
    if (!token) return json(401, { ok: false, fel: 'Inte inloggad' })
    const userRes = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    })
    if (!userRes.ok) return json(401, { ok: false, fel: 'Ogiltig session' })
    const meId = ((await userRes.json()) as { id?: string }).id
    if (!meId) return json(401, { ok: false, fel: 'Ogiltig session' })

    // Anropskvoten (Beslut B etapp 3): samma Postgres-räknare som borden.
    if (!(await kvotOk(base, key, meId, 'giv-resultat'))) {
      return json(429, { ok: false, fel: 'För många anrop — vänta en liten stund' })
    }

    // Dagens tävling.
    const today = stockholmDateISO()
    const sets = (await restGet(
      base,
      key,
      `daily_sets?comp_date=eq.${today}&select=id`,
    )) as Array<{ id: string }>
    if (!sets.length) return json(404, { ok: false, fel: 'Ingen tävling idag' })
    const setId = sets[0].id

    // Fältets godkända rader på brickan.
    const rows = (await restGet(
      base,
      key,
      `daily_results?set_id=eq.${setId}&board=eq.${board}&status=eq.godkand&select=user_id,ns_score,declarer_tricks,passed_out,payload`,
    )) as Array<{
      user_id: string
      ns_score: number | null
      declarer_tricks: number | null
      passed_out: boolean
      payload: { history?: ResolvedCall[] } | null
    }>

    // Ingen tjuvkik: kallaren måste själv ha spelat brickan.
    if (!rows.some((r) => r.user_id === meId)) {
      return json(403, { ok: false, fel: 'Du har inte spelat den här given än' })
    }

    const rader: Brickrad[] = rows.map((r) => ({
      spelare: r.user_id,
      nsScore: r.ns_score ?? 0,
      declarerTricks: r.declarer_tricks,
      passedOut: r.passed_out,
      history: Array.isArray(r.payload?.history) ? r.payload!.history! : [],
    }))
    const resultat = byggBrickresultat(rader)

    // Visningsnamn för spelarna. MEDVETET ingen bot-flagga i svaret
    // (trebottarna, ägarbeslut 2026-09-01): bottarna har människonamn och pekas
    // aldrig ut — se kommentaren i topplista.ts.
    const ids = [...new Set(rows.map((r) => r.user_id))]
    const profil = new Map<string, string>()
    if (ids.length) {
      const inList = ids.map((id) => `"${id}"`).join(',')
      const profiler = (await restGet(
        base,
        key,
        `profiles?id=in.(${inList})&select=id,display_name`,
      )) as Array<{ id: string; display_name: string }>
      for (const p of profiler) profil.set(p.id, p.display_name)
    }

    return json(200, {
      ok: true,
      board,
      resultat: resultat.map((r) => ({
        namn: profil.get(r.spelare) ?? '—',
        jag: r.spelare === meId,
        kontrakt: r.kontrakt,
        nsScore: r.nsScore,
        procent: r.procent,
      })),
    })
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
