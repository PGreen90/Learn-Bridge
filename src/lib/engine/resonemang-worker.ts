// RESONEMANGSLAGRETS WEBWORKER (sunt förnuft steg 3, 2026-09-23; docs/sunt-fornuft-plan.md).
// Kör simuleringen (resonemang.ts) + WASM-dubbeldummyn AV huvudtråden, så bordet
// aldrig fryser under bottens betänketid (standardläget: ett bestämt antal händer,
// samma svar som servern och nattgranskningen räknar fram — 2026-09-24).
//
// Protokoll: huvudtråden postar { reqId, deal, history, seat };
// workern svarar { reqId, call: { seat, bid, rule: 'resonemang', explanation } }
// eller { reqId, error } → huvudtråden faller tillbaka på pass. Laddas via
// new Worker(new URL(...)) i useGame.ts, inte via import.

import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { resoneraBot } from './resonemang'
import { computeOracle, getDds } from './revisor-dds'

interface Req {
  reqId: number
  deal: Deal
  history: ResolvedCall[]
  seat: Seat
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const { reqId, deal, history, seat } = e.data
  try {
    const dds = await getDds()
    const r = resoneraBot(deal, history, seat, (d) => computeOracle(dds, d).solve)
    const call: ResolvedCall = { seat, bid: r.val, rule: 'resonemang', explanation: r.forklaring } as ResolvedCall
    ;(self as unknown as Worker).postMessage({ reqId, call, hander: r.hander, ms: r.ms })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ reqId, error: String(err) })
  }
}
