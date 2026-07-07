import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Bid, Card, Deal, Hand, Seat, Suit } from '../types/bridge'
import { SEAT_LABEL, type ResolvedCall } from '../lib/bidding'
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
  type Trick,
} from '../lib/engine/play'
import { adjudicateClaim, autoClaimAvailable, declarerTricksWon, remainingTricks } from '../lib/engine/claim'
import { loadValue, saveValue } from '../lib/storage'
import { dealRandom } from '../lib/engine/deal'
import { describeTarget, matchesTarget, type ContractTarget } from '../lib/engine/contract-target'
import {
  auctionComplete,
  contractFromCalls,
  decideCall,
  legalCalls,
  seatToAct,
} from '../lib/engine/auction-live'
import { interpretCall } from '../lib/engine/auction-interpret'
import { scoreLine } from '../lib/engine/scoring'
import { doubleDummyDeclarerRemaining } from '../lib/engine/dds'
import { botCardReasoned, botCardSmartReasoned, usesMonteCarlo } from '../lib/engine/play-bot'
import { hcp } from '../lib/engine/hand'
import { SuitSymbol } from '../components/SuitSymbol'
import { SuitText } from '../components/SuitText'
import { PlayingCard } from '../components/PlayingCard'
import { PlayReplay } from '../components/PlayReplay'
import { AuctionGrid } from '../components/AuctionGrid'
import { BidChip } from '../components/BidChip'
import { SideStack } from '../components/SideStack'
import { CompassPanel } from '../components/CompassPanel'
import { BiddingBox } from '../components/BiddingBox'
import { Felt } from '../components/Felt'
import { Button } from '../components/Button'
import { ClickAway, Dialog } from '../components/Dialog'
import { FelrapportDialog } from '../components/FelrapportDialog'
import { HandFan } from '../components/HandFan'
import { bySuit, handSuitsTrumpFirst } from '../lib/cardLayout'

// En giv går genom två faser: först budgivningen (du klickar Syds bud i budlådan,
// datorn budar V/N/Ö ett i taget runt bordet), sedan kortspelet ur de verkliga
// buden. `contract` är null tills budgivningen är klar.
interface Game {
  deal: Deal
  /** Den levande budföljden, ett bud i taget runt bordet. */
  history: ResolvedCall[]
  phase: 'bidding' | 'play'
  contract: Contract | null
}

function newGame(): Game {
  return { deal: dealRandom(), history: [], phase: 'bidding', contract: null }
}

/** Spelar ägaren (Syd) den här platsen? Vi spelar = både N och S; vi försvarar = bara S. */
function controls(contract: Contract, seat: Seat): boolean {
  return side(contract.declarer) === 'NS' ? side(seat) === 'NS' : seat === 'S'
}

function sameCard(a: Card, b: Card) {
  return a.suit === b.suit && a.rank === b.rank
}

/** Ett kort som text: valör + färgsymbol (t.ex. "K♥"), för "Varför?"-raden. */
function CardLabel({ card }: { card: Card }) {
  return (
    <span className="whitespace-nowrap font-semibold">
      {card.rank}
      <SuitSymbol suit={card.suit} />
    </span>
  )
}

// ===========================================================================
// Fas-styrning: budgivning → spel.
// ===========================================================================

export function Play() {
  const [game, setGame] = useState<Game>(newGame)
  // Kontraktväljaren: ett valt träningsmål (sparas mellan givar). `random` =
  // dagens vanliga slumpgiv. När ett mål är valt letar vi fram en giv vars
  // simulerade auktion landar där (`matchesTarget`), i småbatchar så sidan
  // aldrig fryser vid ett sällsynt mål.
  const [target, setTarget] = useState<ContractTarget>(() => loadValue<ContractTarget>('play-target', 'random'))
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState<{ tried: number; gaveUp: boolean } | null>(null)
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

  // Budgivningen klar med kontrakt → ägaren BEKRÄFTAR i den vita dialogen
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

  const content =
    game.phase === 'play' && game.contract ? (
      <PlayTable
        key={game.deal.id}
        deal={game.deal}
        contract={game.contract}
        calls={game.history}
        onNewGame={() => startNewGame(target)}
      />
    ) : (
      <BiddingPhase
        game={game}
        complete={complete}
        onBid={onBid}
        onConfirm={confirmContract}
        onNewGame={() => startNewGame(target)}
        targetLabel={describeTarget(target)}
        onOpenPicker={() => setPicking(true)}
      />
    )

  return (
    <>
      {content}
      {picking && (
        <ScenarioPicker current={target} onPick={pickTarget} onClose={() => setPicking(false)} />
      )}
      {search && (
        <SearchOverlay
          tried={search.tried}
          gaveUp={search.gaveUp}
          label={describeTarget(target)}
          onCancel={() => {
            searchCancel.current = true
            setSearch(null)
          }}
          onRetry={() => startNewGame(target)}
          onRandom={() => pickTarget('random')}
        />
      )}
    </>
  )
}

