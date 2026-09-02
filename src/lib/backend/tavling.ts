// Beslut B etapp 2 (klientfasen) — hämtaren för dagens tävling.
//
// Serversidan (api-src/dagens-tavling.ts) genererar och lagrar dagens 12 givar
// och lämnar ut dem på /api/dagens-tavling. Den HÄR modulen är klientens enda
// väg till dem: en tunn fetch runt en REN översättningsfunktion som mappar
// serverns svar till appens `Deal`-form. Ligger i backend-lagret enligt planen
// (src/lib/backend/) så sidorna aldrig känner till nätverket direkt.
//
// Nivå 1-fuskgränsen (docs/beslut-b-plan.md): svaret innehåller alla fyra
// händerna, precis som gratisgiven — bottarna körs i klienten. Integriteten
// vilar på serverns omspelningsvalidering av inskicket, inte på att gömma given.

import type { Card, Deal, Seat, Vulnerability } from '../../types/bridge'
import type { Strain } from '../engine/play'
import type { ResolvedCall } from '../bidding'
import { getCurrentSession } from './auth'

/** Kompakt kontrakt + resultat för resultattabellen (UI-polish steg 4). Räcker
 *  för att rita "4♠Ö −1" utan att spara hela given. */
export interface GivKontrakt {
  level: number
  strain: Strain
  doubled?: 'X' | 'XX'
  declarer: Seat
  /** Spelförarens över-/understick relativt kontraktet: 0 = jämnt, +1, −2 … */
  diff: number
}

/** En tävlingsgiv i klienten: given att spela + play-fröet som gör bottarna
 *  deterministiska (trås in i usePlayTable så servern kan spela om och validera). */
export interface TavlingsGiv {
  deal: Deal
  playSeed: number
}

/** Hela dagens tävling som klienten behöver den. */
export interface DagensTavling {
  nummer: number
  dag: string
  storlek: number
  givar: TavlingsGiv[]
}

/** Resultatet av EN spelad tävlingsgiv (ur spelarens N/S-perspektiv). Led 1
 *  sparar detta lokalt för progress/paus; Led 2 skickar in det till servern
 *  för validering + poäng. */
export interface GivResultat {
  board: number
  myTricks: number
  win: boolean
  headline: string
  scoreLabel: string | null
  /** Serverns valideringsutfall när given skickats in (Led 2). Odefinierat =
   *  inskicket pågår/inte gjort. */
  inskickStatus?: InskickStatus
  /** Kompakt kontrakt + resultat för resultattabellen (steg 4). `null` = given
   *  passades ut; `undefined` = äldre sparat framsteg utan fältet. */
  kontrakt?: GivKontrakt | null
  /** Auktionen + de spelade korten (steg 5) — sparas lokalt så rondgenomgången
   *  kan återskapas ur en klar giv. `undefined` = äldre framsteg utan dem (då
   *  är genomgången inte tillgänglig). */
  history?: ResolvedCall[]
  plays?: Card[]
}

/** Framstegen i dagens tävling — vilka givar som är klara, per tävlingsnummer.
 *  Numret bär i nyckeln så en ny dag börjar rent (gårdagens framsteg återupptas
 *  aldrig). LOKALT i Led 1 (per enhet); Led 2 flyttar det till kontot på servern. */
export interface TavlingFramsteg {
  nummer: number
  klara: GivResultat[]
}

/** Utfallet av en hämtning, i en form UI:t kan grenka på utan try/catch:
 *  'ok' (tävlingen finns), 'ingen' (ingen genererad för idag än, 404), eller
 *  'fel' (nätverk/server) med ett meddelande för felrutan. */
export type TavlingsResultat =
  | { status: 'ok'; tavling: DagensTavling }
  | { status: 'ingen' }
  | { status: 'fel'; fel: string }

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const DEALERS = new Set<string>(SEATS)
const VULS = new Set<string>(['none', 'ns', 'ew', 'all'])

function isCard(x: unknown): x is Card {
  const c = x as Record<string, unknown> | null
  return typeof c === 'object' && c !== null && typeof c.suit === 'string' && typeof c.rank === 'string'
}

/** Ren översättning: serverns JSON → DagensTavling. Kastar vid trasig form så
 *  kallaren kan visa ett tydligt fel i stället för att krascha halvvägs in i
 *  spelet. Varje giv får ett stabilt, unikt `id` (`tavling-<nr>-<bricka>`) —
 *  servern lagrar sitt eget rad-id men skickar det inte, och appens Deal kräver
 *  en id-sträng (React-nyckel + matchning av sparade kort). */
