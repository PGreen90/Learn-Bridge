// Den öppna rapportmottagarens rena logik (nästa nivå etapp 1, 2026-11-11).
//
// Vem som helst får skicka felrapport, förslag eller "Tyck till" — utan konto.
// Servern är därför en VAKTAD vidarebefordrare: den släpper bara igenom tre
// kända typer, med rubriker som börjar som typen säger, under fasta längdtak,
// och oskadliggör @-omnämnanden. Allt här är rent (inga nätanrop) så det går
// att låsa med tester; själva skicket bor i rapport.ts.

import { createHmac } from 'node:crypto'

/** Typ → etikett på ärendet + hur rubriken måste börja. */
export const RAPPORT_TYPER = {
  felrapport: { etikett: 'felrapport', prefix: 'Felrapport: ' },
  forslag: { etikett: 'forslag', prefix: 'Förslag: ' },
  tycktill: { etikett: 'tyck-till', prefix: 'Tyck till' },
} as const

export type RapportTyp = keyof typeof RAPPORT_TYPER

export const MAX_TITEL = 200
export const MAX_TEXT = 20_000

export type Granskad =
  | { ok: true; typ: RapportTyp; etikett: string; titel: string; text: string }
  /** Lockfällan slog till: svara "tack" men skicka inget vidare. */
  | { ok: true; tyst: true }
  | { ok: false; status: number; fel: string }

/** Ett "@namn" på GitHub skickar en notis till den personen — ett nollbrett
 *  mellanslag efter @ gör texten läsbar men ofarlig. */
function utanOmnamnanden(s: string): string {
  return s.replace(/@(?=\w)/g, '@​')
}

/** Styrtecken bort (radbrytning och tabb får stå kvar i brödtexten). */
function utanStyrtecken(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
}

export function granskaRapport(body: unknown): Granskad {
  if (!body || typeof body !== 'object') return { ok: false, status: 400, fel: 'Ogiltig rapport' }
  const b = body as Record<string, unknown>

  // Lockfällan: fältet är osynligt för människor, robotar fyller i det.
  if (typeof b.webbplats === 'string' && b.webbplats.trim() !== '') return { ok: true, tyst: true }

  const typ = b.typ
  if (typeof typ !== 'string' || !Object.prototype.hasOwnProperty.call(RAPPORT_TYPER, typ)) {
    return { ok: false, status: 400, fel: 'Okänd rapporttyp' }
  }
  const regler = RAPPORT_TYPER[typ as RapportTyp]

  if (typeof b.titel !== 'string' || typeof b.text !== 'string') {
    return { ok: false, status: 400, fel: 'Ogiltig rapport' }
  }
  if (b.titel.length > MAX_TITEL || b.text.length > MAX_TEXT) {
    return { ok: false, status: 413, fel: 'Rapporten är för lång' }
  }
  if (!b.titel.startsWith(regler.prefix)) return { ok: false, status: 400, fel: 'Ogiltig rubrik' }
  if (b.text.trim() === '') return { ok: false, status: 400, fel: 'Rapporten är tom' }

  const titel = utanOmnamnanden(utanStyrtecken(b.titel).replace(/\s+/g, ' ').trim())
  const text = utanOmnamnanden(utanStyrtecken(b.text))
  return { ok: true, typ: typ as RapportTyp, etikett: regler.etikett, titel, text }
}

/** Avsändarens adress ur Vercels proxy-huvuden. Används BARA som nyckel till
 *  anropskvoten och sparas aldrig i klartext (se anonymNyckel). */
export function kallarIp(headers: Record<string, string | string[] | undefined>): string {
  const en = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const xff = en(headers['x-forwarded-for'])
  if (xff) return xff.split(',')[0].trim()
  return en(headers['x-real-ip'])?.trim() || 'okand'
}

/**
 * Kvotnyckel för en anonym avsändare: HMAC av adressen + dagens datum, formad
 * som en uuid så den ryms i den befintliga kvottabellen (api_kvot.user_id,
 * migration 0007) utan ny migration. Dagens datum i hashen gör att samma adress
 * får en ny nyckel varje dygn — nyckeln går inte att följa över tid och inte
 * att räkna tillbaka till adressen utan serverns hemlighet.
 */
export function anonymNyckel(hemlighet: string, ip: string, dag: string): string {
  const h = createHmac('sha256', hemlighet).update(`rapport:${dag}:${ip}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** Gemensam kvotnyckel för ALLA rapporter — ett dygnstak som håller även om
 *  någon byter adress för varje anrop. */
export const ALLA_RAPPORTER = '00000000-0000-4000-8000-000000000001'
