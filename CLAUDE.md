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

### 🔵 NU — FAS 1 FACELIFTEN (2026-07-31): en yta i taget
**YTA 1–4 KLARA (2026-07-31→08-02):** startsidan (hero + guldspråket),
Synrey-bordet telefon-först, budlådan med kortrad + guldring, de inre sidorna
(`PageHeader`, exklusivitetssvepet, sidfot) — och **DAGENS GIV**: datumfröet
(`daily.ts`), rutt `/spela-kort/dagens`, delbart textresultat
(Wordle-mekaniken), flaggskeppskort. Förtitt på Fas 3 UTAN backend. Detalj:
`docs/historik.md` 2026-07-31→08-02 + `docs/konkurrensplan.md` Fas 1/Fas 3.

**KONKURRENSPLANEN (2026-07-29, ägarbeslut — planering):** rebidz ska konkurrera
med BBO/Funbridge/Synrey. Funbridge-modellen först ("Dagens givar"), sv→en (Fas 5).
Roadmap Fas 0–6 + hälsobilden: **`docs/konkurrensplan.md`**. Beslut B (backend)
byggs bara på uttryckligt ägarbeslut.

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

**F6 — STARK 17+ ENFÄRG EFTER TVÅ BJUDNA FÄRGER (2026-08-08): KLAR (C5/C14
stängda — HELA KÖRORDNINGEN F1–F6 KLAR).** En 17+ hand med egen 5+ objuden
färg dubblar nu även efter två bjudna färger (1♦–P–1♥ → X, färgen nästa varv):
kanoniska linjen modellerar ronden (passet låg förr inbakat i linjen) och
delar handbedömningen med budlådan (`takeoutOfResponse`). 4-4-X:et MEDVETET
kvar live-only. C14 visade sig redan lagad 2026-07-04 (felrapport #14) —
stale 🔴 rättad + linjebyggstest. Facit `auction-stark-x-tva-farger.test.ts`,
boken §7.3/§9, mätning M31. Detalj: `docs/historik.md` 2026-08-08.

**F5 — 6-5-ÅTERBUDET + 2♣-STRAIN-VALET VERIFIERADE (2026-08-08): KLAR
(A3/E2 stängda).** Probe 4 000 givar + kodspårning, fyra fynd lagade:
(1) 16+ 6-5 efter 1NT-svaret gömde högfärgen i 3m → reverse-gren (§3);
(2) svararens minor sprängde 3NT förbi 4-korts högfärgen (frö 20261040, §4.4);
(3) kravstegen läste konstgjorda 2♣ som klöver + valde billigast-först →
högfärg före minor (frön 20262070/20261885); (4) fit-räkningen räknade 2♣
som klöverbud (dubbelton höjde 4♣→5♣). Facit `auction-65-rebid.test.ts` +
`auction-2c-strain.test.ts`, boken §3/§4.4/§9, mätning M30.

**F4 — TP TILL §7-INKLIVEN (2026-08-07): KLAR (D9 stängd).** Inklivsgolven
(enkelt inkliv 8/bal. 5, upplysnings-X 12/10) läser `max(hp, startpoäng)` och
advancerns cue/fit-jump stödpoäng — additivt ovanpå "låna en kung" (TP =
formspak, kungen = sitsspak). Två vakter: kvalitetsvakten (lyft kräver 3+ av
topp-5 i färgen) och spärrvakten (6+ färg, rå 6–10 → hoppinkliv som förr).
Rå HP kvar i 1NT-fönstren, taket 16, 17+-styrningen. Facit
`overcall-tp.test.ts`, boken §7.1/§9, mätning M29 (`docs/systemrevisorn.md`).
Kvar som bevakning: X-svararen/DONT/svaga tvåor räknar rå HP (`docs/senare.md`).

**F3 — ADVANCER-RABATTEN GENERALISERAD (2026-08-07): KLAR.** Den som svarar
partnerns balansering räknar av den lånade kungen över ALLA öppningsnivåer
(förr bara svaga tvåor): höjningar −3 stödpoäng + 3-lägestak
(`partnerBalanced`/`raiseWithFit`), X-svar graderar cue/hopp på hp −3
(`answerTakeoutDouble`). Direkt sits orörd. Facit
`auction-advancer-rabatt.test.ts`, boken §7.1/§7.7/§9, mätning M28. Kvar som
bevakning: NT-svar/nya färger efter balansering. Detalj: `docs/historik.md`.

**➡️ NÄSTA GÅNG:** körordningen F1–F6 är KLAR och 🟢 NÄST är tom — ägaren
väljer nästa spår ur ⚪ SENARE/🅿️ PARKERAT (t.ex. faceliten Fas 1-resten,
utspelsförfiningen, tredje hand högt i trumf, Lebensohl nästa lager).

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
*(TOM — hela körordningen F1–F6 stängdes 2026-08-08. Ägaren väljer nästa spår
ur ⚪ SENARE/🅿️ PARKERAT; F2–F6 sammanfattas i 🔵 NU-blocket, detaljerna i
`docs/budsystem-revision.md` + `docs/historik.md`.)*

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
