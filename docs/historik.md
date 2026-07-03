# Historik — färdigt & pushat arbete

> **Detta är arkivet.** Här bor alla "🎉 KLART"-block och FAS-historiken som
> tidigare låg i `CLAUDE.md`. Flyttat hit 2026-07-04 för att hålla projektkartan
> i CLAUDE.md ren (kartan ska visa NU/NÄST/SENARE/PARKERAT, inte historik).
>
> Inget här är återstående arbete — allt är byggt, testat och live om inte annat
> anges. Aktiva "Bevaka i spel"-noteringar är utlyfta till CLAUDE.md; de finns
> kvar även här i sitt sammanhang. Detaljerad implementationsstatus: `docs/status.md`.

---

## 2026-07-04

**🎉 POÄNGSYSTEMET KLART & LIVE (2026-07-04, testsvit 1626 grön, bygget ok,
verifierat i webbläsaren — resultatdialog "8 bet (1 stick). Ö/V +800";
committat/pushat av parallellsessionen i `0864224` + `26b4267`):**
ägarönskemål, full tävlingspoäng i Spela kort. **(1) X/XX in i slutkontraktet** (gamla SENARE-fyndet, nu löst):
`Contract` fick `doubled?: 'X' | 'XX'`; `contractFromCalls`
(auction-contract.ts) läser dubblingen (nollställs av nytt bud); X/XX-märke i
bekräftelsedialogen, svarta kontrakt-listen, omspelningen och felrapportens
kontrakttext. **(2) `scoring.ts`** — hela poängtabellen (trickpoäng
20/30/40+30 dubblat ×2/×4, delkontrakt 50, utgång 300/500 på DUBBLADE
trickpoäng, slam 500/750 + 1000/1500, insult 50/100, övertrick 20/30 /
100/200 / 200/400, straffar 50/100-serien + dubblade 100-300-500(+300) resp.
200-500-800(+300), redubblat ×2) — VARJE cell i ägarens poängguide facit-låst
i `scoring.test.ts` (4♥=420/620, 3 dubblade straff i zon=800, 2♥X hemma=470/670
osv.). **(3) Resultatdialogen** visar vem som fick poängen i samma ruta som
resultatet, t.ex. **"Ö/V +420"** (`scoreLine`, zonen från brickan).
**Ägarbeslut:** BARA per giv — löpande ställning väntar tills tävlingar/
matcher finns; poängen visas bara i resultatdialogen. **(4) Bottarna
straffdubblar** (ägarbeslut): `penaltyDouble` (doubles.ts, 2+ säkra
trumfstick i deras färg + 10+ hp) via `maybePenaltyDouble` (auction-live.ts)
— bara färgkontrakt på 3-läget+, och BARA när vår sida gjort 2+ kontraktsbud
(då kan X:et omöjligt läsas som upplysning/negativt/tvåfärgssvar — de
detektorerna kräver max ett eget kontraktsbud). **Bevaka:** bottarna kan nu
straffdubbla ÄGAREN vid offringar på 3-läget+ — säg till om det känns för
aggressivt. **Sidofynd lagat:** #13-koden (transfer-utgångsvalet) refererade
saknade `SYM_OF_LETTER` (kraschade decideCall i vissa lägen) → kartan tillagd
i auction-live.ts.

**🎉 Felrapport #10–#13 LAGADE & LIVE (2026-07-04, commit `26b4267`, testsvit
1626, deploy grön, issues #10–#13 stängda):** **#10** 4NT är essfråga även
UTAN överenskommen trumf när sidans senaste naturliga bud var en FÄRG (t.ex.
4NT på partnerns 3♠-spärr) — kvantitativt bara över sang (`slamAskTrump`,
`auction-live.ts`; samma regel i tolkningslagret via `askTrumpFallback`).
**#11** partnerns cue i motståndarnas färg passas aldrig ut — känns nu igen
även på 3-läget och över X/deras egen höjning (`partnerTwoSuiterToAnswer`);
Nord ger preferens (3♠). **#12** kortspel: andra hand med LÖPANDE toppvinnare
(2+ säkra) går upp med billigaste säkra vinnaren i stället för att "maska"
(♥8 ur AKQT98 lät knekten vinna); ensamt säkert kort ligger kvar lågt
(hold-up orörd), visad renons hos kommande spelare → lågt (`play-bot.ts`).
**#13** partnerns 3NT efter fullföljd transfer = VÄLJ UTGÅNG: 4M med 3+
stöd, annars pass — transferns relä läses aldrig som naturlig färg
(`transferGameChoiceToAnswer`, ligger FÖRE det generella off-book-svaret).
Alla fyra givarna facit-låsta EXAKT ur rapporterna. **Samma push:**
parallellsessionens poängräkning + X/XX i kontraktet (`scoring.ts` enligt
ägarens poängguide) som egen commit `0864224`. **Bevaka:** bottarna svarar
på essfrågor utan formell trumf, går upp med toppsekvenser som andra hand
och väljer 4M/pass efter transfer-3NT.

## 2026-07-03

