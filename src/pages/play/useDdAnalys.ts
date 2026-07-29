// Hooken som kör rondgenomgångens DD-dom (etapp 3): startar analysen först när
// rapporten faktiskt öppnas (`enabled`), helst i rapport-worker.ts av huvud-
// tråden, annars inline (samma fallback-mönster som Monte-Carlo-workern i
// usePlayTable). Resultatet lever så länge vyn är öppen; stängs och öppnas
// rapporten igen räknas den om (sena lägen är billiga, tunga ger ändå null).

import { useEffect, useState } from 'react'
import type { Deal } from '../../types/bridge'
import type { Contract, Trick } from '../../lib/engine/play'
import { analyzeDd, type DdAnalys } from '../../lib/engine/rond-dd'

/** Watchdog: svarar workern inte inom detta räknar vi inline i stället. */
const WORKER_TIMEOUT = 15_000

export function useDdAnalys(
  deal: Deal,
  contract: Contract,
  tricks: Trick[],
  enabled: boolean,
  budget?: number,
): { analys: DdAnalys | null; running: boolean } {
  const [analys, setAnalys] = useState<DdAnalys | null>(null)
  const [running, setRunning] = useState(false)

  // OBS: ingen kör-en-gång-ref här — StrictMode i dev monterar om komponenten
  // och en ref som överlever städningen skulle lämna analysen ostartad för
  // alltid (hänt: "beräknas …" som aldrig blev klar). Effekten är i stället
  // omstartbar: städningen dödar pågående körning, och när `analys` väl finns
  // kliver den ur direkt.
  useEffect(() => {
    if (!enabled || analys) return
    setRunning(true)

    let dead = false
    let worker: Worker | null = null
    let watchdog: ReturnType<typeof setTimeout> | null = null

    const klar = (a: DdAnalys) => {
      if (dead) return
      setAnalys(a)
      setRunning(false)
    }
    // Inline-reserven: setTimeout så "beräknas…" hinner målas innan tråden jobbar.
    const inline = () =>
      setTimeout(() => {
        if (dead) return
        try {
          klar(analyzeDd(deal, contract, tricks, budget))
        } catch {
          setRunning(false) // trasig indata → ingen dom (UI:t visar inget facit)
        }
      }, 0)

    try {
      worker = new Worker(new URL('../../lib/engine/rapport-worker.ts', import.meta.url), {
        type: 'module',
      })
    } catch {
      worker = null
    }
    if (worker) {
      const reqId = 1
      watchdog = setTimeout(() => {
        worker?.terminate()
        inline()
      }, WORKER_TIMEOUT)
      worker.onmessage = (e: MessageEvent<{ reqId: number; analys?: DdAnalys; error?: string }>) => {
        if (e.data.reqId !== reqId) return
        if (watchdog) clearTimeout(watchdog)
        if (e.data.analys) klar(e.data.analys)
        else inline()
      }
      worker.onerror = () => {
        if (watchdog) clearTimeout(watchdog)
        inline()
      }
      worker.postMessage({ reqId, deal, contract, tricks })
    } else {
      inline()
    }

    return () => {
      dead = true
      if (watchdog) clearTimeout(watchdog)
      worker?.terminate()
    }
  }, [enabled, analys, deal, contract, tricks, budget])

  return { analys, running }
}