export function tavlingFromResponse(data: unknown): DagensTavling {
  const d = data as Record<string, unknown> | null
  if (typeof d !== 'object' || d === null || d.ok !== true) {
    throw new Error('Ogiltigt svar från tävlings-API:t')
  }
  const nummer = d.nummer
  const dag = d['tävlingsdag']
  const storlek = d.storlek
  const rå = d.givar
  if (typeof nummer !== 'number' || typeof dag !== 'string' || typeof storlek !== 'number') {
    throw new Error('Tävlingssvaret saknar nummer/dag/storlek')
  }
  if (!Array.isArray(rå)) throw new Error('Tävlingssvaret saknar givar')

  const givar: TavlingsGiv[] = rå.map((g) => {
    const row = g as Record<string, unknown>
    const board = row.board
    const dealer = row.dealer
    const vulnerability = row.vulnerability
    const hands = row.hands as Record<string, unknown> | null
    const playSeed = row.playSeed
    if (typeof board !== 'number' || typeof playSeed !== 'number') {
      throw new Error('En giv saknar board/playSeed')
    }
    if (typeof dealer !== 'string' || !DEALERS.has(dealer)) {
      throw new Error(`Ogiltig giv (bricka ${board}): dealer`)
    }
    if (typeof vulnerability !== 'string' || !VULS.has(vulnerability)) {
      throw new Error(`Ogiltig giv (bricka ${board}): zon`)
    }
    if (typeof hands !== 'object' || hands === null) {
      throw new Error(`Ogiltig giv (bricka ${board}): händer`)
    }
    const mappade = {} as Record<Seat, Card[]>
    for (const s of SEATS) {
      const h = hands[s]
      if (!Array.isArray(h) || h.length !== 13 || !h.every(isCard)) {
        throw new Error(`Ogiltig giv (bricka ${board}): hand ${s}`)
      }
      mappade[s] = h as Card[]
    }
    const deal: Deal = {
      id: `tavling-${nummer}-${board}`,
      hands: mappade,
      dealer: dealer as Seat,
      vulnerability: vulnerability as Vulnerability,
      board,
    }
    return { deal, playSeed }
  })

  return { nummer, dag, storlek, givar }
}

/** Hämta dagens tävling från servern. Nätverksfel och trasiga svar fångas och
 *  översätts till { status: 'fel' } så sidan kan visa en vänlig ruta. 404 =
 *  ingen tävling genererad för idag än (status 'ingen'). */
export async function fetchDagensTavling(): Promise<TavlingsResultat> {
  let res: Response
  try {
    res = await fetch('/api/dagens-tavling', { headers: { Accept: 'application/json' } })
  } catch {
    return { status: 'fel', fel: 'Kunde inte nå servern. Kontrollera nätet och försök igen.' }
  }
  if (res.status === 404) return { status: 'ingen' }
  if (!res.ok) return { status: 'fel', fel: `Servern svarade ${res.status}.` }
  try {
    return { status: 'ok', tavling: tavlingFromResponse(await res.json()) }
  } catch (err) {
    return { status: 'fel', fel: String(err instanceof Error ? err.message : err) }
  }
}

// ===========================================================================
// Led 2 — inskick av en spelad tävlingsgiv
// ===========================================================================

/** Det klienten skickar in för EN spelad giv. Servern regenererar given själv
 *  ur fröet, så bara brickan + det spelaren gjorde skickas (inte händerna). */
export interface TavlingInskick {
  board: number
  history: ResolvedCall[]
  plays: Card[]
  /** Spelförarens stick (contractResult) — verifieras mot serverns omspelning. */
  declarerTricks: number
}

/** Serverns utfall: 'godkand'/'avvisad'/'granskning' (validering), 'redan'
 *  (ominskick), 'fel' (nätverk/ej inloggad). */
export type InskickStatus = 'godkand' | 'avvisad' | 'granskning' | 'redan' | 'fel'

export interface InskickSvar {
  status: InskickStatus
  nsScore: number | null
  skäl?: string
}

/** Skicka in en spelad tävlingsgiv för validering + poäng. Kräver inloggning
 *  (access-token ur sessionen). Alla fel översätts till ett InskickSvar så
 *  kallaren aldrig behöver try/catch. */
