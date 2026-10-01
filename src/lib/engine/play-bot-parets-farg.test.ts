// Speldiagnosen fynd B (2026-10-01) — PARETS FÄRG I SANG. Spelförarsidan ser
// båda sina händer och leder den färg som ger paret flest stick att utveckla,
// inte den ledande handens egen längsta. Ställningarna nedan är de verkliga
// lägena ur S-seriens frön (hämtade ur fynd B-riggens dataset,
// `fyndb.probe.test.ts`); DD-poängen per kort står i kommentaren och är mätta
// med bridge-dds. Regeln bygger på mätningen över alla 200 givar, inte på de
// tre fröna (`fyndb-utvardera.probe.test.ts`: sang 50 → 25 stick).

import { describe, expect, it } from 'vitest'
import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { botCardReasoned } from './play-bot'
import { playCard, type Contract, type PlayState, type Trick } from './play'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const kort = (s: string): Card => ({ suit: SUIT[s[0]], rank: (s.slice(1) === 'T' ? '10' : s.slice(1)) as Rank })
const hand = (s: string): Card[] => s.split(' ').map(kort)
/** "S:SD3,WD6,ND8,EDA→E" → ett avslutat stick. */
const stick = (s: string): Trick => {
  const [lead, rest] = s.split(':')
  const [cards, winner] = rest.split('→')
  return { leader: lead as Seat, cards: cards.split(',').map((c) => ({ seat: c[0] as Seat, card: kort(c.slice(1)) })), winner: winner as Seat }
}
function lage(contract: Contract, hands: Record<Seat, string>, tricks: string, inne: Seat, ns: number, ew: number): PlayState {
  return {
    contract, trump: null,
    hands: { N: hand(hands.N), E: hand(hands.E), S: hand(hands.S), W: hand(hands.W) },
    leader: inne, toAct: inne, currentTrick: [],
    completedTricks: tricks.split(' | ').map(stick),
    tricksNS: ns, tricksEW: ew,
  }
}

