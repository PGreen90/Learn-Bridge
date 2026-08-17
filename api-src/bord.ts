// Beslut B etapp 4 — realtidsborden "Spela med vänner": serverfunktionen.
//
// EN fysisk Vercel-funktion med handlingsrouter (?h=skapa|lista|ga-med|lage|
// hjartslag|stol|start|drag) i stället för åtta separata — Hobby-planen har tak
// på antal funktioner och varje bunt väger tungt (motorn följer med i 4B);
// en gemensam funktion delar dessutom varm auth-cache mellan handlingarna.
//
// Principer (ägarbeslut 2026-08-17, docs/bord-plan.md):
//  • Servern är domaren: klienten kan aldrig skriva i databasen — allt går via
//    den här funktionen med service-nyckeln, och table_events (append-only,
//    sekvensnummer) är enda sanningen om ett bord.
//  • Händelser innehåller ALDRIG ospelade dolda händer; egen hand levereras
//    per stol via ?h=lage (byggs i 4B).
//  • Alla handlingar kräver inloggning (konto krävs alltid för spelformen) och
//    går genom anropskvoten (kvot.ts → kvot_okning i Postgres).
//
// Etapp 4A: skapa/lista/ga-med/lage/hjartslag/stol (byt-stol, lamna, avsluta).
// 4B lägger till start/drag + spelmotorn (bord-motor.ts); 4C paus/återta/
// godkännanden/ägarbyte/frånvaro; 4D läge 1+2.
//
// Miljövariabler (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import {
  MAX_AKTIVA_BORD,
  STOLAR,
  type Stol,
  giltigBordKod,
  giltigStol,
  nyBordKod,
} from './_lib/bord-grund'
import { KVOTER, kvotOk, type KvotHandling } from './_lib/kvot'
import {
  bordGiv,
  bordPlaySeed,
  drivFram,
  givStartHandelse,
  projiceraGiv,
  utforDrag,
  type BordDrag,
  type GivHandelse,
  type NyHandelse,
} from './_lib/bord-motor'

// ---------------------------------------------------------------------------
// Små hjälpare (samma mönster som skicka-in.ts — funktionerna är medvetet
// självständiga, inga npm-beroenden).

type Miljo = { base: string; key: string }

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

