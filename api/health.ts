// Beslut B etapp 0 — api-skelettet.
//
// Detta är den FÖRSTA serverfunktionen (Vercel Functions, Node). Den gör ännu
// ingenting nyttigt: den bevisar bara att motorn (ren TypeScript i src/lib/
// engine) går att importera och köra på servern — grunden hela Beslut B vilar
// på (servern ska senare generera givar och spela om resultat med SAMMA motor
// som klienten). Ingen backend-logik, ingen databas, inga hemligheter här än.
//
// Vi använder Nodes inbyggda http-typer (via @types/node) i stället för att dra
// in @vercel/node — Vercel skickar sina egna, kompatibla req/res-objekt.
// Adressen /api/* skyddas från service workern i vite.config.ts (PWA-vakten),
// låst av src/deploy-config.test.ts.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { dailySeed } from '../src/lib/engine/daily'

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  const kropp = {
    ok: true,
    tjänst: 'rebidz',
    // Bevis att motorn kör server-side: ett rent motoranrop.
    dagensFrö: dailySeed(),
    tid: new Date().toISOString(),
  }
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(kropp))
}
