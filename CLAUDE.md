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


### 🔵 NU — BUDGIVNINGEN MOT PERFEKT · Etapp 3: Fel färg-spåret
> **Ägarbeslut 2026-07-20: designen läggs HELT åt sidan.** Facelift-spåret
> (Claude Design-utforskningen + Claudes "Klubbrummet"-mockup) är flyttat till
> 🅿️ PARKERAT — rörs inte förrän ägaren uttryckligen återupptar det. Fullt
> fokus i stället: **budgivningen så nära perfekt som möjligt.**
>
> **🔵 NU = Etapp 3: FEL FÄRG-SPÅRET (ägarbeslut 2026-07-21).** Ägaren valde
> att låta revisorns topplista styra: största posten **"fel färg — bet fast
> facit fanns i annan strain" (148/1000 givar, 65 110 p)** angrips FÖRE
> F1-resten och slam-familjerna. Arbetssätt: hämta fel färg-exemplen ur
> `revisor-output/` (frö 20260721 återskapar dem), hitta MÖNSTREN (inte
> enskilda givar), laga mönster för mönster test-låst, kör om mätningen med
> samma frö och se posten krympa utan att andra poster växer.
>
> **✅ Fix 1 KLAR 2026-07-21: "5♣-ryckaren"** (mönsteranalys av alla 148
> givar + fix, se `docs/systemrevisorn.md` + budsystem.md §5.6/§9): live-
> lagret läste Stayman-2♣ som klöverfärg och drog partnerns 3NT till 5♣.
> Facit-test `auction-stayman-not-natural.test.ts`.
>
> **✅ Fix 2 KLAR 2026-07-21: "2♣-kravets finaste färg"** (budsystem.md
> §4.4/§9 + `docs/systemrevisorn.md` Mätning #3): (a) svararen efter
> `2♣–2♦–3m` visar nu billigaste 4-korts högfärg under 3NT i st.f. blint 3NT
> från fel hand (`responses-2c.ts`); (b) dubbelton-"fit" mot partnerns
> tvingade ombud slår aldrig en egen visad 6+ färg (`raiseWithFit`-vakt,
> frö 20260737 når nu exakt par). Facit-test `auction-2c-finest-suit.test.ts`.
> Mätning #3: exakt par 16,8 %, fel färg-bet 138 givar/58 530 p (baslinje
> 148/65 110). **KVAR i spåret (fix 3+, identifierade buggfamiljer):** 5m
> fast 3NT var säkert efter cue-höjning/inverterad minor (frön 20260805/
> 20260769), konkurrens-fortsättningar (frön 20260733/20260763/20260774).
>
> **Planen (etapper i ordning — NU = exakt en etapp i taget):**
> 1. **✅ Etapp 1 KLAR & LIVE 2026-07-20: felrapporterna betade** — #35/#37/#38
>    lagade + test-låsta, #39 = inget fel (test-låst), #36 (UI) → ⚪ SENARE.
>    Mergepunkt `da7bdc5`, 1106 test. Givdetaljerna i `docs/historik.md`.
> 2. **✅ Etapp 2 KLAR 2026-07-21: Systemrevisorn byggd + baslinje mätt.**
>    Återanvändbar rigg (samma frö = samma givar): motorn bjuder alla fyra
>    händerna, `bridge-dds` (WASM, dev-beroende) ger DD-tabell + riktig
>    par-poäng, `judgeDeal` kategoriserar. Kör:
>    `$env:REVISOR='1'; npx vitest run src/lib/engine/revisor.probe.test.ts`.
>    Baslinje (1 000 givar, frö 20260721): exakt par 15,9 %, snitt-tapp
>    300 p/giv; topplista: fel färg-bet 65k p > missad lillslam 56k > missad
>    utgång 46k > missad storslam 38k > billig offring 35k — hela mätningen +
>    läsanvisning i `docs/systemrevisorn.md`.
> 3. **Fel färg-spåret (NU — ägarbeslut 2026-07-21, ur revisorns topplista):**
>    beta av misstypen "fel färg med bet", mönster för mönster, mätt mot
>    baslinjen med samma frö.
> 4. **F1-resten: familj B (2♣-slam) + C:s reverse/hoppskift** — byggs på de
>    ärliga portarnas mönster (kaptensregeln mot visade intervall).
> 5. **Revisorns topplista vidare** — kända kandidater: missad utgång (näst
>    största äkta posten), B13 (inverterad minor-återbud för grova), F3
>    (advancer-rabatt efter balansering), F4 (TP till §7-inkliven), F6 (C5
>    stark 17+ efter två bjudna färger + C14 tvåfärgsinkliv i prebuilt-linjer).
> 6. **F2: datadriven detektorkedja** (E1) — underhållbarhet så fler
>    konkurrenskonventioner inte gör `decideCall`-kedjan skör.
>
> **Bakgrundsläget:** UI-overhaulen steg 1–5 KLAR & mergad till main
> (2026-07-08): tokens, delad `<Dialog>`, `Play.tsx`-splitten, jämnt mörkt
> läge, första UI-röktesterna — detaljer i `docs/historik.md`. Steg A
> (Vercel + rebidz.com + PWA) KLART & LIVE sedan 2026-07-05. **Beslut B**
> (konton/multiplayer/tävlingar) är ett separat STORT spår — startas bara på
> uttryckligt ägarbeslut (`docs/framtid-multiplayer-plattform.md`).
>
> **ÄRLIGA SLAMPORTAR (2026-07-07, LIVE — grundprincip som styr ALLA slam-vägar):**
> bottarna bjuder som människor — egen hand + partnerns VISADE intervall, aldrig
> partnerns faktiska kort; hellre systemriktig miss än kik. Kaptensregeln: ≥33
> driv / 31–32 inbjudan mot visat minimum; ingen kontrollkoll (ägarbeslut);
> storslam kräver visshet. Fullständig beskrivning: `docs/historik.md` +
> budsystem.md §5.2/§5.7/§6. Se 👀 Bevaka (andra posten).
>
> **Historik:** alla äldre lägesrapporter (ÄRLIGA SLAMPORTAR-bygget, F1-familjerna,
> etapp 1-givarna, mobil-UI-fixar, felrapporter #23–#34, 2♣-utgångskravet,
> systems-on, Steg A-detaljerna, R1 Fynd #2-delbitarna, kontraktväljaren m.m.)
> är flyttade till **`docs/historik.md`** (senast 2026-07-21). Detaljerad
> status: `docs/status.md`. Budsystemets hälsobild + körordning F1–F6:
> `docs/budsystem-revision.md`.

### 👀 Bevaka i spel (aktiva noteringar från nyligen byggt — säg till om det känns fel)
- **"5♣-ryckaren" lagad (fel färg-spåret fix 1, 2026-07-21, NYTT & LIVE):**
  boten läser inte längre partnerns Stayman/överföring som en äkta färg, och
  rör ALDRIG partnerns obestridda utgångsbud off-book (förr kunde
  1NT–2♣–2♦–3NT ryckas till 5♣ → bet). **Bevaka:** (a) står partnerns
  3NT/4M/5m nu alltid kvar som det ska? (b) passar boten någon gång FÖR
  snällt i ett läge där den borde tävlat vidare (vakten gäller bara när
  motståndarna INTE bjudit över) — säg till.
- **ÄRLIGA SLAMPORTAR (2026-07-07 kväll, NYTT — styr ALLA slam-vägar):**
  all slamutredning beslutar nu på egen hand + partnerns VISADE intervall.
  **Bevaka:** (a) **missar** boten slammar du tycker den borde bjudit? (Medvetet:
  hellre systemriktig miss än kik — men säg till om en misstyp återkommer, t.ex.
  inverterad minor-fallet B13.) (b) **Inbjudningarna** (5M/4m/kvantitativ 4NT):
  accepterar partnern lagom ofta? (Accept = över blott minimum, dvs. min+1.)
  (c) **Partner-rättelsen** (kaptenen stannar 5-trumf, partnern lyfter till 6 med
  det höga antalet) — ser den rätt ut vid bordet? (d) Utan kontrollkoll kan en
  slam någon gång åka på två snabba ess — det är ägarens medvetna val, men säg
  till om det svider för ofta. (e) Motorn cue-bjuder inte längre själv (§6.2
  gäller manuella cue). (f) Storslam kräver visshet → 7-läget är nu ovanligt
  (~1/4300 giv) — kontraktväljarens storslam-sökning kan ta längre tid.
- **Slam-vägarna i spel (var täcks slam i dag?):** Jacoby 2NT, inverterad minor,
  öppnarens hopphöjning (`1x–1M–3M`), hopp-återbud i minor (`1m–1M–3m`),
  1NT-återbudet (`1m–1M–1NT`), MSS, Gerber över 1NT/2NT, Exclusion efter
  splinter — alla via kaptensregeln ovan. Jacoby-quirken (hängande cue som förr
  dödade slamlinjer) är borta i och med att auto-cue-ronden togs bort. TÄCKS
  ÄNNU INTE: slam efter stark 2♣ (familj B) samt efter reverse/hoppskift
  (C-resten) — se NÄST 1; advancer-slam efter upplysningsdubbling saknas också.
- **#33 Advancern hoppar inte förbi utgång** efter upplysningsdubbling — säg
  till om den borde utforskat slam i stället för att nöja sig med utgång.
- **#32 6-5-öppning:** högfärgen 12–15, lågfärgen 16+ — bevaka öppningsvalet
  och att 6-5:an visas begripligt i rond 2 (reverse in i högfärgen).
- **2♣ dör inte i delkontrakt + systems-on efter `2♣–2♦–2NT`** — bevaka
  fit-sökningen; kravstegen kan välja trubbig färg (= fel färg-spåret, NU);
  slam efter 2♣ ännu tunn.
- **#31 Inget svagt hoppskift:** svag 6-korts hf svarar 1♥/1♠ — säg till om en
  spärrig hand borde fått hoppa.
- **#30 Stark jämn 19+ öppnar 2NT** (kvalitet, startpoäng ≥20) + sang-visning
  efter minorhöjning i konkurrens (3NT-accept från 8 hp) — bevaka golven.
- **Flerronds-konkurrens A+B+C (§5.9/§7.1):** tävlar/återöppnar i rond 2+;
  C-golvet ~8 stödpoäng; trap-pass kan konverteras till straff — bevaka alla tre.
- **"Låna en kung" i balansering (§7.1):** inkliv från 5 hp, X från 9, 1NT
  11–14 — säg till om boten väcker givar för lätt.
- **Öppnarens rond-2 i konkurrens efter ny färg/1NT (§5.8):** cue = 15+,
  18+ = utgång; cue väljs medvetet före straffdubbling — bevaka.
- **Störda krav = RONDKRAV (§5.5):** fria bud/reverse i konkurrens tvingar ett
  svar men aldrig utgång i onödan — bevaka båda hållen.
- **#26/#27 Utgångskrav passas aldrig off-book** (cue-höjning + höjd 2/1) —
  bevaka att rätt utgång nås, inte för högt.
- **5♣/5♦-utgång nåbar efter inverterad minor** (svag sidofärg-regeln) —
  bevaka 5m-mot-3NT-valet åt båda hållen.
- **#24/#25 Motspelarens kast-vakt** (sakar inte bort garderande honnör) +
  1NT-återbudets nya förklaringstext.
- **#23 Takeout-X:** 17+ enfärgshand X→färg billigast med flerronds-
  fortsättning; ⚠️ konservativ game-dom efter stödhöjning (18+/21+-golv,
  ägaren ville finslipa i spel); tvåfärgs-X 4-4 (10+) — se budsystem.md §7.3.
- **Inklämt konkurrensläge (delbit 6):** öppnarens X = game try (ej straff),
  18+ = 4M — säg till om golven känns fel.
- **DONT mot deras 1NT** (golv 8 hp direkt / 6 balansering).
- **Försvar mot svaga tvåor/spärrar** (takeout-X 12–13 hp; mot spärr 14 —
  medvetet stramare).
- **Svar när de stör VÅR öppning (delbit 4):** X/XX från 8 hp mot DONT;
  XX 10+ efter deras takeout-X — bevaka golven.
- **Straffdubbla flykten efter vår XX (delbit 5)** — varje flyktbud dubblas;
  säg till om det känns för aggressivt.
- **Straffdubbling mot ägaren:** bottarna kan nu straffdubbla ÄGAREN vid
  offringar på 3-läget+ (poängsystemet). Säg till om det känns för aggressivt.
- **Essfrågor utan formell trumf / toppsekvenser andra hand / 4M-pass efter
  transfer-3NT** (felrapport #10–#13) — nya bot-beteenden att hålla ögonen på.
- **Michaels & essfrågor i fria auktioner; motspelarna sparar torra ess**
  (felrapport #6/#7/#9).
- **Balansering mot ägaren:** bottarna balanserar nu även MOT ägaren
  (symmetriskt — korrekt bridge, men säg till om det känns fel; felrapport #5).
- **Öst över spärrhöjning** (1♣–2♥–X–3♥ → konkurrera 3♠ eller passa?): NYTT
  frivilligt läge, boten passar — ägarbeslut om det känns fel (felrapport #1–4).

### 🟢 NÄST (max 3, i ordning)
1. **Etapp 4: F1-resten — familj B (2♣) + C:s reverse/hoppskift** — byggs på
   de ärliga slamportarnas mönster (kaptensregeln mot visade intervall).
2. **Etapp 5: revisorns topplista vidare** — missad utgång (näst största äkta
   posten) och/eller B13 — förfina öppnarens återbud efter inverterad
   minorhöjning; ägaren väljer utifrån ny mätning.
3. **Etapp 6: F2 — datadriven detektorkedja** (E1) — underhållbarhet innan
   fler konkurrenskonventioner läggs på `decideCall`-kedjan.

### ⚪ SENARE (oordnat — hämtas upp till NÄST en i taget)
- **Felrapport #36 — större kort på mobil (2026-07-07):** ägaren har stora
  fingrar och vill ha större tryckytor för korten i Spela kort på mobilen.
  Ren UI-justering (kortstorlek/tryckyta i `cardLayout.ts`/`Felt.tsx`) —
  hanteras när budgivningsspåret tillåter, eller ihop med faceliften.
  Issuen hålls öppen tills fixad.
- **Fler budträningsgivar + "Vill du träna något speciellt?"-dropdown (ägarens
  4-punktslista punkt 1, 2026-07-06):** data i `src/data/exercises/*.json` +
  `EXERCISES_BY_THEME` i `bidding.ts`; facit bör knytas till motorns egna svar
  så det aldrig lär ut fel. (Punkt 2+4 = klara; punkt 3 "sondera budsystemet på
  djupet" = gjord 2026-07-07 via budsystem-revisionen + F1.)
- **B13 — förfina öppnarens återbud efter inverterad minorhöjning (2026-07-07):**
  dagens återbud är grova (stopp-visning kräver 4+ kort i färgen → en 17 hp med
  6-korts minor visas som "minimum 3m") → ärliga slam-misser. Se
  `docs/budsystem-revision.md` B13.
- **Spelmotor-kvalitet: spelföring + försvar (felrapport #32 + #34, uppskjutet
  2026-07-07):** två kortspels-kvalitetsluckor, ägarbeslut att skjuta upp till ett
  dedikerat spelmotor-spår (`docs/bot-hjarna.md`). (1) **#32 – spelföraren etablerar
  inte lång färg:** i 3NT drog boten (Öst) ♥AKT och krossade träkarlens ♥QJ i stället
  för att sätta upp den långa rutern (♦KJT863) medan hållen fanns kvar → 3 bet. Kräver
  spelplanering (räkna stick, etablera lång färg före honnörer). (2) **#34 – slarvigt
  försvar mot 1NT ("allt"):** försvaret duckade billigt i trick 1 (Nord ♥5 under
  partnerns utspel i stället för tredje-hand-högt). Kräver bättre motspels-heuristik
  (tredje-hand-högt, honnörsspel). Båda i `play-bot.ts` (heuristik + Monte-Carlo).
  Plockas upp när ägaren vill investera i spelkvalitet.
- **TP till §7-inkliven (2026-07-05, ägarbeslut vid "låna en kung"):** §7-lagret
  (`overcall`, `advanceOvercall`, DONT, försvar mot svaga tvåor) räknar fortfarande
  **rå HP** — TP (form/fördelning) har aldrig nått dit. Att låta balanserings- OCH
  direkt-inkliv räkna TP är en riktig förbättring (en formstark 8:a kliver in), men
  **additiv** ovanpå "låna en kung" (som är sits-spaken), inte en ersättare. Eget
  test-låst steg (som TP-stegen A–F). Plockas upp när ägaren vill bredda TP till §7.
- **Advancer-rabatt efter balansering (2026-07-05):** partnern som SVARAR en
  balansering vet ännu inte att balanseraren kan vara en kung lättare → kan
  övervärdera tillbaka och driva för högt. En symmetrisk "räkna en kung mindre när
  du svarar en balansering" saknas. Plockas upp om en giv visar att paret överbjuder.
- **17+ stark enfärgshand EFTER två bjudna färger (takeout, 2026-07-05):** en 17+
  enfärgshand som borde upplysningsdubbla när motståndarna redan bjudit två färger
  (t.ex. 1♦–P–1♥) gör det INTE — där följer `decideCall` en färdig buildAuction-
  linje som passar handen, så live-hanteraren (`maybeTakeoutOfResponse`, som bara
  gör 4-4) når aldrig fram. Att tvinga den starka dubblingen där kräver att den
  generativa linjen i `auction.ts` (`buildAuction`) modellerar inklivet — ett
  grundläggande ingrepp. Öppningsfallet + 4-4-fallet är klara & live (felrapport
  #23, §7.3). Plockas upp om en giv bevisar att luckan svider.
- **Auto-facit på hela given i webworker (R3 fynd #3 del 2):** visa spelförarens
  double-dummy-optimum automatiskt i resultatdialogen. Byggdes synkront men
  backades — helgivs-DDS från utspelet är för tung (probe: 79/80 kontrakt gav upp
  efter ~1,7 s, spränger 2M-nodbudgeten → skulle frysa + nästan alltid "för tung").
  Kräver bakgrundstråd (mc-worker) med möjliga långa väntetider, eller snabbare
  lösare. Del 1 (budhint "Motorn hade valt X") är redan gjord + live.
- **Kanoniska linjen passar ut ostörda tvåfärgsinkliv** (fynd felrapport #7,
  2026-07-03): `buildAuction` (`auction.ts`) kan stänga en linje som
  1♠–2NT–P–P–P — advancern ska aldrig passa ostört (ägarbeslut FAS 10).
  Live-budlådan är lagad; luckan finns bara i förbyggda linjer (Budvisningen
  m.m.). Trä in `advanceTwoSuiter` i linjens konkurrensrond.
- **Svårighetsnivåer på bottarna** (ägarbeslut: SENARE, ej del av FAS 11 MED).
- **Bot-hjärnans B2 (cash-ordning) + Steg C (rätta räkningen)** — villkorade:
  byggs bara om en facit-giv bevisar behovet (`docs/bot-hjarna.md`).
- **Motspelarnas kast-vakt (honnörs-blottning KLAR 2026-07-05, felrapport #25):**
  försvaret sakar inte längre bort en honnörs gardering (`defenderGuardDiscard`).
  KVAR: bredare försvarsinferens (kasta rätt när partnerns hand är okänd —
  längdparitet, signalering, skvis-försvar) kräver inferens om partnerns hand
  (eget arbete). Plockas upp om en facit-giv bevisar behovet.

### 🅿️ PARKERAT (medvetet INTE nu — sluta väga in i beslut)
- **FACELIFTEN / den visuella omgörningen (parkerad 2026-07-20 på ägarbeslut):**
  hela designspåret vilar — Claudes "Klubbrummet"-mockup (privat artifact
  `claude.ai/code/artifact/5b9f5e2a-fe71-4dbc-aaeb-188a5a2376b9`), ägarens
  Claude Design-utforskning med de färdiga promptarna, och ombyggnaden av
  appen efter godkänd design. Återupptas BARA när ägaren säger till. Låsta
  ramar gäller fortfarande då: emerald, svarta spader, guldserifen. Tokens +
  komponentstrukturen (UI-overhaulen) är redo, så bygget är billigt när det
  återupptas.
- **DDS-facit på tunga fulla givar:** känd gräns (nodbudget). Ej fel.
- **Off-book §7 bredd** (inkliv över 1NT/svaga tvåor/spärrar; balansering
  BYGGD 2026-07-03 via felrapport #5 — kvar här: "låna en kung"-lättnaden,
  dvs. lättare krav i balanseringssits än direkt sits).
- **"Framkalla slutbud"-väljaren** (ägaridé) + **webworker för DDS-facit**.
- **Mathe mot stark konstgjord 1♣ (R1 Fynd #2 delbit 3) — FRAMTIDSIDÉ, ägarbeslut
  2026-07-04.** Funktionen `defendStrongClub` (`defense-conventional.ts`) är
  färdig + enhetstestad men medvetet EJ inkopplad, för i vårt 2/1-system är 1♣
  en NATURLIG öppning (den starka handen öppnar 2♣) → en stark konstgjord 1♣ kan
  aldrig dyka upp, så Mathe har inget läge att utlösas i. Mot naturlig 1♣ räcker
  vanliga inkliv/upplysningsdubbling (redan inkopplat via `maybeOvercall`).
  **Plockas upp först den dag vi lägger till FLER budsystem** (t.ex. stark klöver/
  Precision) — då blir den relevant, antingen för att bottarna spelar systemet
  själva eller möter en motståndare som gör det. Kopplas då in på samma sätt som
  DONT/svaga-två-försvaret (detektor i `buildAuction`). Se
  `docs/audit/r1-budsystem.md` (Fynd #2, delbit 3).

## Arbetsrutiner (följ varje gång)
- **Vid sessionsstart:** följ 🟢-checklistan i `docs/arbetsrutiner.md`.
- **Vid sessionsslut:** följ 🔴-checklistan i `docs/arbetsrutiner.md`.

## Vad det här är
Interaktiv webbapp för att lära sig och spela bridge (kortspelet).
Användaren ska kunna spela olika händer och lära sig olika budsystem.
Allt körs i webbläsaren, gratis-hostat på Vercel (flyttat från GitHub Pages
2026-07-05, Steg A Del 1).
- **Appen heter `RebidZ`** i gränssnittet (ägarens eget namn, beslut 2026-07-02).
  **Repo och URL förblir `Learn-Bridge`** (medvetet – byt inte). Ser du "RebidZ" i
  koden och "Bridge-app" i äldre text är RebidZ det rätta produktnamnet.
- **Designriktning (låst):** Synrey-inspirerat uttryck, **emerald-palett**, egen
  stil tillåten bortom Synrey. **Spader är SVARTA (ägaröverride – ändra INTE
  tillbaka till konventionell färg).** Läs de verkliga färgerna i `src/index.css`,
  anta dem inte. Framtida plattform-ambition (konton/multiplayer): `docs/framtid-
  multiplayer-plattform.md` = PARKERAT tills ägaren säger "kör".
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
> **HOSTING FLYTTAD TILL VERCEL 2026-07-05 (Steg A Del 1).** Gamla GitHub Pages-
> workflowen (`deploy.yml`) är INAKTIVERAD (`workflow_dispatch`-endast, filen kvar
> som referens). Fortfarande ENDAST statiska filer / client-side – ingen backend
> (det kommer i ett senare, separat steg enligt `docs/framtid-multiplayer-plattform.md`).
- Statisk/client-side hosting. Ingen server, databas eller backend-kod (än).
- Auto-deploy: **Vercel** bygger & publicerar automatiskt vid varje push till main
  (kopplat via Vercels GitHub-app). Ägaren kör ALDRIG bygg-kommandon själv – push
  räcker. Vercel-projekt: `learn-bridge` under teamet `rebidz` (Hobby/gratis).
- **Test-/typgrind före live (R5-fynd #1, nu i `vercel.json`):** Vercel-bygget kör
  `npx tsc && npm test && npm run build` (buildCommand i `vercel.json`). Rött test
  eller typfel → bygget failar → ingen publicering. Ändra aldrig bort den grinden –
  den är enda automatiska skyddet mellan koden och det som blir live.
- Vite `base` MÅSTE vara `/` (Vercel serverar från domänens rot), annars blir sidan
  blank. **Låst av ett vaktest** (`src/deploy-config.test.ts`, R5-fynd #2) – bryter
  du base failar testsviten. (På gamla Pages var det `/Learn-Bridge/`.)
- **Rollback & "senast gröna live" (R5-fynd #4):** varje funktion mergas med en
  egen `--no-ff`-mergepunkt → backa en hel funktion med
  `git revert -m 1 <merge-sha>`. Vilken commit som just nu ligger publicerad =
  den senaste **Ready**-deployen i Vercel-dashboardens "Deployments"-flik (märkt
  Production). Det finns ingen separat tag/markör i repot; Vercel-historiken är facit.
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
  2NT ur §7-motorn. *(Balansering + inkliv över 1NT/svaga tvåor/spärrar byggdes
  senare – R1 Fynd #2 delbit 1–2, live. Slam-quirken är LÖST 2026-07-07. Vad som
  är NÄST styrs av projektkartan högst upp, inte av denna rad.)*
- Budmotor byggs i `src/lib/engine/`, test-drivet (`npm test`).
- **Innan du rör budlogik:** läs "Budmotorns tre auktionslager + `open`-handoff"
  i `docs/status.md` — det avgör om ny logik hör hemma i `auction.ts` (on-book),
  `auction-live.ts` (konkurrens/off-book) eller `auction-interpret.ts` (förklaring).
- Detaljerad implementationsstatus: **`docs/status.md`**
- Byggordning framåt: **`docs/arbetslista.md`** (NB: pivoten ovan går före den gamla
  FAS-ordningen i felsökningsplanen).

## Konkreta fakta om detta projekt (för deploy)
- GitHub-repo: **PGreen90/Learn-Bridge** (publikt). Repo-namnet byts INTE.
- Live-URL: **https://rebidz.com** (egen domän, Steg A Del 2 klar 2026-07-05;
  `www.rebidz.com` → 308 hit). Reserv: `learn-bridge-topaz.vercel.app`. Gamla
  `pgreen90.github.io/Learn-Bridge/` är ur bruk (blir blank, base=`/`).
- Vite `base` = **"/"** (Vercel serverar från roten).
- Hosting: **Vercel**, projekt `learn-bridge`, team `rebidz` (Hobby/gratis),
  kopplat till GitHub-repot via Vercels GitHub-app → auto-deploy vid push till main.
  Build-grinden ligger i `vercel.json`.
- Auth: gh CLI är inloggad som PGreen90 (device-flow) och är git
  credential helper. Pusha via `git push`. Scopes inkl. `workflow`.
- Node.js ligger i `C:\Program Files\nodejs\` (lägg den först i PATH
  i nya shells: npm/node finns inte alltid på PATH automatiskt).

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
  det fungerar på statisk hosting utan serverinställningar. Byt INTE till
  BrowserRouter utan att lägga till SPA-rewrites (på Vercel: en rewrite av alla
  vägar till index.html i `vercel.json`).
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
- `npm run build` – byggs automatiskt av Vercel vid push, sällan manuellt
## Vad man INTE gör
- Lägg aldrig till backend/server/databas i nuläget – hostingen är statisk
  (backend planeras i ett separat, senare steg, se framtidsdoket).
- Glöm aldrig Vite `base` = `/` (Vercel serverar från roten; låst av vaktestet).
- Bygg inte alla budsystem på en gång – ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
