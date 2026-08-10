// Beslut B etapp 2 — fröad bot-slump för tävlingsspel.
//
// I en tävling måste bottarna spela DETERMINISTISKT, så att servern kan spela om
// given och validera ett inskickat resultat (docs/beslut-b-plan.md, 2a). Men i
// stället för att träda EN slumpkälla genom hela given (vars reproduktion beror
// på i exakt vilken ordning slumpen konsumeras — skört mellan webworker/inline)
// härleds ett FRISKT frö per enskilt botbeslut ur (tävlingens play-frö, hur
// många kort som redan spelats). Då är varje beslut reproducerbart direkt ur
// ställningen: servern når samma beslutsindex → samma frö → samma botkort.
//
// Vanligt spel (utan play-frö) rör aldrig det här — då kör bottarna Math.random
// precis som förut.

/** Beslutsindexet = antal kort som spelats i given (0 vid utspelet). Rent
 *  härlett ur ställningen, så klient och server räknar identiskt. */
export function playIndexOf(completedTricks: number, currentTrickLen: number): number {
  return completedTricks * 4 + currentTrickLen
}

/** Fröet för ETT botbeslut, ur tävlingens play-frö och beslutsindexet. Weyl-steg
 *  (gyllene-snitts-konstanten) så intilliggande index ger väl spridda frön;
 *  mulberry32 nedströms dekorrelerar sedan själva sekvensen. Osignerat 32-bitars. */
export function botDecisionSeed(playSeed: number, playIndex: number): number {
  return (Math.imul(playIndex + 1, 0x9e3779b1) ^ playSeed) >>> 0
}
