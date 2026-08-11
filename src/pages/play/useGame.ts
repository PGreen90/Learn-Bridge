// Spelets fas-styrning (budgivning → kortspel) som en hook: given, den levande
// budföljden, kontraktväljarens mål + givsökningen. All spellogik för budfasen
// bor här — komponenterna i BiddingPhase/PlayTable är bara presentation.

import { useEffect, useRef, useState } from 'react'
import type { Bid, Deal, Hand, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../../lib/bidding'
import {
  auctionComplete,
  contractFromCalls,
  decideCall,
  legalCalls,
  seatToAct,
} from '../../lib/engine/auction-live'
import { interpretCall } from '../../lib/engine/auction-interpret'
import { dealRandom, mulberry32 } from '../../lib/engine/deal'
import { dailyDeal, dailyDealByNumber } from '../../lib/engine/daily'
import { matchesTarget, type ContractTarget } from '../../lib/engine/contract-target'
import { loadBidHelp, loadPlayTarget, savePlayTarget, saveBidHelp } from '../../lib/backend'
import type { Contract } from '../../lib/engine/play'

// En giv går genom två faser: först budgivningen (du klickar Syds bud i budlådan,
// datorn budar V/N/Ö ett i taget runt bordet), sedan kortspelet ur de verkliga
// buden. `contract` är null tills budgivningen är klar.
export interface Game {
  deal: Deal
  /** Den levande budföljden, ett bud i taget runt bordet. */
  history: ResolvedCall[]
  phase: 'bidding' | 'play'
  contract: Contract | null
  /** Slumpfröet som återskapar given (Etapp B) — null för dagens giv. */
  seed: number | null
  /** Omgångsräknare: "Spela om given" ger samma frö men monterar om bordet
   *  (spelbordet är key:at på deal.id + round). */
  round: number
}

function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296)
}

const SEAT_ORDER: Seat[] = ['N', 'E', 'S', 'W']

/** Rotera en giv så att den ursprungliga stolen `sitt` hamnar i SYD (spelaren
 *  budar alltid Syd). Händer, given och zonen roteras konsekvent → en EXAKT
 *  motsvarande auktion, bara speglad till din sida. Dev-verktyg (#/spela-kort?
 *  giv=frö&sitt=E) för att kunna bjuda en utpekad hand i sin helhet från rätt
 *  stol — t.ex. en E/V-slam ur systemrevisorn. */
export function seatDealSouth(deal: Deal, sitt: Seat): Deal {
  const shift = (2 - SEAT_ORDER.indexOf(sitt) + 4) % 4
  if (shift === 0) return deal
  const hands = {} as Record<Seat, Hand>
  SEAT_ORDER.forEach((seat, i) => {
    hands[seat] = deal.hands[SEAT_ORDER[(i - shift + 4) % 4]]
  })
  const dealer = SEAT_ORDER[(SEAT_ORDER.indexOf(deal.dealer) + shift) % 4]
  // Udda rotation byter partnerskap → zonen för N/S och Ö/V byter plats.
  const vul =
    shift % 2 === 0
      ? deal.vulnerability
      : deal.vulnerability === 'ns'
        ? 'ew'
        : deal.vulnerability === 'ew'
          ? 'ns'
          : deal.vulnerability
  return { ...deal, hands, dealer, vulnerability: vul }
}

/** En giv ur ett frö — id:t bär fröet så given kan pekas ut och återskapas.
 *  `sitt` (dev): rotera så den stolen sitter i Syd (standard S = ingen rotation). */
export function gameFromSeed(seed: number, round = 0, sitt: Seat = 'S'): Game {
  const base = { ...dealRandom(mulberry32(seed)), id: `giv-${seed}${sitt === 'S' ? '' : '-' + sitt}` }
  return { deal: seatDealSouth(base, sitt), history: [], phase: 'bidding', contract: null, seed, round }
}

function newGame(): Game {
  return gameFromSeed(randomSeed())
}

/** En giv ur en FÄRDIGDELAD Deal (Beslut B etapp 2, tävlingen): given kommer
 *  från servern (hemligt frö), inte ur ett klient-sifferfrö — därför `seed: null`
 *  precis som dagens giv. Budfasen och kortspelet körs sedan som vanligt. */
export function gameFromDeal(deal: Deal, round = 0): Game {
  return { deal, history: [], phase: 'bidding', contract: null, seed: null, round }
}

/** Dagens giv: given kommer ur datumfröet i stället för slumpen (daily.ts).
 *  `nr` (kalenderarkivet): ett givnummer ur arkivet — annars dagens. */
function newDailyGame(round = 0, nr?: number): Game {
  const deal = nr === undefined ? dailyDeal() : dailyDealByNumber(nr)
  return { deal, history: [], phase: 'bidding', contract: null, seed: null, round }
}

export interface SearchState {
  tried: number
  gaveUp: boolean
}

/** `daily` = Dagens giv-läget: startgiven är dagens deterministiska giv.
 *  "Ny giv" i det läget hanteras av sidan (navigerar till frispelet).
 *  `initial` (Etapp B): ett färdigt startläge — en återupptagen sparad giv
 *  eller en giv ur ett delat ?giv=frö — i stället för en ny slumpgiv.
 *  `dailyNr` (kalenderarkivet): spela en TIDIGARE dags giv (#nr) i efterhand. */
