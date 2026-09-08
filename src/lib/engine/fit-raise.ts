// HÖJNINGAR PÅ VISAD LÄNGD — den delade höjningslogiken för partnerns färg.
// Utbruten ur `auction-live.ts` i motorbytets etapp 4 familj 3 (2026-09-08)
// så att beslutstabellen (`auction-decide.ts`) kan läsa samma kunskap som det
// gamla lagrets catch-all (`offBookResponse`): EGEN hand + auktionsläget
// (`AuctionFacts`, läst ur auktionen ensam) → höjningen, eller null. Ingen
// annan hand finns att läsa här. Innehållet är oförändrat; bara formen är
// tabellens (hand + fakta i stället för detektorkontext). Familj 4
// ("höjningar på visad längd, lagen om totala stick") får sitt hem här.

import type { Bid, Hand } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { bidValue, cheapestBidIn, legalCalls, prettyBid, SWE_SYM } from './auction-rules'
import { dummyPoints } from './evaluation'
import { hcp, isBalanced, lengths } from './hand'
import { side } from './play'

/**
 * Var partnerns färg ett HOPP-inkliv över motståndarnas öppning? Ett svagt
 * hoppinkliv (t.ex. 2♥ över 1♣) lovar 6+ kort i färgen — då räcker 3-korts
 * stöd för fit (9 trumf), och en höjning är SPÄRR (lag om totala stick), inte
 * styrkevisning. (Felrapport #2, ägarbeslut 2026-07-02.)
 */
export function partnerJumpOvercalled(
  f: AuctionFacts,
  partnerSuit: { strain: string },
): boolean {
  const { history, seat } = f
  const open = f.opening
  if (!open || side(open.seat) === side(seat)) return false // inkliv kräver deras öppning
  let prevValue = 0
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    if (c.seat === PARTNER[seat] && cb.strain === partnerSuit.strain) {
      // Hopp = budet ligger en hel nivå över det billigaste lagliga i färgen.
      let minLevel = 1
      while (bidValue(minLevel, cb.strain) <= prevValue) minLevel++
      return cb.level > minLevel
    }
    prevValue = bidValue(cb.level, cb.strain)
  }
  return false
}

/**
 * Var partnerns färg ett BALANSINKLIV över motståndarnas öppning (deras
 * öppning, två pass, partnerns bud i utpassningsläget)? Då är "kungen redan
 * lånad" av balanseraren (§7.6: golven sänkta ~3 hp) — advancern ska räkna av
 * den i sin höjning i stället för att värdera samma styrka två gånger.
 * Byggd för svaga tvåor i fix 5a; generaliserad till ALLA öppningsnivåer
 * (även 1-läget) i F3 (C12, 2026-08-07).
 */
export function partnerBalanced(
  f: AuctionFacts,
  partnerSuit: { strain: string },
): boolean {
  const { history, seat } = f
  const openIdx = f.opening?.index ?? -1
  if (openIdx === -1 || openIdx + 3 >= history.length) return false
  if (side(history[openIdx].seat) === side(seat)) return false
  const entry = history[openIdx + 3]
  return (
    history[openIdx + 1].bid === 'P' &&
    history[openIdx + 2].bid === 'P' &&
    entry.seat === PARTNER[seat] &&
    parseContractBid(entry.bid)?.strain === partnerSuit.strain
  )
}

/**
 * Var partnerns färg ett ENKELT 1-LÄGESINKLIV över motståndarnas öppning
 * (pliktsvepet K3, ägarbeslut 2026-09-02)? Inklivet lovar 5+ → 3-korts stöd
 * är fit (8 trumf) och höjs från 6 poäng — men bara till 2-läget (lagen om
 * totala stick) och aldrig som hopp. Partnerns FÖRSTA kontraktsbud, på
 * 1-läget, i färgen, utan att jag agerat före det (då vore det ett svar på
 * min dubbling, inte ett inkliv).
 */
export function partnerSimpleOvercalled(f: AuctionFacts, partnerSuit: { strain: string }): boolean {
  const { history, seat } = f
  const open = f.opening
  if (!open || side(open.seat) === side(seat)) return false
  const idx = history.findIndex((c) => c.seat === PARTNER[seat] && parseContractBid(c.bid))
  if (idx === -1) return false
  const cb = parseContractBid(history[idx].bid)!
  if (cb.level !== 1 || cb.strain === 'NT' || cb.strain !== partnerSuit.strain) return false
  return !history.slice(0, idx).some((c) => c.seat === seat && c.bid !== 'P')
}

/**
 * Hur många trumf vi kräver för att kalla det fit i partnerns färg. Öppnade
 * partnern den HÖGfärgen på 1-läget lovar den 5+ → 3-korts stöd räcker (8-korts
 * fit). Samma sak när partnern HOPPINKLIVIT (6+ kort lovade). I alla andra fall
 * (minor, eller en högfärg som inte är öppningen) kräver vi 4+ för att vara
 * säkra på fit.
 */
