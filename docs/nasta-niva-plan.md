# rebidz till nästa nivå — plan inför klubbjakten

> **Ägargodkänd 2026-11-11.** Läget per etapp står i kartan (`CLAUDE.md`).
> Radhänvisningarna nedan gällde den dagen — verifiera mot koden före bygge.
>
> **Etapp 1 — så byggdes den (BYGGD 2026-11-11, ej live förrän ägarstegen är
> gjorda), med tre medvetna avvikelser från planen nedan:**
> - **Ingen migration `0015`.** Anonyma avsändare får en uuid-formad kvotnyckel
>   (HMAC av nätverksadress + dagens datum), som ryms i den befintliga
>   kvottabellen från `0007`. Ingen rå adress sparas, nyckeln byts varje dygn.
> - **Ingen kontaktrad och inget visningsnamn i rapporten.** Ärendelistan är
>   publik (repot är publikt) — personuppgifter hör inte hemma där. Miljö-
>   variabeln `RAPPORT_REPO` kan senare peka ärendena till ett privat repo.
> - **"Tyck till" visas alltid** (sidfoten, startsidan, tävlingsöversikten) i
>   stället för en engångsruta efter avslutad tävling — inget tjat.
>
> Mottagaren: `api-src/rapport.ts` + `api-src/_lib/rapport-logik.ts` (facit i
> testfilen bredvid). Klienten: `src/lib/backend/rapport.ts`,
> `src/components/FelrapportDialog.tsx`, `src/components/TyckTill.tsx`.
> Etiketter: `felrapport` · `forslag` · `tyck-till`.
> **Ägarsteg före live:** (1) skapa en GitHub-nyckel med ENBART "Issues: läs och
> skriv" på ärende-repot och lägg den i Vercel som `GITHUB_RAPPORT_TOKEN`,
> (2) etiketterna `forslag` och `tyck-till` — SKAPADE 2026-11-11.
>
> **Etapp 2 — så byggdes den (BYGGD 2026-11-11, committad lokalt, ej live):**
> - Tillbaka till rätt sida efter inloggning/registrering — även över
>   bekräftelsemejlet (`src/lib/efter-inloggning.ts`).
> - Om-sidan omskriven (tävlingarna, MP/IMP, konton, vänner-bordet).
> - Ny sida "Så bjuder rebidz" (`src/pages/SaBjuderRebidz.tsx`): systemet på en
>   sida med de fem skillnaderna mot klubbstandard först. **Texten är ett utkast
>   som ägaren ska syna.** Ändras en regel i `docs/budsystem.md` som nämns där
>   ska sidan ändras i samma veva.
> - Spela med vänner på startsidan · "Dela resultatet" när alla tolv givar är
>   spelade · installera-knapp på Om-sidan (där webbläsaren erbjuder det).
> - Ägarrapporten (`src/lib/agarrapport.ts`): nya konton, aktiva och återkomst
>   ur befintliga tabeller, bara antal. Körs med
>   `AGARRAPPORT=1 npx vitest run src/lib/agarrapport.probe.test.ts` eller av
>   veckojobbet `agarrapport.yml` (måndagar; rapporten = körningens Summary).
> - **Medvetet KVAR i etapp 2 (kräver ägarens ögon och mått):** större
>   kort/text som inställning (#36) och tävlingsöversiktens mobil-layout.
>
> **Etapp 3 steg A+B — så byggdes den (BYGGD 2026-11-11, committad lokalt):**
> - `src/lib/engine/traning.ts`: elva teman = budsituationer (öppning · svar på
>   högfärg/lågfärg/sang · återbud · svararens andra bud · inkliv · partnern
>   öppnar och de kliver in · partnern kliver in · mot 1NT och spärrar · slam).
>   Motorn delar givar tills Syd står i läget; facit = `decideCall` (bara rena
>   tabellbeslut). Varje tema bär en kort intro + paragrafhänvisning (steg B).
> - Sidorna `src/pages/Budtraning.tsx` + `src/pages/BudtraningTema.tsx`: riktiga
>   budlådan, "rebidz bjuder …" med motorns förklaring, vad ditt eget bud hade
>   betytt, och "Håller du inte med? Rapportera" (går till ärendelistan).
> - Formen per tema = träffprocent på de senaste 20 svaren (lokalt i
>   webbläsaren; kontosynk är ett senare Beslut B-steg).
> - De handskrivna övningarna (inkl. "regeln om 20") är borttagna. Skillen
>   heter nu `lagga-till-traningstema`.
> - **Temalistan och intro-texterna är Claudes förslag — ägaren synar.**
> - **Resterna, BYGGDA samma dag:** "Träna dina missar" (första budet i en
>   färdig tävlingsgiv där du avvek från motorn sparas lokalt och blir temat
>   `missar`; facit räknas om mot dagens motor, ett läge du klarar faller ur
>   kön) · "Fortsätt budgivningen" (nästa beslut i samma giv) · "Visa hela
>   given" efter svaret.
> - **KVAR i etapp 3:** spelföringsproblem (en hand + träkarl, DD-verifierad
>   lösning) · missar även ur fritt spel · kontosynk av formen och kön.

## Context

Ägaren ska börja värva användare aktivt (närkrets + bridgeklubben) efter en period med
liten testgrupp. Frågan: vad saknar rebidz för att nya användare ska få en så bra
upplevelse som möjligt? Ägarens sex punkter + mina tillägg är kartlagda mot koden
(tre utforskningar 2026-11-11). Ägarval i den här sessionen:

- **Mästerskapsgivar** → egen veckotävling bredvid de dagliga (de dagliga rörs inte).
- **Träningen** → motordriven först, skrivna introduktioner per tema ovanpå.
- **Tröskeln** → kontokravet behålls; bara småfixarna runt det.

### Vad kartläggningen visade (det som styr planen)

1. **Felrapportens spärr är GitHub, inte kod/inloggning.** Rapporten går direkt från
   webbläsaren till GitHub-issues (`src/lib/felrapport.ts:216-255`). Bara ägarens
   webbläsare har nyckeln; alla andra kastas till github.com och behöver eget
   GitHub-konto. Det finns ingen mottagare på servern — den måste byggas.
2. **Träningen är fryst sedan 2026-06-25:** 20 övningar i 5 teman, bara öppningar och
   enkla svar, flervalsknappar i stället för budlådan. Temat `pass-or-open` lär ut
   "Regeln om 20", som motorn inte använder. Inget test binder svaren till motorn.
3. **Första intrycket är inaktuellt:** `src/pages/Om.tsx` säger "inget konto" och
   nämner varken tävlingarna, MP/IMP eller Spela med vänner. Efter inloggning hamnar
   man på `/konto`, inte tillbaka i tävlingen (`src/pages/auth/LoggaIn.tsx:22,31`).
4. **Ingen kort förklaring av systemet.** Budsystem-sidan är ~3 700 rader; ingen
   systemdeklaration, ingen "så bjuder bottarna på en sida". **Störst bridge-risk i
   klubbjakten:** de flesta svenska klubbspelare spelar inte 2/1 — de kommer att
   uppleva korrekta 2/1-bud som fel och rapportera dem.
5. **Mästerskapsgivar går att bygga** — lagringen (`daily_deals.hands`) och klienten är
   redo — men serverkontrollen (`api-src/_lib/validera.ts:84`) och fem nattjobb bygger
   om given ur slumpfröet och måste läsa den lagrade given i stället.
6. **Ingen mätning alls** (medvetet: integritetspolicyn lovar "ingen spårning"). Men
   aktiva spelare/återkomst går att räkna ur `daily_results` utan ny datainsamling.
7. **Inget socialt lager:** inga klubbar/grupper, ingen delning av tävlingsresultat,
   inga påminnelser, ingen statistik per spelare.

### Min ärliga bedömning av ägarens punkter

- **Punkt 4+5 (formulär + öppen rapportering) är billigast och viktigast** — görs
  först, före första värvningsrundan. Varje ny användare utan röst är bortkastad insikt.
- **Punkt 1 (träningen) är rätt och störst i värde** för "appen som förklarar allt".
- **Punkt 2 (mästerskapsgivar) är dyrast och osäkrast.** Tre förbehåll: (a) rättigheter
  till givsamlingar måste redas ut före bygget, (b) människan sitter alltid Syd och
  bottarna bjuder 2/1 — jämförelsen "så gjorde mästarna" haltar och ska visas som
  kuriosa, inte som facit, (c) kända givar kan kännas igen. Därför sist bland byggena.
- **Punkt 3 (bottar/motor/felrapporter)** fortsätter som i dag (/felrapporter först
  varje session) — ingen egen etapp, men fler användare ger fler rapporter, se E1.

## Körordning (en NU i taget, ägarens "kör" vid varje etappslut)

### Etapp 1 — Öppna rösten (ägarpunkt 4 + 5)

**Mål:** vem som helst rapporterar fel eller lämnar förslag med två tryck, utan konto,
kod eller GitHub.

- **Ny serverfunktion `api-src/rapport.ts`** (publik POST, valfri inloggning enligt
  mönstret `kallarId` i `api-src/topplista.ts:32-45`). Servern skapar GitHub-issuen
  med en servernyckel → `/felrapporter`-rutinen och formatet (låst av
  `src/lib/felrapport.test.ts`) är orörda. Typ styr etiketten: `felrapport` eller
  `forslag`.
- **Skydd:** storleksgräns (lyft `readJson` ur `skicka-in.ts:24-40` till `_lib`),
  dold lockfälla mot robotar, kvot per hashad IP med dagligt salt (ingen rå IP
  sparas). `api_kvot` är nycklad på användar-uuid → ny migration **`0015`** med
  anonym kvottabell + RPC efter mönstret i `0007_bord.sql:100-141`; `kvot.ts` får en
  anonym variant.
- **Rapporten berikas** med det som saknas i dag: läge (fritt/tävling/bord),
  motorstämpel (`MOTORSTAMPEL`, `src/lib/build.ts:13`), datum + bricka, visningsnamn
  om inloggad.
- **`src/components/FelrapportDialog.tsx`:** nyckelgrenen och GitHub-fliken bort; allt
  går via servern. Vid fel: tydlig text + mejllänk (aldrig ett naket tekniskt fel).
- **Ny dialog "Tyck till"** med ägarens två frågor ("Vad saknar du på rebidz?" /
  "Hur kan appen bli bättre?") + valfri kontaktrad. Nås från huvudmenyn, startsidan
  och en gång efter avslutad tävling.
- **Förslagsläget i spel och budgivning (punkt 5):** ny kategori "Förslag — jag hade
  bjudit/spelat annorlunda" i samma dialog, etikett `forslag` (inte `felrapport`), så
  fel och önskemål hålls isär i ägarens kö.
- **Ägarsteg:** ny hemlighet i Vercel (GitHub-nyckel, endast Issues) + köra `0015`
  (döps med migrationsnumret). `src/pages/Integritet.tsx` uppdateras: fritext + hashad
  IP är ny uppgift.
- **Rutin:** `.claude/commands/felrapporter.md` läser även `forslag` (förslag
  sammanfattas för ägaren, lagas inte automatiskt).
- **Test:** `api-src/build-bundling.test.ts` (`FUNKTIONER`) + enhetstest för
  kvot/storlek/lockfälla; verifiering: skicka rapport utloggad i preview → issue
  skapas med rätt etikett; 6:e rapporten inom fönstret nekas vänligt.

### Etapp 2 — Första intrycket (inför klubbjakten)

Små, synliga fixar som var och en tar bort en anledning att ge upp.

- **`Om.tsx` skrivs om** (tävlingarna, MP/IMP på tre rader, konton, vänner-bordet;
  länken till dolda "Dagens giv" bort).
- **Tillbaka till rätt sida efter inloggning/registrering** (`LoggaIn.tsx`,
  `Registrera.tsx`: bär med mål-adressen). Tydlig text om vad kontot ger.
- **"Så bjuder rebidz" — systemet på en sida** + systemdeklaration, härledd ur
  `docs/budsystem.md`, med de fem största skillnaderna mot vanlig svensk
  klubbstandard överst. Länkas från startsidan, Om och budlådans hjälp.
- **Spela med vänner på startsidan** (finns bara i menyn i dag).
- **Dela tävlingsresultatet** (återanvänd `navigator.share`-mönstret i
  `Play.tsx:597-603`) — den naturliga värvningsytan: "jag fick 62 % i dag".
- **Installera-knapp** (webbläsarens installationsfråga) i stället för bara text.
- **Större kort/text som inställning** — klubbpubliken är äldre; återöppnar #36
  (`src/lib/cardLayout.ts`, `Settings.tsx`).
- **Ägarrapport utan spårning:** ett skript/Actions-jobb som räknar ur befintliga
  `profiles` + `daily_results`: nya konton, aktiva per dag, återkomst efter 7 dagar.
  Ingen ny datainsamling, ingen policyändring.
- Tävlingsöversiktens mobil-layout (redan i `docs/senare.md:408-434`) tas här.
- **Verifiering:** genomgång i webbläsarpanelen, mobil 375 px, utloggad → konto →
  tillbaka i tävlingen; `impeccable`-skillen för granskning om ägaren vill.

### Etapp 3 — Nya träningsmiljön (ägarpunkt 1)

**Steg A — motordriven träning.**
- Ett **tema = en uppsättning regelrader** i beslutstabellen (`auction-decide.ts`,
  rule-etiketterna). Generatorn delar givar ur frö tills Syds beslut träffar temat
  (samma idé som `src/lib/engine/contract-target.ts`; körs i webworker om det behövs).
- Användaren bjuder i **riktiga budlådan**; facit = `decideCall`, förklaringen ur
  betydelselagret (`auction-meaning.ts`), med länk till rätt § på Budsystem-sidan.
  Kan per konstruktion aldrig lära ut fel.
- Första temalistan (ägaren väljer/justerar före bygget): öppningar · svar på 1M
  (2/1, Jacoby 2NT, Bergen/splinter) · 1NT-systemet · återbud + fjärde färg/NMF ·
  inkliv och upplysningsdubbling · negativ dubbling · slam (kontrollbud, RKC) ·
  försvar mot 1NT och spärrar.
- **"Träna dina missar":** bud i tävlingen där användaren avvek från motorn blir en
  egen övningskö (datan finns i `daily_results.payload`).
- Framsteg per tema (träffprocent, senaste 20) i localStorage via
  `src/lib/backend/index.ts`; kontosynk är ett senare Beslut B-steg.
- Gamla `src/data/exercises/*.json` + `BidOptions` pensioneras när A är live
  (regeln om 20 försvinner med dem). Skillen `lagga-till-ovningar` skrivs om.
- **Test (facit före bygge):** per tema — generatorn hittar en giv inom N försök och
  beslutet bär temats regel; kikvakten gäller oförändrat.

**Steg B — skrivna introduktioner:** en kort text per tema (vad budet lovar, när det
gäller) ovanför övningen, hämtad/länkad ur `docs/budsystem.md` så det finns EN källa.

**Senare i samma spår:** spelföringsproblem (en hand + träkarl, DD-verifierad lösning).

### Etapp 4 — Veckans mästerskap (ägarpunkt 2)

- **Grind 0 (före all kod): källa och rättigheter.** Kandidater att kontrollera:
  förbundens publicerade givprotokoll (WBF/EBL, Svenska Bridgeförbundet). Att fråga
  SBF direkt är också en marknadsdörr. Inget bygge förrän ägaren har en godkänd källa.
- PBN-inläsare (ny; i dag finns bara export i `revisor-dds.ts:28-39`) + vridning så
  att den intressanta handen hamnar hos Syd, giv/zon lagras per rad.
- Givförråd: ny migration (pooltabell) + `form 'masterskap'` på `daily_sets`.
- `validera()` tar den **lagrade** given i stället för fröet (`skicka-in.ts:255`
  hämtar redan raden); samma ändring i bot-, gransknings-, omprovs- och
  diagnosjobben (`tavlingsbot/-granskning/-omprov/-diagnos.probe.test.ts`).
- `sakerstallTavling` (`api-src/_lib/sakerstall-tavling.ts:72`) får en källa per form.
- Efter given: "Så gick det vid bordet" (mästarnas kontrakt/resultat) som kuriosa
  bredvid den vanliga jämförelsen mot fältet.
- **Verifiering:** de dagliga tävlingarna ska ge identiska resultat före/efter
  ombygget av `validera()` (0-diff på en veckas inskick) innan veckotävlingen släpps.

### Etapp 5 — Klubben (mitt starkaste tillägg)

**Klubbtopplista:** ett konto kan gå med i en grupp via kod/länk och se dagens lista
filtrerad på gruppen. Det är detta som gör att en klubbkamrat kommer tillbaka i
morgon. Kräver ny tabell + GDPR-genomgång → eget grindbeslut enligt
`docs/beslut-b-plan.md`.

### Fler förslag (läggs i SENARE, i min prioritetsordning)

1. Tävlingsstreak + enkel spelarstatistik på kontosidan (snitt, bästa dag, slamutfall).
2. Påminnelse "dagens tävling är ute" (frivillig e-post, senare pushnotis).
3. Par-kontrakt + DD-tabell i tävlingsgranskningen (finns redan för borden).
4. Bottarnas motivering per kort i tävlingsgranskningen (`docs/senare.md:447`).
5. "Utmana en vän på samma givar" — delbar länk.
6. Publik förslagslista med röstning (om förslagen blir många).
7. Engelska (Fas 5) och mobilappar (Fas 4) ligger kvar där de ligger.

## Dokument som uppdateras vid klartecken

- `CLAUDE.md`: NU = Etapp 1; NÄST = /felrapporter · Etapp 2 · Etapp 3; resten till
  SENARE (håll ≥200 byte marginal under taket, docs-vakten).
- Ny `docs/nasta-niva-plan.md` (den här planen) + rad i `docs/README.md`;
  `docs/senare.md` får tilläggen; `docs/konkurrensplan.md` pekar hit.

## Stående regler som gäller hela planen

Fråga före commit/push/deploy · facit-test före fix · ny backend bara med grindbeslut ·
migrationer körs av ägaren och döps med numret · inga hemligheter i git · en NU i taget.
