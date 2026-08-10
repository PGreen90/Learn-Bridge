// Beslut B etapp 2 (steg 2) — servergenererade tävlingsgivar.
//
// Skapar dagens 12 givar med hemligt HMAC-frö och lagrar dem i databasen. Körs
// av ett schemalagt jobb (Vercel-cron, se vercel.json) strax efter midnatt
// svensk tid, men är IDEMPOTENT: körs den om samma dag skapas inga dubbletter
// (unika nycklar + "ignore-duplicates"), så en extra körning är ofarlig.
//
// Skriver till databasen med SERVICE-nyckeln (kringgår radskyddet) via Supabase
// REST-API med fetch — inget npm-beroende, så den buntade funktionen förblir
// självständig. Service-nyckeln och fröet bor BARA i serverns miljövariabler.
//
// Miljövariabler (sätts i Vercel → Settings → Environment Variables):
//   SUPABASE_URL                – projektets bas-URL (samma projekt som appen)
//   SUPABASE_SERVICE_ROLE_KEY   – service_role-nyckeln (HEMLIG, aldrig i klienten)
//   DAILY_SEED_SECRET           – hemligt frö för HMAC (HEMLIG)
//   CRON_SECRET                 – skydd: bara anrop med rätt bevis får köra

import type { IncomingMessage, ServerResponse } from 'node:http'
import { stockholmDateISO, dailyNumber } from '../src/lib/engine/daily'
import { genereraGivar } from './_lib/generera'

const TÄVLINGSSTORLEK = 12

/** Ett PostgREST-anrop mot en tabell med service-nyckeln. Kastar vid fel.
 *  onConflict = den unika kolumn(erna) upserten ska slå samman på (annars
 *  antar PostgREST primärnyckeln, och vår upsert på comp_date/(set_id,board)
 *  krockar i stället för att bli idempotent). */
async function rest(
  base: string,
  key: string,
  table: string,
  body: unknown,
  prefer: string,
  onConflict?: string,
): Promise<unknown> {
  const q = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : ''
  const r = await fetch(`${base}/rest/v1/${table}${q}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    throw new Error(`${table}: ${r.status} ${await r.text()}`)
  }
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const json = (status: number, data: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  // 1) Skydd — bara anrop med rätt bevis (Vercel-cron skickar CRON_SECRET).
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return json(500, { ok: false, fel: 'CRON_SECRET ej konfigurerad' })
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return json(401, { ok: false, fel: 'Otillåten' })
  }

  // 2) Konfiguration.
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
    const dateISO = stockholmDateISO()
    const nummer = dailyNumber()
    const deals = genereraGivar(seedSecret, dateISO, TÄVLINGSSTORLEK)

    // 3) Tävlingsdagen (idempotent upsert på unik comp_date) → hämta dess id.
    const sets = (await rest(
      base,
      key,
      'daily_sets',
      [{ comp_date: dateISO, size: TÄVLINGSSTORLEK, daily_number: nummer }],
      'resolution=merge-duplicates,return=representation',
      'comp_date',
    )) as Array<{ id: string }>
    const setId = sets?.[0]?.id
    if (!setId) throw new Error('daily_sets gav inget id tillbaka')

    // 4) Givarna (idempotent: unik (set_id, board) → dubbletter ignoreras).
    await rest(
      base,
      key,
      'daily_deals',
      deals.map((d) => ({
        set_id: setId,
        board: d.board,
        dealer: d.dealer,
        vulnerability: d.vulnerability,
        hands: d.hands,
      })),
      'resolution=ignore-duplicates,return=minimal',
      'set_id,board',
    )

    // Svaret läcker ALDRIG händerna — bara att jobbet lyckades.
    return json(200, {
      ok: true,
      tävlingsdag: dateISO,
      nummer,
      antalGivar: deals.length,
      brickor: deals.map((d) => d.board),
    })
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
