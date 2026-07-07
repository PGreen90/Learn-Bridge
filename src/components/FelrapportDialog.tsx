import { useState } from 'react'
import type { Deal } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import type { Contract, Trick } from '../lib/engine/play'
import { REPORT_CATEGORIES, felrapportUrl, submitFelrapport } from '../lib/felrapport'
import { loadGithubToken } from '../lib/github-token'
import { Button } from './Button'

/** Standardtexten (Spela kort): hela given inklusive sticken följer med. */
const DEFAULT_INTRO = 'Hela given (händerna, budgivningen och sticken) följer med automatiskt.'

type Status = 'idle' | 'sending' | 'sent' | 'error'

/**
 * "Kändes given rätt?"-dialogen: ägaren väljer kategori + skriver fritt.
 *
 * Har ägaren sparat en GitHub-nyckel (Inställningar) skickas rapporten DIREKT
 * med ett klick – ingen GitHub-sida öppnas. Saknas nyckel faller vi tillbaka på
 * att öppna en FÖRIFYLLD GitHub-issue som ägaren skickar med "Submit new issue".
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
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const token = loadGithubToken()

  /** Fallback: öppna den förifyllda GitHub-sidan (som förr). */
  function openIssue() {
    const url = felrapportUrl({ deal, calls, contract, tricks, category, description })
    window.open(url, '_blank', 'noopener')
    onClose()
  }

  /** Direktskick via GitHubs API med den sparade nyckeln. */
  async function sendDirect() {
    if (!token) return
    setStatus('sending')
    setErrorMsg('')
    try {
      await submitFelrapport({ deal, calls, contract, tricks, category, description }, token)
      setStatus('sent')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Något gick fel.')
      setStatus('error')
    }
  }

  // Kvitto efter lyckat direktskick.
  if (status === 'sent') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
        <div className="w-full max-w-sm rounded-xl bg-panel p-4 text-left shadow-xl">
          <h2 className="text-sm font-bold text-accent">✓ Tack – rapporten är skickad!</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Hela given följde med. Du behöver inte göra något mer.
          </p>
          <div className="mt-3 flex justify-end">
            <Button onClick={onClose}>Stäng</Button>
          </div>
        </div>
      </div>
    )
  }

  const sending = status === 'sending'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-sm rounded-xl bg-panel p-4 text-left shadow-xl">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{intro}</p>

        <fieldset className="mt-3 space-y-1.5" disabled={sending}>
          <legend className="sr-only">Vad kändes fel?</legend>
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
          disabled={sending}
          placeholder="Beskriv gärna med egna ord vad som kändes fel …"
          className="mt-3 w-full rounded-lg border border-line-strong p-2 text-sm text-ink focus:border-emerald-500 focus:outline-none disabled:opacity-60"
        />

        {status === 'error' && (
          <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs leading-relaxed text-rose-700">
            {errorMsg} Du kan försöka igen eller öppna rapporten på GitHub istället.
          </p>
        )}

        {token ? (
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Rapporten skickas direkt till GitHub – inget mer du behöver göra.
          </p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Rapporten öppnas som en förifylld sida på GitHub – klicka{' '}
            <strong>Submit new issue</strong> där för att skicka den. (Vill du slippa det
            steget? Aktivera direktskick under <strong>Inställningar</strong>.)
          </p>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Avbryt
          </Button>
          {token ? (
            <>
              {status === 'error' && (
                <Button variant="secondary" onClick={openIssue} disabled={sending}>
                  Öppna på GitHub →
                </Button>
              )}
              <Button onClick={sendDirect} disabled={sending}>
                {sending ? 'Skickar …' : 'Skicka rapport ✓'}
              </Button>
            </>
          ) : (
            <Button onClick={openIssue}>Öppna rapporten →</Button>
          )}
        </div>
      </div>
    </div>
  )
}
