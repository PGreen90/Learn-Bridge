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
