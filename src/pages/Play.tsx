// Spela kort-sidan: komponerar fas-styrningen (budgivning → kortspel) av
// bitarna under `play/`. All spellogik bor i hookarna useGame/usePlayTable —
// den här filen och komponenterna den använder är bara presentation.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Deal, Seat, Suit } from '../types/bridge'
import { SEAT_LABEL, type ResolvedCall } from '../lib/bidding'
import type { Contract } from '../lib/engine/play'
import { declarerTricksWon, remainingTricks } from '../lib/engine/claim'
import { describeTarget, describeTargetShort } from '../lib/engine/contract-target'
import { dailyNumber, dailyStreak, shareText } from '../lib/engine/daily'
import { contractFromCalls } from '../lib/engine/auction-live'
import { resultHeadline } from '../lib/engine/scoring'
import { playsFrom, validSavedGame, type SavedGame } from '../lib/engine/resume'
import { addResult, validHistorik } from '../lib/engine/spel-historik'
import {
  loadDailyLog,
  loadSavedGame,
  loadSpelHistorik,
  saveDailyLog,
  saveDailyPlayed,
  saveSavedGame,
  saveSpelHistorik,
} from '../lib/backend'
import { PlayingCard } from '../components/PlayingCard'
import { SuitSymbol } from '../components/SuitSymbol'
import { SuitText } from '../components/SuitText'
import { PlayReplay } from '../components/PlayReplay'
import { AuctionGrid } from '../components/AuctionGrid'
import { BidChip } from '../components/BidChip'
import { Felt } from '../components/Felt'
import { Button } from '../components/Button'
import { ClickAway, Dialog } from '../components/Dialog'
import { FelrapportDialog } from '../components/FelrapportDialog'
import { gameFromDeal, gameFromSeed, useGame, type Game } from './play/useGame'
import { usePlayTable } from './play/usePlayTable'
import type { TavlingSpel } from './play/tavling-mode'
import type { GivResultat } from '../lib/backend/tavling'
import { CardLabel, MenuTempoRow, MenuToggleRow, STRAIN_CODE, VUL_TEXT } from './play/common'
import { SPEED_FACTOR } from './play/tempo'
import { SouthFan, SuitColumns, SideDummyPiles } from './play/hands'
import { LastTrickPanel, TrickCenterLive } from './play/trick-views'
import { ScenarioPicker, SearchOverlay } from './play/pickers'
import { BiddingPhase } from './play/BiddingPhase'
import { ClaimDialog } from './play/ClaimDialog'
import { RondRapportView } from './play/RondRapport'
import { FlightLayer } from './play/FlightLayer'
import { armSound } from '../lib/sound'

// ===========================================================================
// Fas-styrning: budgivning → spel. Tillståndet bor i useGame.
// ===========================================================================