async function restGet(m: Miljo, pathWithQuery: string): Promise<unknown> {
  const r = await fetch(`${m.base}/rest/v1/${pathWithQuery}`, {
    headers: { apikey: m.key, Authorization: `Bearer ${m.key}`, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`${pathWithQuery}: ${r.status} ${await r.text()}`)
  return r.json()
}

/** POST (insert). Svarar { status, rader } — 409 (unikt index) är ett VÄNTAT
 *  utfall på flera ställen (kodkrock, "en stol per användare"), så det kastas
 *  inte utan lämnas till anroparen. */
async function restPost(
  m: Miljo,
  path: string,
  body: unknown,
  { representation = false } = {},
): Promise<{ status: number; rader: unknown[] }> {
  const r = await fetch(`${m.base}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: m.key,
      Authorization: `Bearer ${m.key}`,
      'Content-Type': 'application/json',
      Prefer: representation ? 'return=representation' : 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (r.status === 409) return { status: 409, rader: [] }
  if (!r.ok) throw new Error(`POST ${path}: ${r.status} ${await r.text()}`)
  return { status: r.status, rader: representation ? ((await r.json()) as unknown[]) : [] }
}

/** PATCH med filter. Med representation: de uppdaterade raderna — tom lista
 *  betyder "filtret träffade inget" (t.ex. stolen var redan tagen). */
async function restPatch(
  m: Miljo,
  pathWithQuery: string,
  body: unknown,
  { representation = false } = {},
): Promise<{ status: number; rader: unknown[] }> {
  const r = await fetch(`${m.base}/rest/v1/${pathWithQuery}`, {
    method: 'PATCH',
    headers: {
      apikey: m.key,
      Authorization: `Bearer ${m.key}`,
      'Content-Type': 'application/json',
      Prefer: representation ? 'return=representation' : 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (r.status === 409) return { status: 409, rader: [] }
  if (!r.ok) throw new Error(`PATCH ${pathWithQuery}: ${r.status} ${await r.text()}`)
  return { status: r.status, rader: representation ? ((await r.json()) as unknown[]) : [] }
}

async function restDelete(m: Miljo, pathWithQuery: string): Promise<void> {
  const r = await fetch(`${m.base}/rest/v1/${pathWithQuery}`, {
    method: 'DELETE',
    headers: { apikey: m.key, Authorization: `Bearer ${m.key}` },
  })
  if (!r.ok) throw new Error(`DELETE ${pathWithQuery}: ${r.status} ${await r.text()}`)
}

// ---------------------------------------------------------------------------
// Auth med varm cache. Verifieringen är ett HTTP-anrop till Supabase per
// request (samma som skicka-in.ts) — cachen (60 s TTL på modulnivå) låter en
// varm instans hoppa över rundan för hjärtslag/drag i följd. Värsta fallet med
// en föråldrad cache: en redan utfärdad sessions läsning förlängs 60 s.
// (Lokal JWKS-verifiering är den dokumenterade eskalationsvägen — inte i v1.)

const authCache = new Map<string, { userId: string; t: number }>()
const AUTH_TTL_MS = 60_000

async function verifieraToken(m: Miljo, token: string): Promise<string | null> {
  const nu = Date.now()
  const cached = authCache.get(token)
  if (cached && nu - cached.t < AUTH_TTL_MS) return cached.userId
  const r = await fetch(`${m.base}/auth/v1/user`, {
    headers: { apikey: m.key, Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null
  const user = (await r.json()) as { id?: string }
  if (!user.id) return null
  // Hindra att cachen växer obegränsat i en långlivad instans.
  if (authCache.size > 500) authCache.clear()
  authCache.set(token, { userId: user.id, t: nu })
  return user.id
}

// ---------------------------------------------------------------------------
// Radtyper (speglar migration 0007) + uppslag.

type BordRad = {
  id: string
  kod: string
  owner_id: string
  status: 'lobby' | 'spelar' | 'klar' | 'avslutat'
  spelform: 'budgivning' | 'spelforing' | 'full'
  givar: number
  tempo: 'lugn' | 'normal' | 'snabb'
  privat: boolean
  aktuell_giv: number
}

type StolRad = {
  table_id: string
  seat: Stol
  user_id: string | null
  typ: 'bot' | 'manniska'
  status: 'aktiv' | 'paus' | 'borta'
  aktiv: boolean
  joined_at: string | null
  /** Ägaren har reserverat stolen som bot (0008) — människor kan inte ta den. */
  bot_reserverad: boolean
}

type HandelseRad = {
  seq: number
  giv: number
  typ: string
  seat: Stol | null
  data: unknown
}

const BORD_KOLUMNER = 'id,kod,owner_id,status,spelform,givar,tempo,privat,aktuell_giv'
const STOL_KOLUMNER = 'table_id,seat,user_id,typ,status,aktiv,joined_at,bot_reserverad'
const HANDELSE_KOLUMNER = 'seq,giv,typ,seat,data'

async function hamtaBord(m: Miljo, kod: string): Promise<BordRad | null> {
  const rader = (await restGet(
    m,
    `tables?kod=eq.${kod}&select=${BORD_KOLUMNER}`,
  )) as BordRad[]
  return rader[0] ?? null
}

async function hamtaStolar(m: Miljo, tableId: string): Promise<StolRad[]> {
  const rader = (await restGet(
    m,
    `table_seats?table_id=eq.${tableId}&select=${STOL_KOLUMNER}`,
  )) as StolRad[]
  // Fast stolordning N,E,S,W så alla svar är stabila.
  return rader.sort((a, b) => STOLAR.indexOf(a.seat) - STOLAR.indexOf(b.seat))
}

/** Visningsnamn för en uppsättning konton (profiles läses med service-nyckeln,
 *  samma väg som topplistan). */
async function visningsnamn(m: Miljo, userIds: string[]): Promise<Map<string, string>> {
  const namn = new Map<string, string>()
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return namn
  const rader = (await restGet(
    m,
    `profiles?id=in.(${ids.join(',')})&select=id,display_name`,
  )) as Array<{ id: string; display_name: string }>
  for (const r of rader) namn.set(r.id, r.display_name)
  return namn
}

async function hamtaSenasteSeq(m: Miljo, tableId: string): Promise<number> {
  const rader = (await restGet(
    m,
    `table_events?table_id=eq.${tableId}&select=seq&order=seq.desc&limit=1`,
  )) as Array<{ seq: number }>
  return rader[0]?.seq ?? 0
}

async function hamtaHandelser(m: Miljo, tableId: string, franSeq: number): Promise<HandelseRad[]> {
  return (await restGet(
    m,
    `table_events?table_id=eq.${tableId}&seq=gt.${franSeq}&select=${HANDELSE_KOLUMNER}&order=seq.asc&limit=500`,
  )) as HandelseRad[]
}

/** Bokför händelser i loggen. Sekvensvakten: läs huvudet, skriv head+1.. i EN
 *  batch — krockar två skrivare tar primärnyckeln (table_id, seq) smällen och
 *  förloraren läser om och försöker igen. Returnerar nya huvudet + raderna.
 *
 *  `basHead`: skriv EXAKT ovanpå det här sekvensnumret, utan omtag — dragvägen
 *  (4B) har validerat mot loggen vid basHead, och har någon annan hunnit skriva
 *  är valideringen inaktuell: då returneras null och kallaren svarar 409 så
 *  klienten läser om och försöker igen. */
async function laggTillHandelser(
  m: Miljo,
  tableId: string,
  handelser: Array<{ giv?: number; typ: string; seat?: Stol | null; data?: unknown }>,
  basHead?: number,
): Promise<{ senasteSeq: number; rader: HandelseRad[] } | null> {
  for (let forsok = 0; forsok < 3; forsok++) {
    const head = basHead ?? (await hamtaSenasteSeq(m, tableId))
    const rader = handelser.map((h, i) => ({
      table_id: tableId,
      seq: head + 1 + i,
      giv: h.giv ?? 0,
      typ: h.typ,
      seat: h.seat ?? null,
      data: h.data ?? {},
    }))
    const svar = await restPost(m, 'table_events', rader)
    if (svar.status !== 409) {
      return {
        senasteSeq: head + handelser.length,
        rader: rader.map((r) => ({ seq: r.seq, giv: r.giv, typ: r.typ, seat: r.seat, data: r.data })),
      }
    }
    if (basHead !== undefined) return null // dragvägen: aldrig omtag på inaktuell bas
  }
  throw new Error('kapplöpning om sekvensnumret — försök igen')
}

/** Bordets hemliga frö — hämtas BARA av start/drag-vägarna, skickas aldrig
 *  till klienten (därför ingår det inte i BORD_KOLUMNER). */
async function hamtaSeed(m: Miljo, tableId: string): Promise<string> {
  const rader = (await restGet(m, `tables?id=eq.${tableId}&select=seed`)) as Array<{ seed: string }>
  if (!rader[0]) throw new Error('bordet saknar frö')
  return rader[0].seed
}

/** Händelserna för EN giv (spelmotorns projektion läser bara bud/kort/trakarl/
 *  giv-klar, men hela givens lista hämtas — indexet (table_id, giv) bär). */
async function hamtaGivHandelser(m: Miljo, tableId: string, giv: number): Promise<GivHandelse[]> {
  const rader = (await restGet(
    m,
    `table_events?table_id=eq.${tableId}&giv=eq.${giv}&select=${HANDELSE_KOLUMNER}&order=seq.asc&limit=500`,
  )) as HandelseRad[]
  return rader.map((r) => ({ typ: r.typ, seat: r.seat, data: r.data }))
}

/** Ställningen ({ns, ew}-totaler) EFTER senaste färdigspelade giv före `giv` —
 *  läses ur den senaste giv-klar-händelsens inbakade ställning. */
async function stallningFore(m: Miljo, tableId: string, giv: number): Promise<{ ns: number; ew: number }> {
  const rader = (await restGet(
    m,
    `table_events?table_id=eq.${tableId}&typ=eq.giv-klar&giv=lt.${giv}&select=data&order=seq.desc&limit=1`,
  )) as Array<{ data: { stallning?: { ns: number; ew: number } } }>
  return rader[0]?.data.stallning ?? { ns: 0, ew: 0 }
}

/** Människostolarna (styrda av en aktiv människa) — botframdrivningens stopp. */
function manniskoStolar(stolar: StolRad[]): Set<Stol> {
  return new Set(stolar.filter((s) => s.user_id && s.typ === 'manniska').map((s) => s.seat))
}

async function rorBordet(m: Miljo, tableId: string): Promise<void> {
  await restPatch(m, `tables?id=eq.${tableId}`, { last_activity: new Date().toISOString() })
}

/** Stolarna i klientform — user_id lämnar aldrig servern, bara visningsnamnet.
 *  I lobbyn visas en obemannad stol som "ledig" (bot sätts först vid start),
 *  utom när ägaren reserverat den som bot (0008) — då visas den som bot direkt. */
function stolarTillKlient(
  bord: BordRad,
  stolar: StolRad[],
  namn: Map<string, string>,
): Array<{ stol: Stol; typ: 'manniska' | 'bot' | 'ledig'; namn: string | null; status: string }> {
  return stolar.map((s) => ({
    stol: s.seat,
    typ: s.user_id
      ? ('manniska' as const)
      : bord.status === 'lobby' && !s.bot_reserverad
        ? ('ledig' as const)
        : ('bot' as const),
    namn: s.user_id ? (namn.get(s.user_id) ?? null) : null,
    status: s.status,
  }))
}

/** Frigör en stol (spelaren lämnar/byter) — tillbaka till obemannad. */
async function frigorStol(m: Miljo, tableId: string, stol: Stol): Promise<void> {
  await restPatch(m, `table_seats?table_id=eq.${tableId}&seat=eq.${stol}`, {
    user_id: null,
    typ: 'bot',
    status: 'aktiv',
    joined_at: null,
    last_seen_at: null,
  })
}

/** Ta en ledig stol åt en användare. Villkoret user_id=is.null i filtret gör
 *  anspråket kapplöpningssäkert — träffar PATCH:en inget var stolen redan
 *  tagen. 409 = användaren sitter redan någon annanstans (unika indexet). */
async function taStol(
  m: Miljo,
  tableId: string,
  stol: Stol,
  userId: string,
): Promise<'ok' | 'upptagen' | 'sitter-redan'> {
  const nu = new Date().toISOString()
  const svar = await restPatch(
    m,
    `table_seats?table_id=eq.${tableId}&seat=eq.${stol}&user_id=is.null`,
    { user_id: userId, typ: 'manniska', status: 'aktiv', joined_at: nu, last_seen_at: nu },
    { representation: true },
  )
  if (svar.status === 409) return 'sitter-redan'
  return svar.rader.length ? 'ok' : 'upptagen'
}

/** Avsluta ett bord: status → avslutat, alla stolar släpps (aktiv=false så
 *  "en stol per användare"-indexet frigörs), bord-slut-händelse. */
async function avslutaBord(m: Miljo, tableId: string, skal: string): Promise<void> {
  await restPatch(m, `tables?id=eq.${tableId}`, { status: 'avslutat' })
  await restPatch(m, `table_seats?table_id=eq.${tableId}`, { aktiv: false })
  await laggTillHandelser(m, tableId, [{ typ: 'bord-slut', data: { skal } }])
}

/** Opportunistisk städning (körs i skapa, innan globala taket räknas): bord
 *  utan aktivitet på 2 h är övergivna — stäng dem så de inte blockerar taket.
 *  Den dagliga cronen gör grovstädningen (raderar gamla rader, byggs i 4D). */
async function stadaOvergivna(m: Miljo): Promise<void> {
  const grans = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const gamla = (await restGet(
    m,
    `tables?status=in.(lobby,spelar)&last_activity=lt.${grans}&select=id`,
  )) as Array<{ id: string }>
  for (const bord of gamla) await avslutaBord(m, bord.id, 'overgivet')
}

// ---------------------------------------------------------------------------
// Handlingarna.

type Svara = (status: number, data: unknown) => void

async function hanteraSkapa(m: Miljo, userId: string, body: unknown, json: Svara): Promise<void> {
  const b = (body ?? {}) as Record<string, unknown>
  const spelform = b.spelform
  const givar = b.givar
  const tempo = b.tempo ?? 'normal'
  const privat = b.privat === true
  const stol: Stol = giltigStol(b.stol) ? b.stol : 'S'
  if (spelform !== 'budgivning' && spelform !== 'spelforing' && spelform !== 'full') {
    return json(400, { ok: false, fel: 'Ogiltig spelform' })
  }
  if (typeof givar !== 'number' || !Number.isInteger(givar) || givar < 1 || givar > 24) {
    return json(400, { ok: false, fel: 'Antal givar måste vara 1–24' })
  }
  if (tempo !== 'lugn' && tempo !== 'normal' && tempo !== 'snabb') {
    return json(400, { ok: false, fel: 'Ogiltigt tempo' })
  }

  await stadaOvergivna(m)

  // Vänliga förkontroller — de unika indexen är de verkliga vakterna.
  const minStol = (await restGet(
    m,
    `table_seats?user_id=eq.${userId}&aktiv=is.true&select=table_id`,
  )) as unknown[]
  if (minStol.length) {
    return json(409, { ok: false, fel: 'Du sitter redan vid ett bord — lämna det först' })
  }
  const aktiva = (await restGet(m, `tables?status=in.(lobby,spelar)&select=id`)) as unknown[]
  if (aktiva.length >= MAX_AKTIVA_BORD) {
    return json(409, {
      ok: false,
      fel: `Fullt just nu — max ${MAX_AKTIVA_BORD} bord samtidigt. Prova igen om en stund.`,
    })
  }

  // Skapa bordet. Kodkrock (unik kod) är osannolik men hanteras med omtag;
  // 409 kan också betyda "du har redan ett aktivt bord" (ägarindexet).
  let bord: BordRad | null = null
  for (let forsok = 0; forsok < 3 && !bord; forsok++) {
    const svar = await restPost(
      m,
      'tables',
      [
        {
          kod: nyBordKod(),
          owner_id: userId,
          status: 'lobby',
          spelform,
          givar,
          tempo,
          privat,
          seed: randomBytes(16).toString('hex'),
        },
      ],
      { representation: true },
    )
    if (svar.status === 409) {
      const harRedan = (await restGet(
        m,
        `tables?owner_id=eq.${userId}&status=in.(lobby,spelar)&select=id`,
      )) as unknown[]
      if (harRedan.length) return json(409, { ok: false, fel: 'Du har redan ett aktivt bord' })
      continue // kodkrock — nytt försök med ny kod
    }
    bord = (svar.rader as BordRad[])[0] ?? null
  }
  if (!bord) return json(500, { ok: false, fel: 'Kunde inte skapa bordet — försök igen' })

  // Fyra stolar; ägaren på sin valda.
  const nu = new Date().toISOString()
  const stolar = STOLAR.map((s) => ({
    table_id: bord!.id,
    seat: s,
    user_id: s === stol ? userId : null,
    typ: s === stol ? 'manniska' : 'bot',
    status: 'aktiv',
    aktiv: true,
    joined_at: s === stol ? nu : null,
    last_seen_at: s === stol ? nu : null,
  }))
  const stolSvar = await restPost(m, 'table_seats', stolar)
  if (stolSvar.status === 409) {
    // Kapplöpning: användaren hann sätta sig någon annanstans. Riv bordet.
    await restDelete(m, `tables?id=eq.${bord.id}`)
    return json(409, { ok: false, fel: 'Du sitter redan vid ett bord — lämna det först' })
  }

  const namn = await visningsnamn(m, [userId])
  await laggTillHandelser(m, bord.id, [
    { typ: 'stol', seat: stol, data: { handling: 'skapade', namn: namn.get(userId) ?? null } },
  ])
  return json(200, { ok: true, bord: { kod: bord.kod } })
}

async function hanteraLista(m: Miljo, userId: string, json: Svara): Promise<void> {
  const publika = (await restGet(
    m,
    `tables?status=in.(lobby,spelar)&privat=is.false&select=${BORD_KOLUMNER}&order=created_at.desc`,
  )) as BordRad[]

  // Mitt bord (kan vara privat och syns då inte i listan ovan).
  const minaStolar = (await restGet(
    m,
    `table_seats?user_id=eq.${userId}&aktiv=is.true&select=table_id,seat`,
  )) as Array<{ table_id: string; seat: Stol }>
  const mittTableId = minaStolar[0]?.table_id ?? null

  const bordAttVisa = [...publika]
  if (mittTableId && !bordAttVisa.some((b) => b.id === mittTableId)) {
    const mitt = (await restGet(
      m,
      `tables?id=eq.${mittTableId}&select=${BORD_KOLUMNER}`,
    )) as BordRad[]
    if (mitt[0]) bordAttVisa.push(mitt[0])
  }

  let stolarPerBord = new Map<string, StolRad[]>()
  const alla: StolRad[] = bordAttVisa.length
    ? ((await restGet(
        m,
        `table_seats?table_id=in.(${bordAttVisa.map((b) => b.id).join(',')})&select=${STOL_KOLUMNER}`,
      )) as StolRad[])
    : []
  stolarPerBord = alla.reduce((map, s) => {
    const lista = map.get(s.table_id) ?? []
    lista.push(s)
    map.set(s.table_id, lista)
    return map
  }, stolarPerBord)
  const namn = await visningsnamn(m, alla.map((s) => s.user_id).filter((x): x is string => !!x))

  const bord = bordAttVisa.map((b) => {
    const stolar = (stolarPerBord.get(b.id) ?? []).sort(
      (x, y) => STOLAR.indexOf(x.seat) - STOLAR.indexOf(y.seat),
    )
    return {
      kod: b.kod,
      status: b.status,
      spelform: b.spelform,
      givar: b.givar,
      tempo: b.tempo,
      privat: b.privat,
      stolar: stolarTillKlient(b, stolar, namn),
      dittBord: b.id === mittTableId,
    }
  })
  const mittBord = bord.find((b) => b.dittBord) ?? null
  return json(200, {
    ok: true,
    bord,
    mitt: mittBord ? { kod: mittBord.kod, stol: minaStolar[0].seat } : null,
  })
}

async function hanteraGaMed(m: Miljo, userId: string, body: unknown, json: Svara): Promise<void> {
  const b = (body ?? {}) as Record<string, unknown>
  const kod = typeof b.kod === 'string' ? b.kod.trim().toUpperCase() : ''
  if (!giltigBordKod(kod)) return json(400, { ok: false, fel: 'Ogiltig bordskod' })
  const bord = await hamtaBord(m, kod)
  if (!bord || bord.status === 'avslutat' || bord.status === 'klar') {
    return json(404, { ok: false, fel: 'Hittade inget bord med den koden' })
  }
  if (bord.status !== 'lobby') {
    // Att ta över en botstol vid ett pågående publikt bord byggs i 4C.
    return json(409, { ok: false, fel: 'Bordet har redan startat' })
  }

  const stolar = await hamtaStolar(m, bord.id)
  // Sitter du redan här? Då är allt väl (t.ex. omladdad flik).
  const min = stolar.find((s) => s.user_id === userId)
  if (min) return json(200, { ok: true, kod: bord.kod, stol: min.seat })

  const onskad = giltigStol(b.stol) ? b.stol : null
  // Reserverade botstolar (0008) är inte lediga för människor.
  const lediga = stolar.filter((s) => !s.user_id && !s.bot_reserverad).map((s) => s.seat)
  if (!lediga.length) return json(409, { ok: false, fel: 'Bordet är fullt' })
  if (onskad && !lediga.includes(onskad)) {
    return json(409, { ok: false, fel: 'Stolen är upptagen — välj en annan' })
  }

  const stol = onskad ?? lediga[0]
  const utfall = await taStol(m, bord.id, stol, userId)
  if (utfall === 'sitter-redan') {
    return json(409, { ok: false, fel: 'Du sitter redan vid ett bord — lämna det först' })
  }
  if (utfall === 'upptagen') {
    return json(409, { ok: false, fel: 'Stolen togs precis — prova en annan' })
  }

  const namn = await visningsnamn(m, [userId])
  await laggTillHandelser(m, bord.id, [
    { typ: 'stol', seat: stol, data: { handling: 'satte-sig', namn: namn.get(userId) ?? null } },
  ])
  await rorBordet(m, bord.id)
  return json(200, { ok: true, kod: bord.kod, stol })
}

async function hanteraLage(
  m: Miljo,
  userId: string,
  url: URL,
  json: Svara,
): Promise<void> {
  const kod = (url.searchParams.get('bord') ?? '').trim().toUpperCase()
  if (!giltigBordKod(kod)) return json(400, { ok: false, fel: 'Ogiltig bordskod' })
  const bord = await hamtaBord(m, kod)
  if (!bord) return json(404, { ok: false, fel: 'Hittade inget bord med den koden' })

  const stolar = await hamtaStolar(m, bord.id)
  const namn = await visningsnamn(
    m,
    stolar.map((s) => s.user_id).filter((x): x is string => !!x),
  )
  const min = stolar.find((s) => s.user_id === userId)

  // Händelserna är deltagarnas — den som bara har koden ser stolskartan (för
  // att kunna välja stol och sätta sig) men inte loggen.
  const franParam = Number(url.searchParams.get('fran') ?? '0')
  const fran = Number.isFinite(franParam) && franParam >= 0 ? Math.floor(franParam) : 0
  const events = min ? await hamtaHandelser(m, bord.id, fran) : []
  const senasteSeq = events.length ? events[events.length - 1].seq : await hamtaSenasteSeq(m, bord.id)

  // Din hand för pågående giv (4B, dolda händer): HELA den utdelade handen —
  // klienten drar själv bort sina spelade kort. Bara din egen stol, aldrig
  // någon annans; träkarlen kommer som händelse ('trakarl') när den avslöjas.
  // Dessutom spelvyns startpaket: ställningen före aktuell giv + var givens
  // händelser börjar i loggen (klienten behöver aldrig äldre händelser).
  let dinHand: unknown = null
  let stallning: { ns: number; ew: number } | null = null
  let givStartSeq: number | null = null
  if (min && (bord.status === 'spelar' || bord.status === 'klar') && bord.aktuell_giv >= 1) {
    if (bord.status === 'spelar') {
      const seed = await hamtaSeed(m, bord.id)
      dinHand = bordGiv(seed, bord.aktuell_giv).hands[min.seat]
    }
    stallning = await stallningFore(m, bord.id, bord.aktuell_giv)
    const startRad = (await restGet(
      m,
      `table_events?table_id=eq.${bord.id}&typ=eq.giv-start&select=seq&order=seq.desc&limit=1`,
    )) as Array<{ seq: number }>
    givStartSeq = startRad[0]?.seq ?? null
  }

  return json(200, {
    ok: true,
    meta: {
      // Tabell-id:t behövs för realtidskanalen (Postgres Changes filtrerar på
      // table_id). Ofarligt att lämna ut: RLS släpper ändå bara deltagare.
      id: bord.id,
      kod: bord.kod,
      status: bord.status,
      spelform: bord.spelform,
      givar: bord.givar,
      tempo: bord.tempo,
      privat: bord.privat,
      aktuellGiv: bord.aktuell_giv,
      duArAgare: bord.owner_id === userId,
      dinStol: min?.seat ?? null,
    },
    stolar: stolarTillKlient(bord, stolar, namn),
    events,
    senasteSeq,
    dinHand,
    stallning,
    givStartSeq,
  })
}

async function hanteraHjartslag(
  m: Miljo,
  userId: string,
  body: unknown,
  json: Svara,
): Promise<void> {
  const b = (body ?? {}) as Record<string, unknown>
  const kod = typeof b.kod === 'string' ? b.kod.trim().toUpperCase() : ''
  if (!giltigBordKod(kod)) return json(400, { ok: false, fel: 'Ogiltig bordskod' })
  const bord = await hamtaBord(m, kod)
  if (!bord) return json(404, { ok: false, fel: 'Bordet finns inte längre' })

  const stolar = await hamtaStolar(m, bord.id)
  const min = stolar.find((s) => s.user_id === userId)
  if (!min) return json(403, { ok: false, fel: 'Du sitter inte vid det här bordet' })

  const nu = new Date().toISOString()
  await restPatch(m, `table_seats?table_id=eq.${bord.id}&seat=eq.${min.seat}`, {
    last_seen_at: nu,
  })
  await restPatch(m, `tables?id=eq.${bord.id}`, { last_activity: nu })
  // 4C bygger på: frånvarodetektering (45 s → bot), auto-godkännanden,
  // ägarbyte och botframdrivning. 4A:s hjärtslag är bara närvaro + ikapp.

  const franParam = Number(b.seq ?? 0)
  const fran = Number.isFinite(franParam) && franParam >= 0 ? Math.floor(franParam) : 0
  const events = await hamtaHandelser(m, bord.id, fran)
  const senasteSeq = events.length ? events[events.length - 1].seq : fran
  return json(200, { ok: true, senasteSeq, events })
}

async function hanteraStol(m: Miljo, userId: string, body: unknown, json: Svara): Promise<void> {
  const b = (body ?? {}) as Record<string, unknown>
  const kod = typeof b.kod === 'string' ? b.kod.trim().toUpperCase() : ''
  const handling = b.handling
  if (!giltigBordKod(kod)) return json(400, { ok: false, fel: 'Ogiltig bordskod' })
  const bord = await hamtaBord(m, kod)
  if (!bord) return json(404, { ok: false, fel: 'Bordet finns inte längre' })
  const stolar = await hamtaStolar(m, bord.id)
  const min = stolar.find((s) => s.user_id === userId)
  if (!min) return json(403, { ok: false, fel: 'Du sitter inte vid det här bordet' })
  const namn = await visningsnamn(m, [userId])
  const mittNamn = namn.get(userId) ?? null

  if (handling === 'satt-bot' || handling === 'oppna-stol') {
    // Reservera en ledig stol som bot / öppna den igen (0008). Bara ägaren,
    // bara i lobbyn — efter start ÄR obemannade stolar bottar ändå.
    if (bord.owner_id !== userId) {
      return json(403, { ok: false, fel: 'Bara bordets ägare kan reservera stolar' })
    }
    if (bord.status !== 'lobby') {
      return json(409, { ok: false, fel: 'Stolar reserveras före start' })
    }
    const stol = b.stol
    if (!giltigStol(stol)) return json(400, { ok: false, fel: 'Ogiltig stol' })
    const rad = stolar.find((s) => s.seat === stol)
    if (!rad || rad.user_id) return json(409, { ok: false, fel: 'Stolen är inte ledig' })
    const reservera = handling === 'satt-bot'
    await restPatch(m, `table_seats?table_id=eq.${bord.id}&seat=eq.${stol}&user_id=is.null`, {
      bot_reserverad: reservera,
    })
    await laggTillHandelser(m, bord.id, [
      { typ: 'stol', seat: stol, data: { handling: reservera ? 'bot-reserverad' : 'stol-oppnad' } },
    ])
    await rorBordet(m, bord.id)
    return json(200, { ok: true })
  }

  if (handling === 'byt-stol') {
    if (bord.status !== 'lobby') {
      return json(409, { ok: false, fel: 'Stolbyte går bara före start' })
    }
    const till = b.stol
    if (!giltigStol(till)) return json(400, { ok: false, fel: 'Ogiltig stol' })
    if (till === min.seat) return json(200, { ok: true, stol: min.seat })
    const målRad = stolar.find((s) => s.seat === till)
    if (målRad?.bot_reserverad) {
      return json(409, { ok: false, fel: 'Stolen är reserverad för en bot' })
    }
    // Frigör först (annars bråkar "en stol per användare"-indexet), ta sedan
    // den nya; misslyckas anspråket tas den gamla tillbaka.
    await frigorStol(m, bord.id, min.seat)
    const utfall = await taStol(m, bord.id, till, userId)
    if (utfall !== 'ok') {
      await taStol(m, bord.id, min.seat, userId)
      return json(409, { ok: false, fel: 'Stolen togs precis — prova en annan' })
    }
    await laggTillHandelser(m, bord.id, [
      { typ: 'stol', seat: till, data: { handling: 'bytte', fran: min.seat, namn: mittNamn } },
    ])
    await rorBordet(m, bord.id)
    return json(200, { ok: true, stol: till })
  }

  if (handling === 'lamna') {
    if (bord.status !== 'lobby') {
      // Att lämna under spel (bot tar över, ägaren godkänner) byggs i 4C.
      return json(409, { ok: false, fel: 'Att lämna under spel byggs i nästa steg' })
    }
    if (bord.owner_id === userId) {
      await avslutaBord(m, bord.id, 'agaren-lamnade')
      return json(200, { ok: true, avslutat: true })
    }
    await frigorStol(m, bord.id, min.seat)
    await laggTillHandelser(m, bord.id, [
      { typ: 'stol', seat: min.seat, data: { handling: 'lamnade', namn: mittNamn } },
    ])
    await rorBordet(m, bord.id)
    return json(200, { ok: true })
  }

  if (handling === 'avsluta') {
    if (bord.owner_id !== userId) {
      return json(403, { ok: false, fel: 'Bara bordets ägare kan avsluta det' })
    }
    await avslutaBord(m, bord.id, 'agaren-avslutade')
    return json(200, { ok: true, avslutat: true })
  }

  // paus-begaran / aterta / godkann / neka byggs i 4C.
  return json(400, { ok: false, fel: 'Okänd stolhandling' })
}

/** Ägaren startar bordet: obemannade stolar blir bottar, första given genereras
 *  och bottarna spelar fram till första människans tur — allt i EN händelsebatch. */
async function hanteraStart(m: Miljo, userId: string, body: unknown, json: Svara): Promise<void> {
  const b = (body ?? {}) as Record<string, unknown>
  const kod = typeof b.kod === 'string' ? b.kod.trim().toUpperCase() : ''
  if (!giltigBordKod(kod)) return json(400, { ok: false, fel: 'Ogiltig bordskod' })
  const bord = await hamtaBord(m, kod)
  if (!bord) return json(404, { ok: false, fel: 'Bordet finns inte längre' })
  if (bord.owner_id !== userId) {
    return json(403, { ok: false, fel: 'Bara bordets ägare kan starta spelet' })
  }
  if (bord.spelform !== 'full') {
    // Läge 1 (endast budgivning) och läge 2 (endast spelföring) byggs i 4D.
    return json(409, { ok: false, fel: 'Den här spelformen kommer i nästa delleverans' })
  }

  // Villkorad statusövergång = startvakten: bara EN kallare vinner lobby→spelar.
  const overgang = await restPatch(
    m,
    `tables?id=eq.${bord.id}&status=eq.lobby`,
    { status: 'spelar', aktuell_giv: 1, last_activity: new Date().toISOString() },
    { representation: true },
  )
  if (!overgang.rader.length) {
    return json(409, { ok: false, fel: 'Bordet är redan startat' })
  }

  // Obemannade stolar blir bottar (reserverade är det redan i praktiken).
  await restPatch(m, `table_seats?table_id=eq.${bord.id}&user_id=is.null`, { typ: 'bot' })

  const stolar = await hamtaStolar(m, bord.id)
  const seed = await hamtaSeed(m, bord.id)
  const deal = bordGiv(seed, 1)
  const handelser: NyHandelse[] = [
    { giv: 0, typ: 'bord-startat', data: {} },
    givStartHandelse(deal, 1),
  ]
  const givLista: GivHandelse[] = handelser
    .filter((h) => h.giv === 1)
    .map((h) => ({ typ: h.typ, seat: h.seat ?? null, data: h.data ?? {} }))
  handelser.push(
    ...drivFram(deal, 1, givLista, {
      manniskoStolar: manniskoStolar(stolar),
      playSeed: bordPlaySeed(seed, 1),
      stallning: { ns: 0, ew: 0 },
    }),
  )
  const skrivet = await laggTillHandelser(m, bord.id, handelser)
  return json(200, { ok: true, senasteSeq: skrivet?.senasteSeq ?? 0 })
}

/** Ett mänskligt drag (bud/kort/nästa giv). Sekvensvakten: klienten skickar
 *  `basSeq` = senaste sekvensnummer den sett; stämmer det inte med loggens
 *  huvud svarar vi 409 med färskt huvud (klienten hämtar ikapp och försöker
 *  igen om det fortfarande är dess tur). Draget + alla botsvar bokförs som EN
 *  batch ovanpå basSeq — primärnyckeln gör kapplöpningar ofarliga. */
async function hanteraDrag(m: Miljo, userId: string, body: unknown, json: Svara): Promise<void> {
  const b = (body ?? {}) as Record<string, unknown>
  const kod = typeof b.kod === 'string' ? b.kod.trim().toUpperCase() : ''
  if (!giltigBordKod(kod)) return json(400, { ok: false, fel: 'Ogiltig bordskod' })
  const basSeq = Number(b.basSeq)
  if (!Number.isInteger(basSeq) || basSeq < 0) {
    return json(400, { ok: false, fel: 'Ogiltigt basSeq' })
  }
  // HETA VÄGEN: uppslagen slås ihop (bordet + fröet i EN fråga) och körs
  // parallellt — sekventiella rundresor Vercel↔Supabase var det som gjorde
  // varje drag segt (ägarens fynd 2026-08-17: 1–2 s innan kortet lade sig).
  const bordRader = (await restGet(
    m,
    `tables?kod=eq.${kod}&select=${BORD_KOLUMNER},seed`,
  )) as Array<BordRad & { seed: string }>
  const bord = bordRader[0]
  if (!bord) return json(404, { ok: false, fel: 'Bordet finns inte längre' })
  if (bord.status !== 'spelar') return json(409, { ok: false, fel: 'Bordet spelar inte' })
  const giv = bord.aktuell_giv
  const [stolar, head, givLista, stallningInnan] = await Promise.all([
    hamtaStolar(m, bord.id),
    hamtaSenasteSeq(m, bord.id),
    hamtaGivHandelser(m, bord.id, giv),
    stallningFore(m, bord.id, giv),
  ])
  const min = stolar.find((s) => s.user_id === userId)
  if (!min) return json(403, { ok: false, fel: 'Du sitter inte vid det här bordet' })
  if (basSeq !== head) return json(409, { ok: false, fel: 'Läget har ändrats', senasteSeq: head })

  const seed = bord.seed
  const deal = bordGiv(seed, giv)
  const lage = projiceraGiv(deal, givLista)
  const dragRaw = b.drag as Record<string, unknown> | null

  // --- Nästa giv (efter giv-klar-revealen) -------------------------------
  if (dragRaw?.typ === 'nasta-giv') {
    if (!lage.givKlar) return json(409, { ok: false, fel: 'Given är inte färdigspelad' })
    // Ägaren styr bordets tempo (ägarbeslut 2026-08-17): bara hen går vidare.
    if (bord.owner_id !== userId) {
      return json(403, { ok: false, fel: 'Bara bordets ägare startar nästa giv' })
    }
    // Ställningen EFTER given ligger inbakad i givens giv-klar-händelse.
    const klarRad = givLista.find((h) => h.typ === 'giv-klar')
    const stallning =
      (klarRad?.data as { stallning?: { ns: number; ew: number } } | undefined)?.stallning ??
      stallningInnan
    if (giv >= bord.givar) {
      // Sista given: bordet är färdigspelat. Stolarna släpps (aktiv=false) så
      // spelarna kan starta/sätta sig vid nya bord; raderna finns kvar för visning.
      await restPatch(m, `tables?id=eq.${bord.id}`, { status: 'klar' })
      await restPatch(m, `table_seats?table_id=eq.${bord.id}`, { aktiv: false })
      const skrivet = await laggTillHandelser(
        m,
        bord.id,
        [{ giv: 0, typ: 'bord-klar', data: { stallning } }],
        basSeq,
      )
      if (!skrivet) {
        return json(409, { ok: false, fel: 'Läget har ändrats', senasteSeq: await hamtaSenasteSeq(m, bord.id) })
      }
      return json(200, { ok: true, events: skrivet.rader, senasteSeq: skrivet.senasteSeq })
    }
    const nastaGiv = giv + 1
    const nastaDeal = bordGiv(seed, nastaGiv)
    const handelser: NyHandelse[] = [givStartHandelse(nastaDeal, nastaGiv)]
    handelser.push(
      ...drivFram(
        nastaDeal,
        nastaGiv,
        handelser.map((h) => ({ typ: h.typ, seat: h.seat ?? null, data: h.data ?? {} })),
        { manniskoStolar: manniskoStolar(stolar), playSeed: bordPlaySeed(seed, nastaGiv), stallning },
      ),
    )
    const skrivet = await laggTillHandelser(m, bord.id, handelser, basSeq)
    if (!skrivet) {
      return json(409, { ok: false, fel: 'Läget har ändrats', senasteSeq: await hamtaSenasteSeq(m, bord.id) })
    }
    await restPatch(m, `tables?id=eq.${bord.id}`, {
      aktuell_giv: nastaGiv,
      last_activity: new Date().toISOString(),
    })
    return json(200, { ok: true, events: skrivet.rader, senasteSeq: skrivet.senasteSeq })
  }

  // --- Bud / kort ---------------------------------------------------------
  if (dragRaw?.typ !== 'bud' && dragRaw?.typ !== 'kort') {
    return json(400, { ok: false, fel: 'Ogiltigt drag' })
  }
  const drag = dragRaw as unknown as BordDrag
  const utfall = utforDrag(deal, giv, lage, min.seat, drag)
  if (!utfall.ok) return json(400, { ok: false, fel: utfall.fel })

  const handelser: NyHandelse[] = [utfall.handelse]
  handelser.push(
    ...drivFram(
      deal,
      giv,
      [...givLista, { typ: utfall.handelse.typ, seat: utfall.handelse.seat ?? null, data: utfall.handelse.data ?? {} }],
      {
        manniskoStolar: manniskoStolar(stolar),
        playSeed: bordPlaySeed(seed, giv),
        stallning: stallningInnan,
      },
    ),
  )
  const skrivet = await laggTillHandelser(m, bord.id, handelser, basSeq)
  if (!skrivet) {
    return json(409, { ok: false, fel: 'Läget har ändrats', senasteSeq: await hamtaSenasteSeq(m, bord.id) })
  }
  await rorBordet(m, bord.id)
  return json(200, { ok: true, events: skrivet.rader, senasteSeq: skrivet.senasteSeq })
}

// ---------------------------------------------------------------------------

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const json: Svara = (status, data) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) {
    return json(500, { ok: false, fel: 'Saknar SUPABASE_URL / SERVICE_ROLE_KEY' })
  }
  const m: Miljo = { base, key }

  const url = new URL(req.url ?? '/', 'http://localhost')
  const h = url.searchParams.get('h') ?? ''
  const GET_HANDLINGAR = ['lista', 'lage']
  const POST_HANDLINGAR = ['skapa', 'ga-med', 'hjartslag', 'stol', 'start', 'drag']
  const kravdMetod = GET_HANDLINGAR.includes(h) ? 'GET' : POST_HANDLINGAR.includes(h) ? 'POST' : null
  if (!kravdMetod) return json(400, { ok: false, fel: 'Okänd handling' })
  if (req.method !== kravdMetod) return json(405, { ok: false, fel: `${kravdMetod} krävs` })

  try {
    // Inloggning krävs för allt (ägarbeslut: konto krävs alltid för spelformen).
    const authz = req.headers.authorization
    const token = authz && authz.startsWith('Bearer ') ? authz.slice(7) : null
    if (!token) return json(401, { ok: false, fel: 'Inte inloggad' })
    const userId = await verifieraToken(m, token)
    if (!userId) return json(401, { ok: false, fel: 'Ogiltig session' })

    // Anropskvoten (minimal härdning inbakad, ägarbeslut 2026-08-17).
    if (h in KVOTER && !(await kvotOk(base, key, userId, h as KvotHandling))) {
      return json(429, { ok: false, fel: 'För många anrop — vänta en liten stund' })
    }

    const body = kravdMetod === 'POST' ? await readJson(req) : null
    switch (h) {
      case 'skapa':
        return await hanteraSkapa(m, userId, body, json)
      case 'lista':
        return await hanteraLista(m, userId, json)
      case 'ga-med':
        return await hanteraGaMed(m, userId, body, json)
      case 'lage':
        return await hanteraLage(m, userId, url, json)
      case 'hjartslag':
        return await hanteraHjartslag(m, userId, body, json)
      case 'stol':
        return await hanteraStol(m, userId, body, json)
      case 'start':
        return await hanteraStart(m, userId, body, json)
      case 'drag':
        return await hanteraDrag(m, userId, body, json)
      default:
        return json(400, { ok: false, fel: 'Okänd handling' })
    }
  } catch (err) {
    return json(500, { ok: false, fel: String(err instanceof Error ? err.message : err) })
  }
}
