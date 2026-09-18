// Felrapport #34 – försvaret spelar TREDJE HAND HÖGT (§8.6, docs/bot-hjarna.md).
// FACIT FÖRE FIX. Två lås:
//
//  1. En DDS-verifierad klassisk finessställning: träkarlen lågt, spelföraren
//     håller knekten (finess-kortet), försvarets K/D delade. Spelar 3:e hand
//     LÅGT stjäl spelförarens knekt ett stick (fri finess) → spelföraren 2;
//     spelar 3:e hand HÖGT (kungen) dör knekten under damen → spelföraren 1.
//     Tumregeln före fixen la det billigaste vinnande spotkortet (♥7) och skänkte
//     bort sticket – precis buggen i #34 (Nord la ♥5 under partnerns utspel).
//
//  2. Själva felrapportens giv: 1NT av Öst, Syd spelar ut ♥3, träkarlen (Väst)
//     ♥4 – Nord satt med ♥KJ1065 och la ♥5 i stället för en honnör. Efter fixen
//     lägger Nord kungen (tredje hand högt), aldrig ett lågt spotkort.

import { describe, expect, it } from 'vitest'
import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { botCardReasoned, botCardSmart } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const parse = (s: string): Card[] => {
  const out: Card[] = []
  for (const part of s.split(' ')) {
    const suit = SUIT[part[0]]
    for (const ch of part.slice(1)) out.push({ suit, rank: (ch === 'T' ? '10' : ch) as Rank })
  }
  return out
}
const H = (r: Rank): Card => ({ suit: 'hearts', rank: r })

describe('Felrapport #34 – tredje hand högt (§8.6)', () => {
  // 3-korts hjärterslutspel, Syd spelförare i sang, Väst (partnern) på utspel.
  const ending: PlayState = {
    contract: { declarer: 'S', strain: 'NT', level: 1 },
    trump: null,
    hands: {
      W: parse('HQ62'), // partnern (utspelare)
      N: parse('H543'), // träkarl – bara hackor
      E: parse('HK97'), // 3:e hand: kungen bakom knekten
      S: parse('HAJ8'), // spelförare (dold), håller finess-knekten
    } as Record<Seat, Card[]>,
    leader: 'W',
    toAct: 'W',
    currentTrick: [],
    completedTricks: [],
    tricksNS: 0,
    tricksEW: 0,
  }

  /** Läget efter Väst ♥2 (lågt utspel) och Nord ♥4 (träkarl lågt) – Öst 3:e hand. */
  function atThirdHand(): PlayState {
    let s = ending
    s = playCard(s, H('2')) // Väst leder lågt
    s = playCard(s, H('4')) // träkarlen lägger lågt (slår ♥2 → motståndaren vinner just nu)
    return s
  }

  it('DDS mekanism-lås: 3:e hand HÖGT håller spelföraren till 1, LÅGT släpper 2', () => {
    const s = atThirdHand()
    const declTricks = (c: Card) => {
      const t = playCard(s, c)
      return doubleDummyDeclarerRemaining(t.hands, 'NT', 'S', t.currentTrick, t.toAct, Infinity)
    }
    expect(declTricks(H('K'))).toBe(1) // tredje hand högt: knekten dör → 1 stick
    expect(declTricks(H('9'))).toBe(2) // tredje hand lågt: fri finess → 2 stick
    expect(declTricks(H('7'))).toBe(2) // (det gamla tumregel-valet – billigaste vinnaren)
  })

  it('tumregeln spelar tredje hand HÖGT (kungen), inte ett lågt spotkort', () => {
    const s = atThirdHand()
    expect(botCardReasoned(s, 'E').card).toEqual(H('K'))
  })

  // Själva felrapporten: 1NT av Öst, given nedan.
  const deal = {
    hands: {
      N: parse('SK3 HKJT65 DAQ9 CT52'),
      E: parse('SAJ52 HA9 DK765 CKJ7'),
      S: parse('SQ6 H8732 DT842 CQ94'),
      W: parse('ST9874 HQ4 DJ3 CA863'),
    } as Record<Seat, Card[]>,
  }
  const contract: Contract = { declarer: 'E', strain: 'NT', level: 1 }

  /** Trick 1 i felrapporten: Syd ♥3, Väst (träkarl) ♥4 – Nord 3:e hand. */
  function reportThirdHand(): PlayState {
    let s = startPlay(deal as any, contract)
    s = playCard(s, H('3')) // Syd (partnern) leder ♥3
    s = playCard(s, H('4')) // Väst (träkarl) lägger ♥4 – slår ♥3
    return s
  }

  it('felrapportens giv: Nord lägger en honnör (tredje hand högt), inte ♥5', () => {
    const s = reportThirdHand()
    const pick = botCardReasoned(s, 'N').card
    expect(pick.suit).toBe('hearts')
    expect(['K', 'J', '10']).toContain(pick.rank) // en honnör – aldrig lågt (♥5 var buggen)
  })

  it('SKARPA boten (som appen kör) lägger också en honnör vid 13 kort', () => {
    // 13 kort ligger över Monte-Carlo-fönstret (≤8) → samma tumregel-lager.
    const s = reportThirdHand()
    const pick = botCardSmart(s, 'N', [])
    expect(pick.suit).toBe('hearts')
    expect(['K', 'J', '10']).toContain(pick.rank)
  })
})

