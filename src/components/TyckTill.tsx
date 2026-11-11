import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MOTORSTAMPEL } from '../lib/build'
import { skickaRapport } from '../lib/backend/rapport'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { RAPPORT_KONTAKT } from './FelrapportDialog'

/** Ägarens två frågor till användarna (2026-11-11). */
export const TYCK_TILL_FRAGOR = ['Vad saknar du på rebidz?', 'Hur kan appen bli bättre?'] as const

/** Rapporttexten: frågorna som rubriker + var i appen den skrevs. Tomma svar
 *  markeras, så ägaren ser att frågan lämnades obesvarad (inte tappades bort). */
export function byggTyckTillText(svar: readonly string[], sida: string): string {
  const delar = TYCK_TILL_FRAGOR.flatMap((fraga, i) => [`**${fraga}**`, svar[i]?.trim() || '_(inget svar)_', ''])
  delar.push(`**Sida:** ${sida || '/'} · **Version:** ${MOTORSTAMPEL ?? 'utvecklingsbygge'}`)
  return delar.join('\n')
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

/** "Tyck till"-dialogen: två öppna frågor, inget konto, ett klick. */
export function TyckTillDialog({ onClose }: { onClose: () => void }) {
  const [svar, setSvar] = useState<string[]>(TYCK_TILL_FRAGOR.map(() => ''))
  const [webbplats, setWebbplats] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const tomt = svar.every((s) => s.trim() === '')
  const sending = status === 'sending'

  async function skicka() {
    setStatus('sending')
    setErrorMsg('')
    try {
      await skickaRapport({
        typ: 'tycktill',
        titel: 'Tyck till',
        text: byggTyckTillText(svar, window.location.hash.replace(/^#/, '').split('?')[0]),
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
        <h2 className="text-sm font-bold text-accent">✓ Tack – det här hjälper rebidz att bli bättre!</h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Allt som skickas in läses. Kom gärna tillbaka när du har fler idéer.
        </p>
        <div className="mt-3 flex justify-end">
          <Button onClick={onClose}>Stäng</Button>
        </div>
      </Dialog>
    )
  }

  // Ingen onClose på dialogen: halvskrivna svar ska inte försvinna på ett
  // klick utanför rutan — bara Avbryt stänger.
  return (
    <Dialog className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto p-4 text-left">
      <h2 className="text-sm font-bold text-ink">Tyck till om rebidz</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        Svara på en eller båda frågorna – kort eller långt. Inget konto behövs.
      </p>

      {TYCK_TILL_FRAGOR.map((fraga, i) => (
        <div key={fraga} className="mt-3">
          <label className="block text-xs font-semibold text-ink-soft" htmlFor={`tyck-till-${i}`}>
            {fraga}
          </label>
          <textarea
            id={`tyck-till-${i}`}
            value={svar[i]}
            onChange={(e) => setSvar((s) => s.map((v, j) => (j === i ? e.target.value : v)))}
            rows={3}
            maxLength={4000}
            disabled={sending}
            className="mt-1 w-full rounded-lg border border-line-strong p-2 text-sm text-ink focus:border-emerald-500 focus:outline-none disabled:opacity-60"
          />
        </div>
      ))}

      {/* Lockfällan mot robotar (samma som i felrapporten). */}
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
        Skriv inget personligt: texten sparas i projektets öppna ärendelista.
      </p>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={sending}>
          Avbryt
        </Button>
        <Button onClick={skicka} disabled={sending || tomt}>
          {sending ? 'Skickar …' : 'Skicka ✓'}
        </Button>
      </div>
    </Dialog>
  )
}

/** Länk-knappen som öppnar dialogen. Äger sitt eget öppet/stängt-läge, så den
 *  kan läggas var som helst (sidfoten, startsidan, tävlingsöversikten). */
export function TyckTillKnapp({ className, children = 'Tyck till' }: { className?: string; children?: React.ReactNode }) {
  const [oppen, setOppen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOppen(true)} className={className}>
        {children}
      </button>
      {/* Portal till <body>: knappen sitter ofta inne i en animerad behållare
          (sidans page-in, startsidans filt) där en "fixed" dialog annars fångas
          och hamnar bakom innehållet. */}
      {oppen && createPortal(<TyckTillDialog onClose={() => setOppen(false)} />, document.body)}
    </>
  )
}
