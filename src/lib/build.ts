// BYGGETS IDENTITET — commit-SHA:n sidan byggdes ur (vite.config.ts `define`).
//
// MOTORSTAMPEL följer med varje tävlingsinskick så nattgranskningen kan spela om
// botkorten mot EXAKT den motorversion given spelades med (tavlingsgranskning.ts
// — bakgrunden: spelmotor-deployer mitt på en tävlingsdag fällde ärliga inskick).
// null i utvecklingsbyggen ('dev') — då skickas ingen stämpel och granskningen
// faller tillbaka på de senaste motorversionerna på main.

import { giltigMotorstampel } from './engine/tavlingsgranskning'

const sha: unknown = typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : null

export const MOTORSTAMPEL: string | null = giltigMotorstampel(sha) ? sha : null
