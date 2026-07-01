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

### 🔵 NU (Steg 3 klar & live – välj nästa)
**🧠 FAS 11 — Bot-hjärnan (kortspel/motspel-förfining), OMSTRUKTURERAD** (start
2026-07-01). Ägaren pekade ut den riktiga smärtan: bottarna tar t.ex. 10 stick
där 13 var kalla — usel stickföring, "kryper under i onödan". FAS 11 (signaler)
löser INTE det. Så FAS 11 blev ett större epos: **expertspel via ärlig enkeldummy-
inferens** — bottarna ska läsa bordet (räkna de 40 HP:na, dra bort budvisning +
fallna kort). **Järnprincip: ingen tjuvkik** (DDS ser alla händer = fusk; används
i stället över *troliga* händer via Monte Carlo). **Färdplan i `docs/bot-hjarna.md`.**
Trappan (test-låst, FACIT FÖRE FIX):
- **Steg 1 ✅ KLAR & live** — ärlig stickföring i `play-bot.ts`: cash:a säkra
  vinnare, kryp aldrig under. 1a (sang+trumf) + 1b (sidofärg när trumfen är
  räknad via `card-counting.ts`: `unseenTrumpCount`). Testsvit 659.
- **Steg 2 ✅ KLAR & live** — hand-modellen `hand-model.ts` (ryggraden):
  tolkar auktionen till HP-spann + färglängder + renonser per plats. Del 1
  (HP-liggare), del 2 (längder), del 3 (svaga öppningar + svararens golv 6+/12+).
  Testsvit 680.
- **Steg 3 ✅ KLAR & live** (2026-07-01, testsvit 697) — **Monte-Carlo-DDS**
  (`monte-carlo.ts`). **3a** `sampleLayouts` delar ärligt ut de osedda korten till de
  två dolda händerna så varje giv stämmer med hand-modellen (renonser/längd/HP,
  skärpt av redan spelade kort per plats). **3b** `chooseCardMonteCarlo` kör DDS
  ärligt på sampeln och röstar fram kortet med bäst snitt (max stick åt spelföraren,
  min som motspelare). **3c** `botCardSmart` (`play-bot.ts`) inkopplad i `Play.tsx`:
  MC i slutspelet (≤7 kort, seedad ur auktionen + `shownVoids`), annars tumregler
  (öppningsutspel / tung giv / ett-lagligt-kort → fallback, tidigt spel orört).
  Bevisat: 6-korts-slutspel 2→3 stick, facit nått utan tjuvkik.
- **NÄSTA (välj):** **signalavkodning** (FAS 11 pt 50 – motspelaren läser partnerns
  markering → in i hand-modellen), **"Varför?"-knapp** (botten förklarar draget),
  eller **tänj MC-fönstret** tidigare (ev. webworker för DDS). pt 47–49 (utspel/
  UDCA/Lavinthal): facit-granska `signals.ts` mot §8. pt 51 DDS-gräns = bekräfta bara.
**Scope (ägarbeslut 2026-07-01):** MED = "Varför?"-knapp (botten förklarar draget)
+ avancerad teknik (slutkast/inkast/squeeze). SENARE = svårighetsnivåer.

--- FAS 10 pushad (testsvit 644, commit 3208482) ---

**🎉 FAS 10 — Försvarsbud (§7) KLAR** (2026-07-01, testsvit 644).
Facit-granskning §7.1–7.6: alla verktyg (`overcalls.ts`, `doubles.ts`,
`lebensohl.ts`, `dont.ts`, `defense-conventional.ts`) lästa mot systemboken →
**svaren matchar facit**, väl testtäckta (overcalls 24, doubles 15,
defense-conventional 14, dont 7, lebensohl 6). **Byggd lucka:** `advanceTwoSuiter`
(`overcalls.ts`) – advancerns svar på partnerns tvåfärgsinkliv (Michaels / ovanlig
2NT), som saknades helt. **Ägarbeslut 2026-07-01:** preferens till den av partnerns
visade färger advancern är längst i (lika längd → högfärgen); **aldrig pass ostört**;
contested → pass tillåtet (partnern rebjuder sin ospecificerade färg; Michaels över
högfärg utan hf-fit → ostört 3♣ pass-eller-rätta). Facit i `overcalls.test.ts`.

--- FAS 9 pushad (testsvit 635, i commit 3208482) ---

