// Delad Supabase REST-LÄSNING med omförsök på transienta fel (2026-09-13).
//
// Tävlingens läs-endpoints (giv-resultat, dagens-tavling, topplista) hade var
// sin lokala `restGet` som gjorde ETT `fetch` och kastade på minsta icke-2xx.
// En övergående Supabase-hicka (504 Gateway Timeout, kortvarig 5xx, nätfel)
// blev då ett användar-500 ("Servern svarade 500"). Samma svaghet som slog ut
// nattbottarna (504 på Gunnar52-uppslaget). Här försöker vi om på 5xx/429/nätfel
// med kort växande paus; 4xx (äkta fel) och sista försöket kastar som förr.
//
// BARA för GET (idempotent läsning) — skrivningar (POST/PATCH) retar man inte
// utan idempotensnyckel, så de behåller sina egna anrop.

const sov = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * GET mot Supabase PostgREST med omförsök. `forsok` = max antal försök
 * (standard 3: paus 200 ms → 400 ms mellan). Kastar på 4xx direkt och efter
 * sista försöket vid ihållande 5xx/429/nätfel.
 */
export async function restGet(base: string, key: string, pathWithQuery: string, forsok = 3): Promise<unknown> {
  for (let i = 1; ; i++) {
    let r: Response
    try {
      r = await fetch(`${base}/rest/v1/${pathWithQuery}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      })
    } catch (e) {
      if (i >= forsok) throw e
      await sov(200 * i)
      continue
    }
    if (r.ok) return r.json()
    const transient = r.status === 429 || r.status >= 500
    if (transient && i < forsok) {
      await r.text().catch(() => undefined) // töm kroppen innan nästa försök
      await sov(200 * i)
      continue
    }
    throw new Error(`${pathWithQuery}: ${r.status} ${await r.text()}`)
  }
}