// Felrapport #51 (github.com/PGreen90/Learn-Bridge/issues/51): 3♣ av Nord.
// Öst (partnern) leder ♥6, träkarlen (Syd) lägger lågt ♥2 – partnerns 6:a
// "vinner" bara för att den DOLDA spelföraren (Nord) ännu inte spelat. Väst satt
// med ♥A98753 och markerade LÅGT (♥3) i stället för att ta sticket med sin
// MÄSTARE (esset). Följd: Nords stiff ♥T tog sticket gratis. Facit: tredje hand
// högt med mästaren bakom en dold spelförare – att casha den kan aldrig kosta.
describe('Felrapport #51 – tredje hand tar mästaren bakom dold spelförare', () => {
  const deal = {
    hands: {
      N: parse('SAKT HT DJ963 CKT962'),
      E: parse('SJ62 HKJ64 DKQ82 CQ7'),
      S: parse('SQ7 HQ2 DAT75 CA8543'),
      W: parse('S98543 HA98753 D4 CJ'),
    } as Record<Seat, Card[]>,
  }
  const contract: Contract = { declarer: 'N', strain: 'clubs', level: 3 }

  /** Trick 1: Öst leder ♥6, Syd (träkarl) ♥2 – Väst 3:e hand, Nord (dold) 4:e. */
  function atWest(): PlayState {
    let s = startPlay(deal as any, contract)
    s = playCard(s, H('6')) // Öst (partnern) leder
    s = playCard(s, H('2')) // Syd (träkarl) lågt
    return s
  }

  it('tumregeln tar esset (mästaren), inte ett lågt markeringskort', () => {
    expect(botCardReasoned(atWest(), 'W').card).toEqual(H('A'))
  })

  it('SKARPA boten (appen) tar också esset vid 13 kort', () => {
    const pick = botCardSmart(atWest(), 'W', [])
    expect(pick).toEqual(H('A'))
  })

  // Ägarnoteringen 2026-08-18: "sticket ser vunnet ut NU" är en svag anledning
  // att krypa – tredje hand spelar normalt HÖGT. I sang pressar jag fram
  // spelförarens honnör med min lägsta honnör även utan en äkta mästare.
  it('sang: tredje hand pressar honnören (♥Q ur ♥KQ4), kryper inte', () => {
    const nt = {
      hands: {
        N: parse('ST98 HAJT96 D976 C76'), // spelförare (dold), håller ♥A
        E: parse('SKQ4 H875 DKQ5 CAKQJ'), // partnern, leder ♥5
        S: parse('SJ765 H32 DAJT8 CT98'), // träkarl (lågt ♥2)
        W: parse('SA32 HKQ4 D432 C5432'), // jag: ♥KQ4 bakom dold ♥A
      } as Record<Seat, Card[]>,
    }
    let s = startPlay(nt as any, { declarer: 'N', strain: 'NT', level: 3 })
    s = playCard(s, H('5')) // Öst leder lågt
    s = playCard(s, H('2')) // Syd (träkarl) lågt
    const pick = botCardReasoned(s, 'W').card
    expect(pick.suit).toBe('hearts')
    expect(pick.rank).toBe('Q') // lägsta av KQ – snålar med sekvensen
  })

  // Även i TRUMF pressas honnören (ägarbeslut 2026-08-18 efter A/B-mätning: den
  // gamla "−1 i trumf"-noteringen replikerade inte – netto −2 över 209 trumfgivar,
  // neutralt-till-svagt-bättre försvar). Tredje hand högt gäller nu i båda.
  it('trumf: pressar också honnören (♥Q ur ♥KQ4), kryper inte', () => {
    const tr = {
      hands: {
        N: parse('ST98 HAJT96 D976 C76'),
        E: parse('SKQ4 H875 DKQ5 CAKQJ'),
        S: parse('SJ765 H32 DAJT8 CT98'),
        W: parse('SA32 HKQ4 D432 C5432'),
      } as Record<Seat, Card[]>,
    }
    let s = startPlay(tr as any, { declarer: 'N', strain: 'spades', level: 4 })
    s = playCard(s, H('5'))
    s = playCard(s, H('2'))
    const pick = botCardReasoned(s, 'W').card
    expect(pick.suit).toBe('hearts')
    expect(pick.rank).toBe('Q') // honnörstvång även i trumf
  })

  // Vakt: håller partnern själv mästaren (leder ess), ska jag INTE slösa en egen
  // honnör över partnerns vinnande stick – markera lågt som förr.
  it('övertar INTE när partnern redan lett färgens mästare', () => {
    const alt = {
      hands: {
        N: parse('SAKT HT DJ963 CKT962'),
        E: parse('SJ62 HA64 DKQ82 CQ7'),
        S: parse('SQ7 HJ2 DAT75 CA8543'),
        W: parse('S98543 HK98753 D4 CJ'),
      } as Record<Seat, Card[]>,
    }
    let s = startPlay(alt as any, contract)
    s = playCard(s, H('A')) // Öst leder mästaren
    s = playCard(s, H('2')) // Syd lågt
    const pick = botCardReasoned(s, 'W').card
    expect(pick).not.toEqual(H('K')) // slösar inte kungen över partnerns ess
  })
})

