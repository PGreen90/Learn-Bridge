// Facit för rondgenomgångens textmotor (etapp 1). Skrivet FÖRE koden.
//
// buildRondRapport tar en färdigspelad giv (budgivning + stick + resultat) och
// bygger hela rapporten som DATA: tre kapitel (budgivning, spelföring, resultat)
// som UI:t bara renderar. Ren funktion — ingen DD, inget UI, ingen slump.
//
// Perspektivet (verifierat mot controls() i pages/play/common.tsx): när NS är
// spelförarsida spelar användaren BÅDA händerna N och S → Syd är alltid "du",
// Nord är "Nord (dina kort)" när NS spelför och "Nord (din partner)" i försvar.
// Öst/Väst omtalas alltid i tredje person.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { contractResult, isComplete, legalCards, playCard, startPlay } from './play'
import type { Contract, PlayResult, Trick } from './play'
import { botAuction, dealFromSeed } from './revisor'
import { scoreLine } from './scoring'
import { buildRondRapport, type RondRapportInput } from './rond-rapport'

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank })

function deal(over: Partial<Deal> = {}): Deal {
  return {
    id: 'test-giv',
    board: 7,
    dealer: 'N',
    vulnerability: 'none',
    hands: { N: [], E: [], S: [], W: [] },
    ...over,
  }
}

/** Bygger ett komplett indata-objekt med rimliga defaultvärden. */
function input(over: Partial<RondRapportInput> = {}): RondRapportInput {
  const contract: Contract = over.contract ?? { declarer: 'S', strain: 'spades', level: 4 }
  const result: PlayResult = over.result ?? { declarerTricks: 10, needed: 10, made: true, diff: 0 }
  return {
    deal: deal(),
    contract,
    calls: [
      { seat: 'N', bid: 'P' },
      { seat: 'E', bid: 'P' },
      { seat: 'S', bid: '1S', rule: 'öppning', explanation: 'Öppning 1♠ — 12+ hp, 5+ spader.' },
      { seat: 'W', bid: 'P' },
      { seat: 'N', bid: 'P' },
      { seat: 'E', bid: 'P' },
    ],
    tricks: [],
    result,
    score: null,
    claimed: null,
    botReasons: {},
    ...over,
  }
}

// Två handbyggda stick i 4♠ av Syd (trumf spader), spelordning V→N→Ö→S:
// stick 1: Öst stjäl hjärterutspelet; stick 2: Syd vinner ruter, Nord sakar.
const TRICK_RUFF: Trick = {
  leader: 'W',
  cards: [
    { seat: 'W', card: c('hearts', '5') },
    { seat: 'N', card: c('hearts', 'A') },
    { seat: 'E', card: c('spades', '3') },
    { seat: 'S', card: c('hearts', '2') },
  ],
  winner: 'E',
}
const TRICK_DISCARD: Trick = {
  leader: 'E',
  cards: [
    { seat: 'E', card: c('diamonds', '2') },
    { seat: 'S', card: c('diamonds', 'K') },
    { seat: 'W', card: c('diamonds', '7') },
    { seat: 'N', card: c('clubs', '4') },
  ],
  winner: 'S',
}

describe('rondgenomgång: rubriken', () => {
  it('kontrakt, bricka och zon', () => {
    const r = buildRondRapport(input({ deal: deal({ board: 12, vulnerability: 'ns' }) }))
    expect(r.rubrik.kontraktText).toBe('4♠ av dig')
    expect(r.rubrik.brickText).toBe('Bricka 12')
    expect(r.rubrik.zonText).toBe('NS i zon')
  })

  it('dubblat kontrakt och sang skrivs ut', () => {
    const r = buildRondRapport(
      input({ contract: { declarer: 'W', strain: 'NT', level: 3, doubled: 'X' } }),
    )
    expect(r.rubrik.kontraktText).toBe('3NT dubblat av Väst')
  })

  it('Nord som spelförare på NS-sidan är användarens kort', () => {
    const r = buildRondRapport(input({ contract: { declarer: 'N', strain: 'hearts', level: 4 } }))
    expect(r.rubrik.kontraktText).toBe('4♥ av Nord (dina kort)')
  })
})

