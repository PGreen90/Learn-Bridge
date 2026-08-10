# Beslut B-planen — konton, dagliga tävlingar, realtidsbord

> **Status: BESLUTAD MASTERPLAN (ägarbeslut 2026-08-08).** Ägaren sade "kör" på
> planeringen av Beslut B: drömmen är att sätta sig vid ett bord och spela
> bridge över internet (bordet fyllt med valfri mix av människor och bottar)
> samt en daglig tävling. Det här dokumentet är HELA planen — etapperna,
> besluten som redan är tagna, beslutsgrindarna som återstår, och de ärliga
> gränserna. Bakgrunden och teknikunderlaget: `docs/framtid-multiplayer-plattform.md`
> (2026-07-04) och `docs/konkurrensplan.md` (Fas 0–6, 2026-07-29).
>
> **Levande dokument:** varje etapp uppdaterar sin rubrik när den är klar, och
> planen får revideras vid varje beslutsgrind. Byggstart per etapp kräver alltid
> ägarens "kör" — precis som förr.

## Besluten som togs 2026-08-08 (via frågor till ägaren)

1. **Databas: Supabase — BEKRÄFTAT.** Ägarens förbehåll var "funkar den världen
   över" — ja: databasen bor i EU-region men nås från hela världen, och för
   turordningsspel som bridge spelar avståndet ingen märkbar roll. Firebase-
   alternativet är därmed avfört (framtidsdokets öppna fråga är stängd).
2. **Tävlingen: EN daglig tävling på 12 givar** till att börja med — enklare än
   både ägarens ursprungsidé (fyra tävlingar 8/12/16/24) och Claudes nästlade
   motförslag. Schemat byggs så att fler längder kan läggas till senare utan
   ombyggnad; formatfrågan tas upp igen vid etapp 2-grinden.
3. **Inloggning: klassiska lösenord** (ägarval; Claudes lösenordsfria förslag
   avböjt). Supabase sköter lösenordshanteringen — vi ser aldrig lösenord i
   klartext. Valet medför att vi OCKSÅ bygger: e-postverifiering, "glömt
   lösenord"-flödet, minst 8 tecken, och läckta-lösenord-skyddet påslaget i
   Supabase.
4. **Byggordning: tävlingarna först, borden sen** — bekräftar konkurrensplanens
   ordning (Fas 2 konton → Fas 3 tävlingen → Fas 6 borden).

## Detaljerna ägaren bad Claude hitta (säkerhet, användare, GDPR)

- **Dagens frö är publikt.** `daily.ts` använder datumet (ÅÅÅÅMMDD) som frö —
  vem som helst med appens kod kan räkna fram given i förväg. Det duger för
  Wordle-delningen men är värdelöst som tävlingsintegritet. Tävlingsgivar måste
  genereras med hemligt serverfrö och lagras på servern.
- **Boten slumpar utan frö.** `monte-carlo.ts` (och `contract-target.ts`)
  anropar `Math.random()` direkt — utan injicerad, fröad slumpkälla kan servern
  aldrig verifiera ett inskickat resultat genom att spela om det. Lagas i
  etapp 0.
- **Ärlig fuskgräns, i två nivåer.** Så länge bottarna körs i webbläsaren HAR
  klienten alla fyra händerna — en beslutsam fuskare kan kika i utvecklar-
  verktygen. **Nivå 1 (lanseringen):** servern spelar om varje inskickat
  resultat och garanterar att det inte är påhittat och att bottarna inte
  manipulerats — men kan inte hindra kikande. Rätt avvägning för ett litet,
  vänskapligt fält; sägs öppet. **Nivå 2 (härdningen, eget ägarbeslut):** dolda
  händer + botdrag flyttas till servern — klienten ser aldrig ospelade dolda
  kort. Samma serverfunktion som realtidsborden ändå behöver.
- **Ingen cookiebanner behövs** — bättre än att bygga en: vi använder ENDAST
  nödvändig inloggningslagring och ingen tredjeparts-analytics. Läggs analytics
  till senare väljs ett cookielöst verktyg så bannerfriheten består.
- **GDPR görs rätt från början:** EU-region på databasen (helst Stockholm,
  annars Frankfurt), personuppgiftsbiträdesavtal (DPA) med Supabase godkänns i
  deras dashboard, integritetspolicy + användarvillkor på enkel svenska FÖRE
  första registreringen, 13-årsgräns som kryssruta (ingen födelsedag samlas in
  — dataminimering), självbetjänad kontoradering och dataexport, och kunskap om
  72-timmars anmälningsplikt till IMY vid dataintrång. Vi samlar bara: e-post,
  visningsnamn, 13+-kryss, spelresultat. Inget annat.
