// Budfasen (Synrey-stil): kompass + auktionsrutnät överst, budlådan i mitten,
// din hand som solfjäder längst ner. Motståndarnas kort visas inte alls.
// Bara presentation — spellogiken bor i useGame.

import { useMemo, useState, type ReactNode } from 'react'
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

export function BiddingPhase({
  game,
  complete,
  onBid,
  onConfirm,
  onNewGame,
  targetLabel,
  onOpenPicker,
  bidHelp,
  onToggleBidHelp,
}: {
  game: Game
  complete: boolean
  onBid: (bid: Bid) => void
  onConfirm: () => void
  onNewGame: () => void
  targetLabel: string
  onOpenPicker: () => void
  /** Budstöd på/av (ägarbeslut 2026-07-28): av döljer motorns hjälp helt. */
  bidHelp: boolean
  onToggleBidHelp: () => void
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
  // Budstöd av → beräknas inte alls (display-only; onBid gör sin egen decideCall).
  const recommendation = useMemo(
    () => (yourTurn && bidHelp ? decideCall(game.deal, game.history, 'S') : null),
    [yourTurn, bidHelp, game.deal, game.history],
  )

  return (
    <Felt className="flex min-h-[100dvh] w-full flex-col rounded-none border-transparent shadow-none">
      {/* Överst: kompass (giv + bricka + zon), auktionen och menyknappen. Säker
          topp-marginal för urtaget (headern är dold i den immersiva spelvyn). */}
      <div className="flex items-stretch gap-2 p-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))]">
        <CompassPanel dealer={game.deal.dealer} board={game.deal.board} vulnerability={game.deal.vulnerability} />
        <AuctionGrid
          calls={game.history}
          dealer={game.deal.dealer}
          vulnerability={game.deal.vulnerability}
          activeSeat={toAct}
          explanations={bidHelp ? 'full' : 'minimal'}
        />
        <TableMenu
          open={showMenu}
          onToggle={() => setShowMenu((v) => !v)}
          onNewGame={onNewGame}
          bidHelp={bidHelp}
          onToggleBidHelp={onToggleBidHelp}
        >
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
          showHelp={bidHelp}
        />
      </div>

      {/* Din hand som solfjäder + HCP-bricka (Synrey). mt-auto trycker handen till
          botten när duken fyller hela skärmen; säker botten-marginal (hemindikator). */}
      <div className="relative mt-auto border-t border-emerald-100/10 bg-emerald-950/25 px-2 pt-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <HandFan hand={game.deal.hands.S} spread />
        <div className="absolute bottom-2 right-2 rounded-md bg-emerald-950/80 px-2 py-0.5 text-xs font-semibold text-white ring-1 ring-gold-400/25">
          HCP {hcp(game.deal.hands.S)}
        </div>
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

/** Menyknappen (⋮) uppe till höger: expanderar i en overlay med ny giv + budstöd + hjälp. */
function TableMenu({
  open,
  onToggle,
  onNewGame,
  bidHelp,
  onToggleBidHelp,
  children,
}: {
  open: boolean
  onToggle: () => void
  onNewGame: () => void
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
              Ny giv →
            </Button>
            {/* Budstöd av/på (ägarbeslut 2026-07-28): samma radmönster som Auto Claim. */}
            <MenuToggleRow
              label="Budstöd"
              hint="motorns hintar och förklaringar"
              on={bidHelp}
              onToggle={onToggleBidHelp}
            />
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">{children}</p>
            {/* Enda vägen ut ur den immersiva vyn (headern är dold) → startsidan. */}
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/'
              }}
              className="mt-3 w-full border-t border-line pt-2.5 text-sm font-semibold text-danger transition-opacity hover:opacity-80"
            >
              ← Avsluta spel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
