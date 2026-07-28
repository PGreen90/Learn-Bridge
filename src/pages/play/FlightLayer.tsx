// Flyglagret (etapp 3, "känsla i kortspelet"): ett overlay ovanpå bordet som
// animerar en KLON av det spelade kortet från källan (handen eller bordskanten)
// till kortets plats i sticket. Det riktiga kortet står redan på plats men hålls
// dolt av TrickCenterLive tills klonen landat — då byts de i samma bildruta.
// Animationen körs med WAAPI (el.animate), aldrig React-state per bildruta.

import { useLayoutEffect, useRef } from 'react'
import type { Seat } from '../../types/bridge'
import { PlayingCard } from '../../components/PlayingCard'
import { ms, type PlaySpeed } from './tempo'
import type { Flight } from './useCardFlight'

/** Slutvridning per säte — måste matcha stickmittens wrappers i
 *  TrickCenterLive (V ligger vriden 90°, Ö −90°, N/S ovridna). */
const FINAL_ROT: Record<Seat, number> = { N: 0, S: 0, W: 90, E: -90 }

export function FlightLayer({
  flight,
  speed,
  targetsKey,
  onDone,
}: {
  flight: Flight | null
  speed: PlaySpeed
  /** Signatur för vad stickmitten visar just nu. När fjärde kortet spelas är
   *  mitten tom EN commit (svepet sätts i nästa) — nyckeln ändras då och
   *  effekten mäter om, så även fjärde kortet får sin flygning. */
  targetsKey: string
  onDone: (id: number) => void
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const cloneRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!flight) return
    const layer = layerRef.current
    const clone = cloneRef.current
    // Målet: kortets säteswrapper i stickmitten (renderas dold under flygningen).
    // Sök inom det egna bordet (layerns förälder = Felt), inte hela dokumentet.
    const target = layer?.parentElement?.querySelector(`[data-flight-target="${flight.seat}"]`)
    if (!layer || !clone) return
    if (!target) return // målet inte utritat ännu — targetsKey ändras strax och vi mäter om
    const layerRect = layer.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const cloneRect = clone.getBoundingClientRect()
    if (targetRect.width === 0 || cloneRect.width === 0) {
      onDone(flight.id) // omätbar miljö → hoppa över flygningen, kortet visas direkt
      return
    }

    // Allt räknas i MITTPUNKTER (rotationssäkert — ett vridet korts rect har
    // bytt bredd/höjd, men mitten är densamma). Klonen ställs i mål och
    // "from"-keyframen förskjuter den bakåt till källan.
    const toX = targetRect.left + targetRect.width / 2 - layerRect.left
    const toY = targetRect.top + targetRect.height / 2 - layerRect.top
    clone.style.left = `${toX}px`
    clone.style.top = `${toY}px`
    clone.style.visibility = 'visible'

    let dx: number
    let dy: number
    let scale: number
    let fromRot: number
    if (flight.from) {
      dx = flight.from.left + flight.from.width / 2 - layerRect.left - toX
      dy = flight.from.top + flight.from.height / 2 - layerRect.top - toY
      // Största sidan mot största sidan → rätt även när källan låg vriden.
      scale =
        Math.max(flight.from.width, flight.from.height) /
        Math.max(cloneRect.width, cloneRect.height)
      fromRot = flight.fromRotated ? 90 : 0
    } else {
      // Dold hand: kortet dyker upp strax utanför sätets bordskant, redan
      // slutvridet, och glider rakt in mot sin plats i sticket.
      const half = Math.max(cloneRect.width, cloneRect.height) / 2 + 6
      dx = flight.seat === 'W' ? -(toX + half) : flight.seat === 'E' ? layerRect.width + half - toX : 0
      dy = flight.seat === 'N' ? -(toY + half) : flight.seat === 'S' ? layerRect.height + half - toY : 0
      scale = 1
      fromRot = FINAL_ROT[flight.seat]
    }

    const anim = clone.animate(
      [
        {
          transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${fromRot}deg) scale(${scale})`,
        },
        { transform: `translate(-50%, -50%) rotate(${FINAL_ROT[flight.seat]}deg) scale(1)` },
      ],
      // Husets kurva — samma som card-in. fill: both håller klonen i mål tills
      // React hunnit visa det riktiga kortet (samma commit som onDone).
      { duration: ms('flight', speed), easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'both' },
    )
    let cancelled = false
    anim.finished.then(
      () => {
        if (!cancelled) onDone(flight.id)
      },
      () => {}, // cancel() avvisar finished — inget att göra
    )
    return () => {
      cancelled = true
      anim.cancel()
    }
  }, [flight, speed, targetsKey, onDone])

  if (!flight) return null
  return (
    <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0 z-30">
      {/* Osynlig tills effekten mätt och ställt den — annars blinkar den i hörnet. */}
      <div ref={cloneRef} className="absolute" style={{ visibility: 'hidden' }}>
        <PlayingCard card={flight.card} size="sm" />
      </div>
    </div>
  )
}
