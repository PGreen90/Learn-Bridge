# CLAUDE.md — rebidz (bridge-appen)
Läs den här filen först varje session. **Detta är kartan, inte detaljen** — all
detalj bor i `docs/` (börja i **`docs/README.md`**, som säger vilken fil som
svarar på vad).

## 🗺️ Projektkarta — NU / NÄST / SENARE / PARKERAT
> **Järnregel:** 🔵 NU innehåller **exakt en sak**. Inget annat rörs förrän den är
> klar. Kommer ägaren med en ny idé mitt i ett NU-jobb ska Claude **stoppa** och
> säga *"bra idé — men just nu är NU: X, den rör vi inte"*, och lägga idén i
> ⚪ SENARE. NÄST har max 3 saker. När NU blir klar: flytta upp en sak från NÄST,
> visa återstående punkter (regeln i `docs/arbetsrutiner.md`) och låt ägaren välja.

### 🔵 NU — KÄNSLA I KORTSPELET (ägarbeslut 2026-07-28) · ETAPP 1–4 BYGGDA
Kortspelet kändes stelt och robotaktiskt — spåret ger det liv i **fem etapper**,
allt i UI-lagret (spelmotorn rörs INTE), inga nya beroenden. Ägarbesluten från
frågerundan 2026-07-28: full kortflygning hand→bord, sticksvep till vinnaren
(paus + vinnarglow), jämnt men justerbart tempo, claim-reveal (händerna visas
öppet), diskreta syntetiserade ljud (standard PÅ, toggle), ingen
utdelningsanimation, guldglow vid hemgång (inget konfetti).

**Etapperna:** 1) tempogrunden + key-fixen · 2) sticksvep + vinnarpaus ·
3) kortflygningen (FLIP) · 4) ljud · 5) claim-reveal + resultatövergång +
guldglow. Varje etapp: bygg → grind grön → ägaren tittar live → docs → nästa.

**✅ ETAPP 1–4 KLARA 2026-07-28** (full beskrivning per etapp:
`docs/historik.md` + `docs/status.md`):
- **1 · tempogrunden** (mergepunkt `e67fb31` + grindfix `9de46f9`): `tempo.ts`,
  temporad i ⋮-menyn, `--motion-scale`, MC-golv, key-fixen. Facit:
  `tempo.test.tsx`. Grindläxa: tidsgränser ska fånga hängningar, inte straffa
  långsamma maskiner (`maxWorkers: 4` + generösa timeouts).
- **2 · sticksvepet** (`1fed694`): vinnarglow-paus → svep mot vinnaren; botar/
  auto-claim/resultat väntar, klick hoppar över. Facit: `sticksvep.test.tsx`.
- **3 · kortflygningen** (`e602a01`): WAAPI-klon hand→stickplats
  (`useCardFlight.ts` + `FlightLayer.tsx`), källan mäts före `setPlay`, dolda
  händer startar från bordskanten, fallback = `card-in-*` (jsdom/reduced
  motion). Facit: `kortflygning.test.tsx`.
- **4 · ljuden** (`3762481`): tre syntetiserade Web Audio-ljud i `src/lib/sound.ts` (knäpp/
  svisch/giv-klar, inga ljudfiler), `armSound()` på pointerdown, "Ljud"-rad i
  ⋮-menyn (`learnbridge:sound`, standard PÅ). Facit: `ljud.test.tsx`.

**➡️ NÄSTA GÅNG BÖRJAR VI MED: etapp 5 — claim-reveal + resultatövergång +
guldglow** (sista etappen i spåret): `pendingClaim` i `usePlayTable.ts` (alla
händer visas öppet `ms('claimReveal')` innan resultatet, skipbar), mjuk
utfasning av bordet före resultatdialogen, engångs guldglow på dialogen vid
hemgång (sobert vid bet — inget konfetti). Detaljerna står i planen:
`~/.claude/plans/jag-skulle-vilja-ha-magical-stroustrup.md` på ägarens dator.
Efter etapp 5: kort avsnitt "Tempo, animationer och ljud" i `docs/kortspel.md`
+ spåret stängs — då väljer ägaren nästa NU ur NÄST/SENARE.

**Senast klart 2026-07-28 (sen kväll, ägarönskemål — inget NU):** Budstöd
På/Av-toggle i Spela korts ⋮-meny (`learnbridge:bidHelp`). Av = inga motorhintar
i budlådan + minimal förklaring (chip + regelnamn + ALERT) i auktionsvyerna.
Mergepunkt `3d43655`, live. Detalj: `docs/status.md` + `docs/historik.md`.