// Felrapport #75 (github.com/PGreen90/Learn-Bridge/issues/75): 4♦ av Öst.
// Syd (partnern) leder LÅGT ♥2, den öppna träkarlen (Väst) lägger ♥6 och SLÅR
// utspelet – men den DOLDA spelföraren (Öst, ♥J singel) spelar EFTER Nord. Nord
// satt med ♥K754 och la ♥7 ("vinn billigast") som föll för Östs dolda ♥J. Facit:
// tredje hand högt även när TRÄKARLEN (andra hand) slog partnerns utspel – Nord
// tar med kungen (DDS: spelföraren hålls till 7 stick, ♥7 släpper 8) och kommer
// in för en klöverruff till åt Syd. Buggen: tredje-hand-högt kördes bara när
// partnern "vann" sticket ELLER i sang; slog träkarlen partnern i ett
// trumfkontrakt föll boten till "billigaste vinnaren".
describe('Felrapport #75 – tredje hand högt när träkarlen slog partnern (trumf)', () => {
  const deal = {
    hands: {
      N: parse('S8 HK754 DQ72 CKJ652'),
      E: parse('SQJT4 HJ DT98654 C43'),
      S: parse('SK97632 HT32 DAJ3 C7'),
      W: parse('SA5 HAQ986 DK CAQT98'),
    } as Record<Seat, Card[]>,
  }
  const contract: Contract = { declarer: 'E', strain: 'diamonds', level: 4 }
  const D = (r: Rank): Card => ({ suit: 'diamonds', rank: r })
  const CL = (r: Rank): Card => ({ suit: 'clubs', rank: r })

  /** Fram till Nords val i stick 3: S ♥2, träkarlen (Väst) ♥6 slår – Öst dold 4:e. */
  function atNordThirdHand() {
    let s = startPlay(deal as any, contract)
    // stick 1: S ♣7, V ♣8, N ♣J, Ö ♣3 → Nord vinner
    s = playCard(s, CL('7')); s = playCard(s, CL('8')); s = playCard(s, CL('J')); s = playCard(s, CL('3'))
    // stick 2: N ♣5, Ö ♣4, S ♦3 (ruff), V ♣9 → Syd vinner (klöverruff #1)
    s = playCard(s, CL('5')); s = playCard(s, CL('4')); s = playCard(s, D('3')); s = playCard(s, CL('9'))
    // stick 3: S ♥2, V ♥6 (slår) → Nord 3:e hand, Öst (dold ♥J) 4:e
    s = playCard(s, H('2')); s = playCard(s, H('6'))
    return s
  }

  it('DDS mekanism-lås: Nords ♥K håller spelföraren till 7 stick, ♥7 släpper 8', () => {
    const s = atNordThirdHand()
    const declRemaining = (c: Card) => {
      const t = playCard(s, c)
      return doubleDummyDeclarerRemaining(t.hands, 'diamonds', 'E', t.currentTrick, t.toAct, Infinity)
    }
    expect(declRemaining(H('K'))).toBe(7) // tredje hand högt → en klöverruff till
    expect(declRemaining(H('7'))).toBe(8) // billigaste vinnaren (buggen) → ett stick bort
  })

  it('tumregeln spelar tredje hand HÖGT (kungen), inte ♥7', () => {
    expect(botCardReasoned(atNordThirdHand(), 'N').card).toEqual(H('K'))
  })

  it('SKARPA boten (appen) lägger också kungen vid 11 kort', () => {
    // 11 kort ligger över Monte-Carlo-fönstret (≤8) → samma tumregel-lager.
    expect(botCardSmart(atNordThirdHand(), 'N', [])).toEqual(H('K'))
  })
})

