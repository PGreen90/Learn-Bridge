// MOTORDRIVEN BUDTRÄNING (nästa nivå etapp 3, 2026-11-11).
//
// Den gamla budträningen var tjugo handskrivna flervalsfrågor från juni — och
// ett tema lärde ut en regel motorn inte längre använder. Här är principen den
// omvända: ett TEMA är en budsituation (t.ex. "partnern öppnade 1♥/1♠ och du
// ska svara"), motorn delar slumpgivar tills Syd hamnar i den situationen, och
// FACIT är motorns eget beslut (`decideCall`) med dess egen förklaring. Då kan
// träningen per konstruktion aldrig lära ut något annat än det bottarna
// faktiskt spelar — och den tar aldrig slut.
//
// Ärlig inferens gäller som överallt: facit räknas ur Syds hand + auktionen
// (det är vad `decideCall` läser). De andra händerna bjuder sina egna bud på
// vägen fram till läget, precis som vid bordet.
//
// Bara beslut ur BESLUTSTABELLEN duger som facit. Ett läge tabellen inte
// täcker ("pass (ingen regel)") är ett hål i systemet, inte ett svar att öva in.

import type { Bid, Deal, Hand, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { auctionComplete, decideCallTraced, seatToAct } from './auction-live'
import { dealRandom } from './deal'
import { hcp } from './hand'

/** Läget Syd står i när temat prövas. */
interface Lage {
  /** Alla bud före Syds tur, i ordning. */
  history: ResolvedCall[]
  /** Bara de riktiga buden (allt utom pass), i ordning. */
  bud: ResolvedCall[]
  /** Har Syd bjudit något annat än pass tidigare? */
  sydHarBjudit: boolean
  hand: Hand
  hp: number
  /** Motorns bud i läget (facit). */
  svar: Bid
}

export interface Traningstema {
  id: string
  titel: string
  /** En rad till temalistan. */
  beskrivning: string
  /** Kort introduktion: vad situationen handlar om och vad man ska tänka på. */
  intro: string
  /** Paragrafen i systemboken där reglerna står (visas som hänvisning). */
  paragraf: string
  /** Hör läget till temat? */
  passar: (l: Lage) => boolean
  /** Sena lägen (slam) kräver att hela auktionen gås igenom, inte bara början. */
  sent?: boolean
}

const NS = (s: Seat) => s === 'N' || s === 'S'
const niva = (b: Bid) => Number(b[0]) || 0
const farg = (b: Bid) => b.slice(1)
const arFargbud1 = (b: Bid) => niva(b) === 1 && farg(b) !== 'NT'
const hogfarg = (b: Bid) => farg(b) === 'H' || farg(b) === 'S'

/** Ostörd början: buden i tur och ordning kommer från just de här platserna. */
const platser = (l: Lage, ...vem: Seat[]) => l.bud.length === vem.length && l.bud.every((c, i) => c.seat === vem[i])

export const TRANINGSTEMAN: Traningstema[] = [
  {
    id: 'oppning',
    titel: 'Öppna eller passa?',
    beskrivning: 'Ingen har bjudit. Vilken öppning — eller pass?',
    intro:
      'Tolv honnörspoäng öppnar alltid. Högfärg kräver fem kort, annars öppnar du i längsta lågfärgen. 15–17 jämnt är 1NT, och en svag hand med sex kort i färgen kan öppna på tvåläget.',
    paragraf: '§3 Öppningsbud',
    passar: (l) => l.bud.length === 0 && (l.svar !== 'P' || (l.hp >= 9 && l.hp <= 11)),
  },
  {
    id: 'svar-hogfarg',
    titel: 'Svar på 1♥ / 1♠',
    beskrivning: 'Partnern öppnar i högfärg. Höjning, 1NT eller ny färg?',
    intro:
      'Med stöd väljer du höjning efter styrka och antal trumf — här bor Bergen-höjningarna och Jacoby 2NT. Utan stöd: ny färg på ettläget, 1NT med 6–11, eller ny färg på tvåläget som är utgångskrav.',
    paragraf: '§4.1 Svar på 1♥ / 1♠',
    passar: (l) => platser(l, 'N') && arFargbud1(l.bud[0].bid) && hogfarg(l.bud[0].bid) && (l.svar !== 'P' || l.hp >= 4),
  },
  {
    id: 'svar-lagfarg',
    titel: 'Svar på 1♣ / 1♦',
    beskrivning: 'Partnern öppnar i lågfärg. Visa högfärg, sang eller stöd?',
    intro:
      'Fyrkorts högfärg bjuds före allt annat. Lågfärgshöjningarna är omvända: enkel höjning är stark och krav, hopphöjningen är svag. Utan högfärg avgör styrkan mellan 1NT, 2NT och 3NT.',
    paragraf: '§4.2 Svar på 1♣ / 1♦',
    passar: (l) => platser(l, 'N') && arFargbud1(l.bud[0].bid) && !hogfarg(l.bud[0].bid) && (l.svar !== 'P' || l.hp >= 4),
  },
  {
    id: 'svar-sang',
    titel: 'Svar på 1NT och 2NT',
    beskrivning: 'Partnern öppnar i sang. Stayman, överföring eller rakt på utgång?',
    intro:
      'Partnerns hand är snävt beskriven, så du är kapten. Med femkorts högfärg överför du, med fyrkorts frågar du — Stayman över 1NT, Puppet Stayman över 2NT. Räkna ihop poängen och välj nivå.',
    paragraf: '§4.3 Svar på 1NT · §4.3b Svar på 2NT',
    passar: (l) => platser(l, 'N') && (l.bud[0].bid === '1NT' || l.bud[0].bid === '2NT') && (l.svar !== 'P' || l.hp >= 6),
  },
  {
    id: 'aterbud',
    titel: 'Öppnarens återbud',
    beskrivning: 'Du öppnade och partnern svarade. Hur beskriver du handen vidare?',
    intro:
      'Nu visar du styrka och fördelning: minimum bjuder lågt, 16–18 visar extra, 19+ kräver till utgång. Efter partnerns utgångskrav på tvåläget bjuder du lugnt och naturligt — ingen behöver hoppa.',
    paragraf: '§5 Återbud',
    passar: (l) => platser(l, 'S', 'N') && arFargbud1(l.bud[0].bid),
  },
  {
    id: 'svararens-andra',
    titel: 'Svararens andra bud',
    beskrivning: 'Partnern öppnade och har bjudit en gång till. Sätt nivån.',
    intro:
      'Öppnaren har beskrivit sin hand — nu placerar du kontraktet eller frågar vidare. Här finns New Minor Forcing efter 1NT-återbudet och fjärde färg som utgångskrav när ingen naturlig fortsättning passar.',
    paragraf: '§5.7 New Minor Forcing · §6.6 Fjärde färg krav',
    passar: (l) => platser(l, 'N', 'S', 'N') && arFargbud1(l.bud[0].bid),
  },
  {
    id: 'inkliv',
    titel: 'Inkliv och upplysningsdubbling',
    beskrivning: 'Motståndarna öppnar på ettläget. Kliver du in?',
    intro:
      'Ett inkliv lovar en bra femkortsfärg. Upplysningsdubblingen visar öppningsstyrka med kort i deras färg och stöd för de andra. Med två femkortsfärger finns Michaels och ovanlig 2NT. Passar handen ingetdera är pass rätt bud.',
    paragraf: '§7.1 Inkliv · §7.2 Tvåfärgsinkliv · §7.3 Upplysningsdubbling',
    passar: (l) =>
      l.bud.length === 1 && !NS(l.bud[0].seat) && arFargbud1(l.bud[0].bid) && (l.svar !== 'P' || l.hp >= 11),
  },
  {
    id: 'svar-stort',
    titel: 'Partnern öppnar, de kliver in',
    beskrivning: 'Motståndaren stör efter partnerns öppning. Negativ dubbling eller bud?',
    intro:
      'Inklivet tar bort utrymme. Den negativa dubblingen visar de objudna högfärgerna utan att du behöver ha styrka för ett eget bud på nästa nivå. Med stöd höjer du — ett bud i deras färg visar en stark höjning.',
    paragraf: '§7.4 Negativ dubbling · §7.8 När motståndarna stör',
    passar: (l) =>
      l.bud.length === 2 && l.bud[0].seat === 'N' && arFargbud1(l.bud[0].bid) && l.bud[1].seat === 'E' && (l.svar !== 'P' || l.hp >= 6),
  },
  {
    id: 'advancer',
    titel: 'Partnern kliver in',
    beskrivning: 'Motståndarna öppnade och partnern bjöd eller dubblade. Vad gör du?',
    intro:
      'Efter partnerns inkliv räcker tre trumf för att höja, och ett bud i deras färg visar en bra höjning. Efter partnerns upplysningsdubbling MÅSTE du bjuda din bästa färg om nästa hand passar — även med noll poäng.',
    paragraf: '§7.1 Inkliv och svar · §7.3 Upplysningsdubbling',
    passar: (l) =>
      (l.bud.length === 2 || l.bud.length === 3) &&
      !NS(l.bud[0].seat) &&
      arFargbud1(l.bud[0].bid) &&
      l.bud[1].seat === 'N' &&
      !l.sydHarBjudit &&
      (l.bud.length === 2 || !NS(l.bud[2].seat)),
  },
  {
    id: 'mot-sang-sparr',
    titel: 'Mot deras 1NT och spärrar',
    beskrivning: 'Motståndarna öppnar 1NT, svag tvåa eller spärr. In eller pass?',
    intro:
      'Mot 1NT spelas DONT: dubbelt visar en enfärgshand, ett färgbud den färgen och en högre. Mot svaga tvåor och spärrar är dubbelt upplysande och ett inkliv lovar en riktig hand — utrymmet är litet, så värdera noga.',
    paragraf: '§7.6 Mot motståndarnas 1NT · §7.7 Mot svaga öppningar',
    passar: (l) =>
      l.bud.length === 1 &&
      !NS(l.bud[0].seat) &&
      (l.bud[0].bid === '1NT' || (niva(l.bud[0].bid) >= 2 && niva(l.bud[0].bid) <= 3 && l.bud[0].bid !== '2C' && l.bud[0].bid !== '2NT')) &&
      (l.svar !== 'P' || l.hp >= 12),
  },
  {
    id: 'slam',
    titel: 'Slam: essfråga och svar',
    beskrivning: 'Lägena kring 4NT — att fråga, att svara och att sätta slutbudet.',
    intro:
      '4NT frågar efter fem nyckelkort: de fyra essen och trumfkungen. Svaren går i ordningen 1430 — 5♣ visar ett eller fyra, 5♦ noll eller tre, 5♥ två utan trumfdam, 5♠ två med. Frågaren räknar sedan och sätter slutbudet.',
    paragraf: '§6.1 1430 RKC Blackwood · §6.2 Kontrollbud',
    sent: true,
    passar: (l) => {
      const partnersSista = [...l.bud].reverse().find((c) => c.seat === 'N')
      const partnerFragade = partnersSista?.bid === '4NT'
      const jagFragade = [...l.bud].reverse().find((c) => c.seat === 'S')?.bid === '4NT'
      return l.svar === '4NT' || (partnerFragade && l.svar !== 'P') || (jagFragade && niva(partnersSista?.bid ?? 'P') === 5)
    },
  },
]

export function traningstema(id: string): Traningstema | undefined {
  return TRANINGSTEMAN.find((t) => t.id === id)
}

export interface Traningsgiv {
  deal: Deal
  /** Buden fram till Syds tur. */
  history: ResolvedCall[]
  /** Motorns bud i läget, med regel och förklaring. */
  facit: ResolvedCall
}

/** Tidiga teman avgörs inom de första varven — sluta leta i given efter det. */
const TIDIG_GRANS = 9

/** Syds träningsläge i EN giv för temat, eller null om given inte innehåller något. */
export function lageIGiv(deal: Deal, tema: Traningstema): Traningsgiv | null {
  const history: ResolvedCall[] = []
  const hand = deal.hands.S
  const hp = hcp(hand)
  let vakt = 0
  while (!auctionComplete(history) && vakt++ < 40) {
    if (!tema.sent && history.length > TIDIG_GRANS) return null
    const seat = seatToAct(deal.dealer, history.length)
    const { call, källa } = decideCallTraced(deal, history, seat)
    // Bara rena tabellbeslut duger som facit (se filhuvudet).
    if (seat === 'S' && källa.startsWith('tabell:') && !källa.includes('olagligt')) {
      const lage: Lage = {
        history,
        bud: history.filter((c) => c.bid !== 'P'),
        sydHarBjudit: history.some((c) => c.seat === 'S' && c.bid !== 'P'),
        hand,
        hp,
        svar: call.bid,
      }
      if (tema.passar(lage)) return { deal, history: [...history], facit: call }
    }
    history.push(call)
  }
  return null
}

/**
 * Dela slumpgivar tills en innehåller temats läge. `null` om ingen hittades
 * inom budgeten (då visar sidan "hittade ingen giv — försök igen").
 */
export function traningsgiv(temaId: string, rng: () => number = Math.random, maxForsok = 6000): Traningsgiv | null {
  const tema = traningstema(temaId)
  if (!tema) return null
  for (let i = 0; i < maxForsok; i++) {
    const hittad = lageIGiv(dealRandom(rng), tema)
    if (hittad) return hittad
  }
  return null
}

// ---- Fortsätt budgivningen (flera beslut i samma giv) ----------------------

/**
 * Nästa beslut för Syd i SAMMA giv, om budgivningen fortsätter med motorns bud
 * (facit läggs, övriga platser bjuder sina egna bud). `null` när auktionen tar
 * slut eller Syds nästa läge saknar tabellregel. Fortsättningen är inte bunden
 * till temat — den följer given dit den leder.
 */
export function fortsattGiv(giv: Traningsgiv): Traningsgiv | null {
  const history = [...giv.history, giv.facit]
  let vakt = 0
  while (!auctionComplete(history) && vakt++ < 40) {
    const seat = seatToAct(giv.deal.dealer, history.length)
    const { call, källa } = decideCallTraced(giv.deal, history, seat)
    if (seat === 'S') {
      if (!källa.startsWith('tabell:') || källa.includes('olagligt')) return null
      return { deal: giv.deal, history, facit: call }
    }
    history.push(call)
  }
  return null
}

// ---- Träna dina missar (bud i tävlingen där du avvek från motorn) ----------

/** Ett sparat läge ur en spelad giv där Syd bjöd något annat än motorn. */
export interface Traningsmiss {
  /** Unik nyckel (varifrån + vilket bud i ordningen) — för att inte spara dubbelt. */
  nyckel: string
  /** Läsbar källa: "Dagens MP% nr 93, giv 7". */
  kalla: string
  deal: Deal
  /** Buden som de föll vid bordet, fram till Syds tur. */
  history: ResolvedCall[]
  /** Det du bjöd den gången. */
  mittBud: Bid
}

/**
 * Första läget i en färdigbjuden giv där Syd avvek från motorns tabellbud.
 * Bara det FÖRSTA: senare avvikelser är följder av den första och säger inget
 * eget. `null` = du bjöd som motorn hela vägen (eller motorn saknade regel).
 */
export function forstaMissen(deal: Deal, history: ResolvedCall[], kalla: string): Traningsmiss | null {
  for (let i = 0; i < history.length; i++) {
    const c = history[i]
    if (c.seat !== 'S') continue
    const fore = history.slice(0, i)
    const { call, källa } = decideCallTraced(deal, fore, 'S')
    if (!källa.startsWith('tabell:') || källa.includes('olagligt')) continue
    if (call.bid !== c.bid) return { nyckel: `${kalla}#${i}`, kalla, deal, history: fore, mittBud: c.bid }
  }
  return null
}

/**
 * En sparad miss som träningsgiv — facit räknas om MOT DAGENS MOTOR, så en
 * regel som ändrats sedan dess ger dagens svar. `null` när läget inte längre
 * är en miss (motorn bjuder numera som du gjorde, eller saknar regel).
 */
export function missSomGiv(miss: Traningsmiss): Traningsgiv | null {
  const { call, källa } = decideCallTraced(miss.deal, miss.history, 'S')
  if (!källa.startsWith('tabell:') || källa.includes('olagligt')) return null
  if (call.bid === miss.mittBud) return null
  return { deal: miss.deal, history: miss.history, facit: call }
}

/** Lägg en ny miss först i kön (nyast först), utan dubbletter, högst `max`. */
export function laggTillMiss(ko: Traningsmiss[], ny: Traningsmiss, max = 40): Traningsmiss[] {
  return [ny, ...ko.filter((m) => m.nyckel !== ny.nyckel)].slice(0, max)
}

/** Pseudotemat för sparade missar (står inte i TRANINGSTEMAN — givarna kommer
 *  ur kön, inte ur slumpen). */
export const MISSTEMA: Traningstema = {
  id: 'missar',
  titel: 'Dina missar från tävlingen',
  beskrivning: 'Lägen där du bjöd annorlunda än rebidz. Öva tills de sitter.',
  intro:
    'Här samlas lägen ur dina tävlingsgivar där du valde ett annat bud än rebidz. Ett annat bud är inte alltid fel — men det är här systemet och din intuition går isär, så det är här det lönar sig att öva. Svarar du som rebidz försvinner läget ur listan.',
  paragraf: '§4–§7 beroende på läget',
  passar: () => false,
}
