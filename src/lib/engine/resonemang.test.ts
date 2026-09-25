// Resonemangslagrets pass-spärr (urvalsprovet 2026-09-23, docs/sunt-fornuft-plan.md):
// ett bud väljs bara när det slår pass SÄKERT — skillnaden mot pass, parad hand för
// hand, ska vara större än PASS_MARGINAL standardfel. Annars är ledningen brus och
// tystnaden står kvar (1NT −63 mot pass −70 på 11 händer ska bli pass).
import { describe, expect, it } from 'vitest'
import type { Bid } from '../../types/bridge'
import { PASS_MARGINAL, valjMotPass, type Kandidat } from './resonemang'

const k = (bud: string, snitt: number, motPass?: { diff: number; se: number }): Kandidat =>
  ({ bud: bud as Bid, n: 20, snitt, se: 10, motPass })

describe('valjMotPass — ett bud måste slå pass säkert', () => {
  it('ledning inom bruset → pass', () => {
    const r = valjMotPass([k('1NT', -63, { diff: 7, se: 20 }), k('P', -70), k('X', -143, { diff: -73, se: 30 })])
    expect(r.val).toBe('P')
    expect(r.spärrad).toBe('1NT')
  })

  it('säker ledning → budet', () => {
    const r = valjMotPass([k('3NT', 378, { diff: 215, se: 40 }), k('P', 163)])
    expect(r.val).toBe('3NT')
    expect(r.spärrad).toBeUndefined()
  })

  it('gränsen är exakt PASS_MARGINAL standardfel', () => {
    const se = 10
    expect(valjMotPass([k('2S', 0, { diff: PASS_MARGINAL * se + 0.1, se }), k('P', 0)]).val).toBe('2S')
    expect(valjMotPass([k('2S', 0, { diff: PASS_MARGINAL * se, se }), k('P', 0)]).val).toBe('P')
  })

  it('bästa budet spärrat → det bästa budet som SÄKERT slår pass', () => {
    // X leder i snitt men ledningen mot pass är brus; 2H slår pass säkert.
    const r = valjMotPass([k('X', 50, { diff: 5, se: 30 }), k('2H', 45, { diff: 60, se: 10 }), k('P', -15)])
    expect(r.val).toBe('2H')
  })

  it('pass är bäst → pass', () => {
    expect(valjMotPass([k('P', 10), k('X', 5, { diff: -5, se: 3 })]).val).toBe('P')
  })

  it('tom lista → pass', () => {
    expect(valjMotPass([]).val).toBe('P')
  })
})

// Systemfiltret (ägarbeslut 2026-09-23): lagret provar bara bud som systemet tillåter
// med handen. Naturligt färgbud = 5+ kort i ALLA färger och den längsta färgen först;
// konventionella bud (Michaels, ovanlig 2NT, cue) är tabellens sak — lagret rör dem
// aldrig ("får inte störa andra konventioner"); XX = 10+ hp.
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import type { Seat } from '../../types/bridge'
import { sakraStick, systemKandidater } from './resonemang'

const auk = (s: string) => s.split(' ').map((c) => ({ seat: c[0], bid: c.slice(2) })) as ResolvedCall[]
const kand = (hand: string, history: string, me: Seat) => systemKandidater(parseHand(hand), auk(history), me)

