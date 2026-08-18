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
   lösenord"-flödet, minst 8 tecken. **OBS (fynd 2026-08-10):** läckta-lösenord-
   skyddet (HaveIBeenPwned) är en **Pro-funktion** i Supabase och går INTE att
   slå på på gratisplanen. Det är därför **uppskjutet till Pro-uppgraderingen**
   (samma grind som borden/gratistaket) — tills dess skyddar vi med 8 tecken +
   obligatorisk e-postbekräftelse.
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
  **PASSERAD 2026-08-10** (ägaren: "Grind 0→1"); etapp 1-besluten tagna, se nedan.
- **Etapp 1 (konton) — BESLUTAT 2026-08-10:**
  · **Google-inloggning:** NEJ nu — bara e-post + lösenord. Google kan läggas
    till senare utan ombyggnad om användarna vill ha det.
  · **Radering av konto:** RADERA ALLT (enklast, mest GDPR-ärligt — rätten att
    bli glömd uppfylls helt). Anonymisering kan omprövas senare om topplistornas
    integritet växer i betydelse.
  · **Visningsnamn:** unikt (databasgaranterat via unik, skiftlägesokänslig
    regel — "Anna"="anna"), **4–10 tecken**, teckenregler (bokstäver/siffror/`_`/`-`,
    inga osynliga tecken) + blocklista (svordomar/slurs + reserverade ord som
    `admin`/`rebidz`) vid registrering. **LÅST för användaren** (inget
    självbetjänat byte), men **ägaröverstyrning krävs**: en knapp bara ägaren
    kommer åt för att byta/spärra ett enskilt namn i efterhand (annars sitter ett
    fult namn som slinker förbi kvar för evigt). Anmäl-knapp läggs till senare.
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

### Etapp 1 — konton (= konkurrensplanens Fas 2) — KLAR & LIVE-VERIFIERAD 2026-08-10

🚪 *Grind 0→1 PASSERAD 2026-08-10. Delbesluten tagna: ingen Google-login nu ·
radera allt vid kontoradering · visningsnamn 4–10 tecken, låst, med
ägaröverstyrning + blocklista (se "Beslutsgrindarna" ovan för full spec).*

**SKARPT LIVE-PROV PASSERAT (2026-08-10) på rebidz.com:** hela kedjan bevisad i
skarp drift — registrering (visningsnamn "Green" + validering) → bekräftelsemejl
(same-device PKCE, Resend levererade) → inloggning → GDPR-export (exakt rätt data,
inget extra) → kontoradering ("radera allt": kontot borta ur databasen, efterföljande
inloggning misslyckas) → glömt-lösenord hela vägen (ny länk → nytt lösenord →
inloggning med det nya). Alla fem godkända. **KVAR (städning):** de två gamla
testkontona `rebidz.bridge+smoke@gmail.com` / `+test2@gmail.com` raderas i Supabase
→ Authentication → Users. **NÄSTA = etapp 2-grinden** (delbesluten nedan tas med ägaren).

**Byggt & verifierat 2026-08-10 (inget committat/deployat än):** Supabase-projekt
i EU-Stockholm (ref `fpvuvlmnddgphprmyqmb`), DPA gäller automatiskt. Auth-konfig:
8 tecken, e-postbekräftelse på, Site URL + redirect-URL:er satta. `.env` med
publika värden (anon-JWT — `sb_publishable`-nyckeln avvisades av gatewayen på det
färska projektet). Klientkod i `src/lib/backend/` (supabase.ts PKCE/detect-off,
auth.ts, display-name.ts + facit), AuthProvider-context, sidor (registrera,
logga-in, glömt/nytt lösenord, auth/callback, konto) + GDPR-sidor
(integritet/villkor), inloggning i topbaren. SQL i `supabase/migrations/`:
`0001` (profiles + RLS "läs egen" + trigger handle_new_user), `0002` (grant select
till authenticated). **Smoke-test PASSERAT:** registrering via appen skapade
profilrad via triggern — hela kedjan registrering→trigger→tabell→RLS bevisad.
Testsviten grön (`npm test`). **Kvar i etappen:** städa testkontot · Resend (SPF/DKIM på
rebidz.com) · kontohantering radera/exportera (radering kräver service_role i en
serverfunktion → service-nyckeln in i Vercel redan här) · localStorage-import ·
deploy + skarpt mejlprov. **Öppen fråga (fynd):** för mejllänkar som öppnas på
annan enhet krävs token_hash-mallar i Supabase (verifyEmailOtp finns redan i
koden) — sätts när Resend + mejlmallarna konfigureras.

