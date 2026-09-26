# Dagens IMP — en andra daglig tävling räknad i IMP (ägarbeslut 2026-09-26)

> **Status: BYGGS — etapp 0 (motorn) + etapp 1 (schema + frön) KLARA i kod 2026-09-26, ej committade/deployade; 0013 väntar på ägaren.** Levande dokument för hela bygget.
> Masterplanens ram: `docs/beslut-b-plan.md` (etapp 2 lade grunden: konton →
> daglig 12-givarstävling → topplista). Det här dokumentet är kartan för att
> lägga **en tävling till** bredvid den: samma dag, tolv NYA givar, räknade i
> IMP enligt IMP-tabellen. Läs den FÖRST vid allt IMP-arbete.

## Ägarbeslutet (2026-09-26)

Ägaren vill ha **två unika tävlingar varje dag**:

- **Dagens tävling (MP%)** — som i dag. Räkningen ändras INTE (ägarbeslut
  samma dag: ingen Neuberg, ingen ändring av matchpoängen, varken nu eller
  senare — ägaren återkommer om det ändras).
- **Dagens IMP** — tolv nya givar (egna frön, egen ställning, egen historik),
  poängsatta i IMP enligt IMP-tabellen.

Alternativet "samma tolv givar, två räkningar" är AVFÖRT — ägaren vill ha en
riktig andra tävling, även om den är dyrare att bygga.

## Vad IMP är (för den som läser detta först)

**IMP** (International Match Points) är lagbridgens poängskala. I stället för
att ranka resultaten på en giv (matchpoäng: en övertrick kan vara lika mycket
värd som en dubblad bet) jämförs POÄNGSKILLNADEN mot ett annat resultat och
översätts med en fast tabell som planar ut stora skillnader:

| Skillnad | IMP | Skillnad | IMP | Skillnad | IMP |
|---|---|---|---|---|---|
| 0–10 | 0 | 370–420 | 9 | 1500–1740 | 17 |
| 20–40 | 1 | 430–490 | 10 | 1750–1990 | 18 |
| 50–80 | 2 | 500–590 | 11 | 2000–2240 | 19 |
| 90–120 | 3 | 600–740 | 12 | 2250–2490 | 20 |
| 130–160 | 4 | 750–890 | 13 | 2500–2990 | 21 |
| 170–210 | 5 | 900–1090 | 14 | 3000–3490 | 22 |
| 220–260 | 6 | 1100–1290 | 15 | 3500–3990 | 23 |
| 270–310 | 7 | 1300–1490 | 16 | 4000+ | 24 |
| 320–360 | 8 | | | | |

(WBF:s officiella tabell; samma som Svenska Bridgeförbundet använder.)

Strategin skiljer sig från MP: utgången och slammen väger tungt, övertricken
lite, riskabla dubblingar undviks. Det är därför det är en egen tävling och
inte bara en annan kolumn.

### Så räknas en spelares IMP på en giv — **cross-IMP** (rekommendation)

Alla spelar samma stol (Syd mot bottar), så det finns bara N/S-poängen att
jämföra, exakt som i MP-tävlingen. Cross-IMP: en spelares N/S-poäng jämförs
med **varje annan** spelare på given, skillnaden översätts med tabellen
(tecken efter vem som var bäst), och **snittet** av alla jämförelser är
spelarens IMP på given. Toppen blir därmed inte fast — men summan över alla
spelare på given är alltid noll, precis som i lagbridge.

Exempel, tre spelare på en giv: a = +620, b = +170, c = −100.

- a mot b: skillnad 450 → +10 · a mot c: skillnad 720 → +12 · **a = +11,0**
- b mot a: −10 · b mot c: skillnad 270 → +7 · **b = −1,5**
- c mot a: −12 · c mot b: −7 · **c = −9,5**

Summan 11,0 − 1,5 − 9,5 = 0. ✓

Alternativet **Butler** (IMP mot ett datum = snittet av de andras poäng,
ofta med topp och botten bortkastade) kräver trimningsregler och blir skakigt
med tre till sex spelare per giv. Cross-IMP är därför rekommendationen — se
ägarfråga 1.