describe('systemKandidater — regelboken som filter för det egna budet', () => {
  it('jämn 18 efter (1♦)–P–(1NT): inga fyrkortsfärger, ingen Michaels, ingen ovanlig 2NT — X kvar', () => {
    const k = kand('S:KQ82 H:A7 D:KQ5 C:A972', 'N:1D E:P S:1NT', 'W')
    expect(k).toContain('X')
    for (const b of ['2S', '2C', '2D', '2NT']) expect(k).not.toContain(b)
  })

  it('jämn 11 i balansering efter (1♣)–P–(1♥)–P–(1NT): inget 2♣ i deras färg, ingen fyrkorts-2♠', () => {
    const k = kand('S:A763 H:543 D:Q7 C:KQ64', 'W:1C N:P E:1H S:P W:1NT N:P E:P', 'S')
    for (const b of ['2C', '2S', '2H', '2NT']) expect(k).not.toContain(b)
  })

  it('fyrkortsfärg när det finns en längre färg → stryks (lång färg först)', () => {
    const k = kand('S:92 H:3 D:AQ95 C:AJ9875', 'N:2C', 'E')
    expect(k).not.toContain('2D')
  })

  it('6-5: den längre färgen bjuds, inte den kortare femkortsfärgen', () => {
    const k = kand('S:KQJ84 H:2 D:3 C:AQJ985', 'E:1H', 'S')
    expect(k).toContain('2C')
    expect(k).not.toContain('1S')
  })

  it('femkortsfärg som är längst → kvar', () => {
    const k = kand('S:J9874 H:A6 D:AK6 C:Q96', 'N:1NT', 'E')
    expect(k).toContain('2S')
  })

  it('höjning av partnerns färg med 3 kort → kvar', () => {
    const k = kand('S:K76 H:Q54 D:K843 C:J73', 'N:1H E:2C', 'S')
    expect(k).toContain('2H')
  })

  it('naturlig sang kräver jämn hand och håll i deras färger', () => {
    expect(kand('S:92 H:3 D:AQ95 C:AJ9875', 'N:2C', 'E')).not.toContain('2NT')
    expect(kand('S:JT4 H:AT D:J9872 C:Q87', 'W:P N:P E:1C S:1H W:X', 'N')).toContain('1NT')
    expect(kand('S:JT4 H:AT D:J9872 C:987', 'W:P N:P E:1C S:1H W:X', 'N')).not.toContain('1NT')
  })

  it('höjning av partnerns sang kräver inte jämn hand (4-1-4-4 accepterar 2NT-inviten)', () => {
    expect(kand('S:A987 H:Q D:A752 C:AQ42', 'N:1D E:P S:1H W:P N:1S E:P S:2NT W:P', 'N')).toContain('3NT')
  })

  it('upplysningsdubbling kräver högst 2 kort i varje färg de bjudit (ägarbeslut 2026-09-24)', () => {
    // Giv Syd, ingen i zonen: P P 1♦ P / P 1♥ P 2♥ / P P ? — Nord 12 hp, tre hjärter: "dubbel finns inte, jag vill bjuda ruter".
    const n = kand('S:K43 H:862 D:AKQ87 C:65', 'S:P W:P N:1D E:P S:P W:1H N:P E:2H S:P W:P', 'N')
    expect(n).not.toContain('X')
    expect(n).toContain('3D')
    // Giv Nord: 2♣ (stark) ? — Öst med sex klöver dubblar inte för upplysning.
    expect(kand('S:92 H:3 D:AQ95 C:AJ9875', 'N:2C', 'E')).not.toContain('X')
    // Kort i deras färg → X kvar.
    expect(kand('S:AJ76 H:2 D:KQ87 C:A965', 'W:1H', 'N')).toContain('X')
  })

  it('XX kräver 10+ hp', () => {
    expect(kand('S:JT4 H:AT D:J9872 C:Q87', 'W:P N:P E:1C S:1H W:X', 'N')).not.toContain('XX')
    expect(kand('S:KT4 H:AT D:AJ987 C:Q87', 'W:P N:P E:1C S:1H W:X', 'N')).toContain('XX')
  })
})

describe('sakraStick — försvarsstick som håller med tanke på fördelningen', () => {
  const h = parseHand
  it('AK i en färg där träkarlen är kort: 1 stick i färg, 2 i sang', () => {
    const jag = h('S:AK32 H:32 D:5432 C:432')
    const sf = h('S:QJ54 H:AKQJ4 D:AK C:65')
    const tr = h('S:6 H:T9876 D:QJ C:AKQJ9')
    expect(sakraStick(jag, sf, tr, 'hearts')).toBe(1)
    expect(sakraStick(jag, sf, tr, 'NT')).toBe(2)
  })

  it('AK i en färg där de är renons → 0 i färg', () => {
    const jag = h('S:AK32 H:32 D:5432 C:432')
    const sf = h('S:- H:AKQJ4 D:AKQ9 C:6543')
    const tr = h('S:QJ54 H:T9876 D:J6 C:AK')
    expect(sakraStick(jag, sf, tr, 'hearts')).toBe(0)
  })

  it('Qxx i trumf mot AK → 1 stick; Jxx mot AKQ → 0', () => {
    const sf = h('S:AK54 H:AKQ3 D:AK C:654')
    expect(sakraStick(h('S:Q32 H:5432 D:5432 C:32'), sf, h('S:T9876 H:- D:QJ C:AKQJT9'), 'spades')).toBe(1)
    expect(sakraStick(h('S:J32 H:5432 D:5432 C:32'), h('S:AKQ4 H:AKQ3 D:AK C:654'), h('S:T9876 H:- D:QJ C:AKQJT9'), 'spades')).toBe(0)
  })
})