export async function submitTavlingGiv(inskick: TavlingInskick): Promise<InskickSvar> {
  const session = await getCurrentSession()
  const token = session?.access_token
  if (!token) return { status: 'fel', nsScore: null, skäl: 'Inte inloggad' }
  let res: Response
  try {
    res = await fetch('/api/skicka-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(inskick),
    })
  } catch {
    return { status: 'fel', nsScore: null, skäl: 'Kunde inte nå servern.' }
  }
  if (res.status === 409) return { status: 'redan', nsScore: null }
  if (!res.ok) return { status: 'fel', nsScore: null, skäl: `Servern svarade ${res.status}.` }
  const d = (await res.json().catch(() => null)) as
    | { status?: string; nsScore?: number | null; skäl?: string }
    | null
  const s = d?.status
  const status: InskickStatus =
    s === 'godkand' || s === 'avvisad' || s === 'granskning' ? s : 'fel'
  return { status, nsScore: d?.nsScore ?? null, skäl: d?.skäl }
}

// ===========================================================================
// Led 3 — topplistan
// ===========================================================================

export interface TopplistaRad {
  namn: string
  /** Snittprocent över de poängsatta givarna (0–100). */
  snitt: number
  antalGivar: number
  /** Sant för den inloggades egen rad (steg 6 — highlightas). Kan saknas i
   *  äldre/anonyma svar. */
  jag?: boolean
}

/** Kallarens egen placering + snitt (bara med när man är inloggad och har minst
 *  en poängsatt giv; annars null). */
export interface DinPlacering {
  placering: number
  snitt: number
  antalGivar: number
}

/** Kallarens matchpoäng på EN spelad, poängsatt giv (till resultattabellen). */
export interface DinGiv {
  board: number
  mp: number
  max: number
  procent: number
  /** Kontrakt + resultat ur serverns data (auktoritativt — fylls även för givar
   *  spelade före kontraktssparningen / på annan enhet). `null` = utpassad; kan
   *  saknas i äldre svar. */
  kontrakt?: GivKontrakt | null
}

/** EN av dina inskickade (godkända) givar denna tävling — bricka + kontrakt —
 *  OAVSETT om given poängsatts än (dvs. även när du är ensam spelare på den).
 *  Servern återskapar kontraktet ur den lagrade auktionen, så det här bär över
 *  alla enheter. `kontrakt` saknas = kunde inte återskapas (visas "—"); `null` =
 *  utpassad giv. */
export interface DinInskick {
  board: number
  kontrakt?: GivKontrakt | null
}

export interface Topplista {
  nummer: number
  storlek: number
  /** Antal givar med minst `minPerGiv` spelare (de som ger poäng). */
  poängsattaGivar: number
  minPerGiv: number
  topplista: TopplistaRad[]
  /** Din placering + snitt när inloggad, annars null (UI-polish steg 2). */
  du: DinPlacering | null
  /** Din MP% per poängsatt giv (brickordning), annars tom (UI-polish steg 2). */
  dinaGivar: DinGiv[]
  /** Alla dina inskickade givar (bricka + kontrakt), även opoängsatta och oavsett
   *  enhet. Låter översikten känna igen givar du spelat på en annan enhet så den
   *  inte börjar om på giv 1. Tom i äldre/anonyma svar (cross-device-fixen). */
  dinaInskick: DinInskick[]
}

export type TopplistaResultat =
  | { status: 'ok'; data: Topplista }
  | { status: 'ingen' }
  | { status: 'fel'; fel: string }

/** Hämta dagens topplista (provisorisk under dagen). Ingen inloggning krävs för
 *  själva listan (bara visningsnamn + procent lämnas ut), men skickar vi med
 *  inloggnings-token svarar servern DESSUTOM med kallarens egna siffror
 *  (`du` + `dinaGivar`, UI-polish steg 2). Är man utloggad förblir de null/tom. */