// ===========================================================================
// Budfasen (Synrey-stil): kompass + auktionsrutnät överst, budlådan i mitten,
// din hand som solfjäder längst ner. Motståndarnas kort visas inte alls.
// ===========================================================================

function BiddingPhase({
  game,
  complete,
  onBid,
  onConfirm,
  onNewGame,
  targetLabel,
  onOpenPicker,
}: {
  game: Game
  complete: boolean
  onBid: (bid: Bid) => void
  onConfirm: () => void
  onNewGame: () => void
  targetLabel: string
  onOpenPicker: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const toAct = complete ? null : seatToAct(game.deal.dealer, game.history.length)
  const yourTurn = toAct === 'S'
  const finalContract = complete ? contractFromCalls(game.history) : null
  const passedOut = complete && !finalContract
  // Motorns rekommenderade bud för din hand i det här läget (markeras i budlådan
  // och ger den äkta förklaringen för det budet). useMemo (R2-fynd #3) så den bara
  // räknas om när given eller budhistoriken ändras – inte vid orelaterade
  // omritningar (t.ex. när menyn eller felrapport-dialogen öppnas).
  const recommendation = useMemo(
    () => (yourTurn ? decideCall(game.deal, game.history, 'S') : null),
    [yourTurn, game.deal, game.history],
  )

  return (
    <Felt>
      {/* Överst: kompass (giv + bricka + zon), auktionen och menyknappen. */}
      <div className="flex items-stretch gap-2 p-2.5">
        <CompassPanel dealer={game.deal.dealer} board={game.deal.board} vulnerability={game.deal.vulnerability} />
        <AuctionGrid
          calls={game.history}
          dealer={game.deal.dealer}
          vulnerability={game.deal.vulnerability}
          activeSeat={toAct}
        />
        <TableMenu open={showMenu} onToggle={() => setShowMenu((v) => !v)} onNewGame={onNewGame}>
          Du sitter <strong>Syd</strong>. När din ruta i auktionen lyser är det din tur:
          klicka ett bud i budlådan och bekräfta med <strong>OK</strong>. Datorn sköter
          Väst, Nord och Öst. Klicka ett lagt bud för att se vad det betyder.
        </TableMenu>
      </div>

      {/* Träningsmål (Kontraktväljaren): klicka för att byta scenario. */}
      <div className="-mt-1 px-2.5 pb-1">
        <button
          type="button"
          onClick={onOpenPicker}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-50 ring-1 ring-emerald-100/15 hover:bg-emerald-900/75"
        >
          <span className="opacity-70">Mål:</span>
          {targetLabel}
          <span className="opacity-60">▾</span>
        </button>
      </div>

      {/* Budlådan – alltid synlig; otillåtna/inte-din-tur tonas ner. */}
      <div className="px-2.5 pb-3">
        <BiddingBox
          legal={yourTurn ? legalCalls(game.history, 'S') : []}
          onBid={onBid}
          recommendation={recommendation}
          history={game.history}
        />
      </div>

      {/* Din hand som solfjäder + HCP-bricka (Synrey). */}
      <div className="relative border-t border-emerald-100/10 bg-emerald-950/25 px-2 pb-2.5 pt-3">
        <HandFan hand={game.deal.hands.S} />
        <div className="absolute bottom-2 right-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-xs font-semibold text-white">
          HCP {hcp(game.deal.hands.S)}
        </div>
      </div>

      {/* Kontrakt bjudet: bekräftelsedialog (Synreys "Declared by South"). */}
      {finalContract && (
        <Dialog className="min-w-60 p-4 text-center">
            <div className="flex items-center justify-center gap-2 pb-3">
              <BidChip bid={`${finalContract.level}${STRAIN_CODE[finalContract.strain]}`} />
              {finalContract.doubled && (
                <span className="text-sm font-bold text-red-600">{finalContract.doubled}</span>
              )}
              <span className="text-sm font-medium text-ink-soft">
                spelas av {SEAT_LABEL[finalContract.declarer]}
              </span>
            </div>
            <button
              type="button"
              onClick={onConfirm}
              className="w-full border-t border-line pt-2.5 text-sm font-semibold text-sky-600 hover:text-sky-500"
            >
              Bekräfta
            </button>
        </Dialog>
      )}

      {/* Passades given ut: dialog med ny giv. */}
      {passedOut && !reporting && (
        <Dialog className="p-4 text-center">
            <p className="mb-3 text-sm text-ink-soft">Ingen öppnade – given passades ut.</p>
            <Button onClick={onNewGame}>Ny giv →</Button>
            <div>
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="mt-3 text-xs font-medium text-ink-muted underline hover:text-ink"
              >
                Kändes något fel? Rapportera given
              </button>
            </div>
        </Dialog>
      )}

      {/* Felrapporten: hela given + auktionen skickas som förifylld GitHub-issue. */}
      {reporting && (
        <FelrapportDialog
          deal={game.deal}
          calls={game.history}
          contract={null}
          tricks={[]}
          onClose={() => setReporting(false)}
        />
      )}
    </Felt>
  )
}

/** Menyknappen (⋮) uppe till höger: expanderar i en overlay med ny giv + hjälp. */
function TableMenu({
  open,
  onToggle,
  onNewGame,
  children,
}: {
  open: boolean
  onToggle: () => void
  onNewGame: () => void
  children: ReactNode
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/60 text-lg font-bold text-emerald-50 ring-1 ring-emerald-100/10 hover:bg-emerald-950/80"
        aria-label="Meny"
      >
        ⋮
      </button>
      {open && (
        <>
          <ClickAway onClose={onToggle} />
          <div className="absolute right-0 top-11 z-40 w-64 rounded-xl bg-panel p-3 shadow-xl ring-1 ring-line">
            <Button className="w-full" onClick={onNewGame}>
              Ny giv →
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">{children}</p>
          </div>
        </>
      )}
    </div>
  )
}

// ===========================================================================
// Kontraktväljaren: menyn där ägaren väljer ett träningsmål + sök-overlayen.
// ===========================================================================

// Scenariokorten (ordning = menyn). `hint` är den korta undertexten.
const SCENARIOS: { target: ContractTarget; hint: string }[] = [
  { target: 'random', hint: 'Vad som helst, som vanligt.' },
  { target: 'major-game', hint: 'Bjud fram 4♥ eller 4♠.' },
  { target: 'minor-game', hint: 'Bjud fram 5♣ eller 5♦.' },
  { target: 'nt-game', hint: 'Bjud fram 3NT.' },
  { target: 'small-slam', hint: 'Utred och nå 6-läget.' },
  { target: 'grand-slam', hint: 'Nå 7-läget (ovanligt – tar en stund att hitta).' },
  { target: 'competitive', hint: 'Motståndarna lägger sig i budgivningen.' },
]

/** Modal där ägaren väljer träningsmål. Klick på ett kort → sök + ny giv. */
function ScenarioPicker({
  current,
  onPick,
  onClose,
}: {
  current: ContractTarget
  onPick: (t: ContractTarget) => void
  onClose: () => void
}) {
  return (
    <Dialog onClose={onClose} className="w-full max-w-md p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Vad vill du träna på?</h2>
          <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Stäng">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-ink-muted">
          Appen letar fram en giv där ni med god budgivning ska nå målet. Sen budar du själv.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SCENARIOS.map(({ target, hint }) => {
            const selected = target === current
            return (
              <button
                key={target}
                type="button"
                onClick={() => onPick(target)}
                className={`rounded-xl border p-2.5 text-left transition ${
                  selected
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400'
                    : 'border-line bg-panel hover:border-line-strong hover:bg-panel-2'
                }`}
              >
                <div className="text-sm font-semibold text-ink">{describeTarget(target)}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-muted">{hint}</div>
              </button>
            )
          })}
        </div>
    </Dialog>
  )
}

