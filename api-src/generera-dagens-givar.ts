// Beslut B etapp 2 (steg 2) — servergenererade tävlingsgivar.
//
// Skapar dagens TVÅ tävlingar (Dagens MP% + Dagens IMP, ägarbeslut 2026-09-26,
// docs/imp-tavling-plan.md) med 12 givar var ur hemligt HMAC-frö och lagrar dem
// i databasen — varje form med sin egen frönyckel (seed.ts). Körs
// av ett schemalagt jobb (Vercel-cron, se vercel.json) strax efter midnatt
// svensk tid, men är IDEMPOTENT: körs den om samma dag skapas inga dubbletter
// (unika nycklar + "ignore-duplicates"), så en extra körning är ofarlig.
//
// Härdad 2026-10-13 (natten då ingen tävling kom): själva skrivningen bor i den
// delade `sakerstallTavling` (_lib/sakerstall-tavling.ts) med omförsök på
// 5xx/429/nätfel — och nattbottarna anropar samma funktion innan de spelar, så
// faller cronen ändå läker botspelet dagen. vercel.json ger funktionen 60 s så
// omförsöken inte stryps.
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
import { sakerstallTavling } from './_lib/sakerstall-tavling'
import type { TavlingsForm } from '../src/lib/engine/matchpoints'

/** Dagens två tävlingar, i den ordning de skapas. MP FÖRST: den får aldrig
 *  falla för att IMP-setet inte kan skapas (t.ex. innan migration 0014 släppt
 *  den gamla "en per dag"-nyckeln — då faller IMP-raden tyst, se nedan). */
const FORMER: TavlingsForm[] = ['mp', 'imp']

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

    // 3+4) Per form: set + givar via den delade, idempotenta och omförsökande
    //      sakerstallTavling (2026-10-13). MP först; ett fel på IMP-setet stoppar
    //      ALDRIG MP-setet — det rapporteras i svaret i stället (nästa anrop,
    //      cronen eller nattbottarnas självläkning, tar det).
    const utfall: Record<string, { antalGivar: number; brickor: number[]; skapad: boolean } | { fel: string }> = {}
    for (const form of FORMER) {
      try {
        const set = await sakerstallTavling(base, key, seedSecret, dateISO, nummer, form, { forsok: 4, pausMs: 500 })
        utfall[form] = { antalGivar: set.brickor.length, brickor: set.brickor, skapad: set.skapad }
        console.log(`[generera-dagens-givar] ${dateISO} ${form}: ${set.skapad ? 'skapad' : 'fanns redan'} (${set.brickor.length} givar)`)
      } catch (err) {
        // MP-setet är kärnjobbet — dess fel går hela vägen ut som 500.
        if (form === 'mp') throw err
        const fel = String(err instanceof Error ? err.message : err)
        utfall[form] = { fel }
        console.error(`[generera-dagens-givar] ${dateISO} ${form} FEL: ${fel}`)
      }
    }

    // 5) Bordsstädningen (Beslut B etapp 4D): den dagliga cronen grovstädar
    //    vänner-borden — färdiga/avslutade bord äldre än ett dygn raderas
    //    (cascade tar stolar + händelselogg), liksom bord utan aktivitet på
    //    ett dygn (opportunistiska 2 h-stängningen i ?h=skapa tar lobbyn).
    //    Gamla kvotfönster rensas också. Fel här får ALDRIG fälla givarna —
    //    städningen är städning, inte kärnjobb.
    let stadade = 0
    try {
      const grans = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const ta = async (query: string) => {
        const r = await fetch(`${base}/rest/v1/${query}`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
        })
        const antal = Number(r.headers.get('content-range')?.split('/')[1] ?? 0)
        return r.ok ? antal : 0
      }
      stadade += await ta(`tables?status=in.(klar,avslutat)&last_activity=lt.${grans}`)
      stadade += await ta(`tables?status=in.(lobby,spelar)&last_activity=lt.${grans}`)
      await ta(`api_kvot?fonster=lt.${grans}`)
    } catch {
      // Tyst: nästa natts körning tar det.
    }

    // Svaret läcker ALDRIG händerna — bara att jobbet lyckades.
    const mp = utfall.mp as { antalGivar: number; brickor: number[]; skapad: boolean }
    return json(200, {
      ok: true,
      tävlingsdag: dateISO,
      nummer,
      // Bakåtkompatibla fält = MP-setet; `former` bär båda.
      antalGivar: mp.antalGivar,
      brickor: mp.brickor,
      former: utfall,
      stadadeBord: stadade,
    })
  } catch (err) {
    // Loggraden är det enda spår som finns kvar när dagen gick fel — Vercel
    // sparar körloggar bara en kort stund, så den ska säga VAR det small.
    const fel = String(err instanceof Error ? err.message : err)
    console.error(`[generera-dagens-givar] HAVERI: ${fel}`)
    return json(500, { ok: false, fel })
  }
}
