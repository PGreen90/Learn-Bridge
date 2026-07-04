# R5 — Git, deployment & process

> Revisionssteg R5 (se `AUDIT_PROMPTS.md`). Gren `audit/r5-git-deploy`.
> Granskar git-historik, gren-strategi och deploy-processen (GitHub Actions →
> Pages). Bygger vidare på R1–R4. Genomförd 2026-07-04 (audit session 8).

## Så här ligger det till (för ägaren)

Själva **hantverket** kring git är bra: 212 commits, alla små och tydligt namngivna
(en sak per commit, "R4-fynd #5", "Felrapport #10", "FAS 8" osv.), och varje större
funktion mergas med en **egen mergepunkt** så att en enskild funktion går att backa
ren. Deployen är **reproducerbar** (Node-versionen är låst, bygget använder exakt de
paket som är låsta i `package-lock.json`) och **24 av de senaste 25 publiceringarna
blev gröna**. Det finns ingen KRITISK eller HÖG-akut sak här.

Men det finns **ett hål som betyder mycket just för att appen ska kunna utvecklas av
Claude Code utan att du granskar varje steg**: publiceringen som går live **kör inte
testerna och kontrollerar inte typerna**. Bygget säger bara "gick det att paketera?".
Det betyder att en session i teorin kan pusha kod där ett av de ~1600 testerna är
rött, eller där TypeScript-typerna inte går ihop, och sidan **ändå går live** — trasig
— så länge den råkar gå att paketera. Testsviten är appens starkaste skydd, men den
vaktar bara om *någon kommer ihåg att köra `npm test` för hand* före pushen. Den
grinden borde stå automatiskt mellan koden och det som blir live.

Det andra värda att nämna: Vite-`base`-pathen (`/Learn-Bridge/`) — som `CLAUDE.md`
själv kallar "det vanligaste deploy-felet" — skyddas i dag **bara av en kommentar**.
Bryts den blir hela sidan blank, och inget test fångar det. Resten är städning:
mergade audit-grenar och en gammal worktree ligger kvar lokalt.

## Fynd i korthet

| # | Fynd | Prioritet | Lagat nu? |
|---|------|-----------|-----------|
| 1 | **Publiceringen kör inte tester och kontrollerar inte typer.** Workflowen kör `npm ci` + `vite build`; `vite build` typkollar inte (ingen `tsc`), och testsviten körs aldrig i CI → rött test eller typfel kan gå live utan att märkas | **MEDIUM** (→ HÖG i "6 mån utan granskning") | ✅ Ja (`a8f22af`) – `test`-jobb (tsc + npm test) som build/deploy beror på |
| 2 | **Vite `base`-pathen skyddas bara av en kommentar.** Inget test låser `base === '/Learn-Bridge/'`; en session som rör `vite.config.ts` kan bryta den → blank live-sida | **MEDIUM** | ✅ Ja (`a8f22af`) – vaktest `src/deploy-config.test.ts` |
| 3 | **Mergade audit-grenar + en gammal worktree ligger kvar lokalt** (`audit/r1-budsystem`, `audit/r1-fynd2-delbit2`, `audit/r2-arkitektur`, `audit/r4-dok-ai`, worktree `clever-ishizaka-dc7abb`) → växande brus i `git branch` över tid | **LÅG** | ✅ Ja – mergade grenar rensade; `.claude/worktrees` uteslutet ur testkörningen (`636ca8b`) |
| 4 | **Ingen markör för "senast gröna live".** Rollback via mergepunkter är bra, men inget tag/en-radsnotering pekar ut vilken commit som just nu är publicerad → återställning kräver att man läser Actions-historiken | **LÅG** | ✅ Ja (`37ad532`) – rollback/live-facit dokumenterat i CLAUDE.md |
| 5 | **`concurrency: cancel-in-progress: true`** — snabba pushar i rad avbryter en pågående deploy (matchar den kända `deployment_queued`-racen i `MEMORY.md`). Korrekt beteende, men värt att känna till | **LÅG** (observation) | — Ingen åtgärd (korrekt beteende, dokumenterat) |

