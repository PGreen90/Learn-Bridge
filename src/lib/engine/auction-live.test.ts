import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { dealRandom } from './deal'
import { buildAuction } from './auction'
import { finalContract, turnsToCalls } from './auction-contract'
import {
  auctionComplete,
  contractFromCalls,
  decideCall,
  legalCalls,
  seatToAct,
} from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}

/** Bygger en giv ur fyra handtexter (zon/bricka spelar ingen roll här). */
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test',
    dealer,
    vulnerability: 'none',
    board: 1,
    hands: {
      N: parseHand(hands.N),
      E: parseHand(hands.E),
      S: parseHand(hands.S),
      W: parseHand(hands.W),
    },
  }
}

describe('seatToAct – vems tur det är', () => {
  it('går medurs från given', () => {
    expect(seatToAct('N', 0)).toBe('N')
    expect(seatToAct('N', 1)).toBe('E')
    expect(seatToAct('N', 2)).toBe('S')
    expect(seatToAct('N', 3)).toBe('W')
    expect(seatToAct('N', 4)).toBe('N')
    expect(seatToAct('E', 1)).toBe('S')
  })
})

describe('legalCalls – bridge-reglerna för tillåtna bud', () => {
  it('tom budgivning: pass + alla 35 kontraktsbud, inget X/XX', () => {
    const legal = legalCalls([], 'N')
    expect(legal).toContain('P')
    expect(legal).toContain('1C')
    expect(legal).toContain('7NT')
    expect(legal).not.toContain('X')
    expect(legal).not.toContain('XX')
    expect(legal.length).toBe(1 + 35)
  })

  it('bara bud högre än senaste kontraktsbudet är tillåtna', () => {
    const legal = legalCalls([call('N', '1NT')], 'E')
    expect(legal).not.toContain('1C')
    expect(legal).not.toContain('1NT')
    expect(legal).toContain('2C')
    expect(legal).toContain('7NT')
  })

  it('X tillåtet mot motståndarens bud, inte mot partnerns', () => {
    // N öppnar, S (partner) får inte dubbla; Ö (motståndare) får.
    expect(legalCalls([call('N', '1H')], 'S')).not.toContain('X')
    expect(legalCalls([call('N', '1H')], 'E')).toContain('X')
  })

  it('X inte tillåtet om bara pass följt men senaste icke-pass var partnerns bud', () => {
    // N 1H, Ö P → S (Nords partner) får inte dubbla Nords bud.
    expect(legalCalls([call('N', '1H'), call('E', 'P')], 'S')).not.toContain('X')
  })

  it('XX tillåtet efter motståndarens X, X inte längre', () => {
    // N 1H, Ö X → N/S får redubbla, inte dubbla igen.
    const legal = legalCalls([call('N', '1H'), call('E', 'X')], 'S')
    expect(legal).toContain('XX')
    expect(legal).not.toContain('X')
  })

  it('pass-i-mellanrum bryter inte dubbelrätten mot motståndarens bud', () => {
    // Ö 1S, S P, V P → N får fortfarande dubbla Östs 1S.
    const legal = legalCalls([call('E', '1S'), call('S', 'P'), call('W', 'P')], 'N')
    expect(legal).toContain('X')
  })
})

describe('auctionComplete – när budgivningen är slut', () => {
  it('färre än fyra bud → aldrig slut', () => {
    expect(auctionComplete([call('N', 'P'), call('E', 'P'), call('S', 'P')])).toBe(false)
  })

  it('fyra inledande pass → passat ut (slut)', () => {
    expect(
      auctionComplete([call('N', 'P'), call('E', 'P'), call('S', 'P'), call('W', 'P')]),
    ).toBe(true)
  })

  it('bud + tre pass → slut', () => {
    expect(
      auctionComplete([call('N', '1NT'), call('E', 'P'), call('S', 'P'), call('W', 'P')]),
    ).toBe(true)
  })

  it('bud + bara två pass → ännu öppen', () => {
    expect(
      auctionComplete([call('N', '1NT'), call('E', 'P'), call('S', 'P')]),
    ).toBe(false)
  })

  it('tre pass men inte i rad → öppen', () => {
    expect(
      auctionComplete([call('N', '1NT'), call('E', 'P'), call('S', '2C'), call('W', 'P'), call('N', 'P')]),
    ).toBe(false)
  })
})

describe('contractFromCalls – slutkontrakt ur en budföljd', () => {
  it('passat ut → null', () => {
    expect(
      contractFromCalls([call('N', 'P'), call('E', 'P'), call('S', 'P'), call('W', 'P')]),
    ).toBeNull()
  })

  it('1NT passat ut → 1NT av öppnaren', () => {
    const c = contractFromCalls([call('S', '1NT'), call('W', 'P'), call('N', 'P'), call('E', 'P')])
    expect(c).toEqual({ declarer: 'S', strain: 'NT', level: 1 })
  })

  it('spelförare = den som FÖRST nämnde slutfärgen', () => {
    // S 1C – N 1S – S 2S: spader ägs N/S, först nämnd av N.
    const c = contractFromCalls([
      call('S', '1C'), call('W', 'P'), call('N', '1S'), call('E', 'P'),
      call('S', '2S'), call('W', 'P'), call('N', 'P'), call('E', 'P'),
    ])
    expect(c).toEqual({ declarer: 'N', strain: 'spades', level: 2 })
  })

  it('inkliv: motståndaren spelar slutkontraktet', () => {
    const c = contractFromCalls([
      call('S', '1H'), call('W', '2D'), call('N', 'P'), call('E', 'P'), call('S', 'P'),
    ])
    expect(c).toEqual({ declarer: 'W', strain: 'diamonds', level: 2 })
  })

  // X/XX ska följa med in i slutkontraktet (poängräkningen kräver det).
  it('dubblat kontrakt: X följer med', () => {
    const c = contractFromCalls([
      call('S', '4H'), call('W', 'X'), call('N', 'P'), call('E', 'P'), call('S', 'P'),
    ])
    expect(c).toEqual({ declarer: 'S', strain: 'hearts', level: 4, doubled: 'X' })
  })

  it('redubblat kontrakt: XX följer med', () => {
    const c = contractFromCalls([
      call('S', '2S'), call('W', 'X'), call('N', 'XX'), call('E', 'P'), call('S', 'P'), call('W', 'P'),
    ])
    expect(c).toEqual({ declarer: 'S', strain: 'spades', level: 2, doubled: 'XX' })
  })

  it('nytt bud nollställer dubblingen: slutkontraktet är odubblat', () => {
    // 2H dubblas, men Öst flyr till 2S som passas ut → 2S ODUBBLAT.
    const c = contractFromCalls([
      call('N', '2H'), call('E', 'X'), call('S', 'P'), call('W', '2S'),
      call('N', 'P'), call('E', 'P'), call('S', 'P'),
    ])
    expect(c?.doubled).toBeUndefined()
    expect(c).toEqual({ declarer: 'W', strain: 'spades', level: 2 })
  })
})

// Känd gräns: vissa slamlinjer (Jacoby 2NT → cue → 1430 RKC) genererar i
// buildAuction två bud i rad från SAMMA plats (öppnarens cue hoppas över när
// hon saknar kontroll att visa). Det är ingen laglig medurs-auktion, så
// decideCall kan inte spela upp den bud för bud. ~0,25 % av färdiga auktioner.
// Fixas när slamverktygen kopplas in i den levande budlådan (egen punkt).
function isLegalMedurs(turns: { seat: Seat }[]): boolean {
  return turns.every((t, k) => k === 0 || t.seat !== turns[k - 1].seat)
}

