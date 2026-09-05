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

### 🔵 NU — MOTORBYTET: från manus till fyra spelare (ägarbeslut 2026-09-04)
Budmotorn skriver idag ett **manus** (`buildAuction`) som budlådan spelar upp,
och 70 detektorer tar över när manuset tar slut — varje söm har gett en ström av
felrapporter. Bytet: **egen hand + auktionen hittills → ett bud**, en
beslutsfunktion för alla fyra stolar, betydelse → fakta → val, kikvakt som
bevisar ärlig inferens. HELA planen (diagnos, målbild, skyddsnät, etapp 0–6,
grindarna): **`docs/motorbyte-plan.md`** — läs den FÖRST vid allt motorarbete.
**Regler under bytet:** inga lappar i manuset/detektorkedjan; felrapporter får
facit (`it.todo`) och lagas i det nya lagret när familjen kommer; en familj per
session; auktionsdiffen klassad (a/b/c) före varje merge; grindbeslut per familj.
**Läget (detalj i planens logg):** etapp 0–2 KLARA 2026-09-04 (riggen
`decideCallTraced`/`DUMP_RANGE`/`scripts/auktionsdiff.mjs`/facit-kön
`motorbyte-facit.test.ts`, betydelselagret `auction-meaning.ts`, faktalagret
`auction-facts.ts`). **Etapp 3 familj 1–5 KLARA & LIVE 2026-09-05** (mergepunkter
451f692, 5b1a9dc, b56a72f, 45fa322, 4a14bca, e303016): beslutstabellen
`auction-decide.ts` (`decideFromTable`: läge → kunskapsfunktion) med raderna
öppning/svar/återbud/svar2/tredje/slam/svar3/fjärde; adaptrarna läser partnerns
bud ur den NAKNA auktionen; `decideCall` frågar tabellen först; kikvakten prövar
varje tabellbud; avvikelsedumpen (fyra lägen) ger b-listorna. Sexton bok-mot-
motor-fynd väntar på ägarbeslut (loggen; bl.a. nr 14 naket 4NT utan bjuden fit).
**Familj 6 KLAR & LIVE 2026-09-05 (mergepunkt f05bfef, grinden godkänd inkl.
§5.7-regeländringen; grinden efter etapp 3 = deployad):** manusets ostörda
del riven — `buildAuctionCore` spelar ut vår sida ur tabellen stol för stol
(adapterkedjan, Gerber-blocken, tvåhandsförarna borta); kvar = konkurrensronden
+ `open`-flaggan (etapp 4). På vägen: 2♣-grenens slamläsning (4NT = essfrågan i
öppnarens färg, kontrollbud i ny färg sätter den), kaptenens egen avsikt vid
oläsbar trumf (`captainOwnSituation`) och **§5.7-regeländringen**: 4NT direkt
över 1NT-återbudet är alltid kvantitativt, egen självbärande färg frågar med
Gerber 4♣ (fynd 6 löst — ägaren kan vända det i grinden); vakt: manuset avgör
inga bud i ostörda auktioner (`auction-decide.test.ts`).
**Nästa gång börjar vi med:** etapp 4 familj 1 — inkliv och advance
(`overcall`, `advanceOvercall`, `advanceTwoSuiter`, inklivarens fortsättningar)
flyttar in i tabellen och deras detektorer raderas; ordningen fastställs mot
frekvensbilden (`auktionsdump-frekvens.txt`, planens §4 etapp 4). Startrutin:
baslinjerna (§3) på `f05bfef`, betydelsesvepets störda del som mätare.

**Nyss klart (2026-09-01…03, detalj i `docs/historik.md`):** speldiagnosens
runda 6 · rebidz-bot + alla Beslut B-etapper · **trebottarna Gunnar52/Lasse68/
Emma03 LIVE** (nivå bara i Syds kortspel, `botniva.ts`) · felrapporterna
#54–#60 (`4898958` + 2026-09-03/04: 2/1-kravet i budlådan, svararens egen färg efter 1NT till spel, essfrågeläsningen) · pliktsvepet K1–K5. Grindbeslut kvar: Nivå 2 i tävlingen
VÄNTAR (trigger ej nådd). Ägarens ord: säg "regeln saknades", inte "off-book".