### Så räknas tävlingen — summan över tolv givar

Ställningen sorteras på **summan av IMP** över dagens givar ("+14,5 IMP"), det
mått alla känner igen (ägarbeslut 2026-09-26). Under dagen räknas en ännu
opoängsatt giv som **0 IMP** (ägarbeslut 2026-09-26; alternativet −3 IMP =
lagbridgens "medel minus" avfört). Konsekvens, medvetet: att hoppa över en giv
är neutralt i IMP-ställningen, till skillnad från MP-tävlingens 40 %. Minst två spelare på
en giv för poäng (`MIN_PER_GIV`), delad rang vid lika summa, medaljer per dag —
allt exakt som MP-tävlingen, bara med ett annat tal.

## Ägarfrågor — alla besvarade 2026-09-26

| # | Fråga | Beslut |
|---|---|---|
| 1 | Cross-IMP eller Butler (mot datum)? | **Cross-IMP** (ägarbeslut 2026-09-26 efter förklaringen: Butler jämför mot ett datum som ens egen poäng drar i; cross-IMP summerar till noll och fungerar lika i små fält). |
| 2 | Vad räknas en ospelad giv som under dagen? | **0 IMP** (ägarbeslut). −3 IMP avfört. |
| 3 | Ställningen: summa eller snitt per giv? | **Summa** ("+14,5 IMP") (ägarbeslut). |
| 4 | Medaljer: en medaljtabell per tävlingsform, eller en gemensam? | **En per form** (ägarbeslut). Historiksidan får två flikar. |
| 5 | Namnen i gränssnittet? | **"Dagens MP%"** och **"Dagens IMP"** (ägarbeslut: procenttecknet gör tydligt att den ena är en procentberäkning). Rubriker "Dagens MP% #N" / "Dagens IMP #N"; löpnumret N är samma för båda. |

Beslut Claude tar själv (rutinval, inga grindar): formens tekniska namn
`'mp' | 'imp'`; URL-parametern `?form=imp`; egen framstegsplats i
localStorage för IMP-serien; IMP-tävlingens deal-id `tavling-imp-N-B`.

## Arkitekturen — fyra grepp bär hela bygget

### 1. En kolumn: `daily_sets.form`

Schemat låser i dag **en tävling per dag** (`comp_date` är unik,
`0004_daily_deals.sql`). Lösningen är en kolumn `form text not null default
'mp'` (check `'mp' | 'imp'`) och en ny unik nyckel `(comp_date, form)`.
Alla befintliga rader blir `'mp'` automatiskt → historiken är intakt utan
datamigrering. `daily_deals`, `daily_results` och `daily_standings` hänger på
`set_id` och behöver **inte** ändras — IMP-tävlingens givar, inskick och
frusna ställningar bor i samma tabeller under sitt eget set.

`daily_standings.snitt` (numeric(5,2)) rymmer även IMP-summan (±999,99). Vad
talet betyder avgörs av setets `form`. Ingen ny kolumn — men kommentaren i
migrationen säger det, och API-svaret kallar det aldrig "snitt" för IMP.

### 2. Egen frönyckel — MP-fröna får INTE flytta sig

Fröna hashar i dag `"datum:bricka"` (`api-src/_lib/seed.ts`). Två set samma
dag skulle få samma givar. Därför en **frönyckel** i stället för datumet:
`fronyckel(dag, form)` = `dag` för MP (byte-identiskt med i dag — så
nattgranskningens omprov av gamla dagar, valideringen och alla probar ger
exakt samma givar som förr) och `` `${dag}#imp` `` för IMP. Alla anrop av
`seedForBoard`/`playSeedForBoard`/`validera`/`genereraGivar` får nyckeln i
stället för datumet. Ett facit låser att MP-nyckeln = datumet.

### 3. Formen som parameter i hela kedjan

