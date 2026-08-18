// Beslut B etapp 2 (Led 2) — ta emot och validera ett inskickat tävlingsresultat.
//
// Klienten skickar en spelad tävlingsgiv (bricka + auktion + spelade kort +
// stickantal) med sin inloggnings-token. Servern:
//   1. verifierar token (vem är spelaren?),
//   2. validerar inskicket mot dagens hemliga frö (validera.ts — "snabb" nivå),
//   3. skriver resultatet med service-nyckeln (efter validering; klienten kan
//      aldrig skriva direkt, radskyddet blockerar det).
// Ett inskick per spelare och giv — det första står, ominskick avvisas (409).
//
// Miljövariabler (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// DAILY_SEED_SECRET (samma som giv-genereringen).

import type { IncomingMessage, ServerResponse } from 'node:http'
import { stockholmDateISO } from '../src/lib/engine/daily'
import { validera, type Inskick } from './_lib/validera'
import { kvotOk } from './_lib/kvot'

/** Läs och tolka JSON-kroppen ur en Node-request (Vercel parsar inte åt oss här). */
function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1_000_000) reject(new Error('för stor kropp')) // enkel takgräns
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : null)
      } catch {
        reject(new Error('ogiltig JSON'))
      }
    })
    req.on('error', reject)
  })
}

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

  if (req.method !== 'POST') return json(405, { ok: false, fel: 'POST krävs' })

  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const secret = process.env.DAILY_SEED_SECRET
  if (!base || !key || !secret) {
    return json(500, { ok: false, fel: 'Saknar SUPABASE_URL / SERVICE_ROLE_KEY / DAILY_SEED_SECRET' })
  }

  try {
    // 1) Vem är spelaren? Verifiera inloggnings-token mot Supabase.
    const authz = req.headers.authorization
    const token = authz && authz.startsWith('Bearer ') ? authz.slice(7) : null
    if (!token) return json(401, { ok: false, fel: 'Inte inloggad' })
    const userRes = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    })
    if (!userRes.ok) return json(401, { ok: false, fel: 'Ogiltig session' })
    const user = (await userRes.json()) as { id?: string }
    const userId = user.id
    if (!userId) return json(401, { ok: false, fel: 'Ogiltig session' })

    // Anropskvoten (Beslut B etapp 3): samma Postgres-räknare som borden.
    if (!(await kvotOk(base, key, userId, 'skicka-in'))) {
      return json(429, { ok: false, fel: 'För många anrop — vänta en liten stund' })
    }

    // 2) Läs inskicket.
    const body = (await readJson(req)) as Partial<Inskick> | null
    if (!body || typeof body.board !== 'number') {
      return json(400, { ok: false, fel: 'Ogiltigt inskick' })
    }
    const inskick: Inskick = {
      board: body.board,
      history: Array.isArray(body.history) ? body.history : [],
      plays: Array.isArray(body.plays) ? body.plays : [],
      declarerTricks: typeof body.declarerTricks === 'number' ? body.declarerTricks : -1,
    }

    // 3) Dagens tävling.
    const today = stockholmDateISO()
    const sets = (await restGet(
      base,
      key,
      `daily_sets?comp_date=eq.${today}&select=id`,
    )) as Array<{ id: string }>
    if (!sets.length) return json(404, { ok: false, fel: 'Ingen tävling idag' })
    const setId = sets[0].id

    // 4) Ett inskick per giv — det första står.
    const redan = (await restGet(
      base,
      key,
      `daily_results?set_id=eq.${setId}&board=eq.${inskick.board}&user_id=eq.${userId}&select=id,status`,
    )) as Array<{ id: string; status: string }>
    if (redan.length) {
      return json(409, { ok: false, fel: 'Redan inskickad', status: redan[0].status })
    }

    // 5) Validera + skriv (service-nyckeln, efter validering).
    const v = validera(secret, today, inskick)
    const rad = {
      set_id: setId,
      board: inskick.board,
      user_id: userId,
      status: v.giltig ? 'godkand' : 'avvisad',
      ns_score: v.giltig ? (v.passad ? 0 : v.nsScore) : null,
      declarer_tricks: v.giltig && !v.passad ? v.declarerTricks : null,
      passed_out: v.giltig ? v.passad : false,
      reason: v.giltig ? null : v.skäl,
      payload: { history: inskick.history, plays: inskick.plays, declarerTricks: inskick.declarerTricks },
    }
    const skriv = await fetch(`${base}/rest/v1/daily_results`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([rad]),
    })
    if (!skriv.ok) throw new Error(`skriv daily_results: ${skriv.status} ${await skriv.text()}`)

    return json(200, {
      ok: true,
      status: rad.status,
      nsScore: rad.ns_score,
      skäl: rad.reason,
    })
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