**🎉 CLAIM TRICKS + AUTO CLAIM KLART (2026-07-03 kväll, testsvit 1560,
committat i `8914903`):** ägarönskemål, två funktioner.
**(1) Manuell claim** — ⋮-menyn (spelfasen) har knappen "Claim tricks" (bara
när DIN sida är spelförare). Dialogen listar sidans TOTALA stick i given
(redan vunna → vunna+återstående) med kontrakt/±-etikett; DDS-lösaren dömer
mot PERFEKT motspel (`adjudicateClaim`, `claim.ts` + `doubleDummyDeclarer-
Remaining`). Godkänd → given avslutas med det claimade resultatet
(resultatdialogen visar "Claim godkänd"); annars **"Claim nekad — går inte
att säkra"** och man spelar vidare; för tung ställning → "spela ett stick
till". **(2) Auto Claim** — av/på-knapp i SAMMA meny (sparas i localStorage,
`learnbridge:autoClaim`, PÅ som standard). När ett nytt stick ska börja och
spelförarsidan OMÖJLIGT kan förlora fler stick OAVSETT spelsätt (t.ex. bara
höga trumf kvar, eller idel toppkort) stängs given automatiskt — gäller BÅDE
dig och datorn som spelförare. Strängare mått än manuell claim: ny lösare
`sureWinAllRemaining` (`dds.ts`) prövar ALLA lagliga kort för alla fyra
spelare → sant bara om varenda linje vinner varje stick (en fungerande mask
går att spela hem = manuell claim OK, men går också att spela bort = aldrig
Auto Claim). DDS-lösarens `legalMoves`/`key` utlyfta till modulnivå
(`legalMovesFor`/`positionKey`) och delas — inga dubbletter. Facit-lås:
`claim.test.ts` (15 fall, ägarens båda exempel + mask-skillnaden + symmetri
för bot-spelförare + nodbudget). Bottarna pausar medan claim-dialogen är öppen.

**🎉 Felrapport #6, #7 & #9 LAGADE (2026-07-03 kväll, testsvit 1545):**
**#6 motspel:** motspelaren cashar aldrig en ENSAM säker vinnare i färsk färg
(torrt ess göder spelförarens honnörer) — bara löpande toppar (2+) eller i
redan attackerad färg; annars fortsätts utspelfärgen §8 (`play-bot.ts`).
**#7 budgivning:** advancerns preferenssvar på Michaels/ovanlig 2NT
(`advanceTwoSuiter`, FAS 10) inkopplat i live-flödet + NY flyktregel: eget
DUBBLAT tvåfärgsinkliv passas aldrig ut — fly till längsta visade färgen
(`auction-live.ts`). **#9 slam:** partnerns 4NT med överenskommen trumf
(båda bjudit färgen) besvaras ALLTID som 1430 RKC (`respondToRKC`), 5NT =
kungfrågan (Sjöberg); tolkningslagret visar öppnarens 2♥/3♥/4♥ efter negativ
dubbling som graderade SVAR (inte spärr) och 4NT som essfråga
(`auction-interpret.ts`). Alla givar facit-låsta EXAKT ur rapporterna.
**Nytt fynd → ⚪ SENARE:** kanoniska linjen (`auction.ts`) kan fortfarande
passa ut ett OSTÖRT tvåfärgsinkliv (1♠–2NT–P–P–P) — bryter "aldrig pass
ostört"; bara förbyggda linjer, inte budlådan. **Bevaka:** bottarna svarar nu
på Michaels och essfrågor även i fria auktioner; motspelarna sparar torra ess.

**🎉 Systemgranskning + städning KLAR (2026-07-03 kväll, testsvit 1537 grön,
EJ committad — ägaren sköter commit/push själv):** full granskning av
budcykeln/bot-tillståndet på ägarens begäran. Resultat: `decideCall` är
tillståndslös (räknar om allt ur historiken varje tur — inget bot-tillstånd
kan bli inaktuellt), inga races i `Play.tsx` (funktionell setState +
dubbelkoll i uppdateraren), lagligheten vaktas av `legalCalls`. **Åtgärdat:**
dubblettkopian av kontraktshärledningen borttagen — `contractFromCalls` bor
nu ENBART i `auction-contract.ts` (re-export i `auction-live.ts`,
`finalContract` delegerar); `*.tsbuildinfo` gitignorerad. **Nytt fynd →
⚪ SENARE:** X/XX följer inte med in i slutkontraktet. (OBS: ägarens prompt
talade om "bid retractions"/auktionssajt — utrett och avfärdat tillsammans,
bud kan aldrig dras tillbaka i bridge.)