**🎉 FAS 9 — Passad hand: Drury KLAR** (2026-07-01, testsvit 635, pushad).
Facit-granskning §6.7: Drury-basen (`responses-drury.ts`) matchar systemboken exakt
(2♣ = 3 trumf, 2♦ = 4+ trumf, 10–12 hp; öppnarens 2M signoff / 3M utgångsförsök /
4M utgång). **Byggd lucka (auktionen dog förut):** `responderAnswerDrury` –
svararens (passade handen) placering efter öppnarens Drury-återbud, inkopplad i
`responderSecondBid` (`responder-rebids.ts`). **Ägarbeslut 2026-07-01:** accepterar
3M-utgångsförsöket med **stödpoäng ≥ 11** (`pointsWithFloor(..., 'support')`, samma
`max(hp, dummyPoints)`-omvärdering som Steg B/C – 4+ trumf + korta sidofärger lyfter
toppen av 10–12), annars pass; 2M-signoff / 4M-utgång passas alltid. Sidoeffekt:
signoff-auktioner stängs nu med svararens pass (`1♥–2♣–2♥–P`) i stället för att
lämnas öppna. E2e `1♥–2♦–3♥–4♥`. Facit i `responses-drury.test.ts`.
**NÄSTA:** flytta upp NÄST → **FAS 10 (Försvarsbud)** blir nästa NU – låt ägaren
bekräfta. (Slam-quirken = 🅿️ PARKERAT, jaga aldrig.)

--- FAS 8 (testsvit 630, pushat) ---

**🎉 FAS 8 — Slamsystem KLAR** (2026-07-01, testsvit 630). Punkt 1 (MSS-slam) +
facit-granskning §6.1–6.5 (testsvit 621) + punkt 2 (Gerber över 2NT) + punkt 3
(Exclusion när renons rankar över trumf) — allt pushat (commit `340028a`).

FAS 8 klart (facit + `npm test`, testsvit 630):
- ✅ **Punkt 3 Exclusion när renons rankar över trumf** (2026-07-01): nivåbailen
  (`voidSuit >= trump → null`) borttagen ur `exclusionInvestigation`
  (`slam-auction.ts`). Enda inkopplade fallet är **hjärter trumf + spaderrenons →
  5♠** (lagligt över 3NT-relät). Öppnarens högsta stegsvar (steg 4) landar på
  exakt **6♥**; vill svararen bara ha lillslam **passar** hon (i stället för att
  olagligt bjuda om 6♥). Storslam-grenen bjuder 7♥ som förut. E2e
  `1H–3♠–3NT–5♠–6♥–7♥`. Facit i `slam-auction.test.ts`.
- ✅ **Punkt 2 Gerber över 2NT** (2026-07-01): `gerber2NTInvestigation` (`nt-slam.ts`),
  inkopplad i `auction.ts` som 2NT-blocket (speglar 1NT-Gerber-blocket). En
  balanserad slamsäker svarare (**13+ hp** mittemot 20–21 ≈ 33+) frågar ess med
  **4♣ Gerber** i stället för att blint blåsa 6NT: stannar i 4NT om två ess saknas,
  6NT med ett ess ute, storslam 7NT via 5♣-kungfrågan (≈37+). 11–12 stannar som
  kvantitativ 4NT (`respondTo2NT`, orört). Delad `buildGerberSequence` med
  1NT-grenen. E2e `2NT–4♣–4♠–6NT`. Facit i `nt-slam.test.ts`.
- ✅ **Punkt 1 MSS-slam** (2026-07-01): slamfortsättning efter `1NT–2♠–3♣/3♦`
  (minorfit garanterad). Ny `mssMinorFitContinuation` (`slam-auction.ts`),
  inkopplad i `auction.ts`; döda 4-minor-grenen bort ur `responder-rebids.ts`.
  **Ägarbeslut: NT om säkert, annars minor.** NT-säkert (alla hf har A/K/Q +
  ingen svararrenons) → 6NT (33–36) / 7NT (37+), för svagt → 3NT. NT osäkert
  (gapande hf / renons) → minor-slam via `slamInvestigation` (cue→RKC→6/7m), för
  svagt → 5m. Hela arsenalen (cue/RKC/Sjöberg). E2e `1NT–2♠–3♣–4NT–5♦–6NT`.
