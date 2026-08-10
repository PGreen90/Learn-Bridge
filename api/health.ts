// Beslut B etapp 0 — api-skelettet.
//
// Detta är den FÖRSTA serverfunktionen (Vercel Functions, Node). Den bevisar att
// api/-mappen paketeras av bygget och att endpointen svarar live — grunden hela
// Beslut B vilar på. Ingen backend-logik, ingen databas, inga hemligheter än.
//
// Den kör medvetet INTE motorn än. Motorns filer (src/lib/engine) importerar
// varandra UTAN filändelse (t.ex. `from './deal'`), vilket funkar i webbläsar-
// bygget (Vite buntar) men INTE i en rå Vercel Node-funktion: Node ESM på
// servern kräver explicit `.js` och kraschar annars med ERR_MODULE_NOT_FOUND
// (verifierat 2026-08-09). Att köra motorn server-side (giv-generering +
// omspelningsvalidering) kräver därför ett bundlingssteg (esbuild) — det sätts
// upp i etapp 2, där det faktiskt behövs.
//
// Adressen /api/* skyddas från service workern i vite.config.ts (PWA-vakten),
// låst av src/deploy-config.test.ts.

import type { IncomingMessage, ServerResponse } from 'node:http'

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ ok: true, tjänst: 'rebidz', tid: new Date().toISOString() }))
}
