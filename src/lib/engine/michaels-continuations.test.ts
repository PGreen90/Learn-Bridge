// MICHAELS-FORTSÄTTNINGEN (ägarens live-fynd 2026-09-22, tävlingsbricka 4 —
// (1♦)–P–P–2♦–P–2♠–P och motorn ville bjuda 4♠ på 15 hp mot en tvingad
// preferens som kan vara 0 poäng). Struktur: bridgebum.com/michaels.php +
// ägarens besked samma dag:
//   • Advancern: 2♥/2♠ = avslut (kan ha 0; lika längd → den billigare färgen),
//     cue i deras färg = 8+ hp med 3+ stöd i en högfärg (krav), hopp 3M = spärr
//     med fyrkorts stöd, 3NT = avslut. Michaels visar ALLTID de två högsta
//     objudna färgerna (över en högfärg = andra högfärgen + RUTER; ovanlig 2NT
//     tar de två lägsta) — ingen 2NT-fråga, inget pass-eller-rätta.
//   • Inklivaren efter avslutet: t.o.m. 14 hp pass · 15–17 inbjudan 3M · 18+ 4M.
//   • Advancern på inbjudan: 8+ hp → 4M.
//   • Inklivaren efter cuen: t.o.m. 10 hp billigaste färgen på lägsta nivå (3♥);
//     11+ = utgångskrav: 3♠, eller 4M med sexkorts högfärg.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid } as ResolvedCall)
const TOM = 'S:- H:- D:- C:-'
/** Öst öppnar, Syd kliver in, Nord är advancer. */
const giv = (S: string, N: string): Deal =>
  ({ id: 't', board: 1, dealer: 'E', vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand(TOM), S: parseHand(S), W: parseHand(TOM) } } as Deal)

const MICHAELS_15 = 'S:K9532 H:AQJ63 D:Q4 C:K' // ägarens hand, 15 hp
const START = [call('E', '1D'), call('S', '2D'), call('W', 'P')]

describe('advancern över Michaels i lågfärg (båda högfärgerna)', () => {
  const adv = (N: string) => decideCall(giv(MICHAELS_15, N), START, 'N')

  it('svag hand → billigaste preferens = avslut', () => {
    expect(adv('S:T82 H:94 D:J8762 C:Q53')).toMatchObject({ bid: '2S', rule: 'advance tvåfärg (preferens)' })
  })
  it('lika längd i högfärgerna → den BILLIGARE (hjärter), bridgebum', () => {
    expect(adv('S:T82 H:943 D:J872 C:Q53').bid).toBe('2H')
  })
  it('8+ hp och trekorts stöd i en högfärg → cue 3♦ (utgångsintresse, krav)', () => {
    expect(adv('S:QT8 H:94 D:A8762 C:K53')).toMatchObject({ bid: '3D', rule: 'advance Michaels: cue (utgångsintresse)' })
  })
  it('under 8 hp med fyrkorts stöd → spärrhopp 3♠', () => {
    expect(adv('S:QT82 H:94 D:J872 C:953')).toMatchObject({ bid: '3S', rule: 'advance Michaels: spärrhöjning' })
  })
  it('8+ hp men ingen trekorts högfärg → vanlig preferens (cuen kräver stöd)', () => {
    expect(adv('S:T8 H:94 D:KJ762 C:KJ53').bid).toBe('2H')
  })
  it('stark jämn hand utan högfärgsstöd, stopp i deras färg → 3NT (avslut)', () => {
    expect(adv('S:K8 H:94 D:AQJ2 C:AQ953')).toMatchObject({ bid: '3NT', rule: 'advance Michaels: 3NT' })
  })
})

describe('inklivaren efter partnerns avslut (tvingad preferens, kan vara 0 poäng)', () => {
  const BALANS = [call('W', '1D'), call('N', 'P'), call('E', 'P'), call('S', '2D'), call('W', 'P'), call('N', '2S'), call('E', 'P')]
  const DIREKT = [...START, call('N', '2S'), call('E', 'P')]
  const ink = (S: string, h: ResolvedCall[]) => decideCall(giv(S, TOM), h, 'S')

  it('BRICKAN: 15 hp → 3♠ inbjudan, inte 4♠', () => {
    expect(ink(MICHAELS_15, BALANS)).toMatchObject({ bid: '3S', rule: 'Michaels: inbjudan' })
    expect(ink(MICHAELS_15, DIREKT).bid).toBe('3S')
  })
  it('11 hp och 14 hp → pass', () => {
    expect(ink('S:K9532 H:AJ763 D:84 C:K', DIREKT)).toMatchObject({ bid: 'P', rule: 'Michaels: passar avslutet' })
    expect(ink('S:K9532 H:AQJ63 D:J4 C:K', DIREKT).bid).toBe('P')
  })
  it('18+ hp → 4♠', () => {
    expect(ink('S:AK932 H:AQJ63 D:4 C:A2', DIREKT)).toMatchObject({ bid: '4S', rule: 'Michaels: utgång' })
  })
  it('17 hp → fortfarande inbjudan', () => {
    expect(ink('S:AK932 H:AQJ63 D:84 C:K', DIREKT).bid).toBe('3S')
  })
})

