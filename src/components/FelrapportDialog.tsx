import { useState } from 'react'
import type { Deal } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import type { Contract, Trick } from '../lib/engine/play'
import { REPORT_CATEGORIES, felrapportUrl } from '../lib/felrapport'
import { Button } from './Button'

/** Standardtexten (Spela kort): hela given inklusive sticken följer med. */
const DEFAULT_INTRO = 'Hela given (händerna, budgivningen och sticken) följer med automatiskt.'

/**
 * "Kändes given rätt?"-dialogen: ägaren väljer kategori + skriver fritt, och
 * knappen öppnar en FÖRIFYLLD GitHub-issue (hela given + auktionen + ev. stick
 * följer med automatiskt). På GitHub räcker det att klicka "Submit new issue".
 *
 * `title`, `intro` och `categories` kan sättas per plats: Spela kort använder
 * standarden (hela given), Budvisningen skickar budgivningsspecifik text.
 */
export function FelrapportDialog({
  deal,
  calls,
  contract,
  tricks,
  onClose,
  title = 'Rapportera fel i given',
  intro = DEFAULT_INTRO,
  categories = REPORT_CATEGORIES,
}: {
  deal: Deal
  calls: ResolvedCall[]
  contract: Contract | null
  tricks: Trick[]
  onClose: () => void
  title?: string
  intro?: string
  categories?: readonly string[]
}) {
  const [category, setCategory] = useState<string>(categories[0])
  const [description, setDescription] = useState('')

  function openIssue() {
    const url = felrapportUrl({ deal, calls, contract, tricks, category, description })
    window.open(url, '_blank', 'noopener')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 text-left shadow-xl">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{intro}</p>

        <fieldset className="mt-3 space-y-1.5">
          <legend className="sr-only">Vad kändes fel?</legend>
          {categories.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
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
          placeholder="Beskriv gärna med egna ord vad som kändes fel …"
          className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
        />

        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Rapporten öppnas som en förifylld sida på GitHub — klicka{' '}
          <strong>Submit new issue</strong> där för att skicka den.
        </p>

        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={openIssue}>Öppna rapporten →</Button>
        </div>
      </div>
    </div>
  )
}