export function fitLengthNeeded(f: AuctionFacts, partnerSuit: { strain: string; level: number }): number {
  const { history, seat } = f
  if (partnerJumpOvercalled(f, partnerSuit)) return 3
  // Har partnern BJUDIT färgen minst två gånger (öppnat + rebjudit) lovar den 6+
  // → 2-korts stöd räcker för fit (8-korts fit). Utan detta passade svararen en
  // dubbelton mot en rebjuden 6-korts högfärg (felrapport #19: 1♥ … 2♥ passades
  // med KT doubleton, 8-korts fit + utgångsvärden). UNDANTAG (fel färg-spåret
  // fix 4, frö 20260763): ett BILLIGT ombud som svarar på MIN egen dubbling
  // (samma nivå som deras inkliv — kunde vara 5-korts nödrebuden i
  // `openerAnswerNegativeDouble`) lovar ingen extralängd och räknas inte —
  // UTOM när partnern öppnade färgen med 1♥/1♠ (öppningen lovade redan 5+, så
  // dubbelton = 7-korts fit). Ett tvingat ombud som fick gå UPP en nivå kommer
  // däremot ur 6+-steget och räknas som vanligt (frö 20260771: 1♣–(1♦)–X–P–2♣
  // = 6 klöver, dubbelhöjning på dubbelton är rätt).
  const opening = f.opening
  const partnerOpened1Major =
    !!opening &&
    opening.seat === PARTNER[seat] &&
    opening.level === 1 &&
    opening.strain === partnerSuit.strain &&
    (opening.strain === 'H' || opening.strain === 'S')
  // F5/E2 (frö 20261885): det KONSTGJORDA 2♣-öppningsbudet är ingen klöverfärg
  // — utan detta räknades 2♣ + ett senare klöverbud som "bjudit klöver två
  // gånger → 6+" och dubbelton-stöd höjde till 5♣.
  const firstContractCall = history.find((c) => parseContractBid(c.bid))
  const partnerBidsInSuit = history.filter((c, idx) => {
    const cb = parseContractBid(c.bid)
    if (c.seat !== PARTNER[seat] || cb?.strain !== partnerSuit.strain) return false
    if (c === firstContractCall && c.bid === '2C') return false // konstgjord stark 2♣
    for (let i = idx - 1; i >= 0; i--) {
      if (history[i].bid === 'P') continue
      // Speldiagnosen S0 (frö 20260772): ett färgbud som SVARAR PÅ MIN CUE
      // (mitt bud i en färg motståndarna bjudit) efter partnerns egen
      // upplysningsdubbling visar exakt FYRA kort — det adderar ingen längd
      // och får inte räknas mot "två bud = 6+" (E höjde 3♥→4♥ på A9
      // dubbelton mot visade fyra; 4-2-utgången gick 6 bet).
      const prevCb = parseContractBid(history[i].bid)
      const svarPaMinCue =
        history[i].seat === seat &&
        !!prevCb &&
        history
          .slice(0, i)
          .some((c2) => {
            const cb2 = parseContractBid(c2.bid)
            return !!cb2 && cb2.strain === prevCb.strain && c2.seat !== seat && c2.seat !== PARTNER[seat]
          }) &&
        history.slice(0, idx).some((c2) => c2.seat === PARTNER[seat] && c2.bid === 'X')
      if (svarPaMinCue) return false
      const forcedByMyX = history[i].seat === seat && history[i].bid === 'X'
      if (!forcedByMyX) return true
      if (partnerOpened1Major) return true
      // Nivån på senaste kontraktsbudet före ombudet: samma nivå = billigt (5-korts möjligt).
      for (let j = i - 1; j >= 0; j--) {
        const prev = parseContractBid(history[j].bid)
        if (prev) return cb!.level > prev.level
      }
      return true
    }
    return true
  }).length
  if (partnerBidsInSuit >= 2) return 2
  if (partnerSimpleOvercalled(f, partnerSuit)) return 3 // K3: 1-lägesinkliv lovar 5+
  const isMajor = partnerSuit.strain === 'H' || partnerSuit.strain === 'S'
  const open = f.opening
  const partnerOpenedMajor =
    !!open && open.seat === PARTNER[seat] && open.strain === partnerSuit.strain && open.level === 1 && isMajor
  return partnerOpenedMajor ? 3 : 4
}

/**
 * Höj partnerns färg när vi har fit, graderat efter stödpoäng (dummyPoints):
 *   6–10 → enkel höjning · 11–12 → inbjudande hopp · 13+ → utgång (4 i hf).
 * Klampas till lagliga bud; räcker det inte ens till en enkel höjning passar vi.
 * Läser bara `hand` + auktionen i `f` — aldrig någon annan hand.
 */
