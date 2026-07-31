// Spela kort-sidan: komponerar fas-styrningen (budgivning → kortspel) av
// bitarna under `play/`. All spellogik bor i hookarna useGame/usePlayTable —
// den här filen och komponenterna den använder är bara presentation.

import { useEffect, type CSSProperties } from 'react'
import type { Deal, Suit } from '../types/bridge'
import { SEAT_LABEL, type ResolvedCall } from '../lib/bidding'
import type { Contract } from '../lib/engine/play'
import { declarerTricksWon, remainingTricks } from '../lib/engine/claim'
import { describeTarget } from '../lib/engine/contract-target'
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
import { useGame } from './play/useGame'
import { usePlayTable } from './play/usePlayTable'
import { CardLabel, MenuTempoRow, MenuToggleRow, STRAIN_CODE, VUL_TEXT } from './play/common'
import { SPEED_FACTOR } from './play/tempo'
import { SouthFan, SuitColumns } from './play/hands'
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

export function Play() {
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
    pickTarget,
    cancelSearch,
  } = useGame()

  // Ljudmotorn får bara starta i en riktig användargest (autoplay-policyn).
  // Registreras på SIDNIVÅ så redan budfasens klick armerar den — då hörs
  // giv-klar-ticken direkt när första spelbordet dukas. armSound är idempotent.
  useEffect(() => {
    window.addEventListener('pointerdown', armSound)
    return () => window.removeEventListener('pointerdown', armSound)
  }, [])

  const content =
    game.phase === 'play' && game.contract ? (
      <PlayTable
        key={game.deal.id}
        deal={game.deal}
        contract={game.contract}
        calls={game.history}
        onNewGame={() => startNewGame(target)}
        bidHelp={bidHelp}
        onToggleBidHelp={toggleBidHelp}
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
        bidHelp={bidHelp}
        onToggleBidHelp={toggleBidHelp}
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
// ===========================================================================

function PlayTable({
  deal,
  contract,
  calls,
  onNewGame,
  bidHelp,
  onToggleBidHelp,
}: {
  deal: Deal
  contract: Contract
  calls: ResolvedCall[]
  onNewGame: () => void
  /** Budstöd på/av (ägarbeslut 2026-07-28): av → minimal förklaring i auktionsvyerna. */
  bidHelp: boolean
  onToggleBidHelp: () => void
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
    onCardClick,
    onPlayedCardClick,
    done,
    result,
    score,
    declSide,
    isFaceUp,
    dummy,
    deselectSuit,
  } = usePlayTable(deal, contract, calls)
  // HashRouter → navigera hem via hash (funkar utan Router-kontext i tester).
  const goHome = () => {
    window.location.hash = '#/'
  }

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
          <Dialog className={`p-5 text-center ${result.made ? 'result-made-glow' : ''}`}>
              <p className={`mb-1 text-lg font-semibold ${result.made ? 'text-accent' : 'text-danger'}`}>
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
              <div className="flex flex-col items-center gap-2">
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
                <Button onClick={onNewGame}>Ny giv →</Button>
                <button
                  type="button"
                  onClick={goHome}
                  className="text-xs font-semibold text-danger transition-opacity hover:opacity-80"
                >
                  ← Avsluta spel
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
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setReporting(true)}>
                Rapportera fel
              </Button>
              <Button variant="secondary" onClick={() => setReviewing(true)}>
                Rondgenomgång
              </Button>
              <Button onClick={onNewGame}>Ny giv →</Button>
            </div>
            <button
              type="button"
              onClick={goHome}
              className="text-xs font-semibold text-danger transition-opacity hover:opacity-80"
            >
              ← Avsluta spel
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

  // Träkarlen visas alltid upptill (se toppzonen nedan); dolda händer visas inte.
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
            Tryck på ett spelat kort på bordet för att se varför datorn valde det.
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
            <AuctionGrid
              calls={calls}
              dealer={deal.dealer}
              vulnerability={deal.vulnerability}
              explanations={bidHelp ? 'full' : 'minimal'}
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

      {/* Toppzonen: träkarlen (den öppna handen) visas ALLTID här — även när den
          sitter i Öst/Väst — så sidorna hålls tomma (Synrey, ägarbeslut 2026-07-31:
          öppnar ytan). Dolda motståndarhänder visas inte alls. */}
      <div className="flex min-h-16 justify-center pt-[calc(0.75rem+env(safe-area-inset-top))]">
        {isFaceUp(dummy) && dummy !== 'S' && (
          <SuitColumns
            hand={play.hands[dummy]}
            contract={contract}
            play={play}
            seat={dummy}
            onCardClick={onCardClick}
            selectedSuit={selectedSuit}
            registerCardEl={registerCardEl}
          />
        )}
      </div>

      {/* Förra sticket bor numera inne i ⓘ-overlayen (som Synrey), inte flytande
          på bordet — se showInfo nedan. */}

      {/* Mittraden: bara sticket i mitten, centrerat. Sidorna är tomma (Synrey) —
          flex-1 växer och centrerar bordet vertikalt. */}
      <div className="flex flex-1 items-center justify-center px-2 py-2">
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
        <div className="overlay-in absolute left-1/2 top-1/3 z-30 flex -translate-x-1/2 flex-col items-center gap-2 rounded-xl bg-emerald-950/85 px-4 py-3 shadow-xl ring-1 ring-gold-400/25">
          <span className="whitespace-nowrap text-xs font-semibold text-white">
            {pendingClaim.auto ? 'Auto Claim' : 'Claim godkänd'} — korten ligger uppe
          </span>
          <Button onClick={finishClaimReveal}>Visa resultatet →</Button>
        </div>
      )}
    </Felt>
  )
}