**🎉 UI-pass i Spela kort KLART (2026-07-03, testsvit 1537 grön, bygget ok):**
fem ägarönskemål på mobilen. (1) **Kortens symboler flöt ihop** på spelade
kort → `PlayingCard.tsx` har nu ETT hörnindex (det nedvända borttaget
ÖVERALLT), mittsymbolen knuffad diagonalt bort från hörnet, essets pip ett
snäpp mindre. (2) **Stäng-krysset** i förklaringspopupen 44×44 px
(`AuctionGrid.tsx`). (3) **iPhone-safe-area**: `viewport-fit=cover`
(`index.html`) + botten-marginal `env(safe-area-inset-bottom)` och mindre
mobilluft (`Layout.tsx`). (4) **Alla ramar/borders på korten borttagna**
(ägarbeslut — även gröna "spelbar"-ringen; ospelbara tonas fortfarande ner)
och **Nords träkarlskolumner expanderar VERTIKALT** när färgen väljs
(`-mt-3` i st.f. `-mt-7`, `Play.tsx`), samma tanke som Syds solfjäder.
(5) **👍-turmarkören ersatt av mjuk ljuskägla** (spotlight): radiellt vitt
ljus m. `mix-blend-mode: screen` bakom aktiv spelares bokstav i sticket,
tonar 0,7 s vid turbyte, pulserar när bot-hjärnan räknar
(`TrickCenterLive`, `Play.tsx`). Gula vinnarringen i sticket är KVAR
(markering, ej ram — ägaren sa inget om den).
(6) **"Förra sticket"-panel** uppe i hörnet (`LastTrickPanel`, `Play.tsx`):
senaste färdiga sticket i kompassläge, vinnaren gulmarkerad; förminskad 75 %
och flyttar till VÄNSTRA hörnet när Öst-träkarlen tar högersidan (annars
låg den ovanpå pågående stickets V/Ö-kort på 375 px — luriga överlappet
syntes som "mörkt kort"). (7) **Tryck på spelat kort → förklaring**: alla
bottars kort på bordet (mitten + förra sticket) klickbara, motiveringen i
raden under listen; frasen "X spelade Y Varför?" ersatt med "Tryck på
spelat kort för förklaring" (`botReasons`/`PlayedCardView`, `Play.tsx`).
(8) **Färgsymboler i löptext ALLTID fyrfärgade** (ägarbeslut):
`SuitText.tsx` (delad) + rehype-plugin i `BudSystem.tsx` (markdown-boken,
inkl. rubriker/sökträffar); inkopplad i förklaringspopupen, budlådans
betydelserad, kortförklaringen, Budvisningens listor och budträningens
facit.

**🎉 Felrapport #5 LAGAD & LIVE (2026-07-03, commits `7e68178` + `1125213`,
testsvit 1537):** bricka 8 — motorn ville passa ut given trots klar
balansering, och Nord höjde inte partnerns inkliv. Två rötter: (a)
**balansering byggd** — fjärde hand får hela §7-arsenalen i utpassningsläget,
både i kanoniska linjen (`auction.ts`, lämnar auktionen öppen) och off-book
(`maybeOvercall`, `auction-live.ts`); samma krav som direkt sits ("låna en
kung"-lättnaden = senare förfining, ⚪); (b) **`divergedFromLine`** räknar nu
ett riktigt bud BORTOM en stängd linje som off-book (modellen trodde given
var utpassad → partnerns svarslogik kopplades aldrig in). Given facit-låst
EXAKT ur rapporten (1♦–P–P–1♥–P–2♥–P–P–P). **Ägarbeslut (exempelhänder
H1–H4): AGGRESSIV upplysningsdubbling** — golv 10 hp med perfekt form (max 2
i deras färg + stöd i alla objudna + ingen egen 5-korts färg; 12+ som förut),
`overcalls.ts` + budsystem §7.1/§7.3. **Bevaka:** bottarna balanserar nu även
MOT ägaren (symmetriskt — korrekt bridge, säg till om det känns fel i spel).

**🎉 TP-steg E & F KLARA (2026-07-03, testsvit 1528 — hela TP-arbetslistan
A–F därmed komplett):** ägarbeslut efter exempelhänder + bridgebum-bekräftat.
**E — reverse/hoppskift på TP:** styrkan i `max(hp, startpoäng)`
(`pointsWithFloor` fick kind `'starting'`); reverse ≥16, hoppskift ≥19
(utgångskrav). Byggda luckor: öppnarens **hoppskift efter 1-lägessvar
saknades helt** (19-poängare rebjöd "2♣ minimum, ej krav"!) — nytt fack
`hoppskift` i `rebids.ts` + `rules.ts`; **svararens fortsättning** efter
hoppskiftet (placera kontraktet — 4M/3NT/5m, ALDRIG pass) + pass-vakt efter
reverse utan preferens (→ 2NT kravsvar) i `responder-rebids.ts`.
**F — lättöppning 3:e/4:e hand:** `classifyOpening(hand, vulnerable,
seatOrder)`, positionen trådad i `buildAuction`. 3:e hand: 1M med 10–11 hp
(sårbar 11) + bra 5+ högfärg (≥2 topphonnörer A/K/Q) — aldrig lätt
minor/1NT; Drury (§6.7, redan byggd) skyddar svaret. 4:e hand: **regeln om
15** (hp + spader ≥ 15 → öppna, annars passas given ut; ingen spärr/svag
tvåa i 4:e hand under golvet). Facit FÖRE fix (13 låsta fel bevisade), +16
tester, on-book orört. Docs uppdaterade (budsystem §3+§5, tp-arbetslista,
handvardering, status).

## 2026-07-02

**🎉 Felrapport #1–4 LAGADE & LIVE (2026-07-02 kväll, commits `9a6b09e` +
`df5bf21`, testsvit 1507):** felrapporteringskedjan bevisad end-to-end fyra
gånger. #1 motspel: tredje hand vinner nu högt nog att TRÄKARLEN (som spelar
efter, öppen information) inte går över (`play-bot.ts`). #2–4 budgivning,
gemensam rot **kravbud passades bort**: (a) öppnarens svar på **negativ
dubbling** byggt (`openerAnswerNegativeDouble`, `doubles.ts` §7.3 — aldrig
pass) + **spärrhöjning** av partnerns hoppinkliv med 3-korts stöd
(`auction-live.ts`, hoppinkliv lovar 6+); (b) öppnarens svar på **fjärde
färg** byggt (`openerAnswerFourthSuit`, `rebids.ts` §6.6-prioriteten);
(c) svararens **2/1 GF-fortsättning** byggd (`responderRebidIn2over1Auction`,
`responder-rebids.ts` §5.3 fast arrival — facket saknades helt i
`responderSecondBid`). Alla fyra givarna facit-låsta EXAKT ur rapporterna.
**Ägarbeslut:** /felrapporter lämnar alltid STANDARDRAPPORT (vad hände /
anledning / fix / test) — inskrivet i kommandofilen. **Bevaka:** Öst-läget
över spärrhöjningen (1♣–2♥–X–3♥ → konkurrera 3♠ eller passa?) är ett NYTT
frivilligt läge — boten passar; ägarbeslut om det känns fel i spel.