**Parallellt pending ägarsteg:** budförklaringarnas ordval-granskning
(revisionen KLAR & LIVE 2026-08-19, batch 1–7 deployade): syna katalogen
`docs/budforklaring-katalog.md`, peka på en rad → Claude byter ordagrant +
deployar.

---

**Levande låsningar ur avslutade etapper** (hela historiken: `docs/historik.md`):
- **Tävlingen är KLAR & LIVE** (2026-08-11/12): konton → daglig 12-givarstävling
  → topplista. **MP är STANDARD (topp=100 %, snitt 50 %) — ändra INTE.**
  "Spela given igen" finns som övningsläge (räknas inte i MP%).
- **Realtidsborden är KLARA & LIVE** (Beslut B etapp 4, 2026-08-17/18):
  "Spela med vänner" — serverdomare med dolda händer, tre spelformer, närvaron
  (paus/bot-övertag/ägarbyte). ALLT bordsarbete: **`docs/bord-plan.md`**.
  Migrationerna `0007`+`0008` körda; felrapporten nås i alla lägen.
- **Speldiagnosen är byggd & vilande** (2026-08-12/14, S0–S5 = tretton fixar,
  MC-urfallet stängt; nattvakten kör förscreening varje kväll i Actions):
  rigg/probe/kommandon/principen "RÄTT, inte max stick" — allt i
  `docs/speldiagnos.md`. Nästa runda är en NU-kandidat.
- **Beslut B-masterplanen** (ägarbeslut 2026-08-08): konton → daglig tävling →
  realtidsbord (valfri mix människor/bottar). HELA planen — etapper 0–4,
  grindarna, GDPR/säkerhet — bor i **`docs/beslut-b-plan.md`** (läs den FÖRST
  vid allt Beslut B-arbete). Beslut tagna: Supabase · klassiska lösenord · EN
  12-givarstävling först · tävlingarna före borden. Stående regel: vid varje
  etappslut stannar Claude, visar läget och tar grindbesluten med ägaren.
  Etapp 0–2 + 4 klara; etapp 3 (härdningen) kvar — se NÄST.
- **Konkurrensplanen** (ägarbeslut 2026-07-29): rebidz konkurrerar med
  BBO/Funbridge/Synrey; Funbridge-modellen först, sv→en (Fas 5). Roadmap +
  hälsobild: **`docs/konkurrensplan.md`** (Fas 1-faceliften yta 1–4 + DAGENS
  GIV klara).
- **Kontrollbud ska ALLTID finnas** i slamutredningen ([[cue-bids-reinstated]],
  2026-08-03): vid utgång etablerad (GF) + agreed trumf cue:ar motorn fritt
  under utgång; poängomdömet ligger på att gå FÖRBI utgången.

**Klart tidigare — detaljerna bor i `docs/historik.md`, INTE här:** faceliften
yta 1–4 · Lebensohl lager 1 · utspelet hål A–G (teori `docs/utspel-teori.md`,
förfining `docs/utspel-diagnos.md`) · etapp 7 "missad lillslam"
(`docs/systemrevisorn.md`) · mätetapperna E1–E7, B13, F1–F6
(`docs/budsystem-revision.md`) · stora granskningen · Beslut B etapp 0–2 ·
felrapporterna. Känt hål kvar: M19, frö 20260952 (`docs/bevaka.md`).