/** Overlay medan sökaren letar (eller gav upp). */
function SearchOverlay({
  tried,
  gaveUp,
  label,
  onCancel,
  onRetry,
  onRandom,
}: {
  tried: number
  gaveUp: boolean
  label: string
  onCancel: () => void
  onRetry: () => void
  onRandom: () => void
}) {
  return (
    <Dialog className="w-full max-w-xs p-5 text-center">
        {gaveUp ? (
          <>
            <p className="mb-1 text-sm font-semibold text-ink">Hittade ingen sådan giv</p>
            <p className="mb-4 text-xs text-ink-muted">
              {label} är ovanligt och dök inte upp bland {tried.toLocaleString('sv-SE')} givar. Försök igen
              eller ta en slumpad giv.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={onRandom}>
                Slumpad giv
              </Button>
              <Button onClick={onRetry}>Försök igen →</Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-1 text-sm font-semibold text-ink">Söker en giv …</p>
            <p className="mb-4 text-xs text-ink-muted">
              {label} · {tried.toLocaleString('sv-SE')} givar prövade
            </p>
            <Button variant="secondary" onClick={onCancel}>
              Avbryt
            </Button>
          </>
        )}
    </Dialog>
  )
}

// ===========================================================================
// Spelfasen: det gröna bordet, korten, facit och omspelningen. Egen komponent så
// att spelfasens hooks bara körs när kontrakt + spelläge finns på riktigt.
// ===========================================================================

// Nodbudget för facit-lösaren: ~2 milj. noder (≈ 1–2 s i värsta fall) så
// gränssnittet aldrig fryser. Sena ställningar (få kort kvar) löses direkt;
// tidiga, tunga ställningar kan returnera null → vi visar ett vänligt meddelande.
const FACIT_BUDGET = 2_000_000