**🎉 🎨 DESIGNLYFTET KLART & LIVE (2026-07-02, commit `186a362`, testsvit
1484):** appen heter **RebidZ** (ägarens eget namn; konfliktkollat — fritt
bland appar/bolag/domäner; **påminn ägaren köpa rebidz.com/.se**). Ägaren ser
business-potential → designen håller produktnivå. Stil: eget & snyggare än
Synrey (gröna bordet + layouten behållna). Repo/URL byts INTE.
**Alla fyra stegen byggda, verifierade & deployade:**
**Steg 1 ✅** designgrunden — Inter (brödtext) + Space Grotesk (rubriker/
ordmärke), självhostade @fontsource; guld-tokens (`--color-gold-*`) +
`--font-display` i `index.css` @theme; RebidZ-ordmärke i sidhuvudet;
sidtitel + meta description. **Steg 2 ✅** korten & bordet —
`PlayingCard.tsx`: gradient-framsida, Space Grotesk-index, stort ess-pip,
RebidZ-baksida (smaragd + guldram; vilande tills utdelningsanimation);
`Felt.tsx`: ljus uppifrån + SVG-brus (filtväv) + kantdjup. **Steg 3 ✅**
rörelse — spelade kort glider in från spelarens håll (`card-in-n/s/w/e`),
utdelningskaskad (`deal-in`, 35 ms/kort), sidbyten tonar (`page-in`),
tryckrespons (`active:scale`), allt av vid `prefers-reduced-motion`.
**Steg 4 ✅** identitet — `BrandMark.tsx` (guldspader på smaragd) i sidhuvud
+ hero; `public/favicon.svg` (Vite rebaser sökvägen, verifierat 200);
`theme-color`; ny startsida: hero på filtet (logotyp, tagline, dekorativ
solfjäder, guld-CTA) + lägeskorten. Mobil 375 px verifierad överallt.
**Omtag 2 (ägarens logo-vision, samma dag):** namnet skrivs **rebidz —
ALLTID gemener** (ägarbeslut). Ordmärket = Fraunces-serif i guldgradient
med **spader som prick över i:et** (5 px över i:et vid herostorlek,
em-skalat — ägarbeslut) i **tunn guldram** (`Wordmark framed`,
`BrandMark.tsx`). **Klubbtema på ALLA flikar:** `club`-färgtokens
(`index.css`) — gröna ytor i båda lägena (aldrig slate på stora ytor),
guldlinje under sidhuvudet, alla h1 i varumärkesserifen, paneler/kort/
detaljer/sökfält smaragdtonade (Panel, Home, Spela, BudSystem,
BiddingPractice, Button secondary).

**🎉 Felrapportering i Spela kort KLAR & LIVE (2026-07-02, testsvit 1481,
commit `05d922e`):** dialog efter varje giv ("Kändes given rätt?"): kategori + fritext, hela
given + auktionen + sticken följer med som förifylld **GitHub-issue**
(etiketten `felrapport` skapad i repot). Kommandot **`/felrapporter`**
(`.claude/commands/felrapporter.md`) läser rapporterna via `gh`, återskapar
given som test (FACIT FÖRE FIX), lagar och stänger issuen. Byggt:
`src/lib/felrapport.ts` (rapportformatet, test-låst i `felrapport.test.ts` —
händerna i `parseHand`-format så given alltid kan återskapas exakt),
`FelrapportDialog.tsx`, inkopplad i `Play.tsx` (resultatdialogen,
omspelningsvyn och utpassad giv).

