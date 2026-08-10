// Visningsnamnets regler (Beslut B etapp 1). EN sanning för hur ett namn får se
// ut — används av registreringsformuläret (vänligt fel innan vi ens frågar
// servern) och speglar EXAKT databasens CHECK/unik-regel i 0001_profiles.sql.
// Databasen är den slutliga domaren (särskilt för unikheten); det här lagret
// ger snabba, begripliga fel och stänger fula namn.
//
// Beslut (2026-08-10): 4–10 tecken, bokstäver (inkl. å ä ö) + siffror + _ och -,
// unikt/skiftlägesokänsligt. Namnet är LÅST efteråt; fula namn som ändå slinker
// förbi hanteras av ägaröverstyrningen (och senare en anmäl-knapp) — därför är
// blocklistan MEDVETET kort och konservativ (undviker att oskyldiga namn som
// råkar innehålla en delsträng nekas, "Scunthorpe-problemet").

export const DISPLAY_NAME_MIN = 4
export const DISPLAY_NAME_MAX = 10

// Samma teckenmängd som databasens CHECK (profiles.display_name_format).
const FORMAT = /^[A-Za-zÅÄÖåäö0-9_-]+$/

// Reserverade ord — nekas vid EXAKT (normaliserad) match. Skyddar roller och
// varumärket så ingen utger sig för att vara appen eller personalen.
const RESERVED = new Set<string>([
  'admin', 'administrator', 'moderator', 'rebidz', 'support', 'system', 'root',
  'official', 'officiell', 'staff', 'owner', 'agare', 'ägare', 'anonym',
  'anonymous', 'gast', 'gäst', 'guest', 'null', 'undefined',
])

// Grova ord/slurs — nekas som DELSTRÄNG (efter normalisering). Kort och begränsad
// till uttryck som i praktiken aldrig dyker upp oskyldigt i ett 4–10-teckensnamn.
const SLURS_SUBSTRING = [
  'nigger', 'nigga', 'faggot', 'cunt', 'hitler',
]

// Grova ord som nekas bara vid EXAKT (normaliserad) match — för korta/vanliga
// ord där en delsträngsmatch skulle slå fel (t.ex. blockera "Stefan").
const PROFANITY_EXACT = new Set<string>([
  'fuck', 'shit', 'bitch', 'whore', 'slut', 'rape', 'nazi',
  'fitta', 'kuk', 'hora', 'knulla', 'neger',
])

/** Normalisera för blocklistan: gemener, vanliga siffer-/teckenknep tillbaka
 *  till bokstäver (l33t), och bort med avdelare — så "adm1n" och "a_dmin" fångas
 *  som "admin". */
function normalizeForBlocklist(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_-]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
}

function isBlockedName(name: string): boolean {
  const n = normalizeForBlocklist(name)
  if (RESERVED.has(n) || PROFANITY_EXACT.has(n)) return true
  return SLURS_SUBSTRING.some((bad) => n.includes(bad))
}

export type DisplayNameCheck = { ok: true } | { ok: false; message: string }

/** Validera ett visningsnamn mot format, längd och blocklista. Unikheten kollas
 *  separat mot servern (databasens unika index är den slutliga domaren). */
export function validateDisplayName(raw: string): DisplayNameCheck {
  const name = raw.trim()
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
    return {
      ok: false,
      message: `Visningsnamnet måste vara ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} tecken.`,
    }
  }
  if (!FORMAT.test(name)) {
    return {
      ok: false,
      message: 'Bara bokstäver, siffror, _ och - är tillåtna (inga mellanslag).',
    }
  }
  if (isBlockedName(name)) {
    return { ok: false, message: 'Det namnet är inte tillåtet. Välj ett annat.' }
  }
  return { ok: true }
}