- Supabase-projekt i EU; DPA godkänns. Resend som egen SMTP (SPF/DKIM på
  rebidz.com).
- E-post + lösenord: verifiering krävs, minst 8 tecken, "glömt lösenord"-flöde.
  Läckta-lösenord-skydd är Pro-only → uppskjutet till Pro-uppgraderingen (se
  besluten ovan, fynd 2026-08-10). OBS HashRouter: en explicit `/#/auth/callback`-
  rutt behövs och återställningslänken testas särskilt i iOS-PWA:n (länkar ur
  mejl öppnas i webbläsaren, inte i den installerade appen). Apple-inloggning
  först i Fas 4 (Apples krav gäller först när iOS-appen finns).
- `profiles`-tabell: unikt visningsnamn **4–10 tecken** (skiftlägesokänslig unik
  regel; mejladressen visas aldrig för andra), teckenregler + blocklista, **låst**
  för användaren men med **ägaröverstyrning** (byt/spärra namn), 13+-kryssruta
  vid registrering.
- GDPR-sidorna `/#/integritet` + `/#/villkor` (enkel svenska) FÖRE första
  registreringen. Självbetjäning: radera konto och exportera min data (JSON).
- Engångsimport av localStorage-historiken (dagens giv-loggen + spelhistoriken)
  till kontot, flaggad `imported` — deltar aldrig i topplistor (går inte att
  verifiera i efterhand).
- Facit: RLS-tester (en andra inloggad klient kan inte läsa/skriva andras
  rader) + auth-flödestester; mobilflödena testas manuellt på riktig telefon.

### Etapp 2 — dagliga tävlingen, 12 givar (= konkurrensplanens Fas 3) — KLAR & LIVE-VERIFIERAD 2026-08-11/12

