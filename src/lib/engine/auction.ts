// Manuset — det som är kvar av det (motorbytet, docs/motorbyte-plan.md).
//
// Sedan etapp 3 familj 6 (2026-09-05) avgör `buildAuction` INGA bud i en ostörd
// auktion: öppningen, svaret och hela fortsättningen spelas ut stol för stol ur
// beslutstabellen (`auction-decide.ts`) — samma beslut som stolen tar vid
// bordet, ur egen hand + auktionen. Det manuset fortfarande äger är
//   · konkurrensronden (LHO:s inkliv/X/DONT/försvar, svararens svar på det,
//     advancern, balanseringen, den starka dubblingen, stöddubblingen) — den
//     flyttar in i tabellen familj för familj i etapp 4;
//   · flaggan `open`: får det gamla lagrets konkurrensdetektorer bjuda vidare
//     när tabellen tiger, eller är resten bara avslutande pass?
// När etapp 4 är klar blir `buildAuction` hjälparen "spela ut fyra stolar"
// (jfr `botAuction` i revisor.ts) och `open` försvinner.
//
// Överst: den lilla hjälparen för titta-läget (första 1♥/1♠-öppningen + svar).

import type { Deal, Seat } from '../../types/bridge'
import { seatAt } from '../bidding'
import { dealRandom } from './deal'
import { classifyOpening, isVulnerable } from './openings'
import { decideFromTable, RESPONDABLE, type DecidedCall, type Decision } from './auction-decide'
import { auctionFacts } from './auction-facts'
import type { ResolvedCall } from '../bidding'
import { respondToMajor, type Major, type ResponseResult } from './responses'
import type { Forcing, Suit } from '../../types/bridge'
import { forcingOf, isAlertRule } from './rules'
import { conventionalDefense } from './defense-conventional'

export interface MajorAuction {
  openerSeat: Seat
  openCall: string // '1H' eller '1S'
  openSuit: Major
  responderSeat: Seat
  response: ResponseResult
}

const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/**
 * Går runt bordet från given. Om den FÖRSTA öppningen är 1♥/1♠ returneras
 * öppnare + partnerns svar. Annars null (ingen ren högfärgsöppning den given).
 */
export function firstMajorOpeningAuction(deal: Deal): MajorAuction | null {
  for (let i = 0; i < 4; i++) {
    const seat = seatAt(deal.dealer, i)
    const open = classifyOpening(deal.hands[seat], isVulnerable(seat, deal.vulnerability))
    if (open.call === 'P') continue
    if (open.call === '1H' || open.call === '1S') {
      const openSuit: Major = open.call === '1H' ? 'hearts' : 'spades'
      const responderSeat = PARTNER[seat]
      return {
        openerSeat: seat,
        openCall: open.call,
        openSuit,
        responderSeat,
        response: respondToMajor(deal.hands[responderSeat], openSuit),
      }
    }
    return null // första öppningen var något annat än 1♥/1♠
  }
  return null // alla passade
}

/** Slumpar givar tills en med ren 1♥/1♠-öppning dyker upp. */
export function dealWithMajorOpening(maxTries = 300): { deal: Deal; auction: MajorAuction } | null {
  for (let i = 0; i < maxTries; i++) {
    const deal = dealRandom()
    const auction = firstMajorOpeningAuction(deal)
    if (auction) return { deal, auction }
  }
  return null
}

// ---- Manuset: konkurrensronden + den ostörda linjen ur tabellen -------------
// `turns` = vår sidas bud (och konkurrensrondens) i ordning; motståndarnas
// pass fylls i av `turnsToCalls`. Auktionen växer så långt tabellen har regler;
// tiger den markeras auktionen som öppen eller stängd enligt reglerna längst
// ner i `buildAuctionCore`.

const PARTNER_OF: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const OPEN_SUIT: Record<string, Major | 'clubs' | 'diamonds'> = {
  '1C': 'clubs', '1D': 'diamonds', '1H': 'hearts', '1S': 'spades',
}

export interface AuctionTurn {
  seat: Seat
  role: 'öppnare' | 'svarare' | 'motståndare'
  call: string
  rule: string
  explanation: string
  uncertain?: boolean
  /** Kravnivå (§2), härledd ur `rule` via regelregistret. Frivillig. */
  forcing?: Forcing
  /** Konstgjort/alertpliktigt bud, härlett ur `rule` via registret. Frivilligt. */
  alert?: boolean
}

