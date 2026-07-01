# CLAUDE.md — Bridge-app
Läs den här filen först varje session.

## 🗺️ Projektkarta — NU / NÄST / SENARE / PARKERAT
> **Detta är överblicken. Läs den först.** `docs/arbetslista.md`, `docs/status.md`
> och felsökningsplanen är detaljnivån — kartan här styr ordningen.
>
> **Järnregel:** 🔵 NU innehåller **exakt en sak**. Inget annat rörs förrän den är
> klar. Kommer ägaren med en ny idé mitt i ett NU-jobb ska Claude **stoppa** och
> säga *"bra idé — men just nu är NU: X, den rör vi inte"*, och lägga idén i
> ⚪ SENARE. NÄST har max 3 saker. När NU blir klar: flytta upp en sak från NÄST,
> visa återstående punkter (regeln i `docs/arbetsrutiner.md`) och låt ägaren välja.

### 🔵 NU (det enda vi jobbar på)
**✅ FAS 4 VÄRDERING KLAR (2026-07-01, testsvit 559).** Punkt 16–18 + TP-steg
C-2/C-3 + hela Steg D (sang-nudge inkl. sårbarhet). **NU-facket är tomt — nästa
steg: ägaren väljer ett NU ur 🟢 NÄST** (naturlig kandidat: FAS 5 NT-systemet).
Rör inget nytt förrän valet är gjort.

Slutförd FAS 4 (facit + `npm test`, autonom körning – besluten för granskning):
- ✅ **Punkt 16 — HP/TP/LTC-karta:** motorn kör HP + TP; **LTC finns inte**.
  Beslut: inför inte LTC (TP täcker det). Karta i `docs/handvardering.md`.
- ✅ **Punkt 17 — stödvärdering verifierad:** fitpoäng/distributionsvärde/kortfärger
  isolerade + låsta (`evaluation.test.ts`); Bergens asymmetri bekräftad.
- ✅ **Punkt 18 — slamvärdering:** `wastedHonorsOppositeShortness` nedvärderar
  K/D mot partnerns kortfärg (ess behålls), inkopplat i `slamInvestigation` via
  Jacoby-kortfärg. Knyter ihop FAS 3-svansen.
- ✅ **Steg C-2 — minorhöjningar på TP:** längd/sidofärg lyfter, aldrig korthet
  (minorfit siktar 3NT). `responses.ts`.
- ✅ **Steg C-3 — sang-accepter på TP:** 3NT-accepter på startpoäng. `rebids.ts`.
- ✅ **Steg D — sang-nudge (komplett):** bra 14 (ingen 5-korts färg) → 1NT
  (`openings.ts`). 5-korts minor öppnar minorn, 5-korts major öppnar 1M.
  **Sårbarheten modulerar tröskeln:** ej sårbar = aggressiv (startp. ≥15), sårbar
  = passiv (≥16). `isVulnerable` trådad via `buildAuction`. Facit i `openings.test.ts`.

---
Slutförd FAS 3 (facit + `npm test`):
- ✅ **Punkt 11 — Gemensam fitklassificering** (klar 2026-07-01): `classifyFit`
  (`evaluation.ts`) ger EN sanningskälla för fitens kvalitet: `none / two / three /
  good-three / four / five-plus`. "Bra 3-stöd" = 3 trumf med trumfhonnör (E/K/D)
  ELLER kort sidofärg (singel/renons). Facit i `evaluation.test.ts`.
- ✅ **Punkt 12 — Bergen aldrig med 3 stöd** (klar 2026-07-01): Bergen-grinden går
  nu via `classifyFit(...).hasFourPlus` i `respondToMajor` (`responses.ts`) →
  strukturellt omöjligt att fyra Bergen/Jacoby/splinter med 3 stöd. Intervall
  bekräftade (3♣ = 7–9, 3♦ = 10–12, 3M = 0–6). Facit i `responses.test.ts`.
- ✅ **Punkt 13 — Jacoby 2NT** (klar 2026-07-01): rätt stöd (4+ via `hasFourPlus`),
  "ingen kortfärg" garanteras av ordningen (splinter-kollen först → hand med
  singel/renons splintrar i stället). Facit i `responses.test.ts`.