/** Fröet ur adressen (#/spela-kort?giv=123): en delad/bokmärkt giv. */
function parseUrlSeed(): number | null {
  const m = window.location.hash.match(/[?&]giv=(\d+)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isInteger(n) && n >= 0 && n < 4294967296 ? n : null
}

/** Stolen ur adressen (#/spela-kort?giv=123&sitt=E): rotera given så den stolen
 *  sitter i Syd (dev-verktyg — bjud en utpekad hand ur revisorn i sin helhet). */
function parseUrlSeat(): Seat | null {
  const m = window.location.hash.match(/[?&]sitt=([NESW])/)
  return m ? (m[1] as Seat) : null
}

/** Dagen ur adressen (#/spela-kort/dagens?dag=3): en arkivgiv ur kalendern
 *  (kalenderarkivet 2026-08-03). Bara dagar som funnits (1 … i dag) godtas —
 *  allt annat faller tillbaka på dagens giv. */
function parseUrlDay(): number | null {
  const m = window.location.hash.match(/[?&]dag=(\d+)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isInteger(n) && n >= 1 && n <= dailyNumber() ? n : null
}

/** Startläget vid montering (Etapp B), i prioritetsordning: en sparad
 *  pågående giv (om den hör till DETTA läge — och till det aktiva givnumret
 *  resp. adressens frö), annars adressens frö, annars null (= ny slumpgiv).
 *  `nr` = det aktiva givnumret i dagens giv-läget (arkivdag eller i dag). */
function initialGame(daily: boolean, nr: number | null, sitt: Seat | null): { game: Game | null; plays: SavedGame['plays'] } {
  const urlSeed = daily ? null : parseUrlSeed()
  // Dev: en roterad giv (?sitt=) startar ALLTID färskt ur fröet — den sparade
  // pågående given är oroterad och hör inte hit.
  if (!daily && sitt && urlSeed !== null) return { game: gameFromSeed(urlSeed, 0, sitt), plays: [] }
  const saved = loadSavedGame()
  if (
    validSavedGame(saved) &&
    saved.daily === daily &&
    (!daily || saved.number === nr) &&
    (urlSeed === null || saved.seed === urlSeed)
  ) {
    const contract = saved.phase === 'play' ? contractFromCalls(saved.history) : null
    if (saved.phase === 'bidding' || contract) {
      return {
        game: {
          deal: saved.deal,
          history: saved.history,
          phase: saved.phase,
          contract,
          seed: saved.seed,
          round: 0,
        },
        plays: saved.plays,
      }
    }
  }
  if (urlSeed !== null) return { game: gameFromSeed(urlSeed), plays: [] }
  return { game: null, plays: [] }
}

export function Play({ daily = false, tavling }: { daily?: boolean; tavling?: TavlingSpel }) {
  // Det aktiva givnumret i dagens giv-läget: en arkivdag ur adressen (?dag=N,
  // kalenderarkivet) eller dagens. Läses EN gång — rutten i App.tsx bär dagen
  // i React-nyckeln, så ett dagbyte monterar om hela sidan.
  const [dailyNr] = useState(() => (daily ? (parseUrlDay() ?? dailyNumber()) : null))
  // Dev-stolen (?sitt=): läses en gång, styr rotationen + adress-synken nedan.
  const [sitt] = useState(() => (daily ? null : parseUrlSeat()))
  // Läses EN gång vid montering — därefter äger useGame tillståndet. Tävlingsgiv
  // (Beslut B etapp 2): given kommer FÄRDIGDELAD från servern, så vi startar
  // direkt ur den (ingen sparad-giv-återupptagning — pausen är per giv i serien
  // och sköts av "Dagens tävling"-sidan).
  const [restored] = useState(() =>
    tavling ? { game: gameFromDeal(tavling.giv.deal), plays: [] as SavedGame['plays'] } : initialGame(daily, dailyNr, sitt),
  )
  const {
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
  } = useGame(daily, restored.game, dailyNr ?? undefined)

  // Fröet i adressen håller jämna steg med given (Etapp B): då överlever en
  // omladdning även utan sparning, och adressen går att dela/bokmärka.
  // replaceState — inget hashchange-event, så routern störs inte.
  useEffect(() => {
    if (daily || game.seed === null) return
    const base = window.location.href.split('#')[0]
    const rot = sitt && sitt !== 'S' ? `&sitt=${sitt}` : ''
    window.history.replaceState(null, '', `${base}#/spela-kort?giv=${game.seed}${rot}`)
  }, [daily, game.seed, sitt])

  // Budfasen sparas löpande (spelfasen sparas i PlayTable som har spelläget).
  // Tävlingsgiv sparas ALDRIG i den fria giv-luckan (den skulle skriva över ett
  // pågående frispel) — tävlingens paus är per giv i serien.
  useEffect(() => {
    if (tavling || game.phase !== 'bidding') return
    saveSavedGame({
      v: 1,
      daily,
      number: dailyNr,
      seed: game.seed,
      deal: game.deal,
      history: game.history,
      phase: 'bidding',
      plays: [],
    } satisfies SavedGame)
  }, [game, daily, dailyNr, tavling])

  // Dagens giv: "Ny giv" lämnar dagens giv och går till frispelet (routen byts
  // → Play monteras om med ny slumpgiv; key:arna i App.tsx garanterar det).
  // Tävlingsgiv: det finns ingen "ny giv" i en tävling — knappen lämnar i
  // stället till översikten (att slutföra given görs med "Nästa giv →").
  const onNewGame = tavling
    ? tavling.onÖversikt
    : daily
      ? () => {
          window.location.hash = '#/spela-kort'
        }
      : () => startNewGame(target)

  // Ljudmotorn får bara starta i en riktig användargest (autoplay-policyn).
  // Registreras på SIDNIVÅ så redan budfasens klick armerar den — då hörs
  // giv-klar-ticken direkt när första spelbordet dukas. armSound är idempotent.
  useEffect(() => {
    window.addEventListener('pointerdown', armSound)
    return () => window.removeEventListener('pointerdown', armSound)
  }, [])

  // Återupptagna kort hör BARA till den ursprungligen sparade given — en ny
  // giv eller "Spela om given" (round > 0) börjar alltid tomt.
  const restoredPlays =
    restored.game && game.deal.id === restored.game.deal.id && game.round === 0
      ? restored.plays
      : undefined

  const content =
    game.phase === 'play' && game.contract ? (
      <PlayTable
        key={`${game.deal.id}:${game.round}`}
        deal={game.deal}
        contract={game.contract}
        calls={game.history}
        onNewGame={onNewGame}
        onPlayAgain={tavling ? undefined : startSameGame}
        bidHelp={bidHelp}
        onToggleBidHelp={toggleBidHelp}
        daily={daily}
        dailyNr={dailyNr ?? undefined}
        seed={game.seed}
        restoredPlays={restoredPlays}
        tavling={tavling}
        playSeed={tavling ? tavling.giv.playSeed : undefined}
      />
    ) : (
      <BiddingPhase
        game={game}
        complete={complete}
        onBid={onBid}
        onConfirm={confirmContract}
        onNewGame={onNewGame}
        onPlayAgain={tavling ? undefined : startSameGame}
        targetLabel={describeTargetShort(target)}
        onOpenPicker={() => setPicking(true)}
        bidHelp={bidHelp}
        onToggleBidHelp={toggleBidHelp}
        dailyBadge={
          tavling
            ? `Tävling · Giv ${tavling.board}/${tavling.total}`
            : daily
              ? `Dagens giv #${dailyNr}`
              : undefined
        }
        tavling={tavling}
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
          onCancel={cancelSearch}
          onRetry={() => startNewGame(target)}
          onRandom={() => pickTarget('random')}
        />
      )}
    </>
  )
}

