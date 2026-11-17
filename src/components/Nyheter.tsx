import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { harSparatLokalt, loadSeddNyhet, saveSeddNyhet } from '../lib/backend'
import { NYHETER, olastNyhet, type Nyhet } from '../lib/nyheter'
import { lugnSida } from '../lib/uppdatering'
import { Button } from './Button'
import { Dialog } from './Dialog'

// Nyhetsrutan "Uppdatering vX.Y.Z" (ägarbeslut 2026-11-12). Två vägar in:
//  • av sig själv, EN gång per version, första gången man står på en lugn sida
//    efter uppdateringen (aldrig över en pågående giv),
//  • när man vill, via versionsnumret i sidfoten — då visas alla versioner,
//    men bara den SENASTE utfälld; äldre är rubrikrader som fälls ut en i taget
//    (ägarönskan 2026-11-17: listan växte sig lång).

function Punkter({ nyhet }: { nyhet: Nyhet }) {
  return (
    <ul className="mt-3 space-y-2.5">
      {nyhet.punkter.map((p) => (
        <li key={p.rubrik} className="flex gap-2.5 text-sm">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
          <span className="text-ink-soft">
            <strong className="font-semibold text-ink">{p.rubrik}.</strong> {p.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Post({ nyhet }: { nyhet: Nyhet }) {
  return (
    <section>
      <h2 className="font-brand text-xl text-ink">Uppdatering v{nyhet.version}</h2>
      <Punkter nyhet={nyhet} />
    </section>
  )
}

/** En rad i hela listan: rubriken är en knapp som fäller ut/ihop versionen. */
function FallbarPost({ nyhet, oppen, onVaxla }: { nyhet: Nyhet; oppen: boolean; onVaxla: () => void }) {
  return (
    <section className="py-2.5 first:pt-0 last:pb-0">
      <h2>
        <button
          type="button"
          onClick={onVaxla}
          aria-expanded={oppen}
          aria-label={`Uppdatering v${nyhet.version}`}
          className="flex w-full items-baseline gap-2 text-left"
        >
          <span className={oppen ? 'font-brand text-xl text-ink' : 'font-brand text-base text-ink-soft'}>
            Uppdatering v{nyhet.version}
          </span>
          <span className="text-xs text-ink-soft">{nyhet.datum}</span>
          <span aria-hidden className="ml-auto text-sm text-ink-soft">
            {oppen ? '▾' : '▸'}
          </span>
        </button>
      </h2>
      {oppen && <Punkter nyhet={nyhet} />}
    </section>
  )
}

function NyhetsDialog({ nyheter, onClose }: { nyheter: Nyhet[]; onClose: () => void }) {
  // Flera versioner (sidfotens lista): senaste utfälld, högst en öppen i taget.
  const [oppen, setOppen] = useState<string | null>(nyheter[0]?.version ?? null)
  return createPortal(
    <Dialog onClose={onClose} className="max-h-[85vh] w-full max-w-sm overflow-y-auto p-5 text-left">
      {nyheter.length === 1 ? (
        <Post nyhet={nyheter[0]} />
      ) : (
        <div className="divide-y divide-ink/10">
          {nyheter.map((n) => (
            <FallbarPost
              key={n.version}
              nyhet={n}
              oppen={oppen === n.version}
              onVaxla={() => setOppen(oppen === n.version ? null : n.version)}
            />
          ))}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose} autoFocus>
          Okej
        </Button>
      </div>
    </Dialog>,
    document.body,
  )
}

/** Visar senaste nyheten en gång per användare och version. Ligger i Layout.
 *  `signedIn` räcker som tecken på "befintlig användare" om enheten är ny. */
export function NyhetsRuta({ pathname, signedIn }: { pathname: string; signedIn: boolean }) {
  const [nyhet, setNyhet] = useState<Nyhet | null>(null)
  useEffect(() => {
    if (nyhet || !lugnSida(pathname)) return
    const sedd = loadSeddNyhet()
    const olast = olastNyhet(sedd, signedIn || harSparatLokalt())
    if (olast) {
      setNyhet(olast)
    } else if (sedd === null && NYHETER[0] && !signedIn) {
      // Helt ny besökare: inget att berätta — men NÄSTA uppdatering ska visas.
      saveSeddNyhet(NYHETER[0].version)
    }
  }, [pathname, signedIn, nyhet])

  if (!nyhet || !lugnSida(pathname)) return null
  return (
    <NyhetsDialog
      nyheter={[nyhet]}
      onClose={() => {
        saveSeddNyhet(nyhet.version)
        setNyhet(null)
      }}
    />
  )
}

/** Versionsnumret i sidfoten: tryck för att läsa alla uppdateringar igen. */
export function VersionsKnapp({ version, className }: { version: string; className?: string }) {
  const [oppen, setOppen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOppen(true)} className={className} aria-label={`Version ${version} — visa nyheter`}>
        v{version}
      </button>
      {oppen && <NyhetsDialog nyheter={NYHETER} onClose={() => setOppen(false)} />}
    </>
  )
}
