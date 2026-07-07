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


### 🔵 NU — UI-OVERHAUL steg 1 av 5: semantiska färg-tokens (ägarbeslut 2026-07-07)
> **NU (2026-07-07 kväll):** ägaren valde UI-overhaul efter Fables
> arkitektur-diagnos av UI-lagret. Diagnosens friska delar: motor/UI-
> separationen är ren (overhaulen kan inte skada bridge-logiken), `Felt.tsx`/
> `cardLayout.ts` är rätt sanningskällor, tokens-grunden finns i `index.css`.
> Fyra problem: (a) `Play.tsx` 1431 rader = hela spelet i en fil (PlayTable
> ~15 useState + worker), (b) färger utspridda — råa `slate-*` 235 + `emerald-*`
> 143 träffar i 18 UI-filer mot ~41 token-användningar, (c) mörkt läge ojämnt
> (`Play.tsx` 0 dark-varianter, 17/19 komponenter 0 → vita rutor på mörkt bord),
> (d) 11 handrullade overlay/dialog-byggen utan gemensamt beteende; plus 0
> UI-test (alla 1090 vaktar motorn). **Femstegsplan, ett steg i taget:**
> (1) **semantiska tokens** (yta/text/dämpad/kant/accent i `index.css`, migrera
> UI-filerna) ← NU, (2) delad `<Dialog>`-komponent, (3) splittra `Play.tsx`
> (logik-hooks + fas-filer), (4) mörkt läge jämnt (mest gratis av steg 1),
> (5) röktester på nyckelflödena. Steg 2–5 ligger i NÄST.
>
> **Bakgrundsläget:** inga öppna felrapporter (#1–#34 stängda eller medvetet
> uppskjutna, se ⚪ SENARE). Steg A (Vercel + rebidz.com + PWA) KLART & LIVE
> sedan 2026-07-05 → **Beslut A avklarat**. **Beslut B** (konton/multiplayer/
> tävlingar) är ett separat STORT spår — startas bara på uttryckligt ägarbeslut
> (`docs/framtid-multiplayer-plattform.md`).
>
> **Senast klart & LIVE (2026-07-07 kväll, mergepunkt `1ce2982`, deploy grön):
> ÄRLIGA SLAMPORTAR — tjuvkiken borttagen.** Ägarbeslut efter Fables
> totalgranskning: bottarna bjuder som MÄNNISKOR — varje budbeslut fattas på
> EGEN hand + vad partnern VISAT via buden (intervall/löften), ALDRIG på
> partnerns faktiska kort; hellre missa en slam än kika. Gäller även
> facit-linjen/Budvisningen (samma `buildAuction`). Ägarens två systemval:
> (1) **inbjudningar i kanske-zonen** (31–32 mot visat minimum; kvantitativ 4NT
> över sang, 5M/4m i trumf; partnern accepterar över blott minimum),
> (2) **ingen kontrollkoll** (lita på poängen + nyckelkortssvaret;
> `pairControlsSideSuits` och motorns auto-cue-rond BORTTAGNA — cue-ronden bar
> bara gaten och orsakade gamla slam-quirken). Byggt: `slam-auction.ts`
> omskriven (**kaptensregeln**: egen hand + visat minimum ≥33 driv / 31–32
> inbjudan; nyckelkort HÄRLEDS ur svaret + egen hand; tvetydighet → anta högt
> mot visad 15+, annars lågt + PARTNER-RÄTTELSE till 6; storslam kräver
> visshet), `nt-slam.ts` (Gerber härleder ur svaren; ny kvantitativ
> 4NT-inbjudan 19–20 mot 1NT-återbudet), `auction.ts` (visade intervall per
> återbudsregel: 1NT-återbud 12, hopphöjning/hopp-återbud 16, Jacoby/inverterad
> per rebid, splinter-relä 15, MSS 15); `familyAFitTrump` läser BARA svararens
> hand (6+ egen hf / 5+ i öppnarens minor; gömda 4-4-fits jagas ej). **Kända
> ÄRLIGA MISSER (medvetna, test-låsta):** #29-originalgiven stannar i 3NT
> (13 hp mot visade 16–18 < zonen); familj A-givens 4-korts minorfit drivs ej.
> Slamfrekvens (probe 60 000 givar): lillslam ~1/120, storslam ~1/4300 —
> mänskligt. **Blottad systemlucka → B13 i revisionen:** inverterad
> minor-återbud är grova (17 hp + 6m visas som "minimum") → ärliga misser där.
> Docs: budsystem.md §5.2/§5.7/§6 (principen)/§6.2-motoranmärkning/§9;
> budsystem-revision.md B8–B13. **1090 test gröna, tsc rent, deploy grön.**
> Se 👀 Bevaka (översta posten).
>
> **F1 — bredda slam-utforskningen (PAUSAD → NÄST 1).** En probe (40 000 givar,
> DD-lösta) delade slam-missarna i fyra familjer. **KLARA & LIVE:** **A** (efter
> `1m–1M–1NT`: jämn → Gerber 21+/kvantitativ 4NT 19–20; obalanserad med säker
> fit på egen hand → 4NT RKC), **C:s hopphöjning** (`1x–1M–3M` → driv 17+/
> inbjudan 5M 15–16), **D** (hängande cue-quirken stängd — auto-cue-ronden är
> numera helt borttagen). Alla styrs av de ärliga portarna ovan (äldre
> beskrivningar i historiken med kontroll-gates/parets faktiska poäng =
> kik-eran, gäller inte längre). **KVAR (= NÄST 1):** familj **B** (2♣) +
> C:s systerfall **reverse** (`1♣–1♥–2♦`) och **hoppskift** (`1♦–1♠–3♣`) —
> störst men rörigast (ingen överenskommen trumf; vissa reverse-auktioner
> kollapsar t.o.m. under utgång, eget problem). Byggs på det ärliga mönstret.
>
> **Historik:** alla äldre lägesrapporter (mobil-UI-fixar, felrapporter
> #23–#34, 2♣-utgångskravet, systems-on, Steg A-detaljerna Del 1–3, R1 Fynd
> #2-delbitarna, kontraktväljaren m.m.) är flyttade till **`docs/historik.md`**
> (2026-07-07 — de innehöll inaktuella ögonblicksrader som "EJ PUSHAT"/"#29
> kvar öppen"; facit är: allt live, alla felrapporter stängda/uppskjutna).
> Detaljerad status: `docs/status.md`. Budsystemets hälsobild + körordning
> F1–F6: `docs/budsystem-revision.md`.

### 👀 Bevaka i spel (aktiva noteringar från nyligen byggt — säg till om det känns fel)
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
- **Advancern hoppar inte förbi utgång (#33, 2026-07-07, NYTT & LIVE):** när du och
  din bot-partner tävlar/cue-bjuder efter en upplysningsdubbling höjer boten inte
  längre förbi utgång på inbjudningsvärden (förr kunde en "inbjudande hopp" bli 7♦
  över partnerns 5♦). **Bevaka:** passar boten lagom (den saknar ännu slam-drivning
  som advancer — med äkta slamvärden kan den nöja sig med utgång; säg till om den
  borde utforskat slam).
- **6-5-öppning (#32, 2026-07-07, NYTT & LIVE):** med 6-korts lågfärg + 5-korts
  högfärg öppnar boten nu **högfärgen med 12–15**, men **lågfärgen med 16+** (för att
  reverse:a in högfärgen). **Bevaka:** (a) väljer den rätt (öppnar 1♦ på rätt starka
  6-5, 1♠/1♥ på minimum)? (b) *återbudet* efter en 16+ 1♦-öppning — visar den 6-5:an
  begripligt (reverse in i högfärgen), eller blir fortsättningen konstig? Säg till om
  6-5:an tappas bort i rond 2.
- **2♣ dör inte längre i delkontrakt + systems-on (2026-07-07, NYTT & LIVE):**
  öppnar din bot-partner en stark 2♣ drivs auktionen nu alltid till minst utgång
  (förr dog ~64 % i delkontrakt). **Efter `2♣–2♦–2NT`** (öppnaren 22–24) använder
  svararen nu **Stayman/transfer** som mot en 2NT-öppning → hittar 4♥/4♠-fit i
  stället för att blint bjuda 3NT. **Bevaka:** (a) hittar paret rätt högfärgsfit
  lagom ofta, och landar det inte i fel strng? (b) svaga händer med 5-korts högfärg
  signar av i 3♥/3♠ (rätt), 0–2 hp passar 2NT (rätt) — säg till om något känns fel.
  (c) I ANDRA 2♣-auktioner (positivt svar, färgrebud) garanterar kravlogiken utgång
  men den forcerade minimi-stegen väljer inte alltid finaste färgen (t.ex. 5♣ där
  4♠ var bättre) — säg till om en sådan känns trubbig. (d) Slam-utforskning efter
  2♣ är fortfarande tunn (uppföljning knyter an till #29).
- **Inget svagt hoppskift längre (#31, 2026-07-06, NYTT & LIVE):** svarar du på
  partnerns öppning med en svag 6-korts högfärg bjuder boten nu **1♥/1♠** (lågt,
  rondkrav), aldrig 2♥/2♠. **Bevaka:** håller boten budgivningen lagom låg, eller
  borde en riktigt svag spärrig hand ibland fått hoppa? (Ägarprincip: håll låg när
  partnern öppnat.) Öppnaren förklarar fortfarande ett MANUELLT hoppskift rätt om du
  själv hoppar.
- **Stark jämn hand efter minorhöjning i konkurrens (#30, 2026-07-06, NYTT & LIVE):**
  (a) en jämn 19 med extra kvalitet (ess/kvalitetsfärger, startpoäng ≥20) öppnar nu
  **2NT** i stället för 1 i färg — **bevaka** att den inte blåser upp platta 19:or.
  (b) När din minor höjs i konkurrens visar öppnaren styrka i sang (3NT 20+ /
  2NT-inbjudan 18–19 med stopp); höjaren accepterar 3NT från **8 hp**. **Bevaka:** når
  paret 3NT lagom ofta, eller för lätt/tungt? Säg till om accept-golvet (8) känns fel.
- **Flerronds-konkurrens A+B+C (§5.9 + §7.1, 2026-07-05, LIVE):** störda
  auktioner säljs inte längre billigt i rond 2+. (A) Öppnar du 1 i färg, de kliver in,
  partnern PASSAR och de konkurrerar (`1♣–(1♠)–P–(2♠)`) → du tävlar nu (egen 6+ färg,
  eller X med kort i deras färg) i stället för att passa. (B) Samma men de passar också
  (`1♠–(2♥)–P–P`) → du återöppnar i utpassningssitsen (X med kort i deras färg → **din
  partner kan konvertera till straff**; egen 6+ → rebjud). (C) Din partner klev in på
  2-läget och de hittade sin fit (`1♠–(2♥)–2♠`) → du (advancern) tävlar nu **3♥** med
  3-korts stöd (9-korts fit, lagen om totala stick). **Bevaka:** (a) återöppnar/tävlar
  boten lagom ofta, eller väcker den given för lätt? (b) C:s golv är **~8 stödpoäng** –
  en riktigt svag hand med 9-korts fit passar (medvetet, tävlar inte på en bust); vill
  du ha renodlad "lag om totala stick" (tävla nästan alltid med fiten) → säg till, det
  är en trösklsjustering. (c) B:s partner som trap-passar och konverterar till straff –
  slår det rätt (blir det verkligen en straff, inte en flykt som får spela billigt)?
- **"Låna en kung" i balansering (§7.1, 2026-07-05, NYTT & LIVE):** i
  utpassningsläget (deras 1-lägesöppning + två pass) kliver boten nu in ~3 hp
  lättare — enkelt inkliv från 5 hp, upplysnings-X från 9 (form 7), återöppnings-1NT
  11–14. **Bevaka:** (a) balanserar boten lagom ofta, eller väcker den given på för
  skräpiga händer? (b) 2-läges-inkliv på ~5 hp kan bli aggressivt (lättnaden gäller
  även där) — säg till om det svider. (c) advancern (som svarar balanseringen) vet
  ännu INTE att partnern kan vara en kung lättare → kan övervärdera tillbaka; en
  "advancer-rabatt" är en möjlig uppföljning. (d) den starka 15–18 jämna handen i
  balansering dubblar först (om form) i stället för 1NT; saknar den form (lång i
  deras färg) kan den passa — ovanlig kant, säg till om den dyker upp.
- **Öppnarens rond-2 i konkurrens efter partnerns ny färg / 1NT (§5.8, 2026-07-05,
  NYTT & LIVE):** öppnar du 1 i färg, partnern svarar en fri ny färg / 1NT
  och motståndarna bjuder om (t.ex. `1♥–(1♠)–2♣–(2♠)`), passar öppnaren inte längre
  bort en stark hand. Extra visas med **cue i deras färg** (15+, hitta rätt utgång),
  18+ med högfärgsfit → 4M, 18+ jämn m. stopp → 3NT, 15–17 m. högfärgsfit →
  inbjudande hopphöjning; minimum tävlar med en egen 6+ färg eller en fit, annars
  pass. **Bevaka:** (a) cue:ar boten lagom ofta (inte varje 15-poängare som borde
  passat)? (b) hittar den rätt utgång efter cuet, eller överbjuder den? (c) medvetet
  bortval: i det här läget väljs **cue framför straffdubbling** på extra-händer –
  säg till om en straffdubbling av deras bud borde ha varit rätt i stället.
- **Störda krav = RONDKRAV (§5.5, 2026-07-05, NYTT):** klev en motståndare in och du
  gjorde ett **fritt bud** (ny färg, t.ex. `1♦–(1♠)–2♣`) eller öppnaren **reverse:ade**
  (`1♣–1♥–(1♠)–2♦`), så passar din partner inte längre — hen tvingas svara med ett
  naturligt minimibud (`competitionForce`/`honorForce`). Men bara **rondkrav**: buden
  får stanna UNDER utgång (ett inkliv "lånar" utrymme). **Bevaka:** (a) svarar boten
  förnuftigt (rätt naturligt bud, inte ett tvångsbud som låter konstigt)? (b) driver
  den ALDRIG till utgång i onödan här (2/1 i konkurrens lovar värden men ej utgång)?
  Hopp, cue i deras färg och en passad svarare undantas medvetet — säg till om ett av
  dem borde ha tvingat fram ett svar ändå.
- **Utgångskrav får aldrig passas OFF-BOOK (felrapport #26 + #27, 2026-07-05,
  NYTT):** två luckor där boten passade en KRAV-auktion när du bjudit off-book
  (motorn hade planerat en annan linje). (1) **#26** – efter din cue-höjning
  (1♣–2♥–3♥) fullföljer din partner nu utgångskravet efter öppnarens svar
  (`answerCueBidderRebid`): 3NT med stopp i deras färg, annars utgång i den
  överenskomna färgen. (2) **#27** – efter ett äkta 2-över-1 (utgångskrav) som
  öppnaren höjer sätter svararen nu minst utgång även off-book
  (`answerTwoOverOneRaise`) – uppstod när Syd öppnade den svagare handen så
  motorns on-book 2/1-fortsättning aldrig fyrade. Bara off-book berörs; on-book
  orört. **Bevaka:** når boten rätt utgång (4M/3NT/5m) och blåser den aldrig för
  högt? Säg till om den t.ex. borde utforskat slam i stället för att bara sätta
  utgång.
- **Lågfärgsutgång 5♣/5♦ nu nåbar (Kontraktväljaren delsteg 1, 2026-07-05, NYTT):**
  motorn kunde förr aldrig bjuda 5♣/5♦ (valde alltid 3NT). Nu, efter inverterad
  minor: en svarare med lågfärgsfit + en **osparrad färg** utforskar via 2m och
  landar i **5m** när paret inte kan hålla alla färger (i stället för att chansa
  3NT). Ägarregel: utforska bara med en **riktigt svag** färg (♠xx/♥xxx utan
  honnör). **Bevaka:** (a) drar boten till 5m när 3NT egentligen var säkert? (b)
  chansar den fortfarande 3NT med en helt öppen färg? Trösklar i `responses.ts`
  (`hasWeakSideSuit`) + `responder-rebids.ts` (inverterad-minimum → 5m).
- **Motspelarens kast-vakt + 1NT-återbudsförklaring (felrapport #24 + #25,
  2026-07-05, NYTT):** (1) **spelfel #25** – en försvarare som sakar blottar inte
  längre en honnör i onödan: ny "motspelarens kast-vakt" (`play-bot.ts`
  `defenderGuardDiscard`) sakar hellre ur en färg UTAN skyddsvärd honnör (en J+
  som ännu kan slås av ett högre ospelat kort), ärligt räknat ur egen hand +
  träkarl. Löser bara honnörs-blottning; bredare försvarsinferens (kasta rätt när
  partnerns hand är okänd) är fortsatt SENARE. Säg till om vakten någon gång
  behåller fel kort. (2) **budförklaring #24** – öppnarens 1NT-återbud efter
  färgöppning beskrivs nu som "balanserad minimihand ~12–14 hp" (ej "svag");
  ingen ändrad budgivning, bara texten (`auction-interpret.ts`).
- **Takeout-doublingar (felrapport #23 + stark-hand-fortsättning + tvåfärgs-X,
  2026-07-05, NYTT):** (1) en **17+ stark enfärgshand** upplysningsdubblar en öppning
  och visar sedan sin färg via ett **starkt återbud** — färgen **billigast (rondkrav,
  inget hopp)**; hopp-till-utgång är borttaget (kan bli katastrof mot 0 hp). Hela
  **flerronds-fortsättningen är nu byggd & test-låst**: partnern tvångssvarar
  (stödstege m. 3-korts stöd: enkel/hopp/utgång/cue efter hp — annars egen 5+ /
  näst längsta objudna färg), den starka handen dömer game på TP (**6+ färg & 22+ TP
  → hopp till 3-läget = utgångskrav**, annars lägsta nivå), partnern svarar 3-hoppet
  (utgång m. 1–2 stöd / 3NT nekar). **⚠️ Bevaka särskilt:** den starka handens dom
  EFTER en **stödhöjning** (partnern visade fit) körs på en medvetet **konservativ
  default** (accepterar utgång med tydligt tillägg: hopphöjning→18+ hp, enkel
  höjning→21+; cue→utgång som minimum; slam-utforskning ej byggd) — ägaren ville
  finslipa detta i spel, säg till om trösklarna känns fel. (2) När motståndarna
  bjudit **två färger** (1♦–P–1♥) dubblar en **4-4-hand (10+)** de objudna färgerna;
  advancern svarar aldrig i deras egen färg. Regler i `docs/budsystem.md` §7.3.
- **Öppnarens rond-2 i inklämt konkurrensläge (R1 Fynd #2 delbit 6, NYTT):** efter
  `1M–(inkliv)–2M–(deras inklämda bud)` passar öppnaren inte längre blint. Med
  minimum + 6:e trumf konkurrerar den 3M; med utgångsintresse (~15–17) dubblar den
  (**X = maximal dubbling = game try**, INTE straff i det läget); med 18+ bjuder den
  4M. Partnern svarar X:et 4M (max) / 3M (min). Golv: 15+ = game try, 18+ = utgång
  (speglar den ostörda openerRebidAfterSimpleRaise). Säg till om X-som-game-try
  känns fel, eller om golven bör justeras.
- **DONT mot deras 1NT (R1 Fynd #2 delbit 1):** bottarna stör nu deras
  1NT-öppning med DONT (X/2-läget) — golv 8 hp direkt, 6 hp balansering. Säg till
  om det känns för aggressivt/passivt.
- **Försvar mot deras svaga tvåor/spärrar (R1 Fynd #2 delbit 2, NYTT):** bottarna
  kliver nu in mot motståndarnas svaga 2♦/2♥/2♠ och spärrar (3-läget+) — takeout-X,
  2NT (15–18), cue, naturligt, 3NT. Golv för takeout-X: 12 hp ej sårbar / 13 sårbar
  direkt, 10 hp balansering; mot spärr 14 hp (medvetet stramare — säg till om du
  vill lätta även spärr-balanseringen).
- **Svar när motståndaren stör VÅR öppning (R1 Fynd #2 delbit 4, NYTT):** när du
  öppnar 1NT och en motståndare stör med DONT svarar din bot-partner nu (X/XX =
  straff/värden från 8 hp, egen 5+ färg = naturligt, annars pass) i stället för att
  passa. När du öppnar en svag tvåa/spärr och de takeout-dubblar redubblar partnern
  med 10+ (värden) eller höjer spärrartat med fit. Säg till om golven (8 / 10)
  känns fel.
- **Straffdubbla flykten efter vår XX (R1 Fynd #2 delbit 5, NYTT):** öppnar du
  1NT, de stör med DONT och din bot-partner redubblar (XX = vi äger handen), så
  flyr motståndarna undan till en färg STRAFFDUBBLAR din sida dem nu — varje steg,
  tills de får spela dubblat — i stället för att passa flykten. Utlöses bara efter
  vårt 1NT + XX (inte efter svaga tvåor/spärrar — där äger vi inte handen). Säg
  till om det känns för aggressivt att dubbla varje flyktbud.
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
1. **UI-overhaul steg 2–5** — (2) delad `<Dialog>`, (3) splittra `Play.tsx`,
   (4) mörkt läge jämnt, (5) röktester på nyckelflödena. Ett steg i taget;
   flyttas upp till NU ett och ett när föregående steg är klart. Därefter:
   själva den visuella omgörningen, bit för bit.
2. **F1 fortsättning: familj B (2♣) + C:s reverse/hoppskift** — byggs på de
   ärliga slamportarnas mönster (kaptensregeln mot visade intervall). Gärna
   efter att ägaren spelat ett tag och bekräftat portarna i spel.

### ⚪ SENARE (oordnat — hämtas upp till NÄST en i taget)
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
- ~~**Dubblingar (X/XX) in i slutkontraktet**~~ **KLAR 2026-07-04** (commit
  `0864224`, parallellsession): X/XX följer med genom `contractFromCalls` och
  poängräkningen (`scoring.ts` enligt ägarens poängguide) är byggd.
- ~~**Felrapportering: PAT-i-localStorage-varianten**~~ **KLAR & LIVE 2026-07-05**
  (skicka issuen direkt från appen utan att öppna GitHub). Ägaren sparar en snäv
  fine-grained GitHub-nyckel (Issues: read/write på Learn-Bridge) EN gång i
  Inställningar (`src/lib/github-token.ts`, egen lagringsnyckel `rebidz:felrapport-token`
  utanför `learnbridge:`-prefixet → överlever "Nollställ framsteg"). Finns nyckel →
  `FelrapportDialog` skickar direkt via GitHubs API (`submitFelrapport` i
  `felrapport.ts`, POST `.../issues`), knappen blir "Skicka rapport ✓" + kvitto;
  saknas nyckel → oförändrat (öppnar förifylld GitHub-sida). Fel → svenskt
  meddelande + reservknapp "Öppna på GitHub →". Samma nyckel kan användas på flera
  enheter. 1061 test gröna.
- **Svårighetsnivåer på bottarna** (ägarbeslut: SENARE, ej del av FAS 11 MED).
- **Bot-hjärnans B2 (cash-ordning) + Steg C (rätta räkningen)** — villkorade:
  byggs bara om en facit-giv bevisar behovet (`docs/bot-hjarna.md`).
- **Motspelarnas kast-vakt (honnörs-blottning KLAR 2026-07-05, felrapport #25):**
  försvaret sakar inte längre bort en honnörs gardering (`defenderGuardDiscard`).
  KVAR: bredare försvarsinferens (kasta rätt när partnerns hand är okänd —
  längdparitet, signalering, skvis-försvar) kräver inferens om partnerns hand
  (eget arbete). Plockas upp om en facit-giv bevisar behovet.
- FAS 9 Passad hand, FAS 10 Försvarsbud, FAS 11 Kortspel = **KLARA & pushade**
  (bara kvar här som historik — behandla dem inte som återstående arbete).

### 🅿️ PARKERAT (medvetet INTE nu — sluta väga in i beslut)
- ~~**Slam-quirken** (~0,25 %, Jacoby 2NT→cue→RKC)~~ **LÖST 2026-07-07** (F1 familj
  D; slutgiltigt genom att motorns auto-cue-rond togs bort helt med de ärliga
  slamportarna samma kväll). Facit `auction-slam-jacoby-cue.test.ts`. Behandla
  inte längre som parkerad.
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
