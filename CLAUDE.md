# CLAUDE.md — RebidZ (bridge-appen)
Läs den här filen först varje session. **Detta är kartan, inte detaljen** — all
detalj bor i `docs/` (börja i **`docs/README.md`**, som säger vilken fil som
svarar på vad).

## 🗺️ Projektkarta — NU / NÄST / SENARE / PARKERAT
> **Järnregel:** 🔵 NU innehåller **exakt en sak**. Inget annat rörs förrän den är
> klar. Kommer ägaren med en ny idé mitt i ett NU-jobb ska Claude **stoppa** och
> säga *"bra idé — men just nu är NU: X, den rör vi inte"*, och lägga idén i
> ⚪ SENARE. NÄST har max 3 saker. När NU blir klar: flytta upp en sak från NÄST,
> visa återstående punkter (regeln i `docs/arbetsrutiner.md`) och låt ägaren välja.

### 🔵 NU — Budgivningen mot perfekt · mönsterjakt i "billig offring"
**Ägarbeslut 2026-07-25.** Nästa post ur revisorns topplista: motståndarna får
offra för billigt / vi offrar själva fel (~125 givar, ~34 300 p i baslinjen).

**Arbetssätt (samma som etapp 3–5, facit-först):** hämta exempelgivarna ur
revisorn → hitta **MÖNSTREN**, inte enskilda givar → skriv facit-test som är RÖTT
före fixen → laga → grönt → DD-verifiera → hela sviten → kör om mätningen med
**samma frö** och kontrollera att posten krymper *utan* att andra poster växer →
fråga ägaren om PCD (push/commit/deploy).

```
$env:REVISOR='1'; npx vitest run src/lib/engine/revisor.probe.test.ts
```

**Ägarbeslut 2026-07-27: ordningen är hål 1 → 2 → 3 → mätning → hål 4** (hål 4
kräver ägarens omdöme och tas med exempelhänder). Förskanningen (2026-07-25)
hittade fyra hål — full tabell: `docs/systemrevisorn.md`, "Etapp 6 FÖRSKANNAD";
posten handlar **inte** om missade straffdubblingar utan om **utgångar och
slammar vi aldrig bjöd**:
1. ✅ **KLAR 2026-07-27** — stöddubblingen besvaras aldrig (5 givar, 1 470 p):
   svarsväg byggd (`answerSupportDouble`/`supportDoublerRebid` i doubles.ts),
   facit-test `auction-stoddubbling-svar.test.ts`, Mätning #15
2. ✅ **KLAR 2026-07-27** — svaret på upplysnings-X försvinner när RHO bjuder
   över (≥ 580 p): fri svarsväg + cue-svar + dubblarvakt
   (`advancerFreeBidAfterDouble`/`doublerAnswersCue`/`doublerRaisesAdvance`),
   facit-test `auction-upplysningsx-svar.test.ts`, Mätning #16
3. taket i försvaret mot svaga tvåor: balanserad 20-poängare passar ut 2♦ (~1 000 p) — **NÄSTA**
4. deras spärrbud stänger auktionen (16 givar, 5 720 p) — **kräver ägarens omdöme**

