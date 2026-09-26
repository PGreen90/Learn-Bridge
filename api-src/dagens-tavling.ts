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
import { fronyckel, playSeedForBoard } from './_lib/seed'
import { restGet } from './_lib/supabase-rest'
import { lasDag, lasForm } from './_lib/tavlingsdag'

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const json = (status: number, data: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const seedSecret = process.env.DAILY_SEED_SECRET
  if (!base || !key || !seedSecret) {
    return json(500, {
      ok: false,
      fel: 'Saknar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DAILY_SEED_SECRET',
    })
  }

  try {
    // Vilken dag? Idag som standard; `?dag=YYYY-MM-DD` för en tidigare dag
    // (tävlingshistoriken, Påbyggnad 3). Framtid/ogiltigt → 400: morgondagens
    // givar ligger redan i databasen och får aldrig lämnas ut i förväg.
    const url = new URL(req.url ?? '', 'http://x')
    const valdDag = lasDag(url)
    if (valdDag === 'ogiltig') return json(400, { ok: false, fel: 'Ogiltig dag' })
    // Vilken tävling? `?form=mp|imp` (Dagens IMP, 2026-09-26); saknas = MP.
    const form = lasForm(url.searchParams.get('form'))
    if (form === 'ogiltig') return json(400, { ok: false, fel: 'Ogiltig tävlingsform' })
    const today = valdDag.dag
    const sets = (await restGet(
      base,
      key,
      `daily_sets?comp_date=eq.${today}&form=eq.${form}&select=id,daily_number,comp_date,size`,
    )) as Array<{ id: string; daily_number: number; comp_date: string; size: number }>

    if (!sets.length) {
      const namn = form === 'imp' ? 'IMP-tävling' : 'tävling'
      return json(404, {
        ok: false,
        fel: valdDag.idag ? `Ingen ${namn} genererad för idag än` : `Ingen ${namn} den dagen`,
      })
    }
    const set = sets[0]

    const deals = (await restGet(
      base,
      key,
      `daily_deals?set_id=eq.${set.id}&select=board,dealer,vulnerability,hands&order=board.asc`,
    )) as Array<{ board: number; dealer: string; vulnerability: string; hands: unknown }>

    // Ett play-frö per giv så bottarna spelar deterministiskt (klienten trär in
    // det i spelet) och servern kan spela om inskicket med SAMMA frö vid
    // valideringen. Härleds här ur hemligheten — behöver inte lagras.
    const givar = deals.map((d) => ({
      ...d,
      playSeed: playSeedForBoard(seedSecret, fronyckel(today, form), d.board),
    }))

    return json(200, {
      ok: true,
      form,
      nummer: set.daily_number,
      tävlingsdag: set.comp_date,
      storlek: set.size,
      givar,
    })
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
