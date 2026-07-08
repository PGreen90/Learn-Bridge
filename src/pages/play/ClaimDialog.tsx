// Claim-dialogen (ägarönskemål 2026-07-03): du påstår hur många stick din sida
// tar TOTALT i given (t.ex. "kontrakt +2"). Appen dömer med facit-lösaren: går
// sticken att säkra mot bästa motspel godkänns claimen och given avslutas,
// annars visas "Claim nekad" och spelet fortsätter.

import { Dialog } from '../../components/Dialog'

export function ClaimDialog({
  won,
  remaining,
  needed,
  message,
  onClaim,
  onClose,
}: {
  won: number
  remaining: number
  needed: number
  message: string | null
  onClaim: (total: number) => void
  onClose: () => void
}) {
  const totals: number[] = []
  for (let t = won; t <= won + remaining; t++) totals.push(t)
  const diffLabel = (t: number) => (t === needed ? 'kontrakt' : t > needed ? `+${t - needed}` : `${t - needed}`)
  return (
    <Dialog onClose={onClose} className="w-full max-w-sm p-4 text-center">
        <p className="text-sm font-bold text-ink">Claim tricks</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Din sida har <strong>{won}</strong> stick och <strong>{remaining}</strong> återstår.
          Hur många stick tar ni <strong>totalt</strong> i given?
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {totals.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onClaim(t)}
              className={`min-w-12 rounded-lg px-2 py-1.5 ring-1 transition-colors ${
                t >= needed
                  ? 'bg-accent-soft ring-accent-line hover:ring-accent'
                  : 'bg-panel-2 ring-line hover:bg-panel'
              }`}
            >
              <span className="block text-sm font-bold text-ink">{t}</span>
              <span className={`block text-[10px] font-medium ${t >= needed ? 'text-accent' : 'text-ink-muted'}`}>
                {diffLabel(t)}
              </span>
            </button>
          ))}
        </div>
        {message && <p className="mt-3 text-xs font-semibold text-danger">{message}</p>}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full border-t border-line pt-2.5 text-sm font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Avbryt — spela vidare
        </button>
    </Dialog>
  )
}
