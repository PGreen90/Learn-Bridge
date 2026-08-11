// Beslut B etapp 2 (Led 3) — topplistan för dagens tävling.
//
// Läser alla GODKÄNDA inskick för dagens tävling (service-nyckeln — klienter når
// aldrig andras rader), räknar matchpoäng per giv (matchpoints.ts) och snittar
// per spelare i procent. Minst två spelare på en giv krävs för att den ska ge
// poäng (annars "väntar på fler"). Provisorisk under dagen; slutlig efter
// midnatt + valideringssvep (docs/beslut-b-plan.md, 2b).
//
// Bara visningsnamn + procent lämnas ut — inga privata uppgifter — så endpointen
// kräver ingen inloggning. UI-polish steg 2: skickas en giltig inloggnings-token
// med (Authorization: Bearer …) svarar den DESSUTOM med kallarens egna siffror
// (`du`: placering + snitt, `dinaGivar`: MP% per giv) — allt bakåtkompatibelt,
// utan token exakt som förr.

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedCall } from '../src/lib/bidding'
import { stockholmDateISO } from '../src/lib/engine/daily'
import { contractFromCalls } from '../src/lib/engine/auction-live'
import { aggregeraTopplista, type Tävlingsrad } from '../src/lib/engine/matchpoints'

async function restGet(base: string, key: string, pathWithQuery: string): Promise<unknown> {
  const r = await fetch(`${base}/rest/v1/${pathWithQuery}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`${pathWithQuery}: ${r.status} ${await r.text()}`)
  return r.json()
}

/** Vem kallar? Verifiera en valfri inloggnings-token mot Supabase och lämna
 *  tillbaka user-id, eller null (ingen/ogiltig token = anonym — endpointen
 *  fungerar ändå, bara utan de personliga fälten). Kastar aldrig. */
async function kallarId(base: string, key: string, authz: string | undefined): Promise<string | null> {
  const token = authz && authz.startsWith('Bearer ') ? authz.slice(7) : null
  if (!token) return null
  try {
    const userRes = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    })
    if (!userRes.ok) return null
    const user = (await userRes.json()) as { id?: string }
    return user.id ?? null
  } catch {
    return null
  }
}

const MIN_PER_GIV = 2

/** Kompakt kontrakt + resultat för en av kallarens givar (matchar klientens
 *  GivKontrakt). `diff` = spelförarens över-/understick mot kontraktet. */
interface DinKontrakt {
  level: number
  strain: string
  doubled?: 'X' | 'XX'
  declarer: string
  diff: number
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
    const today = stockholmDateISO()
    const sets = (await restGet(
      base,
      key,
      `daily_sets?comp_date=eq.${today}&select=id,daily_number,size`,
    )) as Array<{ id: string; daily_number: number; size: number }>
    if (!sets.length) return json(404, { ok: false, fel: 'Ingen tävling idag' })
    const set = sets[0]

    const results = (await restGet(
      base,
      key,
      `daily_results?set_id=eq.${set.id}&status=eq.godkand&select=board,user_id,ns_score`,
    )) as Array<{ board: number; user_id: string; ns_score: number | null }>

    // Vem frågar? (valfritt — utan giltig token bara den anonyma listan)
    const meId = await kallarId(base, key, req.headers.authorization)

    // Räkna topplistan + kallarens egna siffror med den rena aggregatfunktionen.
    const rader: Tävlingsrad[] = results.map((r) => ({
      board: r.board,
      spelare: r.user_id,
      poäng: r.ns_score ?? 0,
    }))
    const agg = aggregeraTopplista(rader, MIN_PER_GIV, meId)

    // Kontrakt + resultat per giv för kallaren (steg 4-fix). Servern är
    // auktoritativ: den läser `declarer_tricks` + auktionen ur den lagrade
    // payloaden, så resultattabellen fylls för ALLA dina givar — även sådana
    // som spelades innan kontraktssparningen fanns, och oavsett enhet.
    const kontraktPerBricka = new Map<number, DinKontrakt | null>()
    if (meId && agg.dinaGivar.length) {
      const mina = (await restGet(
        base,
        key,
        `daily_results?set_id=eq.${set.id}&user_id=eq.${meId}&status=eq.godkand&select=board,declarer_tricks,passed_out,payload`,
      )) as Array<{
        board: number
        declarer_tricks: number | null
        passed_out: boolean
        payload: { history?: ResolvedCall[] } | null
      }>
      for (const rad of mina) {
        if (rad.passed_out) {
          kontraktPerBricka.set(rad.board, null)
          continue
        }
        const history = rad.payload?.history
        const contract = Array.isArray(history) ? contractFromCalls(history) : null
        if (contract && rad.declarer_tricks != null) {
          kontraktPerBricka.set(rad.board, {
            level: contract.level,
            strain: contract.strain,
            doubled: contract.doubled,
            declarer: contract.declarer,
            diff: rad.declarer_tricks - (6 + contract.level),
          })
        }
      }
    }
    const dinaGivar = agg.dinaGivar.map((g) => ({
      ...g,
      kontrakt: kontraktPerBricka.get(g.board) ?? null,
    }))

    // Visningsnamn för spelarna på listan.
    const ids = agg.topplista.map((p) => p.spelare)
    const namn = new Map<string, string>()
    if (ids.length) {
      const inList = ids.map((id) => `"${id}"`).join(',')
      const profiler = (await restGet(
        base,
        key,
        `profiles?id=in.(${inList})&select=id,display_name`,
      )) as Array<{ id: string; display_name: string }>
      for (const p of profiler) namn.set(p.id, p.display_name)
    }

    const topplista = agg.topplista.map((p) => ({
      namn: namn.get(p.spelare) ?? '—',
      snitt: p.snitt,
      antalGivar: p.antalGivar,
      // Markera kallarens egen rad (steg 6) — klienten highlightar den.
      jag: p.spelare === meId,
    }))

    return json(200, {
      ok: true,
      nummer: set.daily_number,
      storlek: set.size,
      poängsattaGivar: agg.poängsattaGivar,
      minPerGiv: MIN_PER_GIV,
      topplista,
      // Personliga fält — bara med när en giltig token skickats (annars null/[]).
      du: agg.du,
      dinaGivar,
    })
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
