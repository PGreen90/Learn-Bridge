// Facit för bordets spelmotor (etapp 4B) — kärnan i "servern är domaren":
// projektionen, dragvalideringen, botframdrivningen, träkarlsavslöjandet och
// giv-klar-bokföringen. Allt körs mot en händelselista i minnet (ingen databas)
// — exakt så endpointen använder modulen.

import { describe, test, expect } from 'vitest'
import type { Seat } from '../../src/types/bridge'
import { contractFromCalls, decideCall, seatToAct } from '../../src/lib/engine/auction-live'
import { botCardSmart } from '../../src/lib/engine/play-bot'
import { nsScore } from '../../src/lib/engine/matchpoints'
import {
  agerande,
  autoAuktion,
  bordGiv,
  bordGivSeed,
  bordPlaySeed,
  dealUrGivStart,
  drivFram,
  givStartHandelse,
  lage2Giv,
  projiceraGiv,
  utforDrag,
  SERVER_SMART,
  type GivHandelse,
  type NyHandelse,
} from './bord-motor'

const SEED = 'facit-bordsfro-1234'

/** NyHandelse → bokförd form (som endpointen skriver och läser tillbaka). */
function bokfor(h: NyHandelse): GivHandelse {
  return { typ: h.typ, seat: h.seat ?? null, data: h.data ?? {} }
}

/** Tumregelprofil så testloopen inte drar igång Monte-Carlo (snabbt + stabilt). */
const SNABB = { maxCardsForMC: 0 }

/**
 * Spela en hel giv genom motorns riktiga flöde: drivFram spelar bottarna,
 * människostolarnas drag väljs med motorns egna funktioner (testet får se
 * given — det är spelarens perspektiv) och bokförs via utforDrag, precis som
 * endpointen gör. Returnerar hela händelselistan.
 */
function spelaGiv(givNr: number, manniskor: Set<Seat>): GivHandelse[] {
  const deal = bordGiv(SEED, givNr)
  const miljo = {
    manniskoStolar: manniskor,
    playSeed: bordPlaySeed(SEED, givNr),
    stallning: { ns: 0, ew: 0 },
    smart: SNABB,
  }
  const handelser: GivHandelse[] = [bokfor(givStartHandelse(deal, givNr))]
  handelser.push(...drivFram(deal, givNr, handelser, miljo).map(bokfor))

  let vakt = 0
  for (;;) {
    if (vakt++ > 120) throw new Error('given tog aldrig slut')
    const lage = projiceraGiv(deal, handelser)
    if (lage.givKlar) return handelser
    let stol: Seat
    let drag
    if (lage.fas === 'bud') {
      stol = seatToAct(deal.dealer, lage.history.length)
      expect(manniskor.has(stol), 'drivFram får aldrig lämna en bots tur').toBe(true)
      drag = { typ: 'bud' as const, bid: decideCall(deal, lage.history, stol).bid }
    } else {
      const toAct = lage.state!.toAct
      stol = agerande(lage.contract!, toAct)
      expect(manniskor.has(stol), 'drivFram får aldrig lämna en bots tur').toBe(true)
      drag = { typ: 'kort' as const, card: botCardSmart(lage.state!, toAct, lage.history, SNABB) }
    }
    const utfall = utforDrag(deal, givNr, lage, stol, drag)
    if (!utfall.ok) throw new Error(`draget avvisades: ${utfall.fel}`)
    handelser.push(bokfor(utfall.handelse))
    handelser.push(...drivFram(deal, givNr, handelser, miljo).map(bokfor))
  }
}

/** Given som inte passas ut med SEED ovan (kontrolleras i första testet). */
const GIV = 1

