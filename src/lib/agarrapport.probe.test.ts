// ÄGARRAPPORTEN — hämtningen (nästa nivå etapp 2, 2026-11-11).
// Körs ALDRIG i vanliga `npm test`/deploygrinden (skipIf), bara på begäran:
//
//   PowerShell:  $env:AGARRAPPORT='1'; npx vitest run src/lib/agarrapport.probe.test.ts
//   Bash:        AGARRAPPORT=1 npx vitest run src/lib/agarrapport.probe.test.ts
//
// eller av veckojobbet i Actions (agarrapport.yml), som visar rapporten som
// körningens sammanfattning.
//
// Läser BARA: konton (id, skapad, bot-flagga) och tävlingsresultat (konto-id,
// tidpunkt) från de senaste 45 dagarna. Skriver ingenting till databasen.
// Rapporten innehåller enbart ANTAL — inga namn, e-postadresser eller id:n —
// eftersom Actions-loggarna i ett publikt repo är läsbara för alla.
//
// Nycklarna (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) läses ur miljön eller ur
// .env.local (gitignorad) och skrivs aldrig ut.

import { expect, it } from 'vitest'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { restGetAlla } from '../../api-src/_lib/supabase-rest'
import { agarrapportText, byggAgarrapport, type Kontorad, type Resultatrad } from './agarrapport'

const KOR = process.env.AGARRAPPORT === '1'

function miljo(namn: string): string | null {
  if (process.env[namn]) return process.env[namn] as string
  try {
    const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^${namn}=(.+)$`, 'm'))
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

it.skipIf(!KOR)(
  'ägarrapporten: konton, aktiva spelare och återkomst',
  async () => {
    const base = miljo('SUPABASE_URL')
    const key = miljo('SUPABASE_SERVICE_ROLE_KEY')
    expect(base && key, 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY saknas').toBeTruthy()

    const fran = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
    const konton = await restGetAlla<Kontorad>(base!, key!, 'profiles?select=id,created_at,is_bot&order=id')
    const resultat = await restGetAlla<Resultatrad>(
      base!,
      key!,
      `daily_results?created_at=gte.${encodeURIComponent(fran)}&select=user_id,created_at&order=created_at`,
    )

    const text = agarrapportText(byggAgarrapport(konton, resultat))
    mkdirSync('revisor-output', { recursive: true })
    writeFileSync(join('revisor-output', 'agarrapport.md'), text + '\n')
    // I Actions: visa rapporten som körningens sammanfattning.
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n')
    console.log('\n' + text + '\n')
  },
  120_000,
)
