// VECKANS GULD-TÄVLING — lägg upp veckans tolv utvalda givar (2026-11-11).
// Körs ALDRIG i vanliga `npm test`/deploygrinden (skipIf), bara av veckojobbet
// i Actions (guld-tavling.yml) eller för hand:
//
//   Bash:  GULD_TAVLING=1 GULD_VECKA=2026-11-09 npx vitest run src/lib/givurval/guldtavling.probe.test.ts
//
// Rattar: GULD_VECKA (veckans måndag, YYYY-MM-DD — krävs) · GULD_FRO (heltal;
// utelämnat = härleds ur DAILY_SEED_SECRET + veckan, så ingen kan räkna fram
// givarna i förväg) · GULD_N (antal kandidater, standard 2400 = 200 per bricka).
//
// Vad den gör: poängsätter N slumpkandidater (bottarnas auktion + double-dummy,
// se masterskapsgiv.ts), väljer tolv, och skriver set + givar till databasen
// (daily_sets med form 'guld' och comp_date = måndagen, daily_deals).
//
// IDEMPOTENT och FÖRSIKTIG: finns veckans tolv givar redan görs INGENTING — en
// upplagd tävling skrivs aldrig om (det kan finnas inskick på den).
//
// TYSTNAD: Actions-loggarna i ett publikt repo kan läsas av alla. Därför skrivs
// ALDRIG händer, kontrakt eller givtyper ut — bara antal och snittpoäng. Den
// fulla rapporten hamnar i revisor-output/ (gitignorad) och laddas inte upp.

import { expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Seat } from '../../types/bridge'
import { restGet, restPost } from '../../../api-src/_lib/supabase-rest'
import { simulateAuction } from '../engine/contract-target'
import { guldNummer, veckansMandag } from '../engine/daily'
import type { Strain } from '../engine/play'
import { computeOracle, getDds } from '../engine/revisor-dds'
import { formatHand } from '../felrapport'
import {
  kandidatGiv,
  poangsattGiv,
  STANDARDREGEL,
  summakoll,
  valjTavling,
  type DdTabell,
  type Kandidat,
} from './masterskapsgiv'

const PA = process.env.GULD_TAVLING === '1'
const VECKA = process.env.GULD_VECKA ?? ''
const N = Number(process.env.GULD_N ?? 2400)

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const STRAINS: Strain[] = ['spades', 'hearts', 'diamonds', 'clubs', 'NT']

function hemlighet(namn: string): string | null {
  if (process.env[namn]) return process.env[namn] as string
  try {
    const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^${namn}=(.+)$`, 'm'))
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

it.skipIf(!PA)('guld-tävlingen: välj och lägg upp veckans tolv givar', { timeout: 0 }, async () => {
  expect(/^\d{4}-\d{2}-\d{2}$/.test(VECKA), `GULD_VECKA måste vara YYYY-MM-DD (fick "${VECKA}")`).toBe(true)
  expect(veckansMandag(VECKA), 'GULD_VECKA måste vara en måndag').toBe(VECKA)
  const base = hemlighet('SUPABASE_URL')
  const key = hemlighet('SUPABASE_SERVICE_ROLE_KEY')
  expect(base && key, 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY saknas').toBeTruthy()

  // 1) Finns veckan redan? Då rör vi den inte.
  const sets = (await restGet(base!, key!, `daily_sets?comp_date=eq.${VECKA}&form=eq.guld&select=id`, 5, {}, 1000)) as Array<{ id: string }>
  if (sets.length) {
    const finns = (await restGet(base!, key!, `daily_deals?set_id=eq.${sets[0].id}&select=board`, 5, {}, 1000)) as unknown[]
    if (finns.length >= STANDARDREGEL.brickor) {
      console.log(`Guld-tävlingen ${VECKA} finns redan (${finns.length} givar) — inget ändrat.`)
      return
    }
  }

  // 2) Fröet: angivet, eller härlett ur hemligheten + veckan (oförberäkneligt).
  let fro: number
  if (process.env.GULD_FRO) {
    fro = Number(process.env.GULD_FRO)
    expect(Number.isInteger(fro) && fro >= 0, 'GULD_FRO måste vara ett heltal ≥ 0').toBe(true)
  } else {
    const secret = hemlighet('DAILY_SEED_SECRET')
    expect(secret, 'DAILY_SEED_SECRET saknas (behövs när GULD_FRO inte anges)').toBeTruthy()
    fro = createHmac('sha256', secret!).update(`guld-urval:${VECKA}`).digest().readUInt32BE(0)
  }

  // 3) Poängsätt kandidaterna och välj tolv.
  expect(N).toBeGreaterThanOrEqual(STANDARDREGEL.brickor)
  const dds = await getDds()
  const kandidater: Kandidat[] = []
  for (let i = 0; i < N; i++) {
    const deal = kandidatGiv(fro, i)
    expect(summakoll(deal).ok, `kandidat ${i}: summakoll (13 kort/hand, 40 hp)`).toBe(true)
    const oracle = computeOracle(dds, deal)
    const dd = Object.fromEntries(
      SEATS.map((s) => [s, Object.fromEntries(STRAINS.map((st) => [st, oracle.solve(s, st) ?? 0]))]),
    ) as DdTabell
    kandidater.push({ index: i, deal, poang: poangsattGiv({ deal, dd, parNS: oracle.parNS, auktion: simulateAuction(deal) }) })
  }
  const valda = valjTavling(kandidater)
  expect(valda.length, 'urvalet ska ge exakt en giv per bricka').toBe(STANDARDREGEL.brickor)
  expect(valda.map((v) => v.deal.board)).toEqual(Array.from({ length: STANDARDREGEL.brickor }, (_, i) => i + 1))
  for (const v of valda) expect(summakoll(v.deal).ok, `bricka ${v.deal.board}: summakoll`).toBe(true)

  // 4) Skriv set + givar. Upsert på (comp_date, form); givarna skrivs bara om
  //    brickan saknas (ignore-duplicates) — en befintlig giv byts aldrig ut.
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
    valda.map((v) => ({
      set_id: id,
      board: v.deal.board,
      dealer: v.deal.dealer,
      vulnerability: v.deal.vulnerability,
      hands: v.deal.hands,
    })),
    5,
    { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    1000,
  )
  if (!givSvar.ok) throw new Error(`daily_deals: ${givSvar.status} ${await givSvar.text()}`)

  // 5) Rapport. Loggen: bara antal + snitt. Filen (lokalt): hela urvalet.
  const snitt = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const snittValda = snitt(valda.map((v) => v.poang.total))
  const snittAlla = snitt(kandidater.map((k) => k.poang.total))
  console.log(
    `Guld-tävlingen ${VECKA} (nr ${guldNummer(VECKA)}) upplagd: ${valda.length} givar ur ${N} kandidater · ` +
      `snittpoäng valda ${snittValda.toFixed(1)} mot alla ${snittAlla.toFixed(1)}.`,
  )
  mkdirSync(join(process.cwd(), 'revisor-output'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'revisor-output', `guldtavling-${VECKA}.txt`),
    valda
      .map(
        (v) =>
          `Bricka ${v.deal.board} · ${v.poang.typEtikett} · ${v.poang.total.toFixed(1)} p\n` +
          SEATS.map((s) => `  ${s}: ${formatHand(v.deal.hands[s])}`).join('\n'),
      )
      .join('\n\n') + '\n',
  )
})