describe('bordGiv — givarna ur bordsfröet', () => {
  test('deterministisk: samma frö + givnummer ger exakt samma giv', () => {
    expect(bordGiv(SEED, 3)).toEqual(bordGiv(SEED, 3))
    expect(bordGivSeed(SEED, 3)).not.toBe(bordGivSeed(SEED, 4))
    expect(bordGivSeed(SEED, 3)).not.toBe(bordGivSeed('annat-fro', 3))
    expect(bordPlaySeed(SEED, 3)).not.toBe(bordGivSeed(SEED, 3))
  })

  test('bricknumret följer givnumret och zonschemat rullar över 16', () => {
    expect(bordGiv(SEED, 5).board).toBe(5)
    const giv17 = bordGiv(SEED, 17)
    const giv1 = bordGiv(SEED, 1)
    expect(giv17.dealer).toBe(giv1.dealer) // boardInfo är modulär (17 ≡ 1)
    expect(giv17.vulnerability).toBe(giv1.vulnerability)
  })
})

describe('drivFram — helt botbord (0 människor)', () => {
  const handelser = spelaGiv(GIV, new Set())

  test('given spelas färdig: komplett auktion, 52 kort, exakt en träkarl, giv-klar sist', () => {
    const typer = handelser.map((h) => h.typ)
    expect(typer[typer.length - 1]).toBe('giv-klar')
    expect(typer.filter((t) => t === 'trakarl')).toHaveLength(1)
    expect(typer.filter((t) => t === 'kort')).toHaveLength(52)
    // Träkarlen avslöjas DIREKT efter utspelet — aldrig före.
    expect(typer.indexOf('trakarl')).toBe(typer.indexOf('kort') + 1)
  })

  test('giv-klar bär reveal + serverns omräknade poäng + ställningen', () => {
    const deal = bordGiv(SEED, GIV)
    const klar = handelser[handelser.length - 1].data as {
      hands: unknown
      contract: { declarer: Seat; level: number }
      passadUt: boolean
      declarerTricks: number
      nsScore: number
      stallning: { ns: number; ew: number }
    }
    expect(klar.passadUt).toBe(false)
    expect(klar.hands).toEqual(deal.hands)
    expect(klar.nsScore).toBe(
      nsScore(klar.contract as never, klar.declarerTricks, deal.vulnerability),
    )
    expect(klar.stallning).toEqual(
      klar.nsScore > 0 ? { ns: klar.nsScore, ew: 0 } : { ns: 0, ew: -klar.nsScore },
    )
  })

  test('deterministisk: samma indata ger exakt samma händelseföljd', () => {
    expect(spelaGiv(GIV, new Set())).toEqual(handelser)
  })

  test('ställningen ackumuleras ovanpå tidigare givar', () => {
    const deal = bordGiv(SEED, GIV)
    const alla = [bokfor(givStartHandelse(deal, GIV))]
    const nya = drivFram(deal, GIV, alla, {
      manniskoStolar: new Set(),
      playSeed: bordPlaySeed(SEED, GIV),
      stallning: { ns: 400, ew: 250 },
      smart: SNABB,
    })
    const klar = nya[nya.length - 1].data as { nsScore: number; stallning: { ns: number; ew: number } }
    expect(klar.stallning.ns).toBe(400 + Math.max(0, klar.nsScore))
    expect(klar.stallning.ew).toBe(250 + Math.max(0, -klar.nsScore))
  })
})

describe('drivFram + utforDrag — människa vid bordet', () => {
  test('en människa på Syd: hela given spelas via drag-flödet till giv-klar', () => {
    const handelser = spelaGiv(GIV, new Set(['S']))
    const typer = handelser.map((h) => h.typ)
    expect(typer[typer.length - 1]).toBe('giv-klar')
    expect(typer.filter((t) => t === 'kort')).toHaveLength(52)
    expect(typer.filter((t) => t === 'trakarl')).toHaveLength(1)
  })

  test('två människor (S + W): flödet håller även med blandade sidor', () => {
    const handelser = spelaGiv(GIV, new Set(['S', 'W']))
    expect(handelser[handelser.length - 1].typ).toBe('giv-klar')
  })
})

