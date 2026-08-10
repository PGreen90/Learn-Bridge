// Beslut B etapp 2 (steg 2, hämtningsvägen) — dagens tävling.
//
// Returnerar dagens tävlingsset + dess 12 givar som JSON, så klienten kan spela
// dem mot bottarna precis som Dagens giv idag. Läser via service-nyckeln
// server-side (tabellernas radskydd är helt låst för klienter) — serverfunktionen
// är den kontrollerade grinden, i linje med planens princip.
//
// Nivå 1-fuskgränsen (docs/beslut-b-plan.md): svaret innehåller alla fyra
// händerna, precis som dagens gratisgiv — bottarna körs i klienten och behöver
// dem. Integriteten vilar på serverns omspelningsvalidering av INSKICKET, inte
// på att gömma given. (Nivå 2 = dolda händer per stol, senare ägarbeslut.)

import type { IncomingMessage, ServerResponse } from 'node:http'
import { stockholmDateISO } from '../src/lib/engine/daily'

async function restGet(base: string, key: string, pathWithQuery: string): Promise<unknown> {
  const r = await fetch(`${base}/rest/v1/${pathWithQuery}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`${pathWithQuery}: ${r.status} ${await r.text()}`)
  return r.json()
}

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const json = (status: number, data: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) {
    return json(500, { ok: false, fel: 'Saknar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' })
  }

  try {
    const today = stockholmDateISO()
    const sets = (await restGet(
      base,
      key,
      `daily_sets?comp_date=eq.${today}&select=id,daily_number,comp_date,size`,
    )) as Array<{ id: string; daily_number: number; comp_date: string; size: number }>

    if (!sets.length) {
      return json(404, { ok: false, fel: 'Ingen tävling genererad för idag än' })
    }
    const set = sets[0]

    const deals = (await restGet(
      base,
      key,
      `daily_deals?set_id=eq.${set.id}&select=board,dealer,vulnerability,hands&order=board.asc`,
    )) as Array<unknown>

    return json(200, {
      ok: true,
      nummer: set.daily_number,
      tävlingsdag: set.comp_date,
      storlek: set.size,
      givar: deals,
    })
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