- **Mejlutskicken kräver egen tjänst.** Supabase inbyggda mejl är strypt till en
  handfull per timme — oanvändbart även för test. Resend (gratis upp till 100
  mejl/dag) kopplas som egen SMTP från dag ett, med SPF/DKIM på rebidz.com.
- **Tidszonen måste spikas.** Dagens frö räknas i klientens lokala tid — servern
  och klienten måste enas om **Europe/Stockholm** innan tävlingar finns
  (etapp 0).

## Arkitekturen (låsningar)

- **Supabase** (EU-region): inloggning (Auth), databas (Postgres med RLS —
  radskydd där ingen kommer åt något som inte uttryckligen öppnats) och
  Realtime (borden i etapp 4).
- **Vercel Functions** (mappen `api/` i samma repo, Node): ALL serverkod som
  kör motorn. Motorn är ren TypeScript utan webbläsarberoenden och importeras
  direkt (`decideCall` ur `auction-live.ts`, omspelning via `resume.ts`,
  `botCardSmart` ur `play-bot.ts`, poängen ur `scoring.ts`). Samma repo = samma
  CI-grind = faciten testar exakt det som körs i produktion. Supabase Edge
  Functions används INTE för motorkod (annan körmiljö, dubblerad motor).
- **Utbytbart backend-lager:** klienten pratar aldrig databas direkt — bara
  `src/lib/backend/` (eget tunt gränssnitt) → API-anrop + supabase-js för
  inloggning/realtid. Skyddet mot inlåsning per ägarens stående princip.