describe('utforDrag — avvisningarna', () => {
  const deal = bordGiv(SEED, GIV)
  const start: GivHandelse[] = [bokfor(givStartHandelse(deal, GIV))]

  test('fel stol: bud när det inte är ens tur avvisas', () => {
    const lage = projiceraGiv(deal, start)
    const felStol = seatToAct(deal.dealer, 0) === 'N' ? 'E' : 'N'
    const utfall = utforDrag(deal, GIV, lage, felStol, { typ: 'bud', bid: 'P' })
    expect(utfall).toEqual({ ok: false, fel: 'Inte din tur att bjuda' })
  })

  test('olagligt bud avvisas (bud under redan lagt bud)', () => {
    const stol0 = seatToAct(deal.dealer, 0)
    const stol1 = seatToAct(deal.dealer, 1)
    const med2NT: GivHandelse[] = [...start, { typ: 'bud', seat: stol0, data: { bid: '2NT' } }]
    const lage = projiceraGiv(deal, med2NT)
    const utfall = utforDrag(deal, GIV, lage, stol1, { typ: 'bud', bid: '1S' })
    expect(utfall).toEqual({ ok: false, fel: 'Ogiltigt bud' })
  })

  test('kort i budfasen avvisas', () => {
    const lage = projiceraGiv(deal, start)
    const utfall = utforDrag(deal, GIV, lage, seatToAct(deal.dealer, 0), {
      typ: 'kort',
      card: { suit: 'spades', rank: 'A' },
    })
    expect(utfall).toEqual({ ok: false, fel: 'Kortspelet pågår inte' })
  })

  test('olagligt kort avvisas (kortet finns inte i handen på tur)', () => {
    // Spela fram till spel-fasen med bara bottar utom S, och låt sedan S (om S
    // agerar) eller motorn visa att ett kort utanför handen avvisas.
    const handelser: GivHandelse[] = [...start]
    const miljo = {
      manniskoStolar: new Set<Seat>(['S']),
      playSeed: bordPlaySeed(SEED, GIV),
      stallning: { ns: 0, ew: 0 },
      smart: SNABB,
    }
    handelser.push(...drivFram(deal, GIV, handelser, miljo).map(bokfor))
    let lage = projiceraGiv(deal, handelser)
    // Bjud med motorns bud tills auktionen är klar och spelet väntar på S.
    let vakt = 0
    while (lage.fas === 'bud') {
      if (vakt++ > 40) throw new Error('auktionen tog aldrig slut')
      const stol = seatToAct(deal.dealer, lage.history.length)
      const utfall = utforDrag(deal, GIV, lage, stol, {
        typ: 'bud',
        bid: decideCall(deal, lage.history, stol).bid,
      })
      if (!utfall.ok) throw new Error(utfall.fel)
      handelser.push(bokfor(utfall.handelse))
      handelser.push(...drivFram(deal, GIV, handelser, miljo).map(bokfor))
      lage = projiceraGiv(deal, handelser)
    }
    if (lage.fas !== 'spel') return // utpassad giv — inget mer att testa här
    const toAct = lage.state!.toAct
    const stol = agerande(lage.contract!, toAct)
    // Ett kort som garanterat inte är lagligt: första kortet i NÅGON ANNAN hand.
    const annan = (['N', 'E', 'S', 'W'] as Seat[]).find((s) => s !== toAct)!
    const frammandeKort = lage.state!.hands[annan][0]
    const utfall = utforDrag(deal, GIV, lage, stol, { typ: 'kort', card: frammandeKort })
    expect(utfall.ok).toBe(false)
  })
})

