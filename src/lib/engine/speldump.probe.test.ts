// SPELDUMP (Speldiagnosen steg 5) — repro-verktyget som gör ett DD-larm
// ÅTGÄRDBART: hela given kort för kort med botens EGET skäl per kort och
// ⚠-markering där DD-facit rörde sig (säte, roll, kostnad, DD före/efter).
// Det är den här dumpen /speldiagnos-agenten läser för att avgöra VILKEN
// botregel som felade — och för att klassa larmet som systemfel eller ärlig
// miss (DD ser alla kort; boten får bara sin ärliga information).
//
//   PowerShell:  $env:DUMP_SPEL='20260722,20260723'; npx vitest run src/lib/engine/speldump.probe.test.ts
//   Bash:        DUMP_SPEL=20260722 npx vitest run src/lib/engine/speldump.probe.test.ts
//
// Spelet återskapas EXAKT som i speldiagnos-proben (samma per-beslut-frön via
// botDecisionSeed), så dumpen visar samma genomspelning som rapportens larm.
// Utdata: revisor-output/speldump.txt.

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Card } from '../../types/bridge'
import { formatHand } from '../felrapport'
import { contractFromCalls } from './auction-contract'
import { mulberry32 } from './deal'
import { botCardSmartReasoned } from './play-bot'
import { isComplete, playCard, startPlay } from './play'
import { botDecisionSeed, playIndexOf } from './play-seed'
import { analyseSpel, computeOracle, getDds } from './revisor-dds'
import { botAuction, dealFromSeed } from './revisor'
import { bedomSpel } from './speldom'

const SEEDS = (process.env.DUMP_SPEL ?? '').split(',').filter(Boolean).map(Number)

const SUIT_GLYPH: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
const kortStr = (c: Card) => `${SUIT_GLYPH[c.suit]}${c.rank}`
const ROLL_TEXT: Record<string, string> = { utspel: 'UTSPELET', spelforare: 'SPELFÖRARSIDAN', forsvar: 'FÖRSVARET' }

it.skipIf(SEEDS.length === 0)('speldump', { timeout: 0 }, async () => {
  const dds = await getDds()
  const rader: string[] = []

  for (const seed of SEEDS) {
    const deal = dealFromSeed(seed)
    const history = botAuction(deal)
    const contract = history && contractFromCalls(history)
    rader.push(`\n=== frö ${seed} · giv ${deal.dealer} · zon ${deal.vulnerability} ===`)
    for (const s of ['N', 'E', 'S', 'W'] as const) rader.push(`  ${s}: ${formatHand(deal.hands[s])}`)
    if (!history || !contract) {
      rader.push(history ? '  (utpassad — inget spel)' : '  (auktionen terminerade aldrig — motorfel!)')
      continue
    }

    rader.push('  -- Auktionen --')
    for (const call of history) {
      const c = call as { seat: string; bid: string; rule?: string; explanation?: string }
      rader.push(`  ${c.seat} ${c.bid.padEnd(4)} [${c.rule ?? '—'}] ${c.explanation ?? ''}`)
    }

    // Spela given EXAKT som speldiagnos-proben (samma per-beslut-frön), men med
    // botCardSmartReasoned så varje korts EGET skäl följer med i dumpen.
    let st = startPlay(deal, contract)
    const skal: string[] = []
    let guard = 0
    while (!isComplete(st) && guard++ < 60) {
      const rng = mulberry32(botDecisionSeed(seed, playIndexOf(st.completedTricks.length, st.currentTrick.length)))
      const val = botCardSmartReasoned(st, st.toAct, history, { rng })
      skal.push(val.reason)
      st = playCard(st, val.card)
    }
    const tricks = st.completedTricks
    const trace = analyseSpel(dds, deal, contract, tricks)
    const dom = bedomSpel(contract, trace, tricks)
    const oracle = computeOracle(dds, deal)

    const strainTecken: Record<string, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S', NT: 'NT' }
    rader.push(
      `  -- Spelet: ${contract.level}${strainTecken[contract.strain]}${contract.doubled ?? ''} av ${contract.declarer} · ` +
        `DD ${dom.ddTricks} stick → utfall ${dom.actualTricks} · ` +
        `spelförartapp ${dom.spelforartapp} · försvarstapp ${dom.forsvarstapp} --`,
    )
    rader.push(`  (par: ${oracle.parContracts.join(' / ')} = ${oracle.parNS} sett från N/S)`)

    let kortIndex = 0
    for (const [ti, trick] of tricks.entries()) {
      rader.push(`  Stick ${ti + 1} (utspel ${trick.leader}, vinns av ${trick.winner}):`)
      for (const pc of trick.cards) {
        kortIndex++
        const fel = dom.fel.find((f) => f.kortIndex === kortIndex)
        const varn = fel
          ? `  ⚠ ${ROLL_TEXT[fel.roll]} tappar ${fel.kostnad} (DD ${trace[fel.kortIndex - 1]}→${trace[fel.kortIndex]})`
          : ''
        rader.push(`    ${pc.seat} ${kortStr(pc.card)}${varn}  · ${skal[kortIndex - 1]}`)
      }
    }
  }

  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/speldump.txt', rader.join('\n'), 'utf8')
  console.log(rader.join('\n'))
})
