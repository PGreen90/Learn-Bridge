// Spelets fas-styrning (budgivning → kortspel) som en hook: given, den levande
// budföljden, kontraktväljarens mål + givsökningen. All spellogik för budfasen
// bor här — komponenterna i BiddingPhase/PlayTable är bara presentation.

import { useEffect, useRef, useState } from 'react'
import type { Bid, Deal } from '../../types/bridge'
import type { ResolvedCall } from '../../lib/bidding'
import {
  auctionComplete,
  contractFromCalls,
  decideCall,
  legalCalls,
  seatToAct,
} from '../../lib/engine/auction-live'
import { interpretCall } from '../../lib/engine/auction-interpret'
import { dealRandom } from '../../lib/engine/deal'
import { matchesTarget, type ContractTarget } from '../../lib/engine/contract-target'
import { loadValue, saveValue } from '../../lib/storage'
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
}

function newGame(): Game {
  return { deal: dealRandom(), history: [], phase: 'bidding', contract: null }
}

export interface SearchState {
  tried: number
  gaveUp: boolean
}

export function useGame() {
  const [game, setGame] = useState<Game>(newGame)
  // Kontraktväljaren: ett valt träningsmål (sparas mellan givar). `random` =
  // dagens vanliga slumpgiv. När ett mål är valt letar vi fram en giv vars
  // simulerade auktion landar där (`matchesTarget`), i småbatchar så sidan
  // aldrig fryser vid ett sällsynt mål.
  const [target, setTarget] = useState<ContractTarget>(() =>
    loadValue<ContractTarget>('play-target', 'random'),
  )
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState<SearchState | null>(null)
  const searchCancel = useRef(false)

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
        const deal = dealRandom()
        if (matchesTarget(deal, t)) {
          setSearch(null)
          setGame({ deal, history: [], phase: 'bidding', contract: null })
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
    saveValue('play-target', t)
    setPicking(false)
    startNewGame(t)
  }

  function cancelSearch() {
    searchCancel.current = true
    setSearch(null)
  }

  return {
    game,
    complete,
    target,
    picking,
    setPicking,
    search,
    onBid,
    confirmContract,
    startNewGame,
    pickTarget,
    cancelSearch,
  }
}