export function raiseWithFit(
  hand: Hand,
  f: AuctionFacts,
  partnerSuit: { strain: string; level: number },
): ResolvedCall | null {
  const { history, seat } = f
  const suit = SUIT_OF_LETTER[partnerSuit.strain]
  if (lengths(hand)[suit] < fitLengthNeeded(f, partnerSuit)) return null

  // Har vi redan bjudit färgen själva höjer vi inte upp den igen (ingen upptrappning).
  if (history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === partnerSuit.strain)) return null

  // Dubbelton-"fit" (partnern har rebjudit sin färg — i ett krav ofta TVINGAT,
  // så ombudet lovar bara 5+) slår aldrig en EGEN redan visad 6+ färg: den egna
  // färgen är trumfen (fel färg-spåret fix 2: 2♣–2♦–3♣–3♠–4♣ → rebjud 4♠, höj
  // inte 5♣ på ♣85). Returnerar null → kravlogiken rebjuder den egna färgen.
  if (
    lengths(hand)[suit] === 2 &&
    SUIT_STRAINS.some(
      (st) =>
        lengths(hand)[SUIT_OF_LETTER[st]] >= 6 &&
        history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === st),
    )
  ) return null

  // Advancer-rabatt (fix 5a, generaliserad i F3): partnerns färgbud var en
  // BALANSERING över deras öppning (öppning, två pass, partnerns bud). Kungen är
  // redan lånad av balanseraren (golven sänkta ~3 hp) — räkna av den här, annars
  // värderas samma kung två gånger och höjningen blåser utgång på delkontrakts-
  // värden (frö 20260770: 2♠-balanseringen höjdes till 4♠ bet fast 3♠ = par;
  // F3-facit: 1♥–P–P–1♠ med 11 sp höjdes till invit-3♠ där 2♠ räcker).
  const balanced = partnerBalanced(f, partnerSuit)
  const sp = dummyPoints(hand, suit).dummyPoints - (balanced ? 3 : 0)
  if (sp < 6) return null // för svagt för att höja

  // En dubbelton-fit som bygger på ett TVINGAT ombud (partnerns svar på min
  // egen dubbling) höjs bara med UTGÅNGSVÄRDEN (13+ stödpoäng, då jagar
  // höjningen en utgång som 4M/5m). En enkel/inbjudande höjning på dubbelton
  // pressar bara upp partnerns MINIMUM en nivå utan syfte (fel färg-spåret
  // fix 4, frön 20260847/20261251: 2♦/2♥ → 3♦/3♥ bet, fast ombudet stod).
  if (lengths(hand)[suit] === 2 && sp < 13) {
    const partnerForcedRebidInSuit = history.some((c, idx) => {
      const cb = parseContractBid(c.bid)
      if (c.seat !== PARTNER[seat] || cb?.strain !== partnerSuit.strain) return false
      for (let i = idx - 1; i >= 0; i--) {
        if (history[i].bid === 'P') continue
        return history[i].seat === seat && history[i].bid === 'X'
      }
      return false
    })
    if (partnerForcedRebidInSuit) return null
  }

  // FIX 6 mönster 1: har partnern just PASSAT i konkurrensen har hen visat
  // minimum utan utgångsintresse — höjningen är då bara TÄVLANDE: billigaste
  // nivån, aldrig invit/utgångsblås (frön 20261090/20261409/20261459: negativ-
  // dubblaren blåste 5♣ på 13–16 stödpoäng fast öppnaren passat; 2♣/3♣ räcker).
  // K3 (2026-09-02): 3-korts stöd för partnerns enkla 1-lägesinkliv = 8 trumf →
  // höjningen stannar på 2-LÄGET (lagen om totala stick), aldrig hopp eller
  // utgång på tre kort; pressade de upp billigaste höjningen till 3-läget → pass.
  const threeCardOvercallFit = lengths(hand)[suit] === 3 && partnerSimpleOvercalled(f, partnerSuit)
  if (threeCardOvercallFit && hcp(hand) < 6) return null // ägarens golv: 6 hp för höjningen på tre kort

  const partnerLastCall = [...history].reverse().find((c) => c.seat === PARTNER[seat])
  if (partnerLastCall?.bid === 'P' && f.opponentsHaveBid) {
    const bid = cheapestBidIn(history, seat, partnerSuit.strain)
    if (!bid) return null
    const cb = parseContractBid(bid)!
    const game = partnerSuit.strain === 'H' || partnerSuit.strain === 'S' ? 4 : 5
    if (cb.level >= game) return null // tävla inte till utgångsnivå mot en passad partner
    if (threeCardOvercallFit && cb.level > 2) return null // 8 trumf tävlar inte till 3-läget
    return {
      seat, bid,
      explanation: `Fit i partnerns ${SWE_SYM[partnerSuit.strain]}, men partnern har passat (minimum) → ${prettyBid(bid)} (tävlande höjning, ej invit).`,
    }
  }

  // Partnern hoppinklev (svagt, 6+ kort) → höjningen är SPÄRR: en nivå upp,
  // aldrig styrkegraderad (partnern har max ~9 hp – utgångsblås vore fel).
  if (partnerJumpOvercalled(f, partnerSuit)) {
    const bid = `${partnerSuit.level + 1}${partnerSuit.strain}` as Bid
    if (legalCalls(history, seat).includes(bid)) {
      return {
        seat,
        bid,
        explanation: `Höjer partnerns spärr – 3+ stöd mot ett hoppinkliv (6+ kort) gör det svårare för motståndarna.`,
      }
    }
    return null
  }

  const isMajor = partnerSuit.strain === 'H' || partnerSuit.strain === 'S'

  // Minorfit med UTGÅNGSVÄRDEN (13+ stödpoäng): nå utgång i stället för att kapa
  // vid en inbjudan (grunden "rätt nivå med fit", 2026-07-05). Balanserad hand →
  // 3NT (enklare utgång med 25 stick); annars minorutgången 5m. (Förr stannade
  // motorn alltid på ett inbjudande hopp för minor – aldrig utgång.)
  if (!isMajor && sp >= 13) {
    const legal = legalCalls(history, seat)
    if (isBalanced(hand) && legal.includes('3NT' as Bid)) {
      return {
        seat, bid: '3NT' as Bid,
        explanation: `Fit i partnerns ${SWE_SYM[partnerSuit.strain]} + utgångsvärden, balanserad → 3NT.`,
      }
    }
    const gameBid = `5${partnerSuit.strain}` as Bid
    if (legal.includes(gameBid)) {
      return {
        seat, bid: gameBid,
        explanation: `Fit i partnerns ${SWE_SYM[partnerSuit.strain]} + utgångsvärden → minorutgång ${gameBid}.`,
      }
    }
    // Varken 3NT eller 5m lagligt (konkurrensen tryckte upp budet) → fall vidare.
  }

  // Önskad nivå efter styrka. Högfärgsutgång = 4-läget; minorutgång sköts ovan.
  let wantLevel: number
  let label: string
  if (sp >= 13 && isMajor) {
    wantLevel = 4
    label = `utgång`
  } else if (sp >= 11) {
    wantLevel = partnerSuit.level + 2
    label = `inbjudande hopp`
  } else {
    wantLevel = partnerSuit.level + 1
    label = `enkel höjning`
  }
  // Mot en balansering kapas dessutom vid 3-LÄGET utan äkta utgångsvärden
  // efter rabatten (fix 5a): ett inbjudande hopp över ett 2-läges balansinkliv
  // vore redan utgångsnivån.
  // (K3, frö 20263212: taket 3 låg UNDER en enkel höjning av ett 3-läges
  // balansinkliv (2♠)–P–P–3♦, så fem trumf mot 6+ = 11 trumf passades — taket
  // får aldrig hindra själva den enkla höjningen.)
  if (balanced && sp < 13) wantLevel = Math.min(wantLevel, Math.max(3, partnerSuit.level + 1))
  if (threeCardOvercallFit) {
    wantLevel = 2
    label = `enkel höjning (3-korts stöd mot 1-lägesinkliv, 8 trumf – tävlar bara till 2-läget)`
  }
  // En inbjudande/enkel höjning får ALDRIG gå förbi utgång (felrapport #33: en
  // "inbjudande hopp" = level+2 blåste 7♦ över partnerns 5♦). Kapa vid utgångs-
  // nivån (högfärg 4, lågfärg 5). Har partnern REDAN nått utgång och vi bara har
  // inbjudningsvärden (slamvärden sköts ovan via sp≥13-grenarna) → passa i stället
  // för att pressa upp i slam.
  const gameLevel = isMajor ? 4 : 5
  wantLevel = Math.min(wantLevel, gameLevel)
  if (wantLevel < partnerSuit.level + 1) return null

  const legal = legalCalls(history, seat)
  // Sänk till lägsta lagliga höjning om önskenivån inte går (konkurrensen tryckt upp budet).
  for (let level = wantLevel; level >= partnerSuit.level + 1; level--) {
    const bid = `${level}${partnerSuit.strain}` as Bid
    if (legal.includes(bid)) {
      return {
        seat,
        bid,
        explanation: `Stöd för partnerns ${SWE_SYM[partnerSuit.strain]} – ${label} med fit.`,
      }
    }
  }
  return null
}
