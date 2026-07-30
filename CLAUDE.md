# CLAUDE.md — rebidz (bridge-appen)
Läs den här filen först varje session. **Detta är kartan, inte detaljen** — all
detalj bor i `docs/` (börja i **`docs/README.md`**, som säger vilken fil som
svarar på vad).

## 🗺️ Projektkarta — NU / NÄST / SENARE / PARKERAT
> **Järnregel:** 🔵 NU innehåller **exakt en sak**. Inget annat rörs förrän den är
> klar. Kommer ägaren med en ny idé mitt i ett NU-jobb ska Claude **stoppa** och
> säga *"det hör hemma i SENARE — just nu är NU: X, den rör vi inte"*, och lägga idén i
> ⚪ SENARE. NÄST har max 3 saker. När NU blir klar: flytta upp en sak från NÄST,
> visa återstående punkter (regeln i `docs/arbetsrutiner.md`) och låt ägaren välja.

### 🔵 NU — LEDIGT (2026-07-30): ägaren väljer nästa ur NÄST/SENARE
**FELRAPPORT #34 — FÖRSVARET SPELAR TREDJE HAND HÖGT i sang: KLAR 2026-07-30**
(Fas 0 a, ännu ej pushad). Motpolen till #32: la förr billigaste vinnaren även när
den DOLDA spelföraren spelade efter (Nord ♥5 ur ♥KJ1065 → Öst vann gratis på ♥9).
Ny gren `thirdHandHonor` (`play-bot.ts`): försvarare i sang, partnern ledde, bara
spelföraren bakom → lägg din **lägsta honnör** (spar gaffeln över hans kung). Bara
sang (trumf-regression bortmätt). Facit `play-bot-third-hand.test.ts` (DDS-låst
högt=1/lågt=2); netto neutralt 374→374/40 givar, given DDS-bevisat lagad. Detalj:
`docs/historik.md` + `docs/bot-hjarna.md` + `docs/budsystem.md §8.6`.

**KONKURRENSPLANEN SKRIVEN 2026-07-29 (ägarbeslut — planering, inget bygge):**
rebidz ska på sikt konkurrera med BBO/Funbridge/Synrey. Vägval: **Funbridge-
modellen först** ("Dagens givar" — alla spelar samma givar mot bottarna,
topplista; realtidsbord sist), **faceliften VÄCKT** ur parkeringen (= Fas 1),
**två språk** (svenska först, engelska = Fas 5). Roadmap Fas 0–6 + hälsobilden:
**`docs/konkurrensplan.md`**. Beslut B (backend, Fas 2+) byggs fortfarande bara
på uttryckligt ägarbeslut.

**FELRAPPORT #32 — SPELFÖRAREN ETABLERAR LÅNG FÄRG i sang: KLAR & LIVE 2026-07-29**
(konkurrensplanens Fas 0 a, mergepunkt `b5c2913`). Boten knäcker motståndarnas
spärr i sin långa färg FÖRE den cashar sidoessen (`establishLongSuit` i
`play-bot.ts`, bara sang — i trumf etableras färg via ruff). Facit
`play-bot-establish.test.ts` (DDS-låst 3→7); netto +8 stick/40 givar
(`play-establish.probe`, `ESTABLISH=1`). Detalj: `docs/historik.md` +
`docs/bot-hjarna.md`.

**RONDGENOMGÅNGEN (after action report) är KLAR & LIVE 2026-07-29** — efter
färdigspelad giv i Spela kort öppnar "Rondgenomgång"-knappen tre hopfällbara
kapitel: Budgivningen (varje bud förklarat), Spelföringen (varje stick som egen
dropdown med korten i väderstrecken, utspelsregler §8.3 och botmotiveringar vid
tryck) och Resultatet (öppet först: utfall, poäng, claim-notis och DD-domen
"med perfekt spel fanns N stick", räknad i webworker med ärlig
budgetdegradering). Fyra etapper, ren motormodul + UI-lager, spelmotorn orörd.
Mergepunkt: `a28ff5e`. Detalj: `docs/kortspel.md` "Rondgenomgången" +
`docs/status.md`; etapplogg: `docs/historik.md`.

**MARKERINGAR (försvarssignaler) KLAR & LIVE 2026-07-29** — botarna LÄGGER
UDCA-attityd/räkning + Lavinthal i motspelet (gardregeln: behåll de två högsta så
en markering aldrig blir en blunder), rondgenomgången FÖRKLARAR allas markeringar,
och botarna LÄSER avskräckningsmarkeringar (HP-tak i Monte-Carlo). Sex etapper,
spelmotorn orörd. Mätrigg `play-quality.probe` (gatad, `PLAYQ=1`). Mergepunkt
`b66c6ee`. Detalj: `docs/budsystem.md §8.5` + `docs/bot-hjarna.md`.

