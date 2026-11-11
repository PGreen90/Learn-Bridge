import { useState } from 'react'
import type { Deal } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import type { Contract, Trick } from '../lib/engine/play'
import { REPORT_CATEGORIES, byggRapport, rapportTyp } from '../lib/felrapport'
import { skickaRapport } from '../lib/backend/rapport'
import { Button } from './Button'
import { Dialog } from './Dialog'

/** Standardtexten (Spela kort): hela given inklusive sticken följer med. */
const DEFAULT_INTRO = 'Hela given (händerna, budgivningen och sticken) följer med automatiskt.'

/** Dit man vänder sig om rapporten inte går att skicka. */
export const RAPPORT_KONTAKT = 'rebidz.bridge@gmail.com'

type Status = 'idle' | 'sending' | 'sent' | 'error'

/**
 * "Kändes given rätt?"-dialogen: välj kategori + skriv fritt.
 *
 * Rapporten skickas med ETT klick via den öppna mottagaren (/api/rapport,
 * 2026-11-11) — inget konto, ingen kod och ingen GitHub-sida. Kategorin avgör
 * om det blir en felrapport eller ett förslag ("jag hade gjort annorlunda").
 *
 * `title`, `intro` och `categories` kan sättas per plats: Spela kort använder
 * standarden (hela given), Budvisningen skickar budgivningsspecifik text.
 * `lage` säger var i appen rapporten skrevs och följer med i rapporten.
 */
export function FelrapportDialog({
  deal,
  calls,
  contract,
  tricks,
  onClose,
  lage,
  title = 'Rapportera fel i given',
  intro = DEFAULT_INTRO,
  categories = REPORT_CATEGORIES,
}: {
  deal: Deal
  calls: ResolvedCall[]
  contract: Contract | null
  tricks: Trick[]
  onClose: () => void
  lage?: string
  title?: string
  intro?: string
  categories?: readonly string[]
}) {
  const [category, setCategory] = useState<string>(categories[0])
  const [description, setDescription] = useState('')
  const [expected, setExpected] = useState('')
  // Lockfällan: osynligt fält som bara robotar fyller i.
  const [webbplats, setWebbplats] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const forslag = rapportTyp(category) === 'forslag'

  async function skicka() {
    setStatus('sending')
    setErrorMsg('')
    try {
      await skickaRapport({
        ...byggRapport({ deal, calls, contract, tricks, category, description, expected, lage }),
        webbplats,
      })
      setStatus('sent')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Något gick fel.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <Dialog onClose={onClose} className="w-full max-w-sm p-4 text-left">
        <h2 className="text-sm font-bold text-accent">
          ✓ Tack – {forslag ? 'förslaget' : 'rapporten'} är skickat{forslag ? '' : 'd'}!
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Hela given följde med. Du behöver inte göra något mer.
        </p>
        <div className="mt-3 flex justify-end">
          <Button onClick={onClose}>Stäng</Button>
        </div>
      </Dialog>
    )
  }

  const sending = status === 'sending'

  // Ingen onClose: en halvskriven rapport ska inte försvinna på ett klick
  // utanför rutan — bara Avbryt-knappen stänger.
  return (
    <Dialog className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto p-4 text-left">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{intro}</p>

        <fieldset className="mt-3 space-y-1.5" disabled={sending}>
          <legend className="sr-only">Vad gäller det?</legend>
          {categories.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="radio"
                name="felkategori"
                checked={category === c}
                onChange={() => setCategory(c)}
                className="accent-emerald-600"
              />
              {c}
            </label>
          ))}
        </fieldset>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={4000}
          disabled={sending}
          aria-label={forslag ? 'Beskriv ditt förslag' : 'Beskriv vad som kändes fel'}
          placeholder={
            forslag
              ? 'Beskriv med egna ord vad du hade gjort i stället …'
              : 'Beskriv gärna med egna ord vad som kändes fel …'
          }
          className="mt-3 w-full rounded-lg border border-line-strong p-2 text-sm text-ink focus:border-emerald-500 focus:outline-none disabled:opacity-60"
        />

        {/* Ägarbeslut 2026-10-06: "Rätt bud + varför" är det som gör en fix hållbar —
            ifyllt blir det facit för /felrapporter, tomt tvingar kommandot att fråga. */}
        <label className="mt-3 block text-xs font-semibold text-ink-soft" htmlFor="felrapport-ratt">
          Rätt bud eller kort + varför
        </label>
        <textarea
          id="felrapport-ratt"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          rows={2}
          maxLength={2000}
          disabled={sending}
          placeholder="T.ex. 3♥ – visar fem spader och fyra hjärter. Eller: ♠A – ta sticket, annars tappas det."
          className="mt-1 w-full rounded-lg border border-line-strong p-2 text-sm text-ink focus:border-emerald-500 focus:outline-none disabled:opacity-60"
        />
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Frivilligt, men det gör att saken kan rättas mycket snabbare.
        </p>

        {/* Lockfällan mot robotar: utanför skärmen, utan tabbstopp, dold för
            skärmläsare. En människa ser och fyller aldrig i den. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Webbplats
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={webbplats}
              onChange={(e) => setWebbplats(e.target.value)}
            />
          </label>
        </div>

        {status === 'error' && (
          <p role="alert" className="mt-2 rounded-lg bg-rose-50 p-2 text-xs leading-relaxed text-rose-700">
            {errorMsg} Fungerar det inte alls? Mejla{' '}
            <a href={`mailto:${RAPPORT_KONTAKT}`} className="underline underline-offset-2">
              {RAPPORT_KONTAKT}
            </a>
            .
          </p>
        )}

        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Skickas direkt – inget konto behövs. Skriv inget personligt: texten sparas i
          projektets öppna ärendelista.
        </p>

        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Avbryt
          </Button>
          <Button onClick={skicka} disabled={sending}>
            {sending ? 'Skickar …' : forslag ? 'Skicka förslag ✓' : 'Skicka rapport ✓'}
          </Button>
        </div>
    </Dialog>
  )
}