describe('rondgenomgång: budgivningen', () => {
  it('varje bud får en icke-tom förklaring — även nakna pass utan regel', () => {
    const r = buildRondRapport(input())
    expect(r.budgivning).toHaveLength(6)
    for (const p of r.budgivning) expect(p.text.trim().length).toBeGreaterThan(0)
  })

  it('motorns egen förklaring används när budet bär en regel (säker tolkning)', () => {
    const r = buildRondRapport(input())
    const oppning = r.budgivning[2]
    expect(oppning.text).toBe('Öppning 1♠ — 12+ hp, 5+ spader.')
    expect(oppning.confidence).toBe('säker')
  })

  it('bara Syds bud är "du"', () => {
    const r = buildRondRapport(input())
    expect(r.budgivning.map((p) => p.du)).toEqual([false, false, true, false, false, false])
  })

  it('alertpliktig regel flaggas', () => {
    const calls: ResolvedCall[] = [
      { seat: 'N', bid: '1NT', rule: 'öppning 1NT', explanation: 'Balanserad, 15–17 hp.' },
      { seat: 'E', bid: 'P' },
      { seat: 'S', bid: '2C', rule: 'Stayman', explanation: 'Stayman — frågar efter högfärg.' },
      { seat: 'W', bid: 'P' },
    ]
    const r = buildRondRapport(input({ calls }))
    expect(r.budgivning.map((p) => p.alert)).toEqual([false, false, true, false])
  })
})

describe('rondgenomgång: spelföringen', () => {
  it('trumfstöld: rubrik + rader, med löpande ställning sist', () => {
    const r = buildRondRapport(input({ tricks: [TRICK_RUFF, TRICK_DISCARD] }))
    expect(r.spelforing).toHaveLength(2)

    const s1 = r.spelforing[0]
    expect(s1.index).toBe(1)
    expect(s1.rubrik).toBe('Stick 1 — Öst stal med 3♠')
    expect(s1.rader).toEqual([
      'Utspel 5♥ från Väst.',
      'Öst saknade hjärter och trumfade med 3♠.',
      'Ställning: NS 0 – ÖV 1.',
    ])

    const s2 = r.spelforing[1]
    expect(s2.rubrik).toBe('Stick 2 — du vann med K♦')
    expect(s2.rader).toEqual([
      'Utspel 2♦ från Öst.',
      'Nord (dina kort) sakade 4♣.',
      'Ställning: NS 1 – ÖV 1.',
    ])
  })

  it('max fyra rader per stick även när flera händer sakar', () => {
    const busy: Trick = {
      leader: 'W',
      cards: [
        { seat: 'W', card: c('hearts', 'K') },
        { seat: 'N', card: c('clubs', '2') },
        { seat: 'E', card: c('diamonds', '3') },
        { seat: 'S', card: c('clubs', '9') },
      ],
      winner: 'W',
    }
    const r = buildRondRapport(input({ tricks: [busy] }))
    expect(r.spelforing[0].rader.length).toBeLessThanOrEqual(4)
    // Ställningen får aldrig trängas bort.
    const rader = r.spelforing[0].rader
    expect(rader[rader.length - 1]).toBe('Ställning: NS 0 – ÖV 1.')
  })

  it('försvarsspel: Nord är "din partner" när ÖV spelför', () => {
    const trick: Trick = {
      leader: 'S',
      cards: [
        { seat: 'S', card: c('clubs', 'A') },
        { seat: 'W', card: c('clubs', '3') },
        { seat: 'N', card: c('hearts', '2') },
        { seat: 'E', card: c('clubs', '8') },
      ],
      winner: 'S',
    }
    const r = buildRondRapport(
      input({ contract: { declarer: 'E', strain: 'NT', level: 3 }, tricks: [trick] }),
    )
    expect(r.spelforing[0].rubrik).toBe('Stick 1 — du vann med A♣')
    expect(r.spelforing[0].rader).toContain('Nord (din partner) sakade 2♥.')
    expect(r.spelforing[0].rader[0]).toBe('Utspel A♣ från dig.')
  })

  it('botarnas kortmotiveringar mappas till rätt kort i sticket', () => {
    const botReasons = {
      hearts5: { seat: 'W' as Seat, reason: 'Utspel från längsta färgen.' },
      spades3: { seat: 'E' as Seat, reason: 'Renons i hjärter — trumfar in sticket.' },
      diamondsK: { seat: 'S' as Seat, reason: 'Hör inte hit — fel sits.' },
    }
    const r = buildRondRapport(input({ tricks: [TRICK_RUFF], botReasons }))
    expect(r.spelforing[0].botRadFor).toEqual({
      hearts5: 'Utspel från längsta färgen.',
      spades3: 'Renons i hjärter — trumfar in sticket.',
    })
  })
})