describe('advancern på inbjudan efter eget avslut', () => {
  const h = [...START, call('N', '2S'), call('E', 'P'), call('S', '3S'), call('W', 'P')]
  it('8+ hp → 4♠ · under 8 → pass', () => {
    expect(decideCall(giv(MICHAELS_15, 'S:T8 H:94 D:KJ762 C:KJ53'), h, 'N')).toMatchObject({ bid: '4S', rule: 'Michaels: accepterar inbjudan' })
    expect(decideCall(giv(MICHAELS_15, 'S:T82 H:94 D:J8762 C:Q53'), h, 'N').bid).toBe('P')
  })
})

describe('efter advancerns cue', () => {
  const CUE = [...START, call('N', '3D'), call('E', 'P')]
  const ink = (S: string) => decideCall(giv(S, TOM), CUE, 'S')

  it('inklivaren t.o.m. 10 hp → billigaste färgen på lägsta nivå (3♥)', () => {
    expect(ink('S:K9532 H:QJ763 D:84 C:K')).toMatchObject({ bid: '3H', rule: 'Michaels: svag efter cue' })
  })
  it('inklivaren 11+ → 3♠ (utgångskrav) · med sexkorts högfärg → 4 i den', () => {
    expect(ink(MICHAELS_15)).toMatchObject({ bid: '3S', rule: 'Michaels: stark efter cue' })
    expect(ink('S:K9532 H:AQJ863 D:4 C:K').bid).toBe('4H')
  })

  const efter = (N: string, svar: string) =>
    decideCall(giv(MICHAELS_15, N), [...CUE, call('S', svar), call('W', 'P')], 'N')
  it('advancern mot SVAGT svar 3♥: 8–11 stannar i sin fit · 12+ bjuder utgång', () => {
    expect(efter('S:QT8 H:94 D:A8762 C:K53', '3H').bid).toBe('3S') // fit i spader, 9 hp
    expect(efter('S:T8 H:Q94 D:A8762 C:K53', '3H').bid).toBe('P') // fit i hjärter, 9 hp
    expect(efter('S:QT8 H:94 D:A8762 C:AK3', '3H').bid).toBe('4S') // 13 hp
  })
  it('advancern mot STARKT svar 3♠: utgång i sin fit', () => {
    expect(efter('S:T8 H:Q94 D:A8762 C:K53', '3S').bid).toBe('4H')
    expect(efter('S:QT8 H:94 D:A8762 C:K53', '3S').bid).toBe('4S')
  })
})

describe('inklivaren efter spärrhoppet och 3NT', () => {
  const ink = (S: string, adv: string) => decideCall(giv(S, TOM), [...START, call('N', adv), call('E', 'P')], 'S')
  it('spärrhopp 3♠: 15 hp passar · 16+ bjuder 4♠', () => {
    expect(ink(MICHAELS_15, '3S').bid).toBe('P')
    expect(ink('S:AK932 H:AQJ63 D:K4 C:4', '3S').bid).toBe('4S')
  })
  it('3NT = avslut → pass', () => {
    expect(ink(MICHAELS_15, '3NT').bid).toBe('P')
  })
})

describe('Michaels över HÖGFÄRG = andra högfärgen + RUTER (de två högsta objudna, ägarbeslut 2026-09-22)', () => {
  const H = [call('E', '1H'), call('S', '2H'), call('W', 'P')]
  const SYD = 'S:KJ953 H:4 D:AQ862 C:93' // spader + ruter
  it('inklivet: spader + ruter över 1♥ → Michaels · spader + KLÖVER → inte Michaels', () => {
    expect(decideCall(giv(SYD, TOM), [call('E', '1H')], 'S')).toMatchObject({ bid: '2H', rule: 'Michaels' })
    expect(decideCall(giv('S:KJ953 H:4 D:93 C:AQ862', TOM), [call('E', '1H')], 'S').bid).not.toBe('2H')
  })
  it('hjärter + ruter över 1♠ → Michaels 2♠', () => {
    expect(decideCall(giv('S:4 H:KJ953 D:AQ862 C:93', TOM), [call('E', '1S')], 'S')).toMatchObject({ bid: '2S', rule: 'Michaels' })
  })
  it('advancern utan spaderstöd → preferens 3♦ (ingen 2NT-fråga) · inklivaren passar', () => {
    expect(decideCall(giv(SYD, 'S:T8 H:J943 D:K72 C:Q853'), H, 'N')).toMatchObject({ bid: '3D', rule: 'advance tvåfärg (preferens)' })
    expect(decideCall(giv(SYD, TOM), [...H, call('N', '3D'), call('E', 'P')], 'S').bid).toBe('P')
  })
  it('med spaderstöd → 2♠ avslut, och inklivaren inbjuder med 15–17', () => {
    expect(decideCall(giv(SYD, 'S:T82 H:J943 D:K7 C:Q853'), H, 'N').bid).toBe('2S')
    const stark = 'S:AKJ53 H:4 D:AQ862 C:K3' // 17 hp
    expect(decideCall(giv(stark, TOM), [...H, call('N', '2S'), call('E', 'P')], 'S').bid).toBe('3S')
  })
  it('budförklaringen av cuen namnger båda färgerna', () => {
    expect(meaningOf([call('E', '1H'), call('S', '2H')], 1).text).toMatch(/spader och ruter/)
  })
})

