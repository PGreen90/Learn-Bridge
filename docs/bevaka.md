# 👀 Bevaka i spel — aktiva noteringar

> **Vad detta är:** varje gång vi bygger något nytt i budgivningen skrivs en rad
> här om vad ägaren ska hålla ögonen på vid bordet. Listan är **nyast först**.
> CLAUDE.md visar bara de tre senaste — hela listan bor här (flyttat 2026-07-25
> för att hålla projektkartan kort).
>
> **När läser Claude den här filen?** När ägaren säger att något känns fel i
> spel, när en felrapport kommer in, och när en ny fix ska läggas till listan.
> Punkter som stått länge utan klagomål kan strykas — de har passerat provet.

## Negativ-dubblarens preferens + öppnarens höjning av fritt lågfärgsbud (2026-09-02, pliktsvepet K2/K5)
- K2: efter 1x–(1y)–X–P–2z ger dubblaren nu preferens till öppningsfärgen även
  med 6–9 hp (gratis: lika lång eller längre, minst 3 kort; kostar en nivå: 2+
  korts skillnad). **Bevaka:** preferensen på 3-läget med 7 hp (4-2) — känns
  den för hög? K5: öppnaren höjer partnerns fria 2♣/2♦ enkelt (12–13), 3NT/4m
  med 14+. **Bevaka (kvar, ej byggt):** svararens fortsättning efter öppnarens
  rebjudna färg — frö 20262632 `1♦–(1♠)–2♥–P–3♦–P–5♦` med ♥AKJ87542: den
  egna 8-korts färgen ska vinna över en 3-korts minorfit (4♥, inte 5♦).
  Repro: `$env:DUMP='20262632'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts`.

## Höjning på visad längd (2026-09-02, pliktsvepet K3)
- Advancern höjer nu partnerns 1-lägesinkliv på **3-korts stöd från 6 hp**
  (bara till 2-läget); svararen svarar över **1NT-inkliv** (2M / X = straff 10+)
  och över **ovanlig 2NT/Michaels** (3M tävlande, 4M med 10+ stödpoäng).
  **Bevaka:** (a) 3M över tvåfärgsinklivet på 4 små trumf och 0–5 hp — känns
  det för friskt vid bordet? (b) motståndarnas FORTSÄTTNING efter vår höjning
  är inte byggd: 2NT-bjudaren passade 4♥ med 6-5 i minorerna och 20 hp (frö
  20261162) och advancern passade 3♠ med 12 hp och stöd i båda minorerna (frö
  20262021). Kandidater för svepet när vår sidas plikter är klara.
  Repro: `$env:DUMP='20261162,20262021'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts`.

## Inklivaren svarar advancerns cue-höjning (2026-09-02, pliktsvepet K1)
- Efter deras öppning, vårt inkliv och partnerns cue i deras färg (limithöjning+)
  passar inklivaren aldrig längre när motståndarna ligger tysta: 14+ totalpoäng →
  utgång (högfärg) / 3NT med stopp (lågfärg), annars billigaste återgång; cue-
  bjudaren passar återgången med 11–12, driver utgång med 13+ stödpoäng.
  **Bevaka:** (a) 14-gränsen — känns 4M på 14 + limithöjning för tunt/för
  försiktigt vid bordet? (b) lågfärgsinkliv med extra men UTAN stopp återgår
  bara billigast (3m) — säg till om en utgång missas där.