describe('rondgenomgång: utspelsregeln (§8.3)', () => {
  // Given behöver bara vara konsistent i utspelarens hand — resten kan vara tom.
  const spaderKontrakt: Contract = { declarer: 'S', strain: 'spades', level: 4 }
  const trickLett = (ledCard: Card, rest: [Seat, Card][]): Trick => ({
    leader: 'W',
    cards: [
      { seat: 'W', card: ledCard },
      ...rest.map(([seat, card]) => ({ seat, card })),
    ],
    winner: 'N',
  })

  it('topp av honnörssekvens namnges', () => {
    const d = deal({
      hands: {
        N: [], E: [], S: [],
        W: [c('hearts', 'K'), c('hearts', 'Q'), c('hearts', 'J'), c('hearts', '5'), c('clubs', '2')],
      },
    })
    const trick = trickLett(c('hearts', 'K'), [
      ['N', c('hearts', 'A')], ['E', c('hearts', '2')], ['S', c('hearts', '3')],
    ])
    const r = buildRondRapport(input({ deal: d, contract: spaderKontrakt, tricks: [trick] }))
    expect(r.spelforing[0].rader[0]).toBe(
      'Utspel K♥ från Väst — topp av honnörssekvens (§8.3).',
    )
  })

  it('3:e bästa från jämn längd namnges med längdbudskapet (motspelsutspel)', () => {
    const d = deal({
      hands: {
        N: [], E: [], S: [],
        W: [c('hearts', 'K'), c('hearts', 'J'), c('hearts', '7'), c('hearts', '5')],
      },
    })
    const trick = trickLett(c('hearts', '7'), [
      ['N', c('hearts', 'A')], ['E', c('hearts', '2')], ['S', c('hearts', '3')],
    ])
    const r = buildRondRapport(input({ deal: d, contract: spaderKontrakt, tricks: [trick] }))
    expect(r.spelforing[0].rader[0]).toBe(
      'Utspel 7♥ från Väst — 3:e bästa från jämn längd (§8.3), visar längden för partnern.',
    )
  })

  it('lägsta från udda längd och singelutspel namnges', () => {
    const udda = deal({
      hands: {
        N: [], E: [], S: [],
        W: [c('hearts', 'K'), c('hearts', 'J'), c('hearts', '7'), c('hearts', '5'), c('hearts', '2')],
      },
    })
    const r1 = buildRondRapport(
      input({
        deal: udda,
        contract: spaderKontrakt,
        tricks: [trickLett(c('hearts', '2'), [['N', c('hearts', 'A')], ['E', c('hearts', '3')], ['S', c('hearts', '4')]])],
      }),
    )
    expect(r1.spelforing[0].rader[0]).toBe(
      'Utspel 2♥ från Väst — lägsta från udda längd (§8.3), visar längden för partnern.',
    )

    const singel = deal({ hands: { N: [], E: [], S: [], W: [c('hearts', '5'), c('clubs', '2')] } })
    const r2 = buildRondRapport(
      input({
        deal: singel,
        contract: spaderKontrakt,
        tricks: [trickLett(c('hearts', '5'), [['N', c('hearts', 'A')], ['E', c('hearts', '3')], ['S', c('hearts', '4')]])],
      }),
    )
    expect(r2.spelforing[0].rader[0]).toBe('Utspel 5♥ från Väst — singelutspel.')
  })

  it('spelförarsidans utspel får INTE längdbudskapet (markeringen är försvarets)', () => {
    // Öst spelför → Väst är träkarl på spelförarsidan; 3:e-bästa-mönstret ska tigas.
    const d = deal({
      hands: {
        N: [], E: [], S: [],
        W: [c('hearts', 'K'), c('hearts', 'J'), c('hearts', '7'), c('hearts', '5')],
      },
    })
    const trick = trickLett(c('hearts', '7'), [
      ['N', c('hearts', 'A')], ['E', c('hearts', '2')], ['S', c('hearts', '3')],
    ])
    const r = buildRondRapport(
      input({ deal: d, contract: { declarer: 'E', strain: 'NT', level: 3 }, tricks: [trick] }),
    )
    expect(r.spelforing[0].rader[0]).toBe('Utspel 7♥ från Väst.')
  })

  it('okänd hand (fixtur utan kort) → ingen regel påstås', () => {
    const r = buildRondRapport(input({ tricks: [TRICK_RUFF] }))
    expect(r.spelforing[0].rader[0]).toBe('Utspel 5♥ från Väst.')
  })
})