// T-serien regel A (NU 2026-09-18, docs/speldiagnos.md): "lägsta honnören" får
// inte UNDERSPELA. Bordet har redan lagt, så bara OSEDDA högre kort kan slå mig
// — finns ett kort som inget osett kort kan slå, läggs det lägsta sådana.
describe('T-serien regel A – tredje hand underspelar inte det dolda', () => {
  // Frö 20260770 (3♠ av N): Öst leder ♥5, bordet (Syd, ♥AT87) lägger ♥7. Väst
  // har ♥KJ. ♥J kan slås av den osedda ♥Q (spelföraren hade singel-Q); ♥K kan
  // bara slås av ♥A — som ligger synligt på bordet och är förbi i sticket.
  it('KJ bakom bordets lagda 7:a: kungen, inte knekten (frö 20260770)', () => {
    const deal = {
      hands: {
        N: parse('SQT865 HQ DQT97 CQ65'),
        E: parse('S43 H965432 DKJ CK84'),
        S: parse('SAK72 HAT87 D6543 C2'),
        W: parse('SJ9 HKJ DA82 CAJT973'),
      } as Record<Seat, Card[]>,
    }
    let s = startPlay(deal as any, { declarer: 'N', strain: 'spades', level: 3 })
    s = playCard(s, H('5')); s = playCard(s, H('7'))
    expect(botCardReasoned(s, 'W').card).toEqual(H('K'))
  })

  // Frö 20260819 (3♠ av N): partnern ledde ♥A i stick 1 (topp av sekvens →
  // lovar ♥K), fortsätter ♥5; bordet lägger sin sista ♥9. Väst har ♥QT43:
  // ♥T kan slås av den osedda ♥J, ♥Q bara av kungen — som partnern visat.
  it('QT efter partnerns ess-utspel: damen, inte tian (frö 20260819)', () => {
    const deal = {
      hands: {
        N: parse('SAJT942 HJ6 DQ7 C753'),
        E: parse('SQ HAK75 D943 CAQT96'),
        S: parse('SK765 H98 DAKJ652 C2'),
        W: parse('S83 HQT432 DT8 CKJ84'),
      } as Record<Seat, Card[]>,
    }
    let s = startPlay(deal as any, { declarer: 'N', strain: 'spades', level: 3 })
    for (const r of ['A', '8', '2', '6'] as Rank[]) s = playCard(s, H(r)) // stick 1
    s = playCard(s, H('5')); s = playCard(s, H('9'))
    expect(botCardReasoned(s, 'W').card).toEqual(H('Q'))
  })
})