// Spelar upp en hel budgivning genom att fråga decideCall plats för plats
// (precis som budlådan gör när alla tre datorplatser bjuder). Stannar när
// auktionen är slut eller efter en säkerhetsgräns.
function playOut(deal: Deal): ResolvedCall[] {
  const history: ResolvedCall[] = []
  for (let i = 0; i < 40; i++) {
    if (auctionComplete(history)) break
    const seat = seatToAct(deal.dealer, history.length)
    history.push(decideCall(deal, history, seat))
  }
  return history
}

describe('decideCall – bot-hjärnan återskapar motorns systemlinje', () => {
  it('varje bud är lagligt och ligger på rätt plats', () => {
    for (let i = 0; i < 200; i++) {
      const deal = dealRandom()
      const history: ResolvedCall[] = []
      for (let step = 0; step < 40 && !auctionComplete(history); step++) {
        const seat = seatToAct(deal.dealer, history.length)
        const c = decideCall(deal, history, seat)
        expect(c.seat).toBe(seat)
        expect(legalCalls(history, seat)).toContain(c.bid)
        history.push(c)
      }
      expect(auctionComplete(history)).toBe(true)
    }
  })

  it('kontraktet matchar buildAuctions slutkontrakt (när motorn budat klart)', () => {
    let checked = 0
    for (let i = 0; i < 300 && checked < 120; i++) {
      const deal = dealRandom()
      const built = buildAuction(deal)
      if (!built || built.open) continue // bara fullständiga linjer jämförs
      if (!isLegalMedurs(built.turns)) continue // hoppa över slam-quirken (se ovan)
      const expected = finalContract(built)
      if (!expected) continue
      const history = playOut(deal)
      expect(contractFromCalls(history)).toEqual(expected)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('budföljdens kontraktsbud = buildAuctions turer (samma linje)', () => {
    let checked = 0
    for (let i = 0; i < 300 && checked < 120; i++) {
      const deal = dealRandom()
      const built = buildAuction(deal)
      if (!built || built.open) continue
      if (!isLegalMedurs(built.turns)) continue // hoppa över slam-quirken (se ovan)
      const lineBids = turnsToCalls(built.turns, deal.dealer)
        .filter((c) => c.bid !== 'P')
        .map((c) => `${c.seat}:${c.bid}`)
      const playedBids = playOut(deal)
        .filter((c) => c.bid !== 'P')
        .map((c) => `${c.seat}:${c.bid}`)
      expect(playedBids).toEqual(lineBids)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  // Nord öppnar 1♣, Öst upplysningsdubblar. Väst (Östs partner) MÅSTE svara när
  // Syd passar – får inte passa take-out-dubbla bort kontraktet. (Buggen som
  // syntes i budlådan: Väst passade med 5-korts spader.)
  describe('svar på partnerns upplysningsdubbling', () => {
    const deal = dealOf('N', {
      N: 'S:A3 H:K3 D:K32 C:KQT432', // öppnar 1♣ (6-korts klöver, 15 hp)
      E: 'S:KQ32 H:KJ32 D:KJ32 C:3', // upplysningsdubbling av 1♣ (13 hp, kort klöver)
      S: 'S:765 H:Q765 D:Q65 C:765', // svag
      W: 'S:KQT98 H:432 D:432 C:32', // 5-korts spader, svag
    })

    it('Väst tvingas bjuda sin längsta färg när Syd passar', () => {
      const history = [call('N', '1C'), call('E', 'X'), call('S', 'P')]
      const c = decideCall(deal, history, 'W')
      expect(c.seat).toBe('W')
      expect(c.bid).toBe('1S') // längsta objudna färg, billigaste nivå
      expect(legalCalls(history, 'W')).toContain(c.bid)
    })

    it('Väst slipper svara (passar) om Syd själv bjuder över dubblingen', () => {
      const history = [call('N', '1C'), call('E', 'X'), call('S', '2C')]
      expect(decideCall(deal, history, 'W').bid).toBe('P')
    })

    it('en stark advancer (12+) cue-bjuder deras färg i stället', () => {
      const strong = dealOf('N', {
        N: 'S:A3 H:K3 D:K32 C:KQT432',
        E: 'S:KQ32 H:KJ32 D:KJ32 C:3',
        S: 'S:765 H:Q765 D:Q65 C:765',
        W: 'S:AKJ98 H:AK2 D:432 C:32', // 14 hp → cue 2♣ (utgångskrav)
      })
      const history = [call('N', '1C'), call('E', 'X'), call('S', 'P')]
      expect(decideCall(strong, history, 'W').bid).toBe('2C')
    })
  })

  // Pivotens kärna: när Syd bjuder utanför systemlinjen (off-book) ska
  // datorpartnern HÄNGA MED i stället för att passa – stöda partnerns färg vid
  // fit (graderat efter styrka), annars bjuda egen färg/sang. Syd är balanserad
  // 17 hp så motorns linje öppnar 1NT; vi matar in ett annat öppningsbud för Syd
  // för att tvinga fram divergensen.
  describe('off-book: datorpartnern svarar på Syds egna bud', () => {
    const base = {
      S: 'S:KQ4 H:AQ5 D:K843 C:QJ2', // 17 hp, balanserad → linjen säger 1NT
      W: 'S:865 H:J983 D:JT6 C:T54',
      E: 'S:T92 H:T76 D:AQ7 C:AK97',
    }
    const dealWithN = (n: string) => dealOf('S', { ...base, N: n })

    // ---- Steg 1: 3-korts fit för en öppnad högfärg räcker -------------------
    it('Nord höjer Syds off-book 1♠ till 2♠ med 3-korts fit (svag)', () => {
      const deal = dealWithN('S:A73 H:K642 D:952 C:863') // 7 hp, 3-korts spader
      const history = [call('S', '1S'), call('W', 'P')]
      const c = decideCall(deal, history, 'N')
      expect(c.bid).toBe('2S')
      expect(legalCalls(history, 'N')).toContain('2S')
    })

    // ---- Steg 2: styrkan styr höjningens nivå -------------------------------
    it('inbjudande styrka (11–12 stödpoäng) → hopp till 3♠', () => {
      const deal = dealWithN('S:KQ73 H:K65 D:Q92 C:83') // 10 hp + dubbleton → inbjudan
      expect(decideCall(deal, [call('S', '1S'), call('W', 'P')], 'N').bid).toBe('3S')
    })

    it('utgångsstyrka (13+ stödpoäng) → direkt till 4♠', () => {
      const deal = dealWithN('S:KQ73 H:AK5 D:K92 C:83') // 15 hp + fit → utgång
      expect(decideCall(deal, [call('S', '1S'), call('W', 'P')], 'N').bid).toBe('4S')
    })

    // ---- Steg 3: utan fit – egen färg eller sang ----------------------------
    it('utan fit men egen 4-färg på 1-läget → ny färg (1♥ över Syds 1♣)', () => {
      const deal = dealWithN('S:743 H:KQ65 D:KJ2 C:863') // 9 hp, 4-korts hjärter, 3 klöver
      expect(decideCall(deal, [call('S', '1C'), call('W', 'P')], 'N').bid).toBe('1H')
    })

    it('utan fit, balanserad utan billig färg → 1NT-svar', () => {
      const deal = dealWithN('S:A3 H:K642 D:9532 C:863') // 7 hp, balanserad, 2-korts spader
      expect(decideCall(deal, [call('S', '1S'), call('W', 'P')], 'N').bid).toBe('1NT')
    })

    it('för svag hand (<6 hp) passar fortfarande', () => {
      const deal = dealWithN('S:A3 H:8642 D:9532 C:863') // 4 hp
      expect(decideCall(deal, [call('S', '1S'), call('W', 'P')], 'N').bid).toBe('P')
    })

    // ---- Grenluckor (punkt 10b): lås 2-läges färg, 2NT och minor-utan-blast ----
    it('utan fit, egen färg på 2-läget kräver 12+ (2♣ över Syds 1♠)', () => {
      const deal = dealWithN('S:A2 H:K3 D:832 C:KQJ842') // 13 hp, 6 klöver, 2 spader
      expect(decideCall(deal, [call('S', '1S'), call('W', 'P')], 'N').bid).toBe('2C')
    })

    it('utan fit, balanserad 11–12 → 2NT (för svag för 2-läges färg)', () => {
      const deal = dealWithN('S:A2 H:KJ32 D:Q432 C:J83') // 11 hp balanserad, 2 spader
      expect(decideCall(deal, [call('S', '1S'), call('W', 'P')], 'N').bid).toBe('2NT')
    })

    it('minorfit blåses inte ut: 13+ med 5-korts ruter → 3♦, inte 5♦', () => {
      const deal = dealWithN('S:A2 H:K3 D:KQ982 C:Q832') // 14 hp, 5-korts ruterfit
      expect(decideCall(deal, [call('S', '1D'), call('W', 'P')], 'N').bid).toBe('3D')
    })

    it('motståndaren (Väst) lägger sig still – svarar inte på Syds bud', () => {
      // Väst är Syds motståndare, inte partner → inget svar, bara pass.
      const deal = dealWithN('S:A73 H:K642 D:952 C:863')
      expect(decideCall(deal, [call('S', '1S')], 'W').bid).toBe('P')
    })

    // ---- Säkerhet: on-book-auktioner är HELT oförändrade --------------------
    it('on-book budgivning är oförändrad (off-book-svaret triggar aldrig)', () => {
      for (let i = 0; i < 150; i++) {
        const d = dealRandom()
        const built = buildAuction(d)
        if (!built || built.open) continue
        if (!isLegalMedurs(built.turns)) continue
        const expected = finalContract(built)
        if (!expected) continue
        expect(contractFromCalls(playOut(d))).toEqual(expected)
      }
    })
  })

  // Straffdubbling (ägarbeslut 2026-07-04, poängarbetet): boten dubblar
  // motståndarnas höga färgkontrakt med trumfstack + styrka — men BARA när
  // X:et inte kan läsas som en konventionell dubbling (vår sida har redan
  // gjort två kontraktsbud) och kontraktet är på 3-läget eller högre.
  describe('straffdubbling i live-flödet', () => {
    // Väst öppnar 1♥, Öst höjer, Syd kliver (off-book) in i spader — och Väst
    // sitter med EK-tredje i spader + 13 hp: kontraktet ska betas → X.
    const base = dealOf('W', {
      W: 'S:AK5 H:KQJ94 D:752 C:83', // 13 hp, EK i deras spader = 2 säkra trumfstick
      N: 'S:432 H:82 D:QJT3 C:J972', // svag
      E: 'S:76 H:A763 D:K64 C:QT65', // hjärterhöjning
      S: 'S:QJT98 H:T5 D:A98 C:AK4', // Syds off-book spaderbud
    })

    it('Väst straffdubblar Syds 3♠ (EK i trumfen + 13 hp, vår sida har bjudit två gånger)', () => {
      const history = [call('W', '1H'), call('N', 'P'), call('E', '2H'), call('S', '3S')]
      const c = decideCall(base, history, 'W')
      expect(c.bid).toBe('X')
      expect(c.rule).toBe('straffdubbling')
    })

    it('utan trumfstick passar samma styrka i stället (ingen X)', () => {
      const noStack = dealOf('W', {
        W: 'S:542 H:KQJ94 D:KQ2 C:83', // 11 hp men NOLL trumfstick i spader
        N: 'S:AK3 H:82 D:JT73 C:J972',
        E: 'S:76 H:A763 D:654 C:QT65',
        S: 'S:QJT98 H:T5 D:A98 C:AK4',
      })
      const history = [call('W', '1H'), call('N', 'P'), call('E', '2H'), call('S', '3S')]
      expect(decideCall(noStack, history, 'W').bid).toBe('P')
    })

    it('låga delkontrakt straffdubblas inte (2♠ → pass)', () => {
      const history = [call('W', '1H'), call('N', 'P'), call('E', '2H'), call('S', '2S')]
      expect(decideCall(base, history, 'W').bid).not.toBe('X')
    })

    it('bara ETT eget kontraktsbud → ingen straffdubbling (X kunde läsas konventionellt)', () => {
      const history = [call('W', '1H'), call('N', 'P'), call('E', 'P'), call('S', '3S')]
      expect(decideCall(base, history, 'W').bid).not.toBe('X')
    })
  })

  // Off-book i KONKURRENS: när motståndarna också bjudit ska boten fortsätta
  // konkurrera i stället för att tystna. Vi matar in en störd budföljd (Syd
  // off-book 1♥, Väst inkliv 1♠) och kontrollerar att både partnern och
  // motståndarens advancer agerar vettigt.
  describe('off-book i konkurrens', () => {
    it('partnern höjer i konkurrens (Nord 2♥ med fit över Västs 1♠-inkliv)', () => {
      const deal = dealOf('S', {
        S: 'S:KQ4 H:AQ5 D:K843 C:QJ2', // 17 hp balanserad → linjen säger 1NT
        W: 'S:AJ984 H:A5 D:KQ5 C:72', // (inklivshand – matas in i historiken)
        N: 'S:A73 H:K642 D:Q52 C:83', // 9 hp, 4-korts hjärterstöd
        E: 'S:Q652 H:JT7 D:J96 C:T54',
      })
      const history = [call('S', '1H'), call('W', '1S')]
      const c = decideCall(deal, history, 'N')
      expect(c.bid).toBe('2H')
      expect(legalCalls(history, 'N')).toContain('2H')
    })

    it('motståndarens advancer konkurrerar (Öst höjer Västs 1♠ till 2♠)', () => {
      const deal = dealOf('S', {
        S: 'S:KQ4 H:AQ5 D:K843 C:QJ2',
        W: 'S:AJ98 H:A5 D:KQ75 C:72', // Väst klev in 1♠ (matas in)
        N: 'S:73 H:KJ6 D:J43 C:98542',
        E: 'S:KQ65 H:732 D:982 C:K63', // 8 hp, 4-korts spaderstöd för Väst
      })
      const history = [call('S', '1H'), call('W', '1S'), call('N', 'P')]
      const c = decideCall(deal, history, 'E')
      expect(c.bid).toBe('2S')
      expect(legalCalls(history, 'E')).toContain('2S')
    })

    it('öppen konkurrensauktion spelas ut lagligt och avslutas', () => {
      // En störd budföljd som linjen bara modellerar en rond av ska ändå nå ett
      // slut – boten ska aldrig fastna eller bjuda olagligt i fortsättningen.
      for (let i = 0; i < 200; i++) {
        const deal = dealRandom()
        const history: ResolvedCall[] = []
        for (let step = 0; step < 40 && !auctionComplete(history); step++) {
          const seat = seatToAct(deal.dealer, history.length)
          const c = decideCall(deal, history, seat)
          expect(legalCalls(history, seat)).toContain(c.bid)
          history.push(c)
        }
        expect(auctionComplete(history)).toBe(true)
      }
    })
  })

  // §7-försvaret in i budlådan: när auktionen gått off-book ska motståndarna
  // kunna KLIVA IN på riktigt (direkt sits) i stället för att tystna. Syd är
  // balanserad 17 hp → linjen öppnar 1NT; vi matar in ett annat öppningsbud för
  // Syd för att tvinga fram off-book, och kollar Västs aktion direkt över det.
  describe('off-book: motståndarna kliver in på riktigt (§7)', () => {
    const base = {
      S: 'S:KQ4 H:AQ5 D:K843 C:QJ2', // 17 hp balanserad → linjen säger 1NT
      N: 'S:T92 H:T76 D:752 C:T954', // svag, irrelevant här
    }
    const dealWithEW = (e: string, w: string) => dealOf('S', { ...base, E: e, W: w })

    it('Väst kliver in 1♠ över Syds off-book 1♥ med bra 5-korts färg', () => {
      const deal = dealWithEW(
        'S:73 H:KJ65 D:Q92 C:8643', // Öst – irrelevant, Väst agerar
        'S:KQJ85 H:43 D:KJ86 C:Q5', // 12 hp, 5-korts spader, kort klöver → inkliv 1♠ (ej X)
      )
      const history = [call('S', '1H')]
      const c = decideCall(deal, history, 'W')
      expect(c.bid).toBe('1S')
      expect(c.rule).toBe('enkelt inkliv')
      expect(legalCalls(history, 'W')).toContain('1S')
    })

    it('Väst upplysningsdubblar Syds off-book 1♥ med kort hjärter + öppningsstyrka', () => {
      const deal = dealWithEW(
        'S:73 H:Q865 D:T92 C:8643',
        'S:KQ54 H:3 D:KJ65 C:AJ72', // 14 hp, singel hjärter, stöd i övriga → X
      )
      const history = [call('S', '1H')]
      const c = decideCall(deal, history, 'W')
      expect(c.bid).toBe('X')
      expect(c.rule).toBe('upplysningsdubbling')
    })

    it('Väst passar med en svag hand (inget lämpligt inkliv)', () => {
      const deal = dealWithEW(
        'S:73 H:KJ65 D:Q92 C:8643',
        'S:865 H:J983 D:JT6 C:T54', // 1 hp → pass
      )
      expect(decideCall(deal, [call('S', '1H')], 'W').bid).toBe('P')
    })

    it('balansering (felrapport #5): i utpassningsläget kliver boten in med inklivshanden', () => {
      // Syd 1♥ (off-book), Väst pass, Nord pass → Öst sitter i balanseringssits
      // och får inte passa ut given med en klar §7-aktion på handen (här: kort
      // hjärter + stöd i övriga färger → upplysningsdubbling).
      const deal = dealWithEW(
        'S:KQJ85 H:43 D:KJ4 C:Q52', // 12 hp, kort i deras hjärter → X i balansering
        'S:73 H:KJ65 D:Q92 C:8643',
      )
      const history = [call('S', '1H'), call('W', 'P'), call('N', 'P')]
      const c = decideCall(deal, history, 'E')
      expect(c.bid).toBe('X')
      expect(c.rule).toBe('upplysningsdubbling')
    })

    it('ingen balansering med svag hand: given får passas ut', () => {
      const deal = dealWithEW(
        'S:86532 H:J98 D:JT6 C:T5', // 2 hp → inget inkliv ens i balansering
        'S:73 H:KJ65 D:Q92 C:8643',
      )
      const history = [call('S', '1H'), call('W', 'P'), call('N', 'P')]
      expect(decideCall(deal, history, 'E').bid).toBe('P')
    })
  })

  it('slam-quirken (två bud i rad, samma plats) är sällsynt – under 2 %', () => {
    let closed = 0
    let quirky = 0
    for (let i = 0; i < 4000; i++) {
      const built = buildAuction(dealRandom())
      if (!built || built.open) continue
      closed++
      if (!isLegalMedurs(built.turns)) quirky++
    }
    expect(quirky / closed).toBeLessThan(0.02)
  })
})

// Felrapport #2 (github.com/PGreen90/Learn-Bridge/issues/2): bricka 14,
// 1♣ (Ö) – 2♥ (S, svagt hoppinkliv) – X (V, negativ dubbling) – P – P – P.
// Ägarbeslut 2026-07-02: (1) Öst FÅR INTE passa partnerns negativa dubbling
// (rondkrav, §7.3 "öppnaren svarar som på en upplysningsdubbling") – med 4
// spader (som X:et visar) bjuder Öst 2♠. (2) Nord (inklivarens partner) höjer
// spärren till 3♥ med 3-korts stöd – partnerns hoppinkliv lovar 6+ kort.
describe('felrapport #2 – negativ dubbling måste besvaras + höj partnerns spärr', () => {
  const deal = dealOf('E', {
    N: 'S:K2 H:A62 D:KQ76 C:Q763',
    E: 'S:JT97 H:KJ D:53 C:AK852',
    S: 'S:A43 H:QT9875 D:T984 C:-',
    W: 'S:Q865 H:43 D:AJ2 C:JT94',
  })

  it('Öst svarar 2♠ på Västs negativa dubbling (rondkrav – pass förbjudet)', () => {
    const history = [call('E', '1C'), call('S', '2H'), call('W', 'X'), call('N', 'P')]
    const c = decideCall(deal, history, 'E')
    expect(c.bid).toBe('2S')
  })

  it('Nord höjer Syds svaga hoppinkliv till 3♥ med 3-korts stöd (spärrhöjning)', () => {
    const history = [call('E', '1C'), call('S', '2H'), call('W', 'X')]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('3H')
  })
})

// Felrapport #3 (github.com/PGreen90/Learn-Bridge/issues/3): bricka 1,
// 1♣ (N) – 1♥ (S) – 1♠ (N) – 2♦ (S = FJÄRDE FÄRG, utgångskrav §6.6) – och Nord
// PASSADE. Ett kravbud får aldrig passas: Nord svarar enligt §6.6-prioriteten
// (stöd i partnerns hf / extra längd / NT med stopp i fjärde färgen / höjning).
// Nords hand: inget hjärterstöd (singel), ingen 6-4/5-5, men ♦A = stopp → 2NT.
describe('felrapport #3 – fjärde färg är krav, öppnaren får inte passa', () => {
  const deal = dealOf('N', {
    N: 'S:AT95 H:T D:AT4 C:QT764',
    E: 'S:K7 H:J862 D:Q932 C:K92',
    S: 'S:J8 H:AQ954 D:J8 C:AJ85',
    W: 'S:Q6432 H:K73 D:K765 C:3',
  })

  it('1♣–1♥–1♠–2♦ (fjärde färg): Nord bjuder 2NT med ruterstopp', () => {
    const history = [
      call('N', '1C'), call('E', 'P'), call('S', '1H'), call('W', 'P'),
      call('N', '1S'), call('E', 'P'), call('S', '2D'), call('W', 'P'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('2NT')
  })
})

// Felrapport #5 (github.com/PGreen90/Learn-Bridge/issues/5): bricka 8,
// 1♦ (V) – P – P – och motorn ville att SYD (12 hp, ♥KQT952 sexkorts) skulle
// passa ut given: balansering i utpassningsläget fanns inte (linjen fyller
// motståndarsitsarna med pass). Efter Syds 1♥ passade dessutom Nord trots
// 4-korts hjärterstöd. Facit: Syd balanserar 1♥, Nord höjer till 2♥.
// (Nords direkta X över 1♦ med 10 hp platt är standardpass — ägarfråga i issuen.)
describe('felrapport #5 – balansering i utpassningsläget + höjning av inklivet', () => {
  const deal = dealOf('W', {
    N: 'S:A63 H:J643 D:J43 C:A83',
    E: 'S:T7542 H:87 D:A98 C:J52',
    S: 'S:QJ8 H:KQT952 D:Q2 C:QT',
    W: 'S:K9 H:A D:KT765 C:K9764',
  })

  it('1♦–P–P: Syd balanserar 1♥ (given får inte passas ut med ett klart inkliv)', () => {
    const history = [call('W', '1D'), call('N', 'P'), call('E', 'P')]
    const c = decideCall(deal, history, 'S')
    expect(c.bid).toBe('1H')
  })

  it('efter balanseringen höjer Nord till 2♥ med 4-korts stöd', () => {
    const history = [
      call('W', '1D'), call('N', 'P'), call('E', 'P'),
      call('S', '1H'), call('W', 'P'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('2H')
  })

  it('hela given bjuds av motorn till 2♥ av Syd', () => {
    const history: ResolvedCall[] = []
    for (let step = 0; step < 40 && !auctionComplete(history); step++) {
      const seat = seatToAct(deal.dealer, history.length)
      history.push(decideCall(deal, history, seat))
    }
    expect(history.map((c) => c.bid).join(' ')).toBe('1D P P 1H P 2H P P P')
  })
})

// Felrapport #7 (github.com/PGreen90/Learn-Bridge/issues/7): bricka 6,
// P – 1♣ (S) – 2♣ (V, Michaels = båda högfärgerna) – X (N) – P – P – P:
// auktionen dog och Väst spelade sitt EGET konstgjorda 2♣ dubblat med EN
// klöver på handen (4 bet). Två luckor:
//  (a) advancerns preferenssvar på tvåfärgsinklivet (§7.2, advanceTwoSuiter
//      fanns sedan FAS 10) var aldrig inkopplat i live-flödet — Öst ska ge
//      preferens 2♠ med 3-korts stöd även över dubblingen;
//  (b) tvåfärgshanden får ALDRIG passa ut sitt eget dubblade cue-bud: när
//      partnern inte visat preferens flyr Väst till sin längsta visade färg (2♥).
describe('felrapport #7 – Michaels-cue får aldrig passas ut dubblat', () => {
  const deal = dealOf('E', {
    N: 'S:K874 H:AQ7 D:K853 C:K8',
    E: 'S:Q93 H:84 D:QJ96 C:JT95',
    S: 'S:5 H:T6 D:AT72 C:AQ6432',
    W: 'S:AJT62 H:KJ9532 D:4 C:7',
  })

  it('Öst (advancer) ger preferens 2♠ med 3-korts stöd, även över X', () => {
    const history = [call('E', 'P'), call('S', '1C'), call('W', '2C'), call('N', 'X')]
    const c = decideCall(deal, history, 'E')
    expect(c.bid).toBe('2S')
  })

  it('kommer 2♣X tillbaka opreffat flyr Väst till längsta högfärgen: 2♥', () => {
    const history = [
      call('E', 'P'), call('S', '1C'), call('W', '2C'), call('N', 'X'),
      call('E', 'P'), call('S', 'P'),
    ]
    const c = decideCall(deal, history, 'W')
    expect(c.bid).toBe('2H')
  })
})

// Felrapport #9 (github.com/PGreen90/Learn-Bridge/issues/9): bricka 15,
// 1♦ (S) – 1♠ – X (N, negativ dubbling) – P – 2♥ – P – 4♥ – P – 4NT – och Nord
// PASSADE: 4NT spelades som kontrakt. Ägaren: "4NT skall vara essfråga RKC
// 1430 … odiskutabel essfråga." Hjärtern är överenskommen (båda har bjudit
// den) → 4NT är aldrig naturligt. Nord har 3 nyckelkort (♥E, ♥K, ♦E) → 5♦
// (0 eller 3 i 1430-schemat).
describe('felrapport #9 – 4NT med överenskommen trumf är essfråga (1430 RKC)', () => {
  const deal = dealOf('S', {
    N: 'S:Q9 H:AKJ4 D:AJ9 C:Q943',
    E: 'S:8532 H:T76 D:8 C:T8652',
    S: 'S:A6 H:Q953 D:KQT432 C:J',
    W: 'S:KJT74 H:82 D:765 C:AK7',
  })

  it('Nord svarar 5♦ (3 nyckelkort) på Syds 4NT – passar aldrig essfrågan', () => {
    const history = [
      call('S', '1D'), call('W', '1S'), call('N', 'X'), call('E', 'P'),
      call('S', '2H'), call('W', 'P'), call('N', '4H'), call('E', 'P'),
      call('S', '4NT'), call('W', 'P'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('5D')
  })
})

// Felrapport #11 (github.com/PGreen90/Learn-Bridge/issues/11): bricka 11,
// P (S) – 1♣ (V) – X (N) – 2♣ (Ö) – 3♣ (S) – P – P – P: Syds cue i
// motståndarnas klöver (appen förklarade det som Michaels: båda högfärgerna)
// PASSADES av Nord → 3♣ spelades i motståndarnas färg, 3 bet. Ett cue-bud i
// deras färg är konstgjort och får aldrig passas. Igenkänningen krävde
// (a) cue på exakt 2-läget och (b) bara pass mellan öppningen och cuet —
// här kom cuet på 3-läget (Öst höjde) efter Nords upplysningsdubbling.
// Nord föredrar spader (4 kort mot 3 hjärter) → 3♠.
describe('felrapport #11 – partnerns cue i motståndarnas färg får aldrig passas', () => {
  const deal = dealOf('S', {
    N: 'S:KJ53 H:K64 D:JT94 C:K4',
    E: 'S:- H:T73 D:AQ875 C:T9862',
    S: 'S:98642 H:AQ82 D:K62 C:5',
    W: 'S:AQT7 H:J95 D:3 C:AQJ73',
  })

  it('P–1♣–X–2♣–3♣–P: Nord ger preferens 3♠ (4-korts spader)', () => {
    const history = [
      call('S', 'P'), call('W', '1C'), call('N', 'X'), call('E', '2C'),
      call('S', '3C'), call('W', 'P'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('3S')
  })
})

// Felrapport #13 (github.com/PGreen90/Learn-Bridge/issues/13): bricka 16,
// P – 1NT (N) – P – 2♥ (S, Jacoby-transfer = 5+ spader) – P – 2♠ – P – 3NT
// (S, "välj utgång: pass med 2 spader, 4♠ med 3") – och Nord bjöd 4♥!
// Transferbudet 2♥ är KONSTGJORT (visar spader, säger inget om hjärter) men
// lästes som en naturlig hjärterfärg → Nord "stödde" till 4♥ på en
// 2-kortsfärg (3 bet). Nord har ♠K75 = 3-korts stöd → 4♠.
describe('felrapport #13 – öppnaren väljer utgång efter transfer + 3NT', () => {
  const deal = dealOf('W', {
    N: 'S:K75 H:AKT8 D:J98 C:A82',
    E: 'S:42 H:QJ652 D:K53 C:KT5',
    S: 'S:AQJT3 H:74 D:QT64 C:Q7',
    W: 'S:986 H:93 D:A72 C:J9643',
  })

  it('P–1NT–P–2♥–P–2♠–P–3NT–P: Nord bjuder 4♠ (3-korts stöd), aldrig 4♥', () => {
    const history = [
      call('W', 'P'), call('N', '1NT'), call('E', 'P'), call('S', '2H'),
      call('W', 'P'), call('N', '2S'), call('E', 'P'), call('S', '3NT'),
      call('W', 'P'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('4S')
  })
})

// Felrapport #10 (github.com/PGreen90/Learn-Bridge/issues/10): bricka 12,
// P (V) – 3♠ (N) – P – 4NT (S) – och Nord PASSADE: 4NT spelades som kontrakt
// (13 stick togs – lillslammen missades). Ägaren: "partner svarar inte på min
// 4NT essfråga, helt oacceptabelt." Här har bara NORD bjudit spader (spärren),
// så #9-vakten (trumf = färg BÅDA bjudit) slog inte till. Standardregeln:
// 4NT är essfråga även UTAN överenskommen trumf när sidans senaste naturliga
// bud var en FÄRG (kvantitativt bara över sang) – trumfen är den färgen.
// Nord har 1 nyckelkort (♠K) → 5♣ (1 eller 4 i 1430-schemat).
describe('felrapport #10 – 4NT på partnerns spärröppning är essfråga (RKC i spärrfärgen)', () => {
  const deal = dealOf('W', {
    N: 'S:KQ98732 H:7 D:- C:QT864',
    E: 'S:J65 H:AJ64 D:T9863 C:2',
    S: 'S:A H:T83 D:AQ4 C:AKJ753',
    W: 'S:T4 H:KQ952 D:KJ752 C:9',
  })

  it('P–3♠–P–4NT–P: Nord svarar 5♣ (1 nyckelkort) – passar aldrig essfrågan', () => {
    const history = [
      call('W', 'P'), call('N', '3S'), call('E', 'P'), call('S', '4NT'),
      call('W', 'P'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('5C')
  })

  it('följer Syd upp med 5NT (kungfrågan) svarar Nord 6♠ – ingen sidokung', () => {
    const history = [
      call('W', 'P'), call('N', '3S'), call('E', 'P'), call('S', '4NT'),
      call('W', 'P'), call('N', '5C'), call('E', 'P'), call('S', '5NT'),
      call('W', 'P'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('6S')
  })
})

// Felrapport #4 (github.com/PGreen90/Learn-Bridge/issues/4): bricka 6,
// P – 1♠ (S) – P – 2♦ (N, 2-över-1) – P – 3♣ (S) – P – och Nord PASSADE.
// Ägaren: "2 över 1 = game force, partner får inte passa – grundregel i hela
// systemet." Nord (14 hp, ♥QJ72 stoppade, inget spaderstöd, bara 3 klöver)
// fortsätter naturligt mot utgången: 3NT.
describe('felrapport #4 – 2-över-1 är utgångskrav, svararen får inte passa', () => {
  const deal = dealOf('E', {
    N: 'S:3 H:QJ72 D:AKQJ9 C:T76',
    E: 'S:AT84 H:KT3 D:762 C:A93',
    S: 'S:KQJ52 H:84 D:43 C:KQ84',
    W: 'S:976 H:A965 D:T85 C:J52',
  })

  it('P–1♠–P–2♦–P–3♣–P: Nord bjuder 3NT (hjärterstopp, utgångskravet fullföljs)', () => {
    const history = [
      call('E', 'P'), call('S', '1S'), call('W', 'P'), call('N', '2D'),
      call('E', 'P'), call('S', '3C'), call('W', 'P'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('3NT')
  })
})

// R1-fynd #3: off-book-lagret läste ett KONSTGJORT bud (Jacoby-kortfärg 3♣) som
// en naturlig klöverfärg när det letade trumf inför essfrågan. En Jacoby-2NT-fit
// sätter öppnarens HÖGFÄRG som trumf (systembok §6.1) – Nord ska svara RKC för
// hjärter (5♦ = 3 nyckelkort), inte för klöver (5♥ = 2 nyckelkort).
describe('R1-fynd #3 – Jacoby-2NT-fit sätter trumf inför off-book essfråga', () => {
  const deal = dealOf('N', {
    N: 'S:AQ2 H:AKJ43 D:Q432 C:5',   // 1♥, klöversingel → 3♣ (Jacoby-kortfärg)
    S: 'S:K54 H:Q1052 D:AK5 C:K43',  // Jacoby 2NT (4 hjärter, 15 hp)
    E: 'S:876 H:76 D:9876 C:9876',
    W: 'S:JT93 H:98 D:JT C:QJT82',
  })

  it('1♥–2NT–3♣–4NT: Nord svarar 5♦ (RKC hjärter, 3 nyckelkort), EJ 5♥', () => {
    const history = [
      call('N', '1H'), call('E', 'P'), call('S', '2NT'), call('W', 'P'),
      call('N', '3C'), call('E', 'P'), call('S', '4NT'), call('W', 'P'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('5D')
    expect(c.rule).toBe('1430 RKC')
  })
})

// R1-fynd #4 (testfläck): de "färdiga men oanropade" §7-konventionerna hade egna
// enhetstester men NÅDDES aldrig i en levande auktion. Delbit 1 kopplade in DONT
// mot deras 1NT; delbit 2 (nedan) kopplar in takeout/Lebensohl mot deras svaga
// tvåor/spärrar. Detta test låser kvarvarande DONT-golv-gräns (delbit 1).
describe('R1-fynd #4 – §7-golv (DONT delbit 1)', () => {
  it('under DONT-golvet: 6-hp-hand passar mot deras 1NT (sund standard, delbit 1)', () => {
    // Delbit 1 av Fynd #2 kopplade in DONT MEN med ägarens golv 8 hp (direkt).
    // En 6-hp-hand passar därför korrekt – detta låser den gränsen.
    const deal = dealOf('E', {
      E: 'S:A5 H:KQ4 D:Q432 C:KJ32',   // 15 hp balanserad → 1NT
      S: 'S:KQJ982 H:54 D:76 C:432',   // 6-korts spader ~6 hp < golvet
      N: 'S:73 H:9762 D:9854 C:965',
      W: 'S:T64 H:AJT3 D:AJT C:AQ8',
    })
    expect(buildAuction(deal)?.turns[0].call).toBe('1NT')
    expect(decideCall(deal, [call('E', '1NT')], 'S').bid).toBe('P') // under 8-hp-golvet
  })
})

// Fynd #2 delbit 2 – takeout/Lebensohl mot deras SVAGA TVÅOR (2♦/2♥/2♠) och
// SPÄRRAR (3-läget+), systembok §7.6, inkopplad i budlådan (`buildAuction`).
// Ägarbeslut 2026-07-04: upplysningsdubblingens golv = 12 hp ej sårbar / 13 hp
// sårbar i direkt sits, 10 hp i balansering (lättare, jfr DONT 8→6). Verktygen
// (defendWeakTwo/defendPreempt) fanns men nåddes aldrig – nu modelleras inklivet
// och svaret på ett takeout-X (level-medvetet, Fynd #5) bjuds levande.
describe('Fynd #2 delbit 2 – försvar mot deras svaga tvåor/spärrar', () => {
  it('direkt takeout-X mot svag 2♠ (17 hp, kort spader, stöd i övriga)', () => {
    const deal = dealOf('E', {
      E: 'S:KQ9832 H:54 D:K3 C:762',   // 6-korts spader ~8 hp → svag 2♠
      S: 'S:2 H:AKJ3 D:AQ84 C:KJ32',   // kort spader, 17 hp, stöd i övriga = takeout
      N: 'S:AJ765 H:Q62 D:95 C:A85',
      W: 'S:T4 H:T987 D:JT76 C:QT9',
    })
    expect(buildAuction(deal)?.turns[0].call).toBe('2S')
    expect(decideCall(deal, [call('E', '2S')], 'S')).toMatchObject({ bid: 'X', rule: 'upplysningsdubbling' })
  })

  it('direkt takeout-X mot svag 2♥ + advancern svarar på X:et (hela loopen)', () => {
    // Återanvänder Fynd #5-given: E öppnar svag 2♥, S har 19 hp takeout. Nu bjuder
    // boten X själv, och advancern (N) svarar tvunget på 2-läget (level-medvetet).
    const deal = dealOf('E', {
      E: 'S:5 H:KQ9832 D:K3 C:9762',   // svag 2♥
      S: 'S:AQ2 H:5 D:AQ84 C:AKJ3',    // kort hjärter, 19 hp → X (takeout)
      N: 'S:QJ92 H:64 D:8732 C:642',   // ~3 hp, 4 spader → tvingas svara 2♠
      W: 'S:KT8743 H:JT7 D:JT C:QT',
    })
    expect(decideCall(deal, [call('E', '2H')], 'S')).toMatchObject({ bid: 'X', rule: 'upplysningsdubbling' })
    expect(decideCall(deal, [call('E', '2H'), call('S', 'X'), call('W', 'P')], 'N').bid).toBe('2S')
  })

  it('sårbarhets-golvet: 12 hp dubblar ej sårbar men PASSAR sårbar (13 krävs)', () => {
    const hands = {
      E: 'S:KQ8543 H:Q2 D:765 C:43',   // svag 2♠
      S: 'S:76 H:K54 D:KJ83 C:AJ92',   // exakt 12 hp, 2-3-4-4, takeout-form
      N: 'S:AJT H:AJ98 D:QT4 C:K76',
      W: 'S:92 H:T763 D:A92 C:QT85',
    }
    const nonVul = dealOf('E', hands)                         // NS ej sårbar
    expect(buildAuction(nonVul)?.turns[0].call).toBe('2S')
    expect(decideCall(nonVul, [call('E', '2S')], 'S').bid).toBe('X') // 12 ≥ golv 12

    const vul: Deal = { ...dealOf('E', hands), vulnerability: 'ns' } // S sårbar
    expect(decideCall(vul, [call('E', '2S')], 'S').bid).toBe('P')    // 12 < golv 13 → pass
  })

  it('balansering: svag 2♥ passas runt, fjärde hand dubblar på 10 hp', () => {
    const deal = dealOf('E', {
      E: 'S:K5 H:AQ9832 D:764 C:98',   // svag 2♥
      S: 'S:QT9 H:KJ5 D:AJ3 C:KT76',   // 3 hjärter → ingen direkt aktion, passar
      W: 'S:7642 H:T4 D:QT85 C:AJ3',   // 7 hp, 2 hjärter → passar öppningen
      N: 'S:AJ83 H:76 D:K92 C:Q542',   // 10 hp, kort hjärter, stöd → balansering-X
    })
    expect(buildAuction(deal)?.turns[0].call).toBe('2H')
    const bid = decideCall(deal, [call('E', '2H'), call('S', 'P'), call('W', 'P')], 'N')
    expect(bid.bid).toBe('X')
  })

  it('direkt takeout-X mot deras spärr (3♦, 15 hp kort ruter)', () => {
    const deal = dealOf('E', {
      E: 'S:542 H:86 D:KQJ9832 C:7',   // 7-korts ruter ~6 hp → spärr 3♦
      S: 'S:AQ83 H:KJ92 D:5 C:AJ84',   // 15 hp, singel ruter, stöd = takeout
      N: 'S:KJT H:AQ7 D:AT7 C:K965',
      W: 'S:976 H:T543 D:64 C:QT32',
    })
    expect(buildAuction(deal)?.turns[0].call).toBe('3D')
    expect(decideCall(deal, [call('E', '3D')], 'S')).toMatchObject({ bid: 'X', rule: 'upplysningsdubbling' })
  })
})

// Fynd #2 delbit 4 – motståndaren stör VÅR icke-1-färgs-öppning, och svararen
// (öppnarens partner) måste svara i stället för att passa. Ägarbeslut 2026-07-04
// (väg A): appen skapar bara DONT-störning över vårt 1NT och takeout-X/inkliv
// över vår svaga tvåa/spärr – så bara det byggs (naturligt-1NT-inkliv och
// störning av vårt 2♣ modelleras aldrig → skulle bli död kod). Detta är
// integrationsfacit som bevisar att verktygen NÅS i en levande auktion.
describe('Fynd #2 delbit 4 – svar när motståndaren stör vår öppning', () => {
  it('vårt 1NT störs av DONT (2♥) → svararen dubblar (straff/värden)', () => {
    const deal = dealOf('S', {
      S: 'S:A83 H:K84 D:AQ76 C:K92',    // 16 hp, jämn → 1NT
      W: 'S:KJ64 H:AJ973 D:4 C:T65',    // 5-4 hjärter+spader, 9 hp → DONT 2♥
      N: 'S:Q92 H:Q2 D:KJ53 C:QJ84',    // 11 hp, ingen 5-färg → straff-X
      E: 'S:T75 H:T65 D:T982 C:A73',
    })
    expect(buildAuction(deal)?.turns[0].call).toBe('1NT')
    expect(buildAuction(deal)?.turns[1].call).toBe('2H') // DONT-störningen modelleras
    expect(decideCall(deal, [call('S', '1NT'), call('W', '2H')], 'N'))
      .toMatchObject({ bid: 'X', rule: 'straff/värden' })
  })

  it('vår svaga 2♠ störs av takeout-X → svararen redubblar (värden, 10+)', () => {
    const deal = dealOf('S', {
      S: 'S:KJ9863 H:54 D:K72 C:T5',    // 6-korts spader, 7 hp → svag 2♠
      W: 'S:2 H:KJ73 D:AQ85 C:KJ93',    // singel spader, 14 hp, stöd i övriga → takeout-X
      N: 'S:Q5 H:AQ6 D:JT94 C:Q874',    // 11 hp, 2 spader (ingen fit) → XX (värden)
      E: 'S:AT74 H:T982 D:63 C:A62',
    })
    expect(buildAuction(deal)?.turns[0].call).toBe('2S')
    expect(buildAuction(deal)?.turns[1].call).toBe('X') // takeout-störningen modelleras
    expect(decideCall(deal, [call('S', '2S'), call('W', 'X')], 'N'))
      .toMatchObject({ bid: 'XX', rule: 'redubbling (värden)' })
  })
})

// Fynd #2 delbit 5 – FORTSÄTTNING bortom en konkurrensrond (Case A): efter att vi
// öppnat 1NT, motståndaren stört med DONT-X och partnern REDUBBLAT (XX = värden),
// äger vår sida handen (15–17 + 8+ = 23+, majoriteten). Flyr motståndarna undan
// XX:et till en färg ska vår sida STRAFFDUBBLA dem – varje steg – i stället för
// att låta dem smita undubblat. Idag passar öppnaren flykten (auktionen dör efter
// att XX-detektorn svarat en gång). Ägarbeslut 2026-07-04 (Case A).
describe('Fynd #2 delbit 5 – straffdubbla flykten efter vår XX (Case A)', () => {
  // Syd 1NT (16, jämn) · Väst DONT-X (6-korts hjärter enfärg, 9 hp) · Nord XX
  // (9 hp, ingen 5-färg → värden) · Öst flyr (2♣-relä) → Syd ska X (straff).
  const deal = dealOf('S', {
    S: 'S:A83 H:K84 D:AQ76 C:K92',   // 16 hp, jämn → 1NT
    W: 'S:4 H:KQJ962 D:K83 C:975',   // 6-korts hjärter enfärg, 9 hp → DONT X
    N: 'S:Q92 H:52 D:KJ53 C:QJ84',   // 9 hp, ingen 5-färg → XX (värden)
    E: 'S:KJT765 H:73 D:942 C:A6',
  })

  it('förutsättning: XX är reachable (buildAuction modellerar DONT-X, Nord XX:ar)', () => {
    expect(buildAuction(deal)?.turns[0].call).toBe('1NT')
    expect(buildAuction(deal)?.turns[1].call).toBe('X') // DONT-enfärg modelleras
    expect(decideCall(deal, [call('S', '1NT'), call('W', 'X')], 'N'))
      .toMatchObject({ bid: 'XX', rule: 'straff/värden' })
  })

  it('Syd (öppnaren) straffdubblar deras flykt: 1NT–(X)–XX–(2♣) → X', () => {
    const history = [call('S', '1NT'), call('W', 'X'), call('N', 'XX'), call('E', '2C')]
    const c = decideCall(deal, history, 'S')
    expect(c.bid).toBe('X')
    expect(c.rule).toBe('straffdubbling (vi äger handen)')
  })

  it('vi jagar dem: rättar de sig (2♥) dubblar Nord vidare', () => {
    const history = [
      call('S', '1NT'), call('W', 'X'), call('N', 'XX'),
      call('E', '2C'), call('S', 'X'), call('W', '2H'),
    ]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('X')
    expect(c.rule).toBe('straffdubbling (vi äger handen)')
  })

  it('säkerhet: utan vår XX fyras inte straffregeln (ingen redubbling = ingen "äger handen")', () => {
    // Vårt 1NT störs av DONT-2♥ (tvåfärg), Nord svarar naturligt/pass (INGEN XX).
    // Flyr de vidare får straff-regeln INTE utlösas – vi har inte visat ägande.
    const history = [call('S', '1NT'), call('W', '2H'), call('N', 'P'), call('E', 'P')]
    const c = decideCall(deal, history, 'S')
    expect(c.rule).not.toBe('straffdubbling (vi äger handen)')
  })
})

// R1-fynd #5: answerTakeoutDouble antog att motståndarnas öppning låg på
// 1-läget. När Syd (människan) upplysningsdubblar en SVAG TVÅA måste Nord svara
// på 2-/3-läget – men motorn räknade fram 1-lägesbud (t.ex. 1♠), som är olagliga
// över 2♥, varpå anroparens laglighetsvakt släppte budet och Nord PASSADE bort
// partnerns rondkrav. Facit: Nord bjuder sin bästa färg på lägsta lagliga nivå.
describe('R1-fynd #5 – svar på takeout-X av en svag tvåa (ej 1-lägesantagande)', () => {
  const deal = dealOf('E', {
    E: 'S:5 H:KQ9832 D:K3 C:9762',   // 6-korts hjärter ~8 hp → svag 2♥
    S: 'S:AQ2 H:5 D:AQ84 C:AKJ3',    // kort hjärter, 19 hp, stöd i övriga → X (takeout)
    N: 'S:QJ92 H:64 D:8732 C:642',   // ~3 hp, 4 spader → tvingas svara 2♠
    W: 'S:KT8743 H:JT7 D:JT C:QT',
  })

  it('E 2♥ – (S X) – (W P) – N 2♠ (tvunget svar, EJ pass)', () => {
    const history = [call('E', '2H'), call('S', 'X'), call('W', 'P')]
    expect(buildAuction(deal)?.turns[0].call).toBe('2H') // förutsättning: svag 2♥
    const c = decideCall(deal, history, 'N')
    expect(c.bid).toBe('2S')
  })
})

// Fynd #2 delbit 1 – DONT mot deras 1NT (systembok §7.5) inkopplad i budlådan.
// Ägarbeslut 2026-07-04: golv 8 hp direkt / 6 hp balansering + rätt form.
describe('Fynd #2 delbit 1 – DONT mot deras 1NT', () => {
  it('direkt tvåfärg: E 1NT – S 2♥ (5-4 hjärter/spader), advancern passar', () => {
    const deal = dealOf('E', {
      E: 'S:A5 H:KQ4 D:Q432 C:KJ32',   // 15 → 1NT
      S: 'S:KQ1098 H:KJ32 D:5 C:432',  // 5-4 S/H, 11 hp → 2♥ (lägre färgen visar ♥+♠)
      W: 'S:J43 H:9876 D:AJ76 C:AQ',
      N: 'S:762 H:A5 D:KT98 C:T985',
    })
    expect(decideCall(deal, [call('E', '1NT')], 'S')).toMatchObject({ bid: '2H', rule: 'DONT tvåfärg' })
    expect(decideCall(deal, [call('E', '1NT'), call('S', '2H'), call('W', 'P')], 'N').bid).toBe('P')
  })

  it('direkt enfärg: E 1NT – S X – (P) – N 2♣ (relä) – (P) – S 2♥ (rättelse)', () => {
    const deal = dealOf('E', {
      E: 'S:A5 H:KQ4 D:Q432 C:KJ32',   // 15 → 1NT
      S: 'S:3 H:AKJ1098 D:K32 C:432',  // 6-korts hjärter ~12 hp → X (enfärg)
      W: 'S:KT8742 H:762 D:J54 C:7',
      N: 'S:QJ96 H:5 D:T98 C:T9865',
    })
    expect(decideCall(deal, [call('E', '1NT')], 'S')).toMatchObject({ bid: 'X', rule: 'DONT X (enfärg)' })
    expect(decideCall(deal, [call('E', '1NT'), call('S', 'X'), call('W', 'P')], 'N').bid).toBe('2C')
    const corr = decideCall(deal, [call('E', '1NT'), call('S', 'X'), call('W', 'P'), call('N', '2C'), call('E', 'P')], 'S')
    expect(corr).toMatchObject({ bid: '2H', rule: 'DONT: rättelse' })
  })

  it('balansering: E 1NT – (P) – (P) – N 2♥ (golv 6 hp)', () => {
    const deal = dealOf('E', {
      E: 'S:A5 H:KQ4 D:Q432 C:KJ32',   // 15 → 1NT
      S: 'S:7432 H:876 D:765 C:765',   // 0 hp → pass
      W: 'S:Q73 H:J8 D:T9842 C:J43',   // 5 hp, ingen 4-hf → pass
      N: 'S:KQ1098 H:KJ32 D:5 C:432',  // 11 hp 5-4 → balansering-DONT 2♥
    })
    const bid = decideCall(deal, [call('E', '1NT'), call('S', 'P'), call('W', 'P')], 'N')
    expect(bid.bid).toBe('2H')
    expect(bid.explanation).toContain('balansering')
  })
})