**➡️ NÄSTA GÅNG:** ägaren väljer nytt NU. Fas 0 a (botspelet) har nu båda kända
felrapporterna lagade (#32 spelföring + #34 försvar), så rekommendationen flyttar:
**faceliften (Fas 1)** eller **mobilen #36 (Fas 0 b)** — första intrycket inför
Dagens givar — eller 🟢 NÄST punkt 1 (Etapp 7, hål 2). Kvar i spelkvalitetsspåret
(⚪ SENARE): tredje hand högt även i **trumf**, tredje-hand-nyanser bortom lägsta
honnören, samt signalspåret (avkoda räkning/paritet + uppmuntran).

**Senast klart 2026-07-28 — KÄNSLA I KORTSPELET (etapp 1–5), KLART & LIVE:**
tempoval (Lugn/Normal/Snabb), sticksvep med vinnarglow, kortflygning hand→bord,
syntetiserade ljud (På/Av) och claim-reveal utan timer. Allt i UI-lagret,
spelmotorn orörd. Detalj: `docs/kortspel.md` "Tempo, animationer och ljud".

**Senast klart 2026-07-28 (sen kväll, ägarönskemål — inget NU):** Budstöd
På/Av-toggle i Spela korts ⋮-meny (`learnbridge:bidHelp`). Av = inga motorhintar
i budlådan + minimal förklaring (chip + regelnamn + ALERT) i auktionsvyerna.
Mergepunkt `3d43655`, live. Detalj: `docs/status.md` + `docs/historik.md`.

**Senast klart 2026-07-28 (kväll, felrapporter — inget NU):** #40 (17+ säljer
aldrig given, §7.1), #41 (sangsystemet off-book, §4.3), #42 (kvantitativ
3NT-höjning, §6.8). Kontrollmätning #19 platt; känt hål kvar: starka dubblaren
säljer given i rond 2 utan egen färg (frö 20260952). Detalj:
`docs/systemrevisorn.md` M19 + `docs/bevaka.md`.

**Senast klart 2026-07-28 (underhåll, inget NU):** hälsokoll av uppsättningen →
namnet `rebidz` rättat på de fyra ställen användaren ser det, sessionskontexten
bantad, och **deploygrinden lagad — den var ett myntkast**: konsistenstesterna
körde på slumpgivar och hål 4:s undantag hade ett hål, så ungefär var tredje
deploy föll slumpvis oavsett vad som pushades (`ebdb958` föll så). Nu seedade
givar + `docs-vakt` 200× snabbare. Volymtester i det här repot ska ALLTID vara
seedade. Detalj: `docs/historik.md`.

> **ÄRLIGA SLAMPORTAR (2026-07-07, LIVE — grundprincip som styr ALLA slam-vägar):**
> bottarna bjuder som människor — egen hand + partnerns **VISADE** intervall, aldrig
> partnerns faktiska kort; hellre systemriktig miss än kik. Kaptensregeln: ≥33 driv /
> 31–32 inbjudan mot visat minimum; ingen kontrollkoll (ägarbeslut); storslam kräver
> visshet. Detalj: budsystem.md §5.2/§5.7/§6 + `docs/historik.md`.

### 👀 Bevaka i spel — de tre senaste
> Hela listan (nyast först): **`docs/bevaka.md`**. Läs den när ägaren
> säger att något känns fel i spel, eller när en ny fix ska läggas till.
- **Försvaret spelar tredje hand högt i sang (#34, 2026-07-30):** ledde partnern
  och en motståndare vann just nu, lägger boten sin LÄGSTA honnör (tvingar fram
  spelförarens) i stället för ett lågt spotkort. Lägger den honnör där lågt var
  bättre — t.ex. med en gaffel den borde behållit hel? (Bara sang; i trumf lågt
  som förr.)
- **Spelföraren etablerar lång färg i sang (#32, 2026-07-29):** boten knäcker nu
  motståndarnas spärr i sin långa färg FÖRE den cashar sidoessen. Ger den ibland
  ifrån sig ledningen i fel läge — attackerar långfärgen när den borde casha hem
  kontraktet direkt? (Bara sang; i trumf ruffar den fram färgen som förr.)
- **17+ säljer aldrig given över deras 1-lägesöppning (#40, 2026-07-28):** en
  17+-hand utan fönster dubblar i stället för att passa (typfall: enda
  långfärgen är öppnarens egen) — dubblar bottarna för ofta med LÄNGD i deras
  färg? **Känt hål i rond 2:** den starka dubblaren kan sälja given i nästa
  rond (M19, frö 20260952) — detaljer i `docs/bevaka.md`.

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
**FACELIFTEN** (väckt 2026-07-29 ur parkeringen → Fas 1 i `docs/konkurrensplan.md`) ·
**Koppla in Lebensohl** (byggd men aldrig inkopplad, upptäckt 2026-07-25) ·
Felrapport #36 större kort på mobil (Fas 0) · fler budträningsgivar + tema-dropdown ·
spelmotor-kvalitet (#32 + #34 KLARA; kvar: tredje hand högt i trumf + nyanser) · engelska som andra
språk (Fas 5) · TP till §7-inkliven · advancer-rabatt efter balansering
(generella fallet) · 17+ enfärgshand efter två bjudna färger · auto-facit på
hela given i webworker · kanoniska linjen passar ut tvåfärgsinkliv ·
svårighetsnivåer på bottarna · bot-hjärnans B2/Steg C · bredare försvarsinferens.

### 🅿️ PARKERAT (väg INTE in i beslut — full beskrivning i `docs/senare.md`)
DDS-facit på tunga fulla givar · off-book §7 bredd · "framkalla slutbud"-väljaren ·
Mathe mot stark konstgjord 1♣ · **Beslut B** (konton/multiplayer/tävlingar —
separat STORT spår; roadmapen mot det: `docs/konkurrensplan.md` Fas 2–6, tekniken:
`docs/framtid-multiplayer-plattform.md`; BYGGS bara på uttryckligt ägarbeslut).

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
- **Kritisk motpart, inte medhållare:** säg emot när en idé är svag och motivera
  varför, var ärlig om egna fel, rikta kritiken dit det gäller. Men var kalibrerad:
  säg lika tydligt när ägaren har rätt. Ingen kritik för sakens skull.

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
