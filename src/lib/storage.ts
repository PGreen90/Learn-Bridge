// Liten hjälpare för att spara framsteg i webbläsaren (localStorage).
// Allt nycklas under "learnbridge:" så vi inte krockar med annat på sidan.

const PREFIX = 'learnbridge:'

/** Läs ett sparat värde, eller fallback om inget finns/går fel. */
export function loadValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** Spara ett värde (görs om till JSON automatiskt). */
export function saveValue<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Full lagring eller blockerad – ignorera tyst, appen funkar ändå.
  }
}

/** Finns NÅGOT sparat av appen på den här enheten? (Nyhetsrutan: en helt ny
 *  besökare ska inte få "nyheter".) `utom` = nycklar som inte räknas. */
export function harSparat(utom: string[] = []): boolean {
  try {
    const hoppa = new Set(utom.map((k) => PREFIX + k))
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX) && !hoppa.has(k)) return true
    }
  } catch {
    // ignorera
  }
  return false
}

/** Radera ALLT appen sparat (används av "Nollställ framsteg"). */
export function clearAllProgress(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignorera
  }
}
