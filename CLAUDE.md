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

### 🔵 NU — SPELDIAGNOSEN (ägarbeslut 2026-08-12): bottar som spelar, felsöker & rapporterar

**RIGG STEG 1–7 BYGGD 2026-08-12** — allt i **`docs/speldiagnos.md`** (läs den
FÖRST): helgivsspelaren `spela-giv.ts` · per-kort-DD-facit (`analyseSpel`) ·
speldomen `speldom.ts` · proben (`SPELDIAG=1`, frö 20260721 = M-seriens
universum) · repro-dumpen (`DUMP_SPEL`) · tävlingsförscreeningen
(`TAVLING_DIAG`; `DAILY_SEED_SECRET` i `.env.local` — ALDRIG i spårade `.env`)
· `/speldiagnos`. **Princip (ägaren): RÄTT, inte max antal stick** — DD-larm
är kandidater; klassningen systemfel/ärlig miss/oklart görs i `/speldiagnos`;
bara systemfel lagas, efter ägarens ja. **KVAR:** hemligheten till
`.env.local` (ägarsteg) · S0-baslinjen · första diagnosrapporten.

---

**TÄVLINGEN KLAR & LIVE (2026-08-11/12):** etapp 2-kedjan komplett (konton →
topplista/matchpoäng, testkonton städade) · tävlings-UI:s 6 polishsteg +
server-driven framsteg + mobil-städ · "spela given igen" (övning, a24a369).
**MP är STANDARD (topp=100 %, snitt 50 %) — ändra INTE.** Detalj:
[[beslut-b-etapp2-progress]], [[tavling-ui-polish]],
[[spela-given-igen-ovningslage]] + `docs/historik.md` 2026-08-11/12.

---

**BESLUT B ETAPP 0: förberedelser utan backend (2026-08-08) — KLAR, historik nedan**
**MASTERPLANEN SATT (2026-08-08, ägarbeslut — "kör" på Beslut B-planeringen):**
rebidz byggs mot konton → daglig 12-givarstävling → realtidsbord (valfri mix
människor/bottar). HELA planen — etapper 0–4, beslutsgrindarna, GDPR/säkerhet
— bor i **`docs/beslut-b-plan.md`** (läs den FÖRST vid allt Beslut B-arbete).
Beslut tagna: Supabase BEKRÄFTAD · klassiska lösenord (ägarval) · EN
12-givarstävling först · tävlingarna före borden. Stående regel: vid varje
etappslut stannar Claude, visar läget och tar grindbesluten med ägaren.

**ETAPP 0 KLAR (2026-08-09, ingen backend — beteendet oförändrat, +10 facit):**
slumpinjektion (`rng` genom Monte-Carlo i `monte-carlo.ts`/`play-bot.ts`, default
Math.random), Europe/Stockholm-tidszon i `daily.ts` (DST-säker), backend-sömlagret
`src/lib/backend/` (11 sidor omkopplade, synkront nu/async i etapp 1), PWA-vakt för
`/api/*` (låst i `deploy-config.test.ts`), `api/health.ts` (första Vercel-funktionen,
live; `tsconfig` täcker `api/`). **Fynd:** motorn kan INTE importeras rått i en
Vercel-funktion — dess extensionless-importer kräver bundling (esbuild) → görs i
etapp 2. **NÄSTA = grind 0→1:** Supabase-projektet
skapas först på ägarens uttryckliga "kör" (etapp 1 konton, `docs/beslut-b-plan.md`).

**FAS 1 FACELIFTEN — YTA 1–4 KLARA (2026-07-31→08-02):** startsidan,
Synrey-bordet telefon-först, budlådan, de inre sidorna — och **DAGENS GIV**
(datumfröet `daily.ts`, Wordle-delning; förtitt på Fas 3 utan backend). Nästa
yta väljs av ägaren. Detalj: `docs/konkurrensplan.md` Fas 1/Fas 3.

**KONKURRENSPLANEN (2026-07-29, ägarbeslut):** rebidz konkurrerar med
BBO/Funbridge/Synrey; Funbridge-modellen först, sv→en (Fas 5). Roadmap +
hälsobild: **`docs/konkurrensplan.md`**.

**Klart 2026-07-29→08-03 (detalj i `docs/historik.md`):** etapp 7 hål 2
"3NT-stoppen" (§6.9) · Lebensohl efter vårt 1NT lager 1 (§7.5; kvar: takeout-X,
slow shows, cue-Stayman) · #34 tredje hand högt i sang (§8.6) · hela FAS 0
(404, route-split, kortrad, säkra zoner) · felrapport #32 + markeringarna
(§8.5) · stora granskningen 26 fynd + etapp A–D (skjutet: par-poäng).