describe('läge 1 — endast budgivning (4D)', () => {
  test('drivFram stannar vid avslutad auktion och bokför facit i stället för spel', () => {
    const deal = bordGiv(SEED, GIV)
    const handelser: GivHandelse[] = [bokfor(givStartHandelse(deal, GIV))]
    const nya = drivFram(deal, GIV, handelser, {
      manniskoStolar: new Set(),
      playSeed: bordPlaySeed(SEED, GIV),
      stallning: { ns: 0, ew: 0 },
      spelform: 'budgivning',
      smart: SNABB,
    })
    const typer = nya.map((h) => h.typ)
    expect(typer.filter((t) => t === 'kort')).toHaveLength(0)
    expect(typer[typer.length - 1]).toBe('facit')
    const facit = nya[nya.length - 1].data as {
      hands: unknown
      systemlinje: Array<{ seat: Seat; bid: string }>
    }
    expect(facit.hands).toEqual(deal.hands)
    // Systemlinjen är motorns egen kanoniska auktion för given.
    expect(facit.systemlinje).toEqual(autoAuktion(deal))
    // Ett helt botbord bjuder per definition motorns linje — de ska sammanfalla.
    const bjudet = [...handelser, ...nya.map(bokfor)]
    expect(projiceraGiv(deal, bjudet).history).toEqual(autoAuktion(deal))
    // Facit avslutar given (nästa giv-knappen låses upp).
    expect(projiceraGiv(deal, bjudet).givKlar).toBe(true)
  })
})

describe('läge 2 — endast spelföring (4D)', () => {
  test('målstolen blir spelförare, rotationen är återskapbar och deterministisk', () => {
    for (const mal of ['N', 'E', 'S', 'W'] as Seat[]) {
      for (let giv = 1; giv <= 10; giv++) {
        const { deal, underIndex, shift } = lage2Giv(SEED, giv, mal)
        // Auktionen på den roterade given ger målstolen som spelförare.
        const contract = contractFromCalls(autoAuktion(deal))
        expect(contract, `giv ${giv} mål ${mal}: utpassad`).not.toBeNull()
        expect(contract!.declarer, `giv ${giv} mål ${mal}`).toBe(mal)
        // Rotationen i giv-start-datat återskapar exakt samma deal.
        expect(dealUrGivStart(SEED, giv, { underIndex, shift })).toEqual(deal)
        // Deterministisk: samma indata → samma giv.
        expect(lage2Giv(SEED, giv, mal)).toEqual({ deal, underIndex, shift })
      }
    }
  })

  test('zonen följer partnerskapen vid udda rotation', () => {
    const { deal, underIndex, shift } = lage2Giv(SEED, 3, 'E')
    const ratt = bordGiv(SEED, 3, underIndex)
    if (shift % 2 === 1) {
      const speglad = ratt.vulnerability === 'ns' ? 'ew' : ratt.vulnerability === 'ew' ? 'ns' : ratt.vulnerability
      expect(deal.vulnerability).toBe(speglad)
    } else {
      expect(deal.vulnerability).toBe(ratt.vulnerability)
    }
  })
})

describe('tidsbudgeten', () => {
  test('överskriden budget: given spelas ändå färdig (tumregelfallbacken)', () => {
    const deal = bordGiv(SEED, GIV)
    const handelser: GivHandelse[] = [bokfor(givStartHandelse(deal, GIV))]
    let klockslag = 0
    const nya = drivFram(deal, GIV, handelser, {
      manniskoStolar: new Set(),
      playSeed: bordPlaySeed(SEED, GIV),
      stallning: { ns: 0, ew: 0 },
      budgetMs: 1, // omedelbar övertrassering
      nu: () => (klockslag += 1000),
    })
    expect(nya[nya.length - 1].typ).toBe('giv-klar')
    expect(nya.filter((h) => h.typ === 'kort')).toHaveLength(52)
  })

  test('serverprofilen (riktig MC-budget) spelar en hel giv färdig', () => {
    // Riktiga SERVER_SMART — långsammare (MC i slutspelen) men ska hålla gott
    // och väl inom testets tidsgräns; detta är vaktposten mot en MC-profil som
    // sväller bortom serverless-budgeten.
    const deal = bordGiv(SEED, 2)
    const handelser: GivHandelse[] = [bokfor(givStartHandelse(deal, 2))]
    const nya = drivFram(deal, 2, handelser, {
      manniskoStolar: new Set(),
      playSeed: bordPlaySeed(SEED, 2),
      stallning: { ns: 0, ew: 0 },
    })
    expect(SERVER_SMART.maxCardsForMC).toBe(7)
    expect(nya[nya.length - 1].typ).toBe('giv-klar')
  })
})