- ✅ **Punkt 14 — Splinter kortfärg** (klar 2026-07-01): efter tvetydig splinter +
  relä visar svararen singelns färg **upp-the-line** (ägarbeslut: billigaste steg =
  lägsta möjliga kortfärg, 4♣/4♦/4♥) via `responderRevealSplinterShortness`.
  Renons går redan via Exclusion. Öppnarens honnörsnedvärdering mot kortfärgen =
  FAS 4 punkt 18. Hela kedjan verifierad (1♥–3♠–3NT–4♦).
- ✅ **Punkt 15 — Bergen game try** (klar 2026-07-01): triggern (1M–2M–2NT) fanns
  och använder rätt mått (**TP/Bergenpoäng 15–17**, ej rå HP/LTC). Svararen svarar
  nu (fanns inte förut) enligt **Bergens äkta variant** (ägarbeslut): visa KORTHET
  upp-the-line (3 sidofärg), annars platt 3M signoff / 4M accept via
  `responderAnswerBergenGameTry`. Facit i `responder-rebids.test.ts`.

### 🟢 NÄST (max 3, i ordning)
1. **FAS 5 — NT-systemet:** Stayman, Smolen, transfers, Texas, MSS, 2NT, 3NT.
2. **FAS 6 — Minorsystem:** minorregeln, inverterade minorer, svaga hoppskift.
3. **FAS 7 — Svaga öppningar:** svaga tvåor, Ogust, spärröppningar, regel 2-3-4.

### ⚪ SENARE (oordnat — hämtas upp till NÄST en i taget)
- FAS 8 Slam · FAS 9 Passad hand · FAS 10 Försvarsbud · FAS 11 Kortspel ·
  FAS 12 UI (allt enligt felsökningsplanen). Även TP-steg E (reverse/hoppskift på
  TP) + F (3:e/4:e-hands lättöppning) ur `docs/tp-arbetslista.md`.

### 🅿️ PARKERAT (medvetet INTE nu — sluta väga in i beslut)
- **Slam-quirken** (~0,25 %, Jacoby 2NT→cue→RKC): känd gräns, stängs lagligt.
  Bekräfta bara att den fortfarande stängs — jaga den aldrig som bugg.
- **DDS-facit på tunga fulla givar:** känd gräns (nodbudget). Ej fel.
- **Off-book §7 bredd** (balansering + inkliv över 1NT/svaga tvåor/spärrar).
- **"Framkalla slutbud"-väljaren** (ägaridé) + **webworker för DDS-facit**.

## Arbetsrutiner (följ varje gång)
- **Vid sessionsstart:** följ 🟢-checklistan i `docs/arbetsrutiner.md`.
- **Vid sessionsslut:** följ 🔴-checklistan i `docs/arbetsrutiner.md`.

## Vad det här är
Interaktiv webbapp för att lära sig och spela bridge (kortspelet).
Användaren ska kunna spela olika händer och lära sig olika budsystem.
Allt körs i webbläsaren, gratis-hostat på GitHub Pages.
## Vem jag bygger för
Ägaren är nybörjare utan programmeringsbakgrund.
- Förklara på enkel svenska. Inga tekniska termer utan förklaring.
- Ett steg i taget. Vänta på bekräftelse innan du går vidare.
- När ägaren måste göra något själv (klicka, logga in, godkänna):
  säg exakt var och vad.
- Du skriver ALL kod. Ägaren läser den inte. Optimera för korrekthet
  och för att DU lätt ska kunna underhålla den över tid.
## Teknisk stack
- React + Vite + TypeScript
- Tailwind CSS för styling
- Ingen backend. Allt client-side.
## Hosting & deploy (viktiga låsningar)
- GitHub Pages = ENDAST statiska filer. Ingen server, databas eller
  backend-kod är möjlig.
- Auto-deploy: en GitHub Actions-workflow bygger sidan vid varje push
  till main. Ägaren kör ALDRIG bygg-kommandon själv – push räcker.
- Vite `base` MÅSTE sättas till "/<repo-namn>/", annars blir sidan
  blank på Pages. Det är det vanligaste deploy-felet – kontrollera det.
- Användarens framsteg sparas i localStorage (ingen databas).
## Bridge-specifikt
- "Rätt svar"-feedback via en double-dummy solver i WebAssembly
  (Bo Haglunds DDS, open source, kör i webbläsaren). Verifiera vilket
  npm-paket som är bäst underhållet innan du kopplar in det.
- Givar och budsystem ligger som JSON-filer i repot – aldrig
  hårdkodade inne i komponenterna.
- Budsystem: börja med ETT system, gör det ordentligt, lägg till fler
  senare. Bygg inte alla på en gång.
