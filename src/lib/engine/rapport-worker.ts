// Rondgenomgångens DD-worker (etapp 3). Kör analyzeDd AV huvudtråden — värsta
// fallet (en sprängd nodbudget på en tung ställning) tar sekunder och skulle
// annars frysa fliken. Samma mönster som mc-worker.ts.
//
// Protokoll: huvudtråden postar { reqId, deal, contract, tricks }; workern
// svarar { reqId, analys } (eller { reqId, error } → huvudtråden räknar inline
// i stället). Allt är rena objekt → strukturklonas oförändrade.

import type { Deal } from '../../types/bridge'
import type { Contract, Trick } from './play'
import { analyzeDd } from './rond-dd'

interface Req {
  reqId: number
  deal: Deal
  contract: Contract
  tricks: Trick[]
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { reqId, deal, contract, tricks } = e.data
  try {
    const analys = analyzeDd(deal, contract, tricks)
    ;(self as unknown as Worker).postMessage({ reqId, analys })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ reqId, error: String(err) })
  }
}