**🎉 🧠 Avancerad kortspelsteknik KLAR & pushad (2026-07-02, testsvit 1474):**
MED-scopet (slutkast/inkast + skvis) levererat i två steg, FACIT FÖRE FIX,
ingen tjuvkik. Trappan + design-lärdomarna i `docs/bot-hjarna.md`.
**Steg A** (`play-bot-technique.test.ts`): tre DDS-verifierade facit-givar
bevisar att MC-fönstret EXEKVERAR teknikerna — A0 korsruff m. lönnkast
(MC 6/6, tumregel 5), A1 slutkast (MC 5, tumregel 4; Östs VISADE ruterrenons
låser ♦K hos Väst i samplingen = äkta inferens), A2 enkel skvis (MC 4,
tumregel 3). **Steg B** = luckan FÖRE MC-fönstret (9–13 kort): B0-facit
(9-korts skvis: Nords första sakning vid 9 kort avgör — rätt kast 6, ♠5 = 5)
+ **B1 kast-vakt** (`guardedDiscard`, `play-bot.ts`): spelförarsidans
sakningar vaktar lastbärande kort via ärlig räkning i stället för "kasta
lägst"; vakten ensam lyfte gamla 6-korts-referensen 2→3. Robust över seedar
1–10. (Testräkningen: vitest 4 räknar varje it.each-fall — gamla "testsvit
729" var samma svit i annan räknebas.) Villkorade B2 (cash-ordning) + Steg C
(rätta räkningen) = ⚪ SENARE, byggs bara vid bevisat behov (facit-giv).

### FAS 12 — UI (sista fasen i felsökningsplanen)

FAS 12 UI levererat & live 2026-07-02, commits `a654c0e`→`b653808`. Tre trådar:
1. ✅ **Felsökningsplanens punkt 54–56 KLARA** (2026-07-02, testsvit 729):
   budförklaringar (54) + alert (55) fanns redan i `AuctionView` (klickbara bud,
   A-markör + ALERT-badge). Byggd lucka (56): **kravnivå-etikett** i
   förklaringspanelen — `FORCING_LABEL` (`rules.ts`, facit-låst) + färgkodad
   badge, och panelen läser kravnivå + alert ur **ETT** `ruleInfo`-anrop (samma
   regel, aldrig två källor). Verifierat i webbläsaren: "Krav 1 rond"+ALERT på
   negativ dubbling, "Ej krav" på svag tvåöppning. Båda flikarna täcks
   (budträning + spel går genom samma `AuctionView`).
2. **Synrey-riktningen (ägarbeslut + 5 skärmdumpar 2026-07-02):** efterapa
   Synrey Bridge så nära det går. **Steg 1 ✅ KLART & live** (commit `3aa3186`):
   budlådan kopierad rakt av (NT/♠/♥/♦/♣-rutnät, X/XX/PASS/OK, välj→OK),
   kompasspanel, auktionsrutnät m. färgchips + vit förklarings-popup,
   fyrfärgslek (`suitColors.ts`), minimal budfas (⋮-meny, HCP-bricka, dolda
   motståndare), omspelningen helt omgjord (alla händer uppe, trumf VÄNSTER
   via `handSuitsTrumpFirst`, » spelar sticket ett kort i taget m. animation,
   « bakåt, svart kontrakt-list). **Steg 2 ✅ KLART & live** (commit `adf647a`,
   ägarverifierat mot Synrey-bilder): spelvyn — motståndare helt dolda,
   kolumnträkarl, 👍-turmarkering, ⓘ/⋮-overlays, resultatdialog → omspelning;
   `SideStack` = Ö/V-kort vridna 90° med valörindex IN mot mitten (Öst speglad
   via `mirrorCorners`). **Steg 3 ✅ KLART & live** (commit `20c7166`):
   (a) "spelas av Syd"-bekräftelsedialog efter budgivningen (auto-hoppet borta,
   `confirmContract`); (b) budträningen på grönt filt (`AuctionGrid` m. teal
   turmarkering, budalternativ som Synrey-chips i `BidOptions`, handsolfjäder +
   HCP·TP-bricka, vitt facit-kort); (c) Budvisningen: auktionen på filt m.
   `AuctionGrid`, alla bud som `BidChip`; (d) mobilfinish (kompass w-24 på
   mobil, responsiva rubriker — alla vyer utan overflow på 375 px). Delade
   `HandFan`; döda `AuctionView` borttagen (allt går via `AuctionGrid`).
3. ✅ **Förfiningspasset (2026-07-02, ALLT live):**
   (a) **Mörkt/ljust läge**: sol/måne-knapp i sidhuvudet, valet i localStorage,
   följer systemet som standard; `dark:`-varianter på allt runt spelborden
   (`src/lib/theme.ts`; klassen sätts i `index.html` FÖRE laddning = ingen vit
   blink); **1 s-toning** vid växling (`.theme-fade`, aktiv bara under bytet).
   (b) **Mobilmeny**: sidhuvudet en rad på <640 px, ☰ fäller ut menyn.
   (c) **Ny startsida**: fyra klickbara lägeskort, Spela kort främst (grön ram).
   (d) **Sök i Budsystem**: filtrerar sektioner medan man skriver, träffar fälls
   ut, rubrikträffar gulmarkeras, träffantal visas.
   (e) **`Felt.tsx`**: EN sanningskälla för gröna bordet (5 kopior ersatta).
   (f) **♠ SVART överallt** (ägarbeslut): kort, chips, löptext — allt via
   `suitColors.ts` (ljusare löptextvariant i mörkt läge, ALDRIG på korten).
   (g) **Budvisningen HELT ombyggd** (ägarbeslut: "så likt Spela kort som
   möjligt"): ETT bord, alla fyra händer öppna — N/S spegelsymmetri (md-kort +
   mörka remsor), V/Ö sidostaplar, hp-brickor vid alla händer; auktionen i
   mitten spelas upp bud för bud (700 ms, pulserande turmarkering, klick →
   förklaringspopup m. kravnivå/ALERT); byggd med **LEVANDE budmotorn**
   (`buildFullAuction` via `decideCall` — auktionen bjuds ALLTID klart,
   "… auktionen fortsätter"-texten borta för gott); poäng/steg-för-steg +
   hålfinnare hopfällda under bordet; ryms på EN mobilskärm. Tätare
   `AuctionGrid` (delas av alla vyer).
   **Känt:** `play-bot-smart.test.ts` slumpflaggar sällsynt (Monte Carlo,
   ej relaterat) — ägaren startade stabiliseringsuppgift i egen session.

## 2026-07-01

### FAS 11 — Bot-hjärnan (kortspel/motspel-förfining)

Pushad (testsvit 727, commit e20b7ac). **OMSTRUKTURERAD** (start 2026-07-01).
Ägaren pekade ut den riktiga smärtan: bottarna tar t.ex. 10 stick
där 13 var kalla — usel stickföring, "kryper under i onödan". FAS 11 (signaler)
löser INTE det. Så FAS 11 blev ett större epos: **expertspel via ärlig enkeldummy-
inferens** — bottarna ska läsa bordet (räkna de 40 HP:na, dra bort budvisning +
fallna kort). **Järnprincip: ingen tjuvkik** (DDS ser alla händer = fusk; används
i stället över *troliga* händer via Monte Carlo). **Färdplan i `docs/bot-hjarna.md`.**
Trappan (test-låst, FACIT FÖRE FIX):
- **Steg 1 ✅ KLAR & live** — ärlig stickföring i `play-bot.ts`: cash:a säkra
  vinnare, kryp aldrig under. 1a (sang+trumf) + 1b (sidofärg när trumfen är
  räknad via `card-counting.ts`: `unseenTrumpCount`). Testsvit 659.
- **Steg 2 ✅ KLAR & live** — hand-modellen `hand-model.ts` (ryggraden):
  tolkar auktionen till HP-spann + färglängder + renonser per plats. Del 1
  (HP-liggare), del 2 (längder), del 3 (svaga öppningar + svararens golv 6+/12+).
  Testsvit 680.
- **Steg 3 ✅ KLAR & live** (2026-07-01, testsvit 697) — **Monte-Carlo-DDS**
  (`monte-carlo.ts`). **3a** `sampleLayouts` delar ärligt ut de osedda korten till de
  två dolda händerna så varje giv stämmer med hand-modellen (renonser/längd/HP,
  skärpt av redan spelade kort per plats). **3b** `chooseCardMonteCarlo` kör DDS
  ärligt på sampeln och röstar fram kortet med bäst snitt (max stick åt spelföraren,
  min som motspelare). **3c** `botCardSmart` (`play-bot.ts`) inkopplad i `Play.tsx`:
  MC i slutspelet (≤7 kort, seedad ur auktionen + `shownVoids`), annars tumregler
  (öppningsutspel / tung giv / ett-lagligt-kort → fallback, tidigt spel orört).
  Bevisat: 6-korts-slutspel 2→3 stick, facit nått utan tjuvkik.
- **Svansen ✅ KLAR & live** (2026-07-02, testsvit 727): **pt 47–49** facit-granskning
  av `signals.ts` mot §8 (14 facit-lås). **pt 50 signalavkodning** (`signal-decode.ts`):
  motspelaren läser botens öppningsutspel → hand-modellen (längd ≥4 + touchérande
  honnör när entydig); modellen fick per-färg-HP `suitHcp`. **"Varför?"-knapp**
  (`botCardReasoned` + `Play.tsx`). **Webworker + tänjt MC-fönster** (`mc-worker.ts`,
  adaptiv `mcBudget`, 7 → 8 kort, ingen UI-frys; uppmätt 7 kort ~2 s, 8 kort ~3,7 s).
  pt 51 DDS-gräns = känd, bekräftad. **Kvar (SENARE):** avancerad teknik
  (slutkast/inkast/squeeze), svårighetsnivåer.
**Scope (ägarbeslut 2026-07-01):** MED = "Varför?"-knapp (botten förklarar draget)
+ avancerad teknik (slutkast/inkast/squeeze). SENARE = svårighetsnivåer.

### FAS 10 — Försvarsbud (§7)

Pushad (testsvit 644, commit 3208482). **🎉 KLAR** (2026-07-01, testsvit 644).
Facit-granskning §7.1–7.6: alla verktyg (`overcalls.ts`, `doubles.ts`,
`lebensohl.ts`, `dont.ts`, `defense-conventional.ts`) lästa mot systemboken →
**svaren matchar facit**, väl testtäckta (overcalls 24, doubles 15,
defense-conventional 14, dont 7, lebensohl 6). **Byggd lucka:** `advanceTwoSuiter`
(`overcalls.ts`) – advancerns svar på partnerns tvåfärgsinkliv (Michaels / ovanlig
2NT), som saknades helt. **Ägarbeslut 2026-07-01:** preferens till den av partnerns
visade färger advancern är längst i (lika längd → högfärgen); **aldrig pass ostört**;
contested → pass tillåtet (partnern rebjuder sin ospecificerade färg; Michaels över
högfärg utan hf-fit → ostört 3♣ pass-eller-rätta). Facit i `overcalls.test.ts`.

### FAS 9 — Passad hand: Drury

Pushad (testsvit 635, i commit 3208482). **🎉 KLAR** (2026-07-01, testsvit 635, pushad).
Facit-granskning §6.7: Drury-basen (`responses-drury.ts`) matchar systemboken exakt
(2♣ = 3 trumf, 2♦ = 4+ trumf, 10–12 hp; öppnarens 2M signoff / 3M utgångsförsök /
4M utgång). **Byggd lucka (auktionen dog förut):** `responderAnswerDrury` –
svararens (passade handen) placering efter öppnarens Drury-återbud, inkopplad i
`responderSecondBid` (`responder-rebids.ts`). **Ägarbeslut 2026-07-01:** accepterar
3M-utgångsförsöket med **stödpoäng ≥ 11** (`pointsWithFloor(..., 'support')`, samma
`max(hp, dummyPoints)`-omvärdering som Steg B/C – 4+ trumf + korta sidofärger lyfter
toppen av 10–12), annars pass; 2M-signoff / 4M-utgång passas alltid. Sidoeffekt:
signoff-auktioner stängs nu med svararens pass (`1♥–2♣–2♥–P`) i stället för att
lämnas öppna. E2e `1♥–2♦–3♥–4♥`. Facit i `responses-drury.test.ts`.

### FAS 8 — Slamsystem

Pushat (testsvit 630). **🎉 KLAR** (2026-07-01, testsvit 630). Punkt 1 (MSS-slam) +
facit-granskning §6.1–6.5 (testsvit 621) + punkt 2 (Gerber över 2NT) + punkt 3
(Exclusion när renons rankar över trumf) — allt pushat (commit `340028a`).
- ✅ **Punkt 3 Exclusion när renons rankar över trumf** (2026-07-01): nivåbailen
  (`voidSuit >= trump → null`) borttagen ur `exclusionInvestigation`
  (`slam-auction.ts`). Enda inkopplade fallet är **hjärter trumf + spaderrenons →
  5♠** (lagligt över 3NT-relät). Öppnarens högsta stegsvar (steg 4) landar på
  exakt **6♥**; vill svararen bara ha lillslam **passar** hon (i stället för att
  olagligt bjuda om 6♥). Storslam-grenen bjuder 7♥ som förut. E2e
  `1H–3♠–3NT–5♠–6♥–7♥`. Facit i `slam-auction.test.ts`.
- ✅ **Punkt 2 Gerber över 2NT** (2026-07-01): `gerber2NTInvestigation` (`nt-slam.ts`),
  inkopplad i `auction.ts` som 2NT-blocket (speglar 1NT-Gerber-blocket). En
  balanserad slamsäker svarare (**13+ hp** mittemot 20–21 ≈ 33+) frågar ess med
  **4♣ Gerber** i stället för att blint blåsa 6NT: stannar i 4NT om två ess saknas,
  6NT med ett ess ute, storslam 7NT via 5♣-kungfrågan (≈37+). 11–12 stannar som
  kvantitativ 4NT (`respondTo2NT`, orört). Delad `buildGerberSequence` med
  1NT-grenen. E2e `2NT–4♣–4♠–6NT`. Facit i `nt-slam.test.ts`.
- ✅ **Punkt 1 MSS-slam** (2026-07-01): slamfortsättning efter `1NT–2♠–3♣/3♦`
  (minorfit garanterad). Ny `mssMinorFitContinuation` (`slam-auction.ts`),
  inkopplad i `auction.ts`; döda 4-minor-grenen bort ur `responder-rebids.ts`.
  **Ägarbeslut: NT om säkert, annars minor.** NT-säkert (alla hf har A/K/Q +
  ingen svararrenons) → 6NT (33–36) / 7NT (37+), för svagt → 3NT. NT osäkert
  (gapande hf / renons) → minor-slam via `slamInvestigation` (cue→RKC→6/7m), för
  svagt → 5m. Hela arsenalen (cue/RKC/Sjöberg). E2e `1NT–2♠–3♣–4NT–5♦–6NT`.
- ✅ **Facit-granskning §6.1–6.5** (2026-07-01): alla sex slamverktyg i `slam.ts`
  lästa mot systemboken → **inget fel i svaren**, koden matchar facit exakt (1430
  RKC, trumfdamfråga, cue-bud, Sjöbergs 5NT, Gerber ess/kung, Exclusion). Täppte
  två luckor i facit-LÅSNINGEN (tester): Gerber kungfrågan (3 grenar olåsta) +
  Exclusion steg 3–4. La till 6 facit-lås i `slam.test.ts`. Ingen kodändring.

### FAS 6 + 7 (testsvit 612)

FAS 6 (facit + `npm test`):
- ✅ **26 Minor-regeln** verifierad + facit-låst (3-3♣/4-4♦/5-5♦/längsta minorn).
- ✅ **27 Inverterade minorer:** **svararens fortsättning byggd**
  (`responderRebidAfterInvertedMinor`) – auktionen dog förut vid öppnarens återbud.
  Placerar mot 3NT (2NT→3NT m. 11+, stopp-visning→3NT om täckt annars 5m, 3m
  minimum→3NT bara m. 13+ & båda hf stoppade, 3NT→pass). E2e `1♦–2♦–2NT–3NT`.
- ✅ **28 Svaga hoppskift** verifierade. **Ägarbeslut:** inget 1♦–3♣ (behåll 1NT).

FAS 7 (facit + `npm test`):
- ✅ **29 Svaga tvåor + 30 Ogust** verifierade (redan väl täckta).
- ✅ **31 Spärröppningar:** **öppnarens feature-visning byggd** (`rebid: feature`,
  maximum utan stöd visar yttre A/K). **Ägarbeslut:** svag stödhand pressar INTE
  (bara utgångsvärden höjer).
- ✅ **32 Regel 2-3-4 (ägarbeslut, öppningsstruktur):** kvalitetsgrind på
  spärröppningen (`topHonorCount` i `openings.ts`), sårbarhets-modulerad.
  Topphonnörer A/K/Q: 3-läget ej sårbar ≥1/sårbar ≥2; 4-läget valfri/≥1. Skräp
  spärrar aldrig. **12 HP-golvet orört.** Facit i `openings.test.ts`.

### FAS 5 — NT-systemet

**🎉 KLAR (2026-07-01, testsvit 587, pushat+deployat).**
Punkt **19–25 klara**. FAS 5 var facit-granskning + luckor.
- ✅ **19 Stayman:** lagad inbjudnings-5-4-lucka (naturlig 2♥/2♠) + **garbage
  Stayman** (svag exakt 4-4 hf + kort klöver → 2♣, passar svaret). Ägarbeslut.
- ✅ **20 Smolen** verifierad. ✅ **22 Texas** verifierad.
- ✅ **21 Jacoby-transfer:** kärnan verifierad + **5-5-högfärgsschema** (ägarbeslut:
  transferriktningen kodar styrkan – svag→2♣, inbj→2♦→2♠, GF→2♥→3♥).
- ✅ **24 2NT-systemet:** turerna 1–3 verifierade + **svararens turn 4 byggd**
  (`responderRebidIn2NTAuction`: minorfit→utgång, ingen fit→3NT, Smolen över 2NT).
- ✅ **25 3NT-öppningen** verifierad.
- ✅ **23 Minor Suit Stayman:** svararens turn 4 byggd
  (`responderRebidIn1NTAuction`, case `Minor Suit Stayman`). Fit hittas alltid när
  öppnaren visar en minor (svararen har alltid 4+ i båda). Ägarbeslut: **3NT som
  standard**, höj minorn (`Minor Suit Stayman: höjning`) **bara med slamintresse
  ~16+**; ingen fit→3NT. Fortsatt cue/RKC + öppnarens 3♥/3♠-stopp & 4♣/4♦-max =
  **FAS 8**. Facit i `responder-rebids.test.ts`.

### FAS 4 (autonom körning – besluten för granskning)

- ✅ **Punkt 16 — HP/TP/LTC-karta:** motorn kör HP + TP; **LTC finns inte**.
  Beslut: inför inte LTC (TP täcker det). Karta i `docs/handvardering.md`.
- ✅ **Punkt 17 — stödvärdering verifierad:** fitpoäng/distributionsvärde/kortfärger
  isolerade + låsta (`evaluation.test.ts`); Bergens asymmetri bekräftad.
- ✅ **Punkt 18 — slamvärdering:** `wastedHonorsOppositeShortness` nedvärderar
  K/D mot partnerns kortfärg (ess behålls), inkopplat i `slamInvestigation` via
  Jacoby-kortfärg. Knyter ihop FAS 3-svansen.
- ✅ **Steg C-2 — minorhöjningar på TP:** längd/sidofärg lyfter, aldrig korthet
  (minorfit siktar 3NT). `responses.ts`.
- ✅ **Steg C-3 — sang-accepter på TP:** 3NT-accepter på startpoäng. `rebids.ts`.
- ✅ **Steg D — sang-nudge (komplett):** bra 14 (ingen 5-korts färg) → 1NT
  (`openings.ts`). 5-korts minor öppnar minorn, 5-korts major öppnar 1M.
  **Sårbarheten modulerar tröskeln:** ej sårbar = aggressiv (startp. ≥15), sårbar
  = passiv (≥16). `isVulnerable` trådad via `buildAuction`. Facit i `openings.test.ts`.

### FAS 3

- ✅ **Punkt 11 — Gemensam fitklassificering** (klar 2026-07-01): `classifyFit`
  (`evaluation.ts`) ger EN sanningskälla för fitens kvalitet: `none / two / three /
  good-three / four / five-plus`. "Bra 3-stöd" = 3 trumf med trumfhonnör (E/K/D)
  ELLER kort sidofärg (singel/renons). Facit i `evaluation.test.ts`.
- ✅ **Punkt 12 — Bergen aldrig med 3 stöd** (klar 2026-07-01): Bergen-grinden går
  nu via `classifyFit(...).hasFourPlus` i `respondToMajor` (`responses.ts`) →
  strukturellt omöjligt att fyra Bergen/Jacoby/splinter med 3 stöd. Intervall
  bekräftade (3♣ = 7–9, 3♦ = 10–12, 3M = 0–6). Facit i `responses.test.ts`.
- ✅ **Punkt 13 — Jacoby 2NT** (klar 2026-07-01): rätt stöd (4+ via `hasFourPlus`),
  "ingen kortfärg" garanteras av ordningen (splinter-kollen först → hand med
  singel/renons splintrar i stället). Facit i `responses.test.ts`.
- ✅ **Punkt 14 — Splinter kortfärg** (klar 2026-07-01): efter tvetydig splinter +
  relä visar svararen singelns färg **upp-the-line** (ägarbeslut: billigaste steg =
  lägsta möjliga kortfärg, 4♣/4♦/4♥) via `responderRevealSplinterShortness`.
  Renons går redan via Exclusion. Öppnarens honnörsnedvärdering mot kortfärgen =
  FAS 4 punkt 18. Hela kedjan verifierad (1♥–3♠–3NT–4♦).
- ✅ **Punkt 15 — Bergen game try** (klar 2026-07-01): triggern (1M–2M–2NT) fanns
  och använder rätt mått (**TP/Bergenpoäng 15–17**, ej rå HP/LTC). Svararen svarar
  nu (fanns inte förut) enligt **Bergens äkta variant** (ägarbeslut): visa KORTHET
  upp-the-line (3 sidofärg), annars platt 3M signoff / 4M accept via
  `responderAnswerBergenGameTry`. Facit i `responder-rebids.test.ts`.