## Beslut
- Budsystem: **2 över 1 (2/1)**. Endast detta (lägg till fler senare).
- **TP i budvalet (beslut 2026-06-30, byggs i steg).** Boten ska tänka i
  totalpoäng (TP/fördelning), inte rå HP. **Låst regel:** en **12 HP-hand öppnar
  alltid** – TP får aldrig *nedgradera* en öppningshand (människor gör det extremt
  sällan). TP får däremot *uppgradera* (bra 11:a öppnar) och *nudga sang*. Omfång:
  brett (öppning → svar → återbud), men implementeras **i test-låsta steg** så
  on-book aldrig rubbas. **Steg A klart:** öppningsgolvet (`openings.ts`:
  `HP ≥ 12 || TP ≥ 12`). **Steg B klart:** svararens högfärgshöjningar räknar
  **stödpoäng = `max(HP, dummyPoints)`** (`responses.ts` `respondToMajor`) – Bergen
  fullt (singel +3 m. 4 trumf) men aldrig under HP, så korthet *lyfter* en höjning
  (11 HP + singel + 4 trumf → splinter) men platta händer nedgraderas aldrig.
  **Steg C-1 klart:** öppnarens **högfärgs-accepter** räknar **Bergenpoäng =
  `max(HP, bergenPoints)`** (`rebids.ts`: `openerRebidAfterSimpleRaise`,
  `openerRebidAfterBergen`, `openerRebidAfterSplinter`) – form lyfter mot game
  try/utgång/slamintresse, aldrig under HP (en formstark 11:a accepterar utgång
  mot en limithöjning). **Kvar:** C-2 = svararens/öppnarens **minorhöjningar** på
  TP, C-3 = **sang-accepter**, D = TP-nudge för **sangöppning**. Ägaren vill ge
  **mänsklig input i konkreta budsituationer** löpande – fråga hellre än gissa.
- **Spelstick i öppningen (beslut 2026-07-01).** Nytt värderingsmått `playingTricks`
  (`evaluation.ts`): honnörer + långa kort (+1/kort över 3 i en färg med ess/kung).
  En hand med **≥ 8½ spelstick öppnar 2♣** (stark) även med HP < 22 – starka
  fördelningshänder (lång stark färg, få hp) tas nu om hand i stället för att öppna
  1 i färg och tolkas som minimum. Balanserade 22+ oförändrat. Visas i `HandView`.
  **Kvar (ägarens prio):** starkare 1-lägesåterbud/hoppskift när en stark hand ändå
  öppnar på 1-läget; sedan ärligt giv-facit + DDS-optimal spelföring (uppskjutet).
- Första funktion: **budträning** – visa hand, välj bud, appen ger facit.
- Nästa stora riktning: **Spela mot datorn** (offline mot bottar; kvalitet före tempo).
- **Målgrupp (beslut 2026-06-30): erfaren spelare** – en pålitlig, robust 2/1-
  partner/motståndare (inte nybörjarträning först).
- **PIVOT (beslut 2026-06-30): tolkande budmotor.** Roten till "stel/inkomplett/
  felaktig" var att motorn är **generativ** (hand → en kanonisk rad). Vi bygger ett
  **tolkande** lager (`src/lib/engine/auction-interpret.ts`) som läser den faktiska
  auktionen. **Steg 1+2 klara & live:** egna/off-book-bud får ALLTID en förklaring.
  **Steg 3 klart (kärnan):** `decideCall` lämnar ideallinjen när Syd bjuder
  off-book (`divergedFromLine`) och datorpartnern svarar historiedrivet
  (`offBookResponse`): stöd m. fit graderat efter stödpoäng (3-korts fit för
  öppnad högfärg, annars 4+; enkel/inbjudan/utgång), annars egen färg/sang.
  On-book bevisat oförändrat. **Konkurrens-fortsättning klar:** `decideCall`
  svarar historiedrivet även när linjen tagit slut men auktionen är öppen
  (`built.open`) – störda auktioner dör inte längre efter en rond; partner +
  advancer konkurrerar vidare. **§7-inkliv i budlådan klart:** när auktionen gått
  off-book kliver motståndarna in på RIKTIGT via `overcall` (`maybeOvercall` i
  `auction-live.ts`) i stället för att tystna – men bara DIREKT sits (motståndaren
  öppnade nyss 1 i färg, vår sida har inte sagt något). Inkliv/X/Michaels/ovanlig
  2NT ur §7-motorn. **NÄSTA GÅNG STARTAR VI MED:** balansering (inkliv efter en
  passrunda) + inkliv över andra öppningar (1NT/svaga tvåor) – sedan slam-quirken.
