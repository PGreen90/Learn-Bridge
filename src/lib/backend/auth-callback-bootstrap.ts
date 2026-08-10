// Fångar inloggningslänkar från mejl (Beslut B etapp 1, steg 5b) INNAN appen
// och HashRouter startar.
//
// Problemet: appen använder HashRouter (#-adresser), men Supabase lägger sina
// parametrar (code / token_hash / eventuellt fel) i den vanliga frågesträngen
// FÖRE #:et — t.ex. `https://rebidz.com/?flow=signup&code=abc`. HashRouter tittar
// bara efter #:et och skulle missa dem. Servern ser heller aldrig #-delen, så vi
// KAN inte peka länken direkt på en #-adress.
//
// Lösningen: så fort appen laddas, om frågesträngen bär en auth-parameter,
// flyttar vi den in i en riktig #-adress (`#/auth/callback?…`) och rensar den
// vanliga frågesträngen. Då kan callback-sidan (en helt vanlig route) läsa
// parametrarna och slutföra inloggningen.

/** Om nuvarande adress bär en auth-parameter i frågesträngen: skriv om den till
 *  `#/auth/callback?…` (samma parametrar) och rensa den vanliga frågesträngen.
 *  Anropas överst i main.tsx, före createRoot. Gör inget i normalfallet. */
export function hoistAuthCallbackToHash(): void {
  const search = window.location.search
  // Bara agera om det faktiskt är en inloggningslänk.
  if (!/[?&](code|token_hash|error|error_description)=/.test(search)) return

  // Supabase kan råka slå ihop parametrar med "?" i stället för "&" (om
  // redirect-URL:en redan hade en frågesträng). Normalisera alla extra "?" till
  // "&" så URLSearchParams läser dem rätt.
  const normalized = '?' + search.replace(/^\?/, '').replace(/\?/g, '&')
  window.history.replaceState(null, '', `${window.location.pathname}#/auth/callback${normalized}`)
}
