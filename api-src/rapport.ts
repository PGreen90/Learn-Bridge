// Nästa nivå etapp 1 (2026-11-11) — den ÖPPNA rapportmottagaren.
//
// Före detta gick felrapporten direkt från webbläsaren till GitHub, vilket i
// praktiken krävde ett eget GitHub-konto av alla utom ägaren. Nu skickar appen
// rapporten hit, och servern lägger ärendet i listan med en nyckel som bara
// finns i Vercels miljö. Ingen inloggning, ingen kod.
//
// Tre typer (rapport-logik.ts): felrapport · forslag · tycktill — var sin
// etikett, så /felrapporter-rutinen läser felen för sig och förslagen för sig.
//
// Skyddet, i ordning: POST krävs → storlekstak på kroppen → granskning
// (typ, rubrik, längd, lockfälla, @-omnämnanden) → anropskvot per avsändare
// (hashad adress, aldrig sparad i klartext) → dygnstak för alla tillsammans.
//
// Miljövariabler (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (kvoten),
// DAILY_SEED_SECRET (salt till adress-hashen), GITHUB_RAPPORT_TOKEN (nyckel med
// ENBART Issues: läs och skriv på ärende-repot). Valfri RAPPORT_REPO
// ("ägare/namn") pekar om ärendena till ett annat repo, t.ex. ett privat.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { stockholmDateISO } from '../src/lib/engine/daily'
import { kvotOk } from './_lib/kvot'
import { lasJson } from './_lib/las-json'
import { ALLA_RAPPORTER, anonymNyckel, granskaRapport, kallarIp } from './_lib/rapport-logik'

const STANDARD_REPO = 'PGreen90/Learn-Bridge'

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const json = (status: number, data: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  if (req.method !== 'POST') return json(405, { ok: false, fel: 'POST krävs' })

  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const salt = process.env.DAILY_SEED_SECRET
  const githubNyckel = process.env.GITHUB_RAPPORT_TOKEN
  if (!base || !key || !salt || !githubNyckel) {
    return json(503, { ok: false, fel: 'Rapporteringen är inte påslagen ännu' })
  }
  const repo = /^[\w.-]+\/[\w.-]+$/.test(process.env.RAPPORT_REPO ?? '')
    ? (process.env.RAPPORT_REPO as string)
    : STANDARD_REPO

  try {
    let body: unknown
    try {
      body = await lasJson(req, 100_000)
    } catch {
      return json(400, { ok: false, fel: 'Ogiltig rapport' })
    }

    const g = granskaRapport(body)
    if (!g.ok) return json(g.status, { ok: false, fel: g.fel })
    if ('tyst' in g) return json(200, { ok: true })

    // Kvoten: per avsändare (tio minuter) och för alla tillsammans (ett dygn).
    const avsandare = anonymNyckel(salt, kallarIp(req.headers), stockholmDateISO())
    if (!(await kvotOk(base, key, avsandare, 'rapport'))) {
      return json(429, { ok: false, fel: 'För många rapporter på kort tid — vänta några minuter' })
    }
    if (!(await kvotOk(base, key, ALLA_RAPPORTER, 'rapport-alla'))) {
      return json(429, { ok: false, fel: 'Rapportlådan är full för i dag — försök igen i morgon' })
    }

    const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubNyckel}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'rebidz-rapport',
      },
      body: JSON.stringify({ title: g.titel, body: g.text, labels: [g.etikett] }),
    })
    if (r.status !== 201) {
      // Svaret från GitHub lämnas aldrig ut till klienten (kan nämna nyckeln
      // eller repot) — bara statuskoden, i serverloggen.
      console.error(`rapport: GitHub svarade ${r.status}`)
      return json(502, { ok: false, fel: 'Rapporten kunde inte sparas just nu' })
    }
    return json(200, { ok: true })
  } catch (err) {
    console.error('rapport:', err instanceof Error ? err.message : err)
    return json(500, { ok: false, fel: 'Något gick fel på servern' })
  }
}
