// Beslut B etapp 4 (4A) + etapp 3 — anropskvoten ("minimal härdning inbakad",
// ägarbeslut 2026-08-17; tävlingens endpoints härdade i etapp 3 2026-08-18).
//
// Mekaniken: fast fönster i Postgres via RPC-funktionen kvot_okning()
// (migration 0007) — atomisk upsert+increment, överlever kalla starter och
// flera samtidiga Vercel-instanser (minnesräknare gör inte det). EN extra
// rundresa per kvotat anrop.

/** Taken per handling: { fönsterlängd i sekunder, max anrop per fönster }.
 *  Hjärtslaget självbegränsas till 1/5 s i klienten — taket 20/min ger marge.
 *  Tävlingen (etapp 3): 12 givar per dag gör 20 inskick/min till ett generöst
 *  tak för en människa och ett hårt för ett skript. */
export const KVOTER = {
  skapa: { fonsterSek: 600, tak: 5 },
  lista: { fonsterSek: 60, tak: 30 },
  'ga-med': { fonsterSek: 60, tak: 10 },
  start: { fonsterSek: 60, tak: 10 },
  drag: { fonsterSek: 60, tak: 120 },
  stol: { fonsterSek: 60, tak: 20 },
  hjartslag: { fonsterSek: 60, tak: 20 },
  lage: { fonsterSek: 60, tak: 30 },
  'skicka-in': { fonsterSek: 60, tak: 20 },
  topplista: { fonsterSek: 60, tak: 30 },
  'giv-resultat': { fonsterSek: 60, tak: 30 },
  'dagens-logg': { fonsterSek: 60, tak: 30 },
} as const

export type KvotHandling = keyof typeof KVOTER

/** Ryms ett anrop till under användarens kvot för handlingen?
 *
 *  Felöppen (fail-open) med flit: kvoten är ett skydd, inte en korrekthetsregel
 *  — går RPC:n sönder ska borden INTE sluta fungera, bara skyddet försvagas
 *  tills felet är lagat. */
export async function kvotOk(
  base: string,
  key: string,
  userId: string,
  handling: KvotHandling,
): Promise<boolean> {
  const k = KVOTER[handling]
  try {
    const r = await fetch(`${base}/rest/v1/rpc/kvot_okning`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_user: userId,
        p_endpoint: handling,
        p_fonster_sek: k.fonsterSek,
        p_tak: k.tak,
      }),
    })
    if (!r.ok) return true
    return (await r.json()) === true
  } catch {
    return true
  }
}