describe('Fynd B — parets färg i sang (frönas verkliga lägen)', () => {
  it('20260836, stick 4 (1NT av Öst): leder ♥4 mot bordets ♥KQ96, inte ♣4 ur ♣8542', () => {
    // DD: ♥5=4 ♥4=4 ♠9=1 ♠8=1 ♦7=0 ♦5=0 ♣=0 — hjärtern rullar fyra stick, klövern noll.
    const s = lage(
      { declarer: 'E', strain: 'NT', level: 1 },
      { N: 'DQ S6 C3 CK SK HT DT SJ CJ D4', E: 'C8 D7 C5 C4 D5 C2 H4 S8 S9 H5', S: 'DJ C7 D2 CA CQ ST C9 HJ DK H8', W: 'S3 S7 D9 CT H9 SQ C6 HQ HK H6' },
      'S:SD3,WD6,ND8,EDA→E | E:EHA,SH3,WH2,NH7→E | E:ESA,SS5,WS2,NS4→E', 'E', 0, 3,
    )
    const val = botCardReasoned(s, 'E')
    expect(val.card).toEqual(kort('H4'))
    expect(val.reason).toContain('parets bästa färg')
  })

  it('20260852, stick 5 (1NT av Väst): bordet leder ♦4 till spelförarens åtta ruter, inte ♣K', () => {
    // DD: ♦4=8, ♣K/Q/J=5, ♥=4.
    const s = lage(
      { declarer: 'W', strain: 'NT', level: 1 },
      { N: 'C5 CA HJ H2 D6 C9 H9 SA DT', E: 'C7 CJ HT H7 CK CQ C4 D4 H3', S: 'C3 D5 C2 H6 DQ H5 C6 C8 HQ', W: 'CT DA D8 D7 DJ D2 D9 DK D3' },
      'N:NS4,ES6,SSJ,WS3→S | S:SSK,WS8,NS2,ES7→S | S:SSQ,WS9,NS5,EST→S | S:SHK,WH4,NH8,EHA→E', 'E', 3, 1,
    )
    expect(botCardReasoned(s, 'E').card).toEqual(kort('D4'))
  })

  it('20260898, stick 2 (1NT av Öst): leder ♣J (toppen av sekvensen mot bordets ♣AQ653), inte ♠K ur ♠KT3', () => {
    // DD: ♣J/T/4=7, ♦A=7, ♥A=7, ♠K=4.
    const s = lage(
      { declarer: 'E', strain: 'NT', level: 1 },
      { N: 'S2 D7 D4 C7 S7 D3 D9 S9 CK D5 SJ S5', E: 'ST H6 CT DT C4 HA DA S3 CJ H9 H7 SK', S: 'H3 C2 H4 HJ C8 SA C9 D2 DQ SQ S6 DK', W: 'HT C5 S4 DJ CA D6 S8 C6 C3 CQ H8 D8' },
      'S:SHQ,WH5,NH2,EHK→E', 'E', 0, 1,
    )
    expect(botCardReasoned(s, 'E').card).toEqual(kort('CJ'))
  })

  it('avblockeringen (felrapport #17) gäller: ♦KQJT53 mot bordets singel-♦A leds LÅGT, aldrig ♦K', () => {
    // Ruter är parets bästa färg (sju kort, ett längdstick att utveckla). Toppen
    // av sekvensen vore ♦K — rakt in i partnerns singel-ess. Regeln leder ♦3.
    const s = lage(
      { declarer: 'E', strain: 'NT', level: 3 },
      { N: 'S2 S3 S4 H2 H3 H4 C2 C3 C4', E: 'DK DQ DJ DT D5 D3 S9 H9 C9', S: 'D9 D8 D7 D6 D4 D2 SK HK CK', W: 'DA SA S8 S7 HA H8 H7 CA C8' },
      'S:SS5,WSJ,NS6,ESQ→E', 'E', 0, 1, // ett avslutat stick räcker: läget är inte öppningsutspelet
    )
    const val = botCardReasoned(s, 'E')
    expect(val.card).toEqual(kort('D3'))
  })

  it('höga kort från korta handen: ♠A8742 mot ♠KT leds LÅGT (inte esset), och korta handen lägger kungen', () => {
    // Nord (inne) har färgens topp i den LÅNGA handen, Syd (träkarl) ♠KT. Förr
    // cashades ♠A, sedan sidoessen — ingångarna brann (frö 20260900, −3). Nu:
    // ♠2 mot kungen, och Syd tar sticket med ♠K i stället för att krypa bakom
    // hackan (frö 20260867: bordet kröp med ♣3 och fjärde hand tog sticket).
    const s = lage(
      { declarer: 'N', strain: 'NT', level: 3 },
      { N: 'SA S8 S7 S4 S2 H7 H2 D9 D3 C5', E: 'HJ H9 H8 H4 H3 D6 D5 D2 C8 C7', S: 'SK ST HK HT H6 DK D8 D7 C9 C4', W: 'SQ SJ S9 S6 S5 S3 HQ H5 DQ CQ' },
      'W:WC2,NCA,EC3,SCK→N', 'N', 1, 0,
    )
    const ledning = botCardReasoned(s, 'N')
    expect(ledning.card).toEqual(kort('S2'))
    expect(ledning.reason).toContain('korta handens honnör')
    let t = playCard(s, kort('S2'))
    t = playCard(t, kort('H3')) // Öst är renons och sakar — partnerns hacka "vinner" fortfarande sticket
    const tredje = botCardReasoned(t, 'S')
    expect(tredje.card).toEqual(kort('SK'))
    expect(tredje.reason).toContain('korta handen')
  })

  it('rör inte trumfkontrakt (där var regeln sämre än dagens i mätningen)', () => {
    const s = lage(
      { declarer: 'E', strain: 'NT', level: 1 },
      { N: 'DQ S6 C3 CK SK HT DT SJ CJ D4', E: 'C8 D7 C5 C4 D5 C2 H4 S8 S9 H5', S: 'DJ C7 D2 CA CQ ST C9 HJ DK H8', W: 'S3 S7 D9 CT H9 SQ C6 HQ HK H6' },
      'S:SD3,WD6,ND8,EDA→E | E:EHA,SH3,WH2,NH7→E | E:ESA,SS5,WS2,NS4→E', 'E', 0, 3,
    )
    const trumf: PlayState = { ...s, contract: { declarer: 'E', strain: 'spades', level: 2 }, trump: 'spades' }
    expect(botCardReasoned(trumf, 'E').reason).not.toContain('parets bästa färg')
  })
})