export function useGame(daily = false, initial?: Game | null, dailyNr?: number) {
  const [game, setGame] = useState<Game>(
    () => initial ?? (daily ? newDailyGame(0, dailyNr) : newGame()),
  )
  // Kontraktväljaren: ett valt träningsmål (sparas mellan givar). `random` =
  // dagens vanliga slumpgiv. När ett mål är valt letar vi fram en giv vars
  // simulerade auktion landar där (`matchesTarget`), i småbatchar så sidan
  // aldrig fryser vid ett sällsynt mål.
  const [target, setTarget] = useState<ContractTarget>(() => loadPlayTarget())
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState<SearchState | null>(null)
  const searchCancel = useRef(false)
  // Budstöd (ägarbeslut 2026-07-28): På = motorns prick + förklaringar som
  // vanligt; Av = inga hintar i budlådan och minimal förklaring i auktionsvyn.
  // Ligger här (inte i usePlayTable) så både budfasen, spelfasen och
  // omspelningen läser SAMMA val. Sparas mellan givar, som play-target.
  const [bidHelp, setBidHelp] = useState<boolean>(() => loadBidHelp())

  function toggleBidHelp() {
    setBidHelp((v) => {
      saveBidHelp(!v)
      return !v
    })
  }

  // Avbryt en pågående sökning om komponenten lämnas.
  useEffect(() => () => { searchCancel.current = true }, [])

  const complete = auctionComplete(game.history)

  // Datorn budar V/N/Ö när det är deras tur (liten fördröjning, som korten).
  useEffect(() => {
    if (game.phase !== 'bidding' || complete) return
    if (seatToAct(game.deal.dealer, game.history.length) === 'S') return // din tur
    const id = setTimeout(() => {
      setGame((g) => {
        if (g.phase !== 'bidding' || auctionComplete(g.history)) return g
        const seat = seatToAct(g.deal.dealer, g.history.length)
        if (seat === 'S') return g
        return { ...g, history: [...g.history, decideCall(g.deal, g.history, seat)] }
      })
    }, 700)
    return () => clearTimeout(id)
  }, [game, complete])

  // Budgivningen klar med kontrakt → ägaren BEKRÄFTAR i dialogen
  // ("1♠ spelas av Syd – Bekräfta", som Synrey) innan kortspelet börjar.
  function confirmContract() {
    setGame((g) => {
      if (g.phase !== 'bidding' || !auctionComplete(g.history)) return g
      const contract = contractFromCalls(g.history)
      if (!contract) return g
      return { ...g, phase: 'play', contract }
    })
  }

  function onBid(bid: Bid) {
    setGame((g) => {
      if (g.phase !== 'bidding') return g
      if (seatToAct(g.deal.dealer, g.history.length) !== 'S') return g
      if (!legalCalls(g.history, 'S').includes(bid)) return g
      // Fäst budets betydelse så det blir klickbart i auktionsvyn. Stämmer ditt
      // bud med motorns systemlinje får det den äkta förklaringen; annars märks
      // det som ett eget bud utanför systemet (motorn kan inte tolka det).
      const sys = decideCall(g.deal, g.history, 'S')
      let call: ResolvedCall
      if (sys.bid === bid) {
        call = { seat: 'S', bid, rule: sys.rule, explanation: sys.explanation ?? 'Motorns rekommenderade bud.' }
      } else {
        // Off-book: motorn föreskriver inte budet, men ska ALLTID kunna tolka det.
        // Tolkningslagret läser auktionen och ger en bästa-möjliga förklaring.
        const interp = interpretCall([...g.history, { seat: 'S', bid }], g.history.length)
        const tag = interp.confidence === 'gissning' ? ' (osäker tolkning)' : ''
        call = { seat: 'S', bid, rule: 'eget bud', explanation: `Eget bud. ${interp.text}${tag}` }
      }
      return { ...g, history: [...g.history, call] }
    })
  }

  // Starta en ny giv för målet `t`. Slumpmål = direkt; annars sök i batchar
  // (setTimeout mellan batcharna → sidan ritar "Söker …" och fryser aldrig).
  function startNewGame(t: ContractTarget) {
    searchCancel.current = true // stoppa ev. tidigare sökning
    if (t === 'random') {
      setSearch(null)
      setGame(newGame())
      return
    }
    searchCancel.current = false
    setSearch({ tried: 0, gaveUp: false })
    let tried = 0
    const CAP = 60000 // taket räcker för storslam (~1 per 1500) med marginal
    const BATCH = 300 // ~12 ms/batch → under en bildruta
    const step = () => {
      if (searchCancel.current) return
      for (let i = 0; i < BATCH; i++) {
        tried++
        // Även målsökta givar får ett frö (Etapp B) → "Spela om given" och
        // sparad pågående giv fungerar likadant för dem.
        const seed = randomSeed()
        const deal = dealRandom(mulberry32(seed))
        if (matchesTarget(deal, t)) {
          setSearch(null)
          setGame(gameFromSeed(seed))
          return
        }
      }
      if (tried >= CAP) {
        setSearch({ tried, gaveUp: true })
        return
      }
      setSearch({ tried, gaveUp: false })
      setTimeout(step, 0)
    }
    setTimeout(step, 0)
  }

  function pickTarget(t: ContractTarget) {
    setTarget(t)
    savePlayTarget(t)
    setPicking(false)
    startNewGame(t)
  }

  function cancelSearch() {
    searchCancel.current = true
    setSearch(null)
  }

  /** Spela om SAMMA giv från början (Etapp B): samma frö (eller dagens giv),
   *  ny omgång → spelbordet monteras om via round i nyckeln. */
  function startSameGame() {
    setGame((g) =>
      g.seed === null ? newDailyGame(g.round + 1, dailyNr) : gameFromSeed(g.seed, g.round + 1),
    )
  }

  return {
    game,
    complete,
    target,
    picking,
    setPicking,
    search,
    bidHelp,
    toggleBidHelp,
    onBid,
    confirmContract,
    startNewGame,
    startSameGame,
    pickTarget,
    cancelSearch,
  }
}
