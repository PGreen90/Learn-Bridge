// HANDPLOCKAD STJÄRNVECKA (2026-11-13) — lägg upp tolv UTVALDA givar, med
// berättelse, som en veckas stjärntävling i stället för slumpurvalet.
// Körs ALDRIG i vanliga `npm test`/deploygrinden (skipIf), bara för hand:
//
//   Bash (torrkörning — kontrollerar filen, skriver inget):
//     STJARNVECKA=revisor-output/stjarnvecka-2026-11-16-utkast.json GULD_VECKA=2026-11-16 npx vitest run src/lib/givurval/stjarnvecka-upplagg.probe.test.ts
//   Skarpt (skriver till databasen): lägg till STJARNVECKA_SKARPT=1 först på raden.
//
// Indata: JSON-lista med tolv poster { board, dealer, vulnerability, N, E, S, W,
// berattelse } (händer som "S:AKQ H:- D:T98 C:..."). Filen ligger i
// revisor-output/ (gitignorad): givar och berättelser är tävlingshemligheter
// och hör inte hemma i ett publikt repo. Därför skrivs heller ALDRIG händer
// eller texter ut i loggen — bara antal.
//
// KRÄVER migration 0016 (kolumnen daily_deals.berattelse). Är den inte körd
// svarar databasen 400 och inget skrivs.
//
// FÖRSIKTIG som veckojobbet: finns veckan redan med tolv givar görs INGENTING.
// Och omvänt: när den här veckan väl ligger uppe rör veckojobbet
// (guld-tavling.yml) den inte — det hoppar över urvalet och låter bara
// datorspelarna spela givarna.
//
// Giv och zon följer KÄLLAN, inte bricknumrets standardschema. Det går bra:
// daily_deals lagrar dem per giv och både klienten och valideringen läser dem
// därifrån.

import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Deal, Seat, Vulnerability } from '../../types/bridge'
import { restGet, restPost } from '../../../api-src/_lib/supabase-rest'
import { parseHand } from '../bidding'
import { guldNummer, veckansMandag } from '../engine/daily'
import { STANDARDREGEL, summakoll } from './masterskapsgiv'

const FIL = process.env.STJARNVECKA ?? ''
const VECKA = process.env.GULD_VECKA ?? ''
const SKARPT = process.env.STJARNVECKA_SKARPT === '1'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const ZONER: Vulnerability[] = ['none', 'ns', 'ew', 'all']
/** Berättelsen ska vara en kort ruta, inte en artikel. */
const MAX_TECKEN = 400

interface Post {
  board: number
  dealer: Seat
  vulnerability: Vulnerability
  N: string
  E: string
  S: string
  W: string
  berattelse?: string
}

function hemlighet(namn: string): string | null {
  if (process.env[namn]) return process.env[namn] as string
  try {
    const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^${namn}=(.+)$`, 'm'))
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

it.skipIf(!FIL)('handplockad stjärnvecka: kontrollera och lägg upp tolv givar', { timeout: 0 }, async () => {
  expect(/^\d{4}-\d{2}-\d{2}$/.test(VECKA), `GULD_VECKA måste vara YYYY-MM-DD (fick "${VECKA}")`).toBe(true)
  expect(veckansMandag(VECKA), 'GULD_VECKA måste vara en måndag').toBe(VECKA)

  // 1) Kontrollera filen — innan något rör databasen.
  const poster = JSON.parse(readFileSync(FIL, 'utf8')) as Post[]
  expect(poster.map((p) => p.board), 'exakt en giv per bricka 1–12, i ordning').toEqual(
    Array.from({ length: STANDARDREGEL.brickor }, (_, i) => i + 1),
  )
  const rader = poster.map((p) => {
    expect(SEATS.includes(p.dealer), `bricka ${p.board}: giv`).toBe(true)
    expect(ZONER.includes(p.vulnerability), `bricka ${p.board}: zon`).toBe(true)
    const deal: Deal = {
      id: `guld-${p.board}`,
      board: p.board,
      dealer: p.dealer,
      vulnerability: p.vulnerability,
      hands: { N: parseHand(p.N), E: parseHand(p.E), S: parseHand(p.S), W: parseHand(p.W) },
    }
    expect(summakoll(deal).ok, `bricka ${p.board}: summakoll (13 kort/hand, 52 olika, 40 hp)`).toBe(true)
    const berattelse = p.berattelse?.trim() || null
    if (berattelse) expect(berattelse.length, `bricka ${p.board}: berättelsen är för lång`).toBeLessThanOrEqual(MAX_TECKEN)
    return { board: deal.board, dealer: deal.dealer, vulnerability: deal.vulnerability, hands: deal.hands, berattelse }
  })
  const medText = rader.filter((r) => r.berattelse).length

  if (!SKARPT) {
    console.log(`TORRKÖRNING ${VECKA}: ${rader.length} givar godkända, ${medText} med berättelse. Inget skrivet (STJARNVECKA_SKARPT=1 skriver).`)
    return
  }

  const base = hemlighet('SUPABASE_URL')
  const key = hemlighet('SUPABASE_SERVICE_ROLE_KEY')
  expect(base && key, 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY saknas').toBeTruthy()

  // 2) Finns veckan redan? Då rör vi den inte (det kan finnas inskick på den).
  const sets = (await restGet(base!, key!, `daily_sets?comp_date=eq.${VECKA}&form=eq.guld&select=id`, 5, {}, 1000)) as Array<{ id: string }>
  if (sets.length) {
    const finns = (await restGet(base!, key!, `daily_deals?set_id=eq.${sets[0].id}&select=board`, 5, {}, 1000)) as unknown[]
    expect(finns.length, `stjärntävlingen ${VECKA} har redan ${finns.length} givar — inget ändrat`).toBe(0)
  }

  // 3) Skriv set + givar (samma upsert-mönster som veckojobbet).
  const setSvar = await restPost(
    base!,
    key!,
    `daily_sets?on_conflict=${encodeURIComponent('comp_date,form')}`,
    [{ comp_date: VECKA, form: 'guld', size: STANDARDREGEL.brickor, daily_number: guldNummer(VECKA) }],
    5,
    { Prefer: 'resolution=merge-duplicates,return=representation' },
    1000,
  )
  if (!setSvar.ok) throw new Error(`daily_sets: ${setSvar.status} ${await setSvar.text()}`)
  const id = ((await setSvar.json()) as Array<{ id: string }>)?.[0]?.id
  if (!id) throw new Error('daily_sets gav inget id tillbaka')

  const givSvar = await restPost(
    base!,
    key!,
    `daily_deals?on_conflict=${encodeURIComponent('set_id,board')}`,
    rader.map((r) => ({ set_id: id, ...r })),
    5,
    { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    1000,
  )
  if (!givSvar.ok) throw new Error(`daily_deals: ${givSvar.status} ${await givSvar.text()} (är migration 0016 körd?)`)

  console.log(`Stjärntävlingen ${VECKA} (nr ${guldNummer(VECKA)}) upplagd för hand: ${rader.length} givar, ${medText} med berättelse.`)
})