**CUE-BUD ÅTERINFÖRDA (2026-08-03, river 2026-07-07): KLAR ETAPP.** Kontrollbud
ska ALLTID finnas ([[cue-bids-reinstated]]): vid **utgång etablerad (GF) + agreed
trumf** cue:ar motorn fritt under utgång; poängomdömet ligger på att gå FÖRBI
utgången. `cueSlamAuction` (`slam-auction.ts`), inkopplat Jacoby 2NT + NMF +
(via B13) inverterad minor + 2♣. **Kvar (eget beslut):** off-book-igenkänning
av din cue; öppnarens 18–19 i Jacoby. Detalj: `docs/historik.md` 2026-08-03.

**UTSPELET (2026-08-04): HÅL A–G KLARA (§8.3/§9).** Budstyrt utspel i `botCardSmart`
(`openingLeadWithAuction`): partnerns färg, undvik deras, passivt + tenass/ess-skydd
mot trumf, inre sekvenser, trumf/singel. Teori `docs/utspel-teori.md`; kvar =
förfining `docs/utspel-diagnos.md`.

**Klart 2026-08-07 (detalj i `docs/historik.md` + `docs/systemrevisorn.md`):**
etapperna **E1–E7** (hål D steg 1 §6.10 · splinterregeln §4.1 · Jordan §7.8d ·
starka återbud §5.2/§6.6 · 2/1-högfärgen §5.3 · oklart-fixarna · doc-svepet;
mätserien M22–M26) · **B13** graderade återbud efter 1m–2m + cue i
minorfit/2♣-grenen (§4.2/§6.2, M27) · **F2** datadriven detektorkedja
(`FORCED_DETECTORS`/`CONTESTED_DETECTORS` + kedjevakten
`detector-chain.test.ts`; E1/E3 stängda).

**Klart 2026-08-07→08-08 — HELA KÖRORDNINGEN F1–F6 KLAR (detalj i
`docs/budsystem-revision.md` + `docs/historik.md` + `docs/systemrevisorn.md`):**
F3 advancer-rabatten generaliserad (M28) · F4 TP till §7-inkliven (D9 stängd,
M29; bevakning kvar: X-svararen/DONT/svaga tvåor räknar rå HP) · F5
6-5-återbudet + 2♣-strain-valet (A3/E2 stängda, M30) · F6 stark 17+ enfärg
efter två bjudna färger (C5/C14 stängda, M31; 4-4-X:et MEDVETET live-only).

**Äldre klart (2026-07-28, detaljer i `docs/historik.md`):** känsla i
kortspelet, budstöd-toggle, felrapporter #40/#41/#42, volymtester ALLTID
seedade. Känt hål kvar: M19, frö 20260952 (`docs/bevaka.md`).

> **ÄRLIGA SLAMPORTAR (2026-07-07, LIVE — grundprincip som styr ALLA slam-vägar):**
> bottarna bjuder som människor — egen hand + partnerns **VISADE** intervall, aldrig
> partnerns faktiska kort; hellre systemriktig miss än kik. Kaptensregeln: ≥33 driv /
> 31–32 inbjudan mot visat minimum; ingen kontrollkoll (ägarbeslut); storslam kräver
> visshet. Detalj: budsystem.md §5.2/§5.7/§6 + `docs/historik.md`.

### 👀 Bevaka i spel — de tre senaste
- **F6 starka X:et efter två färger (2026-08-08):** 17+ med 5+ objuden färg
  dubblar efter 1♦–P–1♥ och färgar nästa varv. Landar fortsättningen lagom
  mot en tom advancer? 4-4-X:et är MEDVETET live-only — säljs givar där?
> Hela listan (nyast först): **`docs/bevaka.md`**. Läs den när ägaren
> säger att något känns fel i spel, eller när en ny fix ska läggas till.
- **F5 2♣-strain + 6-5 (2026-08-08):** 2♣-auktioner ska hitta högfärgsfiten
  (inte dö i 5♣); 16+ 6-5 reverserar även efter 1NT-svar. Känns 2♣-slutbuden
  rätt nu — och svarar partnern begripligt på den nya reversen?
- **F4 TP-inkliven (2026-08-07):** inklivsgolven läser TP (formstark 7:a
  kliver in), advancern stödpoäng. Kliver bottarna in för lätt — straffas
  TP-inkliven? X-svararen/DONT/svaga tvåor räknar ännu rå HP — säljs givar där?

