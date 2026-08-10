// Beslut B etapp 2 (steg 1) — MOTORPROV.
//
// Den första serverfunktionen som faktiskt kör bridge-MOTORN. Syftet är enbart
// att bevisa att buntningssteget (scripts/build-api.mjs) löser fyndet från
// etapp 0: motorns extensionslösa importkedja (daily.ts → deal.ts → typerna)
// buntas till EN fil och kör under Node på Vercel. Health-endpointen körde
// medvetet INTE motorn; den här gör det.
//
// TILLFÄLLIG: den ersätts av den riktiga servergiv-genereringen (hemligt
// HMAC-frö + databaslagring, dolda händer via RLS) i steg 2. Så länge den
// lever exponerar den bara en deterministisk, redan publik giv (Dagens giv #1).

import type { IncomingMessage, ServerResponse } from 'node:http'
import { dailyDealByNumber } from '../src/lib/engine/daily'

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  const deal = dailyDealByNumber(1) // deterministisk, samma varje gång
  const kortPerHand = Object.fromEntries(
    (['N', 'E', 'S', 'W'] as const).map((s) => [s, deal.hands[s].length]),
  )
  res.statusCode = 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(
    JSON.stringify({
      ok: true,
      prov: 'motorn kördes server-side (buntad)',
      giv: deal.id,
      giver: deal.dealer,
      zon: deal.vulnerability,
      kortPerHand,
    }),
  )
}
