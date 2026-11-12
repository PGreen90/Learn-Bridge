// När får appen byta till en ny version AV SIG SJÄLV? (ägarbeslut 2026-11-12)
//
// Bakgrund: sedan 2026-08-02 byter appen aldrig version tyst — en rad "Ny
// version finns" visas och användaren trycker själv. Det skyddar en pågående
// giv, men den som bara öppnar startsidan blev sittande på gamla versionen och
// missade nyheter (guld-tävlingen syntes inte förrän man tryckt Uppdatera).
//
// Regeln: på en LUGN sida — där inget kan gå förlorat — laddar appen om själv.
// Överallt annars visas raden som förr och användaren väljer.

/** Sidor utan spel, övning eller formulär: en omladdning kostar ingenting.
 *  MEDVETET en vitlista — en ny sida är "inte lugn" tills någon lagt den här. */
const LUGNA = new Set(['/', '/om', '/budsystem', '/sa-bjuder-rebidz', '/budtraning'])

export function lugnSida(pathname: string): boolean {
  return LUGNA.has(pathname)
}

/** Får appen ladda om sig själv just nu? Lugn sida, ingen dialog öppen (Tyck
 *  till, felrapporten) och inget textfält i fokus. */
export function farUppdateraSjalv(pathname: string, doc: Document): boolean {
  if (!lugnSida(pathname)) return false
  if (doc.querySelector('[role="dialog"]')) return false
  const aktiv = doc.activeElement
  if (aktiv && /^(INPUT|TEXTAREA|SELECT)$/.test(aktiv.tagName)) return false
  return true
}