🚪 *Grindbesluten TAGNA 2026-08-10 (ägaren):*
- **Gratis "Dagens giv" (Wordle-delningen):** tas bort/**döljs** — tävlingen
  ersätter den. Claude-val: **dölj** (avlänka i menyn, behåll `daily.ts` +
  delnings-koden) framför hård radering — återvändbart, kan återanvändas för en
  ev. gratisvariant senare. Ägaren kan ändra till hård radering.
- **Provisorisk topplista:** JA — syns live under dagen (uppdateras löpande;
  slutlig efter midnatt + valideringssvep).
- **Paus mitt i de 12 givarna:** JA — får pausa och fortsätta senare samma dag.
- **Fler tävlingslängder:** SENARE — schemat byggs med storlek som kolumn så
  8/16/24 kan läggas till utan ombyggnad; separata serier vs nästlade avgörs då.

**2a — givar + inskick:**
- **Förarbete (fynd från etapp 0) — KLART & LIVE-VERIFIERAT 2026-08-10.** api-
  funktioner som kör motorn buntas nu med **esbuild** (`scripts/build-api.mjs`):
  källor i `api-src/*.ts` → självständiga `api/*.js` utan kvarvarande relativa
  importer. `npm run build` kör buntningen före vite (så Vercel återskapar
  filerna; de gitignoras). Facit: `api-src/build-bundling.test.ts` kör det riktiga
  byggsteget och kontrollerar att `api/dagens-tavling.js` + `api/generera-dagens-
  givar.js` importerar rent under Node utan kvarvarande relativa importer.
  (En tillfällig motorprov-endpoint bevisade först buntningen live på
  `https://rebidz.com/api/motorprov`; den togs bort när hämtningsvägen fanns.)
  Kvar att bunta in när de behövs: `decideCall`/`rebuildPlay`/`botCardSmart`/`scoring`.
- **Giv-genereringen — KLAR & LIVE-VERIFIERAD 2026-08-10.** Ett schemalagt
  serverjobb (`api-src/generera-dagens-givar.ts`, Vercel-cron `5 23 * * *` UTC =
  strax efter midnatt svensk tid året runt, även DST) genererar dagens 12 givar
  med hemligt serverfrö (HMAC-SHA256 av `datum:bricka` med `DAILY_SEED_SECRET` →
  `dealFromSeed`, ren motorfunktion) och lagrar händerna i `daily_deals`.
  Idempotent (upsert `on_conflict=comp_date` / ignore-duplicates
  `on_conflict=set_id,board`). Skyddad av `CRON_SECRET`; skriver via Supabase
  REST med service-nyckeln (miljövariabler i Vercel: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_SEED_SECRET`, `CRON_SECRET`). Migration
  `0004` (tabeller + RLS utan policys + service_role-GRANT). Live-prov: 200 med
  12 givar, omkörning 200 (idempotent), 401 utan bevis. Facit: `dealFromSeed` +
  `seedForBoard`/`genereraGivar`. Gratis "Dagens giv" berörs inte (döljs senare
  per grindbeslutet). **KVAR i 2a:** inskick + validering (nedan).
- **Klientfasen Led 1 — KLAR (2026-08-11, ej live-verifierad än).** Hämtningsväg
  `/api/dagens-tavling` (`api-src/dagens-tavling.ts`) levererar nu även ett
  `playSeed` per giv (`playSeedForBoard`, HMAC `datum:bricka:play`) så bottarna
  spelar deterministiskt för valideringen. Backend-hämtaren `fetchDagensTavling()`
  (`src/lib/backend/tavling.ts`) översätter serversvaret → `Deal[]`. Spelfabriken
  `gameFromDeal()` bygger en `Game` ur en serverlevererad giv; `playSeed` trådas
  `Play`→`PlayTable`→`usePlayTable` (bot-vägen fanns sedan `b84835c`). Ny sida
  `src/pages/DagensTavling.tsx` (rutt `#/spela-kort/tavling`): **konto krävs**
  (utloggad → logga-in-ruta), **linjärt upplägg giv 1→12** med progress + paus
  (framsteg lokalt i backend-lagret, `tavling-framsteg`). Startsidans flaggskepp
  pekar om till tävlingen; fria "Dagens giv" avlänkad (koden kvar). Facit:
  `playSeedForBoard`, `tavling.ts`-översättningen, `tavling-smoke.test.tsx`
  (tävlingsläget i spelskärmen inkl. `onKlar`), `DagensTavling.test.tsx` (grind +
  hämtning + framsteg).
- **Inskick + validering (Led 2) — BYGGT & TESTAT (2026-08-11).** Klienten skickar
  in en spelad giv (bricka + auktion + spelade kort + spelförarstick) med sin
  inloggnings-token → `/api/skicka-in` (`api-src/skicka-in.ts`). **Validering körs
  INLINE vid inskicket** (inte async kö): gratis-Vercel har inga täta bakgrundsjobb
  (cron bara en gång/dygn), så en kö går inte — och inline ger direkt svar. **Nivå
  "snabb" (ägarbeslut 2026-08-11):** `validera()` (`api-src/_lib/validera.ts`)
  regenererar given ur fröet och kontrollerar det billiga + deterministiska som
  fångar påhittade resultat: rätt giv, laglig auktion, varje BOT-bud = motorns bud,
  varje kort lagligt (motorns `playCard`), stickantalet ryms i spelet, och POÄNGEN
  räknas alltid om på servern. Den tunga bot-KORT-granskningen (Monte-Carlo) skjuts
  till etapp 3-härdningen (då byggs dolda händer på servern ändå). Skriver
  `daily_results` med service-nyckeln efter validering (migration `0005`, RLS "läs
  egen"); ett inskick per giv, det första står (409 vid ominskick). Klient:
  `submitTavlingGiv()` i bakgrunden när en giv är klar, brickan märks med utfallet.
  Facit: `validera.test.ts` (ärligt inskick godkänns; bytt giv / manipulerat
  bot-bud / påhittat stickantal / olagligt kort avvisas).

**2b — poäng + topplista — BYGGT & TESTAT (2026-08-11):**
- Matchpoäng per giv (`src/lib/engine/matchpoints.ts`, ren funktion +
  `matchpoints.test.ts`): N/S-poängen (`nsScore`) jämförs mot alla andra på given
  (bättre = 1, lika = 0,5), toppen = antal spelare − 1, i procent.
  Tävlingsresultatet = snittet över de poängsatta givarna. Minst **två spelare per
  giv** krävs, annars "väntar på fler". `/api/topplista` (`api-src/topplista.ts`)
  aggregerar dagens godkända inskick server-side (service-nyckeln) + hämtar
  visningsnamn; `fetchTopplista()` + `TopplistaVy` på `DagensTavling`-sidan.
- **Materialiserad `daily_standings`-vy behövs INTE** — topplistan räknas i den
  testade TS-funktionen i endpointen (matchpoänglogiken bor inte i SQL).
- **Facit-gate via RLS SKJUTS UPP:** under Nivå 1 har klienten redan alla händer
  (hämtas i förväg), så en RLS-spärr på att se en givs facit före inskick är
  verkningslös — den hör ihop med Nivå 2 (dolda händer, etapp 3-härdningen).
- Ställningen provisorisk under dagen, slutlig efter midnatt + valideringssvep.
- Schemat byggs för framtida längder (tävlingsserie med storlek som kolumn) så
  8/16/24 kan läggas till utan ombyggnad.

### Etapp 3 — härdning + drift — BYGGD 2026-08-18

🚪 *Grindbesluten TAGNA 2026-08-18 (ägaren): **Nivå 2 i tävlingen VÄNTAR**
(triggern tillväxt/priser/fusk är inte nådd; bordens serverbot står redo den
dag den behövs) · djupa botkortsgranskningen körs **nattligt i Actions**
(`tavling-granskning.yml` + `tavlingsgranskning.probe.test.ts` — botbesluten
är deterministiska ur playSeed, så jämförelsen är exakt; avvikare flyttas till
status 'granskning') · granskningsverktyget är **rapporten i nattvakten**
(artefakt), inget eget UI.*

- Byggt: rate limits på tävlingens endpoints (`skicka-in`, `topplista`,
  `giv-resultat`, `dagens-logg` — bordens `api_kvot`/`kvot_okning` återanvänds;
  inloggningen skyddas av Supabases egna limits) · Dagens giv-loggen
  (kalenderarkivet + 🔥-sviten) speglad på kontot (migration `0009`, endpoint
  `dagens-logg.ts`, klientsynk `dagens-logg.ts` i backend-lagret — "första
  resultatet står" på båda sidor) · nattliga djupgranskningen enligt ovan.
- Ägarsteg vid deploy: kör migration `0009` + lägg GitHub-secrets
  `SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY` (nattgranskningen).

### Etapp 4 — realtidsborden (= konkurrensplanens Fas 6, drömmen) — BYGGD & LIVE 2026-08-17/18

🚪 *Grindbesluten TAGNA i planeringssessionen 2026-08-17: konto krävs alltid
(anonym gäst AVFÖRD) · inga chattfraser/klockor/kibitzers i v1 · totalpoäng NS
mot ÖV (DD-jämförelse = senare) · max ett bord per ägare + globalt mjukt tak.
Hela detaljplanen, arkitekturen och delleveranserna 4A–4D: **`docs/bord-plan.md`**.*

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
  `deploy-config.test.ts`), och `api/health.ts` (första Vercel-funktionen, live;
  `tsconfig` täcker nu `api/`). **Fynd under deployen:** motorn kan INTE importeras
  rått i en Vercel Node-funktion — motorns filer importerar varandra utan
  filändelse (`from './deal'`), och Node ESM på servern kräver explicit `.js`
  (ERR_MODULE_NOT_FOUND). Att köra motorn server-side kräver därför ett
  esbuild-bundlingssteg för api-funktionerna → sätts upp i etapp 2 (2a), där
  servern faktiskt ska generera givar och spela om resultat. NÄSTA = grind 0→1:
  Supabase-projektet skapas först på ägarens uttryckliga "kör".
- **2026-08-10: ETAPP 1 KLAR & LIVE-VERIFIERAD.** Skarpt live-prov på rebidz.com
  passerat (registrera → bekräfta mejl → inloggning → export → radera allt →
  glömt lösenord; alla fem godkända). Doc-fix committad/deployad (`ac81d3b`).
  **Etapp 2-grindbesluten tagna samma dag** (se etapp 2-rubriken): dölj "Dagens
  giv", provisorisk topplista JA, paus JA, fler längder senare. Byggstart väntar
  på ägarens "kör".
- **2026-08-10: GRIND 0→1 PASSERAD** (ägaren: "Grind 0→1"). Etapp 1-besluten
  tagna med ägaren: (1) ingen Google-login nu, bara e-post + lösenord; (2)
  kontoradering = radera allt; (3) visningsnamn unikt/skiftlägesokänsligt, 4–10
  tecken, teckenregler + blocklista, LÅST för användaren med ägaröverstyrning
  (byt/spärra). NÄSTA konkreta steg: ägaren skapar Supabase-projektet (EU-region,
  helst Stockholm) — Claude guidar klick för klick.
- **2026-08-11: ETAPP 2 KLIENTFASEN LED 1 KLAR** (servergiv → spelbar tävling i
  appen). Grindbeslut samma dag: konto krävs för hela tävlingen · linjärt upplägg
  giv 1→12. Byggt (se 2a-rubriken): `playSeed` per giv i hämtningsvägen,
  `fetchDagensTavling()` + `gameFromDeal()`, `playSeed` trådat till spelbordet,
  ny `DagensTavling`-sida (grind + progress + paus), startsidan ompekad, fria
  "Dagens giv" avlänkad. Tillfälliga motorprov-endpointen borttagen (buntnings-
  vakten pekar nu på de riktiga funktionerna). +9 facit, hela sviten grön, tsc
  rent. **KVAR:** Led 2 (inskick → validering), Led 3 (poäng → topplista). Det
  inloggade spelflödet live-verifieras efter deploy.
- **2026-08-11: ETAPP 2 LED 2 + LED 3 BYGGDA & TESTADE** (inskick → validering →
  poäng → topplista). Vägval (ägaren): validering körs INLINE vid inskicket på
  "snabb" nivå (given/buden/poängen kontrolleras direkt; tung bot-kort-granskning
  skjuts till etapp 3). Byggt: migration `0005` (`daily_results` + RLS "läs egen"),
  `validera()` + `/api/skicka-in` (token-verifiering + inline-validering + skriv
  med service-nyckeln), `matchpointsForBoard()`/`nsScore()` + `/api/topplista`,
  klient `submitTavlingGiv()`/`fetchTopplista()` + inskicksstatus på brickorna +
  `TopplistaVy`. Buntningsvakten skannar nu även `api-src/` (serverkod). +18 facit,
  hela sviten grön, tsc rent. **ÄGARSTEG FÖRE DEPLOY:** kör migration `0005` i
  Supabase (SQL Editor). Sedan live-verifieras hela kedjan (två konton → topplista)
  med ägaren.
- **2026-08-11/12: ETAPP 2 KLAR & LIVE-VERIFIERAD** (hela kedjan två konton →
  inskick → topplista med matchpoäng; migrationerna `0005`+`0006` körda;
  testkonton städade). Därefter byggdes travellern (`giv-resultat.ts`, migration
  `0006`), cross-device-framstegen och övningsläget "Spela given igen" —
  detaljerna i `docs/historik.md`.
- **2026-08-17/18: ETAPP 4 (REALTIDSBORDEN) BYGGD & LIVE** i fyra delleveranser
  (4A lobby/väntrum → 4B server-drivet spel → 4C närvaron → 4D läge 1+2 +
  dokumenten), var och en demolad och godkänd av ägaren. Grindbesluten togs
  2026-08-17 (konto krävs alltid — anonym gäst avförd; ingen chatt/klockor/
  kibitz i v1; totalpoäng NS–ÖV). Migrationerna `0007`+`0008` körda. Etapp 3
  (härdningen) återstår — bordens endpoints fick dock rate limits direkt
  ("minimal härdning inbakad", ägarbeslut). Hela detaljplanen:
  `docs/bord-plan.md`.
- **2026-08-18: ETAPP 3 (HÄRDNINGEN) BYGGD.** Grindbeslut (ägaren): Nivå 2 i
  tävlingen väntar (trigger ej nådd) · djupgranskningen nattligt i Actions ·
  granskningen som rapport, inget UI. Byggt: rate limits på tävlingens
  endpoints (bordens kvotsystem) · Dagens giv-loggen på kontot (migration
  `0009` + `dagens-logg.ts` server/klient) · nattliga djupgranskningen
  (`tavling-granskning.yml` — exakt omspelning av botkorten ur playSeed,
  avvikare → status 'granskning'). Ägarsteg: migration `0009` + GitHub-secrets
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. Därmed är ALLA Beslut B-etapper
  (0–4) levererade.