describe('rondgenomgång: resultatet', () => {
  it('hemma exakt: beröm + poängrad', () => {
    const contract: Contract = { declarer: 'S', strain: 'spades', level: 4 }
    const r = buildRondRapport(
      input({
        contract,
        result: { declarerTricks: 10, needed: 10, made: true, diff: 0 },
        score: scoreLine(contract, 10, 'none'),
      }),
    )
    expect(r.resultat[0]).toEqual({ text: '4♠ av dig: 10 stick — hemma, exakt bud.', ton: 'berom' })
    expect(r.resultat.some((rad) => rad.text === 'Poäng: N/S +420.')).toBe(true)
  })

  it('övertrick räknas i klartext', () => {
    const r = buildRondRapport(
      input({ result: { declarerTricks: 11, needed: 10, made: true, diff: 1 } }),
    )
    expect(r.resultat[0].text).toBe('4♠ av dig: 11 stick — hemma med ett övertrick.')
    expect(r.resultat[0].ton).toBe('berom')
  })

  it('egen bet är en läxa', () => {
    const r = buildRondRapport(
      input({ result: { declarerTricks: 8, needed: 10, made: false, diff: -2 } }),
    )
    expect(r.resultat[0]).toEqual({ text: '4♠ av dig: 8 stick — 2 bet.', ton: 'laxa' })
  })

  it('motståndarnas bet är motspelets förtjänst — beröm', () => {
    const r = buildRondRapport(
      input({
        contract: { declarer: 'E', strain: 'hearts', level: 4 },
        result: { declarerTricks: 9, needed: 10, made: false, diff: -1 },
      }),
    )
    expect(r.resultat[0]).toEqual({ text: '4♥ av Öst: 9 stick — 1 bet.', ton: 'berom' })
  })

  it('motståndarna hemma är neutralt (utan facit vet vi inte om det gick att beta)', () => {
    const r = buildRondRapport(
      input({
        contract: { declarer: 'W', strain: 'NT', level: 3 },
        result: { declarerTricks: 10, needed: 9, made: true, diff: 1 },
      }),
    )
    expect(r.resultat[0].ton).toBe('neutral')
  })

  it('claim ger en egen rad och spelföringen slutar vid claimögonblicket', () => {
    const r = buildRondRapport(
      input({
        tricks: [TRICK_RUFF, TRICK_DISCARD],
        claimed: { total: 11, auto: false },
        result: { declarerTricks: 11, needed: 10, made: true, diff: 1 },
      }),
    )
    expect(r.spelforing).toHaveLength(2)
    expect(r.resultat.some((rad) => rad.text.includes('Claim godkänd efter stick 2'))).toBe(true)
  })

  it('auto claim namnges', () => {
    const r = buildRondRapport(
      input({
        tricks: [TRICK_RUFF],
        claimed: { total: 12, auto: true },
        result: { declarerTricks: 12, needed: 10, made: true, diff: 2 },
      }),
    )
    expect(r.resultat.some((rad) => rad.text.startsWith('Auto Claim'))).toBe(true)
  })
})

describe('rondgenomgång: hel seedad giv genom motorn', () => {
  it('bygger en komplett, välformad rapport av en riktig giv', () => {
    // Första fröet vars botauktion landar i ett kontrakt (deterministiskt).
    let found: { d: Deal; calls: ResolvedCall[]; contract: Contract } | null = null
    for (let seed = 1; seed <= 20 && !found; seed++) {
      const d = dealFromSeed(seed)
      const calls = botAuction(d)
      const contract = calls && contractFromCalls(calls)
      if (calls && contract) found = { d, calls, contract }
    }
    expect(found).not.toBeNull()
    const { d, calls, contract } = found!

    // Spela ut given deterministiskt: alltid första lagliga kortet.
    let st = startPlay(d, contract)
    while (!isComplete(st)) st = playCard(st, legalCards(st, st.toAct)[0])

    const result = contractResult(st)
    const r = buildRondRapport(
      input({
        deal: d,
        calls,
        contract,
        tricks: st.completedTricks,
        result,
        score: scoreLine(contract, result.declarerTricks, d.vulnerability),
      }),
    )

    expect(r.budgivning).toHaveLength(calls.length)
    for (const p of r.budgivning) expect(p.text.trim().length).toBeGreaterThan(0)

    expect(r.spelforing).toHaveLength(13)
    for (const s of r.spelforing) {
      expect(s.rubrik).toMatch(/^Stick \d+ — /)
      expect(s.rader.length).toBeGreaterThanOrEqual(2)
      expect(s.rader.length).toBeLessThanOrEqual(4)
    }
    // Sista ställningsraden stämmer med slutresultatet.
    const sista = r.spelforing[r.spelforing.length - 1].rader
    expect(sista[sista.length - 1]).toBe(`Ställning: NS ${st.tricksNS} – ÖV ${st.tricksEW}.`)

    expect(r.resultat.length).toBeGreaterThanOrEqual(2)
  })
})
