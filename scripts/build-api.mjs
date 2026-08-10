// Beslut B etapp 2 (steg 1) — buntar serverfunktioner.
//
// Bakgrund (fynd 2026-08-09, docs/beslut-b-plan.md): motorns filer i
// src/lib/engine importerar varandra UTAN filändelse (`from './deal'`). Vites
// webbläsarbygge buntar och klarar det, men en RÅ Vercel Node-funktion kör
// motorn som ren Node ESM, som kräver explicit `.js` och kraschar annars med
// ERR_MODULE_NOT_FOUND. Lösningen: esbuild med `bundle: true` klistrar ihop
// varje serverfunktion + den motorkod den drar in till EN självständig fil
// utan kvarvarande relativa importer, som Node kör direkt.
//
// Källorna bor i api-src/*.ts (typkontrolleras av tsc). Utdata blir api/*.js,
// som Vercel deployar som serverless-funktioner. De genererade api/*.js är
// generat och gitignorade — `npm run build` (som Vercel kör) återskapar dem.

import { build } from 'esbuild'
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'api-src')
const OUT = join(root, 'api')

/** Alla funktionskällor i api-src/ (hoppar över testfiler). */
export function apiEntries() {
  if (!existsSync(SRC)) return []
  return readdirSync(SRC).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
}

/**
 * Buntar api-src/*.ts → api/*.js. `write: false` skriver inget utan returnerar
 * de buntade filerna i minnet (facit-testet kör dem utan att röra api/).
 */
export async function buildApi({ write = true } = {}) {
  const entries = apiEntries()
  if (entries.length === 0) return { outputFiles: [] }
  return build({
    entryPoints: entries.map((f) => join(SRC, f)),
    outdir: OUT,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    // Riktiga npm-beroenden ska INTE buntas in (Vercel installerar dem i
    // funktionsmiljön). Motorn har inga; supabase-js kommer i steg 2.
    external: ['@supabase/supabase-js'],
    write,
    logLevel: 'silent',
  })
}

// Kör direkt (node scripts/build-api.mjs) → skriv api/*.js.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await buildApi({ write: true })
  const n = apiEntries().length
  console.log(`Buntade ${n} api-funktion(er) → api/*.js`)
}
