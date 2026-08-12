// TÄVLINGSFÖRSCREENING (Speldiagnosen steg 6) — spelar en tävlingsdags 12 givar
// med bottarna INNAN de går live och flaggar det som är värt att granska.
// Körs ALDRIG i vanliga `npm test`/deploygrinden (skipIf), bara på begäran:
//
//   PowerShell:  $env:TAVLING_DIAG='2026-08-13'; npx vitest run src/lib/engine/tavlingsdiagnos.probe.test.ts
//   Bash:        TAVLING_DIAG=2026-08-13 npx vitest run src/lib/engine/tavlingsdiagnos.probe.test.ts
//
// Rattar: TAVLING_DAGAR (antal dagar i följd från startdatumet, standard 1).
//
// HEMLIGHETEN: tävlingsgivarna härleds ur DAILY_SEED_SECRET (HMAC, samma som
// servern). Den läses ur miljön eller ur .env.local (gitignorad via *.local) —
// den får ALDRIG hamna i repot, i .env (som är spårad!) eller i utdata.
//
// ÄRLIG BEGRÄNSNING: förscreeningen spelar ALLA fyra säten med boten — även Syd,
// som i tävlingen spelas av en människa. Fel som bara uppstår vid mänskliga val
// (andra bud, andra utspel) syns inte här. Den fångar krascher, absurda
// kontrakt, icke-terminerande auktioner och botlarm på just de 12 givarna —
// komplement till /felrapporter, inte ersättning. DD-larmen klassas i
// /speldiagnos (systemfel / ärlig miss), aldrig av siffrorna själva.
//
// Utdata: konsolen + revisor-output/tavlingsdiagnos-<datum>.json (gitignorad).

import { expect, it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatHand } from '../felrapport'
import { playSeedForBoard, seedForBoard } from '../../../api-src/_lib/seed'
import { dealFromSeed } from './deal'
import { analyseSpel, computeOracle, getDds } from './revisor-dds'
import { botAuction, judgeDeal, CATEGORY_LABEL } from './revisor'
import { bedomSpel, helDom, type SpelDom } from './speldom'
import { spelaMedFro } from './spela-giv'
import type { Strain } from './play'

const START = process.env.TAVLING_DIAG ?? ''
const DAGAR = Number(process.env.TAVLING_DAGAR ?? 1)
const BRICKOR = 12

/** Hemligheten ur miljön eller .env.local — utan att någonsin skrivas ut. */
function lasSecret(): string | null {
  if (process.env.DAILY_SEED_SECRET) return process.env.DAILY_SEED_SECRET
  try {
    const m = readFileSync('.env.local', 'utf8').match(/^DAILY_SEED_SECRET=(.+)$/m)
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

function datumPlus(dateISO: string, dagar: number): string {
  const d = new Date(dateISO + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dagar)
  return d.toISOString().slice(0, 10)
}

const STRAIN_BOKSTAV: Record<Strain, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S', NT: 'NT' }

it.skipIf(!START)('tävlingsförscreening', { timeout: 0 }, async () => {
  expect(/^\d{4}-\d{2}-\d{2}$/.test(START), `TAVLING_DIAG måste vara YYYY-MM-DD (fick "${START}")`).toBe(true)
  const secret = lasSecret()
  expect(
    secret,
    'DAILY_SEED_SECRET saknas. Lägg den i .env.local (gitignorad) som DAILY_SEED_SECRET=... — ALDRIG i .env (spårad av git!).',
  ).toBeTruthy()

  const dds = await getDds()
  mkdirSync(join(process.cwd(), 'revisor-output'), { recursive: true })

  for (let dag = 0; dag < DAGAR; dag++) {
    const datum = datumPlus(START, dag)
    const rader: string[] = [`=== TÄVLINGSFÖRSCREENING ${datum} (${BRICKOR} brickor, alla säten = bot) ===`]
    const larm: string[] = []
    const json: unknown[] = []

    for (let board = 1; board <= BRICKOR; board++) {
      const deal = dealFromSeed(seedForBoard(secret!, datum, board), board)
      const playSeed = playSeedForBoard(secret!, datum, board)
      const history = botAuction(deal)
      if (!history) {
        larm.push(`bricka ${board}: AUKTIONEN TERMINERADE ALDRIG — motorfel, MÅSTE granskas!`)
        json.push({ board, fel: 'auktion-terminerade-aldrig' })
        continue
      }
      const oracle = computeOracle(dds, deal)
      const verdict = judgeDeal(deal, history, oracle.solve, board, oracle.parNS)
      if (!verdict) {
        larm.push(`bricka ${board}: DD-oraklet kunde inte lösa given — granska!`)
        json.push({ board, fel: 'olosbar' })
        continue
      }

      let spelDom: SpelDom | null = null
      if (verdict.contract) {
        const spelad = spelaMedFro(deal, verdict.contract, history, playSeed)
        spelDom = bedomSpel(verdict.contract, analyseSpel(dds, deal, verdict.contract, spelad.tricks), spelad.tricks)
      }
      const hel = helDom(deal, verdict, spelDom)

      const kontraktText = verdict.contract
        ? `${verdict.contract.level}${STRAIN_BOKSTAV[verdict.contract.strain]}${verdict.contract.doubled ?? ''} av ${verdict.contract.declarer}`
        : 'utpassad'
      const spelText = spelDom
        ? `spel DD ${spelDom.ddTricks}→${spelDom.actualTricks} (förartapp ${spelDom.spelforartapp}, försvarstapp ${spelDom.forsvarstapp})`
        : 'inget spel'
      rader.push(
        `bricka ${board}: ${kontraktText} · bud ${verdict.category === 'ratt' ? 'rätt' : `${CATEGORY_LABEL[verdict.category]} (−${verdict.loss})`} · ${spelText}`,
      )
      for (const s of ['N', 'E', 'S', 'W'] as const) rader.push(`    ${s}: ${formatHand(deal.hands[s])}`)
      for (const f of spelDom?.fel ?? []) {
        rader.push(`    ⚠ stick ${f.trick}, kort ${f.kortIndex}: ${f.seat} (${f.roll}) tappar ${f.kostnad}`)
      }

      // Granskningslarm (kandidater — klassas i /speldiagnos, inte här).
      if (verdict.loss >= 500) larm.push(`bricka ${board}: stort budtapp ${verdict.loss} (${CATEGORY_LABEL[verdict.category]})`)
      if ((spelDom?.spelforartapp ?? 0) >= 2) larm.push(`bricka ${board}: spelförarsidan tappar ${spelDom!.spelforartapp} stick`)
      json.push({ board, kontrakt: kontraktText, budKategori: hel.budKategori, budtapp: hel.budtapp, spelDeltaNS: hel.spelDeltaNS, ddTricks: spelDom?.ddTricks ?? null, actualTricks: spelDom?.actualTricks ?? null, fel: spelDom?.fel ?? [] })
    }

    rader.push('')
    rader.push(larm.length === 0 ? 'INGA LARM — dagen ser ren ut.' : `LARM (${larm.length}):\n  ` + larm.join('\n  '))
    const text = rader.join('\n')
    console.log('\n' + text + '\n')
    writeFileSync(join(process.cwd(), 'revisor-output', `tavlingsdiagnos-${datum}.json`), JSON.stringify({ datum, larm, brickor: json }, null, 2), 'utf8')
    writeFileSync(join(process.cwd(), 'revisor-output', `tavlingsdiagnos-${datum}.txt`), text, 'utf8')
  }
})
