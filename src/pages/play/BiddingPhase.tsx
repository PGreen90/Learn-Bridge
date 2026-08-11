// Budfasen (Synrey-stil): kompass + auktionsrutnät överst, budlådan i mitten,
// din hand som solfjäder längst ner. Motståndarnas kort visas inte alls.
// Bara presentation — spellogiken bor i useGame.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Bid } from '../../types/bridge'
import { SEAT_LABEL } from '../../lib/bidding'
import { decideCall, legalCalls, seatToAct, contractFromCalls } from '../../lib/engine/auction-live'
import { hcp } from '../../lib/engine/hand'
import { AuctionGrid } from '../../components/AuctionGrid'
import { BidChip } from '../../components/BidChip'
import { BiddingBox } from '../../components/BiddingBox'
import { Button } from '../../components/Button'
import { ClickAway, Dialog } from '../../components/Dialog'
import { CompassPanel } from '../../components/CompassPanel'
import { Felt } from '../../components/Felt'
import { FelrapportDialog } from '../../components/FelrapportDialog'
import { HandFan } from '../../components/HandFan'
import { MenuToggleRow, STRAIN_CODE } from './common'
import type { Game } from './useGame'
import type { TavlingSpel } from './tavling-mode'

export function BiddingPhase({
  game,
  complete,
  onBid,
  onConfirm,
  onNewGame,
  onPlayAgain,
  targetLabel,
  onOpenPicker,
  bidHelp,
  onToggleBidHelp,
  dailyBadge,
  tavling,
}: {
  game: Game
  complete: boolean
  onBid: (bid: Bid) => void
  onConfirm: () => void
  onNewGame: () => void
  /** "Spela om given": samma giv från början — även när given passades ut, så
   *  man kan testa att öppna budgivningen själv den här gången. Frivillig. */
  onPlayAgain?: () => void
  targetLabel: string
  onOpenPicker: () => void
  /** Budstöd på/av (ägarbeslut 2026-07-28): av döljer motorns hjälp helt. */
  bidHelp: boolean
  onToggleBidHelp: () => void
  /** Dagens giv: guldbricka ("Dagens giv #N") i stället för Mål-knappen —
   *  målväljaren är avstängd, alla spelar samma giv. */
  dailyBadge?: string
  /** Tävlingsläget (Beslut B etapp 2): en utpassad giv går vidare i serien i
   *  stället för att ge en ny slumpgiv, och menyn lämnar till översikten. */
  tavling?: TavlingSpel
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const toAct = complete ? null : seatToAct(game.deal.dealer, game.history.length)
  const yourTurn = toAct === 'S'
  const finalContract = complete ? contractFromCalls(game.history) : null
  const passedOut = complete && !finalContract

  // Tävlingsgiv som passas ut är ett giltigt (magert) resultat — bokför det i
  // samma stund den passas ut, oavsett om spelaren sedan klickar "Nästa giv"
  // eller går till översikten. Ref-vakten ger exakt en bokföring.
  const tavlingBokford = useRef(false)
  useEffect(() => {
    if (!tavling || !passedOut || tavlingBokford.current) return
    tavlingBokford.current = true
    tavling.onResultat(
      { board: tavling.board, myTricks: 0, win: false, headline: 'Given passades ut', scoreLabel: null },
      { board: tavling.board, history: game.history, plays: [], declarerTricks: 0 },
    )
  }, [tavling, passedOut, game.history])
  // Motorns rekommenderade bud för din hand i det här läget (markeras i budlådan
  // och ger den äkta förklaringen för det budet). useMemo (R2-fynd #3) så den bara
  // räknas om när given eller budhistoriken ändras – inte vid orelaterade
  // omritningar (t.ex. när menyn eller felrapport-dialogen öppnas).
  // Budstöd av → beräknas inte alls (display-only; onBid gör sin egen decideCall).
  const recommendation = useMemo(
    () => (yourTurn && bidHelp ? decideCall(game.deal, game.history, 'S') : null),
    [yourTurn, bidHelp, game.deal, game.history],
  )

  // Tangentbord (fynd #21): Enter bekräftar kontraktdialogen — budlådans egna
  // tangenter bor i BiddingBox (dess lyssnare är avstängd när auktionen är klar).
  useEffect(() => {
    if (!finalContract) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finalContract, onConfirm])

  return (
    <Felt className="flex min-h-[100dvh] w-full flex-col rounded-none border-transparent shadow-none">
      {/* Överst: kompass (giv + bricka + zon), auktionen och menyknappen. Säker
          topp-marginal för urtaget (headern är dold i den immersiva spelvyn). */}
      {/* pb-1 (inte 2.5): kompenserar den ökade luften i budlådan (gap-1.5)
          så helheten fortfarande ryms på en 812 px-mobil. Innerkolumnen är
          max-w-md = budlådans bredd (ägarbeslut 2026-08-02, symmetri):
          kompassens vänsterkant och auktionens högerkant går i linje med
          budlådan. ⋮-menyn ligger i radflödet på mobil (godkända mobilvyn) men
          hängs UTANFÖR kolumnen till höger från sm: — kringflytande chrome som
          i spelfasen, så den inte stjäl bredd från auktionen. */}
      <div className="px-2.5 pb-1 pt-[calc(0.625rem+env(safe-area-inset-top))]">
        <div className="relative mx-auto flex w-full max-w-md items-stretch gap-2">
          <CompassPanel
            dealer={game.deal.dealer}
            board={game.deal.board}
            vulnerability={game.deal.vulnerability}
            footer={
              dailyBadge ? (
                /* Dagens giv: guldbrickan ersätter Mål-knappen — given är
                   låst till datumfröet, alla spelar samma. */
                <div className="w-full rounded-md bg-gold-400/15 px-1.5 py-1 text-left text-[10px] font-semibold leading-tight text-gold-200 ring-1 ring-inset ring-gold-400/30">
                  {dailyBadge}
                </div>
              ) : (
                /* Träningsmålet (Kontraktväljaren) bor i panelen (ägarbeslut
                   2026-08-02) — klick byter scenario. */
                <button
                  type="button"
                  onClick={onOpenPicker}
                  className="w-full rounded-md bg-emerald-900/60 px-1.5 py-1 text-left text-[10px] font-semibold leading-tight text-emerald-50 ring-1 ring-emerald-100/15 hover:bg-emerald-900/85"
                >
                  <span className="opacity-70">Mål:</span> {targetLabel}{' '}
                  <span className="opacity-60">▾</span>
                </button>
              )
            }
          />
          <AuctionGrid
            calls={game.history}
            dealer={game.deal.dealer}
            vulnerability={game.deal.vulnerability}
            activeSeat={toAct}
            explanations={bidHelp ? 'full' : 'minimal'}
            hiddenHands
          />
          <div className="shrink-0 sm:absolute sm:-right-11 sm:top-0">
            <TableMenu
              open={showMenu}
              onToggle={() => setShowMenu((v) => !v)}
              onNewGame={onNewGame}
              newGameLabel={tavling ? 'Till översikten' : undefined}
              onExit={tavling ? tavling.onÖversikt : undefined}
              bidHelp={bidHelp}
              onToggleBidHelp={onToggleBidHelp}
            >
              Du sitter <strong>Syd</strong>. När din ruta i auktionen lyser är det din tur:
              klicka ett bud i budlådan och bekräfta med <strong>OK</strong>. Datorn sköter
              Väst, Nord och Öst. Klicka ett lagt bud för att se vad det betyder. På dator
              funkar tangentbordet: siffra + färgbokstav väljer budet (t.ex. <strong>1</strong>{' '}
              och <strong>S</strong> för 1♠; N = sang, R = ruter, K = klöver), <strong>P</strong>{' '}
              = pass, <strong>X</strong> = dubbelt, <strong>Enter</strong> = OK.
            </TableMenu>
          </div>
        </div>
      </div>

      {/* Budlådan – alltid synlig; otillåtna/inte-din-tur tonas ner. */}
      <div className="px-2.5 pb-1.5">
        <BiddingBox
          legal={yourTurn ? legalCalls(game.history, 'S') : []}
          onBid={onBid}
          recommendation={recommendation}
          history={game.history}
          showHelp={bidHelp}
        />
      </div>

      {/* Din hand som solfjäder + HCP-bricka (Synrey). mt-auto trycker handen till
          botten när duken fyller hela skärmen; säker botten-marginal (hemindikator). */}
      {/* pt-1.5 + pb 0.25rem (Etapp C, uppmätt i granskningen): med pt-2 +
          pb 0.5rem slutade kortraden på 819 px mot skärmens 812 (iPhone-målet)
          → 6 px skvalpig scroll i budfasen. Verifiera med granskningens mått:
          document.documentElement.scrollHeight ≤ 812 på 375×812. */}
      <div className="mt-auto border-t border-emerald-100/10 bg-emerald-950/25 px-2 pt-1.5 pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
        {/* HCP-brickan är LÅST till budlådans kolumn (max-w-md, ägarbeslut
            2026-08-02) — den följer budlådans högerkant på stor skärm i stället
            för att driva ut till skärmhörnet, och svävar på avdelarlinjen strax
            ovanför kortraden (349 px) så den aldrig täcker ett kort. */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -top-4 right-0 z-10 rounded-md bg-emerald-950/80 px-2 py-0.5 text-xs font-semibold text-white ring-1 ring-gold-400/25">
            HCP {hcp(game.deal.hands.S)}
          </div>
        </div>
        <HandFan hand={game.deal.hands.S} flat />
      </div>

      {/* Kontrakt bjudet: bekräftelsedialog (Synreys "Declared by South"). */}
      {finalContract && (
        <Dialog className="min-w-60 p-4 text-center">
            <div className="flex items-center justify-center gap-2 pb-3">
              <BidChip bid={`${finalContract.level}${STRAIN_CODE[finalContract.strain]}`} />
              {finalContract.doubled && (
                <span className="text-sm font-bold text-danger">{finalContract.doubled}</span>
              )}
              <span className="text-sm font-medium text-ink-soft">
                spelas av {SEAT_LABEL[finalContract.declarer]}
              </span>
            </div>
            <button
              type="button"
              onClick={onConfirm}
              className="w-full border-t border-line pt-2.5 text-sm font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
            >
              Bekräfta
            </button>
        </Dialog>
      )}

      {/* Passades given ut: dialog med ny giv. */}
      {passedOut && !reporting && (
        <Dialog className="p-4 text-center">
            <p className="mb-3 text-sm text-ink-soft">Ingen öppnade – given passades ut.</p>
            {/* Spela om given: samma giv en gång till (du kan öppna själv den här
                gången) — vid rundpass fanns förr bara "Ny giv" (ägarönskemål
                2026-08-03). Tävling: en utpassad giv är ett giltigt (om än magert)
                resultat — gå vidare i serien i stället för att slumpa en ny giv. */}
            <div className="flex flex-wrap justify-center gap-2">
              {tavling ? (
                <Button onClick={tavling.onNästa}>
                  {tavling.sista ? 'Se ställningen →' : 'Till översikten →'}
                </Button>
              ) : (
                <>
                  {onPlayAgain && (
                    <Button variant="secondary" onClick={onPlayAgain}>
                      Spela om given
                    </Button>
                  )}
                  <Button onClick={onNewGame}>Ny giv →</Button>
                </>
              )}
            </div>
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

/** Menyknappen (⋮) uppe till höger: expanderar i en overlay med ny giv + budstöd + hjälp. */
function TableMenu({
  open,
  onToggle,
  onNewGame,
  newGameLabel = 'Ny giv →',
  onExit,
  bidHelp,
  onToggleBidHelp,
  children,
}: {
  open: boolean
  onToggle: () => void
  onNewGame: () => void
  /** Etikett på översta knappen — "Ny giv →" i vanligt spel, "Till översikten"
   *  i tävling (ingen ny giv finns där). */
  newGameLabel?: string
  /** Vart "Avsluta spel" går — startsidan som standard, översikten i tävling. */
  onExit?: () => void
  bidHelp: boolean
  onToggleBidHelp: () => void
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
              {newGameLabel}
            </Button>
            {/* Budstöd av/på (ägarbeslut 2026-07-28): samma radmönster som Auto Claim. */}
            <MenuToggleRow
              label="Budstöd"
              hint="motorns hintar och förklaringar"
              on={bidHelp}
              onToggle={onToggleBidHelp}
            />
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">{children}</p>
            {/* Enda vägen ut ur den immersiva vyn (headern är dold) → startsidan,
                eller översikten i tävlingsläget. */}
            <button
              type="button"
              onClick={() => {
                if (onExit) onExit()
                else window.location.hash = '#/'
              }}
              className="mt-3 w-full border-t border-line pt-2.5 text-sm font-semibold text-danger transition-opacity hover:opacity-80"
            >
              {onExit ? '← Till översikten' : '← Avsluta spel'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