**Senast klart 2026-07-28 (kväll, felrapporter — inget NU):** #40 (17+ säljer
aldrig given över deras 1-lägesöppning, §7.1), #41 (sangsystemet inkopplat
off-book, §4.3) och #42 (kvantitativ höjning av partnerns naturliga 3NT, §6.8).
Kontrollmätning #19 (samma frö): par-avvikelse 276,34 → 276,49, rätt kontrakt
oförändrat 18,2 % — praktiskt taget platt. **Två fynd:** fix #42 träffade INTE
en enda botgiv (missad lillslam står stilla på 56 170 — posten är fortfarande
obearbetad), och fix #40 blottade ett nytt hål: den starka dubblaren säljer
given i rond 2 när hen saknar egen färg (frö 20260952, ÖV missade 7NT). Detalj:
`docs/systemrevisorn.md` Mätning #19 + `docs/bevaka.md`.

**Senast klart 2026-07-28 (underhåll, inget NU):** hälsokoll av uppsättningen →
namnet `rebidz` rättat på de fyra ställen användaren ser det, sessionskontexten
bantad, och **deploygrinden lagad — den var ett myntkast**: konsistenstesterna
körde på slumpgivar och hål 4:s undantag hade ett hål, så ungefär var tredje
deploy föll slumpvis oavsett vad som pushades (`ebdb958` föll så). Nu seedade
givar + `docs-vakt` 200× snabbare. Volymtester i det här repot ska ALLTID vara
seedade. Detalj: `docs/historik.md`.

**Senast klart 2026-07-25:** dokumentstädningen (denna fil bantad, `docs/README.md`
+ `docs/bevaka.md` + `docs/senare.md` nya) och därefter **den stora genomgången**:
hela repot faktakollat mot koden i stället för mot andra dokument. Fynd: en
baslinjesiffra som aldrig gick att reproducera hade blivit en arbetsregel, ett
dokument beskrev en raderad komponent, och **Lebensohl visade sig aldrig ha varit
inkopplad**. Skyddet mot att det upprepas ligger nu i testsviten
(`src/docs-vakt.test.ts` + regelsvepet). Detalj: `docs/historik.md`.

> **ÄRLIGA SLAMPORTAR (2026-07-07, LIVE — grundprincip som styr ALLA slam-vägar):**
> bottarna bjuder som människor — egen hand + partnerns **VISADE** intervall, aldrig
> partnerns faktiska kort; hellre systemriktig miss än kik. Kaptensregeln: ≥33 driv /
> 31–32 inbjudan mot visat minimum; ingen kontrollkoll (ägarbeslut); storslam kräver
> visshet. Detalj: budsystem.md §5.2/§5.7/§6 + `docs/historik.md`.