> **ÄRLIG INFERENS (grundprincip, LIVE — styr ALLA bottbeslut, bud OCH spel):**
> bottarna tänker som människor — egen hand + vad budgivningen och spelet
> VISAT, aldrig dolda kort eller motorns facit; hellre systemriktig miss än
> kik. Slamporten (2026-07-07): kaptensregeln ≥33 driv / 31–32 inbjudan mot
> visat minimum; ingen kontrollkoll (ägarbeslut); storslam kräver visshet.
> Detalj: `docs/budsystem.md` §5.2/§5.7/§6 + `docs/bot-hjarna.md`.

### 👀 Bevaka i spel
Hela listan (nyast först): **`docs/bevaka.md`** — läs den när ägaren säger att
något känns fel i spel, eller när en ny fix ska läggas till. Senast
(2026-09-01, speldiagnos fynd 3): MC-beslut på FÅ samplade lägen · dessförinnan
S5-fixarna (MC-urfallet stängt) och 6-5-handens utbjudning.

### 🟢 NÄST (max 3, i ordning)
1. **Bordens SENARE-lista** — claim vid bordet · DD-jämförelsen ("hur bra mot
   facit") · rondgenomgången per giv (`docs/bord-plan.md`).
2. **Speldiagnosens nästa runda** — nya granskningsvarv på S6-koden; kandidat
   ur runda 6: MC-på-få-lägen (`docs/bevaka.md`).

### ⚪ SENARE (rubriker — full beskrivning i `docs/senare.md`)
FACELIFTEN forts. (inkl. tävlingsöversiktens mobil-layout) · fler skills + smal
subagent-användning · Lebensohl nästa lager · fler budträningsgivar +
tema-dropdown · spelmotor-kvalitet (tredje hand högt i trumf) · utspelsförfining ·
engelska som andra språk (Fas 5) · auto-facit på hela given i webworker · den
starka dubblaren säljer given i rond 2 · **svep: partnerskapsplikter i konkurrens**
(preferens/fritt bud/höjning på visad längd, ägarbeslut 2026-09-02 efter
felrapport #55–#56) · bot-hjärnans B2/Steg C · bredare försvarsinferens ·
rondgenomgångens per-kort-motivering · 2♣-öppningens bredare översyn forts.
(steg 1 substanskraven KLAR 2026-08-31; kvar: kravnivån + balanserad/
distributionell + 6-5-samspelet).

### 🅿️ PARKERAT (väg INTE in i beslut — full beskrivning i `docs/senare.md`)
DDS-facit på tunga fulla givar · off-book §7 bredd · "framkalla slutbud"-väljaren ·
Mathe mot stark konstgjord 1♣ · hål D steg 2 (cue-frontend i konkurrens).

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
Ägaren har ingen programmeringsbakgrund, men är inte längre novis: efter
projektets resa erfaren & trygg (ägarens egna ord 2026-08-13).
- Förklara **nya** begrepp när de dyker upp — känt stoff behöver inte förklaras
  om. Större steg i taget är okej; stäm ändå av vid vägval.
- Styrningen är OFÖRÄNDRAD: fråga före push/commit/deploy, stanna vid
  grindbeslut, visa exempelhänder före ändringar i öppningsstrukturen.
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
- GitHub Pages-workflowen är **inaktiverad** (`workflow_dispatch`-endast, filen
  kvar som referens).
- **Backend FINNS sedan Beslut B etapp 1–2 & 4 (2026-08-10…18):** Supabase
  (konton + tävlingsdata + borden, inkl. Realtime) + Vercel-serverfunktioner i
  `api-src/` (bundlas med esbuild). Nya backend-delar byggs bara enligt planen
  + grindarna i `docs/beslut-b-plan.md` (borden: `docs/bord-plan.md`).
  Hemligheter i `.env.local`/Vercels env — ALDRIG i git-spårade filer.

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
- Bygg inga backend-delar utanför Beslut B-planens etapper och grindbeslut
  (`docs/beslut-b-plan.md`).
- Glöm aldrig Vite `base` = `/` (låst av vaktestet).
- Bygg inte alla budsystem på en gång — ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
- Pusha/deploya aldrig utan att fråga ägaren först.
