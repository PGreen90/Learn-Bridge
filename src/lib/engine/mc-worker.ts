// Monte-Carlo-webworker (docs/bot-hjarna.md, "tänj MC-fönstret"). Kör bot-hjärnans
// tunga Monte-Carlo-DDS AV huvudtråden så gränssnittet aldrig fryser – uppmätt tar
// ett slutspelsbeslut ~1–6 s, vilket skulle låsa fliken om det kördes inline.
//
// Protokoll: huvudtråden postar { reqId, state, seat, calls, seed? }; workern
// svarar { reqId, card, reason } (eller { reqId, error } om något går fel →
// huvudtråden faller då tillbaka på tumreglerna). `state`/`calls` är rena objekt
// (inga Set/funktioner) → strukturklonas oförändrade genom postMessage.
//
// `seed` (Beslut B etapp 2): för tävlingsspel skickas ett NUMERISKT frö (en
// funktion kan inte strukturklonas), och workern bygger mulberry32 själv och
// trär den som Monte-Carlos slumpkälla → deterministiskt botkort, omspelbart av
// servern. Utan seed körs Math.random precis som i vanligt spel.

import type { ResolvedCall } from '../bidding'
import type { Seat } from '../../types/bridge'
import type { PlayState } from './play'
import { botCardSmartReasoned } from './play-bot'
import { mulberry32 } from './deal'
import { laddaSnabbLosare } from './mc-losare'

interface Req {
  reqId: number
  state: PlayState
  seat: Seat
  calls: ResolvedCall[]
  seed?: number
}

// Lösarbytet 2026-11-15: den snabba lösaren (bridge-dds) laddas EN gång när
// workern startar. Varje beslut väntar in laddningen — annars skulle de första
// korten räknas med TS-lösaren och kunna skilja sig från nattgranskningens val.
// Går den inte att ladda räknar röstningen med TS-lösaren som förr.
const losareKlar = laddaSnabbLosare()

self.onmessage = async (e: MessageEvent<Req>) => {
  const { reqId, state, seat, calls, seed } = e.data
  try {
    await losareKlar
    const opts = seed !== undefined ? { rng: mulberry32(seed) } : undefined
    const choice = botCardSmartReasoned(state, seat, calls, opts)
    ;(self as unknown as Worker).postMessage({ reqId, card: choice.card, reason: choice.reason })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ reqId, error: String(err) })
  }
}