describe('advancerns EGEN sexkortsfärg (ägarbeslut 2026-09-22): bara med högst ETT kort i BÅDA Michaels-färgerna', () => {
  it('(1♦)–2♦: 1-1 i högfärgerna och sex klöver → 3♣ · inklivaren passar', () => {
    expect(decideCall(giv(MICHAELS_15, 'S:8 H:4 D:J872 C:KQJ953'), START, 'N')).toMatchObject({ bid: '3C', rule: 'advance Michaels: egen färg' })
    expect(decideCall(giv(MICHAELS_15, TOM), [...START, call('N', '3C'), call('E', 'P')], 'S').bid).toBe('P')
  })
  it('(1♣)–2♣: egen ruterfärg ryms på 2-läget → 2♦', () => {
    const h = [call('E', '1C'), call('S', '2C'), call('W', 'P')]
    expect(decideCall(giv(MICHAELS_15, 'S:8 H:4 D:KQJ953 C:J872'), h, 'N')).toMatchObject({ bid: '2D', rule: 'advance Michaels: egen färg' })
  })
  it('sex klöver men TVÅ kort i en Michaels-färg → vanlig preferens, inte egen färg', () => {
    expect(decideCall(giv(MICHAELS_15, 'S:82 H:4 D:J87 C:KQJ953'), START, 'N').bid).toBe('2S')
  })
  it('Michaels över högfärg (spader + ruter): 1-1 och sex klöver → 3♣', () => {
    const h = [call('E', '1H'), call('S', '2H'), call('W', 'P')]
    expect(decideCall(giv('S:KJ953 H:4 D:AQ862 C:93', 'S:8 H:J9432 D:4 C:KQJ953'), h, 'N')).toMatchObject({ bid: '3C', rule: 'advance Michaels: egen färg' })
  })
  it('budförklaringen: egen färg, inte preferens', () => {
    expect(meaningOf([...START, call('N', '3C')], 3)).toMatchObject({ rule: 'advance Michaels: egen färg' })
  })
})

describe('slamutredningen är systems on (ingen Michaels-special): den vanliga konkurrens-slamraden tar över', () => {
  const h = [...START, call('N', '3D'), call('E', 'P'), call('S', '3S'), call('W', 'P')]
  it('stark kapten med första-rondskontroll i alla sidofärger + spaderfit → 4NT (vanliga konkurrens-slamraden)', () => {
    expect(decideCall(giv(MICHAELS_15, 'S:AQ8 H:A4 D:A876 C:A953'), h, 'N')).toMatchObject({ bid: '4NT', rule: 'konkurrens-slaminvit (RKC)' })
  })
  it('samma styrka UTAN kontroll i en sidofärg → vanlig utgång (radens vanliga krav gäller)', () => {
    expect(decideCall(giv(MICHAELS_15, 'S:AQ8 H:K4 D:A876 C:AQ53'), h, 'N').bid).toBe('4S')
  })
  it('inklivaren svarar på essfrågan med SPADER som trumf — cue-buden i deras ruter sätter ingen trumf', () => {
    // ♠K + ♥A = två nyckelkort utan trumfdam → 5♥. (Förr: "ruter överenskommen" → ♠K räknades inte.)
    expect(decideCall(giv(MICHAELS_15, TOM), [...h, call('N', '4NT'), call('E', 'P')], 'S')).toMatchObject({ bid: '5H', rule: '1430 RKC' })
    // Bara ♠K (inga ess) = ett nyckelkort → 5♣.
    expect(decideCall(giv('S:K9532 H:KQJ63 D:4 C:K2', TOM), [...h, call('N', '4NT'), call('E', 'P')], 'S').bid).toBe('5C')
  })
})

describe('budförklaringarna', () => {
  it('2♠ = preferens/avslut som kan vara 0 poäng — inte "höjning med stöd"', () => {
    const m = meaningOf([...START, call('N', '2S')], 3)
    expect(m.rule).toBe('advance tvåfärg (preferens)')
    expect(m.text).toMatch(/kan ha 0/)
  })
  it('inklivarens 3♠ efter avslutet = inbjudan 15–17', () => {
    const m = meaningOf([...START, call('N', '2S'), call('E', 'P'), call('S', '3S')], 5)
    expect(m).toMatchObject({ rule: 'Michaels: inbjudan' })
    expect(m.text).toMatch(/15–17/)
  })
  it('advancerns 3♦ = cue med utgångsintresse', () => {
    expect(meaningOf([...START, call('N', '3D')], 3)).toMatchObject({ rule: 'advance Michaels: cue (utgångsintresse)' })
  })
})