- Budmotor byggs i `src/lib/engine/`, test-drivet (`npm test`).
- Detaljerad implementationsstatus: **`docs/status.md`**
- Byggordning framåt: **`docs/arbetslista.md`** (NB: pivoten ovan går före den gamla
  FAS-ordningen i felsökningsplanen).

## Konkreta fakta om detta projekt (för deploy)
- GitHub-repo: **PGreen90/Learn-Bridge** (publikt).
- Live-URL: **https://pgreen90.github.io/Learn-Bridge/**
- Vite `base` = **"/Learn-Bridge/"** (måste matcha repo-namnet exakt).
- Auth: gh CLI är inloggad som PGreen90 (device-flow) och är git
  credential helper. Pusha via `git push`. Scopes inkl. `workflow`.
- Node.js ligger i `C:\Program Files\nodejs\` (lägg den först i PATH
  i nya shells: npm/node finns inte alltid på PATH automatiskt).
- Pages-källa = "GitHub Actions" (build_type=workflow), redan aktiverat.

## Projektstruktur
- `index.html` – sidans skal, laddar src/main.tsx
- `src/main.tsx` – startpunkt, monterar React-appen
- `src/App.tsx` – router (HashRouter) som kopplar adresser till sidor
- `src/index.css` – `@import "tailwindcss";` (Tailwind v4)
- `src/types/bridge.ts` – TypeScript-typer (Card, Hand, Deal, BiddingQuestion)
- `src/lib/storage.ts` – läs/skriv framsteg i localStorage
- `src/components/` – återanvändbara byggblock:
  - `Layout.tsx` (topbar + meny), `Panel.tsx`, `Button.tsx`,
    `SuitSymbol.tsx`, `HandView.tsx`
- `src/pages/` – en fil per skärm: `Home`, `BiddingPractice`,
  `Learn`, `Settings`
- `vite.config.ts` – base-path + react- och tailwind-plugin
- `.github/workflows/deploy.yml` – auto-bygge & publicering vid push
- (kommer) `src/data/*.json` – givar och budsystem som data

## Navigering (router)
- HashRouter används (adresser med #, t.ex. .../#/budtraning) eftersom
  det fungerar på GitHub Pages utan serverinställningar. Byt INTE till
  BrowserRouter utan att lägga till en 404-fallback för Pages.
- Lägg till ny skärm: skapa `src/pages/Xxx.tsx`, lägg till en
  `<Route>` i `App.tsx` och en länk i `NAV`-listan i `Layout.tsx`.

## Hur man lägger till innehåll
- Bridge-typerna bor i `src/types/bridge.ts` – utgå alltid från dem.
- Övningar ligger som JSON i `src/data/exercises/<tema>.json`, aldrig
  hårdkodade i komponenterna. Teman listas i `src/data/themes.json`.
- Inläsning sker i `src/lib/bidding.ts` (registret `EXERCISES_BY_THEME`).
  Ny temafil måste importeras och läggas till där.
- Handen skrivs som kort text, t.ex. `"S:AK974 H:K83 D:Q6 C:J52"`.
  Tian skrivs som `T`. Tom färg: `-`. Parsas av `parseHand`.
- En övning = `auction`: en lista med steg. Ett steg är antingen ett
  manus-bud `{ "bid": "1H" }` (partner/motståndare) eller ditt beslut
  `{ "decision": { "options": [...], "answer": "1S", "explanation": "..." } }`.
  Vem som bjuder räknas ut från `dealer` + ordningen (medurs N→E→S→W).
- Bud skrivs som `"1C"/"1D"/"1H"/"1S"/"1NT"`, samt `"P"`, `"X"`, `"XX"`.
- Lägena (Scope): `opening`, `opening-response`, `full-auction`.
  Ett tema hör till ett läge via fältet `scope` i themes.json.
## Kommandon
- `npm run dev` – lokal förhandsvisning under utveckling
- `npm run build` – byggs automatiskt av GitHub Actions, sällan manuellt
## Vad man INTE gör
- Lägg aldrig till backend/server/databas – Pages kan inte köra det.
- Glöm aldrig Vite `base`-pathen vid deploy.
- Bygg inte alla budsystem på en gång – ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