// Standardläget (2026-09-24, tänkande bottar i tävlingen): ETT bestämt antal
// händer i stället för sekunder, fröet ur det boten vet, slumpen ur leken minus
// egen hand — samma läge ger samma bud på telefonen, servern och i natt-
// granskningen, och de verkliga dolda korten påverkar aldrig beslutet.
import type { Deal } from '../../types/bridge'
import { dealFromSeed } from './revisor'
import { hcp as hcpOf } from './hand'
import { resoneraBot, resonemangFro } from './resonemang'

describe('resoneraBot — deterministisk och ärlig', () => {
  // Billigt låtsas-orakel (ingen WASM i enhetstestet): stick ur parets hp.
  const P: Record<string, 'N' | 'E' | 'S' | 'W'> = { N: 'S', S: 'N', E: 'W', W: 'E' }
  const orakel = (d: Deal) => (decl: 'N' | 'E' | 'S' | 'W') => Math.min(13, Math.floor((hcpOf(d.hands[decl]) + hcpOf(d.hands[P[decl]])) / 3))
  const auk = (s: string) => s.split(' ').map((c) => ({ seat: c[0], bid: c.slice(2) })) as ResolvedCall[]
  const d0 = { ...dealFromSeed(20290770), dealer: 'S' as const }
  const h = auk('S:1C W:X N:XX E:1S S:P W:P')

  it('samma läge → samma bud och samma antal händer', () => {
    const a = resoneraBot(d0, h, 'N', orakel as never)
    const b = resoneraBot(d0, h, 'N', orakel as never)
    expect(a.val).toBe(b.val)
    expect(a.hander).toBe(b.hander)
    expect(a.forklaring).toBe(b.forklaring)
  })

  it('de dolda korten påverkar aldrig beslutet (Ö/S/V byter händer → samma bud)', () => {
    const bytt: Deal = { ...d0, hands: { ...d0.hands, E: d0.hands.W, W: d0.hands.S, S: d0.hands.E } }
    const a = resoneraBot(d0, h, 'N', orakel as never)
    const b = resoneraBot(bytt, h, 'N', orakel as never)
    expect(b.val).toBe(a.val)
    expect(b.forklaring).toBe(a.forklaring)
  })

  it('fröet beror bara på egen hand + auktionen (inte på giv-id)', () => {
    expect(resonemangFro({ ...d0, id: 'x' }, h, 'N')).toBe(resonemangFro({ ...d0, id: 'y' }, h, 'N'))
  })
})

import { budAvvikelser } from './tavlingsgranskning'

describe('budAvvikelser — nattgranskningens budkontroll', () => {
  const auk = (s: string) => s.split(' ').map((c) => ({ seat: c[0], bid: c.slice(2) })) as ResolvedCall[]
  const d = { ...dealFromSeed(20290770), dealer: 'S' as const }
  const h = auk('S:1C W:X N:XX E:1S S:P W:P N:2H E:P S:P W:P')
  it('motorns egna bud → inga avvikelser; Syd (människan) jämförs aldrig', () => {
    const motor = (_d: Deal, prefix: ResolvedCall[], seat: string) => h[prefix.length].bid && (seat === 'S' ? 'XX' : h[prefix.length].bid)
    expect(budAvvikelser(d, { history: h, plays: [] }, motor as never)).toEqual([])
  })
  it('ett botbud motorn inte hade bjudit → avvikelse', () => {
    const motor = (_d: Deal, prefix: ResolvedCall[]) => (prefix.length === 6 ? 'P' : h[prefix.length].bid)
    expect(budAvvikelser(d, { history: h, plays: [] }, motor as never)).toEqual(['bud 7 (N): bjöd 2H, motorn P'])
  })
})

describe('systemKandidater — konventionella bud mot deras 1NT (felrapport #83)', () => {
  // Nord ♠4 ♥QJ9764 ♦QT82 ♣92 över Västs 1NT: 2♥ är DONT (hjärter + spader) —
  // ett konventionellt bud handen inte har. Tänkande lagret bjöd ändå 2♥ som
  // "naturlig sexkortsfärg" (filtret kände bara Michaels/ovanlig/cue).
  it('2♥ över deras 1NT stryks (DONT = hjärter+spader); bara pass kvar', () => {
    const k = systemKandidater(parseHand('S:4 H:QJ9764 D:QT82 C:92'), auk('W:1NT'), 'N' as Seat)
    expect(k).not.toContain('2H')
    expect(k).not.toContain('2D')
    expect(k).toEqual(['P'])
  })
})
