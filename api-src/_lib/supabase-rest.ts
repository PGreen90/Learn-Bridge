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
export async function restGet(
  base: string,
  key: string,
  pathWithQuery: string,
  forsok = 3,
  extraHeaders: Record<string, string> = {},
): Promise<unknown> {
  for (let i = 1; ; i++) {
    let r: Response
    try {
      r = await fetch(`${base}/rest/v1/${pathWithQuery}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', ...extraHeaders },
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

/**
 * Läs ALLA rader sida för sida (PostgREST Range-headers, `sida` rader per
 * anrop) — för tabeller som växer utan tak (daily_standings, Påbyggnad 3).
 * Varje sida går genom `restGet` (omförsök). Stannar när en sida är kortare
 * än `sida`.
 */
export async function restGetAlla<T = unknown>(
  base: string,
  key: string,
  pathWithQuery: string,
  sida = 1000,
): Promise<T[]> {
  const alla: T[] = []
  for (let from = 0; ; from += sida) {
    const del = (await restGet(base, key, pathWithQuery, 3, {
      Range: `${from}-${from + sida - 1}`,
      'Range-Unit': 'items',
    })) as T[]
    if (!Array.isArray(del)) return alla
    alla.push(...del)
    if (del.length < sida) return alla
  }
}

/**
 * POST mot Supabase PostgREST med omförsök på transienta fel (5xx/429/nätfel),
 * samma paus-schema som `restGet`. Returnerar SVARET — även 4xx (t.ex. 409 vid
 * unik-krock, som kallaren tolkar) — och kastar bara när nätet är nere efter
 * sista försöket. Säkert för skrivningar som skyddas av en UNIK nyckel: landade
 * det första försöket fast svaret gick förlorat, svarar nästa 409 — aldrig en
 * dubblett. Bakgrund (2026-09-13): tävlingens inskick gjorde ETT fetch, så en
 * Supabase-hicka tappade brickan tyst (två spelare, två brickor på ett dygn) —
 * och klienten skickade aldrig om.
 */
export async function restPost(
  base: string,
  key: string,
  path: string,
  body: unknown,
  forsok = 3,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  for (let i = 1; ; i++) {
    let r: Response
    try {
      r = await fetch(`${base}/rest/v1/${path}`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
          ...extraHeaders,
        },
        body: JSON.stringify(body),
      })
    } catch (e) {
      if (i >= forsok) throw e
      await sov(200 * i)
      continue
    }
    const transient = r.status === 429 || r.status >= 500
    if (transient && i < forsok) {
      await r.text().catch(() => undefined)
      await sov(200 * i)
      continue
    }
    return r
  }
}
