// Spelfasens hjärna som en hook: kortspels-tillståndet, bottarnas spel (inkl.
// Monte-Carlo-webworkern), claim/auto-claim, facit och två-klicks-valet.
// PlayTable-komponenten är bara presentation ovanpå det här.

import { useEffect, useRef, useState } from 'react'
import type { Card, Deal, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../../lib/bidding'
import {
  contractResult,
  dummyOf,
  isComplete,
  legalCards,
  playCard,
  side,
  startPlay,
  type Contract,
  type PlayedCard,
  type PlayResult,
  type PlayState,
} from '../../lib/engine/play'
import {
  adjudicateClaim,
  autoClaimAvailable,
  declarerTricksWon,
  remainingTricks,
} from '../../lib/engine/claim'
import { loadValue, saveValue } from '../../lib/storage'
import { scoreLine } from '../../lib/engine/scoring'
import { doubleDummyDeclarerRemaining } from '../../lib/engine/dds'
import { botCardReasoned, botCardSmartReasoned, usesMonteCarlo } from '../../lib/engine/play-bot'
import { controls, sameCard } from './common'

// Nodbudget för facit-lösaren: ~2 milj. noder (≈ 1–2 s i värsta fall) så
// gränssnittet aldrig fryser. Sena ställningar (få kort kvar) löses direkt;
// tidiga, tunga ställningar kan returnera null → vi visar ett vänligt meddelande.
const FACIT_BUDGET = 2_000_000

export function usePlayTable(deal: Deal, contract: Contract, calls: ResolvedCall[]) {
  const [play, setPlay] = useState<PlayState>(() => startPlay(deal, contract))
  const [showMenu, setShowMenu] = useState(false)
  // ⓘ-knappen: budgivningen som overlay (Synrey-minimalism – inget syns
  // förrän man ber om det).
  const [showInfo, setShowInfo] = useState(false)
  // Resultatdialogen när given är färdigspelad; stängs → omspelningen.
  const [resultSeen, setResultSeen] = useState(false)
  // Felrapport-dialogen ("Kändes given rätt?") — nås från resultatdialogen.
  const [reporting, setReporting] = useState(false)
  // Facit (double-dummy) för NUVARANDE ställning: tal = spelförarens totala stick
  // med perfekt spel, 'toohard' = för tung just nu, 'idle' = ej beräknat.
  const [facit, setFacit] = useState<number | 'idle' | 'toohard'>('idle')
  // Vald färg i två-klicks-spelet: första klicket väljer (fan ut) färgen,
  // andra klicket på ett kort i den färgen spelar det.
  const [selectedSuit, setSelectedSuit] = useState<Suit | null>(null)
  // Claim (ägarönskemål 2026-07-03): `claimed` avslutar given med det claimade
  // resultatet i stället för att spela ut resten. `claiming` = dialogen öppen,
  // `claimMsg` = "Claim nekad"-beskedet, `autoClaim` = av/på-valet (sparas).
  const [claimed, setClaimed] = useState<{ total: number; auto: boolean } | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)
  const [autoClaim, setAutoClaim] = useState<boolean>(() => loadValue('autoClaim', true))
  // Bottarnas motiveringar per spelat kort (kortnyckel → plats + varför).
  // Tryck på ett spelat kort på bordet visar förklaringen i raden under listen.
  const [botReasons, setBotReasons] = useState<Record<string, { seat: Seat; reason: string }>>({})
  const [explain, setExplain] = useState<{ seat: Seat; card: Card; reason: string } | null>(null)
  // Sant medan bot-hjärnan räknar Monte-Carlo i webworkern (visar "tänker …").
  const [thinking, setThinking] = useState(false)
  // Webworkern som kör den tunga Monte-Carlo-DDS:en av huvudtråden (skapas en gång).
  const workerRef = useRef<Worker | null>(null)
  const reqCounter = useRef(0)

  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../../lib/engine/mc-worker.ts', import.meta.url), { type: 'module' })
    } catch {
      workerRef.current = null // ingen worker (t.ex. äldre miljö) → körs inline i stället
    }
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  // Nollställ facit + färgval + öppen kortförklaring så fort ställningen ändras
  // (du eller en bot la ett kort).
  useEffect(() => {
    setFacit('idle')
    setSelectedSuit(null)
    setExplain(null)
  }, [play])

  function showFacit() {
    const rem = doubleDummyDeclarerRemaining(
      play.hands,
      contract.strain,
      contract.declarer,
      play.currentTrick,
      play.toAct,
      FACIT_BUDGET,
    )
    if (rem === null) {
      setFacit('toohard')
      return
    }
    const declWon = side(contract.declarer) === 'NS' ? play.tricksNS : play.tricksEW
    setFacit(declWon + rem)
  }

  // Bottarna spelar automatiskt när det är deras tur. Tunga Monte-Carlo-beslut
  // (slutspelet) räknas i webworkern så gränssnittet inte fryser; snabba tumregler
  // körs inline med en liten paus för känsla.
  useEffect(() => {
    // Bottarna pausar när en claim är lagd (given är slut) eller medan
    // claim-dialogen är öppen (ställningen får inte ändras under bedömningen).
    if (claimed || claiming || isComplete(play) || controls(contract, play.toAct)) return
    const seat = play.toAct
    let cancelled = false

    // Spela det bot-hjärnan valde (med skydd om ställningen hunnit ändras).
    const apply = (choice: { card: Card; reason: string }) => {
      if (cancelled) return
      setThinking(false)
      // Kortet som faktiskt läggs (fallback om valet hunnit bli olagligt) +
      // motiveringen sparas så kortet kan förklaras med ett tryck på bordet.
      const legal = legalCards(play, seat)
      const card = legal.some((c) => sameCard(c, choice.card)) ? choice.card : legal[0]
      setBotReasons((m) => ({ ...m, [`${card.suit}${card.rank}`]: { seat, reason: choice.reason } }))
      setPlay((p) => {
        if (isComplete(p) || controls(contract, p.toAct)) return p
        const stillLegal = legalCards(p, p.toAct).some((c) => sameCard(c, card))
        return playCard(p, stillLegal ? card : legalCards(p, p.toAct)[0])
      })
    }

    const worker = workerRef.current
    // Snabb tumregel (öppningsutspel / ett kort / över MC-fönstret), eller ingen
    // worker tillgänglig → räkna inline efter en kort paus.
    if (!worker || !usesMonteCarlo(play, seat)) {
      const id = setTimeout(() => apply(botCardSmartReasoned(play, seat, calls)), 750)
      return () => {
        cancelled = true
        clearTimeout(id)
      }
    }

    // Tungt slutspelsbeslut → webworkern. Gränssnittet visar "tänker …".
    setThinking(true)
    const reqId = ++reqCounter.current
    const onMessage = (e: MessageEvent) => {
      if (e.data?.reqId !== reqId) return
      worker.removeEventListener('message', onMessage)
      clearTimeout(timeoutId)
      if (e.data.error || !e.data.card) apply(botCardReasoned(play, seat)) // fallback: tumregel
      else apply({ card: e.data.card as Card, reason: e.data.reason as string })
    }
    // Skydd: om workern skulle hänga orimligt länge, falla tillbaka på tumregeln.
    const timeoutId = setTimeout(() => {
      worker.removeEventListener('message', onMessage)
      apply(botCardReasoned(play, seat))
    }, 15000)
    worker.addEventListener('message', onMessage)
    worker.postMessage({ reqId, state: play, seat, calls })

    return () => {
      cancelled = true
      worker.removeEventListener('message', onMessage)
      clearTimeout(timeoutId)
      setThinking(false)
    }
  }, [contract, play, calls, claimed, claiming])

  // Auto Claim: när ett nytt stick ska börja och spelförarsidan OMÖJLIGT kan
  // förlora fler stick (oavsett spelsätt) stängs given automatiskt – gäller både
  // när du är spelförare och när datorn är det. Slås av/på i ⋮-menyn.
  useEffect(() => {
    if (!autoClaim || claimed || claiming || isComplete(play)) return
    if (play.currentTrick.length > 0) return
    if (!autoClaimAvailable(play)) return
    setClaimed({ total: declarerTricksWon(play) + remainingTricks(play), auto: true })
  }, [play, autoClaim, claimed, claiming])

  function onPlay(card: Card) {
    setPlay((p) => {
      if (claimed || isComplete(p) || !controls(contract, p.toAct)) return p
      if (!legalCards(p, p.toAct).some((c) => sameCard(c, card))) return p
      return playCard(p, card)
    })
  }

  // Manuell claim: du anger sidans TOTALA stick i given; DDS-lösaren dömer om
  // de går att säkra mot bästa motspel. Godkänd → given avslutas. Nekad → spela
  // vidare. "Oavgjord" = ställningen är för tung att räkna just nu.
  function onClaim(total: number) {
    const v = adjudicateClaim(play, total, FACIT_BUDGET)
    if (v.verdict === 'godkänd') {
      setClaimed({ total, auto: false })
      setClaiming(false)
      setClaimMsg(null)
    } else if (v.verdict === 'nekad') {
      setClaimMsg(`Claim nekad — ${total} stick går inte att säkra mot bästa motspel. Spela vidare!`)
    } else {
      setClaimMsg('Ställningen är för tung att kontrollera just nu — spela något stick till och försök igen.')
    }
  }

  function toggleAutoClaim() {
    const next = !autoClaim
    setAutoClaim(next)
    saveValue('autoClaim', next)
  }

  // Två-klicks: första klicket på ett kort väljer (och fanar ut) dess färg;
  // klick på ett kort i den redan valda färgen spelar kortet.
  function onCardClick(card: Card) {
    if (selectedSuit !== card.suit) {
      setSelectedSuit(card.suit)
      return
    }
    onPlay(card)
    setSelectedSuit(null)
  }

  // Tryck på ett SPELAT kort på bordet (sticket i mitten eller förra sticket):
  // botens motivering visas i raden under listen; samma kort igen stänger.
  const reasonFor = (pc: PlayedCard) => botReasons[`${pc.card.suit}${pc.card.rank}`]
  function onPlayedCardClick(pc: PlayedCard) {
    const info = reasonFor(pc)
    if (!info) return
    setExplain((e) =>
      e && sameCard(e.card, pc.card) ? null : { seat: pc.seat, card: pc.card, reason: info.reason },
    )
  }

  // En godkänd claim (manuell eller auto) avslutar given med det claimade
  // resultatet — de ospelade sticken bokförs enligt claimen.
  const done = isComplete(play) || claimed !== null
  const needed = 6 + contract.level
  const result: PlayResult = claimed
    ? {
        declarerTricks: claimed.total,
        needed,
        made: claimed.total >= needed,
        diff: claimed.total - needed,
      }
    : contractResult(play)
  const declSide = side(contract.declarer)
  // Poängen för given (ägarens poängguide): vem som fick dem + hur många,
  // t.ex. "Ö/V +420". Zonen kommer från brickan.
  const score = done ? scoreLine(contract, result.declarerTricks, deal.vulnerability) : null
  const dummy = dummyOf(contract)
  const openingLeadMade = play.completedTricks.length > 0 || play.currentTrick.length > 0

  function isFaceUp(seat: Seat): boolean {
    if (seat === 'S') return true
    if (declSide === 'NS') return seat === 'N' // vi spelar → se även träkarlen Nord
    return seat === dummy && openingLeadMade // vi försvarar → träkarlen visas efter utspel
  }

  return {
    play,
    showMenu,
    setShowMenu,
    showInfo,
    setShowInfo,
    resultSeen,
    setResultSeen,
    reporting,
    setReporting,
    facit,
    showFacit,
    selectedSuit,
    claimed,
    claiming,
    setClaiming,
    claimMsg,
    setClaimMsg,
    autoClaim,
    toggleAutoClaim,
    explain,
    botReasons,
    reasonFor,
    thinking,
    onClaim,
    onCardClick,
    onPlayedCardClick,
    done,
    result,
    score,
    declSide,
    isFaceUp,
  }
}