function PlayTable({
  deal,
  contract,
  calls,
  onNewGame,
}: {
  deal: Deal
  contract: Contract
  calls: ResolvedCall[]
  onNewGame: () => void
}) {
  const [play, setPlay] = useState<PlayState>(() => startPlay(deal, contract))
  const [showMenu, setShowMenu] = useState(false)
  // ⓘ-knappen: budgivningen som vit overlay (Synrey-minimalism – inget syns
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
      workerRef.current = new Worker(new URL('../lib/engine/mc-worker.ts', import.meta.url), { type: 'module' })
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

  // Färdigspelad giv: resultatdialog ovanpå, sedan omspelningen (Synrey-stil).
  if (done) {
    return (
      <div className="relative">
        <PlayReplay key={deal.id} deal={deal} contract={contract} tricks={play.completedTricks} calls={calls} />
        {!resultSeen && !reporting ? (
          <Dialog className="p-5 text-center">
              <p className={`mb-1 text-lg font-semibold ${result.made ? 'text-emerald-700' : 'text-red-600'}`}>
                {result.made
                  ? `Hemma! ${result.declarerTricks} stick${result.diff > 0 ? ` (+${result.diff})` : ''}.`
                  : `${-result.diff} bet (${result.declarerTricks} stick).`}
              </p>
              {score && (
                <p className={`${claimed ? 'mb-1' : 'mb-4'} text-base font-bold text-ink`}>
                  {score.label}
                </p>
              )}
              {claimed && (
                <p className="mb-4 text-xs text-ink-muted">
                  {claimed.auto
                    ? 'Auto Claim: resten av sticken var 100 % säkra för spelföraren.'
                    : 'Claim godkänd — resten av sticken bokfördes utan spel.'}
                </p>
              )}
              <div className="flex justify-center gap-2">
                <Button variant="secondary" onClick={() => setResultSeen(true)}>
                  Se omspelningen
                </Button>
                <Button onClick={onNewGame}>Ny giv →</Button>
              </div>
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="mt-3 text-xs font-medium text-ink-muted underline hover:text-ink"
              >
                Kändes något fel? Rapportera given
              </button>
          </Dialog>
        ) : resultSeen ? (
          <div className="mt-3 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => setReporting(true)}>
              Rapportera fel
            </Button>
            <Button onClick={onNewGame}>Ny giv →</Button>
          </div>
        ) : null}
        {/* Felrapporten: hela given + auktionen + sticken → förifylld GitHub-issue. */}
        {reporting && (
          <FelrapportDialog
            deal={deal}
            calls={calls}
            contract={contract}
            tricks={play.completedTricks}
            onClose={() => setReporting(false)}
          />
        )}
      </div>
    )
  }

  // Vem ligger öppen var? Nord-sidans öppna hand visas som färgkolumner uppe
  // (träkarlen när du spelar, eller spelföraren Nord när Syd är träkarl); en
  // Ö/V-träkarl som lodrät stapel på sin sida. Dolda händer visas INTE alls.
  const northOpen = isFaceUp('N')
  const westOpen = isFaceUp('W')
  const eastOpen = isFaceUp('E')

  return (
    <Felt>
      {/* ⓘ (budgivningen) + ⋮ (meny) uppe till höger. */}
      <div className="absolute right-2.5 top-2.5 z-20 flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            setShowInfo((v) => !v)
            setShowMenu(false)
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/60 text-sm font-bold text-emerald-50 ring-1 ring-emerald-100/10 hover:bg-emerald-950/80"
          aria-label="Budgivningen"
        >
          i
        </button>
        <button
          type="button"
          onClick={() => {
            setShowMenu((v) => !v)
            setShowInfo(false)
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/60 text-lg font-bold text-emerald-50 ring-1 ring-emerald-100/10 hover:bg-emerald-950/80"
          aria-label="Meny"
        >
          ⋮
        </button>
      </div>

      {/* Klick utanför stänger ⋮/ⓘ (R3-fynd #6). */}
      {(showMenu || showInfo) && (
        <ClickAway
          onClose={() => {
            setShowMenu(false)
            setShowInfo(false)
          }}
        />
      )}

      {/* Meny-overlay: ny giv, facit och hjälp – inget av det stör bordet annars. */}
      {showMenu && (
        <div className="absolute right-2.5 top-13 z-40 w-72 rounded-xl bg-panel p-3 shadow-xl ring-1 ring-line">
          {/* Facit finns nu som direktknapp på bordet (R3-fynd #4); menyn har
              bara ny giv, claim och hjälp. */}
          <Button className="w-full" onClick={onNewGame}>
            Ny giv →
          </Button>
          {/* Claim: bara när DIN sida är spelförare (motspelare claimar inte). */}
          {declSide === 'NS' && (
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => {
                setShowMenu(false)
                setClaimMsg(null)
                setClaiming(true)
              }}
            >
              Claim tricks
            </Button>
          )}
          {/* Auto Claim av/på: gäller både dig och datorn som spelförare. */}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-panel-2 px-2.5 py-1.5">
            <span className="text-xs font-medium text-ink-soft">
              Auto Claim <span className="text-ink-faint">(säkra stick tas automatiskt)</span>
            </span>
            <button
              type="button"
              onClick={toggleAutoClaim}
              className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                autoClaim ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
              }`}
            >
              {autoClaim ? 'På' : 'Av'}
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            Kontraktet är <strong>{contract.level}{STRAIN_CODE[contract.strain] === 'NT' ? 'NT' : ''}</strong>
            {STRAIN_CODE[contract.strain] !== 'NT' && <SuitSymbol suit={contract.strain as Suit} />} av{' '}
            {SEAT_LABEL[contract.declarer]} (behöver {result.needed} stick). Ljuskäglan visar vems tur det är.
            När det är din tur: tryck en färg så lyfts den – klicka sedan kortet du vill spela.
            Tryck på ett spelat kort på bordet för att se varför datorn valde det.
          </p>
        </div>
      )}

      {/* Claim-dialogen: ange sidans TOTALA stick i given; DDS dömer claimen. */}
      {claiming && (
        <ClaimDialog
          won={declarerTricksWon(play)}
          remaining={remainingTricks(play)}
          needed={result.needed}
          message={claimMsg}
          onClaim={onClaim}
          onClose={() => {
            setClaiming(false)
            setClaimMsg(null)
          }}
        />
      )}

      {/* ⓘ-overlay: budgivningen som ledde till kontraktet (klickbara förklaringar). */}
      {showInfo && (
        <div className="absolute left-1/2 top-13 z-40 w-full max-w-sm -translate-x-1/2 px-3">
          <div className="rounded-xl bg-panel p-2 shadow-xl ring-1 ring-line">
            <AuctionGrid calls={calls} dealer={deal.dealer} vulnerability={deal.vulnerability} />
          </div>
        </div>
      )}

      {/* Nord-sidans öppna hand som färgkolumner (trumf längst till vänster). */}
      <div className="flex min-h-16 justify-center pt-3">
        {northOpen && (
          <SuitColumns
            hand={play.hands.N}
            contract={contract}
            play={play}
            seat="N"
            onCardClick={onCardClick}
            selectedSuit={selectedSuit}
          />
        )}
      </div>

      {/* Förra sticket i miniatyr uppe i hörnet — förminskad (75 %) och ankrad
          så den går fri från det pågående stickets V/Ö-kort även på 375 px;
          flyttar till vänstra hörnet när Öst-träkarlen behöver högersidan.
          (R3-fynd #8: en 85%-bump provades men backades – 375px-överlappet
          kunde inte verifieras; tas om när mobil-preview är tillgänglig.) */}
      {play.completedTricks.length > 0 && (
        <div
          className={`absolute z-10 scale-75 ${
            eastOpen ? 'left-2.5 top-2.5 origin-top-left' : 'right-2.5 top-13 origin-top-right'
          }`}
        >
          <LastTrickPanel
            trick={play.completedTricks[play.completedTricks.length - 1]}
            onCardClick={onPlayedCardClick}
            hasReason={(pc) => !!reasonFor(pc)}
          />
        </div>
      )}

      {/* Mittraden: ev. V/Ö-träkarl på sin sida + sticket i mitten. */}
      <div className="flex items-center justify-between gap-1 px-2 py-2">
        <div className="w-14 shrink-0 sm:w-10">
          {westOpen && <SideStack cards={sideCards(play.hands.W, contract)} side="W" />}
        </div>
        <TrickCenterLive
          play={play}
          thinking={thinking}
          onCardClick={onPlayedCardClick}
          hasReason={(pc) => !!reasonFor(pc)}
        />
        <div className="w-14 shrink-0 sm:w-10">
          {eastOpen && <SideStack cards={sideCards(play.hands.E, contract)} side="E" />}
        </div>
      </div>

      {/* Bricka + zon nere till vänster. */}
      <div className="px-3 pb-2 text-xs leading-tight text-emerald-50/90">
        <div>Bricka {deal.board}</div>
        <div>{VUL_TEXT[deal.vulnerability]}</div>
      </div>

      {/* Svarta listen: kontraktet + ställningen + facit-knapp (R3-fynd #4:
          facit ett klick bort på bordet i stället för begravd i ⋮-menyn). */}
      <div className="flex items-center justify-center gap-2 pb-1.5">
        <div className="flex items-center gap-2 rounded-lg bg-slate-900/85 px-3 py-1 shadow">
          <BidChip bid={`${contract.level}${STRAIN_CODE[contract.strain]}`} />
          {contract.doubled && <span className="text-sm font-bold text-red-400">{contract.doubled}</span>}
          <span className="text-sm font-semibold text-white">
            NS:{play.tricksNS} ÖV:{play.tricksEW}
          </span>
          <span className="text-xs text-ink-faint">mål {result.needed}</span>
        </div>
        <button
          type="button"
          onClick={showFacit}
          className="rounded-lg bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-100/10 hover:bg-emerald-950/80"
        >
          Facit
        </button>
      </div>

      {/* Facit-resultatet på bordet (ljus text på filten). */}
      {facit !== 'idle' && (
        <p className="px-4 pb-1.5 text-center text-xs leading-relaxed">
          {facit === 'toohard' ? (
            <span className="text-emerald-50/70">
              Facit: ställningen är för tung att räkna snabbt just nu – prova längre in i given.
            </span>
          ) : (
            <span className="text-sky-200">
              Facit (perfekt spel): spelföraren tar totalt <strong>{facit}</strong> stick härifrån —{' '}
              {facit >= result.needed
                ? `kontraktet håller${facit > result.needed ? ` (+${facit - result.needed})` : ''}.`
                : `${result.needed - facit} bet.`}
            </span>
          )}
        </p>
      )}

      {/* Kortförklaringen: tryck på ett spelat kort på bordet → botens motivering. */}
      {explain ? (
        <p className="px-4 pb-1.5 text-center text-xs text-emerald-50/90">
          {SEAT_LABEL[explain.seat]} spelade <CardLabel card={explain.card} />:{' '}
          <SuitText>{explain.reason}</SuitText>
        </p>
      ) : (
        Object.keys(botReasons).length > 0 && (
          <p className="px-4 pb-1.5 text-center text-xs text-emerald-50/50">
            Tryck på spelat kort för förklaring
          </p>
        )
      )}

      {/* Din hand som solfjäder längst ner (trumf längst till vänster). */}
      <div className="border-t border-emerald-100/10 bg-emerald-950/25 px-2 pb-2.5 pt-3">
        <SouthFan
          hand={play.hands.S}
          contract={contract}
          play={play}
          onCardClick={onCardClick}
          selectedSuit={selectedSuit}
        />
      </div>
    </Felt>
  )
}

const VUL_TEXT: Record<Deal['vulnerability'], string> = {
  none: 'Ingen i zon',
  ns: 'NS i zon',
  ew: 'ÖV i zon',
  all: 'Alla i zon',
}

const STRAIN_CODE: Record<string, string> = {
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
  NT: 'NT',
}

/** Får platsen spela just nu, styrd av dig? (för klickbarhet + markering) */
function turnInfo(play: PlayState, contract: Contract, seat: Seat) {
  const myTurn = play.toAct === seat && controls(contract, seat) && !isComplete(play)
  const legal = myTurn ? legalCards(play, seat) : []
  return { myTurn, legalSet: new Set(legal.map((c) => `${c.suit}${c.rank}`)) }
}

/**
 * En öppen hand som färgkolumner (Synrey-träkarlen): en lodrät kolumn per färg,
 * trumfen i vänstra kolumnen, högsta kortet överst. Två-klicks-spelet: klick i
 * en färg väljer kolumnen som då EXPANDERAR på höjden (samma tanke som Syds
 * solfjäder fast lodrätt), klick i vald färg spelar kortet.
 */
function SuitColumns({
  hand,
  contract,
  play,
  seat,
  onCardClick,
  selectedSuit,
}: {
  hand: Hand
  contract: Contract
  play: PlayState
  seat: Seat
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, seat)
  return (
    <div className="flex items-start justify-center gap-1.5">
      {handSuitsTrumpFirst(contract.strain).map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        const spread = myTurn && suit === selectedSuit
        const dim = myTurn && selectedSuit !== null && !spread
        return (
          <div
            key={suit}
            className={`flex flex-col transition-all ${spread ? '-translate-y-1 z-10' : ''} ${dim ? 'opacity-50' : ''}`}
          >
            {cards.map((c, i) => {
              const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
              return (
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  card={c}
                  size="smPlus"
                  playable={playable}
                  dimmed={myTurn && !playable}
                  onClick={playable ? () => onCardClick(c) : undefined}
                  className={i > 0 ? (spread ? '-mt-7 sm:-mt-3' : '-mt-8 sm:-mt-7') : ''}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** En Ö/V-träkarls kort i visningsordning (trumf överst) för SideStack. */
function sideCards(hand: Hand, contract: Contract): Card[] {
  return handSuitsTrumpFirst(contract.strain).flatMap((suit) => bySuit(hand, suit))
}

/** Din hand som solfjäder (Syd): färggrupper, vald färg lyfts, trumf vänster. */
function SouthFan({
  hand,
  contract,
  play,
  onCardClick,
  selectedSuit,
}: {
  hand: Hand
  contract: Contract
  play: PlayState
  onCardClick: (c: Card) => void
  selectedSuit: Suit | null
}) {
  const { myTurn, legalSet } = turnInfo(play, contract, 'S')
  let dealt = 0 // löpande kortindex över alla färggrupper → utdelningskaskaden
  return (
    <div className="flex items-end justify-center">
      {handSuitsTrumpFirst(contract.strain).map((suit) => {
        const cards = bySuit(hand, suit)
        if (cards.length === 0) return null
        const spread = myTurn && suit === selectedSuit
        const dim = myTurn && selectedSuit !== null && !spread
        return (
          <div
            key={suit}
            className={`flex transition-all ${spread ? '-translate-y-1.5 z-10 sm:gap-1 sm:mx-1' : ''} ${dim ? 'opacity-50' : ''}`}
          >
            {cards.map((c, i) => {
              const playable = myTurn && legalSet.has(`${c.suit}${c.rank}`)
              // Mobil: de större korten (48px) gör att en utfälld färg annars
              // knuffar ytterkorten utanför kanten. Håll allt på skärmen genom att
              // fälla ut MED måttlig överlappning och samtidigt PRESSA ihop de
              // nedtonade färgerna. Desktop oförändrat (container-gap + full utfällning).
              const ml = i === 0 ? '' : spread ? '-ml-4 sm:ml-0' : dim ? '-ml-10 sm:-ml-6' : '-ml-8 sm:-ml-6'
              return (
                <PlayingCard
                  key={`${c.suit}${c.rank}`}
                  card={c}
                  size="md"
                  playable={playable}
                  dimmed={myTurn && !playable}
                  onClick={playable ? () => onCardClick(c) : undefined}
                  className={`deal-in ${ml}`}
                  style={{ animationDelay: `${dealt++ * 35}ms` }}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** Spelat kort glider in från spelarens håll (animationsklasserna i index.css). */
const CARD_IN: Record<Seat, string> = {
  N: 'card-in-n',
  S: 'card-in-s',
  W: 'card-in-w',
  E: 'card-in-e',
}

/** Ett spelat kort på bordet: klickbart när boten har en motivering —
 *  trycket visar förklaringen i raden under listen. */
function PlayedCardView({
  pc,
  winner,
  canExplain,
  onClick,
}: {
  pc: PlayedCard
  winner: boolean
  canExplain: boolean
  onClick: () => void
}) {
  const face = <PlayingCard card={pc.card} size="sm" className={winner ? 'ring-2 ring-amber-400' : ''} />
  if (!canExplain) return face
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      aria-label={`Varför spelade ${SEAT_LABEL[pc.seat]} det här kortet?`}
    >
      {face}
    </button>
  )
}

/** Förra (senast färdigspelade) sticket i miniatyr uppe i hörnet (ägarönskemål
 *  2026-07-03): korten i kompassläge, vinnarkortet gulmarkerat. Bottarnas kort
 *  är klickbara → samma förklaringsrad som sticket i mitten. */
function LastTrickPanel({
  trick,
  onCardClick,
  hasReason,
}: {
  trick: Trick
  onCardClick: (pc: PlayedCard) => void
  hasReason: (pc: PlayedCard) => boolean
}) {
  const at = (seat: Seat) => trick.cards.find((pc) => pc.seat === seat)
  const card = (seat: Seat, pos: string, rotate = '') => {
    const pc = at(seat)
    if (!pc) return null
    return (
      <div className={`absolute ${pos} ${rotate}`}>
        <PlayedCardView
          pc={pc}
          winner={trick.winner === seat}
          canExplain={hasReason(pc)}
          onClick={() => onCardClick(pc)}
        />
      </div>
    )
  }
  return (
    <div className="rounded-xl bg-emerald-950/45 px-1.5 pb-1.5 pt-0.5 ring-1 ring-emerald-100/10">
      <div className="pb-0.5 text-center text-[10px] font-medium text-emerald-50/70">Förra sticket</div>
      <div className="relative h-32 w-26">
        {card('N', 'top-0 left-1/2 -translate-x-1/2')}
        {card('S', 'bottom-0 left-1/2 -translate-x-1/2')}
        {card('W', 'left-0 top-1/2 -translate-y-1/2', 'rotate-90')}
        {card('E', 'right-0 top-1/2 -translate-y-1/2', '-rotate-90')}
      </div>
    </div>
  )
}

/** Claim-dialogen (ägarönskemål 2026-07-03): du påstår hur många stick din sida
 *  tar TOTALT i given (t.ex. "kontrakt +2"). Appen dömer med facit-lösaren: går
 *  sticken att säkra mot bästa motspel godkänns claimen och given avslutas,
 *  annars visas "Claim nekad" och spelet fortsätter. */
function ClaimDialog({
  won,
  remaining,
  needed,
  message,
  onClaim,
  onClose,
}: {
  won: number
  remaining: number
  needed: number
  message: string | null
  onClaim: (total: number) => void
  onClose: () => void
}) {
  const totals: number[] = []
  for (let t = won; t <= won + remaining; t++) totals.push(t)
  const diffLabel = (t: number) => (t === needed ? 'kontrakt' : t > needed ? `+${t - needed}` : `${t - needed}`)
  return (
    <Dialog onClose={onClose} className="w-full max-w-sm p-4 text-center">
        <p className="text-sm font-bold text-ink">Claim tricks</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Din sida har <strong>{won}</strong> stick och <strong>{remaining}</strong> återstår.
          Hur många stick tar ni <strong>totalt</strong> i given?
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {totals.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onClaim(t)}
              className={`min-w-12 rounded-lg px-2 py-1.5 ring-1 transition-colors ${
                t >= needed
                  ? 'bg-emerald-50 ring-emerald-200 hover:bg-emerald-100'
                  : 'bg-panel-2 ring-line hover:bg-panel'
              }`}
            >
              <span className="block text-sm font-bold text-ink">{t}</span>
              <span className={`block text-[10px] font-medium ${t >= needed ? 'text-emerald-700' : 'text-ink-muted'}`}>
                {diffLabel(t)}
              </span>
            </button>
          ))}
        </div>
        {message && <p className="mt-3 text-xs font-semibold text-red-600">{message}</p>}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full border-t border-line pt-2.5 text-sm font-semibold text-sky-600 hover:text-sky-500"
        >
          Avbryt — spela vidare
        </button>
    </Dialog>
  )
}

/** Sticket i mitten (live): mörk platta, väderstrecken runt om — en mjuk
 *  ljuskägla (spotlight) lyser upp platsen som är i tur (pulserar när
 *  bot-hjärnan räknar). Mellan sticken ligger det senast vunna sticket kvar
 *  med vinnarkortet gulmarkerat; bottarnas kort är klickbara → förklaring. */
function TrickCenterLive({
  play,
  thinking,
  onCardClick,
  hasReason,
}: {
  play: PlayState
  thinking: boolean
  onCardClick: (pc: PlayedCard) => void
  hasReason: (pc: PlayedCard) => boolean
}) {
  const last =
    play.completedTricks.length > 0 ? play.completedTricks[play.completedTricks.length - 1] : undefined
  const trick: PlayedCard[] = play.currentTrick.length > 0 ? play.currentTrick : last?.cards ?? []
  const winner = play.currentTrick.length === 0 ? last?.winner : undefined
  const at = (seat: Seat) => trick.find((pc) => pc.seat === seat)
  const toAct = isComplete(play) ? null : play.toAct

  const card = (seat: Seat, pos: string, rotate = '') => {
    const pc = at(seat)
    if (!pc) return null
    return (
      <div className={`absolute ${pos} ${rotate} ${CARD_IN[seat]}`}>
        <PlayedCardView
          pc={pc}
          winner={winner === seat}
          canExplain={hasReason(pc)}
          onClick={() => onCardClick(pc)}
        />
      </div>
    )
  }
  const letter = (seat: Seat, label: string, pos: string) => {
    const active = toAct === seat
    return (
      <span
        className={`absolute ${pos} flex items-center justify-center text-sm font-semibold text-yellow-300`}
        title={active ? (thinking ? 'Bot-hjärnan räknar …' : 'Ska spela') : undefined}
      >
        {/* Ljuskäglan: vitt radiellt ljus som tonar ut mot kanterna. mix-blend-mode
            screen ljusar bara UPP det som ligger under — färgerna ändras inte. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700 ${
            active ? (thinking ? 'animate-pulse' : 'opacity-100') : 'opacity-0'
          }`}
          style={{
            background:
              'radial-gradient(closest-side, rgba(255,255,255,0.34), rgba(255,255,255,0.12) 55%, transparent 78%)',
            mixBlendMode: 'screen',
          }}
        />
        <span className="relative">{label}</span>
      </span>
    )
  }

  return (
    <div className="relative h-44 w-40 shrink-0">
      <div className="absolute left-1/2 top-1/2 h-24 w-20 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-emerald-950/50 ring-1 ring-emerald-100/10" />
      {letter('N', 'N', 'top-4 left-1/2 -translate-x-1/2')}
      {letter('S', 'S', 'bottom-4 left-1/2 -translate-x-1/2')}
      {letter('W', 'V', 'left-4 top-1/2 -translate-y-1/2')}
      {letter('E', 'Ö', 'right-4 top-1/2 -translate-y-1/2')}
      {card('N', 'top-0 left-1/2 -translate-x-1/2')}
      {card('S', 'bottom-0 left-1/2 -translate-x-1/2')}
      {card('W', 'left-0 top-1/2 -translate-y-1/2', 'rotate-90')}
      {card('E', 'right-0 top-1/2 -translate-y-1/2', '-rotate-90')}
    </div>
  )
}
