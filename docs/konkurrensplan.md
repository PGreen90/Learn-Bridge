# Konkurrensplanen — vägen mot BBO, Funbridge och Synrey

> **Status: BESLUTAD RIKTNING (nedskriven 2026-07-29).** Ägaren vill att rebidz
> på allvar ska börja konkurrera med de stora bridgeapparna. Den här filen är
> två saker: hälsobedömningen som beslutet vilar på, och roadmapen dit.
> **Planen är skriven — men inget backend-bygge startar förrän ägaren
> uttryckligen säger "kör"** (samma regel som alltid gällt Beslut B, se
> `docs/framtid-multiplayer-plattform.md`).

## Ägarens vägval (2026-07-29)

1. **Konkurrensmodell: Funbridge-modellen först.** Alla spelar **samma givar**
   mot bottarna och jämförs på en topplista ("Dagens givar"). Ingen realtid i
   första steget — riktiga realtidsbord (BBO-modellen) är svårast av allt och
   kommer sist, som Fas 6.
2. **Faceliften är VÄCKT** ur parkeringen (parkerad 2026-07-20, väckt
   2026-07-29). Den är Fas 1 i roadmapen — utseendet är en del av
   konkurrenskraften, särskilt mot Synrey.
3. **Två språk: svenska först, engelska senare** (Fas 5). Ingen konkurrent
   finns på svenska — det är en lucka, inte en begränsning.
4. **Beslut B startas inte än.** Denna plan är planering; byggstarten är ett
   eget, senare ägarbeslut.

## Hälsobedömningen (2026-07-29)

### Det som är friskt

- **Testkulturen är i toppklass.** Hela testsviten är deploygrind — `vercel.json`
  kör `npx tsc && npm test && npm run build` före varje publicering, så rött
  test betyder att inget trasigt når rebidz.com. Koden är strikt TypeScript
  utan undantag och beroendelistan är minimal (kontrolleras med `npm test`
  respektive en titt i `package.json`).