// T-serien regel C: mästaren cashas INTE när en lägre honnör räcker och esset
// ska sitta kvar över en SYNLIG bordshonnör. (Regression från #75-fixen: den
// gamla sang-grenen tog lägsta honnören; mästar-grenen gick sedan före.)
describe('T-serien regel C – spara mästaren över bordets synliga honnör', () => {
  // Frö 20260812 (2NT av N): Öst leder ♣2, bordet (Syd, ♣KT) lägger ♣T. Väst
  // har ♣AJ4: ♣J tvingar fram ♣Q (eller vinner) och esset sitter kvar över
  // bordets nu singla ♣K. ♣A direkt ger spelföraren både K och Q (DD −2).
  const deal = {
    hands: {
      N: parse('SAQ6 HA75 DKT52 CQ83'),
      E: parse('SK84 HK832 D6 C97652'),
      S: parse('SJ72 HQJT DJ9874 CKT'),
      W: parse('ST953 H964 DAQ3 CAJ4'),
    } as Record<Seat, Card[]>,
  }
  const CL = (r: Rank): Card => ({ suit: 'clubs', rank: r })
  it('AJ4 över bordets K: knekten, inte esset (frö 20260812)', () => {
    let s = startPlay(deal as any, { declarer: 'N', strain: 'NT', level: 2 })
    s = playCard(s, CL('2')); s = playCard(s, CL('10'))
    expect(botCardReasoned(s, 'W').card).toEqual(CL('J'))
  })
  it('vakt: utan lägre honnör tas mästaren som förr (A972 över bordets KJ65)', () => {
    const d2 = {
      hands: {
        N: parse('SAQ6 HA75 DKT52 CQT8'),
        E: parse('SK84 HK832 D6 C76532'),
        S: parse('SJ72 HQJT DJ9874 CKJ'),
        W: parse('ST953 H964 DAQ3 CA94'),
      } as Record<Seat, Card[]>,
    }
    let s = startPlay(d2 as any, { declarer: 'N', strain: 'NT', level: 2 })
    s = playCard(s, CL('2')); s = playCard(s, CL('J'))
    expect(botCardReasoned(s, 'W').card).toEqual(CL('A'))
  })
})

// T-serien regel B: gå inte över partnerns VINNANDE honnör med ett kort som är
// LIKVÄRDIGT mot spelföraren (inget osett kort ligger emellan) — det löser inte
// hotet (samma ess slår båda) och krockar bara två honnörer i ett stick.
describe('T-serien regel B – övertar inte partnerns honnör med ett likvärdigt kort', () => {
  // Frö 20260751 (3♣ av V): Nord leder ♠Q (min bjudna färg), bordet (Öst,
  // ♠J982) lägger ♠2. Syd har ♠KT763: ♠K på ♠Q förlorar till ♠A precis som
  // damen hade gjort — och gör bordets ♠J98 goda (DD −2).
  it('K på partnerns vinnande Q: nej – lågt (frö 20260751)', () => {
    const deal = {
      hands: {
        N: parse('SQ5 H63 DJT9743 CJT2'),
        E: parse('SJ982 HKJT2 D65 CK73'),
        S: parse('SKT763 HQ87 DAKQ2 C6'),
        W: parse('SA4 HA954 D8 CAQ9854'),
      } as Record<Seat, Card[]>,
    }
    const SP = (r: Rank): Card => ({ suit: 'spades', rank: r })
    let s = startPlay(deal as any, { declarer: 'W', strain: 'clubs', level: 3 })
    s = playCard(s, SP('Q')); s = playCard(s, SP('2'))
    const pick = botCardReasoned(s, 'S').card
    expect(pick.suit).toBe('spades')
    expect(pick.rank).not.toBe('K')
  })
})