### 🟢 NÄST (max 3, i ordning)
1. **Beslut B etapp 2 forts.** — klientfasen: wira in tävlingen i appen, inskick,
   validering, poäng/topplista (serversidan klar; se NU — `docs/beslut-b-plan.md`).
2. **Beslut B etapp 3 — härdning + drift** (arkiv/streaks på servern, rate limits,
   ev. Nivå 2 dolda händer; grindbesluten först — `docs/beslut-b-plan.md`).

*(ETAPP 7 "missad lillslam" STÄNGD 2026-08-07: hål 1+2 klara M20/M21, hål C
via cue-buden, hål D steg 1 klar / steg 2 parkerad — hela resan + verktygen i
`docs/systemrevisorn.md`.)*

### ⚪ SENARE (rubriker — full beskrivning i `docs/senare.md`)
**FACELIFTEN** (väckt 2026-07-29 ur parkeringen → Fas 1 i `docs/konkurrensplan.md`) ·
**Fler skills + smal subagent-användning** (påbörjat 2026-07-30, deploy-verifiering
klar; kvar: probe-ritualerna + session-checklistorna) ·
**Lebensohl nästa lager** (kärnan live 2026-07-30; kvar: takeout-X, slow shows,
cue-Stayman, efter takeout av svag tvåa) ·
fler budträningsgivar + tema-dropdown ·
spelmotor-kvalitet (#32/#34 KLARA; kvar: tredje hand högt i trumf) ·
**UTSPELET** (hål A–G klara; kvar: förfining) · engelska som andra
språk (Fas 5) *(17+ enfärgshand efter två bjudna färger BYGGD 2026-08-08 som
F6)* · auto-facit på
hela given i webworker · kanoniska linjen passar ut tvåfärgsinkliv ·
svårighetsnivåer på bottarna · bot-hjärnans B2/Steg C · bredare försvarsinferens ·
`auctionFacts`-lagret (R2 steg 2 — förberäknade auktionsfakta åt detektorerna,
byggs vid behov).

### 🅿️ PARKERAT (väg INTE in i beslut — full beskrivning i `docs/senare.md`)
DDS-facit på tunga fulla givar · off-book §7 bredd · "framkalla slutbud"-väljaren ·
Mathe mot stark konstgjord 1♣. *(Beslut B FLYTTAD till NU 2026-08-08 —
planen: `docs/beslut-b-plan.md`.)*

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
- **Vercel**, projekt `learn-bridge`, team `rebidz` (Hobby/gratis). Publicering
  sker via **GitHub Actions** (`.github/workflows/ci-deploy.yml`); Vercels egen
  Git-auto-deploy är **frånkopplad** (2026-07-30). Ägaren kör ALDRIG
  bygg-kommandon själv. Live: **https://rebidz.com**.
- **Test-/typgrind före live (i GitHub Actions, inte `vercel.json`):** varje push
  till main kör `npx tsc && npm test` på ubuntu-latest och deployar till Vercel-
  produktion bara om allt är grönt. Rött test → ingen publicering. **Ändra aldrig
  bort grinden** — enda automatiska skyddet mellan kod och live. Flyttad hit
  2026-07-30 för att Vercels CPU-svultna byggare gav "myntkast"-röda deployer;
  `vercel.json` bygger nu bara (`npm run build`).
- **Vite `base` MÅSTE vara `/`** (Vercel serverar från roten), annars blir sidan
  blank. Låst av vaktestet `src/deploy-config.test.ts`.
- **Rollback:** varje funktion mergas med egen `--no-ff`-mergepunkt → backa med
  `git revert -m 1 <merge-sha>`. Vad som ligger live = senaste **Ready**-deployen i
  Vercel-dashboarden; det finns ingen tag i repot.
- GitHub Pages-workflowen (`.github/workflows/deploy.yml`) är **inaktiverad**
  (`workflow_dispatch`-endast, filen kvar som referens).
- Ingen server/databas/backend i nuläget — ändras först i Beslut B etapp 1
  (planen: `docs/beslut-b-plan.md`).

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
- Lägg aldrig till backend/server/databas utan grindbeslutet 0→1 i
  `docs/beslut-b-plan.md` — tills dess är hostingen statisk.
- Glöm aldrig Vite `base` = `/` (låst av vaktestet).
- Bygg inte alla budsystem på en gång — ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
- Pusha/deploya aldrig utan att fråga ägaren först.
