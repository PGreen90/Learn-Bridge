import { useEffect, type ReactNode } from 'react'

/**
 * Delad modaldialog (UI-overhaul steg 2): mörk backdrop + panelkort i mitten,
 * med overlay-in/dialog-in-animationerna från index.css. ETT beteende överallt:
 *  - `onClose` satt → klick utanför kortet OCH Escape stänger.
 *  - `onClose` utelämnad → dialogen stängs bara via sina egna knappar
 *    (används där en oavsiktlig stängning kostar något, t.ex. en halvskriven
 *    felrapport eller resultatdialogen).
 * Kortet är alltid bg-panel + rounded-xl + shadow-xl; bredd/padding sätts av
 * anroparen via `className`.
 */
export function Dialog({
  onClose,
  children,
  className = '',
}: {
  onClose?: () => void
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`dialog-in rounded-xl bg-panel shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Osynlig heltäckande yta bakom en öppen meny/popover: fångar klicket utanför
 * så menyn stängs utan att man måste träffa knappen igen (R3-fynd #6).
 */
export function ClickAway({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      className="fixed inset-0 z-30 cursor-default"
      onClick={onClose}
    />
  )
}
