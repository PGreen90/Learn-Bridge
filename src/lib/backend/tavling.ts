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
import type { TavlingsForm } from '../engine/matchpoints'
import { getCurrentSession } from './auth'

// Dagens IMP (ägarbeslut 2026-09-26, docs/imp-tavling-plan.md): två tävlingar
// per dag — MP% (som förr) och IMP (tolv egna givar, cross-IMP, summa). Alla
// hämtare tar `form`; utelämnad = MP, och MP-anropen ser ut exakt som förr.
export type { TavlingsForm }

/** Ett tal i tävlingens enhet, UTAN enheten: MP "62" / "62.5", IMP med tecken
 *  "+14.5" / "−3.0" (noll utan tecken). Enheten: `enhetText`. */
export function talText(tal: number, form: TavlingsForm | undefined, decimaler: number): string {
  if (form !== 'imp') return tal.toFixed(decimaler)
  const abs = Math.abs(tal).toFixed(decimaler)
  if (Number(abs) === 0) return abs
  return tal > 0 ? `+${abs}` : `−${abs}`
}

/** Enheten efter talet: "%" (MP) eller "IMP". */
export function enhetText(form: TavlingsForm | undefined): string {
  return form === 'imp' ? 'IMP' : '%'
}

/** Rubriken för en tävlingsform i gränssnittet (ägarbeslut 2026-09-26). */
export function formTitel(form: TavlingsForm | undefined): string {
  return form === 'imp' ? 'Dagens IMP' : 'Dagens MP%'
}

/** Talet på EN giv ur ett serversvar, oavsett form: `tal` (nya svar), annars
 *  `procent` (äldre MP-svar) eller `imp`. undefined = inget tal. */
export function givTal(g: { tal?: number; procent?: number; imp?: number }): number | undefined {
  return g.tal ?? g.procent ?? g.imp
}

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
  /** Tävlingsformen (Dagens IMP, 2026-09-26). Saknas = MP. */
  form?: TavlingsForm
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
  /** Spelförarens stick ur inskicket (2026-09-13) — sparas så ett inskick som
   *  aldrig kom fram kan skickas om exakt. `undefined` = äldre framsteg (då
   *  räknas sticken ur kontraktet, se `inskickUrFramsteg`). */
  declarerTricks?: number
  /** Motorstämpeln given spelades med — sparas så en OMSÄNDNING (kanske efter
   *  en app-uppdatering) bär spelögonblickets version, inte sändningens. */
  motor?: string
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

/** Query-strängen till tävlings-API:erna: `dag=YYYY-MM-DD` för en tidigare
 *  tävlingsdag (historiken, Påbyggnad 3; utelämnad → idag) och `form=imp` för
 *  IMP-tävlingen (utelämnad/mp → ingen parameter, så MP-anropen är som förr). */
function tavlingQuery(dag?: string, form?: TavlingsForm, extra: string[] = []): string {
  const delar = [...extra]
  if (dag) delar.push(`dag=${encodeURIComponent(dag)}`)
  if (form === 'imp') delar.push('form=imp')
  return delar.length ? `?${delar.join('&')}` : ''
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
  const form: TavlingsForm = d.form === 'imp' ? 'imp' : 'mp'

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
      // IMP-tävlingens givar får eget id-prefix så de aldrig blandas ihop med
      // MP-tävlingens samma dag (sparade kort, React-nycklar, felrapporter).
      id: form === 'imp' ? `tavling-imp-${nummer}-${board}` : `tavling-${nummer}-${board}`,
      hands: mappade,
      dealer: dealer as Seat,
      vulnerability: vulnerability as Vulnerability,
      board,
    }
    return { deal, playSeed }
  })

  return { nummer, dag, storlek, form, givar }
}

/** Hämta dagens tävling från servern. Nätverksfel och trasiga svar fångas och
 *  översätts till { status: 'fel' } så sidan kan visa en vänlig ruta. 404 =
 *  ingen tävling genererad för idag än (status 'ingen'). */