### Åtgärdslogg (ägaren valde "laga alla 1–5", audit session 8)

- **#1 (`a8f22af`):** `deploy.yml` fick ett `test`-jobb (`npx tsc` + `npm test`) som
  `build`/`deploy` beror på. Rött test eller typfel stoppar nu publiceringen.
- **#2 (`a8f22af`):** `src/deploy-config.test.ts` låser `base: '/Learn-Bridge/'`
  (läser configen via Vites `?raw` → inget `@types/node` behövdes).
- **#3 (`636ca8b`):** `vite.config.ts` utesluter `.claude/**` ur testkörningen
  (vitest scannade in parallella worktrees och körde deras tester dubbelt, mot en
  äldre giv). Mergade lokala audit-grenar rensade med `git branch -d`.
  **Bonusfynd under fixen:** DDS-testet "100 slumpgivar (3 kort/hand)" låg kvar på
  standardgränsen 5 s och sprack under full-suite-last (CPU-strid) fastän det
  passerar isolerat — samma flake som djuptesten redan fått egen timeout för. Gav
  det 30 s explicit timeout (robusthet, ingen logikändring) så CI-grinden inte blir
  spuriöst röd. **Detta betyder att sviten var latent flaky redan på main** — grinden
  i #1 hade annars kunnat blockera en giltig deploy. Nu grön och robust.
- **#4 (`37ad532`):** rollback (`git revert -m 1 <merge>`) + "senast gröna live =
  senaste gröna Actions-körningen" dokumenterat i CLAUDE.md:s deploy-avsnitt.
- **#5:** ingen åtgärd (korrekt beteende), men noterat i CLAUDE.md.

> **Notis om testantal:** efter att `.claude/worktrees` uteslutits rapporterar
> `npm test` **50 filer / 948 tester gröna** — den *verkliga* siffran. Tidigare
> full-suite-körningar i denna arbetskopia blåstes upp av worktree-dubbletterna
> (~94 filer). Enda sanningen om testläget = kör `npm test` (se
> `docs/arbetsrutiner.md`).

Inga fynd är KRITISK eller HÖG. (Per definitionen kräver KRITISK/HÖG ett felaktigt/
olagligt **bud** eller krasch i **Spela-läget** — R5 rör processen runt koden, inte
motorn. Fynd #1 markeras ändå som det mest angelägna eftersom prompten uttryckligen
frågar efter 6-månaders-utan-granskning-scenariot, där just den grinden är avgörande.)

## Det som är bra (så det inte tappas bort)

- **Små, spårbara commits.** Av de 60 senaste rör 24 en enda fil, ~40 rör 1–2 filer.
  De största diffarna är mergepunkterna (väntat — de buntar en gren) och två äkta
  funktionsleveranser (Claim tricks, bot-hjärnan). Ingen "allt-i-ett"-röra.
- **Konsekvent commit-språk.** `R4-fynd #N`, `Felrapport #N`, `FAS N`, `Merge …
  (NNNN gröna)` — man kan läsa historiken som en dagbok.
- **`--no-ff`-merge per funktion (7 mergepunkter).** Varje funktion/audit-steg blir
  en ren återställningspunkt: `git revert -m 1 <merge-sha>` backar hela funktionen.
- **Reproducerbar deploy.** `actions/checkout@v7`, `setup-node@v6` med `node-version:
  22` (låst), `npm ci` (installerar exakt `package-lock.json`). Samma indata → samma
  bygge. 24/25 senaste körningar gröna; den enda röda var en övergående kö-miss på en
  ren docs-commit (åtgärdas med `gh run rerun`, se `MEMORY.md`), inte ett kodfel.
- **Korrekt `.gitignore`.** `node_modules`, `dist`, `.claude/*` (utom `commands/`),
  PDF-källmaterial — inget skräp i repot. Origin har bara `main` (audit-grenarna är
  medvetet lokala tills ägaren godkänner merge → ren fjärrbild).

