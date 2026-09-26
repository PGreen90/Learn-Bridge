// "Så spelade X given" (Påbyggnad 3, ägarönskemål 2026-09-13): stega igenom hur
// VILKEN spelare som helst i fältet bjöd och spelade en tävlingsgiv — även
// bottarna. Datat är spelarens auktion + spelade kort ur travellern (servern
// lämnar ut dem först när du själv spelat brickan). Sticken återskapas
// deterministiskt genom motorn (byggGranskning) och visas i PlayReplay, som är
// perspektivFRI (ingen "du"-text) — rätt när handen tillhör någon annan.
// RondRapportView (rapporten med "du"-perspektiv och botmotiveringar) nås
// bara för din egen giv, via knappen längst ner.
//
// Förklaringarna i auktionen tolkas SYSTEMISKT ur auktionen (interpretCall) —
// serverns svar bär aldrig den hand-byggda förklaringstexten (ärlig inferens:
// samma förklaring för alla, härledd ur buden, inte ur korten).

import { AuctionGrid } from '../../components/AuctionGrid'
import { Button } from '../../components/Button'
import { Felt } from '../../components/Felt'
import { PlayReplay } from '../../components/PlayReplay'
import type { Deal } from '../../types/bridge'
import type { ResolvedCall } from '../../lib/bidding'
import { interpretCall } from '../../lib/engine/auction-interpret'
import { enhetText, givTal, talText, type BrickaRad } from '../../lib/backend/tavling'
import { byggGranskning } from '../play/granska-tavling'
import { Kontraktscell, resultatText } from './TavlingDelar'

/** Auktionen med systemiska förklaringar (ur buden, aldrig ur handen). */
export function medSystemiskaForklaringar(calls: ResolvedCall[]): ResolvedCall[] {
  return calls.map((c, i) => {
    const tolkning = interpretCall(calls, i)
    const text = tolkning.confidence === 'gissning' ? `${tolkning.text} (osäker tolkning)` : tolkning.text
    return { ...c, explanation: text }
  })
}

export function GivGranskning({
  deal,
  rad,
  onBack,
  onRapport,
}: {
  deal: Deal
  rad: BrickaRad
  onBack: () => void
  /** Din egen giv: öppna rondgenomgången med förklaringar (RondRapportView). */
  onRapport?: () => void
}) {
  const calls = medSystemiskaForklaringar(rad.history ?? [])
  const rubrik = rad.jag ? `Så spelade du giv ${deal.board}` : `Så spelade ${rad.namn} giv ${deal.board}`
  const harKort = !!rad.kontrakt && Array.isArray(rad.plays) && rad.plays.length > 0
  const granskning = harKort ? byggGranskning(deal, rad.plays!, rad.kontrakt!) : null

  return (
    <div className="min-h-[100dvh] bg-surface">
      {/* Topprad: tillbaka + rubrik + kontrakt/resultat/MP% på EN rad. */}
      <div className="flex items-center justify-between gap-3 bg-emerald-950/80 px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-sm text-emerald-50">
        <button
          onClick={onBack}
          className="shrink-0 font-semibold text-emerald-100/80 underline underline-offset-2 hover:text-emerald-50"
        >
          ← Tillbaka
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-brand text-base text-gold-200">{rubrik}</h1>
        <span className="flex shrink-0 items-center gap-2 tabular-nums">
          <Kontraktscell k={rad.kontrakt} />
          <span>{resultatText(rad.kontrakt)}</span>
          <span className="font-semibold text-gold-200">
            {talText(givTal(rad) ?? 0, rad.form, rad.form === 'imp' ? 1 : 0)} {enhetText(rad.form)}
          </span>
        </span>
      </div>

      {granskning ? (
        <PlayReplay
          key={`${rad.namn}-${deal.board}`}
          deal={deal}
          contract={granskning.contract}
          tricks={granskning.tricks}
          calls={calls}
        />
      ) : (
        <Felt className="flex min-h-[60dvh] w-full flex-col items-center justify-center gap-4 rounded-none border-transparent px-5 py-10 shadow-none">
          {rad.kontrakt === null ? (
            <>
              <p className="text-emerald-100/80">Given passades ut — inget spel att visa.</p>
              <div className="w-full max-w-56">
                <AuctionGrid calls={calls} dealer={deal.dealer} vulnerability={deal.vulnerability} dense />
              </div>
            </>
          ) : (
            <p className="text-emerald-100/80">Genomgången är inte tillgänglig för den här spelaren.</p>
          )}
        </Felt>
      )}

      <div className="flex flex-col items-center gap-3 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {onRapport && harKort && (
          <Button onClick={onRapport}>Rondgenomgång med förklaringar →</Button>
        )}
        <p className="text-center text-[11px] text-emerald-100/60">
          Stega sticken med pilarna. Tryck på ett bud för dess betydelse.
        </p>
      </div>
    </div>
  )
}
