// Beslut B etapp 3 — Dagens giv-loggen på kontot (arkiv + streak cross-device).
//
// GET  = hämta kontots logg (kalenderarkivet/streaken på en ny enhet).
// POST = bokför rader ("första resultatet står" — ignore-duplicates, aldrig
//        över; samma regel som den lokala loggen i Play.tsx).
//
// Dagens giv är gratisspelet utan facitkrav — värdet här är SYNK, inte
// tävlingsintegritet (tävlingen har sin egen validering). Servern sanity-
// checkar ändå raderna (nummer/stick/rimlighet) så skräp aldrig landar.
//
// Miljövariabler (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { dailyNumber } from '../src/lib/engine/daily'
import { kvotOk } from './_lib/kvot'

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 100_000) reject(new Error('för stor kropp'))
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const json = (status: number, data: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(405, { ok: false, fel: 'GET eller POST krävs' })
  }
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return json(500, { ok: false, fel: 'Saknar SUPABASE_URL / SERVICE_ROLE_KEY' })

  try {
    // Vem? (samma verifiering som skicka-in.ts)
    const authz = req.headers.authorization
    const token = authz && authz.startsWith('Bearer ') ? authz.slice(7) : null
    if (!token) return json(401, { ok: false, fel: 'Inte inloggad' })
    const userRes = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    })
    if (!userRes.ok) return json(401, { ok: false, fel: 'Ogiltig session' })
    const userId = ((await userRes.json()) as { id?: string }).id
    if (!userId) return json(401, { ok: false, fel: 'Ogiltig session' })

    if (!(await kvotOk(base, key, userId, 'dagens-logg'))) {
      return json(429, { ok: false, fel: 'För många anrop — vänta en liten stund' })
    }

    if (req.method === 'GET') {
      const r = await fetch(
        `${base}/rest/v1/daily_log?user_id=eq.${userId}&select=giv_nummer,my_tricks,late&order=giv_nummer.asc`,
        { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } },
      )
      if (!r.ok) throw new Error(`daily_log: ${r.status} ${await r.text()}`)
      const rader = (await r.json()) as Array<{ giv_nummer: number; my_tricks: number; late: boolean }>
      return json(200, {
        ok: true,
        logg: rader.map((x) => ({ nummer: x.giv_nummer, myTricks: x.my_tricks, late: x.late })),
      })
    }

    // POST: bokför rader — sanity-checkade, "första står" (ignore-duplicates).
    const body = (await readJson(req)) as { rader?: unknown } | null
    const ra = Array.isArray(body?.rader) ? (body!.rader as unknown[]) : []
    const idag = dailyNumber()
    const giltiga = ra
      .map((x) => x as { nummer?: unknown; myTricks?: unknown; late?: unknown })
      .filter(
        (x) =>
          Number.isInteger(x.nummer) &&
          (x.nummer as number) >= 1 &&
          (x.nummer as number) <= idag &&
          Number.isInteger(x.myTricks) &&
          (x.myTricks as number) >= 0 &&
          (x.myTricks as number) <= 13,
      )
      .slice(0, 100)
    if (!giltiga.length) return json(400, { ok: false, fel: 'Inga giltiga rader' })

    const skriv = await fetch(`${base}/rest/v1/daily_log?on_conflict=user_id,giv_nummer`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(
        giltiga.map((x) => ({
          user_id: userId,
          giv_nummer: x.nummer,
          my_tricks: x.myTricks,
          late: x.late === true,
        })),
      ),
    })
    if (!skriv.ok) throw new Error(`skriv daily_log: ${skriv.status} ${await skriv.text()}`)
    return json(200, { ok: true, antal: giltiga.length })
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