## Fritt bud i stället för negativ X, och fortsättningen (2026-09-02, felrapport #55)
- Svararen bjuder nu sin 5+ högfärg över inklivet (1♦–(1♥)–**1♠**) i stället
  för att dubbla; på 2-läget från 10 hp (1♦–(1♠)–**2♥**). Öppnaren höjer på
  3-korts stöd, svararen bjuder utgång/invit på Bergenpoäng. **Bevaka:** (a)
  fortsättningen efter ett fritt bud på **2-läget utan fit** går fortfarande
  genom den generella off-book-/kravlogiken (probe: 1♦–(1♠)–2♥–P–3♦–P–5♦ på
  26 hp där 3NT/4♥ kan vara bättre) — säg till om öppnaren rebjuder en
  5-korts minor eller partnern blåser 5m där sang låg närmare. (b) Advancerns
  preferens till inklivsfärgen (felrapport #56) kostar ibland en nivå — säg
  till om 3♦-preferensen på 3-1 känns för hög i praktiken.

## Andra hand ser bordet (2026-09-01, speldiagnos S6 — fix behållen)
- Försvarets andra hand går numera UPP och tar sticket när spelföraren leder,
  partnern har VISAT renons i färgen, och kortet slår både det ledda kortet och
  bordets bästa (bara i sang/trumfledning; bordet måste ha kort i färgen).
  Facit: `play-bot-second-hand.test.ts`. Känt mjukt motexempel (frö 20260735,
  −1): det "säkra" sticket kan bli en inpetning. **Bevaka:** går boten upp med
  en honnör där det känns dumt vid bordet — särskilt om den sedan tvingas leda
  ut i en gaffel — säg till med given.

## Monte-Carlo med FÅ lägen tar stora beslut (2026-09-01, speldiagnos fynd 3)
- Rundan 2026-09-01 (rapporten `revisor-output/speldiagnos-rapport-2026-09-01.md`):
  i frö 20260894 (stick 6) maskade spelföraren på ett underlag av bara **6
  samplade lägen** — DD-tappet blev 5 stick i ett slag. S5-robusthetsnätet
  räddar 0-lägen-fallet, men beslut på en handfull lägen har hög varians.
  **Bevaka:** enskilda givar där MC-motiveringen ("jag delade ut N troliga
  lägen") visar ensiffrigt N OCH utfallet blev en stor DD-rörelse. Kandidat om
  det återkommer: minsta antal lägen innan MC får överrida en säker linje —
  utreds ihop med trumfteknik-jobbet (fynd 1), inte separat.
  Repro: `DUMP_SPEL=20260894 npx vitest run src/lib/engine/speldump.probe.test.ts`.

## 6-5-handen: hinner motorn visa 6:e kortet? (2026-08-24, ägarnotering)
- **Budgivningsfråga, ej textfråga.** Med 6-korts lågfärg + 5-korts högfärg (16+)
  öppnar motorn lågfärgen (`minor-regeln`, `openings.ts`) och *planerar* att visa
  högfärgen och sedan lågfärgen igen. Ägarens poäng (2026-08-24): en 6-5 är svår
  att bjuda ut — det kräver att öppnaren är **inne minst tre gånger**, och när
  lågfärgen väl bjuds om har den **bara lovat 5 kort**. **Bevaka:** hinner motorns
  fortsättning (särskilt i konkurrens, t.ex. 1♣–(1♦)–1♠–…–2♣) faktiskt visa den
  6:e lågfärgen och 5:e högfärgen, eller stannar formen halvvisad? Om det skaver i
  spel → kandidat för en budgivnings-fix (utanför budförklarings-NU:t).

## Felrapporter #49 + #51 (2026-08-18) — spelfixar ur "Spela kort"
- **Tredje hand HÖGT bakom en dold spelförare (#51 + ägarnoteringen):** ledde
  partnern en färg och "vinner" bara tills den dolda spelföraren spelar sist,
  spelar försvaret nu högt i stället för att krypa/markera lågt. Två nivåer: (1)
  MÄSTAREN (ess/topp) tas i BÅDE sang och trumf — kan aldrig kosta, och låter mig
  vända (partnerns långa färg i sang, ruff i trumf); (2) utan mästare pressas
  spelförarens honnör med lägsta honnören (KD → D) i **båda** — den gamla "−1 i
  trumf"-noteringen replikerade INTE i A/B-mätning (netto −2 spelförarstick över
  209 trumfgivar, 9 ändrade: 6 bättre / 3 sämre → neutralt-till-svagt-bättre
  försvar; ägarbeslut 2026-08-18). Facit: `play-bot-third-hand.test.ts`.
  **Bevaka:** slösar boten en honnör över ett stick partnern REDAN vann säkert
  (vakten kräver att ett osett högre kort kan slå partnerns kort), eller känns
  honnörstvånget i trumf dumt i någon konkret giv? Säg till.
- **Spelföraren fortsätter sin solida honnörssekvens (#49):** i sang, när
  etableringsgrinden avstår och ingen säker cash finns, utvecklar spelföraren nu
  en solid honnörssekvens (leder ♣Q ur QJT) i stället för att öppningsleda ur
  längsta färgen rakt in i motståndarnas honnörer (Väst ledde ♠8 in i Nords ♠AQ).
  Facit: `play-bot-establish.test.ts`. **Bevaka:** leder boten en sekvens och
  släpper in motståndarna när den hellre borde suttit kvar/cashat — känns
  utvecklingen förhastad i någon sang-giv?

## Speldiagnosen S5 (2026-08-13) — MC-urfallet lagat (fyra fixar, frön 20260772/20260731)
- **Öppningslöftet i poäng (NYAST):** hand-modellen kräver nu `max(hp, startpoäng)
  ≥ 12` av en dold 1-i-färg-öppnare (10 i 3:e hand, 9 i 4:e) i stället för rå
  12 hp — bottarna räknar alltså med att öppnaren kan vara en bra 11:a eller en
  formstark 7 hp/12 TP. **Bevaka:** känns bottarnas slutspel dummare i vanliga
  givar (samplerna rymmer nu fler svaga öppnarhänder — mindre skarp inferens är
  priset för ärligheten)?
- **Robusthetsnätet:** får samplern 0 lägen släpper den budinferenser/signalgolv
  och samplar om på hårda fakta (renonser, kortantal) — MC dör aldrig mer helt.
  **Bevaka:** inget synligt i appen; fel här syns som konstiga MC-val sent i
  extrema givar — rapportera givar där slutspelet känns regellöst.
- **Utspelsavkodningen struntar i trumf/budstyrda utspel:** längd- och
  honnörsgissningen ur öppningsutspelet görs bara i sang utan visade färger.
  **Bevaka:** motspelsbotten kan kännas något mindre "läsande" i sang-givar där
  utspelet faktiskt VAR längsta färgen men auktionen visade färger — säg till om
  försvaret verkar ha tappat läsningen.
- **Tvingade återbud lovar ingen 6:e kort:** svar på negativ X / tvångssvar /
  cue-tvångets återbud räknas som 5+ resp. 4. **Bevaka:** inget beteende ändras
  vid bordet — bara samplerns antaganden; fel syns som ovan.

## Speldiagnosen S4 (2026-08-13) — tävlingslarmens tre fixar (runda 4, brickorna 8+1)
- **Trumfdragningsplanen (NYAST, bricka 1):** spelförarsidan drar nu trumf när
  den kombinerade trumfen vinner styrkeprovet mot de osedda korten (även vid
  jämnt prov — dragningen stoppar ruffarna); svag trumf drar inte, och
  gaffel-vakten har företräde. **Bevaka:** (a) drar boten trumf när den BORDE
  ruffa först (korta trumfens ruffvärde offras)? (b) dragningen leder från
  handen som är inne — masktekniken "leda MOT kombinationen" är en känd
  förenkling (−1 kvar på bricka 1) — känns den dum för ofta?
- **Andra hand täcker billigt mot partnerns boss (bricka 8):** träkarlen lägger
  8:an ur J1084 på ledd 7:a när spelföraren har AK bakom — gratis chans, sparar
  bossen. Kräver äkta billigt försök (osett kort över täckningen) + ingen känd
  renons emellan. **Bevaka:** bränns mellankort i lägen där lågt var rätt?
- **Ruffa inte partnerns säkra stick (bricka 1):** spelförarsidan sakar i
  stället för att ruffa när synliga partnern bevisligen vinner sticket (slår
  utspelet + alla osedda kort, ingen visad renons emellan). **Bevaka:** sakas
  det nu i lägen där ruffen ändå var bättre (t.ex. sista trumfen värdelös)?

## Speldiagnosen S3 (2026-08-12) — cue-bud räknas inte som bjuden färg i utspelet
- **Utspelslogiken hoppar cue-bud (frö 20260807, §8.3):** kontrollbud (regelnamn
  "cue…") räknas inte längre som bjudna färger — korsruff-regeln triggar inte
  på en Jacoby-höjning med sidofärg + kontrollbud, och cue-färgen undviks inte
  som "deras färg". **Bevaka:** (a) leder boten nu in i en färg där cue-budet
  faktiskt lovade ESSET och det straffar sig? (b) övriga konstgjorda bud
  (Stayman-klövern, transfers, Jacoby-kortfärg) räknas MEDVETET fortfarande —
  säg till om ett utspel känns styrt av en färg som aldrig visades på riktigt.

## Speldiagnosen S2 (2026-08-12) — trumfdragningen (rapportens fynd 4–5)
- **Led inte trumf in i en känd gaffel (frö 20260731):** när en sakning visat
  att EN motståndare har all kvarvarande trumf, med toppen över vår och minst
  lika lång som vår längsta trumfhand, leder spelförarsidan en sidofärg i
  stället för trumf. Att driva ut en kortare mästartrumf (t.ex. KQJ76 mot
  känt A98) är kvar. **Bevaka:** vägrar boten trumf i lägen där ett trumfvarv
  ändå vore rätt (t.ex. för att klippa en korsruff)?
- **Spelförarsidans tredje hand följer färgkombinationen (frö 20260730):**
  träkarlen lägger nu damen ur Q753 mot KJ982 (tvingar esset, promoverar
  resten) i stället för "billigaste vinnaren". Kortet byts bara när
  simuleringen är strikt bättre — vanliga lägen orörda. **Bevaka:** offrar
  boten honnörer i lägen där du hade spelat billigt? Simuleringen är
  positionsneutral (vet inte VAR de osedda korten sitter), så tvåvägsgissningar
  kan fortfarande gå åt fel håll — det är ärliga missar, inte fel.

## Speldiagnosen S1 (2026-08-12) — tre fixar ur S0-baslinjen
- **Cue-svarets färg = exakt fyra (§7.3, frö 20260772):** advancern höjer inte
  längre dubbelton mot en cue-svars-färg, och cue-advancern dömer nu själv
  efter dubblarens låga andra återbud (3-stöd → utgång; 12+ hp + stopp → 3NT).
  **Bevaka:** (a) landar UD+cue-auktionerna i vettiga 3NT/utgångar — eller dör
  de för ofta i delkontrakt nu? (b) den nya 3NT-grenen kräver stopp i ALLA
  deras färger — säg till om den känns för feg.
- **Säkra vinnaren måste slå det som ligger (frö 20260731):** träkarlen slösar
  inte längre en honnör under ett kort som redan vinner sticket (♣Q under ♣K).
  **Bevaka:** att "gå upp med billigaste vinnaren" fortfarande fyrar när den
  SKA (felrapport #12-läget är facit-låst).
- **Spelförarsidan ruffar i stället för att saka (frö 20260772):** renons i
  ledd sidofärg + trumf kvar → ruffa lågt (andra hand). Försvarets beteende
  orört. **Bevaka:** ruffar spelföraren nu NÄR DET ÄR DUMT (t.ex. trumfar
  sönder egen trumfdragning)? MC-hjärnan ska normalt ta över i slutspelet —
  se även nästa punkt.
- ~~KÄND KVARSTÅENDE: Monte-Carlo-hjärnan föll ur i frö 20260772~~ **LAGAD
  2026-08-13 (S5):** rotorsaken var inte extremfördelningen utan att modellen
  lovade mer än systemet (hp-golv där systemet öppnar på TP m.m.) — se
  S5-posten överst.

## Budgivning (2026-08-08) — F6: stark 17+ enfärg efter två bjudna färger
- **Den starka dubblingen efter två färger (NYAST, §7.3):** en 17+ hand med
  egen 5+ objuden färg dubblar nu även efter t.ex. 1♦–P–1♥ (även i den
  kanoniska linjen — passet är inte längre inbakat) och visar färgen på nästa
  varv. **Bevaka:** (a) känns fortsättningen rätt — svarar partnern begripligt
  på tvånget och landar ni på rimlig nivå mot en tom advancer? (b) den vanliga
  **4-4-dubblingen är MEDVETET kvar som live-only** (fyras bara när auktionen
  redan lämnat linjen) — säg till om bottarna säljer givar där ett vanligt
  10–16-X efter två färger hade tävlat, så tas linje-beslutet då.

## Budgivning (2026-08-08) — F5: 6-5-återbudet + 2♣-strain-valet
- **2♣-strain-valet (NYAST, §4.4):** kravstegen rebjuder högfärg före minor,
  konstgjorda 2♣ räknas aldrig som klöverfärg, och svararen visar 4-korts
  högfärg under 3NT hellre än egen minor förbi 3NT. **Bevaka:** (a) hittar
  2♣-auktionerna nu högfärgsfiten i stället för att dö i 5♣/6♣ — och känns
  slutbuden rätt när INGEN fit finns? (b) höjs öppnarens äkta klöver
  fortfarande lagom (fit kräver nu två äkta klöverbud för dubbelton-stöd)?
- **6-5-reversen efter 1NT-svar (§3):** 16+ med 6m+5M reverserar nu 2M även
  efter 1♦–1NT. **Bevaka:** svarar partnern begripligt på reversen (den är
  rondkrav), och står ni lagom när svararen är minimal (6–7 hp)?

## Budgivning (2026-08-07) — F4: TP till §7-inkliven
- **Inklivsgolven läser TP (NYAST, §7.1):** enkelt inkliv + upplysnings-X
  kliver in på `max(hp, startpoäng)` (t.ex. 7 hp med KQJ109-femma → 1♠),
  advancerns cue/fit-jump på stödpoäng — additivt ovanpå "låna en kung".
  Kvalitetsvakt: lyftet kräver 3+ av topp-5 i färgen. **Bevaka:** (a) kliver
  bottarna in för lätt — straffas TP-inkliven med dubblingar/straffbet? (b)
  X-svararen (`answerTakeoutDouble`), DONT och försvaret mot svaga tvåor
  räknar ÄNNU rå HP — säg till om formstarka händer säljer given där, så
  byggs de på.

## Budgivning (2026-08-07) — F3: advancer-rabatten generaliserad
- **Advancer-rabatten över ALLA balanserade öppningar (NYAST, §7.1):** den som
  svarar på partnerns balansering (1♥–P–P–1♠ eller 1♥–P–P–X) räknar av den
  lånade kungen: höjningar −3 stödpoäng med tak på 3-läget, X-svar graderar
  cue/hopp på hp −3. **Bevaka:** (a) står ni för LÅGT när balanseraren faktiskt
  var maximal (14–16) — missade utgångar där rabatten åt upp inviten? (b)
  balanseringens NT-svar och nya färger (respondWithoutFit) räknar ännu INTE
  rabatten — säg till om de driver för högt, så byggs de på.

## Budgivning (2026-08-07) — B13: inverterad minor-återbuden + cue-lägena
- **Graderade återbud efter 1m–2m (NYAST, §4.2):** äkta honnörsstopp, 3m
  strikt 12–14, 15+ bjuder alltid krav ("fantomstopp" utan äkta stopp),
  svararens broms 10–12 + öppnarens driv med 15+. **Bevaka:** (a) stannar ni
  för ofta i 3m min-mot-min där 3NT ändå stod (bromsen kan vara feg)? (b)
  känns fantomstoppen begriplig när 3NT faller på öppnarens "visade" färg?
- **Cue i minorfit + 2♣-grenen (§6.2):** kontrollbud över 3NT i minorfit; i
  klar drivzon (33+) direkt-4NT i minortrumf. **Bevaka:** cue:ar bottarna
  i 2♣-auktioner där du väntat direkt-RKC (4♣/4♦-cuen kan kännas främmande)?

## Budgivning (2026-08-07) — dagens sex etapper (splinter, Jordan, starka återbud, 2/1, oklart)
- **Splinterregeln (NYAST): en singel A/K splintras aldrig — handen svarar
  Jacoby 2NT (§4.1).** **Bevaka:** (a) saknar du splinterns exakta kortfärgsinfo
  i lägen där partnern behövde den (mätningen visade +2 "fel färg"-givar som
  motvikt)? (b) känns Jacoby-vägen rätt med singel-kungen?
- **Jordan 2NT besvaras alltid (§7.8d):** öppnaren 3M med ≤14 stödpoäng, 4M
  med 15+; Jordan-bjudaren höjer 3M-avslutet med 13+. **Bevaka:** hamnar ni i
  tunna 4M när öppnaren räknat upp sig på form?
- **Starka återbud (§5.2/§6.6):** svararens 6-korts-rebud graderat (hoppinvit
  11–12, 13+ → fjärde färg), öppnaren accepterar 3M-invit med 14+ stödpoäng,
  reverse-handen med 18+ driver över preferensen. **Bevaka:** (a) för många
  tunna 25-utgångar via 14+-accepten? (b) 5m-utgångarna efter reverse — står de?
- **2/1: egen 4-korts högfärg visas i återbudet (§5.3)** när den är tredje
  färgen. **Bevaka:** förvirrar det när samma bud i fjärde färg-läget är
  konventionellt?
- **Oklart-1NT:an routas till NMF + öppnaren rebjuder 5-korts färg med singel
  i din färg (§5.2/§5.7).** **Bevaka:** saknar du 1NT-återbudet på de skeva
  händerna (2m-rebudet kan spela sämre än 1NT någon gång)?

## Budgivning (2026-08-07) — hål D steg 1: slaminvit i konkurrens (§6.10)
- **Kontroll-komplett 4NT:** med 17+ (eller 16+ och 3 kontroller), fit funnen i
  konkurrens, förstarundskontroll i ALLA sidofärger och en partner som hoppat
  frågar kaptenen 4NT direkt — 6M bara på entydigt svar, aldrig storslam.
  **Bevaka:** (a) känns 4NT-frågorna lagom sällsynta (tänder ~1/1000)? (b)
  läcker vi i lägen där pass var bättre? Steg 2 (cue-frontend) är PARKERAD.

## Budgivning (2026-08-03→04) — cue-buden återinförda + budstyrt utspel
- **Cue-ronden (§6.2):** vid GF + agreed trumf (Jacoby 2NT / NMF-stöd) cue-bjuds
  kontroller fritt under utgång; poängomdömet ligger på att gå FÖRBI utgången.
  **Bevaka:** begriper du partnerns cue-bud vid bordet (förklaringarna ska
  hjälpa), och bjuds tunna slammar efter cue-rundor?
- **Utspelet (§8.3, hål A–G):** budstyrt — partnerns färg, undvik deras,
  passivt mot trumf, tenass-/ess-skydd, inre sekvenser, trumf/singel i rätt
  lägen. Netto-A/B 2026-08-05: litet men säkerställt försvarslyft. **Bevaka:**
  utspel som känns "boken fel" vid bordet — notera given (frö visas i appen).

## Budgivning (2026-07-30) — Lebensohl efter vårt 1NT (§7.5)
- **Motståndaren klivar nu in NATURELLT över 1NT (NYAST).** En stark enfärgshand
  (6+ kort, 11–15 hp) bjuder sin färg naturligt på 2-läget över ett 1NT — förut
  störde de alltid med DONT. Detta gäller symmetriskt: även vårt eget försvar mot
  deras 1NT bjuder en stark enfärgshand naturligt (svaga/tvåfärgade → DONT som
  förr). **Bevaka:** (a) klivar boten in på för klena eller sneda händer (11–15
  ska vara en riktig enfärgshand)? (b) Missar vi ibland en DONT-tvåfärgshand som
  blev naturligt inkliv i stället?
- **Svararen spelar Lebensohl efter inklivet.** 2NT = relä (svag, öppnaren tvingas
  3♣, sedan pass/rätta lågt); direkt 3-läge = utgångskrav; direkt 3NT = jämn
  utgång; naturligt 2-läge = svag högre högfärg; pass = försvara. **Bevaka:** (a)
  hamnar boten i rätt delkontrakt med de svaga händerna (stannar den lågt), och
  (b) bjuder den utgång på för lite? Kärnan är byggd — takeout-dubbling, "slow
  shows" och cue-Stayman är ännu INTE inkopplade, så förvänta dig inte dem.

## Spelkvalitet (2026-07-30) — försvaret spelar tredje hand högt (#34)
- **Bottarna lägger nu en HONNÖR tredje hand i sang (NYAST).** Ledde din partner
  och en motståndare vann just nu (t.ex. träkarlen slog partnerns låga utspel),
  och bara den dolda spelföraren står bakom boten, lägger den sin **lägsta
  honnör** för att tvinga fram spelförarens – i stället för det gamla billiga
  spotkortet som spelföraren gick över gratis. **Bevaka:** (a) lägger boten en
  honnör där ett lågt kort hade varit bättre – t.ex. med en gaffel den borde ha
  behållit hel? (Regeln väljer *lägsta* honnören just för att spara esset över
  spelförarens kung, men säg till om den känns fel.) (b) Gäller **bara sang** –
  i trumfkontrakt lägger boten lågt som förr (tredje-hand-högt hjälpte inte där,
  det satte försvararen på lead in i ruffhanden). Känns det rätt att den bara gör
  detta i sang?

## Spelkvalitet (2026-07-29) — spelföraren etablerar lång färg (#32)
- **Bottarna etablerar nu lång färg i SANG (NYAST).** Är boten spelförare i sang
  och sitter med en lång färg som behöver en spärr utknackad (t.ex. ♦KQJT9 mot
  motståndarnas ♦A) knäcker den spärren FÖRST, medan sidoessen håller, i stället
  för att casha topparna. **Bevaka:** (a) ger boten ibland ifrån sig ledningen i
  fel läge – attackerar den långfärgen när den i stället borde casha hem
  kontraktet direkt? (b) känns det rätt att den bara gör detta i sang (i
  trumfkontrakt ruffar den fram färgen som förr)? Gäller bara spelföraren; #34
  (försvarets tredje-hand-högt) är ännu inte byggt.

## Etapp 7 (2026-07-28) — missad lillslam
- **Öppnarens suutrebid graderas nu efter styrka (hål 1, NYAST).** Har du öppnat
  med en 6-korts färg och partnern svarat på 1-läget rebjuder du inte längre
  billigast med allt: **16+ startpoäng hoppar** (1♥–1♠–3♥), och **19+ i högfärg
  sätter utgången** (4♥). En minor stannar på 3-läget även med 19+. Måttet är
  startpoäng, inte råa hp — en 15:a med `AQT983` hoppar. **Bevaka:** (a) hamnar
  ni för högt när hoppet bygger på LÄNGDpoäng och partnern har en bottenhand?
  (b) 4♥-hoppet med 19+ ger upp slamutredningen — missas slam där i stället?
  (c) känns 3♣/3♦-hoppet passat för ofta av partnern (det är en inbjudan, inte
  krav)?

## Felrapporter #40/#41/#42 (2026-07-28, kväll)
- **17+ säljer aldrig given över deras 1-lägesöppning (#40, NYAST).** Ryms en
  17+-hand inte i något fönster — för stark för det kapade inklivet (tak 16),
  fel form för upplysnings-X:et, och utan egen 5+ färg — dubblar den ändå.
  Typfallet är en hand vars enda långfärg är öppnarens egen. **Bevaka:** (a)
  dubblar bottarna nu på händer där pass kändes bättre — särskilt med LÄNGD i
  deras färg (X:et är ju upplysning, inte straff)? (b) tvingas partnern svara
  på luft och åka på straff?
  **KÄNT HÅL I ROND 2 (kontrollmätning M19, frö 20260952):** den starka
  dubblaren kan **sälja given i nästa rond**. `1♦–X–P–3♣–P–P–P`: Väst dubblar
  med 19 hp, Öst hoppar 3♣, och Väst **passar** — ÖV kunde ta 7NT.
  `ownStrongDoubleRebid` kräver en egen 5+ **objuden** färg för det starka
  återbudet, och en jämn 19-poängare har ingen → ingen väg vidare alls.
  Principen "17+ säljer aldrig given" gäller alltså bara rond 1 i dag. Är detta
  kandidat till ett eget jobb står det i `docs/senare.md`.
- **Sangsystemet gäller även off-book (#41).** Bjuder du 1NT/2NT själv i
  budlådan svarar partnern nu med Stayman/transfer/Texas/Minor Suit Stayman och
  öppnaren ger sitt vanliga återbud. **Bevaka:** (a) läser motorn ditt bud som
  du menade det — 2♠ över 1NT är alltid Minor Suit Stayman, aldrig naturligt?
  (b) stör motståndarna lämnar sangsystemet över till §7.8; känns det bytet
  rätt? Rör INTE botgivarna (bottarna bjuder alltid on-book) — bara dina egna.
- **Kvantitativ höjning av partnerns naturliga 3NT (#42).** Har partnern öppnat
  på 1-läget i en färg och placerat kontraktet i 3NT höjer kaptenen till 6NT med
  **21+ hp**. **Bevaka:** (a) hamnar ni i 6NT som går bet — 21 mot visade 12 är
  golvet, inte ett säkert bud? (b) regeln är smal (tyst motstånd, ingen renons)
  — missas slam i lägen som känns identiska? M19 visar att den nästan aldrig
  träffar i botgivar, så det är dina egna givar som ger svaret.

## Etapp 6 (2026-07-27/28) — billig offring
- **Hål 4: försvaret väcker över deras höjda spärr (2026-07-28, NYAST).**
  Efter deras öppning + spärrhöjning (`2♠–P–3♠` / `1♣–P–3♣`) tiger bottarna
  inte längre: direkt över höjningen gäller spärrfönstren (X 14+, färg 13–16,
  17+ dubblar alltid, 3NT till spel först från 19), i balansering lånas en
  kung på X (11+) och färg (10+) med offshape-X ok, 3NT från 16. Tvingade
  svar på 3-läget+ väljer honnörsstarkare färg på lika längd. **Bevaka:**
  (a) tvingas partnern svara på 4-läget på luft och åker på dubbel straff —
  känns X-golven för lätta? Ett genomgånget exempel (2026-07-28, hittat när
  deploygrinden felsöktes) talar snarare FÖR golven: frö 1781, Öst balanserar
  X på 14 hp över deras `1♣–P–3♣` och Väst svarar `3♦` på 10 hp med
  `♦AQ62` — 24 hp tillsammans på 3-läget, alltså sunt. Formen att leta efter
  är alltså inte tvångssvaret i sig utan svar där advancern har **under ~8 hp**
  och ingen färg att gå till. Dumpa vilken giv som helst med
  `$env:DUMP='1781'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts`
  (auktionen med förklaring per bud hamnar i `revisor-output/auktionsdump.txt`). (b) höjningar förbi 3-läget lämnas medvetet
  tysta — säljs för många 4♠-höjningar? (c) 19-golvet för direkta 3NT — står
  ni kvar i X-svar när 3NT var enda utgången?
- **Hål 3: taket mot svaga tvåor (2026-07-27).** Starka händer passar
  inte längre ut deras svaga tvåor: 3NT till spel bjuds med balanserade 19+
  (16+ i balansering) eller stark 6+ minor med stopp, och 17+ utan fönster
  dubblar hellre än säljer. **Bevaka:** (a) hamnar ni i 3NT på tunna håll
  (Kxx räknas som stopp)? (b) känns 16+-golvet i balansering för lätt —
  straffas 3NT när skörden inte fanns?
- **Hål 2: advancern talar när de bjuder över partnerns X (2026-07-27).**
  Höjer motståndarna över botens upplysningsdubbling — (1♣)–X–(2♣) — tiger
  advancern inte längre: 12+ bjuder 3NT/cue, 9–11 hoppar, 6–8 bjuder billigast,
  extrem form (6+ färg/5-5) bjuder oavsett poäng, och deras XX flys ALLTID.
  Dubblaren höjer svaret skalat (hopp accepteras med 15+, fritt svar kräver 19+
  för utgång). **Bevaka:** (a) väcker advancern för lätt — kliver boten in på
  form och åker på straff? (b) känns dubblarens utgångströsklar rätt, eller
  missas utgångar när dubblaren har en bra 17–18? (c) cue-svaret visar
  högfärgen före 3NT — hamnar ni i 4-3-utgångar där sang var rätt?
- **Hål 1: stöddubblingen besvaras nu (2026-07-27).** Dubblar partnern
  (boten) som öppnare efter ditt 1♥/1♠-svar och deras inkliv, svarar boten som
  svarare nu ALLTID: 13+ sätter utgången (4M med femkortsfärg / 3NT med stopp /
  4M på 4-3), 10–12 inbjuder (3M, egen 6+ färg, invithöjning, 2NT), minimum
  bjuder billigast — och pass är numera ett MEDVETET straffpass (trumfstack,
  max 12 hp). **Bevaka:** (a) hamnar ni för högt när svararen väljer 4M på
  4-3-fiten? (b) känns straffpasset lagom vanligt — straffar boten när den
  borde bjuda, eller tvärtom? (c) öppnaren accepterar inbjudan med 15+ —
  står ni fel när öppnaren är en bra 14?

## Känd skuld — verktyg som boken lovar men bordet inte kan
- **Lebensohl: kärnan INKOPPLAD 2026-07-30 (Lager 1, §7.5) — skulden krympt,
  inte stängd.** `lebensohl.ts` importeras nu av `auction-live.ts` och spelas
  efter naturliga inkliv över VÅRT 1NT (se 2026-07-30-posten överst).
  **Kvar (spelas EJ):** Lebensohl efter partnerns takeout-dubbling av en svag
  tvåa (det gamla typexemplet — 2NT där är fortfarande INTE relä), takeout-X i
  1NT-läget, "slow shows" och cue-Stayman. Detalj: `docs/senare.md`.
  Kopplingsvakten i `src/docs-vakt.test.ts` vaktar fortfarande mot tysta tapp.

## Etapp 4 (2026-07-24 → 2026-07-25) — slam efter 2♣, reverse och hoppskift
- **Familj C: reverse/hoppskift-fortsättningen (2026-07-25, NYAST).**
  (a) Efter botens hoppskift (t.ex. 1♠–1NT–3♥) sätter svararen nu UTGÅNGEN:
  4♥ med fyrkortsfit i hoppfärgen, 4M-lyft av preferensen med utgångsvärden,
  5m när sanghåll saknas — **bevaka:** hamnar ni i tunna utgångar när boten
  hoppskiftat på lätta 16? (b) Reverserar/hoppskiftar boten och du har fit
  kan den nu driva RKC mot visade 16/19 — **bevaka:** bjuds tunna slammar
  för ofta (två DD-bet per 1000 givar är medvetet ärligt), och känns
  4m-slaminbjudan efter reverse begriplig?
- **Familj B: slam efter stark 2♣ (2026-07-24).** Svarar du positivt på botens
  2♣ (eller boten på din) och en trumf hittas, kör kaptenen nu RKC mot visade 22
  (driv 33+, inbjudan 5M/stödhöjning 31–32). **Bevaka:** (a) bjuds slam för OFTA
  på 2♣-givar (tunna 33-ihop kan åka på en mask — medvetet ärligt)? (b) känns
  5M-inbjudan begriplig vid bordet? (c) spelstick-2♣:or (färre hp, lång färg) —
  hamnar de för högt när svararen räknar med 22? (d) utan fit: RKC bara med egen
  solid 6+ färg och 6NT bara efter botens 3NT-återbud — saknar du en sangslam?

## Etapp 5 (2026-07-24) — missad utgång
- (a) Har du 4 kort i den färg boten visade i sin ANDRA rond (1♣–1♥–1♠) höjer
  boten nu graderat — 2♠ svagt, 3♠ inbjudan, 4♠ med utgångsvärden — **bevaka:**
  hamnar ni för högt någon gång (posten "för högt" växte två givar i mätningen)?
  (b) Inbjuder du efter ditt 1NT-svar (1♠–1NT–2♠–2NT) svarar boten nu alltid:
  3♠ med minimum, 4♠ med utgångsvärden — sang spelas aldrig när boten lovat sex
  kort — **bevaka:** känns 3♠-rättelsen rätt, eller saknar du 2NT som slutkontrakt?
  (c) 1NT-boten accepterar nu din 2NT-inbjudan med en **"bra 15"** (tät A-K-D-klump
  eller femkortsfärg) — **bevaka:** hamnar ni i tunna 3NT för ofta? Platt 15 med
  bara damer/knektar passar fortfarande.

## Etapp 3 (2026-07-21 → 2026-07-22) — fel färg-spåret
- **Fix 6:** fyra nya domslutsvakter i konkurrens: (a) har din partner just passat
  höjer boten dig bara TÄVLANDE (billigast) — **bevaka:** missas utgångar när
  partnern smygpassat med bra hand? (b) bot-öppnaren tävlar inte över deras utgång
  efter din pass — **bevaka:** borde den offrat någon gång? (c) cue-höjer boten din
  öppning och du återgår billigast stannar den nu med limit-värden (under 13 sp) —
  **bevaka:** står ni för lågt när du var maximal? (d) ditt utgångsbud dras aldrig
  längre till en "tvingad" färg av öppnaren.
- **Fix 5:** (a) fjärde hand **balanserar nu över deras svaga tvåor** — inkliv på
  8–9 hp, X med tre hackor i deras färg och 2NT på 12–15 kan dyka upp i
  utpassningsläget — **bevaka:** väcker boten givar för lätt där pass var bäst? Och
  höjer din partner ditt balansinkliv för snålt (rabatten −3 + tak på 3-läget är
  medveten)? (b) efter din **negativa dubbling** passar boten inte längre öppnarens
  tvingade färgsvar med 9–12 hp: den prefererar öppningsfärgen (ev. med hopp),
  rebjuder egen färg eller bjuder 2NT — och öppnaren FÅR passa det (X + färg = ej
  krav) — **bevaka:** står vi för lågt när dubblaren faktiskt var stark, eller drivs
  delkontrakt en nivå för högt?
- **Fix 4:** (a) svarar din partner på en stark tvåfärgs-cue över deras svaga tvåa
  väljs nu färgen som kan bjudas billigast vid lika längd — **bevaka:** känns
  preferensen rätt? (b) öppnaren bjuder inte längre 2NT på minimum efter din
  negativa dubbling — du får en billig färg i stället — **bevaka:** saknar du sangen
  någon gång med 13–14 hp? Och höjningar av det tvingade svaret på dubbelton görs
  bara med utgångsvärden — **bevaka:** står vi för lågt någon gång? (c) med 11–14 hp
  utan fit mot partnerns svaga tvåa passar boten nu (krav på 3-läget = 15+) —
  **bevaka:** missas utgångar du hade bjudit?
- **Fix 2+3:** (a) efter en stark 2♣-auktion `2♣–2♦–3♣/3♦` visar svararen nu sin
  billigaste 4-korts högfärg under 3NT — **bevaka:** hittar paret 4-4-fiten lagom
  ofta, och hamnar sangen nu på ÖPPNARENS (starka) hand? (b) svararen höjer inte
  längre öppnarens tvingade färg-ombud på dubbelton när hen har en egen visad
  6-korts färg. (c) När din partner cue-höjer din minoröppning i konkurrens svarar
  öppnaren nu **3NT med jämn hand + stopp i deras färg** — **bevaka:** står 3NT
  lagom ofta, eller bjuds det på för tunna stopp (Kx räknas)?
- **Fix 1 "5♣-ryckaren":** boten läser inte längre partnerns Stayman/överföring som
  en äkta färg, och rör ALDRIG partnerns obestridda utgångsbud off-book (förr kunde
  1NT–2♣–2♦–3NT ryckas till 5♣ → bet). **Bevaka:** (a) står partnerns 3NT/4M/5m nu
  alltid kvar som det ska? (b) passar boten någon gång FÖR snällt i ett läge där den
  borde tävlat vidare (vakten gäller bara när motståndarna INTE bjudit över)?

## Slam — grundprincipen (2026-07-07, styr ALLA slam-vägar)
- **ÄRLIGA SLAMPORTAR:** all slamutredning beslutar på egen hand + partnerns VISADE
  intervall. **Bevaka:** (a) **missar** boten slammar du tycker den borde bjudit?
  (Medvetet: hellre systemriktig miss än kik.) (b) **Inbjudningarna** (5M/4m/
  kvantitativ 4NT): accepterar partnern lagom ofta? (Accept = över blott minimum.)
  (c) **Partner-rättelsen** (kaptenen stannar 5-trumf, partnern lyfter till 6 med
  det höga antalet) — ser den rätt ut vid bordet? (d) Utan kontrollkoll kan en slam
  någon gång åka på två snabba ess — ägarens medvetna val, men säg till om det
  svider för ofta. (e) Motorn cue-bjuder inte längre själv (§6.2 gäller manuella
  cue). (f) Storslam kräver visshet → 7-läget är ovanligt (~1/4300 giv).
- **Slam-vägarna i spel (var täcks slam i dag?):** Jacoby 2NT, inverterad minor,
  öppnarens hopphöjning (`1x–1M–3M`), hopp-återbud i minor (`1m–1M–3m`),
  1NT-återbudet (`1m–1M–1NT`), MSS, Gerber över 1NT/2NT, Exclusion efter splinter,
  **stark 2♣** (etapp 4 familj B) och **reverse/hoppskift** (familj C) — alla via
  kaptensregeln. TÄCKS ÄNNU INTE: advancer-slam efter upplysningsdubbling.
- **#33 Advancern hoppar inte förbi utgång** efter upplysningsdubbling — säg till om
  den borde utforskat slam i stället för att nöja sig med utgång.

## Äldre noteringar (har stått ett tag utan klagomål)
- **#32 6-5-öppning:** högfärgen 12–15, lågfärgen 16+ — bevaka öppningsvalet och att
  6-5:an visas begripligt i rond 2 (reverse in i högfärgen).
- **2♣ dör inte i delkontrakt + systems-on efter `2♣–2♦–2NT`** — bevaka fit-sökningen.
- **#31 Inget svagt hoppskift:** svag 6-korts hf svarar 1♥/1♠ — säg till om en
  spärrig hand borde fått hoppa.
- **#30 Stark jämn 19+ öppnar 2NT** (kvalitet, startpoäng ≥20) + sang-visning efter
  minorhöjning i konkurrens (3NT-accept från 8 hp) — bevaka golven.
- **Flerronds-konkurrens A+B+C (§5.9/§7.1):** tävlar/återöppnar i rond 2+; C-golvet
  ~8 stödpoäng; trap-pass kan konverteras till straff — bevaka alla tre.
- **"Låna en kung" i balansering (§7.1):** inkliv från 5 hp, X från 9, 1NT 11–14 —
  säg till om boten väcker givar för lätt.
- **Öppnarens rond-2 i konkurrens efter ny färg/1NT (§5.8):** cue = 15+, 18+ =
  utgång; cue väljs medvetet före straffdubbling.
- **Störda krav = RONDKRAV (§5.5):** fria bud/reverse i konkurrens tvingar ett svar
  men aldrig utgång i onödan — bevaka båda hållen.
- **#26/#27 Utgångskrav passas aldrig off-book** (cue-höjning + höjd 2/1).
- **5♣/5♦-utgång nåbar efter inverterad minor** (svag sidofärg-regeln) — bevaka
  5m-mot-3NT-valet åt båda hållen.
- **#24/#25 Motspelarens kast-vakt** (sakar inte bort garderande honnör) +
  1NT-återbudets nya förklaringstext.
- **#23 Takeout-X:** 17+ enfärgshand X→färg billigast med flerronds-fortsättning;
  ⚠️ konservativ game-dom efter stödhöjning (18+/21+-golv); tvåfärgs-X 4-4 (10+) —
  se budsystem.md §7.3.
- **Inklämt konkurrensläge:** öppnarens X = game try (ej straff), 18+ = 4M.
- **DONT mot deras 1NT** (golv 8 hp direkt / 6 balansering).
- **Försvar mot svaga tvåor/spärrar** (takeout-X 12–13 hp; mot spärr 14 — stramare).
- **Svar när de stör VÅR öppning:** X/XX från 8 hp mot DONT; XX 10+ efter deras
  takeout-X — bevaka golven.
- **Straffdubbla flykten efter vår XX** — varje flyktbud dubblas; säg till om det
  känns för aggressivt.
- **Straffdubbling mot ägaren:** bottarna kan straffdubbla ÄGAREN vid offringar på
  3-läget+ (poängsystemet).
- **Essfrågor utan formell trumf / toppsekvenser andra hand / 4M-pass efter
  transfer-3NT** (felrapport #10–#13).
- **Michaels & essfrågor i fria auktioner; motspelarna sparar torra ess**
  (felrapport #6/#7/#9).
- **Balansering mot ägaren:** bottarna balanserar även MOT ägaren (symmetriskt —
  korrekt bridge, men säg till om det känns fel; felrapport #5).
- **Öst över spärrhöjning** (1♣–2♥–X–3♥ → konkurrera 3♠ eller passa?): boten passar
  — ägarbeslut om det känns fel (felrapport #1–4).
