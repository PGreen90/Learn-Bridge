// Monte-Carlo-webworker (docs/bot-hjarna.md, "tänj MC-fönstret"). Kör bot-hjärnans
// tunga Monte-Carlo-DDS AV huvudtråden så gränssnittet aldrig fryser – uppmätt tar
// ett slutspelsbeslut ~1–6 s, vilket skulle låsa fliken om det kördes inline.
//
// Protokoll: huvudtråden postar { reqId, state, seat, calls }; workern svarar
// { reqId, card, reason } (eller { reqId, error } om något går fel → huvudtråden
// faller då tillbaka på tumreglerna). `state`/`calls` är rena objekt (inga Set/
// funktioner) → strukturklonas oförändrade genom postMessage.

import type { ResolvedCall } from '../bidding'
import type { Seat } from '../../types/bridge'
import type { PlayState } from './play'
import { botCardSmartReasoned } from './play-bot'

interface Req {
  reqId: number
  state: PlayState
  seat: Seat
  calls: ResolvedCall[]
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { reqId, state, seat, calls } = e.data
  try {
    const choice = botCardSmartReasoned(state, seat, calls)
    ;(self as unknown as Worker).postMessage({ reqId, card: choice.card, reason: choice.reason })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ reqId, error: String(err) })
  }
}