## Teknisk genomgång

### Fynd #1 — Publiceringen kör inte tester och kontrollerar inte typer (MEDIUM → HÖG)

**Problem.** `.github/workflows/deploy.yml` har ett enda `build`-steg:
```yaml
- run: npm ci
- run: npm run build      # = "vite build"
```
och `package.json` har `"build": "vite build"`. `vite build` transpilerar med esbuild,
som **stripar bort** TypeScript-typerna utan att kontrollera dem — det finns inget
`tsc`/`tsc -b` i kedjan. Och `vitest` (49 testfiler, ~1600 tester) körs **aldrig** i
CI. Det finns bara en workflow-fil, och den deployar utan grind.

**Rotorsak.** Standard-Vite-mallens `build`-script (`tsc -b && vite build`) bantades
någon gång till bara `vite build`, och teststeget lades aldrig till i workflowen.
Testerna har hela tiden körts för hand vid varje sessionsavslut, så luckan har inte
märkts — men den är beroende av mänsklig disciplin.

**Konsekvens (konkret).** En session som lägger till en konvention och råkar bryta ett
befintligt test, eller lämnar ett typfel (t.ex. fel returtyp från `decideCall`), kan
pusha till `main`. Actions bygger grönt (paketeringen lyckas), sidan **går live** —
och budmotorn kan bete sig fel utan att något automatiskt sa ifrån. Testsviten, som är
appens starkaste kvalitetsskydd, står utanför den enda automatiska grinden som finns.
I det uttryckliga "6 månader utan mänsklig granskning"-scenariot är detta den enskilt
största risken.

**Lösning (kräver ägarens ja — processändring).** Lägg ett `test`-jobb som `build`
(och därmed `deploy`) beror på, så inget publiceras med rött test eller typfel:
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version: 22 }
      - run: npm ci
      - run: npx tsc -b --noEmit   # typgrind
      - run: npm test              # vitest run
  build:
    needs: test
    # … som i dag