Varje endpoint som i dag slår upp `daily_sets?comp_date=eq.<dag>` och tar
`sets[0]` slår upp `&form=eq.<form>` i stället, med `form` ur `?form=` (GET)
eller kroppen (`skicka-in`), default `'mp'`. Klientens fetch-funktioner får
`form` som argument. Tävlingsläget (`TavlingSpel`) bär `form` så spelskärmen
kan skriva "IMP-tävling · Giv 3/12" och skicka in till rätt set.

### 4. Aggregatet generaliseras — MP-vägen rörs inte

`aggregeraTopplista` i `matchpoints.ts` är hårdkopplad till matchpoäng och
procentsnitt. Den får en **form-strategi**: per-giv-räknare
(`matchpointsForBoard` | `crossImpsForBoard`), provisoriskt värde (40 % |
0 IMP) och sammanvägning (snitt | summa). MP-strategin är dagens kod ord för
ord — befintliga facit (`matchpoints.test.ts`, `topplista.test.ts`,
`tavlingsavslut.test.ts`) bevisar att MP-tävlingen inte flyttat sig en
hundradel. IMP-tabellen + cross-IMP + strategin bor i en ny modul
`src/lib/engine/imp.ts` med eget facit (tabellens alla gränser, summa noll,
exempel ovan, ensam spelare, lika poäng).

## Kartan — allt som rörs, per lager

Kartlagd 2026-09-26 (subagent-svep över hela kedjan). Radhänvisningar är
ögonblicksbilder; koden är sanningen.

**Databas** — migration `0013` (lägg till `form` + unik `(comp_date, form)`)
och `0014` (släpp den gamla unika på `comp_date`). Två filer med flit — se
deploy-sekvensen nedan. Båda idempotenta, döps "0013"/"0014" i Supabase
(ägardirektiv 2026-09-01).

**Server (`api-src/`)** — inga nya funktioner (Hobby-planens funktionstak;
`build-bundling.test.ts` listar de åtta):

- `generera-dagens-givar.ts` — cronen skapar BÅDA seten (upsert på
  `comp_date,form`) och 24 givar med varsin frönyckel.
- `dagens-tavling.ts`, `giv-resultat.ts`, `topplista.ts` — `?form=`,
  uppslag på `(comp_date, form)`, IMP-svar via strategin (topplistan lämnar
  `form` + talet under namnet `poang` med `enhet: 'procent' | 'imp'`).
- `skicka-in.ts` — `form` i kroppen; valideringen får frönyckeln.
- `tavling-historik.ts` — dagar × form; medaljer per form (ägarfråga 4).
- `_lib/seed.ts` (frönyckeln), `_lib/validera.ts` (nyckel i stället för
  datum), `_lib/kvot.ts` (kommentaren "12 givar per dag" → 24; kvoterna
  räcker: `skicka-in` 20/min).

**Nattjobben (`.github/workflows/` + probarna)** — alla lär sig båda seten:

- `tavlingsbot.probe.test.ts` (botspelarna, 23:45) — loopar seten för dagen;
  frönyckel per set. **Risk: körtiden fördubblas** (tänkande bottar + DD) —
  mät första natten, `timeout-minutes` i ymlen höjs vid behov.
- `tavlingsgranskning.probe.test.ts` + `tavlingsomprov.probe.test.ts`
  (djupgranskningen, 01:30) — per set; omprovet får frönyckeln.
- `tavlingsavslut.probe.test.ts` (slutställningen) — per set med setets
  strategi (IMP-summa i `snitt`-kolumnen för IMP-set).
- `tavlingsdiagnos.probe.test.ts` (förscreeningen, 18:30) — båda nycklarna,
  24 brickor per dag.
- `tavling-genrep.probe.test.ts` (oschemalagd) — nyckel-parameter.

**Klient (`src/`)**:

- `lib/backend/tavling.ts` — `form` i `DagensTavling`, `TavlingFramsteg`,
  alla fetch-funktioner + `submitTavlingGiv`; deal-id `tavling-imp-N-B`.
