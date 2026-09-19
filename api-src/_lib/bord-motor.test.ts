// Facit för bordets spelmotor (etapp 4B) — kärnan i "servern är domaren":
// projektionen, dragvalideringen, botframdrivningen, träkarlsavslöjandet och
// giv-klar-bokföringen. Allt körs mot en händelselista i minnet (ingen databas)
// — exakt så endpointen använder modulen.

import { describe, test, expect } from 'vitest'
import type { Seat } from '../../src/types/bridge'
import { contractFromCalls, decideCall, seatToAct } from '../../src/lib/engine/auction-live'
import { botCardSmart } from '../../src/lib/engine/play-bot'
import { dummyOf } from '../../src/lib/engine/play'
import { nsScore } from '../../src/lib/engine/matchpoints'
import { declarerTricksWon, remainingTricks } from '../../src/lib/engine/claim'
import {
  agerande,
  autoAuktion,
  bordGiv,
  bordGivSeed,
  bordPlaySeed,
  claimSvarande,
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

// ---------------------------------------------------------------------------
// Claimen vid bordet (SENARE-listan etapp 3, ägarbeslut 2026-09-14): "när DD
// vill claima ska den göra det, men människan ska få välja OK eller spela
// klart". DD-domen (claim-dd.ts) testas mot den riktiga lösaren i
// claim-dd.test.ts — här injiceras den som stub så flödet i motorn kan
// facittestas exakt: förslag vid stickstart, pausen, svaren, bokföringen.
describe('claimen — förslag, svar och bokföring (etapp 3)', () => {
  /** Spela given som spelaGiv, men med en claim-kontroll som slår till vid
   *  första stickstart efter minst två spelade stick; stannar när förslaget
   *  ligger i loggen (eller när given tog slut utan förslag). */
  function spelaTillClaim(manniskor: Set<Seat>, kontroll?: (st: import('../../src/lib/engine/play').PlayState) => boolean) {
    const deal = bordGiv(SEED, GIV)
    const miljo = {
      manniskoStolar: manniskor,
      playSeed: bordPlaySeed(SEED, GIV),
      stallning: { ns: 0, ew: 0 },
      smart: SNABB,
      claimKontroll: kontroll ?? ((st) => st.completedTricks.length >= 2 && st.currentTrick.length === 0),
    }
    const handelser: GivHandelse[] = [bokfor(givStartHandelse(deal, GIV))]
    handelser.push(...drivFram(deal, GIV, handelser, miljo).map(bokfor))
    let vakt = 0
    for (;;) {
      if (vakt++ > 120) throw new Error('given tog aldrig slut')
      const lage = projiceraGiv(deal, handelser)
      if (lage.givKlar || (lage.claim && !lage.claim.avbojd)) return { deal, miljo, handelser, lage }
      let stol: Seat
      let drag
      if (lage.fas === 'bud') {
        stol = seatToAct(deal.dealer, lage.history.length)
        drag = { typ: 'bud' as const, bid: decideCall(deal, lage.history, stol).bid }
      } else {
        const toAct = lage.state!.toAct
        stol = agerande(lage.contract!, toAct)
        drag = { typ: 'kort' as const, card: botCardSmart(lage.state!, toAct, lage.history, SNABB) }
      }
      const utfall = utforDrag(deal, GIV, lage, stol, drag)
      if (!utfall.ok) throw new Error(`draget avvisades: ${utfall.fel}`)
      handelser.push(bokfor(utfall.handelse))
      handelser.push(...drivFram(deal, GIV, handelser, miljo).map(bokfor))
    }
  }
  const HUMANS = new Set<Seat>(['S', 'W'])

  test('förslaget: vid stickstart bokförs claim-forslag med spelförarens total, sedan står spelet', () => {
    const { handelser, lage } = spelaTillClaim(HUMANS)
    const forslag = handelser.filter((h) => h.typ === 'claim-forslag')
    expect(forslag).toHaveLength(1)
    expect(handelser[handelser.length - 1].typ).toBe('claim-forslag') // inga kort efter
    const d = forslag[0].data as { total: number; stol: Seat }
    expect(forslag[0].seat).toBe(lage.contract!.declarer)
    expect(d.stol).toBe(lage.contract!.declarer)
    expect(lage.state!.currentTrick).toHaveLength(0)
    expect(d.total).toBe(declarerTricksWon(lage.state!) + remainingTricks(lage.state!))
    expect(lage.claim).toEqual({ total: d.total, stol: d.stol, svar: {}, avbojd: false })
  })

  test('medan claimen väntar avvisas kort, och drivFram spelar inga botkort', () => {
    const { deal, miljo, handelser, lage } = spelaTillClaim(HUMANS)
    const toAct = lage.state!.toAct
    const utfall = utforDrag(deal, GIV, lage, agerande(lage.contract!, toAct), {
      typ: 'kort',
      card: botCardSmart(lage.state!, toAct, lage.history, SNABB),
    })
    expect(utfall.ok).toBe(false)
    expect(!utfall.ok && utfall.fel).toBe('Claimen väntar på svar')
    expect(drivFram(deal, GIV, handelser, miljo)).toEqual([])
  })

  test('alla som ska svara säger OK → giv-klar med claimens total, resten av sticken ospelade', () => {
    const { deal, miljo, handelser, lage } = spelaTillClaim(HUMANS)
    const kravda = claimSvarande(lage.contract!, HUMANS)
    expect(kravda.length).toBeGreaterThan(0)
    expect(kravda).not.toContain(dummyOf(lage.contract!))
    const total = lage.claim!.total
    const kortInnan = handelser.filter((h) => h.typ === 'kort').length
    // Första svaret räcker inte om fler ska svara.
    for (let i = 0; i < kravda.length; i++) {
      handelser.push({ typ: 'claim-svar', seat: kravda[i], data: { ok: true } })
      const nya = drivFram(deal, GIV, handelser, miljo)
      if (i < kravda.length - 1) {
        expect(nya).toEqual([])
      } else {
        expect(nya.map((h) => h.typ)).toEqual(['giv-klar'])
        const klar = nya[0].data as { declarerTricks: number; claim: { total: number; stol: Seat }; nsScore: number }
        expect(klar.declarerTricks).toBe(total)
        expect(klar.claim).toEqual({ total, stol: lage.contract!.declarer })
        expect(klar.nsScore).toBe(nsScore(lage.contract!, total, deal.vulnerability))
        handelser.push(bokfor(nya[0]))
      }
    }
    expect(handelser.filter((h) => h.typ === 'kort').length).toBe(kortInnan)
    expect(projiceraGiv(deal, handelser).givKlar).toBe(true)
  })

  test('ett nej → spelet fortsätter till slut, och ingen ny claim föreslås i given', () => {
    const { deal, miljo, handelser, lage } = spelaTillClaim(HUMANS)
    const kravda = claimSvarande(lage.contract!, HUMANS)
    handelser.push({ typ: 'claim-svar', seat: kravda[0], data: { ok: false } })
    expect(projiceraGiv(deal, handelser).claim!.avbojd).toBe(true)
    // Spela klart med kontrollen fortfarande "ja" vid varje stickstart.
    handelser.push(...drivFram(deal, GIV, handelser, miljo).map(bokfor))
    let vakt = 0
    for (;;) {
      if (vakt++ > 120) throw new Error('given tog aldrig slut')
      const l = projiceraGiv(deal, handelser)
      if (l.givKlar) break
      const toAct = l.state!.toAct
      const stol = agerande(l.contract!, toAct)
      const utfall = utforDrag(deal, GIV, l, stol, { typ: 'kort', card: botCardSmart(l.state!, toAct, l.history, SNABB) })
      if (!utfall.ok) throw new Error(`draget avvisades: ${utfall.fel}`)
      handelser.push(bokfor(utfall.handelse))
      handelser.push(...drivFram(deal, GIV, handelser, miljo).map(bokfor))
    }
    expect(handelser.filter((h) => h.typ === 'claim-forslag')).toHaveLength(1)
    expect(handelser.filter((h) => h.typ === 'kort')).toHaveLength(52)
    const klar = handelser.find((h) => h.typ === 'giv-klar')!.data as { claim?: unknown }
    expect(klar.claim).toBeUndefined()
  })

  test('ingen som behöver svara (bara träkarlen är människa) → given bokförs direkt', () => {
    const forsta = spelaTillClaim(HUMANS)
    const dummy = dummyOf(forsta.lage.contract!)
    const { handelser } = spelaTillClaim(new Set<Seat>([dummy]))
    const typer = handelser.map((h) => h.typ)
    expect(typer.filter((t) => t === 'claim-forslag')).toHaveLength(1)
    expect(typer[typer.length - 1]).toBe('giv-klar')
    expect(typer.indexOf('claim-forslag')).toBe(typer.length - 2)
  })

  // Ägarbeslut 2026-09-19: ett enda stick kvar claimas aldrig — korten är
  // tvingade, frågan vore bara ett avbrott. Kontrollen säger ja först vid
  // sista stickstarten → inget förslag, given spelas ut.
  test('ett enda stick kvar → inget förslag, given spelas klart', () => {
    const { handelser, lage } = spelaTillClaim(HUMANS, (st) => st.completedTricks.length >= 12)
    expect(lage.givKlar).toBe(true)
    expect(handelser.some((h) => h.typ === 'claim-forslag')).toBe(false)
  })

  test('utan claim-kontroll föreslås aldrig någon claim (spelet är opåverkat)', () => {
    const handelser = spelaGiv(GIV, HUMANS)
    expect(handelser.some((h) => h.typ === 'claim-forslag')).toBe(false)
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
