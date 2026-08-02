// Kontraktet mellan service worker-registreringen (src/pwa-update.ts) och
// Layouts "Ny version finns"-rad. Ligger i en EGEN fil utan beroenden med
// flit: pwa-update.ts importerar den virtuella modulen "virtual:pwa-register"
// som bara finns när Vite kör — komponenter (och deras tester) får därför
// aldrig importera pwa-update.ts direkt, bara den här filen.

/** Window-händelsen som skickas när en ny version av appen finns. */
export const NY_VERSION_EVENT = 'rebidz:ny-version'

/** Händelsens last: anropa update() för att byta till nya versionen (laddar om). */
export type NyVersionDetail = { update: () => void }
