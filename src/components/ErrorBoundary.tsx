import { Component, type ReactNode } from 'react'

// Felfångaren (Etapp A ur granskningen 2026-08-02): utan den avmonterar React
// hela appen vid ett okänt fel → helvit sida utan förklaring eller väg tillbaka.
// Här fångas felet och användaren får en förklaring + en "Ladda om"-knapp.
//
// Specialfallet chunk-fel: efter en deploy finns gamla JS-filer inte kvar på
// servern, så en flik som var öppen under deployen kan misslyckas med att
// lat-ladda en sida ("Failed to fetch dynamically imported module"). Det felet
// botas alltid av en omladdning (då hämtas nya index.html med nya filnamn) —
// därför laddar vi om automatiskt, men bara EN gång (vaktflaggan i
// sessionStorage), så ett fel som INTE botas av omladdning inte ger en evig
// omladdningsloop.

const RELOAD_FLAG = 'learnbridge:chunk-reloaded'

/** Känner igen felen som uppstår när en lat-laddad JS-fil inte går att hämta
 *  (olika webbläsare formulerar sig olika — Chrome/Firefox/Safari). */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch/i.test(
    msg,
  )
}

type Props = { children: ReactNode }
type State = { error: unknown | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidMount(): void {
    // Appen kom upp friskt → rensa vaktflaggan så NÄSTA deploy också får sin
    // engångsomladdning. (Får inte göras i render(): React kan göra om en
    // misslyckad rendering en extra gång, och då hann en render-rensning
    // nolla vakten mitt emellan två fångster → dubbel omladdning.)
    if (this.state.error === null) {
      try {
        sessionStorage.removeItem(RELOAD_FLAG)
      } catch {
        /* kvittar */
      }
    }
  }

  componentDidCatch(error: unknown): void {
    if (!isChunkLoadError(error)) return
    // Chunk-fel: ladda om automatiskt en gång. try/catch som i storage.ts —
    // blockerad sessionStorage får inte krascha felhanteraren av alla ställen.
    try {
      if (sessionStorage.getItem(RELOAD_FLAG) === null) {
        sessionStorage.setItem(RELOAD_FLAG, '1')
        window.location.reload()
      }
    } catch {
      // Utan sessionStorage vågar vi inte auto-ladda om (loop-risk) —
      // felskärmen nedan med sin knapp visas i stället.
    }
  }

  render() {
    if (this.state.error === null) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-ink">
        <div aria-hidden className="text-4xl">
          ♠
        </div>
        <h1 className="font-brand text-2xl">Något gick fel</h1>
        <p className="max-w-sm text-sm text-ink-faint">
          Ett oväntat fel stoppade appen. Ladda om sidan och försök igen — om
          det händer flera gånger, rapportera det gärna.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
        >
          Ladda om
        </button>
        <a
          className="text-sm text-ink-faint underline"
          href="#/"
          onClick={() => {
            // Hash-byte räcker inte när appen är kraschad — ladda om också.
            window.setTimeout(() => window.location.reload(), 0)
          }}
        >
          ← Till startsidan
        </a>
      </div>
    )
  }
}
