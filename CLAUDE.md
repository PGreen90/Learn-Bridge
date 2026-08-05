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
**YTA 1–3 KLARA (startsidan 2026-07-31 · spelbordet 2026-07-31 med pass 2–4
t.o.m. 2026-08-02 · budlådan 2026-08-02).** Hero + guldspråket, Synrey-bordet
telefon-först (full-bleed, träkarlen på rätt sida vid försvar), budlådan med
kortrad = spelfasens och guldring på valt bud. All detalj:
`docs/konkurrensplan.md` Fas 1 + `docs/historik.md`.

**DE INRE SIDORNA + EXKLUSIVITETSSVEPET + DAGENS GIV (yta 4): KLART
2026-08-02.** Gemensam `PageHeader`, guldmonogram på kortbaksidan, klubbok,
guld på utmärkelser, laddspader, knapp-skimmer, sidfot, taglinen "Träna, spela,
tävla" — och **DAGENS GIV**: datumfröet (`daily.ts`) ger alla samma giv varje
dag, rutt `/spela-kort/dagens`, delbart textresultat (Wordle-mekaniken),
flaggskeppskort på startsidan. Förtitt på Fas 3 UTAN backend. Detalj:
`docs/historik.md` 2026-08-02 + `docs/konkurrensplan.md` Fas 1/Fas 3.

**ETAPP 7 HÅL 2 "3NT-STOPPEN": KLAR & LIVE (2026-07-31).** Öppnarens kvantitativa
4NT-slamtrevare efter svararens 3NT (19+ hp, "bara äkta extra"). Mätning #21: noll
regressioner. Facit `auction-3nt-stopp.test.ts`. Detalj: `docs/budsystem.md §6.9/§9`.

**LEBENSOHL EFTER VÅRT 1NT (Lager 1): KLAR & LIVE 2026-07-30.** Naturligt inkliv
över 1NT (6+, 11–15) annars DONT + Lebensohl-kärnan. Kvar: takeout-X, slow-shows,
cue-Stayman. Detalj: `docs/budsystem.md §7.5/§9` + `docs/bevaka.md`.

**KLART 2026-07-30 (detalj i `docs/historik.md`):** #34 försvaret tredje hand högt
i sang (`thirdHandHonor`, §8.6) · **HELA FAS 0 (a+b+c)** — 404-sida + route-kod-
uppdelning (entry-JS 889→247 kB), konsekvent kortrad (`HandFan`, felrapport #36
stängd), säkra zoner + mobilsvep.

**KONKURRENSPLANEN (2026-07-29, ägarbeslut — planering):** rebidz ska konkurrera
med BBO/Funbridge/Synrey. Funbridge-modellen först ("Dagens givar"), sv→en (Fas 5).
Roadmap Fas 0–6 + hälsobilden: **`docs/konkurrensplan.md`**. Beslut B (backend)
byggs bara på uttryckligt ägarbeslut.

**Klart 2026-07-29 (detalj i `docs/historik.md`):** felrapport #32,
rondgenomgången, markeringarna (UDCA + Lavinthal, `docs/budsystem.md §8.5`).

**STORA GRANSKNINGEN (26 fynd) + ETAPP A–D + GRANSKNINGSPUTSEN: KLARA & DEPLOYADE
2026-08-03** (detalj `docs/historik.md`). A skyddsnät, B "minns", C spelbordets
förtroende (informationsläckan lagad, ångra/ge upp, 812-budgeten), D "Vägen in"
(/om, Inställningar). Putsen: kalenderarkiv Dagens giv (`?dag=N`), spelhistorik,
tangentbord, "Spela om given", claim-revealens namn. Skjutet: par-poäng
(`docs/senare.md`).

**CUE-BUD ÅTERINFÖRDA (2026-08-03, river 2026-07-07): KLAR ETAPP.** Ägaren rev
det gamla "ingen kontrollkoll"-beslutet — kontrollbud (cue) ska ALLTID finnas
(minnet [[cue-bids-reinstated]]). Ny princip: när **utgång etablerad (GF) +
trumf agreed** cue:ar motorn fritt under utgång (gratis), poängomdömet ligger på
att gå FÖRBI utgången. `cueSlamAuction` i `slam-auction.ts` (gated på
`gameForcing`). Inkopplat: **Jacoby 2NT** + **NMF → öppnarens fördröjda
högfärgsstöd** (= hål C, når 6♥ på frö 20260932). Reverse/hoppskift/2♣ HÅLLS
(inferrerad, ej agreed trumf). Mätning ren (par-avvikelse 270,74 → 270,69,
"för högt" oförändrat, noll regressioner) men liten. Facit
`auction-slam-cue.test.ts`, boken §6.2/§9. Dev-verktyg kvar: `?sitt=`-rotation i
Play. **Kvar (eget beslut):** fler agreed-trumf-lägen (inverterad minor, 2♣);
off-book-igenkänning av din cue i icke-standardordning; öppnarens 18–19 i Jacoby.

