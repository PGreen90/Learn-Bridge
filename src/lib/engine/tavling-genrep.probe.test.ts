// GENREPET — tänkande bottar i tävlingen från start till slut (2026-09-24).
//
// Spelar hela tävlingsdagar (hemligt testfrö) med tänkande bottar precis som
// klientens worker gör (`botBud` + WASM-DD), skickar varje giv genom serverns
// snabbkontroll (`validera`) och räknar sedan om buden och korten som natt-
// granskningen gör — med en EGEN DD-instans. Kravet för live: varje giv godkänd
// och noll avvikelser.
//   $env:GENREP='1'; npx vitest run src/lib/engine/tavling-genrep.probe.test.ts
// (valfritt GENREP_DAGAR, standard 3). Utdata: revisor-output/tavling-genrep.txt

import { expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { playSeedForBoard, seedForBoard } from '../../../api-src/_lib/seed'
import { validera } from '../../../api-src/_lib/validera'
import { spelaBotGiv } from './botspelare'
import { dealFromSeed } from './deal'
import { botCardSmart } from './play-bot'
import { borTanka, botBud } from './resonemang'
import { computeOracle, getDds } from './revisor-dds'
import { botAvvikelser, budAvvikelser } from './tavlingsgranskning'

const ON = process.env.GENREP === '1'
const DAGAR = Number(process.env.GENREP_DAGAR ?? 3)
const SECRET = 'genrep-hemlis'

it.skipIf(!ON)('genrepet: tänkande bottar klarar servern och nattgranskningen', { timeout: 0 }, async () => {
  const klient = await getDds() // "telefonen"
  const natt = await getDds() // nattgranskningens egen instans
  const rader: string[] = []
  let givar = 0, tankta = 0, avvisade = 0, avvikande = 0
  let maxMs = 0
  const tankeMs: number[] = []
  for (let dag = 0; dag < DAGAR; dag++) {
    const datum = `2026-10-${String(dag + 1).padStart(2, '0')}`
    for (let board = 1; board <= 12; board++) {
      const givSeed = seedForBoard(SECRET, datum, board)
      const playSeed = playSeedForBoard(SECRET, datum, board)
      let tankt = 0
      const t0 = performance.now()
      const bud = (d: Parameters<typeof botBud>[0], h: Parameters<typeof botBud>[1], s: Parameters<typeof botBud>[2]) => {
        if (s !== 'S' && borTanka(d, h, s)) {
          tankt++
          const t1 = performance.now()
          const b = botBud(d, h, s, (x) => computeOracle(klient, x).solve)
          tankeMs.push(performance.now() - t1)
          return b
        }
        return botBud(d, h, s, (x) => computeOracle(klient, x).solve)
      }
      const inskick = spelaBotGiv(givSeed, playSeed, board, {}, bud)
      const ms = performance.now() - t0
      maxMs = Math.max(maxMs, ms)
      givar++
      if (!inskick) { rader.push(`${datum} #${board}: auktionen skenade`); continue }
      tankta += tankt
      const v = validera(SECRET, datum, inskick)
      if (!v.giltig) { avvisade++; rader.push(`${datum} #${board}: AVVISAD — ${v.skäl}`) }
      const deal = dealFromSeed(givSeed, board)
      const nattBud = (d: Parameters<typeof botBud>[0], h: Parameters<typeof botBud>[1], s: Parameters<typeof botBud>[2]) =>
        botBud(d, h, s, (x) => computeOracle(natt, x).solve).bid
      const avv = [...budAvvikelser(deal, inskick, nattBud), ...botAvvikelser(deal, playSeed, inskick, botCardSmart)]
      if (avv.length) { avvikande++; rader.push(`${datum} #${board}: AVVIKER — ${avv.join('; ')}`) }
      const tanktaBud = inskick.history.filter((c) => c.rule === 'resonemang' && c.seat !== 'S')
      if (tankt) rader.push(`${datum} #${board}: ${tankt} tänkande läge(n), ${(ms / 1000).toFixed(1)} s · ${tanktaBud.map((c) => `${c.seat}:${c.bid}`).join(' ')}`)
    }
  }
  const sorterad = [...tankeMs].sort((a, b) => a - b)
  const q = (p: number) => ((sorterad[Math.floor(p * (sorterad.length - 1))] ?? 0) / 1000).toFixed(1)
  const sammanfattning = `Genrepet: ${givar} givar, ${tankta} tänkande botlägen, ${avvisade} avvisade, ${avvikande} avvikande; tänketid per läge median ${q(0.5)} s, 90 % ${q(0.9)} s, längsta ${q(1)} s; ${sorterad.filter((m) => m < 50).length} lägen utan simulering`
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/tavling-genrep.txt', [sammanfattning, '', ...rader].join('\n'))
  expect(avvisade).toBe(0)
  expect(avvikande).toBe(0)
})