// T-serien regel B2: en honnör som sitter som GARD över bordets honnör och som
// KAN slås av ett osett kort pressas inte — den sparas (kryp/billigt kort).
describe('T-serien regel B2 – spendera inte garden över bordets honnör', () => {
  // Frö 20260776 (2♦ av S): Väst leder ♠3, bordet (Nord, ♠AJ95) lägger ♠5.
  // Öst har ♠Q642: damen kan slås av den osedda kungen (spelföraren hade ♠K8)
  // och är garden över bordets ♠J. Lägg billigt över femman i stället.
  it('Q642 över bordets AJ95: inte damen (frö 20260776)', () => {
    const deal = {
      hands: {
        N: parse('SAJ95 HQJT96 DT3 CJ6'),
        E: parse('SQ642 HK7432 DK9 CQT'),
        S: parse('SK8 HA8 DJ8654 CAK53'),
        W: parse('ST73 H5 DAQ72 C98742'),
      } as Record<Seat, Card[]>,
    }
    const SP = (r: Rank): Card => ({ suit: 'spades', rank: r })
    let s = startPlay(deal as any, { declarer: 'S', strain: 'diamonds', level: 2 })
    s = playCard(s, SP('3')); s = playCard(s, SP('5'))
    const pick = botCardReasoned(s, 'E').card
    expect(pick.suit).toBe('spades')
    expect(pick.rank).not.toBe('Q')
  })
})

// T-serien regel D: bordet spelar EFTER mig och spelföraren har redan lagt —
// allt är synligt. Kan jag inte slå bordets topp men har ett kort som tvingar
// bordet att SPENDERA en honnör (i stället för att vinna billigt), läggs det.
describe('T-serien regel D – tvinga fram bordets honnör när allt är synligt', () => {
  // Frö 20260885 (2♦ av N), stick 4: Väst leder ♠5, spelföraren (Nord) sakar
  // ♥K, Öst har ♠T982 och bordet (Syd) ♠K76 sist. ♠2 lät ♠6 vinna billigt;
  // ♠8 ur sekvensen kostar inget och tvingar kungen (DD −2 för tvåan).
  it('T982 mot bordets K76 efter mig: åttan, inte tvåan (frö 20260885)', () => {
    const deal = {
      hands: {
        N: parse('SQ HK DQT98653 CAT64'),
        E: parse('SJT982 H932 DJ7 C932'),
        S: parse('SK763 HJ8765 D42 CK8'),
        W: parse('SA54 HAQT4 DAK CQJ75'),
      } as Record<Seat, Card[]>,
    }
    const c = (suit: Suit, r: Rank): Card => ({ suit, rank: r })
    let s = startPlay(deal as any, { declarer: 'N', strain: 'diamonds', level: 2 })
    const spel: [Suit, Rank][] = [
      ['spades', 'J'], ['spades', '3'], ['spades', 'A'], ['spades', 'Q'], // stick 1
      ['diamonds', 'A'], ['diamonds', '3'], ['diamonds', '7'], ['diamonds', '2'], // stick 2
      ['diamonds', 'K'], ['diamonds', '5'], ['diamonds', 'J'], ['diamonds', '4'], // stick 3
      ['spades', '5'], ['hearts', 'K'], // stick 4: V ♠5, N sakar ♥K → Öst
    ]
    for (const [su, r] of spel) s = playCard(s, c(su, r))
    expect(botCardReasoned(s, 'E').card).toEqual(c('spades', '8'))
  })
})