export interface BuiltAuction {
  openerSeat: Seat
  responderSeat: Seat
  openCall: string
  turns: AuctionTurn[]
  /** Sant så länge motorn ännu inte har regler för nästa bud i sekvensen. */
  open: boolean
}

// ---- Störd budgivning (punkt 27): motståndaren kliver in på riktigt --------

/** Tolkar ett inkliv ("1S"/"2H"/"X"/"2NT") → nivå + ev. färg. */
function parseBid(call: string): { level: number; suit: Suit | null } {
  const m = call.match(/^([1-7])(C|D|H|S)$/)
  if (m) return { level: parseInt(m[1], 10), suit: { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }[m[2]] as Suit }
  const nt = call.match(/^([1-7])NT$/)
  if (nt) return { level: parseInt(nt[1], 10), suit: null }
  return { level: 0, suit: null }
}

// (`pairControlsSideSuits` — kontroll-gaten som läste BÅDA händerna — togs bort
// 2026-07-07, ägarbeslutet "ärliga slamportar": ingen kontrollkoll, lita på
// poängen + nyckelkortssvaret. Bottarna kan därmed, som människor, någon gång
// bjuda en slam där motståndarna tar två snabba stick.)

/** Bygger linjen för given: öppning och ostörd fortsättning ur tabellen, EN modellerad konkurrensrond. */
// Minne per giv (R2-fynd #3): `buildAuction` är en ren funktion av given, och
// samma giv byggs om vid VARJE bot-tur (`decideCall` anropar den varje gång) och
// vid varje omritning i spelskärmen. En `WeakMap` på giv-objektet återanvänder den
// redan byggda linjen i stället för att räkna om den. Säkert eftersom given är
// oföränderlig under handen och alla anropare bara LÄSER resultatet. WeakMap →
// posten städas automatiskt när given inte längre används (inget minnesläckage).
const auctionCache = new WeakMap<Deal, BuiltAuction | null>()

export function buildAuction(deal: Deal): BuiltAuction | null {
  const cached = auctionCache.get(deal)
  if (cached !== undefined) return cached // OBS: null är ett giltigt cachat svar (ingen öppnar)
  const result = buildAuctionCore(deal)
  auctionCache.set(deal, result)
  return result
}

