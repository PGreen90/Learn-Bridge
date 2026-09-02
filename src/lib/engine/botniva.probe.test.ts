// NIVÅMÄTNINGEN (trebottarna, ägarbeslut 2026-09-01) — netto-metoden på
// nivårattarna: spelar samma givar två gånger (expert-baslinje ↔ nivå på Syds
// säten) och summerar Syd-sidans stickskillnad. Kravet som mäts: nybörjare <
// medel < expert — nivåerna ska vara MÄTBART isär, inte antaget isär
// (S6-lärdomen: bygg-mät-besluta, en ratt i taget).
//
// Körs ALDRIG i `npm test`/deploygrinden (skipIf) — bara på begäran:
//
//   PowerShell:  $env:NIVAMAT='1'; npx vitest run src/lib/engine/botniva.probe.test.ts
//   Bash:        NIVAMAT=1 npx vitest run src/lib/engine/botniva.probe.test.ts
//
// Rattar: NIVAMAT_DEALS (antal givar, standard 24), NIVAMAT_SEED (basfrö,
// standard 20260902 — behåll för jämförbara mätningar), NIVAMAT_VAD
// (kommalista av varianter, standard "medel,nyborjare"; även enskilda rattar
// "mc6"/"samples8"/"decode-av" för att mäta EN ratt i taget).
//
// Mätuppställningen speglar tävlingen exakt: nivå-opts BARA på de säten Syd
// styr (spelaBotGiv-urvalet), standardmotorn på övriga, per-besluts-frön ur
// (frö, beslutsindex) så båda körningarna är deterministiska och jämförbara.
// Metrik: Syd-sidans (N/S) stick — negativt netto = nivån är svagare (rätt).
//
// OBS vitest sväljer console.log vid fel — rapporten skrivs alltid till
// %TEMP%/botniva-matning.txt och revisor-output/.

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Seat } from '../../types/bridge'
import type { SmartOpts } from './play-bot'
import { botAuction, dealFromSeed } from './revisor'
import { contractFromCalls } from './auction-contract'
import { mulberry32 } from './deal'
import { side } from './play'
import { spelaHelGiv } from './spela-giv'
import { botDecisionSeed, playIndexOf } from './play-seed'
import { nivaSmartOpts } from './botniva'

const DEALS = Number(process.env.NIVAMAT_DEALS ?? 24)
const SEED = Number(process.env.NIVAMAT_SEED ?? 20260902)
const VAD = (process.env.NIVAMAT_VAD ?? 'medel,nyborjare').split(',').map((s) => s.trim())

/** Varianterna som kan mätas: de skarpa nivåerna + enskilda rattar/kandidater
 *  isolerade. Mäthistorik (frö 20260902, netto Syd-sidans stick):
 *  24 givar: fönster 6 = +1 (≈ ingen skillnad, FÖRKASTAD som medel) ·
 *  fönster 5 = 0 · fönster 4 = −2 (VALD som medel) · fönster 0 = −6 —
 *  monotont dos-responssvar på fönsterratten. Bekräftat på 48 givar
 *  (NIVAMAT_DEALS=48): medel = −8 · nybörjare = −18. */
const VARIANTER: Record<string, SmartOpts> = {
  medel: nivaSmartOpts('medel'),
  nyborjare: nivaSmartOpts('nyborjare'),
  medel6: { maxCardsForMC: 6, samples: 8, decodeSignals: false },
  medel5: { maxCardsForMC: 5, samples: 8, decodeSignals: false },
  mc6: { maxCardsForMC: 6 },
  samples8: { samples: 8 },
  'decode-av': { decodeSignals: false },
}

it.skipIf(!process.env.NIVAMAT)(
  `nivåmätning netto (${VAD.join('+')}): ${DEALS} givar, frö ${SEED}`,
  { timeout: 0 },
  () => {
    const t0 = Date.now()
    const rader: string[] = [`=== NIVÅMÄTNING netto — ${DEALS} givar, frö ${SEED} ===`]

    // Spela given med nivå-opts på Syds säten (exakt spelaBotGiv-urvalet) och
    // standardmotorn på övriga; varje beslut fröat som i tävlingen.
    const spelaNiva = (seedI: number, nivaOpts: SmartOpts): number | null => {
      const deal = dealFromSeed(seedI)
      const calls = botAuction(deal)
      const contract = calls && contractFromCalls(calls)
      if (!calls || !contract) return null
      const sydStyr = (seat: Seat) =>
        side(contract.declarer) === 'NS' ? side(seat) === 'NS' : seat === 'S'
      const res = spelaHelGiv(deal, contract, calls, {
        smart: (st) => {
          const rng = mulberry32(
            botDecisionSeed(seedI, playIndexOf(st.completedTricks.length, st.currentTrick.length)),
          )
          return sydStyr(st.toAct) ? { ...nivaOpts, rng } : { rng }
        },
      })
      // Syd-sidans (N/S) stick — jämförbart oavsett vem som är spelförare.
      return side(contract.declarer) === 'NS' ? res.declarerTricks : 13 - res.declarerTricks
    }

    // Expert-baslinjen EN gång per giv, delad av alla varianter.
    const baslinje = new Map<number, number | null>()
    for (let i = 0; i < DEALS; i++) baslinje.set(SEED + i, spelaNiva(SEED + i, {}))

    for (const namn of VAD) {
      const opts = VARIANTER[namn]
      if (!opts) {
        rader.push(`VARIANT OKÄND: "${namn}" (känner ${Object.keys(VARIANTER).join(', ')})`)
        continue
      }
      let netto = 0
      let spelade = 0
      let andrade = 0
      const detaljer: string[] = []
      for (let i = 0; i < DEALS; i++) {
        const seedI = SEED + i
        const bas = baslinje.get(seedI)
        if (bas == null) continue
        const nivan = spelaNiva(seedI, opts)
        if (nivan == null) continue
        spelade++
        const diff = nivan - bas
        netto += diff
        if (diff !== 0) {
          andrade++
          detaljer.push(`  frö ${seedI}: Syd-sidan ${bas} → ${nivan} (${diff > 0 ? '+' : ''}${diff})`)
        }
      }
      rader.push(
        '',
        `--- ${namn} (${JSON.stringify(opts)}) ---`,
        `${spelade} givar · netto Syd-sidans stick = ${netto > 0 ? '+' : ''}${netto} · ${andrade} givar ändrades`,
        '(negativt = nivån är svagare än experten — det mätningen ska visa)',
        ...detaljer,
      )
    }

    rader.push('', `Total tid: ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`)
    const rapport = rader.join('\n') + '\n'
    mkdirSync(join(process.cwd(), 'revisor-output'), { recursive: true })
    writeFileSync(join(process.cwd(), 'revisor-output', 'botniva-matning.txt'), rapport)
    if (process.env.TEMP) writeFileSync(join(process.env.TEMP, 'botniva-matning.txt'), rapport)
    // eslint-disable-next-line no-console
    console.log(rapport)
  },
)