- ✅ **Facit-granskning §6.1–6.5** (2026-07-01): alla sex slamverktyg i `slam.ts`
  lästa mot systemboken → **inget fel i svaren**, koden matchar facit exakt (1430
  RKC, trumfdamfråga, cue-bud, Sjöbergs 5NT, Gerber ess/kung, Exclusion). Täppte
  två luckor i facit-LÅSNINGEN (tester): Gerber kungfrågan (3 grenar olåsta) +
  Exclusion steg 3–4. La till 6 facit-lås i `slam.test.ts`. Ingen kodändring.

--- FAS 6 + 7 (testsvit 612, ej pushat) ---

FAS 6 (facit + `npm test`):
- ✅ **26 Minor-regeln** verifierad + facit-låst (3-3♣/4-4♦/5-5♦/längsta minorn).
- ✅ **27 Inverterade minorer:** **svararens fortsättning byggd**
  (`responderRebidAfterInvertedMinor`) – auktionen dog förut vid öppnarens återbud.
  Placerar mot 3NT (2NT→3NT m. 11+, stopp-visning→3NT om täckt annars 5m, 3m
  minimum→3NT bara m. 13+ & båda hf stoppade, 3NT→pass). E2e `1♦–2♦–2NT–3NT`.
- ✅ **28 Svaga hoppskift** verifierade. **Ägarbeslut:** inget 1♦–3♣ (behåll 1NT).

FAS 7 (facit + `npm test`):
- ✅ **29 Svaga tvåor + 30 Ogust** verifierade (redan väl täckta).
- ✅ **31 Spärröppningar:** **öppnarens feature-visning byggd** (`rebid: feature`,
  maximum utan stöd visar yttre A/K). **Ägarbeslut:** svag stödhand pressar INTE
  (bara utgångsvärden höjer).
- ✅ **32 Regel 2-3-4 (ägarbeslut, öppningsstruktur):** kvalitetsgrind på
  spärröppningen (`topHonorCount` i `openings.ts`), sårbarhets-modulerad.
  Topphonnörer A/K/Q: 3-läget ej sårbar ≥1/sårbar ≥2; 4-läget valfri/≥1. Skräp
  spärrar aldrig. **12 HP-golvet orört.** Facit i `openings.test.ts`.

--- Historik ---
**🎉 FAS 5 NT-SYSTEMET KLAR (2026-07-01, testsvit 587, pushat+deployat).**
Punkt **19–25 klara**. FAS 5 var facit-granskning + luckor.
- ✅ **19 Stayman:** lagad inbjudnings-5-4-lucka (naturlig 2♥/2♠) + **garbage
  Stayman** (svag exakt 4-4 hf + kort klöver → 2♣, passar svaret). Ägarbeslut.
- ✅ **20 Smolen** verifierad. ✅ **22 Texas** verifierad.
- ✅ **21 Jacoby-transfer:** kärnan verifierad + **5-5-högfärgsschema** (ägarbeslut:
  transferriktningen kodar styrkan – svag→2♣, inbj→2♦→2♠, GF→2♥→3♥).
- ✅ **24 2NT-systemet:** turerna 1–3 verifierade + **svararens turn 4 byggd**
  (`responderRebidIn2NTAuction`: minorfit→utgång, ingen fit→3NT, Smolen över 2NT).
- ✅ **25 3NT-öppningen** verifierad.
- ✅ **23 Minor Suit Stayman:** svararens turn 4 byggd
  (`responderRebidIn1NTAuction`, case `Minor Suit Stayman`). Fit hittas alltid när
  öppnaren visar en minor (svararen har alltid 4+ i båda). Ägarbeslut: **3NT som
  standard**, höj minorn (`Minor Suit Stayman: höjning`) **bara med slamintresse
  ~16+**; ingen fit→3NT. Fortsatt cue/RKC + öppnarens 3♥/3♠-stopp & 4♣/4♦-max =
  **FAS 8**. Facit i `responder-rebids.test.ts`.

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
1. **Bot-hjärnan Steg 2** — hand-modellen (inferensmotor seedad ur auktionen).
2. **Bot-hjärnan Steg 3** — Monte-Carlo-DDS + signalavkodning (FAS 11 pt 50).
3. **FAS 12 — UI** (enligt felsökningsplanen) + "Varför?"-knapp (bot förklarar drag).

### ⚪ SENARE (oordnat — hämtas upp till NÄST en i taget)
- FAS 9 Passad hand · FAS 10 Försvarsbud · FAS 11 Kortspel · FAS 12 UI (allt
  enligt felsökningsplanen). Även TP-steg E (reverse/hoppskift på TP) + F
  (3:e/4:e-hands lättöppning) ur `docs/tp-arbetslista.md`.

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