export async function fetchTopplista(): Promise<TopplistaResultat> {
  const session = await getCurrentSession()
  const token = session?.access_token
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch('/api/topplista', { headers })
  } catch {
    return { status: 'fel', fel: 'Kunde inte nå servern.' }
  }
  if (res.status === 404) return { status: 'ingen' }
  if (!res.ok) return { status: 'fel', fel: `Servern svarade ${res.status}.` }
  try {
    const raw = (await res.json()) as Partial<Topplista>
    // Bakåtkompatibelt: äldre svar (eller anonyma) saknar de personliga fälten.
    const data: Topplista = {
      nummer: raw.nummer ?? 0,
      storlek: raw.storlek ?? 0,
      poängsattaGivar: raw.poängsattaGivar ?? 0,
      minPerGiv: raw.minPerGiv ?? 2,
      topplista: raw.topplista ?? [],
      du: raw.du ?? null,
      dinaGivar: raw.dinaGivar ?? [],
      dinaInskick: raw.dinaInskick ?? [],
    }
    return { status: 'ok', data }
  } catch (err) {
    return { status: 'fel', fel: String(err instanceof Error ? err.message : err) }
  }
}

/** Slå ihop LOKALT framsteg (den här enheten — bär hela given, så
 *  rondgenomgången kan visas) med serverns lista över dina inskickade givar
 *  (`dinaInskick` — alla enheter, men bara bricka + kontrakt). Resultatet driver
 *  översikten så en NY enhet känner igen givar du redan spelat (annars börjar den
 *  om på giv 1) och kontraktet visas även för givar utan lokalt sparat sådant.
 *
 *  Regler: lokala rader vinner (de bär auktion + kort för genomgången); ett
 *  saknat lokalt kontrakt fylls på från servern (fixar äldre "—"-rader); en
 *  server-giv som saknas lokalt läggs till som en "stub" (godkänd, utan
 *  rondgenomgång — den spelades på en annan enhet). Sorteras på bricka. */
export function slåIhopFramsteg(lokala: GivResultat[], server: DinInskick[]): GivResultat[] {
  const perBricka = new Map<number, GivResultat>()
  for (const r of lokala) perBricka.set(r.board, { ...r })
  for (const s of server) {
    const fanns = perBricka.get(s.board)
    if (fanns) {
      // Fyll bara på ett kontrakt som saknas lokalt — skriv aldrig över ett eget.
      if (fanns.kontrakt === undefined && 'kontrakt' in s) fanns.kontrakt = s.kontrakt
      continue
    }
    perBricka.set(s.board, {
      board: s.board,
      myTricks: 0,
      win: false,
      headline: 'Inskickad',
      scoreLabel: null,
      inskickStatus: 'godkand',
      // Bara kontraktet bär över enheter — history/plays saknas medvetet, så
      // rondgenomgången faller tillbaka på "inte tillgänglig".
      ...('kontrakt' in s ? { kontrakt: s.kontrakt } : {}),
    })
  }
  return [...perBricka.values()].sort((a, b) => a.board - b.board)
}

// ===========================================================================
// Led 4 — travellern (hela fältets resultat på EN giv, steg 6)
// ===========================================================================

/** En spelares rad i travellern på en giv: kontrakt + N/S-poäng + MP%.
 *  Ingen bot-flagga (trebottarna 2026-09-01): bottarna har människonamn och
 *  pekas aldrig ut — servern skickar den inte ens. */
export interface BrickaRad {
  namn: string
  /** Din egen rad (highlightas). */
  jag: boolean
  /** Kontraktet spelaren nådde, eller null (utpassad giv). */
  kontrakt: GivKontrakt | null
  nsScore: number
  procent: number
}

export interface GivResultatSvar {
  board: number
  /** Alla spelares resultat på brickan, bäst MP% först. */
  resultat: BrickaRad[]
}

export type GivResultatUtfall =
  | { status: 'ok'; data: GivResultatSvar }
  | { status: 'fel'; fel: string }

/** Hämta hela fältets resultat på en giv (travellern). Kräver inloggning OCH att
 *  man själv spelat brickan (servern nekar annars — ingen tjuvkik). */
export async function fetchGivResultat(board: number): Promise<GivResultatUtfall> {
  const session = await getCurrentSession()
  const token = session?.access_token
  if (!token) return { status: 'fel', fel: 'Inte inloggad.' }
  let res: Response
  try {
    res = await fetch(`/api/giv-resultat?board=${board}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch {
    return { status: 'fel', fel: 'Kunde inte nå servern.' }
  }
  if (!res.ok) return { status: 'fel', fel: `Servern svarade ${res.status}.` }
  try {
    return { status: 'ok', data: (await res.json()) as GivResultatSvar }
  } catch (err) {
    return { status: 'fel', fel: String(err instanceof Error ? err.message : err) }
  }
}