**UTSPELET (2026-08-04): HÅL A–G KLARA (§8.3/§9).** Budstyrt utspel i `botCardSmart`
(`openingLeadWithAuction`): partnerns färg, undvik deras, passivt + tenass/ess-skydd
mot trumf, inre sekvenser, trumf/singel. Teori `docs/utspel-teori.md`; kvar =
förfining `docs/utspel-diagnos.md`.

**➡️ NÄSTA GÅNG:** ägaren väljer — fler cue-lägen (ovan), 🟢 NÄST punkt 1-rest
(hål D — konkurrensfallen) eller kvarvarande granskningsfynd (a11y, par-poäng).
Faceliten PARKERAD (ägarbeslut 2026-08-03). ⚪ SENARE: tredje hand högt i
**trumf** + signalspåret.

**Äldre klart (2026-07-28, detaljer i `docs/historik.md`):** känsla i
kortspelet, budstöd-toggle, felrapporter #40/#41/#42, volymtester ALLTID
seedade. Känt hål kvar: M19, frö 20260952 (`docs/bevaka.md`).

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
1. **ETAPP 7: MISSAD LILLSLAM (topplistans största post, FÖRSKANNAD):** hela
   mönsteranalysen + ordningsförslaget: `docs/systemrevisorn.md` "ETAPP 7
   FÖRSKANNAD". **Hål 1 (minimum-märkningen) KLART** (Mätning #20). **Hål 2
   ("3NT-stoppen") KLART 2026-07-31** (Mätning #21: öppnarens 4NT-slamtrevare,
   par-avvikelse 271,24 → 270,74, noll regressioner, `auction-3nt-stopp.test.ts`;
   förskanningen visade att posten är 24 givar men mest DD-smicker — bara 19+-delen
   är ärligt bjudbar). **Hål C (utgångsstoppen 4M) HANTERAD 2026-08-03 via
   CUE-BUDEN** (se NU-blocket + [[cue-bids-reinstated]]): den ärliga kärnan var
   ~5 givar med agreed trumf, löst av cue-ronden (NMF-support on-book). **Återupptas
   med hål D** (konkurrensfallen, 19 givar, svårast) ELLER att wire fler
   cue-lägen (inverterad minor / 2♣). Verktyg (gated):
   `$env:DUMP_CAT='missad-lillslam'` resp. `$env:FORSKAN='1'` + probe-testerna;
   mätningen: `$env:REVISOR='1'; npx vitest run
   src/lib/engine/revisor.probe.test.ts` (samma frö 20260721). Arbetssättet
   (facit-först, mönster inte enskilda givar): `docs/historik.md` +
   `docs/systemrevisorn.md`.
2. **B13 — öppnarens återbud efter inverterad minorhöjning:** dagens återbud är
   grova → ärliga slam-misser (`docs/budsystem-revision.md` B13).
3. **F2 — datadriven detektorkedja (E1):** underhållbarhet innan fler
   konkurrenskonventioner läggs på `decideCall`-kedjan.

### ⚪ SENARE (rubriker — full beskrivning i `docs/senare.md`)
**FACELIFTEN** (väckt 2026-07-29 ur parkeringen → Fas 1 i `docs/konkurrensplan.md`) ·
**Fler skills + smal subagent-användning** (påbörjat 2026-07-30, deploy-verifiering
klar; kvar: probe-ritualerna + session-checklistorna) ·
**Koppla in Lebensohl** (byggd men aldrig inkopplad, upptäckt 2026-07-25) ·
fler budträningsgivar + tema-dropdown ·
spelmotor-kvalitet (#32/#34 KLARA; kvar: tredje hand högt i trumf) ·
**UTSPELET** (hål A–G klara; kvar: förfining) · engelska som andra
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