- `lib/backend/index.ts` — egen framstegsnyckel `tavling-framsteg-imp`
  (MP-nyckeln `tavling-framsteg` orörd — sju tester låser den).
- `pages/play/tavling-mode.ts` — `form` i `TavlingSpel`; `Play.tsx` och
  `BiddingPhase.tsx` läser den för etiketten och resultatskärmen.
- `pages/DagensTavling.tsx` — parametriserad på `?form=`; texterna
  ("Samma 12 givar…", rubriken, nedräkningen) per form.
- `pages/tavling/TavlingDelar.tsx` + `GivGranskning.tsx` — `DinStällning`,
  `Resultattabell` ("Din MP%" → "Dina IMP"), `TravellerTabell`
  (cross-IMP per rad), `TopplistaVy` (`+14,5 IMP` i stället för `%`);
  `brickresultat.ts` får IMP-varianten för travellern.
- `pages/TavlingHistorik.tsx` — dagrader per form (två flikar eller två
  kolumner — avgörs i etapp 4 med ägaren), dagvyn `?dag=&form=`.
- `pages/Home.tsx` — korten "Dagens MP%" och "Dagens IMP"; `App.tsx` —
  ingen ny route behövs (`?form=` på befintliga), men en tydlig länk.
- `lib/backend/account.ts` — dataexporten tar med setets `form`;
  kontoräknaren "tävling N" räknar båda (medvetet).

**Tester som låser dagens nyckling** (uppdateras i takt): `giv-resultat.test`,
`tavling-historik.test`, `topplista.test`, `tavlingsdag.test`,
`DagensTavling*.test.tsx`, `TavlingHistorik.test.tsx`, `tavling-smoke.test.tsx`.

**Docs**: den här filen · `docs/beslut-b-plan.md` (ändringsloggen + grinden
"fler tävlingslängder/serier" får sitt svar: separata set med `form`) ·
`docs/README.md` · `CLAUDE.md` (NU-rutan; **budgeten är ~230 byte** — rutan
skrivs om kortare, sunt förnuft-lagret blir parallellt ägarsteg).

## Byggordning — sex etapper, varje etapp grön i `npm test` före nästa

Regeln från bordens bygge gäller: **paritetsgenomgång före ägardemo** — MP-
tävlingen ska bete sig exakt som förr efter varje etapp.

| Etapp | Innehåll | Grind |
|---|---|---|
| **0 Motorn** | `imp.ts`: IMP-tabellen, `impFor(diff)`, `crossImpsForBoard`, form-strategin; `aggregeraTopplista` generaliserad; facit. Ren aritmetik, ingen I/O. | Ägarfråga 1 besvarad (2–5 klara 09-26). Alla gamla facit gröna orörda. |
| **1 Schema + frön** | Migration 0013 + 0014 skrivna; frönyckeln i `seed.ts`/`validera.ts`/`generera.ts`; cronen skapar båda seten. Facit: MP-nyckel = datum (frön identiska). | 🚪 Ägaren kör **0013** i Supabase. |
| **2 Servern** | `form` i alla fem endpoints + tester. Bakåtkompatibelt: utan `form` = MP. | Deploy A (se sekvensen). |
| **3 Nattjobben** | Botspelare, granskning/omprov, avslut, förscreening, genrep per set. | 🚪 Ägaren kör **0014**. Nästa cron (01:05 svensk tid) skapar första IMP-setet; botjobbet 01:45 spelar det. Mät körtiden. |
| **4 Klienten** | Startsidans kort, sidan per form, tävlingsläget, tabellerna i IMP, historik + medaljer per form, framsteg, export. | 🚪 Demo för ägaren: spela en IMP-giv live, se ställningen, se historiken dagen efter. |
| **5 Docs + live-prov** | beslut-b-plan ändringslogg, README, CLAUDE.md, historik. Ägarens live-prov: en hel IMP-serie. | Ägaren väljer nästa NU. |

### Deploy-sekvensen (varför 0013 och 0014 är två filer)