// ===========================================================================
// Spelfasen: det gröna bordet, korten, facit och omspelningen. Egen komponent så
// att spelfasens hooks bara körs när kontrakt + spelläge finns på riktigt.
// Exporterad för testerna (syd-trakarl.test.tsx) — appen når den bara via Play.
// ===========================================================================

export function PlayTable({
  deal,
  contract,
  calls,
  onNewGame,
  onPlayAgain,
  bidHelp,
  onToggleBidHelp,
  daily = false,
  dailyNr,
  seed = null,
  restoredPlays,
  playSeed,
  tavling,
}: {
  deal: Deal
  contract: Contract
  calls: ResolvedCall[]
  onNewGame: () => void
  /** "Spela om given" (Etapp B): samma giv från början. Frivillig — testerna
   *  som monterar PlayTable direkt behöver inte skicka den. */
  onPlayAgain?: () => void
  /** Budstöd på/av (ägarbeslut 2026-07-28): av → minimal förklaring i auktionsvyerna. */
  bidHelp: boolean
  onToggleBidHelp: () => void
  /** Dagens giv-läget: resultatdialogen får en delningsknapp (Wordle-mekaniken). */
  daily?: boolean
  /** Det aktiva givnumret i dagens giv-läget — en arkivdag (kalenderarkivet)
   *  eller dagens. Frivillig: tester som monterar PlayTable direkt slipper den. */
  dailyNr?: number
  /** Givens frö (Etapp B) — följer med i sparningen av pågående giv. */
  seed?: number | null
  /** Spelade kort ur en sparad pågående giv — bordet börjar mitt i given. */
  restoredPlays?: SavedGame['plays']
  /** Tävlingsspel (Beslut B etapp 2): play-fröet som gör bottarna
   *  deterministiska så servern kan spela om och validera. Odefinierat i allt
   *  vanligt spel = Math.random precis som förut. */
  playSeed?: number | null
  /** Tävlingsläget (Beslut B etapp 2): resultatvyn byter ut "ny giv/dela" mot
   *  "Nästa giv →"/"Se ställningen" och lämnar aldrig spår i den fria historiken. */
  tavling?: TavlingSpel
}) {
  const {
    play,
    showMenu,
    setShowMenu,
    showInfo,
    setShowInfo,
    resultSeen,
    setResultSeen,
    reporting,
    setReporting,
    reviewing,
    setReviewing,
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
    pendingClaim,
    finishClaimReveal,
    showResult,
    speed,
    setSpeed,
    sound,
    toggleSound,
    sweep,
    skipSweep,
    flight,
    endFlight,
    registerCardEl,
    wasFlown,
    explain,
    botReasons,
    reasonFor,
    thinking,
    onClaim,
    onConcede,
    undoable,
    onUndo,
    onCardClick,
    onPlayedCardClick,
    done,
    result,
    score,
    declSide,
    isFaceUp,
    deselectSuit,
  } = usePlayTable(deal, contract, calls, restoredPlays, playSeed)

  // Spelfasen sparas löpande (Etapp B) — och rensas när given är klar, så en
  // färdigspelad giv inte "återupptas" vid nästa besök. null känns igen som
  // "ingen sparning" av validSavedGame. Tävlingsgiv rör ALDRIG den fria
  // giv-luckan (ett pågående frispel i luckan ska överleva ett tävlingspass).
  useEffect(() => {
    if (tavling) return
    if (done) {
      saveSavedGame(null)
      return
    }
    saveSavedGame({
      v: 1,
      daily,
      number: daily ? (dailyNr ?? dailyNumber()) : null,
      seed,
      deal,
      history: calls,
      phase: 'play',
      plays: playsFrom(play),
    } satisfies SavedGame)
  }, [play, done, daily, dailyNr, seed, deal, calls, tavling])
  // HashRouter → navigera hem via hash (funkar utan Router-kontext i tester).
  const goHome = () => {
    window.location.hash = '#/'
  }

  // Tangentbordsstyrning på bordet (granskningsputsen 2026-08-03, fynd #21):
  // ←/→ (och ↑/↓) flyttar fokus mellan de SPELBARA korten (button[data-spelbart]
  // i PlayingCard — de enda kortknapparna på bordet), Enter/mellanslag spelar
  // det fokuserade kortet via knappens vanliga klick. Två-klicksflödet gäller
  // även här: första Enter väljer färgen, nästa spelar kortet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      const cards = [...document.querySelectorAll<HTMLButtonElement>('button[data-spelbart]')]
      if (cards.length === 0) return
      e.preventDefault() // pilarna ska flytta kortfokus, inte rulla sidan
      const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown'
      const i = cards.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        i === -1 ? (fwd ? 0 : cards.length - 1) : (i + (fwd ? 1 : -1) + cards.length) % cards.length
      cards[next].focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Dina stick = din sidas (N/S) stick, oavsett vem som var spelförare.
  const myTricks = declSide === 'NS' ? result.declarerTricks : 13 - result.declarerTricks
  // Resultatrubriken ur ditt perspektiv (Etapp C, facit i scoring.test.ts).
  const headline = resultHeadline(declSide, result)

  // Tävlingsgiv: paketera resultatet ur DITT (N/S) perspektiv för "Nästa giv →".
  // "Dagens tävling"-sidan tar emot det, bokför framsteget och går vidare.
  const byggTavlingResultat = (): GivResultat => ({
    board: tavling ? tavling.board : deal.board,
    myTricks,
    win: headline.win,
    headline: headline.text,
    scoreLabel: score?.label ?? null,
  })

  // Dagens giv: det delbara resultatet (Wordle-mekaniken). Telefoner får
  // delningsarket (navigator.share), datorer kopierar till urklipp.
  // Texten är SPOILERFRI sedan Etapp B — bara dina stick, aldrig kontraktet.
  const [copied, setCopied] = useState(false)
  const onShare = () => {
    const text = shareText({ number: dailyNr ?? dailyNumber(), myTricks })
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      // Kvittot "✓ Kopierat" får bara visas när kopieringen faktiskt lyckades
      // (granskningen 2026-08-02: förr sattes det ovillkorligt — även när
      // urklippet var blockerat och förblev tomt).
      navigator.clipboard
        ?.writeText(text)
        .then(() => setCopied(true))
        .catch(() => {})
    }
  }
  // Resultatloggen (Etapp B): dagens resultat bokförs under givnumret →
  // streaken kan räknas och startsidan vet vad som är spelat. Den gamla
  // nyckeln `daily-played` skrivs också, så en äldre flik inte blir förvirrad.
  // Frispelets resultathistorik (granskningsputsen 2026-08-03, fynd #4):
  // varje färdigspelad FRI giv bokförs med sitt frö — raden i historiken kan
  // därmed spelas om exakt (#/spela-kort?giv=frö). Ref-vakten ger EN bokföring
  // per bord; "Spela om given" monterar ett nytt bord och bokförs för sig.
  const historikSaved = useRef(false)
  useEffect(() => {
    // Tävlingsgiv loggas aldrig i den fria historiken (seed är ändå null, men
    // vi är uttryckliga). Dess resultat bokförs av "Dagens tävling"-sidan.
    if (daily || tavling || !done || seed === null || historikSaved.current) return
    historikSaved.current = true
    const stored = loadSpelHistorik()
    saveSpelHistorik(
      addResult(validHistorik(stored) ? stored : [], {
        seed,
        when: Date.now(),
        bid: `${contract.level}${STRAIN_CODE[contract.strain]}`,
        doubled: contract.doubled ?? '',
        declarer: contract.declarer,
        myTricks,
        win: headline.win,
        headline: headline.text,
        scoreLabel: score?.label ?? null,
      }),
    )
  }, [daily, done, seed, contract, myTricks, headline, score])

  const [streak, setStreak] = useState(0)
  useEffect(() => {
    if (!daily || !done) return
    const n = dailyNr ?? dailyNumber()
    // Ett efterhandsspel ur kalenderarkivet bokförs med `late` — det syns i
    // kalendern men räknas aldrig in i streaken (ärlighetsregeln, daily.ts).
    const late = n !== dailyNumber()
    const log = loadDailyLog()
    // Första resultatet för dagen står sig — ett omspel skriver inte över det.
    if (log[n] === undefined) {
      saveDailyLog({ ...log, [n]: late ? { myTricks, late: true } : { myTricks } })
    }
    if (!late) saveDailyPlayed(n)
    setStreak(late ? 0 : dailyStreak(loadDailyLog(), n))
  }, [daily, dailyNr, done, myTricks])

  // Vem ligger öppen var? Nord-sidans öppna hand ritas UPPTILL som färgkolumner:
  // träkarlen Nord när du spelar, ELLER spelföraren Nord när SYD är träkarl —
  // i båda fallen är det din sidas öppna hand och DU spelar dess kort (controls
  // i common.tsx: NS-kontrakt → du styr både N och S; buggfix 2026-08-02, fallet
  // tappades i faceliften pass 2). När du FÖRSVARAR sitter motståndarnas träkarl
  // på sin RIKTIGA sida som Synrey-högar (ägarbeslut 2026-07-31) — spelförare
  // Öst → träkarl Väst till vänster och vice versa. Claim-revealen öppnar ALLA
  // händer via isFaceUp → Nord upptill + BÅDA sidohögarna. Dolda händer ritas
  // inte alls.
  const northUp = isFaceUp('N')
  const westUp = isFaceUp('W')
  const eastUp = isFaceUp('E')

  // Färdigspelad giv: bordet hinner tona ut (felt-fade-out under resultOutro,
  // showResult väntar ut den) → resultatdialog ovanpå omspelningen (Synrey-stil).
  if (done && showResult) {
    // Rondgenomgången (etapp 2): hela given förklarad i kapitel. "Tillbaka"
    // går till omspelningen (resultSeen sattes när genomgången öppnades).
    if (reviewing) {
      return (
        <RondRapportView
          deal={deal}
          contract={contract}
          calls={calls}
          tricks={play.completedTricks}
          result={result}
          score={score}
          claimed={claimed}
          botReasons={botReasons}
          onBack={() => setReviewing(false)}
          onNewGame={onNewGame}
        />
      )
    }
    return (
      <div className="relative">
        <PlayReplay
          key={deal.id}
          deal={deal}
          contract={contract}
          tricks={play.completedTricks}
          calls={calls}
          explanations={bidHelp ? 'full' : 'minimal'}
        />
        {!resultSeen && !reporting ? (
          // Guldglow vid hemgång (etapp 5, ägarbeslut: inget konfetti) —
          // engångs guldsvällning + skimmer på dialogkortet. Bet = sobert.
          <Dialog className={`p-5 text-center ${headline.win ? 'result-made-glow' : ''}`}>
              {/* Rubriken ur DITT perspektiv (Etapp C): att sätta deras
                  kontrakt är en vinst — inte "1 bet" i rött. */}
              <p className={`mb-1 text-lg font-semibold ${headline.win ? 'text-accent' : 'text-danger'}`}>
                {headline.text}
              </p>
              {score && (
                /* Guld = belöning (faceliften 2026-08-02): poängraden i guldserif
                   när DIN sida (N/S) fick poängen; motståndarnas poäng sobert. */
                <p
                  className={`${claimed ? 'mb-1' : 'mb-4'} text-base font-bold ${
                    score.side === 'NS'
                      ? 'font-brand text-lg text-gold-600 dark:text-gold-300'
                      : 'text-ink'
                  }`}
                >
                  {score.label}
                </p>
              )}
              {claimed && (
                <p className="mb-4 text-xs text-ink-muted">
                  {claimed.conceded
                    ? 'Ni gav upp — resten av sticken gick till spelföraren.'
                    : claimed.auto
                      ? 'Auto Claim: resten av sticken var 100 % säkra för spelföraren.'
                      : 'Claim godkänd — resten av sticken bokfördes utan spel.'}
                </p>
              )}
              <div className="flex flex-col items-center gap-2">
                {/* Dagens giv: delningen är huvudhandlingen — varje inklistrat
                    resultat i en chatt är en inbjudan att spela samma giv. */}
                {daily && (
                  <div className="flex flex-col items-center gap-1">
                    {/* Streaken (Etapp B): anledningen att komma tillbaka i
                        morgon — visas från två dagar i rad. */}
                    {streak >= 2 && (
                      <p className="font-brand text-sm text-gold-600 dark:text-gold-300">
                        🔥 {streak} dagar i rad
                      </p>
                    )}
                    <Button onClick={onShare}>Dela resultatet</Button>
                    {copied && (
                      <p className="text-xs text-accent">
                        ✓ Kopierat — klistra in i valfri chatt.
                      </p>
                    )}
                  </div>
                )}
                <div className="flex justify-center gap-2">
                  <Button variant="secondary" onClick={() => setResultSeen(true)}>
                    Se omspelningen
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setResultSeen(true)
                      setReviewing(true)
                    }}
                  >
                    Rondgenomgång
                  </Button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {tavling ? (
                    /* Tävling: den enda vägen framåt är nästa giv i serien (eller
                       ställningen om det var den sista). Inget omspel — man spelar
                       varje tävlingsgiv en gång. */
                    <Button variant="primary" onClick={() => tavling.onKlar(byggTavlingResultat())}>
                      {tavling.sista ? 'Se ställningen →' : 'Nästa giv →'}
                    </Button>
                  ) : (
                    <>
                      {/* Spela om given (Etapp B): samma frö, nytt försök —
                          dagens giv-loggen skrivs aldrig över av ett omspel. */}
                      {onPlayAgain && (
                        <Button variant="secondary" onClick={onPlayAgain}>
                          Spela om given
                        </Button>
                      )}
                      <Button variant={daily ? 'secondary' : 'primary'} onClick={onNewGame}>
                        {daily ? 'Ny slumpgiv →' : 'Ny giv →'}
                      </Button>
                    </>
                  )}
                </div>
                {/* Frispelets resultathistorik (2026-08-03): given är just
                    bokförd — vägen till listan ligger ett klick bort. */}
                {!daily && !tavling && (
                  <a
                    href="#/spela-kort/historik"
                    className="text-xs font-medium text-ink-muted underline hover:text-ink"
                  >
                    Dina senaste givar →
                  </a>
                )}
                <button
                  type="button"
                  onClick={tavling ? tavling.onÖversikt : goHome}
                  className="text-xs font-semibold text-danger transition-opacity hover:opacity-80"
                >
                  {tavling ? '← Till översikten' : '← Avsluta spel'}
                </button>
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
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="flex flex-wrap justify-center gap-2">
              {daily && <Button onClick={onShare}>Dela resultatet</Button>}
              <Button variant="secondary" onClick={() => setReporting(true)}>
                Rapportera fel
              </Button>
              <Button variant="secondary" onClick={() => setReviewing(true)}>
                Rondgenomgång
              </Button>
              {tavling ? (
                <Button variant="primary" onClick={() => tavling.onKlar(byggTavlingResultat())}>
                  {tavling.sista ? 'Se ställningen →' : 'Nästa giv →'}
                </Button>
              ) : (
                <Button variant={daily ? 'secondary' : 'primary'} onClick={onNewGame}>
                  {daily ? 'Ny slumpgiv →' : 'Ny giv →'}
                </Button>
              )}
            </div>
            {copied && (
              <p className="text-xs text-accent">✓ Kopierat — klistra in i valfri chatt.</p>
            )}
            <button
              type="button"
              onClick={tavling ? tavling.onÖversikt : goHome}
              className="text-xs font-semibold text-danger transition-opacity hover:opacity-80"
            >
              {tavling ? '← Till översikten' : '← Avsluta spel'}
            </button>
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

  // Träkarlen: partnern Nord upptill när du spelar, annars motståndarnas träkarl
  // på sin riktiga sida (se toppzonen + mittraden nedan); dolda händer visas inte.
  return (
    // --motion-scale: tempovalet skalar spelfasens CSS-animationer (index.css
    // räknar calc(bastid * var(--motion-scale))). JS-pauserna skalas i tempo.ts.
    // felt-fade-out: när given är klar tonar hela bordet ut under resultOutro
    // innan trädet byts till resultatvyn (showResult).
    <Felt
      className={`flex min-h-[100dvh] w-full flex-col rounded-none border-transparent shadow-none ${done ? 'felt-fade-out' : ''}`}
      style={{ '--motion-scale': SPEED_FACTOR[speed] } as CSSProperties}
    >
      {/* ⋮ (meny) överst, ⓘ (budgivningen) under den — staplade i appens övre
          högra hörn (ägarbeslut 2026-07-31). Säker marginal för urtaget nu när
          headern är borta (immersiv spelvy). */}
      <div className="absolute right-2.5 top-[calc(0.5rem+env(safe-area-inset-top))] z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => {
            setShowMenu((v) => !v)
            setShowInfo(false)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950/60 text-lg font-bold text-emerald-50 ring-1 ring-emerald-100/10 transition-colors hover:bg-emerald-950/80 hover:ring-gold-400/40"
          aria-label="Meny"
        >
          ⋮
        </button>
        <button
          type="button"
          onClick={() => {
            setShowInfo((v) => !v)
            setShowMenu(false)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950/60 text-sm font-bold text-emerald-50 ring-1 ring-emerald-100/10 transition-colors hover:bg-emerald-950/80 hover:ring-gold-400/40"
          aria-label="Budgivningen"
        >
          i
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
        <div className="absolute right-2.5 top-[calc(3rem+env(safe-area-inset-top))] z-40 w-72 rounded-xl bg-panel p-3 shadow-xl ring-1 ring-line">
          {/* Facit finns nu som direktknapp på bordet (R3-fynd #4); menyn har
              bara ny giv, claim och hjälp. */}
          <Button className="w-full" onClick={onNewGame}>
            Ny giv →
          </Button>
          {/* Claim: bara när DIN sida är spelförare (motspelare claimar inte).
              Som motspelare finns i stället Ge upp (Etapp C) — en hopplös giv
              ska inte behöva klickas klart i 13 stick. */}
          {declSide === 'NS' ? (
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
          ) : (
            <Button variant="secondary" className="mt-2 w-full" onClick={onConcede}>
              Ge upp — resten till spelföraren
            </Button>
          )}
          {/* Ångra (Etapp C): backa till före ditt senaste kort — feltryck ska
              aldrig kosta given. Bottarnas svar efteråt ospelas också. */}
          {undoable && (
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => {
                onUndo()
                setShowMenu(false)
              }}
            >
              ↩ Ångra mitt senaste kort
            </Button>
          )}
          {/* Auto Claim av/på: gäller både dig och datorn som spelförare. */}
          <MenuToggleRow
            label="Auto Claim"
            hint="säkra stick tas automatiskt"
            on={autoClaim}
            onToggle={toggleAutoClaim}
          />
          {/* Budstöd av/på (ägarbeslut 2026-07-28): styr hintarna i budfasen och
              hur mycket förklaring auktionsvyerna (ⓘ + omspelningen) visar. */}
          <MenuToggleRow
            label="Budstöd"
            hint="motorns hintar och förklaringar"
            on={bidHelp}
            onToggle={onToggleBidHelp}
          />
          {/* Ljuden (etapp 4): diskreta syntetiserade kortljud, standard PÅ. */}
          <MenuToggleRow
            label="Ljud"
            hint="diskreta kortljud"
            on={sound}
            onToggle={toggleSound}
          />
          {/* Tempot (ägarbeslut 2026-07-28): skalar botpauser + animationer. */}
          <MenuTempoRow speed={speed} onChange={setSpeed} />
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            Kontraktet är <strong>{contract.level}{STRAIN_CODE[contract.strain] === 'NT' ? 'NT' : ''}</strong>
            {STRAIN_CODE[contract.strain] !== 'NT' && <SuitSymbol suit={contract.strain as Suit} />} av{' '}
            {SEAT_LABEL[contract.declarer]} (behöver {result.needed} stick). Ljuskäglan visar vems tur det är.
            När det är din tur: tryck en färg så lyfts den – klicka sedan kortet du vill spela.
            Tryck på ett spelat kort på bordet för att se varför datorn valde det. På dator:
            piltangenterna markerar ett spelbart kort, Enter spelar det.
          </p>
          {/* Enda vägen ut ur den immersiva spelvyn (headern är dold) → startsidan. */}
          <button
            type="button"
            onClick={goHome}
            className="mt-3 w-full border-t border-line pt-2.5 text-sm font-semibold text-danger transition-opacity hover:opacity-80"
          >
            ← Avsluta spel
          </button>
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

      {/* ⓘ-overlay: budgivningen som ledde till kontraktet + förra sticket i
          miniatyr (som Synrey — bor här i stället för flytande på bordet). */}
      {showInfo && (
        <div className="absolute left-1/2 top-[calc(3rem+env(safe-area-inset-top))] z-40 w-full max-w-sm -translate-x-1/2 space-y-2 px-3">
          <div className="rounded-xl bg-panel p-2 shadow-xl ring-1 ring-line">
            {/* hiddenHands (Etapp C): under spelet är händerna dolda — andras
                bud förklaras systemiskt, aldrig ur deras faktiska kort. */}
            <AuctionGrid
              calls={calls}
              dealer={deal.dealer}
              vulnerability={deal.vulnerability}
              explanations={bidHelp ? 'full' : 'minimal'}
              hiddenHands
            />
          </div>
          {play.completedTricks.length > 0 && (
            <div className="flex justify-center rounded-xl bg-panel p-2 shadow-xl ring-1 ring-line">
              <LastTrickPanel
                trick={play.completedTricks[play.completedTricks.length - 1]}
                onCardClick={onPlayedCardClick}
                hasReason={(pc) => !!reasonFor(pc)}
              />
            </div>
          )}
          {/* Utspel (Synrey): det allra första kortet i given + vem som spelade det. */}
          {(() => {
            const openingLead = (play.completedTricks[0] ?? { cards: play.currentTrick }).cards[0]
            if (!openingLead) return null
            return (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-panel p-2 shadow-xl ring-1 ring-line">
                <span className="text-xs font-medium text-ink-muted">Utspel:</span>
                <PlayingCard card={openingLead.card} size="sm" />
                <span className="text-xs text-ink-soft">av {SEAT_LABEL[openingLead.seat]}</span>
              </div>
            )
          })()}
        </div>
      )}

      {/* Toppzonen: Nord-sidans öppna hand — träkarlen Nord när DU spelar, eller
          spelföraren Nord när Syd är träkarl (du spelar Nords kort i båda fallen).
          När du försvarar sitter motståndarnas träkarl i stället på sin riktiga
          sida (se mittraden nedan) så man aldrig förväxlar den med partnern.
          Dolda motståndarhänder visas inte alls. */}
      <div className="flex min-h-16 justify-center pt-[calc(0.75rem+env(safe-area-inset-top))]">
        {northUp && (
          <SuitColumns
            hand={play.hands.N}
            contract={contract}
            play={play}
            seat="N"
            onCardClick={onCardClick}
            selectedSuit={selectedSuit}
            registerCardEl={registerCardEl}
          />
        )}
      </div>

      {/* Förra sticket bor numera inne i ⓘ-overlayen (som Synrey), inte flytande
          på bordet — se showInfo nedan. */}

      {/* Mittraden (Synrey, ägarbeslut 2026-08-02): när du försvarar flyttar
          STICKET mot spelförarens sida och träkarlen brer ut sig som färghögar på
          sin egen sida — den öppnade ytan ger större kort. Spelar du själv
          (träkarlen Nord upptill) står sticket kvar i mitten som förr.
          flex-1 centrerar vertikalt. */}
      {/* När BÅDA sidohögarna visas samtidigt (claim-/auto-claim-revealen) får
          de tillsammans inte plats med en full mittzon → Öst trycktes förr av
          skärmkanten (felrapport #44). Mittzonen får min-w-0 så den krymper och
          lämnar plats; sidohögarna shrink-0 så deras kort aldrig kläms bort. */}
      <div className="flex flex-1 items-center gap-1 px-1 py-2">
        {westUp && (
          <div className="shrink-0">
            <SideDummyPiles hand={play.hands.W} contract={contract} side="W" registerCardEl={registerCardEl} />
          </div>
        )}
        <div className="flex min-w-0 flex-1 justify-center">
          <TrickCenterLive
            play={play}
            thinking={thinking}
            sweep={sweep}
            flight={flight}
            wasFlown={wasFlown}
            onSkipSweep={skipSweep}
            onCardClick={onPlayedCardClick}
            hasReason={(pc) => !!reasonFor(pc)}
          />
        </div>
        {eastUp && (
          <div className="shrink-0">
            <SideDummyPiles hand={play.hands.E} contract={contract} side="E" registerCardEl={registerCardEl} />
          </div>
        )}
      </div>

      {/* Bricka + zon nere till vänster. */}
      <div className="px-3 pb-2 text-xs leading-tight text-emerald-50/90">
        <div>Bricka {deal.board}</div>
        <div>{VUL_TEXT[deal.vulnerability]}</div>
      </div>

      {/* Svarta listen: kontraktet + ställningen + facit-knapp (R3-fynd #4:
          facit ett klick bort på bordet i stället för begravd i ⋮-menyn). */}
      <div className="flex items-center justify-center gap-2 pb-1.5">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/80 px-3 py-1 shadow ring-1 ring-gold-400/25">
          <BidChip bid={`${contract.level}${STRAIN_CODE[contract.strain]}`} />
          {contract.doubled && <span className="text-sm font-bold text-red-400">{contract.doubled}</span>}
          <span className="text-sm font-semibold text-emerald-50">
            NS:{play.tricksNS} ÖV:{play.tricksEW}
          </span>
          <span className="text-xs text-emerald-100/55">mål {result.needed}</span>
        </div>
        <button
          type="button"
          onClick={showFacit}
          className="rounded-lg bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-100/10 transition-colors hover:bg-emerald-950/80 hover:ring-gold-400/40"
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

      {/* Din hand som solfjäder längst ner (trumf längst till vänster). Säker
          botten-marginal (hemindikatorn) nu när duken går edge-to-edge. */}
      <div className="border-t border-emerald-100/10 bg-emerald-950/25 px-2 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {/* När bara en vald färg visas: väg tillbaka till alla färger (Synrey). */}
        {selectedSuit && (
          <div className="flex justify-center pb-1.5">
            <button
              type="button"
              onClick={deselectSuit}
              className="rounded-full bg-emerald-950/60 px-3 py-1 text-xs font-semibold text-emerald-50 ring-1 ring-gold-400/30 transition-colors hover:bg-emerald-950/80"
            >
              ◀ Alla färger
            </button>
          </div>
        )}
        <SouthFan
          hand={play.hands.S}
          contract={contract}
          play={play}
          onCardClick={onCardClick}
          selectedSuit={selectedSuit}
          registerCardEl={registerCardEl}
        />
      </div>

      {/* Flyglagret (etapp 3): klonen som flyger hand → stickmitten. Ovanpå
          korten (z-30) men under menyerna (z-40); släpper igenom alla klick. */}
      <FlightLayer
        flight={flight}
        speed={speed}
        targetsKey={sweep ? 'svep' : String(play.currentTrick.length)}
        onDone={endFlight}
      />

      {/* Claim-revealen (etapp 5, ägarbeslut 2026-07-28): alla händer ligger
          öppna och STANNAR KVAR — precis som vid ett riktigt bord — tills
          spelaren själv går vidare med knappen. Ingen timer, inget klipp. */}
      {pendingClaim && (
        <div className="overlay-in absolute left-1/2 bottom-[16%] z-30 flex -translate-x-1/2 flex-col items-center gap-2 rounded-xl bg-emerald-950/85 px-4 py-3 shadow-xl ring-1 ring-gold-400/25">
          <span className="whitespace-nowrap text-xs font-semibold text-white">
            {pendingClaim.conceded
              ? 'Ni gav upp'
              : pendingClaim.auto
                ? 'Auto Claim'
                : 'Claim godkänd'}{' '}
            — korten ligger uppe
          </span>
          {/* Vem sveper in resten? Auto-claim och att ge upp ger BÅDA hela
              resten till spelföraren — namnge väderstrecket (ägarönskemål
              2026-08-03). Manuell claim kan skänka bort stick → visas inte. */}
          {(pendingClaim.auto || pendingClaim.conceded) && (
            <span className="whitespace-nowrap text-xs font-semibold text-gold-200">
              {SEAT_LABEL[contract.declarer]} tar resten ({remainingTricks(play)} stick)
            </span>
          )}
          <Button onClick={finishClaimReveal}>Visa resultatet →</Button>
        </div>
      )}
    </Felt>
  )
}