- **Budmotorn mäts och förbättras systematiskt.** Från baslinjen till senaste
  mätningen: rätt kontrakt 15,9 % → 18,7 %, genomsnittlig par-avvikelse
  300 → 271,38 poäng per giv (mätspåret #1→#20; kommando: `$env:REVISOR='1';
  npx vitest run src/lib/engine/revisor.probe.test.ts`, frö 20260721; hela
  loggen i `docs/systemrevisorn.md`).
- **Vallgraven: pedagogiken.** Ingen av konkurrenterna förklarar spelet som
  rebidz gör — varje bud förklaras, varje stick i rondgenomgången, varje
  markering, med double-dummy-dom på köpet. Och allt på svenska. Detta är
  appens unika värde och ska synas i all marknadsföring framåt.
- **Infrastrukturen är redo för nästa steg.** Beslut A är klart sedan
  2026-07-05: Vercel, egen domän rebidz.com, PWA (installerbar + offline).

### Svagheterna relativt konkurrenterna

1. **Ingen gemenskap.** Inga konton, inget sparat mellan enheter, inget att
   jämföra sig mot. Det är precis det Beslut B löser — och utan det finns
   ingen konkurrens med någon av de tre.
2. **Bottarnas kortspel har kända hål.** Felrapport #32 (spelföraren
   etablerar inte lång färg) och #34 (slarvigt försvar, tredje-hand-högt) —
   se `docs/senare.md`. Erfarna spelare dömer bottar på fem minuter, och i
   Funbridge-modellen ÄR botspelet produkten: det man tävlar i är att spela
   samma givar mot samma bottar bättre än andra. Mätriggen finns redan:
   `play-quality.probe.test.ts` (gatad, `PLAYQ=1`).
3. **Mobilupplevelsen är tunn.** Felrapport #36 (för små kort/tryckytor),
   få mobilbrytpunkter, och ingen hantering av mobilens "säkra zoner"
   (urtag/hemindikator) trots att `index.html` begär det. Konkurrenterna är
   mobilappar i grunden.
4. **Designen har legat parkerad** medan Synrey konkurrerar på polish.
   (Åtgärdas: faceliften är nu väckt = Fas 1.)
5. **Tekniska småsaker** som märks först med fler besökare: hela appen laddas
   som en enda stor JS-fil (~880 kB, ingen uppdelning per sida; kommando:
   `npm run build` och läs storleken i `dist/assets/`, uppmätt 2026-07-29),
   ingen 404-sida för felskrivna adresser.

## Konkurrenterna — och var rebidz slår dem

| App | Deras styrka | Deras svaghet | Vår vinkel |
|---|---|---|---|
| **BBO** | Störst gemenskap, riktiga bord i realtid, gratis | Åldrat gränssnitt, förklarar ingenting, överväldigande för många | Modernt, förklarande, på svenska |
| **Funbridge** | Solo mot bottar + jämförelse med tusentals andra på samma givar | Betalvägg per giv, begränsade förklaringar, ingen svenska | Samma modell — men gratis, med full förklaring av varje bud och stick |
| **Synrey** | Snyggast, stark AI | Litet community i väst, ingen svenska, förklarar inte på djupet | Redan vår visuella förebild — vi matchar uttrycket och slår dem på pedagogik |

Slutsats: vi tävlar inte om att bli störst först. Vi blir **den svenska
bridgeappen som förklarar allt** — och bygger tävlingskänslan med Funbridge-
modellen, som en ensam utvecklare faktiskt kan bygga och drifta.

## Roadmapen — Fas 0 till Fas 6

Ordningen är vald så att varje fas gör appen redo för nästa. Järnregeln gäller
fortfarande: **ett NU i taget** — en fas är inte ett NU, den bryts ner i
NU-stora bitar när den startas. Budmotorns mätspår (etapp 7 osv.) rullar
parallellt genom alltihop, precis som förut.

### Fas 0 — grunden håller för främmande ögon (ingen backend)
Innan vi bjuder in världen ska det världen möter hålla måttet.
- **a) Bottarnas kortspel:** felrapport #32 (spelplanering: etablera lång färg)
  + #34 (motspelsheuristik). Bor i `play-bot.ts`; mäts med
  `play-quality.probe.test.ts` så förbättringen bevisas, inte antas.
- **b) Mobilen:** felrapport #36 (större kort/tryckytor, `cardLayout.ts` +
  `Felt.tsx`), säkra zoner, ett svep över alla sidor på liten skärm.
- **c) Tekniska småfixar:** dela upp JS-bygget per sida (snabbare första
  laddning), 404-sida i `App.tsx`.

### Fas 1 — Faceliften (väckt 2026-07-29)
Designspåret återupptas: Klubbrummet-mockupen och ägarens Claude
Design-utforskning plockas fram igen. Låsta ramar gäller: emerald, svarta
spader, guldserifen, Synrey-inspirerat uttryck (färgerna läses i
`src/index.css`). Ligger FÖRE lanseringen av Dagens givar — första intrycket
görs bara en gång. Detalj: `docs/senare.md` (faceliftposten).

### Fas 2 — Konton + sparade framsteg (Beslut B steg 2–3)
Första backend-bygget: Supabase (databasvalet bekräftas med ägaren vid start),
registrering/inloggning inkl. Apple Sign In, och framsteg/resultat sparade per
användare i stället för bara i webbläsaren. Här uppstår GDPR-ansvaret — görs
rätt från början. Tekniken och principerna (utbytbar backend, fuskkontroll på
servern): `docs/framtid-multiplayer-plattform.md`.

### Fas 3 — "Dagens givar" (Funbridge-modellen — konkurrenssteget)
Kärnan i hela planen: varje dag serveras samma seedade givar till alla.
Du spelar dem mot bottarna, lämnar in resultatet och jämförs med alla andra
(MP-räkning, topplista, din historik). Asynkront — ingen realtid behövs.
Kräver Fas 2 (konton) plus: given serveras från servern, facit och
rondgenomgång låses upp först efter inlämning, resultatet valideras på
servern. Detta är den första funktionen som gör rebidz till en *tävlings*-app.

### Fas 4 — Mobilappar (App Store + Google Play)
Capacitor wrappar den befintliga webbappen till riktiga appar. Hårda avgifter:
Apple 99 USD/år, Google 25 USD engångs. PWA:n finns redan som brygga.

### Fas 5 — Engelska (andra språket)
Hela gränssnittet + budsystem-boken på engelska. Stort eget spår (boken är
appens största text). Tas när svenska basen bär — men skriv redan nu ny
UI-text så att den är lätt att lyfta ut (inga hopklistrade meningsfragment).

### Fas 6 — Realtidsbord (BBO-modellen)
Riktiga bord där människor spelar med/mot varandra live — inklusive ägarens
egen "öppet bord"-idé (två kompisar mot två bottar, utan konton). Det svåraste
man kan bygga (realtidssynk, tappade anslutningar, fuskkontroll). Startas
först när Fas 3 har visat att grunden bär.

## Vad som INTE ändras av den här planen

- **Järnregeln.** NU innehåller exakt en sak; faserna bryts ner i NU-bitar.
- **Budmotorns mätspår** fortsätter parallellt — motorn är produkten.
- **Ingen backend byggs** förrän ägaren uttryckligen säger "kör" på Fas 2.
- **Hostingen förblir statisk** till dess (regeln i CLAUDE.md står kvar).
- **Appnamnet:** `rebidz`, alltid gemener; repo/URL förblir `Learn-Bridge`.