Cronen upsertar `daily_sets` med `on_conflict=comp_date` — det kräver att den
unika nyckeln finns. Släpps den innan koden bytt nyckel faller cronen 01:05
och dagen får inga givar. Därför:

1. **0013** (lägg till `form` + unik `(comp_date, form)`; den gamla unika står
   kvar) — ofarlig för gammal kod, som inte känner till kolumnen.
2. **Deploy A** = etapp 0–3 (koden upsertar på `comp_date,form` och skapar
   båda seten; IMP-setet faller tyst på den gamla unika tills 0014 — MP-setet
   skapas som förr).
3. **0014** (släpp unik `comp_date`) — nästa cron skapar IMP-setet.
4. **Deploy B** = etapp 4 (klienten). Kan gå samma dag som A om allt är grönt,
   men IMP-kortet på startsidan visas först när ett IMP-set finns (404-fallet
   hanteras: "Dagens IMP öppnar i morgon").

Varje deploy med egen `--no-ff`-mergepunkt (rollback-regeln i CLAUDE.md).

## Risker och hur de möts

- **MP-tävlingen flyttar sig.** Största risken. Möts av: frönyckel = datum för
  MP (facit), MP-strategin = gammal kod (gamla facit orörda), ingen ny
  kolumn i results/standings, `form` default `'mp'` överallt.
- **Botjobbets körtid.** Tänkande bottar + DD per giv; 24 givar × 3 bottar.
  Mät första natten; höj `timeout-minutes`; sista utväg: två jobb i sekvens.
- **Supabase-last.** Rader i `daily_results` fördubblas (36 botrader + N
  människor × 2 per dag). Långt under gratisnivån; nattstädningen finns.
- **Funktionstaket på Hobby.** Inga nya funktioner — allt via `?form=`.
- **CLAUDE.md-budgeten.** ~230 byte kvar under 16 KiB. NU-rutan skrivs om
  kortare i etapp 5 (docs-vakten är domaren: `npm test -- docs-vakt`).
- **Spelaren blandar ihop serierna.** Egen framstegsnyckel, eget deal-id,
  formen i varje rubrik och i spelskärmens etikett.

## Medvetet utanför v1

- **Butler/datum-IMP** — bara om ägaren väljer det i fråga 1.
- **Bottar som spelar "IMP-strategi"** (t.ex. säkrare spelföring, färre
  tunna dubblingar). Bottarna bjuder och spelar lika i båda formerna
  (RÄTT, inte max stick). Kandidat för SENARE om IMP-ställningen visar att
  bottarna systematiskt vinner/förlorar på formskillnaden.
- **Neuberg** — avfört av ägaren 2026-09-26 (gäller båda formerna).
- **Fler former** (t.ex. total poäng, BAM). `form`-kolumnen rymmer dem
  utan schemaändring; planen skrivs då.
- **Egen kvot per form** — dagens kvoter räcker.

## Ändringslogg

- **2026-09-26** — planen skriven efter ägarbeslutet (Tolkning B: en egen
  IMP-tävling med tolv nya givar). Kartan över "en tävling per dag"-antagandena
  svept. Fem ägarfrågor öppna. Inget byggt.
- **2026-09-26 (senare)** — ägarsvar på fråga 2–5: 0 IMP provisoriskt · summa ·
  medaljtabell per form · namnen "Dagens MP%" / "Dagens IMP". Fråga 1
  (cross-IMP/Butler) väntar på förklaring → beslut.
- **2026-09-26 (kväll)** — fråga 1: **cross-IMP** (ägarbeslut). Alla fem klara → etapp 0 påbörjad.
- **2026-09-26 (senare)** — **etapp 0 KLAR** (`imp.ts` + facit, form-strategin i `matchpoints.ts`, travellern/slutställningen/giv-resultat per form; MP-facit orörda i värde) och **etapp 1 KLAR i kod** (`fronyckel` i `seed.ts` + facit som låser MP-nyckeln = datumet; migration 0013 + 0014; cronen skapar båda seten, MP först och IMP-fel stoppar aldrig MP). Hela sviten grön (`npm test`).