```
Alternativt (enklare, en fil): lägg `npx tsc --noEmit && npm test` som ett extra steg
före `npm run build` i `build`-jobbet. Rekommendation: eget `test`-jobb — tydligare i
Actions-loggen vilket steg som föll.

### Fynd #2 — Vite `base`-pathen skyddas bara av en kommentar (MEDIUM)

**Problem.** `vite.config.ts` sätter `base: '/Learn-Bridge/'` med en varnande
kommentar ovanför, men **inget test** låser värdet. `CLAUDE.md` kallar själv detta
"det vanligaste deploy-felet" och att sidan blir blank på Pages om det bryts.

**Rotorsak.** Värdet är en ren konvention utan maskinellt facit. En parallell
`--worktree`-session som refaktorerar `vite.config.ts` (eller byter build-verktyg) har
inget som stoppar en felaktig ändring.

**Konsekvens.** Ändras `base` (eller tas bort) publiceras en **helt blank** live-sida.
Bygget blir grönt (Vite bryr sig inte), så även fynd #1:s test-grind skulle släppa
igenom det — det här behöver ett eget litet facit.

**Lösning (litet, additivt).** Ett vaktest som körs i sviten:
```ts
// src/deploy-config.test.ts
import { readFileSync } from 'node:fs'
test('Vite base matchar repo-namnet (annars blank Pages-sida)', () => {
  expect(readFileSync('vite.config.ts', 'utf8')).toContain("base: '/Learn-Bridge/'")
})
```
Kör i fynd #1:s CI-test-jobb → då stängs cirkeln (blank-sida-felet fångas före live).
Litet nog att lägga på plats, men jag väntar på ditt ja så det landar ihop med
CI-grinden (annars ger det falsk trygghet innan testerna körs i CI).

### Fynd #3 — Mergade grenar + gammal worktree ligger kvar lokalt (LÅG)

**Problem.** `git branch --merged main` visar fyra audit-grenar som redan är i main
(`audit/r1-budsystem`, `audit/r1-fynd2-delbit2`, `audit/r2-arkitektur`,
`audit/r4-dok-ai`), och `git worktree list` visar en gammal worktree
`.claude/worktrees/clever-ishizaka-dc7abb`. Origin är rent (bara `main`).

**Rotorsak.** Audit-stegen körs i egna grenar men städas inte efter merge. Med
worktree-arbetssättet (R4) kommer fler att samlas.

**Konsekvens.** Enbart brus: `git branch` blir längre för varje steg, och det blir
svårare att på en blick se vad som är levande arbete. Ingen funktionell risk (allt är
redan i main).

**Lösning (städning, låg risk — mergade grenar finns kvar i mains historik):**
```bash
git branch -d audit/r1-budsystem audit/r1-fynd2-delbit2 audit/r2-arkitektur audit/r4-dok-ai
git worktree prune   # + ev. git worktree remove för clever-ishizaka om den är död
```
Görs helst efter att R5 är mergad (då kan även `audit/r5-git-deploy` tas). Jag kan
göra det på din signal — inget pushas (grenarna är ändå lokala).

### Fynd #4 — Ingen markör för "senast gröna live" (LÅG)

**Problem.** Rollback-*mekaniken* är bra (mergepunkter → `git revert -m 1`), men inget
pekar ut vilken commit som **just nu ligger publicerad**. Det står i Actions-historiken,
men inte i repot.

**Konsekvens.** Om en dålig deploy gått live måste man leta i Actions för att hitta
senaste gröna commit att backa till. Marginellt i dag (du pushar sällan och läser
loggen), men växer i "utan granskning"-scenariot.

**Lösning (valfri, lätt).** Antingen en `git tag live-YYYYMMDD` vid varje grön deploy,
eller en enradskälla i `docs/status.md` ("Live-SHA: …"). Lågt värde så länge en
människa är i loopen; nämns för fullständighet.

### Fynd #5 — `cancel-in-progress: true` (LÅG, observation)

Workflowen har `concurrency: { group: pages, cancel-in-progress: true }`. Två pushar i
snabb följd → den första deployen **avbryts** till förmån för den senaste. Det är
egentligen *rätt* beteende (den nyaste koden ska vinna) och stämmer med
`MEMORY.md`-noten om att aldrig dispatcha en ny körning medan en pågår. Ingen åtgärd —
men bra att känna till: pusha inte två gånger på några sekunder och förvänta dig att
båda deployar.

## Direkt svar: tre största riskerna vid 6 månader utan granskning

Givet vad historiken faktiskt visar:

1. **Ingen automatisk test-/typgrind före live (fynd #1).** Den absolut största. Utan
   en människa som kör `npm test` före varje push kan trasig budlogik eller typfel gå
   live obemärkt. Testsviten finns men vaktar inte automatiskt. **Åtgärd: CI-test-jobb.**
2. **`base`-pathen oövervakad (fynd #2).** En enda felaktig `vite.config.ts`-ändring
   ger en blank sida, och varken bygget eller nuvarande CI fångar det. **Åtgärd: vaktest.**
3. **Tillstånds- och gren-glidning som byggs på (fynd #3 + R4:s dok-glidning).** Över
   sex månader samlas mergade grenar/worktrees, och projektkartan/statusdoken glider
   från verkligheten (R4-temat) — så frågan "vad är egentligen live och vad är nästa
   steg?" blir gradvis svårare att svara på utan en människa. **Åtgärd: städrutin +
   R4:s dok-disciplin + ev. live-SHA-markör (fynd #4).**

## Sammanfattande bedömning

Git-hantverket och deployens *reproducerbarhet* är starka. Den verkliga bristen är att
den **enda automatiska grinden mellan kod och live inte innehåller projektets bästa
skydd (testerna + typerna)**. Att lägga till det (fynd #1 + #2) är litet arbete med hög
effekt och är den viktigaste R5-åtgärden att föra in i NU/NÄST-kartan. Resten är
städning och trevlig-att-ha.
