// GitHub-nyckeln som låter appen skicka felrapporter DIREKT (utan att öppna
// GitHub-sidan). Nyckeln skapas av ägaren en gång och lever BARA i den här
// webbläsarens localStorage — den ligger aldrig i koden (som är publik).
//
// Medvetet EGEN lagringsnyckel utanför "learnbridge:"-prefixet, så
// "Nollställ framsteg" (clearAllProgress) inte råkar radera inloggningen —
// en nyckel är inte "framsteg".

const TOKEN_KEY = 'rebidz:felrapport-token'

/** Läs den sparade nyckeln, eller null om ingen finns. */
export function loadGithubToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw && raw.trim() ? raw.trim() : null
  } catch {
    return null
  }
}

/** Spara nyckeln (trimmad). Tom sträng raderar den. */
export function saveGithubToken(token: string): void {
  try {
    const trimmed = token.trim()
    if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Blockerad lagring – ignorera tyst, appen funkar ändå (faller tillbaka
    // på att öppna GitHub-sidan).
  }
}

/** Radera nyckeln. */
export function clearGithubToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignorera
  }
}

/** Finns en nyckel sparad? (styr om appen erbjuder direktskick.) */
export function hasGithubToken(): boolean {
  return loadGithubToken() !== null
}