function buildAuctionCore(deal: Deal): BuiltAuction | null {
  // Öppningen tas ur BESLUTSTABELLEN (motorbytet etapp 3 familj 1, 2026-09-04):
  // manuset härleds ur stolarnas beslut, inte tvärtom. Varje stol får bara sin
  // egen hand + passen hittills — samma väg som `decideCall` tar vid bordet.
  let openerSeat: Seat | null = null
  let openerIndex = -1
  let opening: { call: string; rule: string; explanation: string; uncertain?: boolean } | null = null
  const passes: ResolvedCall[] = []
  for (let i = 0; i < 4; i++) {
    const seat = seatAt(deal.dealer, i)
    const d: DecidedCall = decideFromTable(deal.hands[seat], auctionFacts(passes, seat), isVulnerable(seat, deal.vulnerability))!.call
    if (d.bid !== 'P') {
      openerSeat = seat
      openerIndex = i
      opening = { call: d.bid, rule: d.rule!, explanation: d.explanation!, uncertain: d.uncertain }
      break
    }
    passes.push({ seat, bid: 'P' })
  }
  if (!openerSeat || !opening) return null

  const responderSeat = PARTNER_OF[openerSeat]
  const turns: AuctionTurn[] = [
    { seat: openerSeat, role: 'öppnare', call: opening.call, rule: opening.rule, explanation: opening.explanation, uncertain: opening.uncertain },
  ]

  // Auktionen hittills som varje stol ser den (etapp 3 familj 6 / etapp 4
  // familj 1): tabellen frågas stol för stol med motståndarnas pass ifyllda.
  const history: ResolvedCall[] = [...passes, { seat: openerSeat, bid: opening.call as ResolvedCall['bid'], rule: opening.rule, explanation: opening.explanation }]
  /** Stolens beslut ur tabellen, med motståndarnas pass ifyllda fram till stolen (den ostörda linjen). */
  const ask = (seat: Seat): Decision | null => {
    while (seatAt(deal.dealer, history.length) !== seat) history.push({ seat: seatAt(deal.dealer, history.length), bid: 'P' })
    return decideFromTable(deal.hands[seat], auctionFacts(history, seat), isVulnerable(seat, deal.vulnerability))
  }
  const lay = (seat: Seat, d: DecidedCall) => {
    turns.push({ seat, role: seat === openerSeat ? 'öppnare' : 'svarare', call: d.bid, rule: d.rule!, explanation: d.explanation!, uncertain: d.uncertain })
    history.push({ seat, bid: d.bid, rule: d.rule, explanation: d.explanation })
  }
  /** Motståndarens tur ur tabellen (etapp 4 familj 1: inkliv, advance, balansering) — samma beslut som vid bordet. */
  const layOpp = (seat: Seat, d: DecidedCall) => {
    turns.push({ seat, role: 'motståndare', call: d.bid, rule: d.rule!, explanation: d.explanation!, uncertain: d.uncertain })
    history.push({ seat, bid: d.bid, rule: d.rule, explanation: d.explanation })
  }

  // Enda chokepoint för att bygga resultatet: fyller varje turns kravnivå
  // (§2) ur regelregistret innan auktionen returneras, så `forcing` alltid
  // härleds ur SAMMA regel som budet.
  const finish = (open: boolean): BuiltAuction => {
    for (const t of turns) {
      if (t.forcing === undefined) t.forcing = forcingOf(t.rule)
      if (t.alert === undefined) t.alert = isAlertRule(t.rule)
    }
    return { openerSeat: openerSeat!, responderSeat, openCall: opening!.call, turns, open }
  }

  // Öppningar vi inte har svarsregler för ännu: visa bara öppningen.
  if (!RESPONDABLE.has(opening.call)) {
    return finish(true)
  }

  // Störd budgivning (punkt 27): efter en 1-läges färgöppning kan LHO kliva in.
  // Inklivet tas ur BESLUTSTABELLEN (etapp 4 familj 1, 2026-09-08: raden
  // *inkliv* = `overcall` ur LHO:s egen hand) — samma beslut som vid bordet.
  const openerSuit = OPEN_SUIT[opening.call]
  if (openerSuit) {
    const lhoSeat = seatAt(deal.dealer, (openerIndex + 1) % 4)
    const ov = ask(lhoSeat)?.call ?? { seat: lhoSeat, bid: 'P' as ResolvedCall['bid'], rule: 'pass', explanation: '' }
    if (ov.bid !== 'P') {
      layOpp(lhoSeat, ov)
      // Svararens konkurrensbeslut ur tabellen (etapp 4 familj 3, 2026-09-08:
      // raden *svar-stört* = `contestedResponse` ur svararens egen hand) —
      // samma beslut som vid bordet, även när inklivet inte var det väntade.
      const action = ask(responderSeat)?.call ?? { seat: responderSeat, bid: 'P' as ResolvedCall['bid'], rule: 'pass', explanation: 'Inget lämpligt → pass.' }
      lay(responderSeat, action)
      // En upplysningsdubbling som svararen passar är INTE utbjuden: advancern
      // (LHO:s partner) är skyldig att svara. Lämna auktionen öppen så vi inte
      // härleder ett felaktigt "passat ut"-kontrakt – det levande svaret bjuds i
      // budlådan (decideCall). Övriga konkurrensgrenar modelleras en rond.
      if (ov.bid === 'X' && action.bid === 'P') {
        return finish(true)
      }
      // Svararen bjöd ÖVER partnerns upplysningsdubbling: advancerns fria svar
      // (responsiv dubbling efter höjningen, §7.4; annars värde-/formstyrt
      // fritt bud, §7.3) kommer ur tabellen (etapp 4 familj 2, raden *x-svar*)
      // — samma beslut som vid bordet. Dubblarens fortsättning bjuds levande.
      if (ov.bid === 'X') {
        const advancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
        const adv = ask(advancerSeat)?.call
        if (adv && adv.bid !== 'P') layOpp(advancerSeat, adv)
        return finish(true)
      }
      // Advancer-logik (punkt 10, §7.1): efter partnerns enkla 1-läges inkliv och
      // svararens pass svarar advancern (inklivarens partner): höjning, cue =
      // limithöjning+, ny färg, NT eller fit-jump. Bara i det ostörda advance-
      // läget (svararen passade) över ett 1-läges inkliv, så budet blir lagligt.
      // Sedan etapp 4 familj 1 kommer advancerns bud ur tabellen (raden
      // *advance* = `advanceOvercall` ur advancerns egen hand).
      if (ov.rule === 'enkelt inkliv' && /^1[CDHS]$/.test(ov.bid) && action.bid === 'P') {
        const partnerSuit = parseBid(ov.bid).suit
        if (partnerSuit) {
          const advancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
          const adv = ask(advancerSeat)?.call
          if (adv) layOpp(advancerSeat, adv)
          // Auktionen är INTE död när advancern passar (felrapport #38): öppnaren
          // sitter då i utpassningssitsen och ska få återöppningsfrågan
          // (openerReopensBalancing i decideCall) — annars säljs given i 1-läget.
          return finish(true)
        }
      }
      // Advancer-logik över ett 1NT-INKLIV (§4.3, systems on – uppföljning
      // felrapport #53): partnerns 1NT-inkliv (15–18 bal) visar samma sorts hand
      // som en 1NT-öppning, så efter svararens pass kör advancern sangsystemet
      // (Stayman/transfer/Texas/MSS) precis som över en öppning. Lämna auktionen
      // ÖPPEN – inklivaren fullföljer (transfer/Stayman-svar) levande i budlådan.
      if (ov.rule === '1NT-inkliv' && action.bid === 'P') {
        const advancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
        const adv = ask(advancerSeat)?.call
        if (adv) layOpp(advancerSeat, adv)
        return finish(true)
      }
      // Advancer-logik för TVÅFÄRGSINKLIV (§7.2, Michaels / ovanlig 2NT): efter
      // partnerns tvåfärgsbud och svararens pass ger advancern preferens till sin
      // längsta av partnerns visade färger – i en OSTÖRD budgivning aldrig pass
      // (felrapport #14: linjen 1♠–2NT–P stängdes med advancern passande, så
      // advanceTwoSuiter nåddes aldrig och Syd fick pass som förslag). Utan denna
      // gren föll tvåfärgsinklivet till finish(false) och auktionen dog en rond
      // för tidigt.
      if ((ov.rule === 'Michaels' || ov.rule === 'ovanlig 2NT') && action.bid === 'P') {
        const advancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
        const adv = ask(advancerSeat)?.call
        if (adv) layOpp(advancerSeat, adv)
        return finish(!!adv && adv.bid !== 'P')
      }
      // Svararen PASSADE ett naturligt inkliv (2-läges, eller ett 1-läges inkliv
      // som inte är "enkelt inkliv"): buildAuction stängde förr given här och
      // öppnaren SÅLDE den (flerronds del B, proben giv #56 + #552). Men auktionen
      // är inte slut – advancern (RHO) och öppnarens ÅTERÖPPNING i utpassningssitsen
      // bjuds levande i budlådan (decideCall), precis som takeout-X/Michaels-
      // grenarna ovan. Lämna öppen. (Ett äkta pass-ut faller ändå ut live – samma
      // slutkontrakt – medan en återöppningshand nu tävlar i stället för att sälja.)
      if (action.bid === 'P' && parseBid(ov.bid).suit) {
        return finish(true)
      }
      return finish(action.bid !== 'P')
    }
  }

  // §7.5 försvar mot deras 1NT (naturligt inkliv / DONT): LHO stör direkt. Sedan
  // etapp 4 familj 6 (2026-09-09) kommer inklivet ur BESLUTSTABELLEN (raden
  // *försvar-1nt* = `defendTheirNT` ur LHO:s egen hand) — samma beslut som vid
  // bordet. Vi modellerar bara SJÄLVA inklivet (en rond) och lämnar auktionen
  // öppen: advancerns relä/preferens och X-arens rättelse bjuds levande i
  // budlådan (`decideCall`). Balansering hanteras nedan (också via tabellen).
  if (opening.call === '1NT') {
    const lhoSeat = seatAt(deal.dealer, (openerIndex + 1) % 4)
    const ov = ask(lhoSeat)?.call
    if (ov && ov.bid !== 'P') {
      layOpp(lhoSeat, ov)
      return finish(true)
    }
  }

  // §7.6 Försvar mot deras SVAGA TVÅA (2♦/2♥/2♠) eller SPÄRR (3-läget+) — Fynd #2
  // delbit 2. LHO stör direkt (takeout-X/2NT/cue/naturligt/3NT). Ägarbeslut
  // 2026-07-04: takeout-golv 12 hp ej sårbar / 13 sårbar i direkt sits. Vi
  // modellerar bara själva inklivet (en rond) och lämnar auktionen öppen –
  // svaret på ett takeout-X (level-medvetet, Fynd #5) och övriga fortsättningar
  // bjuds levande i budlådan (`decideCall`). 2♣/1NT hanteras inte här.
  {
    const lhoSeat = seatAt(deal.dealer, (openerIndex + 1) % 4)
    const def = conventionalDefense(deal.hands[lhoSeat], opening.call, {
      vulnerable: isVulnerable(lhoSeat, deal.vulnerability),
      balancing: false,
    })
    if (def && def.call !== 'P') {
      turns.push({ seat: lhoSeat, role: 'motståndare', call: def.call, rule: def.rule, explanation: def.explanation })
      return finish(true)
    }
  }

  // Svaret ur BESLUTSTABELLEN (etapp 3 familj 2, 2026-09-04): samma beslut som
  // `decideCall` tar vid bordet, ur svararens hand + auktionen hittills (passad
  // hand → Drury läses ur passen före öppningen). Gerber-handens 4♣ över
  // 1NT/2NT kommer samma väg (`gerberAsk`); essfrågan spelas sedan ut tur för
  // tur i tabell-loopen längst ner (raden *slam*) — familj 6 rev de två
  // tvåhandsförarna som förut byggde hela Gerber-sekvensen här.
  const response = ask(responderSeat)?.call
  if (!response) return finish(true)
  lay(responderSeat, response)

  // Svararen passade → given är på väg att passas ut till öppningsbudet.
  // BALANSERING (felrapport #5): innan kontraktet sätts får fjärde hand
  // (utpassningsläget) en riktig §7-chans – given ska inte dö när balanserings-
  // sitsen har ett klart inkliv/X på handen. "Låna en kung" (2026-07-05):
  // `balancing=true` sänker §7-golven med 3 hp (partnern är markerad med värden).
  // Fortsättningen (advancerns höjning m.m.) bjuds levande i budlådan
  // (`decideCall`), därför lämnas auktionen öppen.
  if (response.bid === 'P') {
    // Balanseringen ur tabellen (etapp 4 familj 1: raden *inkliv* i
    // utpassningsläget = `overcall(…, balancing)` ur fjärde hands egen hand).
    if (openerSuit) {
      const balancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
      const bal = ask(balancerSeat)?.call
      if (bal && bal.bid !== 'P') {
        layOpp(balancerSeat, bal)
        return finish(true)
      }
    }
    // §7.5 DONT i balansering: deras 1NT passas ut till fjärde hand. Sedan etapp
    // 4 familj 6 kommer budet ur tabellen (raden *försvar-1nt* i utpassnings-
    // sitsen = `defendTheirNT(…, balancing)` ur fjärde hands egen hand, golv 6 hp).
    if (opening.call === '1NT') {
      const balancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
      const bal = ask(balancerSeat)?.call
      if (bal && bal.bid !== 'P') {
        layOpp(balancerSeat, bal)
        return finish(true)
      }
    }
    // §7.6 balansering mot deras svaga tvåa/spärr (Fynd #2 delbit 2): passas
    // öppningen runt till fjärde hand får den ett lättare försvar – ägarbeslut:
    // takeout-golv 10 hp i balansering. Alla försvarsbud ligger över öppningen.
    {
      const balancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
      const def = conventionalDefense(deal.hands[balancerSeat], opening.call, {
        vulnerable: isVulnerable(balancerSeat, deal.vulnerability),
        balancing: true,
      })
      if (def && def.call !== 'P') {
        turns.push({ seat: balancerSeat, role: 'motståndare', call: def.call, rule: def.rule, explanation: `${def.explanation} (balansering)` })
        return finish(true)
      }
    }
    return finish(false)
  }

  // Dubblingssitsen efter TVÅ bjudna färger (§7.3; etapp 4 familj 2,
  // 2026-09-08): motståndarna har bjudit öppning + svar i ny 1-lägesfärg
  // (t.ex. 1♦–P–1♥) och spelaren direkt över svararen får sitt beslut ur
  // tabellen (raden *dubbling* = `takeoutOfResponse` ur egen hand: 4-4 i de
  // objudna från 10 hp, eller den starka 17+-enfärgshanden). Förr modellerade
  // manuset bara den starka dubblingen här (F6, 2026-08-08) och den vanliga
  // 4-4:an fanns bara i det gamla lagret — nu är den ett beslut som alla
  // andra. Fortsättningen (tvångssvaret, det starka återbudet, öppnarens
  // fortsättning) bjuds levande. RHO:s naturliga INKLIV över svaret kommer
  // sedan etapp 4 familj 4 (2026-09-08) ur samma fråga (raden
  // *inkliv-över-svaret* = `overcallOfResponse` ur RHO:s egen hand):
  // manusets gamla stöddubblingsrond lade det bara när ÖPPNAREN hade exakt
  // tre stöd (en kik) och revs i familj 3; nu är det ett beslut som alla
  // andra, och öppnarens återbud efter inklivet kommer ur tabellen
  // (*stöd-x*, *öppnaren-stört*) när resten bjuds levande.
  const respNew = parseBid(response.bid)
  if (openerSuit && respNew.level === 1 && respNew.suit && respNew.suit !== openerSuit) {
    const rhoSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
    const x = ask(rhoSeat)?.call
    if (x && x.bid !== 'P') {
      layOpp(rhoSeat, x)
      return finish(true)
    }
  }

  // ---- Den ostörda fortsättningen: stol för stol ur beslutstabellen ---------
  // Sedan familj 6 (2026-09-05, docs/motorbyte-plan.md) avgör manuset INGET
  // bud här. Varje tur är exakt det beslut stolen tar vid bordet
  // (`decideFromTable`: egen hand + auktionen hittills, aldrig partnerns kort),
  // och motståndarna passar. Det enda manuset tillför är svaret på frågan "är
  // auktionen ÖPPEN när tabellen tiger?" — dvs. om det gamla lagrets
  // konkurrensdetektorer får bjuda vidare (`lineExhaustedOpen` i `decideCall`)
  // eller om resten bara är avslutande pass. Reglerna är de rivna grenarnas,
  // oförändrade (auktionsdiffen noll vid rivningen):
  //   · slamraden har bjudit (en slamsekvens spelades) och tabellen tiger →
  //     sekvensen är slut → stängd;
  //   · stolen passade, eller partnerns bud var en placering (`avslut`) → stängd;
  //   · öppnarens återbud / svararens andra bud / öppnarens tredje bud saknar
  //     regel → öppen (det gamla lagret fortsätter som förut);
  //   · svararens tredje bud saknar regel → öppen bara efter fjärde färg / NMF
  //     (slamvägen med 18+ resp. oläsbart NMF-svar), annars stängd;
  //   · därefter → stängd.
  // Flaggan och reglerna försvinner med det gamla lagret (etapp 4).
  let seat = openerSeat
  let settled = false // partnerns senaste bud var en placering (`avslut`)
  let slamPlayed = false // slamraden har bjudit → sekvensen tar slut när den tiger
  for (let guard = 0; guard < 24; guard++) {
    const dec = ask(seat)
    const d = dec?.call ?? null
    if (!d) {
      if (settled || slamPlayed) return finish(false)
      const n = turns.length // våra turer hittills: öppning, svar, återbud, …
      if (n <= 4) return finish(true)
      if (n === 5) return finish(turns[3].rule === 'fjärde färg krav' || turns[3].rule === 'New Minor Forcing')
      return finish(false)
    }
    lay(seat, d)
    if (d.bid === 'P') return finish(false)
    settled = d.avslut === true
    if (dec!.källa === 'tabell:slam') slamPlayed = true
    seat = PARTNER_OF[seat]
  }
  return finish(false)
}

/** Slumpar givar tills en med en öppning vi kan bygga vidare på dyker upp. */
export function dealWithAuction(maxTries = 300): { deal: Deal; auction: BuiltAuction } | null {
  for (let i = 0; i < maxTries; i++) {
    const deal = dealRandom()
    const auction = buildAuction(deal)
    if (auction && auction.turns.length >= 2) return { deal, auction }
  }
  return null
}