**Läget i spåret (Mätning #16, frö 20260721, 1 000 givar):** par-avvikelse
**300 → 278,7 p/giv**, rätt kontrakt **15,9 % → 17,8 %**. Topplista nu: missad
lillslam 56 920 > fel färg 51 840 > missad utgång 49 850 > missad storslam 36 470
> billig offring 32 390.

**Klart i spåret:** etapp 1 (felrapporter), etapp 2 (revisorn + baslinje), etapp 3
(fel färg, 6 fixar), etapp 5 (missad utgång, 3 fixar), etapp 4 (F1-resten: slam
efter 2♣ + reverse/hoppskift). Full logg: `docs/historik.md`. Alla mätningar +
mönsteranalyser: `docs/systemrevisorn.md`.

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
- **Advancern talar över deras höjning (2026-07-27):** när de bjuder över
  partnerns upplysnings-X svarar boten nu fritt (form får bjuda utan poäng, XX
  flys alltid) — väcker den för lätt, och känns dubblarens utgångströsklar rätt?
- **Stöddubblingen besvaras (2026-07-27):** svararen svarar nu alltid på stöd-X
  (pass = medvetet straffpass) — hamnar ni för högt på 4-3-utgångar, och känns
  straffpasset lagom vanligt?
- **Reverse/hoppskift (2026-07-25):** boten sätter utgången efter hoppskift och kan
  driva RKC mot visade 16/19 — bjuds tunna slammar för ofta?

### 🟢 NÄST (max 3, i ordning)
1. **B13 — öppnarens återbud efter inverterad minorhöjning:** dagens återbud är
   grova → ärliga slam-misser (`docs/budsystem-revision.md` B13).
2. **F2 — datadriven detektorkedja (E1):** underhållbarhet innan fler
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
gratis-hostat på Vercel. **Appen heter `RebidZ`** i gränssnittet (ägarens namn,
2026-07-02) — **repo och URL förblir `Learn-Bridge`** (medvetet, byt inte).
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

## Teknisk stack
React + Vite + TypeScript + Tailwind v4. Ingen backend, allt client-side.
Framsteg sparas i localStorage.

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

## Projektstruktur
- `src/main.tsx` startpunkt · `src/App.tsx` router (HashRouter) ·
  `src/index.css` (`@import "tailwindcss";`)
- `src/types/bridge.ts` — typerna (Card, Hand, Deal, BiddingQuestion), utgå alltid
  från dem · `src/lib/storage.ts` — localStorage
- `src/lib/engine/` — budmotorn + spelmotorn (störst: `auction*.ts`, `responses*.ts`,
  `rebids.ts`, `slam*.ts`, `overcalls.ts`, `play*.ts`, `dds.ts`, `revisor*.ts`)
- `src/components/` — `Layout`, `Panel`, `Button`, `SuitSymbol`, `HandView`, `Dialog`
- `src/pages/` — en fil per skärm (`Home`, `BiddingPractice`, `Learn`, `Play`,
  `Settings` m.fl.)
- `src/data/exercises/*.json` — övningar · `src/data/themes.json` — teman

## Navigering (router)
HashRouter (adresser med `#`) eftersom det fungerar på statisk hosting. **Byt INTE
till BrowserRouter** utan SPA-rewrites i `vercel.json`. Ny skärm = ny fil i
`src/pages/` + `<Route>` i `App.tsx` + länk i `NAV` i `Layout.tsx`.

## Hur man lägger till övningar
- JSON i `src/data/exercises/<tema>.json`; ny temafil måste importeras och läggas
  till i registret `EXERCISES_BY_THEME` (`src/lib/bidding.ts`).
- Hand som text: `"S:AK974 H:K83 D:Q6 C:J52"` (tian = `T`, tom färg = `-`, parsas av
  `parseHand`).
- En övning = `auction`: lista med steg — manus-bud `{ "bid": "1H" }` eller ditt
  beslut `{ "decision": { "options": [...], "answer": "1S", "explanation": "..." } }`.
  Vem som bjuder räknas ut från `dealer` + medurs N→E→S→W.
- Bud skrivs `"1C"/"1D"/"1H"/"1S"/"1NT"` samt `"P"`, `"X"`, `"XX"`.
- Lägen (scope): `opening`, `opening-response`, `full-auction` — sätts i
  themes.json.

## Kommandon
- `npm test` — hela testsviten (enda sanningen om testläget)
- `npm run dev` — lokal förhandsvisning
- `npm run build` — körs automatiskt av Vercel vid push, sällan manuellt

## Vad man INTE gör
- Lägg aldrig till backend/server/databas i nuläget — hostingen är statisk.
- Glöm aldrig Vite `base` = `/` (låst av vaktestet).
- Bygg inte alla budsystem på en gång — ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
- Pusha/deploya aldrig utan att fråga ägaren först.