### 👀 Bevaka i spel — de tre senaste
> Hela listan (nyast först): **`docs/bevaka.md`**. Läs den när ägaren
> säger att något känns fel i spel, eller när en ny fix ska läggas till.
- **17+ säljer aldrig given över deras 1-lägesöppning (#40, 2026-07-28):** en
  17+-hand utan fönster dubblar i stället för att passa (typfall: enda
  långfärgen är öppnarens egen) — dubblar bottarna för ofta med LÄNGD i deras
  färg? **Känt hål i rond 2:** den starka dubblaren kan sälja given i nästa
  rond (M19, frö 20260952) — detaljer i `docs/bevaka.md`.
- **Sangsystemet gäller även off-book (#41, 2026-07-28):** bjuder du 1NT själv i
  budlådan svarar partnern nu enligt §4.3 (2♠ = Minor Suit Stayman, aldrig
  naturligt) — läser motorn dina bud som du menade dem?
- **Kvantitativ höjning av 3NT (#42, 2026-07-28):** har partnern öppnat och
  placerat 3NT höjer kaptenen till 6NT med 21+ hp — hamnar ni i 6NT som går bet?

### 🟢 NÄST (max 3, i ordning)
1. **ETAPP 7: MISSAD LILLSLAM (pausad 2026-07-28 för känslo-spåret, läget
   bevarat):** topplistans största post, 83 givar / 56 170 p, FÖRSKANNAD (hela
   mönsteranalysen + ordningsförslaget: `docs/systemrevisorn.md` "ETAPP 7
   FÖRSKANNAD"). Hål 1 (minimum-märkningen) KLART — Mätning #20: par-avvikelse
   276,49 → 271,38, rätt kontrakt 18,2 → 18,7 %, −5 110 p, noll regressioner
   (facit: `auction-lillslam-aterbudsstyrka.test.ts`). **Återupptas med: ägaren
   väljer hål 2** — närmast till hands hål B "3NT-stoppen" (~15 givar, vuxen
   sedan hål 1 lyfte fem givar dit; systerfallet till felrapport #42). Kända
   fynd: 75 av 83 pass saknar regel (nakna `{ bid: 'P' }`); 57 givar når
   systemets egen slamport (taksiffra, ej prognos); mekanisk bugg i rebids.ts
   ("rebjuden färg" graderar inte styrka, 7 givar / 6 810 p, kräver inget
   ägarbeslut). Verktyg (gated): `$env:DUMP_CAT='missad-lillslam'` resp.
   `$env:FORSKAN='1'` + probe-testerna; mätningen: `$env:REVISOR='1'; npx
   vitest run src/lib/engine/revisor.probe.test.ts` (samma frö 20260721).
   Arbetssättet (facit-först, mönster inte enskilda givar) + hela
   mätspårsloggen: `docs/historik.md` + `docs/systemrevisorn.md`.
2. **B13 — öppnarens återbud efter inverterad minorhöjning:** dagens återbud är
   grova → ärliga slam-misser (`docs/budsystem-revision.md` B13).
3. **F2 — datadriven detektorkedja (E1):** underhållbarhet innan fler
   konkurrenskonventioner läggs på `decideCall`-kedjan.

### ⚪ SENARE (rubriker — full beskrivning i `docs/senare.md`)
**Koppla in Lebensohl** (byggd men aldrig inkopplad, upptäckt 2026-07-25) ·
Felrapport #36 större kort på mobil · fler budträningsgivar + tema-dropdown ·
spelmotor-kvalitet (#32 spelföring + #34 försvar) · TP till §7-inkliven ·
advancer-rabatt efter balansering (generella fallet) · 17+ enfärgshand efter två
bjudna färger · auto-facit på hela given i webworker · kanoniska linjen passar ut
tvåfärgsinkliv · svårighetsnivåer på bottarna · bot-hjärnans B2/Steg C · bredare
försvarsinferens.

### 🅿️ PARKERAT (väg INTE in i beslut — full beskrivning i `docs/senare.md`)
**FACELIFTEN / hela designspåret** (parkerad 2026-07-20 på ägarbeslut — återupptas
bara när ägaren säger till) · DDS-facit på tunga fulla givar · off-book §7 bredd ·
"framkalla slutbud"-väljaren · Mathe mot stark konstgjord 1♣ · **Beslut B**
(konton/multiplayer/tävlingar — separat STORT spår, `docs/framtid-multiplayer-
plattform.md`, startas bara på uttryckligt ägarbeslut).

## Arbetsrutiner (följ varje gång)
- **Vid sessionsstart:** följ 🟢-checklistan i `docs/arbetsrutiner.md`.
- **Vid sessionsslut:** följ 🔴-checklistan i `docs/arbetsrutiner.md`.
- **Sifferregeln:** en siffra får stå i ett levande dokument bara om kommandot
  som återskapar den står bredvid. Enda sanningen om testläget: kör `npm test`.
  Bakgrunden (och varför den gamla regeln var farlig) står i
  `docs/arbetsrutiner.md`. Vakten `src/docs-vakt.test.ts` kör i deploygrinden.

## Vad det här är
Interaktiv webbapp för att lära sig och spela bridge. Allt körs i webbläsaren,
gratis-hostat på Vercel. **Appen heter `rebidz` i gränssnittet — ALLTID GEMENER**
(ägarens namn 2026-07-02, bekräftat 2026-07-28: "gemener rakt igenom"; skriv
aldrig "RebidZ") — **repo och URL förblir `Learn-Bridge`** (medvetet, byt inte).
- **Designriktning (låst):** Synrey-inspirerat uttryck, **emerald-palett**, egen
  stil tillåten bortom Synrey. **Spader är SVARTA** (ägaröverride — ändra INTE
  tillbaka till konventionell färg). Läs de verkliga färgerna i `src/index.css`,
  anta dem inte.

## Vem jag bygger för
Ägaren är nybörjare utan programmeringsbakgrund.
- Förklara på enkel svenska. Inga tekniska termer utan förklaring.
- Ett steg i taget. Vänta på bekräftelse innan du går vidare.
- När ägaren måste göra något själv (klicka, logga in, godkänna): säg exakt var
  och vad.
- Du skriver ALL kod. Ägaren läser den inte. Optimera för korrekthet och för att
  DU lätt ska kunna underhålla den över tid.
- Ägaren vill ge **mänsklig input i konkreta budsituationer** — fråga hellre än
  gissa.
- Säg aldrig "monster" om en bra hand (ägarbeslut 2026-07-05) — skriv "stark hand".

## Hosting & deploy (viktiga låsningar)
- **Vercel**, projekt `learn-bridge`, team `rebidz` (Hobby/gratis), kopplat till
  GitHub via Vercels app → **auto-deploy vid varje push till main**. Ägaren kör
  ALDRIG bygg-kommandon själv. Live: **https://rebidz.com**.
- **Test-/typgrind före live:** `vercel.json` kör `npx tsc && npm test && npm run
  build`. Rött test → bygget failar → ingen publicering. **Ändra aldrig bort den
  grinden** — den är enda automatiska skyddet mellan koden och det som blir live.
- **Vite `base` MÅSTE vara `/`** (Vercel serverar från roten), annars blir sidan
  blank. Låst av vaktestet `src/deploy-config.test.ts`.
- **Rollback:** varje funktion mergas med egen `--no-ff`-mergepunkt → backa med
  `git revert -m 1 <merge-sha>`. Vad som ligger live = senaste **Ready**-deployen i
  Vercel-dashboarden; det finns ingen tag i repot.
- GitHub Pages-workflowen (`.github/workflows/deploy.yml`) är **inaktiverad**
  (`workflow_dispatch`-endast, filen kvar som referens).
- Ingen server/databas/backend i nuläget (planeras separat, se framtidsdoket).

## Bridge-specifikt
- Budsystem: **2 över 1 (2/1)**, endast detta. Bygg inte flera system på en gång.
- **Målgrupp (2026-06-30): erfaren spelare** — en pålitlig, robust 2/1-partner och
  motståndare (inte nybörjarträning först).
- Givar och övningar ligger som **JSON i repot**, aldrig hårdkodade i komponenter.
- **Utgå alltid från typerna** i `src/types/bridge.ts` (Card, Hand, Deal,
  BiddingQuestion) — hitta inte på egna parallella former.
- **Double-dummy:** appens facit körs av vår **egen lösare i ren TypeScript**
  (`src/lib/engine/dds.ts`, inga beroenden — de utvärderade npm-paketen var
  trasiga i webbläsaren). Systemrevisorn använder däremot `bridge-dds` (WASM) som
  **dev-beroende** för mätningar. Full bakgrund: `docs/arbetslista.md` punkt 28.
- **Handvärdering:** HP/TP/stödpoäng/Bergen/spelstick — se `docs/handvardering.md`.
  **Låst regel:** en **12 HP-hand öppnar alltid** — TP får aldrig *nedgradera* en
  öppningshand, bara uppgradera (bra 11:a öppnar) och nudga sang. TP-stegen A–F är
  färdigbyggda (`docs/tp-arbetslista.md`).
- **Spelstick (2026-07-01):** `playingTricks` i `evaluation.ts` — en hand med
  **≥ 8½ spelstick öppnar 2♣** även med HP < 22, så starka fördelningshänder inte
  tolkas som minimum.

## Budmotorn — innan du rör budlogik
- Motorn har **tre auktionslager**. Läs "Budmotorns tre auktionslager +
  `open`-handoff" i **`docs/status.md`** — den avgör var ny logik hör hemma:
  - `auction.ts` — **on-book**, den kanoniska linjen (generativ)
  - `auction-live.ts` — **konkurrens/off-book** (budlådan, `decideCall`)
  - `auction-interpret.ts` — **förklaringen** av ett bud
- Allt byggs **test-drivet** (`npm test`), facit-testet skrivs FÖRE fixen.
- **Varje regeländring måste skrivas in i `docs/budsystem.md`** i läsbar
  paragraf-form — appens Budsystem-sida renderar den filen live för ägaren.
  §9 är ändringsloggen (visas inte på sidan).
- Systemets hälsobild + körordning F1–F6: `docs/budsystem-revision.md`.
  Byggordning/arkiv: `docs/arbetslista.md`.

## Konkreta fakta (deploy & miljö)
- GitHub-repo: **PGreen90/Learn-Bridge** (publikt). Repo-namnet byts INTE.
- Reserv-URL: `learn-bridge-topaz.vercel.app`. Gamla
  `pgreen90.github.io/Learn-Bridge/` är ur bruk.
- `gh` CLI är inloggad som PGreen90 och är git credential helper → pusha via
  `git push`. **Fråga alltid ägaren före push/commit/deploy.**
- Node.js ligger i `C:\Program Files\nodejs\` (lägg först i PATH i nya shells —
  npm/node finns inte alltid på PATH automatiskt).

## Navigering (router)
HashRouter (adresser med `#`) eftersom det fungerar på statisk hosting. **Byt INTE
till BrowserRouter** utan SPA-rewrites i `vercel.json`. Ny skärm = ny fil i
`src/pages/` + `<Route>` i `App.tsx` + länk i `NAV` i `Layout.tsx`.

## Vad man INTE gör
- Lägg aldrig till backend/server/databas i nuläget — hostingen är statisk.
- Glöm aldrig Vite `base` = `/` (låst av vaktestet).
- Bygg inte alla budsystem på en gång — ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
- Pusha/deploya aldrig utan att fråga ägaren först.
