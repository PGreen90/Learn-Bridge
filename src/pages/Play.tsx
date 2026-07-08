// Spela kort-sidan: komponerar fas-styrningen (budgivning → kortspel) av
// bitarna under `play/`. All spellogik bor i hookarna useGame/usePlayTable —
// den här filen och komponenterna den använder är bara presentation.

import type { Deal, Suit } from '../types/bridge'
import { SEAT_LABEL, type ResolvedCall } from '../lib/bidding'
import type { Contract } from '../lib/engine/play'
import { declarerTricksWon, remainingTricks } from '../lib/engine/claim'
import { describeTarget } from '../lib/engine/contract-target'
import { SuitSymbol } from '../components/SuitSymbol'
import { SuitText } from '../components/SuitText'
import { PlayReplay } from '../components/PlayReplay'
import { AuctionGrid } from '../components/AuctionGrid'
import { BidChip } from '../components/BidChip'
import { SideStack } from '../components/SideStack'
import { Felt } from '../components/Felt'
import { Button } from '../components/Button'
import { ClickAway, Dialog } from '../components/Dialog'
import { FelrapportDialog } from '../components/FelrapportDialog'
import { useGame } from './play/useGame'
import { usePlayTable } from './play/usePlayTable'
import { CardLabel, STRAIN_CODE, VUL_TEXT } from './play/common'
import { SouthFan, SuitColumns, sideCards } from './play/hands'
import { LastTrickPanel, TrickCenterLive } from './play/trick-views'
import { ScenarioPicker, SearchOverlay } from './play/pickers'
import { BiddingPhase } from './play/BiddingPhase'
import { ClaimDialog } from './play/ClaimDialog'

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
    onBid,
    confirmContract,
    startNewGame,
    pickTarget,
    cancelSearch,
  } = useGame()

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
}: {
  deal: Deal
  contract: Contract
  calls: ResolvedCall[]
  onNewGame: () => void
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
  } = usePlayTable(deal, contract, calls)

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