export async function fetchDagensTavling(dag?: string, form?: TavlingsForm): Promise<TavlingsResultat> {
  let res: Response
  try {
    res = await fetch(`/api/dagens-tavling${tavlingQuery(dag, form)}`, { headers: { Accept: 'application/json' } })
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
  /** Motorstämpeln (2026-09-20): commit-SHA för bygget given SPELADES med —
   *  nattgranskningen spelar om botkorten mot exakt den motorversionen.
   *  Utelämnad i utvecklingsbyggen. */
  motor?: string
  /** Tävlingsformen (Dagens IMP, 2026-09-26): 'imp' → IMP-tävlingens set och
   *  frönyckel på servern. Utelämnad = MP. */
  form?: TavlingsForm
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

/**
 * Bygg om inskicket ur en lokalt bokförd giv — för OMSÄNDNING när det första
 * inskicket aldrig kom fram (nätfel, tillfälligt serverfel; 2026-09-13: två
 * brickor tappades på ett dygn och syntes sedan som "403" i travellern).
 * null när auktionen/korten inte sparats (äldre framsteg — då finns inget att
 * skicka). Spelförarsticken: det sparade värdet, annars ur kontraktet
 * (6 + nivå + resultat); en utpassad giv (kontrakt null) har 0 kort och 0 stick.
 */
export function inskickUrFramsteg(r: GivResultat, form?: TavlingsForm): TavlingInskick | null {
  if (!r.history || !r.plays) return null
  const declarerTricks =
    r.declarerTricks ??
    (r.kontrakt === null ? 0 : r.kontrakt ? 6 + r.kontrakt.level + r.kontrakt.diff : null)
  if (declarerTricks === null) return null
  return {
    board: r.board,
    history: r.history,
    plays: r.plays,
    declarerTricks,
    ...(r.motor ? { motor: r.motor } : {}),
    ...(form ? { form } : {}),
  }
}

/** Ska den här lokalt bokförda given skickas (om)? Sant för ett inskick som
 *  misslyckades ('fel') eller aldrig fick något svar (odefinierat — sidan
 *  laddades om mitt i). Serverns egna utfall (godkand/avvisad/granskning/redan)
 *  är slutgiltiga. */
export function behöverSkickasOm(r: GivResultat): boolean {
  return (r.inskickStatus === undefined || r.inskickStatus === 'fel') && inskickUrFramsteg(r) !== null
}

// ===========================================================================
// Led 3 — topplistan
// ===========================================================================

export interface TopplistaRad {
  namn: string
  /** Tillsvidare-snittet (0–100): MP% på poängsatta givar + 40 % per återstående
   *  giv, delat på tävlingens storlek (Påbyggnad 3). */
  snitt: number
  /** Antal poängsatta givar. */
  antalGivar: number
  /** Antal spelade (inskickade) givar — visas som "7/12". Saknas i äldre svar. */
  spelade?: number
  /** Sant för den inloggades egen rad (steg 6 — highlightas). Kan saknas i
   *  äldre/anonyma svar. */
  jag?: boolean
}

/** Kallarens egen placering + snitt (bara med när man är inloggad och har
 *  skickat in minst en giv; annars null). */
export interface DinPlacering {
  placering: number
  snitt: number
  antalGivar: number
  /** Antal spelade (inskickade) givar. Saknas i äldre svar. */
  spelade?: number
}

/** Kallarens tal på EN spelad, poängsatt giv (till resultattabellen). MP-svar
 *  bär mp/max/procent, IMP-svar bär imp; `tal` finns i alla nya svar (läs det
 *  med `givTal`, som även förstår äldre svar med bara procent). */
export interface DinGiv {
  board: number
  form?: TavlingsForm
  tal?: number
  mp?: number
  max?: number
  procent?: number
  imp?: number
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
  /** Tävlingsformen talen räknats i (Dagens IMP, 2026-09-26). */
  form: TavlingsForm
  storlek: number
  /** Antal givar med minst `minPerGiv` spelare (de som ger poäng). */
  poängsattaGivar: number
  minPerGiv: number
  /** Tillsvidare-procenten per ospelad giv (40). Saknas i äldre svar. */
  provisoriskProcent?: number
  /** Formens tillsvidare-tal per ospelad giv: 40 (MP%) eller 0 (IMP). */
  provisoriskt?: number
  /** Tävlingsdagen (YYYY-MM-DD) och om det är dagens tävling. Saknas i äldre svar. */
  dag?: string
  idag?: boolean
  /** Sant när nattjobbet skrivit dagens slutliga ställning (historiken). */
  slutlig?: boolean
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
export async function fetchTopplista(dag?: string, form?: TavlingsForm): Promise<TopplistaResultat> {
  const session = await getCurrentSession()
  const token = session?.access_token
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`/api/topplista${tavlingQuery(dag, form)}`, { headers })
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
      form: raw.form === 'imp' ? 'imp' : 'mp',
      storlek: raw.storlek ?? 0,
      poängsattaGivar: raw.poängsattaGivar ?? 0,
      minPerGiv: raw.minPerGiv ?? 2,
      provisoriskProcent: raw.provisoriskProcent ?? 40,
      provisoriskt: raw.provisoriskt,
      dag: raw.dag,
      idag: raw.idag,
      slutlig: raw.slutlig ?? false,
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

/** En spelares rad i travellern på en giv: kontrakt + N/S-poäng + talet
 *  (MP% eller cross-IMP efter form — läs det med `givTal`).
 *  Ingen bot-flagga (trebottarna 2026-09-01): bottarna har människonamn och
 *  pekas aldrig ut — servern skickar den inte ens. */
export interface BrickaRad {
  namn: string
  /** Din egen rad (highlightas). */
  jag: boolean
  /** Kontraktet spelaren nådde, eller null (utpassad giv). */
  kontrakt: GivKontrakt | null
  nsScore: number
  form?: TavlingsForm
  tal?: number
  /** MP-svar: procenten på brickan. Saknas i IMP-svar. */
  procent?: number
  /** IMP-svar: cross-IMP på brickan. Saknas i MP-svar. */
  imp?: number
  /** Påbyggnad 3 (2026-09-13): spelarens auktion (kompakt: säte + bud + regel,
   *  utan förklaringstext — klienten tolkar om systemiskt), spelade kort och
   *  spelförarstick → genomgången "Så spelade X given". Saknas i äldre svar. */
  history?: ResolvedCall[]
  plays?: Card[]
  declarerTricks?: number | null
}

export interface GivResultatSvar {
  board: number
  form?: TavlingsForm
  /** Alla spelares resultat på brickan, bäst MP% först. */
  resultat: BrickaRad[]
}

export type GivResultatUtfall =
  | { status: 'ok'; data: GivResultatSvar }
  | { status: 'fel'; fel: string }

/** Hämta hela fältets resultat på en giv (travellern). Kräver inloggning OCH att
 *  man själv spelat brickan (servern nekar annars — ingen tjuvkik). */
export async function fetchGivResultat(board: number, dag?: string, form?: TavlingsForm): Promise<GivResultatUtfall> {
  const session = await getCurrentSession()
  const token = session?.access_token
  if (!token) return { status: 'fel', fel: 'Inte inloggad.' }
  let res: Response
  try {
    res = await fetch(`/api/giv-resultat${tavlingQuery(dag, form, [`board=${board}`])}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch {
    return { status: 'fel', fel: 'Kunde inte nå servern.' }
  }
  // 403 = servern har ingen godkänd giv från dig på brickan: inskicket kom
  // aldrig fram (skickas om automatiskt från översikten) eller avvisades.
  if (res.status === 403) {
    return {
      status: 'fel',
      fel: 'Given är inte registrerad på servern än. Gå tillbaka till översikten och tryck på uppdatera-knappen, så skickas den in igen.',
    }
  }
  if (!res.ok) return { status: 'fel', fel: `Servern svarade ${res.status}.` }
  try {
    return { status: 'ok', data: (await res.json()) as GivResultatSvar }
  } catch (err) {
    return { status: 'fel', fel: String(err instanceof Error ? err.message : err) }
  }
}


// ===========================================================================
// Påbyggnad 3 — tävlingshistoriken + medaljtabellen (2026-09-13)
// ===========================================================================

/** En avslutad tävlingsdag i historiklistan. */
export interface HistorikDag {
  dag: string
  nummer: number
  storlek: number
  /** Antal spelare i dagens ställning; null om dagen inte kunnat räknas. */
  antalSpelare: number | null
  /** Sant när nattjobbet frusit ställningen (annars räknad i farten). */
  slutlig: boolean
  /** Din placering den dagen, eller null om du inte spelade. */
  du: { placering: number; snitt: number; spelade: number } | null
}

/** En rad i medaljtabellen (topp 5, bottar uteslutna, ingen bot-flagga). */
export interface Medaljrad {
  namn: string
  guld: number
  silver: number
  brons: number
  jag: boolean
}

export interface TavlingHistorik {
  /** Tävlingsformen (dagar OCH medaljer per form, ägarbeslut 2026-09-26). */
  form: TavlingsForm
  /** Avslutade dagar, nyast först. */
  dagar: HistorikDag[]
  medaljer: Medaljrad[]
}

export type HistorikResultat =
  | { status: 'ok'; data: TavlingHistorik }
  | { status: 'fel'; fel: string }

/** Hämta tävlingshistoriken (tidigare dagar med din placering) + medaljtabellen.
 *  Kräver inloggning. Fel översätts till { status: 'fel' }. */
export async function fetchTavlingHistorik(form?: TavlingsForm): Promise<HistorikResultat> {
  const session = await getCurrentSession()
  const token = session?.access_token
  if (!token) return { status: 'fel', fel: 'Inte inloggad.' }
  let res: Response
  try {
    res = await fetch(`/api/tavling-historik${tavlingQuery(undefined, form)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch {
    return { status: 'fel', fel: 'Kunde inte nå servern.' }
  }
  if (!res.ok) return { status: 'fel', fel: `Servern svarade ${res.status}.` }
  try {
    const raw = (await res.json()) as Partial<TavlingHistorik>
    return {
      status: 'ok',
      data: { form: raw.form === 'imp' ? 'imp' : 'mp', dagar: raw.dagar ?? [], medaljer: raw.medaljer ?? [] },
    }
  } catch (err) {
    return { status: 'fel', fel: String(err instanceof Error ? err.message : err) }
  }
}