- **Service-nyckeln** (servern's fullmakt mot databasen) bor ENDAST i Vercels
  miljövariabler, aldrig i klientkoden. Skrivningar till resultat och
  bordhändelser sker bara via serverfunktioner.
- **Kostnad:** gratis tills riktig trafik. Uppgraderingar är alltid ägarbeslut:
  Supabase Pro (25 USD/mån) när borden går live eller databasen närmar sig
  gratistaket; Vercel Pro (20 USD/mån) den dag donationsknappen kommer (gratis-
  planen är icke-kommersiell). Kvarstående hårda avgifter (Fas 4 mobilappar):
  Apple 99 USD/år, Google 25 USD engångs.

## Beslutsgrindarna — ägarbeslut längs vägen

**Stående regel: planen är levande.** Vid VARJE etappslut stannar Claude, visar
vad som byggts, listar nästa etapps öppna beslut och frågar — och planen
revideras om verkligheten säger något nytt. Finns det mer än en rimlig väg i
ett delbeslut ska Claude fråga, inte välja själv. Identifierade grindar:

- **Grind 0→1 (backendstarten):** uttryckligt "kör" innan Supabase-projektet
  skapas — första externa tjänstekontot, här börjar GDPR-ansvaret på riktigt.
- **Etapp 1 (konton):** Google-inloggning som komplement till lösenord — ja/nej?
  · Vad händer med resultaten när ett konto raderas: radera allt (enklast,
  ärligast) eller anonymisera (topplistorna består)? · Regler för visningsnamn
  (får man byta? hur ofta?).
- **Etapp 2 (tävlingen):** Ska gratis "Dagens giv" (Wordle-delningen) leva kvar
  parallellt med tävlingen eller bakas in i den? · Syns provisorisk topplista
  under dagen eller först efter midnatt? · Får man pausa mitt i de 12 givarna
  och fortsätta senare samma dag? · När läggs fler tävlingslängder till — och
  som separata serier eller nästlade?
- **Etapp 3 (härdningen):** När aktiveras Nivå 2 (dolda händer + botdrag på
  servern)? Triggern är tillväxt, priser/rating eller upptäckt fusk — ägaren
  avgör när det är värt latensen och kostnaden.
- **Etapp 4 (borden):** Öppet bord utan konto (anonym gäst) — ja/nej? · Vilka
  chattfraser? · Betänketid/klockor vid bordet? · Får åskådare (kibitzers)
  titta? · Bot-svårighetsgrad valbar per bord?
- **Alltid ägarbeslut:** varje uppgradering till betalplan · donationsknappen ·
  ordningen Fas 4 (mobilappar) / Fas 5 (engelska) relativt borden — väljs efter
  etapp 2 när vi ser var behovet är störst.

## Etapperna (varje etapp testdriven med eget facit, som alltid)

### Etapp 0 — förberedelser UTAN backend (appen förblir statisk, deploybar som vanligt)

1. **Slumpinjektion:** en valfri slumpkälla (`rng`) träs genom `botCardSmart` →
   Monte-Carlo-vägen i `monte-carlo.ts` (och `contract-target.ts`), med
   `Math.random` som standard = noll beteendeändring i appen. Facit: samma frö
   ⇒ exakt samma kort två gånger.
2. **Tidszonen:** `daily.ts` räknar frö/dagnummer i Europe/Stockholm oavsett var
   spelaren befinner sig (varsamhet med streak-kanten runt midnatt; facit i
   `daily.test.ts` uppdateras).
3. **Backend-lagret:** `src/lib/backend/` — gränssnitt + localStorage-
   implementation som omsluter dagens lagring (`storage.ts`-nycklarna). UI:t
   pratar bara med lagret; när servern kommer byts implementationen, inte
   sidorna.
4. **PWA-vakten:** service workern får aldrig svälja `/api/*`-anrop
   (`vite.config.ts`); låses i `deploy-config.test.ts` INNAN någon serverfunktion
   finns.
5. **`api/`-skelettet:** en trivial hälso-endpoint som bevisar att motorn
   importeras på servern. CI-grinden (`ci-deploy.yml`) paketerar `api/`
   automatiskt via Vercels bygge — ingen workflowändring; kontrollera att
   `api/` täcks av `tsc`.

### Etapp 1 — konton (= konkurrensplanens Fas 2)

🚪 *Grind 0→1 först. Etappens öppna delbeslut (Google-login, radering vs
anonymisering, namnregler) tas här.*

- Supabase-projekt i EU; DPA godkänns. Resend som egen SMTP (SPF/DKIM på
  rebidz.com).
- E-post + lösenord: verifiering krävs, minst 8 tecken, läckta-lösenord-skydd
  på, "glömt lösenord"-flöde. OBS HashRouter: en explicit `/#/auth/callback`-
  rutt behövs och återställningslänken testas särskilt i iOS-PWA:n (länkar ur
  mejl öppnas i webbläsaren, inte i den installerade appen). Apple-inloggning
  först i Fas 4 (Apples krav gäller först när iOS-appen finns).
- `profiles`-tabell: unikt visningsnamn 2–20 tecken (mejladressen visas aldrig
  för andra), 13+-kryssruta vid registrering.
- GDPR-sidorna `/#/integritet` + `/#/villkor` (enkel svenska) FÖRE första
  registreringen. Självbetjäning: radera konto och exportera min data (JSON).
- Engångsimport av localStorage-historiken (dagens giv-loggen + spelhistoriken)
  till kontot, flaggad `imported` — deltar aldrig i topplistor (går inte att
  verifiera i efterhand).
- Facit: RLS-tester (en andra inloggad klient kan inte läsa/skriva andras
  rader) + auth-flödestester; mobilflödena testas manuellt på riktig telefon.

### Etapp 2 — dagliga tävlingen, 12 givar (= konkurrensplanens Fas 3)

🚪 *Innan bygget: etappens delbeslut (Dagens giv kvar?, provisorisk topplista?,
paus mitt i serien?) tas med ägaren.*

**2a — givar + inskick:**
- Ett schemalagt serverjobb (Vercel-cron 00:05 Europe/Stockholm) genererar
  dagens 12 givar med hemligt serverfrö (HMAC av datum + givnummer — går inte
  att förberäkna) och lagrar händerna i databasen. Gratis "Dagens giv" med
  Wordle-delningen berörs inte (om inte etapp 2-grinden beslutar annat).
- Klienten hämtar given via API, spelar mot bottarna som idag och skickar in
  budhistorik + spelade kort (samma form som dagens sparade giv i `resume.ts`).
- **Servern validerar asynkront:** inskicket sparas direkt som provisoriskt; en
  kö spelar om given inom minuter och flippar till godkänt/avvisat. Omspelningen
  kontrollerar: rätt giv, laglig auktion, varje botbud = motorns bud, spelet
  omspelat drag för drag, varje botkort = motorns kort med fröad slump (från
  etapp 0), poängen omräknad med `scoring.ts`. Vid botkorts-avvikelse (flyttal
  kan skilja mellan webbläsare och server) → manuell granskning, inte
  auto-avslag.

**2b — poäng + topplista:**
- Matchpoäng per giv, poolat över alla som spelat given; tävlingsresultatet är
  snittet över de 12. Minst två spelare per giv krävs för poäng, annars "väntar
  på fler resultat".
- Rondrapporten/facit för en giv låses upp FÖRST efter eget inskick — tvingat i
  databasens radskydd (RLS), inte bara i gränssnittet.
- Ställningen provisorisk under dagen (om grindbeslutet säger så), slutlig
  efter midnatt + valideringssvep.
- Schemat byggs för framtida längder (tävlingsserie med storlek som kolumn) så
  8/16/24 kan läggas till utan ombyggnad.

### Etapp 3 — härdning + drift

- Arkiv och streaks på servern, granskningsverktyg för manuell granskning,
  begränsning av anropstakt (rate limits) på inskick och inloggning, och —
  efter grindbeslut — grunden för Nivå 2 (dolda händer på servern).

### Etapp 4 — realtidsborden (= konkurrensplanens Fas 6, drömmen)

🚪 *Störst beslutsgrind: öppet bord, chattfraser, klockor, kibitzers,
bot-svårighetsgrad — designas tillsammans med ägaren innan kod skrivs.*

- **Bord med valfri mix människor/bottar.** Servern är domaren: varje bud/kort
  går till en serverfunktion som validerar mot bordets händelselogg
  (append-only med sekvensnummer) innan det bokförs. Klienten får aldrig avgöra
  något själv.
- **Synk** via Supabase Realtime på händelseloggen — ordningen är garanterad
  och en spelare som tappar nätet hämtar ikapp från sitt senaste sekvensnummer.
  Närvaro (presence) visar vem som sitter vid bordet.
- **Dold information på riktigt:** egen hand hämtas per stol; träkarlen
  avslöjas som händelse efter utspelet. Klienten ser ALDRIG ospelade dolda kort
  — Nivå 2-fusksäkerheten kommer på köpet, och samma serverbot-funktion
  eftermonteras i dagliga tävlingen.
- **Frånkoppling:** kort frist (~45 s) → stolen tas över av en bot → människan
  kan ta tillbaka den vid nästa stickgräns. Ärlighet om serverless: ingen
  långlivad process finns som "väntar" — en idempotent framdrivnings-funktion
  som de sittande klienternas hjärtslag anropar spelar väntande botdrag.
- **"Öppet bord"** (två kompisar + två bottar utan konton): rekommendationen är
  Supabase **anonym inloggning** — gästen får en riktig identitet i radskyddet
  (stolen kan återtas efter en omladdning) utan registrering, och kan uppgradera
  till konto senare. Konto krävs bara för att STARTA bord och för tävlingen.
  Slutgiltigt ja/nej vid etapp 4-grinden.
- **Chatt:** endast förvalda fraser ("Bra spelat!") — ingen fritext = inget
  modereringsansvar.

## Databasskissen (radskydd på allt; skrivningar via serverfunktioner)

- `profiles` — användare, unikt visningsnamn.
- `daily_sets` — tävlingsdag + storlek (12 nu, fler senare).
- `daily_deals` — dagens givar (läsbara först när dagen är inne).
- `daily_results` — inskick per spelare/giv med status
  (provisorisk/godkänd/avvisad/manuell granskning/importerad).
- `daily_standings` — ställningen (vy över resultaten).
- Etapp 4: `tables`, `table_seats`, `table_events` (append-only händelselogg,
  inga händer i själva händelserna).

## Ändringslogg

- **2026-08-08:** planen beslutad (ägarens "kör" på planeringen). Fyra ägarbeslut
  tagna: Supabase bekräftad, en 12-givarstävling först, klassiska lösenord,
  tävlingarna före borden. Beslutsgrindar tillagda på ägarens begäran samma
  session.
- **2026-08-09: ETAPP 0 KLAR & deployad** (ren kod, ingen backend, beteendet
  oförändrat, +10 facit). Fem bitar: slumpinjektion i Monte-Carlo-boten (`rng`,
  default Math.random), Europe/Stockholm-tidszon i `daily.ts` (DST-säker),
  backend-sömlagret `src/lib/backend/` (11 sidor omkopplade; synkront nu, konto-
  gruppen blir async i etapp 1), PWA-vakt som lämnar `/api/*` orört (låst i
  `deploy-config.test.ts`), och `api/health.ts` som bevisar att motorn importeras
  server-side (`tsconfig` täcker nu `api/`). NÄSTA = grind 0→1: Supabase-projektet
  skapas först på ägarens uttryckliga "kör".
