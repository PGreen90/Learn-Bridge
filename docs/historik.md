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

**🎉 Felrapport #14–#19 LAGADE & LIVE (2026-07-04, commits `6aa110d` +
`513ebb3`, testsvit 1668 grön, issues #14–#19 stängda):** sex rapporter från
Spela kort, var och en facit-låst (testet föll före, grönt efter), inga
on-book-lås rörda.
**#14** ovanlig 2NT/Michaels passades ut — linjebygget (`auction.ts`) ger nu
advancern preferens, så tvåfärgsinkliv stängs inte längre för tidigt (den kända
SENARE-punkten "kanoniska linjen passar ut ostörda tvåfärgsinkliv" åtgärdad i
roten). **#15** inklivaren passade advancerns NYA färg — gör nu en enkel
stödhöjning (3-korts fit mot en 5+ färg, `overcallerRaiseAdvance` i
`auction-live.ts`). **#16** öppnaren passade partnerns cue-höjning i
motståndarfärg — svarar nu (minimum = billigaste återbud, 15+ = utgång;
`partnerCueRaiseToAnswer`). **#17 (bud)** 2♣-öppnaren gömde 6-korts hjärter
bakom 3NT — visar nu en egen 5+ färg naturligt över ett 2NT-positivt svar
(`openerRebidAfter2C` i `responses-2c.ts`; ägarbeslut: 5-korts räcker, inget
hopp). **#17 (spel)** spelboten ledde ♠K rakt in i träkarlens singel-♠A →
avblockningsregel `unblockLead` (`play-bot.ts`): leder spelförarsidan en färg
där den synliga medspelaren har en högre singel spelas lågt i stället; gäller
både tumregel-boten och bot-hjärnans DDS-val. **#18** tvåfärgs-cuen mot deras
svaga tvåa cue-bjöd på 6 hp och spelades i deras färg → golv 15 hp
(`defense-conventional.ts`) + advancern måste svara en äkta stark cue
(`partnerWeakTwoCueToAnswer`). **#19** svararen passade en REBJUDEN 6-korts
högfärg — 2-korts stöd räcker nu som fit mot en färg partnern bjudit två gånger
(`fitLengthNeeded`), så dubbletonen höjs till utgång 4♥.
**Bevaka i spel (kortlivat):** advancern besvarar nu ovanlig 2NT/Michaels och
tvåfärgs-cue; inklivaren stöttar advancerns nya färg; öppnaren svarar
cue-höjningar; 2♣-öppnaren visar 5+ färg före 3NT; svararen höjer dubbletonen
mot en rebjuden högfärg; spelboten avblockerar (leder inte honnör in i
medspelarens singel). Säg till om något känns fel vid bordet.

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

---

## 2026-07-05 → 2026-07-07 — äldre NU-lägesrapporter (flyttade från CLAUDE.md 2026-07-07)

> **OBS:** ögonblicksbilder från när de skrevs — statusrader som "EJ PUSHAT",
> "#29 kvar öppen" osv. var sanna DÅ men är inaktuella nu (allt nedan är
> pushat & live; felrapport #1–#34 är stängda eller medvetet uppskjutna).
> F1-familjernas beskrivningar av kontroll-gates/slamzon på parets faktiska
> poäng beskriver KIK-ERAN — ersatta av de ärliga slamportarna 2026-07-07
> (mergepunkt `1ce2982`, se budsystem.md §6).

**F1 — bredda slam-utforskningen (PAUSAD 2026-07-07 kväll, se NU ovan).** Kom ur ägarens
budsystem-djupdykning (två färgkodade listor, se chatt): slam var bara inkopplat
i fem auktionsformer; hela GF-familjer (2♣, hoppskift/reverse, 1NT-återbud, 2/1
med fit) saknade slam-drivning. En probe (40 000 givar, DD-lösta) delade upp
missarna i **fyra familjer: A** (efter 1NT-återbud), **B** (efter stark 2♣),
**C** (efter öppnaren visat extra: hoppskift/hopphöjning/reverse — störst), **D**
(Jacoby 2NT-läcka: hängande cue). Byggs facit-först, en familj i taget.
**Familj A HELT KLAR** (jämn del LIVE, obalanserad del byggd & testad — se PCD-status):
efter `1m–1M–1NT` driver svararen med slamvärden (≥33 stödpoäng): **jämn** →
Gerber 4♣ → 6NT (`gerberRebidInvestigation`); **obalanserad med färgfit** (6+ egen
hf / 8+ korts fit) → trumf via `familyAFitTrump` → `slamInvestigation` (skipCueRound
+ kontroll-gate) → 6 i färgen. Båda i `buildAuction`; `nt-slam.ts` + `slam-auction.ts`.
Facit `auction-slam-1nt-rebid.test.ts` (2 givar: 6NT + 6♣, DD-verifierade). budsystem.md
§5.7 + §9.
**Familj D KLAR (slam-quirken stängd):** den hängande cuen (Jacoby 2NT → cue → RKC
lade två svararbud i rad → live-lagret passade delkontraktet) är lagad i
`slamInvestigation` (`slam-auction.ts`): cue-ronden läggs bara som ett KOMPLETT par
(svarare + öppnare), annars rakt på 4NT. Probe: **0 "två-i-rad" i 200 000 auktioner**
(var >0). Facit `auction-slam-jacoby-cue.test.ts` (1♥–2NT → 7♥). Den parkerade
slam-quirken är därmed LÖST. **1087 test gröna, tsc rent.**
**Familj C — HOPPHÖJNING KLAR (2026-07-07):** efter `1x–1M–3M` (öppnaren
hopphöjer svararens högfärg, 16–18 + 4 stöd) är trumfen redan överenskommen →
`buildAuction` kopplar in `slamInvestigation` (svararens hf trumf, cue-rond som
Jacoby-fiten, INTE skipCueRound) efter hopphöjningen. Portar: slamzon (≥33
stödpoäng), ≥4 nyckelkort, `pairControlsSideSuits` (motorn går ändå
deterministiskt vidare till 4NT → gaten krävs som #29). Probe (300 000 givar,
DD): 41 slamzon-stopp av 1 563 hopphöjningar. Make-rate-probe (250 000): drev slam
328 ggr, 16/18 DD-lösta höll (2 bet på exakt ett stick, finess) = 88,9 %. Facit
`auction-slam-jumpraise.test.ts` (1♥–1♠–3♠ → 6♠, 1♣–1♠–3♠ → 6♠, båda DD 13).
budsystem.md §5.2 + §9. **1089 test gröna, tsc rent.**
**KVAR i F1:** Familj B (2♣), C:s systerfall **reverse** (`1♣–1♥–2♦`) + **hoppskift**
(`1♦–1♠–3♣`) — störst men rörigare (ingen överenskommen trumf; vissa reverse-
auktioner kollapsar t.o.m. under utgång, eget problem). Se 👀 Bevaka.

**Senast klart & LIVE (2026-07-07): tre mobil-UI-fixar (ägarstyrt SIDOSPÅR, INTE F1).**
Ingen budlogik rörd; desktop helt oförändrat via `sm:`-brytpunkten (≥640px).
(1) **Större spelkort på mobil** (mergepunkt `1760ea3`): Syds hand större (48×64);
ny responsiv `smPlus`-storlek i `PlayingCard.tsx` (40×56 mobil / 28×40 desktop)
för **träkarlen** (norr, `SuitColumns` i `Play.tsx`) + **sidohänderna Ö/V**
(`SideStack.tsx`, både spelvyn och Budvisningen). Träkarlens kolumner glesare på
höjden (24px syns/kort mot 12 förr, ägarbegäran). Syds utfällning pressar ihop
nedtonade färger på mobil så inga kort klipps utanför kanten. (2) **Budförklaringens
kryss** (`AuctionGrid.tsx`, mergepunkt `642ab36`): krysset kunde knuffas utanför
bild (rubrikraden överflödade) → förankrat absolut i bubblans övre högra hörn +
rubriken radbryter; **tryck var som helst utanför bubblan stänger** (genomskinlig
helskärmsyta); krysset 36×36 med **iPhone-glaskänsla** (backdrop-blur, ljus kant,
glansdager). Gäller även ⓘ-rutan under kortspelet (samma komponent). Hela sviten
grön, tsc rent, båda Vercel-deployerna gröna.

**Senast klart & LIVE (2026-07-07): felrapport #33 + #32/#34 (STÄNGER #32/#33/#34).**
**#33 (budgivning):** advancern hoppade till **7♦** över partnerns 5♦ (grand slam
på 28 hp) — `raiseWithFit` (`auction-live.ts`) räknade "inbjudande hopp" = partnerns
nivå +2. Nu kapas inbjudande/enkla höjningar vid utgångsnivån och advancern passar
när partnern nått utgång. Facit `auction-advancer-cap.test.ts`. **#32 (budgivning):**
ägarregel för **6-5** (6-korts lågfärg + 5-korts högfärg) — 12–15 öppnar högfärgen,
16+ öppnar lågfärgen (reverse:ar in högfärgen); `openings.ts`, facit i
`openings.test.ts`, budsystem.md §3. **#32-spelfelet + #34-försvaret = UPPSKJUTNA**
(spelmotor-kvalitet, se ⚪ SENARE + `docs/bot-hjarna.md`; ägarbeslut 2026-07-07).
**1084 test gröna, tsc rent.** #32/#33/#34 stängda. Se 👀 Bevaka.

**Föregående (2026-07-07): slam efter hopp-återbud i minor (STÄNGER #29).**
`/felrapporter` #29 ("hur hittar vi slammen?"): N ♣AQJT94 öppnade 1♣, S svarade
1♠, N hoppade 3♣ (16–18, 6+ klöver) → boten stannade i **3NT** trots en **KALL
slam** (6♣/6NT/7 = 13 stick DD). Nu driver paret slam: efter `1m–1M–3m` med
svararens fit (3+ i minoren) kopplar `buildAuction` in `slamInvestigation`
(minoren trumf, `skipCueRound`) → 4NT RKC → 6♣. Cue-ronden hoppas över (ingen
explicit trumf-överenskommelse före frågan), i stället en **kontroll-gate**
(`pairControlsSideSuits`: ess eller korthet i varje sidofärg) som hindrar
RKC-blast med två snabba förlorare i en objuden färg (bevisat i probe: sänkte
nådda slam 85→63, tog bort de grova bet-slammen). Slamzon (≥33) + nyckelkort
(≥4/5) hindrar överbud på icke-slamhänder. Facit `auction-slam-jumprebid.test.ts`.
budsystem.md §9. **1080 test gröna, tsc rent.** #29 stängd. Se 👀 Bevaka.

**Föregående (2026-07-07): systems-on över 2♣–2♦–2NT.**
Efter öppnarens 2NT-återbud (22–24) använder svararen nu **Stayman (3♣) +
transfers (3♦/3♥) + Texas** precis som mot en naturlig 2NT-öppning, för att
hitta 4-4- och 5-3-högfärgsfit i stället för att blint bjuda 3NT. Svararen bjöd
2♦ (0–7 hp) → poänggränserna sänks två steg (utgång från 3 hp). Återanvänder
2NT-svarsmaskineriet via en `openerMin`-param (default 20 → naturlig 2NT
byte-identisk): `respondTo2NT`/`openerRebidAfter2NTResponse`/
`responderRebidIn2NTAuction`, hopbyggt i `strong-2nt-systemson.ts`, inkopplat i
`buildAuction`. Effekt: **~30 % av alla 2♣–2♦–2NT når nu 4♥/4♠** (förr 3NT); svaga
5-färger signar av 3♥/3♠. Facit i `auction-2c-gameforce.test.ts`. budsystem.md §9.
**1079 test gröna, tsc rent.** Se 👀 Bevaka.

**Föregående (2026-07-07): 2♣-öppningen håller sitt utgångskrav.**
Kom ur `/felrapporter` #29 ("hur hittar vi slammen?"): en utforskningsprob
(300 000 givar) visade att **~64 % av alla ostörda 2♣-öppningar dog i
DELKONTRAKT** (82 % av stoppen hade 23+ hp = rena kravbrott) — större fynd än
#29. Roten: `auctionForce` (`auction-live.ts`) spårade 2/1 + rondkrav men INTE
2♣-öppningens game-force (`buildAuction` bygger bara ett par bud av 2♣-linjen
och överlämnar resten, som passades bort). Fix (facit-först): (1) ny 2♣-gren i
`auctionForce` (game-krav tills utgång; undantag `2♣–2♦–2NT` = inbjudande);
(2) `respondToStrong2NTRebid` (off-book-fallback) + systems-on on-book (ovan).
Delkontrakt-andelen föll **63,9 % → 1,7 %** (resten legitima). Mergepunkt `b20d81f`.

**Öppna felrapporter: INGA.** #28 (4♠ ej bugg), #29 (slam efter hopp-återbud),
#32 (6-5-öppning byggd; spelfel uppskjutet), #33 (7♦-hoppet kapat), #34 (försvar
uppskjutet) — alla STÄNGDA 2026-07-07. **NU är åter öppet — ägaren väljer nästa
sak** (järnregeln: exakt en).

**Öppna felrapporter efter detta:** **#28** analyserad & STÄNGD 2026-07-07 (Syds
4♠ var korrekt offensivt bud, ej bugg). **#29** kvar öppen — ägaren tog
2♣-fixen (ett symptom) först; slam-letningen efter starkt hopp-återbud väntar på
ägarbeslut om riktning. **#32/#33/#34** (spelfel/budgivning) ännu ej lästa.
**NU är åter öppet — ägaren väljer nästa sak** (järnregeln: exakt en).

**Senast klart & LIVE (2026-07-06, mergepunkt `b1fdd6c`): två UI-fixar.**
(1) **Tunn kortram** — 1px svart med **20 % opacitet** (`border-black/20` på
`base` i `PlayingCard.tsx`) → mjuk grå separation mellan korten. Ägarbeslut som
ersätter det ramfria beslutet 2026-07-03; opaciteten valdes efter att ägaren såg
helsvart och bad om "gråare, inte lika solid". (2) **Mjukare Auto-Claim** —
resultat-/claimrutan poppade förr upp blixtsnabbt; nu tonar bakgrunden in
(`overlay-in` 200ms) och rutan tonar in + lyfts en aning (`dialog-in` 260ms),
nya keyframes i `index.css`, klasser på overlayn i `Play.tsx`; respekterar
`prefers-reduced-motion`. Rena className/CSS-ändringar, ingen budlogik rörd.
1071 test gröna, tsc rent, Vercel-deploy grön.

**KVAR av ägarens 4-punktslista (2026-07-06 — han bad förbereda alla fyra, tog
punkt 2+4 nu):** **Punkt 1** = fler budträningsgivar + en "Vill du träna något
speciellt?"-dropdown (data i `src/data/exercises/*.json` + `EXERCISES_BY_THEME`
i `bidding.ts`; facit bör knytas till motorns egna svar så det aldrig lär ut fel).
**Punkt 3** = sondera budsystemet på djupet (STORT eget spår: håller reglerna,
off-book-tolkning "vad kan detta bud betyda", R2:s datadrivna detektorkedja).
Ägaren väljer vilken som blir nästa 🔵 NU.

**Senast klart & LIVE (2026-07-06): `/felrapporter` — #31 + #30 lagade & stängda.**
- **#31 (svagt hoppskift avskaffat):** Nord hoppade till 2♥ på 1♦ med ♠7 ♥KT6432
  ♦Q4 ♣A986 (9 hp). Ägarprincip: **när partnern öppnat håller svararen budgivningen
  LÅG** — bjud nya färgen billigast (1♥, rondkrav), ett hopp berövar partnern
  utrymme (t.ex. 1NT). `respondToMajor`/`respondToMinor` (`responses.ts`) faller nu
  till 1-lägessvaret; öppnarens hantering av ett MANUELLT hoppskift orörd.
  Mergepunkt `86a295c`. Docs: budsystem.md §4.1/§4.2/§9.
- **#30 (stark jämn hand når utgång efter minorhöjning i konkurrens):** Väst (19 hp
  jämnt) nådde bara 2♥ efter `1♦–(1♠)–2♦`. Två fixar (ägarbeslut, båda vägarna):
  (1) **öppnings-uppgradering** — jämn 19 med startpoäng ≥20 öppnar **2NT**
  (`openings.ts`); fixar den rapporterade given (2NT→3NT). (2) **återbudsfix** —
  `openerStrongNTAfterMinorRaise` + `answerOpenerNTInvite` (`auction-live.ts`): 3NT
  (20+) / 2NT-inbjudan (18–19) med stopp, höjaren accepterar med maximum. Mergepunkt
  `603f86c`. Docs: budsystem.md §3, §5.10, §9. Se 👀 Bevaka.
- **1071 test gröna, tsc rent, båda deployerna gröna.**

**KVAR ÖPPNA FELRAPPORTER (ägaren sköt upp 2026-07-06 — ta en i taget vid
`/felrapporter`):** **#28** ("aggressivt av syd, analysera" — Syd bjöd 4♠ med
renons + 5-5; bedömningsfråga) och **#29** ("Annat — hur hittar vi slammen?" i N/S;
förbättringsfråga). Båda är analys/bedömning snarare än tydliga buggar.

**Senast klart & LIVE (2026-07-05, mergepunkt `1a2da2e`): felrapport skickas
DIREKT utan att öppna GitHub** (var SENARE-punkten "PAT-i-localStorage"). Ägaren
sparar en snäv fine-grained GitHub-nyckel (Issues: read/write på Learn-Bridge) EN
gång i Inställningar; då POST:ar `FelrapportDialog` rapporten direkt via GitHubs API
(`submitFelrapport` i `src/lib/felrapport.ts`), knappen blir "Skicka rapport ✓" +
kvitto. Utan nyckel = oförändrat (öppnar förifylld GitHub-sida). Nyckeln lagras i
`src/lib/github-token.ts` under egen nyckel `rebidz:felrapport-token` (utanför
`learnbridge:`-prefixet → "Nollställ framsteg" rör den ej); samma nyckel funkar på
flera enheter. Fel → svenskt meddelande + reservknapp "Öppna på GitHub →". 1061
test gröna, tsc rent, deploy grön, **bevisat skarpt av ägaren (issue #31)**.

**Del 3 (PWA) KLAR & LIVE (2026-07-05):** appen är nu installerbar ("Lägg till på
hemskärmen" på iPhone/Android, egen guld-spader-ikon på emerald) + fungerar
offline. `vite-plugin-pwa` (autoUpdate) genererar service worker + `manifest.webmanifest`
vid Vercel-bygget; `index.html` har apple-touch-icon + iPhone-taggar; ikoner i
`public/` (192/512/maskable/apple-touch). Verifierat i webbläsaren mot skarpa
bygget (SW registrerad scope `/`, manifest laddat, inga konsolfel). 1052 test
gröna. Mergepunkt `565bbc8`. Ikonerna genererades ur `public/favicon.svg`-designen
(engångsskript m. `sharp`, borttaget efteråt; `sharp` ej kvar i deps).
**Uppföljning (2026-07-05, mergepunkt `43640e2`):** sidhuvudet fick
`pt-[env(safe-area-inset-top)]` (`Layout.tsx`) – i PWA-helskärm på iPhone låg
toppen annars under statusraden (klocka/batteri). Marginal = enhetens statusrad
(0 i vanlig webbläsare). Bekräftat lagom av ägaren på hans iPhone. `<main>` hade
redan motsvarande safe-area i botten.

**Del 2 KLAR & LIVE (2026-07-05):** egen domän **https://rebidz.com** köpt via
Vercel (auto-DNS, auto-förnyelse 5 juli 2027, WHOIS-privacy) + kopplad till
learn-bridge-projektet (Production). `rebidz.com` = huvudadress (visar appen,
HTTPS ✅); `www.rebidz.com` → 308 till rebidz.com. Ren Vercel-konfig, ingen
kodändring. **Nya publika adressen att dela = https://rebidz.com** (gamla
`learn-bridge-topaz.vercel.app` lever kvar som reserv).

**Del 1 KLAR & LIVE (2026-07-05):** hosting flyttad från GitHub Pages till
**Vercel** (repo & felrapport-URL stannar `Learn-Bridge` på GitHub). Konkret
gjort: Vite `base` `/Learn-Bridge/` → `/` (`vite.config.ts`); vakttestet
`src/deploy-config.test.ts` låser nu `/`; ny `vercel.json` kör test-/typgrinden
(`npx tsc && npm test && npm run build`) så trasig kod aldrig går live — samma
skydd som förr; gamla Pages-workflowen (`deploy.yml`) INAKTIVERAD (push-triggern
borttagen, `workflow_dispatch`-endast, filen kvar som referens). 1052 tester
gröna. Mergepunkter `79fd1d0` (flytten) + `18efe8b` (Pages av).

**⚠️ Två ärliga varningar (upprepa för ägaren):** (1) Steg A förbättrar INTE
boten — bara var appen bor; bot-utvecklingen är ett SEPARAT framtida NU. (2)
`/felrapporter` överlever flytten OFÖRÄNDRAT (`src/lib/felrapport.ts` bygger bara
en länk till `github.com/PGreen90/Learn-Bridge/issues/new`; repot stannar).

**Föregående NU (bredare flerronds-konkurrens A+B+C, R1 Fynd #2 sista delbit) är
KLAR, PUSHAD & i synk med origin** (git verifierat 2026-07-05 — den gamla "EJ
PUSHAT"-noten nedan är inaktuell). Ägaren överrörde järnregeln medvetet och bad
om alla tre bekräftade fel i EN session.

**Senast klart (2026-07-05, EJ PUSHAT — inväntar PCD): bredare flerronds-
konkurrens (A+B+C).** Metod: en utforskningsprob körde 4000 slumpgivar genom hela
den levande auktionen, plockade ut äkta flerronds-konkurrenser och blottade tre
bekräftade fel (verkliga händer lästa som facit). Alla tre byggda facit-först:
- **A — öppnaren säljer i rond 2 när partnern PASSADE inklivet + RHO konkurrerade**
  (`1♣–(1♠)–P–(2♠)`): ny `openerReopensAfterPartnerPass` (`auction-live.ts`) – egen
  6+ färg → tävla; 15+ & kort i deras färg → återöppnings-X. Vakt: ingen
  motståndar-X + motståndarna ≥2 kontraktsbud (skiljer från felrapport #23).
- **B — öppnaren säljer i utpassningssitsen** (`1♠–(2♥)–P–P`): partnern trap-passar,
  öppnaren återöppnar. `openerReopensBalancing` (`auction-live.ts`) – kort i deras
  färg → X (partnern konverterar till straff), egen 6+ → rebjud, 15+ → X. **Kärnfix
  i `auction.ts`:** `buildAuction` STÄNGDE linjen (`open=false`) så snart svararen
  passade ett inkliv → contested-blocket hoppades över. Nu `finish(true)` (öppen,
  som takeout-X/Michaels-grenarna) → decideCall äger fortsättningen. Invariant-testen
  hoppar över öppna linjer → inget on-book-brott.
- **C — advancern tävlar upp till fiten** (`1♠–(2♥)–2♠–?`): ett 2-läges inkliv lovar
  6+ → 3-korts stöd = 9-korts fit. `advancerCompetesToFit` (`auction-live.ts`, före
  off-book-svaret) – tävla 3M (lagen om totala stick), 13+ stödpoäng → utgång, svag
  → pass. (Skilt från `raiseWithFit` som krävde 4-korts stöd och hade bjudit 4M.)

Facit: `auction-opener-reopen-passed.test.ts` (A, 3), `auction-opener-reopen-
balancing.test.ts` (B, 4), `auction-advancer-compete-fit.test.ts` (C, 2) – alla röda
före fixen. **1052 tester gröna, tsc rent.** budsystem.md §5.9 + §7.1. Verifierat
end-to-end i proben: #159→3♣, #56/#552→2♥ dubblat (straff), #263→3♥. Se 👀 Bevaka.

**Kvar/öppet efter detta:** R2:s förslag att göra detektorkedjan i `decideCall`
datadriven (~28 steg nu) står kvar som ett EGET framtida NU – väg in det innan fler
konkurrenslägen staplas på (`docs/status.md` "Budmotorns tre auktionslager").

---
**Föregående NU-historik (KLARA & LIVE):**
Föregående NU ("låna en kung" i balansering, §7.1) är **KLAR & LIVE**.

**Senast klart & LIVE (2026-07-05, commit `f36d058`, deploy grön):
"Låna en kung" i balanseringssits (§7.1).** I utpassningsläget (deras
1-lägesöppning + två pass) är partnern markerad med värden, så §7-inklivets
HP-golv sänks med **en kung (−3)**: enkelt inkliv 8→5, upplysnings-X 12→9 (form
10→7), 1NT-inkliv 15–18 → **11–14** (klassisk återöppnings-1NT). **Flat HP-lättnad
— §7-lagret behåller rå HP; TP-i-§7 avvisades medvetet (ortogonalt: TP=formspak,
kung=sitsspak, och TP lyfter inte de PLATTA händer balansering finns till för).**
`overcall` (`overcalls.ts`) fick en `balancing`-flagga; trådad från BÅDE
`maybeOvercall` (`auction-live.ts`, live) OCH `buildAuction` (`auction.ts`,
on-book balanseringsgren — annars passades given ut med open=false och nådde
aldrig live). Direkt sits **exakt oförändrad** (relief=0). Facit
`overcall-balancing.test.ts` (6: enhet + integration; direkt-sits-kontroller
bevisar seat-specificiteten). 1043 tester gröna, tsc rent, deploy grön.
budsystem.md §7.1. Se 👀 Bevaka.

**Senast klart & LIVE (2026-07-05, commit `112f0fc`, deploy grön): Öppnarens
rond-2 i störd auktion efter partnerns NYA FÄRG / 1NT (§5.8).** Systerfallet till
delbit 6 (§5.4, som gällde partnerns *höjning*). Roten
(bevisad i utforskning): så snart motståndarna bjöd om över partnerns fria svar
passade öppnaren bort ÄVEN starka händer (rondkravet är tekniskt av då). Ny
detektor `openerRondTwoInCompetition` (`auction-live.ts`, före `maybePenaltyDouble`
+ off-book-svaret). Ägarbeslut 2026-07-05: **visa extra med CUE i deras färg +
naturliga hopp**; trösklar speglar delbit 6 (**15+ = extra, 18+ = utgång, 6:e
kortet = tävla**). 18+ högfärgsfit → 4M; 18+ jämn m. stopp → 3NT; 15–17 högfärgsfit
→ inbjudande hopphöjning; 15+ i övrigt → **cue** (hitta rätt utgång); minimum m.
egen 6+ färg/fit → tävla; annars pass. Styrka = stödpoäng med fit, annars ren hp
(så en lång svag färg inte blåser upp handen). Facit
`auction-opener-competition-response.test.ts` (9, röda före fixen). 1037 tester
gröna, tsc rent, deploy grön. Se 👀 Bevaka.

**Senast klart & LIVE (2026-07-05, commit `a989a08`, deploy grön): Störda krav
(§5.5).** Steg 1 hedrade krav bara OSTÖRT; nu även i KONKURRENS. `auctionForce`
(`auction-live.ts`) fick en egen gren (`competitionForce` + `isJumpBid`): ett
**fritt bud (ny färg, ej hopp, ej cue)** och en **reverse** i störd auktion är
**RONDKRAV** — partnern tvingas svara via `honorForce` i stället för att passa.
Aldrig utgångskrav i konkurrens (ägarbeslut: ett inkliv "lånar" utrymme → 2/1
lovar värden men ej garanterad utgång). Passad svarare / hopp / cue undantas.
Facit: `foundation-forcing-competition.test.ts` (störda A/B/C, röda före fixen) +
`.stress.test.ts` (10 000 seedade givar; rondkravet utlöstes 146 ggr, passades
aldrig). Se 👀 Bevaka.

**Senast klart & LIVE (2026-07-05, commit `ca04175`, deploy grön): New Minor
Forcing (§5.7).** Efter `1m–1M–1NT` bjuder svararen (5-korts högfärg + 11+) den
oanvända lågfärgen (2♣/2♦, konstgjort krav); öppnaren svarar (5 prioriteringar,
passar aldrig); svararen placerar (13+ når alltid utgång). `responder-rebids.ts`
(`newMinorForcingBid`, `responderPlaceAfterNMF`), `rebids.ts` (`openerAnswerNMF`),
`auction-live.ts` (`nmfToAnswer` + `nmfPlacementToAnswer` tvångssvarare). Facit
`new-minor-forcing.test.ts` (21). End-to-end: `1♣–1♥–1NT–2♦–3♥–4♥` hittar 5-3-fit.

**Senast klart & LIVE (2026-07-05, commit `eca5ff0`): budsystemets grunder steg 1.**
`auctionForce`/`honorForce` → krav passas aldrig OSTÖRT (2/1, ny färg, reverse);
`raiseWithFit` → minorfit + utgångsvärden når utgång (3NT/5m). Facit
`foundation-forcing.test.ts` A–D. budsystem.md §5.5+§5.6. **Detta NU utvidgar det
till konkurrens.**

---
**HISTORIK nedan (tidigare sessioner, KLARA & LIVE — behandla ej som pågående):**
Kontraktväljaren (KLAR & LIVE):

**ALLA TRE DELSTEG BYGGDA & VERIFIERADE (2026-07-05, ej pushat):**
- **(1) Filtret + motor-fix.** `contract-target.ts` (`matchesTarget` +
  `simulateAuction`). **Under bygget upptäcktes att motorn ALDRIG nådde 5♣/5♦**
  (0 av 30 000) – äkta lucka, inte att kontraktet är ovanligt. **Lagat**
  (ägarregel: utforska bara med en svag färg): svararen med lågfärgsfit + en
  osparrad färg går inverterad 2m i stället för att chansa 3NT och landar i 5m
  (`responses.ts` `hasWeakSideSuit`, `responder-rebids.ts` inverterad-minimum →
  5m). Nu nås 5♣/5♦ ~1 per 54. `budsystem.md` §4.2 uppdaterad.
- **(2) Sökaren.** `dealForTarget` (slumpa tills match, tak 60 000, null-fallback).
- **(3) Menyn i `Play.tsx`.** "Mål:"-pill → `ScenarioPicker` (7 scenariokort),
  batchad sökning (300/tick, setTimeout → fryser aldrig) med `SearchOverlay`
  ("Söker … N prövade" + Avbryt + ge-upp-väg), målet sparas i localStorage
  (`play-target`), "Ny giv" letar på samma mål. Random = som förr.

996 tester gröna, tsc rent, verifierat i webbläsaren (pill, väljare, sökning för
lågfärg + storslam, ren konsol). **Kontraktväljaren = KLAR & LIVE, inga öppna
punkter (ägaren godkände 2026-07-05).**

**NÄSTA GÅNG (ägarbeslut 2026-07-05): 🔵 NU blir "Budsystemets grunder — varför
de faller".** Ägaren vill gräva i budsystemets FUNDAMENT och förstå varför de
brister (inte laga en rapport i taget utan hitta rot-mönstren). Startpunkt:
felrapport #26 + #27 (nyss lagade) visade samma rot — motorn hedrar
utgångskrav/rondkrav i sin FÖRPLANERADE linje men tappar dem OFF-BOOK (när
ägaren öppnar/bjuder en annan hand än motorn valt). Fråga ägaren vilka
grundregler som känts opålitliga i spel och bygg facit-givar som blottar
mönstret innan något byggs om. (Kontraktväljaren = KLAR & LIVE, se nedan — inga
öppna punkter kvar.)

**Senast klart & LIVE (2026-07-05):** felrapport #26 + #27 lagade, pushade,
deploy grön (commit `f9531b2`). Båda samma rot: utgångskrav passades OFF-BOOK.
#26 → `answerCueBidderRebid` (cue-bjudaren fullföljer efter öppnarens svar);
#27 → `answerTwoOverOneRaise` (svararen sätter utgång efter 2/1 som öppnaren
höjt). 998 tester gröna. Se 👀 Bevaka. **Detta är den direkta ingången till
nästa NU** (off-book-krav = ett grund-mönster som faller).

**Senast klart & LIVE (2026-07-05, mergepunkt `1bec779`):** starka
upplysningsdubblingens **flerronds-fortsättning** byggd, test-låst & pushad
(`auction-live.ts`: `strongDoubleContext` + `advanceStrongDoubleRebid` +
`strongDoublerSecondRebid` + `answerStrongDoubleGameForce`). Game-hoppet borttaget
(kan bli katastrof mot 0 hp); partnern tvångssvarar (stödstege / utan stöd egen
färg); den starka handen dömer game på TP (**6+ & 22+ TP → hopp till 3-läget**,
annars lägsta nivå); partnern svarar 3-hoppet (utgång m. 1–2 stöd / 3NT nekar).
TP-tröskel 22 = ägarval efter 6 exempelhänder. Ordet "monster" bannlyst. 976
tester gröna, tsc rent, deploy grön. **Öppen finslipning (ägaren, i spel):** den
starka handens dom EFTER en stödhöjning körs på en konservativ default – se
👀 Bevaka.
**NÄSTA GÅNG börjar vi med:** ägaren pekar ut nästa NU (en sak, järnregeln). Bra
kandidater: **nästa delbit av R1 #2** (se "Kvar" nedan) eller en punkt ur R6:s
handlingsplan (`docs/audit/SLUTRAPPORT.md`) / NÄST-listan.

**Senast klart & live (2026-07-05, dok-synk – commits `8d2d413` + `70660fb`):**
ägarmandat *"all ändring i Budsystemet ska gå att läsa på hemsidan."* Budsystem-
sidan läser `docs/budsystem.md` direkt (§9 Ändringslogg är dold), så live-regler
som förr bara låg i kod/ändringslogg skrevs nu in i läsbara sektioner: **§7.3
Takeout Double** (egen sektion; ordet för den starka 17+-handen borttaget på ägarens begäran – skriv "bra/stark hand"),
**§5.4** öppnarens rond-2 i inklämt läge (delbit 6), **§7.8** när motståndarna
stör vår öppning (delbit 4+5). Ingen kodändring – bottarna bjuder som förut.

**Läget (2026-07-04, audit session 9 avslutad):** Hela revisionen R1–R6 KLAR +
live (0 KRITISK, 2 HÖG båda i R1, 27/32 fynd lagade; slutrapport
`docs/audit/SLUTRAPPORT.md`). Därefter startade R1 Fynd #2 (bredda störd
budgivning) och **delbit 6 är byggd, mergad (`ce7f1cd`) och LIVE.**

**Delbit 6 (LIVE):** öppnarens rond-2 i det INKLÄMDA konkurrensläget efter
partnerns enkla högfärgshöjning (`1M–(inkliv)–2M–(deras inklämda bud)`): pass
(minimum) · 3M (6:e trumf, lagen om totala stick) · **X = MAXIMAL DUBBLING (game
try, 15–17)** · 4M (utgång, 18+); partnern svarar X:et 4M (accept, 8+ stöd) /
3M (avböj). Två detektorer i `decideCall`, FÖRE `maybePenaltyDouble` (X reserverat
för game try där — konventionens kända avvägning). Facit:
`auction-opener-competition.test.ts` (7 integrationstester). Se 👀 Bevaka nedan.

**Sidospår klart & live (2026-07-04, mergepunkt `213d90e`):** felrapportering
inkopplad i **Budvisningen** (`Spela.tsx`) — knappen "Rapportera fel →" dyker upp
så snart auktionen budats färdigt (korten spelas aldrig där, så inga stick följer
med; kontraktet härleds ur buden). Samma `FelrapportDialog` som i Spela kort, men
med valfri bud-specifik text ("Rapportera fel i budgivningen" +
`BIDDING_REPORT_CATEGORIES`). Detaljer: `docs/status.md`.

**Kvar av R1 #2 (kommande delbitar, ägarstyrt):** ~~öppnarens rond-2 (§5.8)~~ +
~~balanseringens "låna en kung"~~ + ~~bredare flerronds-konkurrens (A+B+C, §5.9 +
§7.1)~~ (ALLA KLARA 2026-07-05; A+B+C ej pushat än). **R1 Fynd #2 är därmed i
praktiken helt genomarbetat** — bara delbit 3 (Mathe mot stark 1♣) förblir medvetet
PARKERAD (irrelevant tills vi lägger till fler budsystem).

**Öppna SENARE-poster ur revisionen:** R3 #3 del 2 (auto-facit på hela given —
kräver webworker). (R3 #8 "Förra sticket" = OK/klar, ägarbeslut 2026-07-05 —
struken.) Se ⚪ SENARE nedan.

## 2026-07-07 → 2026-07-21 — flyttat från CLAUDE.md 2026-07-21

**✅ Etapp 1 KLAR & LIVE 2026-07-20 (budgivningen mot perfekt): felrapporterna
betade.** #35 (fel dubblare utsedd → 5♠-blåsan), #37 (öppnarens svar på
sang-inbjudan byggt, §4.3), #38 (återöppning även efter 1-läges inkliv) lagade +
test-låsta; #39 = inget fel (DD-facit: straffen +500 slår 3NT som går 2 bet) —
test-låst. Issues stängda, mergepunkt `da7bdc5`, deploy grön, 1106 test.
- **#35** — Öst höjer partnerns 4♠ till 5♠ på en redan begränsad
  minimihand (balanserings-X + 1♠ var redan hela handen) → 3 bet.
- **#37** — 1NT-öppnaren (17 hp, FEM hjärter) avvisar 3♥-inbjudan efter
  Stayman-hittad fit och bjuder 3NT i st.f. 4♥; dessutom felaktig
  beskrivning av 3NT-budet.
- **#38** — passad svarare (11 hp, ♦KQ864 + ♠KJ42) passar ut `1♣–(1♠)`
  → Ö/V säljer given i 1♠ trots ~25 hp och Västs solida klöver.
- **#39** — efter vår 1NT + deras 2♥-inkliv blir W:s X ståendes som
  straff → Ö/V (25 hp) missar 3NT.
- **#36** (större kort på mobil) är UI, inte bud → ⚪ SENARE.

**✅ Etapp 2 KLAR 2026-07-21** — Systemrevisorn byggd (`revisor.ts` +
`revisor-dds.ts` + REVISOR-gated probe; DD-facit via npm-paketet
`bridge-dds` = Bo Haglunds lösare i WASM som dev-beroende, med RIKTIG
par-poäng) och **baslinjen mätt** (1 000 givar, frö 20260721): **exakt par
15,9 %, snitt-tapp 300 p/giv; topplista: fel färg-bet 65k p > missad
lillslam 56k > missad utgång 46k > missad storslam 38k > billig offring
35k** — hela mätningen + läsanvisning i `docs/systemrevisorn.md`.

**Senast klart & LIVE (2026-07-07 kväll, mergepunkt `1ce2982`, deploy grön):
ÄRLIGA SLAMPORTAR — tjuvkiken borttagen.** Ägarbeslut efter Fables
totalgranskning: bottarna bjuder som MÄNNISKOR — varje budbeslut fattas på
EGEN hand + vad partnern VISAT via buden (intervall/löften), ALDRIG på
partnerns faktiska kort; hellre missa en slam än kika. Gäller även
facit-linjen/Budvisningen (samma `buildAuction`). Ägarens två systemval:
(1) **inbjudningar i kanske-zonen** (31–32 mot visat minimum; kvantitativ 4NT
över sang, 5M/4m i trumf; partnern accepterar över blott minimum),
(2) **ingen kontrollkoll** (lita på poängen + nyckelkortssvaret;
`pairControlsSideSuits` och motorns auto-cue-rond BORTTAGNA — cue-ronden bar
bara gaten och orsakade gamla slam-quirken). Byggt: `slam-auction.ts`
omskriven (**kaptensregeln**: egen hand + visat minimum ≥33 driv / 31–32
inbjudan; nyckelkort HÄRLEDS ur svaret + egen hand; tvetydighet → anta högt
mot visad 15+, annars lågt + PARTNER-RÄTTELSE till 6; storslam kräver
visshet), `nt-slam.ts` (Gerber härleder ur svaren; ny kvantitativ
4NT-inbjudan 19–20 mot 1NT-återbudet), `auction.ts` (visade intervall per
återbudsregel: 1NT-återbud 12, hopphöjning/hopp-återbud 16, Jacoby/inverterad
per rebid, splinter-relä 15, MSS 15); `familyAFitTrump` läser BARA svararens
hand (6+ egen hf / 5+ i öppnarens minor; gömda 4-4-fits jagas ej). **Kända
ÄRLIGA MISSER (medvetna, test-låsta):** #29-originalgiven stannar i 3NT
(13 hp mot visade 16–18 < zonen); familj A-givens 4-korts minorfit drivs ej.
Slamfrekvens (probe 60 000 givar): lillslam ~1/120, storslam ~1/4300 —
mänskligt. **Blottad systemlucka → B13 i revisionen:** inverterad
minor-återbud är grova (17 hp + 6m visas som "minimum") → ärliga misser där.
Docs: budsystem.md §5.2/§5.7/§6 (principen)/§6.2-motoranmärkning/§9;
budsystem-revision.md B8–B13. **1090 test gröna, tsc rent, deploy grön.**

**F1 — bredda slam-utforskningen (PAUSAD → etapp 4 i NU-planen).** En probe (40 000 givar,
DD-lösta) delade slam-missarna i fyra familjer. **KLARA & LIVE:** **A** (efter
`1m–1M–1NT`: jämn → Gerber 21+/kvantitativ 4NT 19–20; obalanserad med säker
fit på egen hand → 4NT RKC), **C:s hopphöjning** (`1x–1M–3M` → driv 17+/
inbjudan 5M 15–16), **D** (hängande cue-quirken stängd — auto-cue-ronden är
numera helt borttagen). Alla styrs av de ärliga portarna ovan (äldre
beskrivningar i historiken med kontroll-gates/parets faktiska poäng =
kik-eran, gäller inte längre). **KVAR (= etapp 4):** familj **B** (2♣) +
C:s systerfall **reverse** (`1♣–1♥–2♦`) och **hoppskift** (`1♦–1♠–3♣`) —
störst men rörigast (ingen överenskommen trumf; vissa reverse-auktioner
kollapsar t.o.m. under utgång, eget problem). Byggs på det ärliga mönstret.

**Avslutade SENARE/PARKERAT-poster (flyttade hit 2026-07-21):**
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
- FAS 9 Passad hand, FAS 10 Försvarsbud, FAS 11 Kortspel = **KLARA & pushade**
  (historik — inte återstående arbete).
- ~~**Slam-quirken** (~0,25 %, Jacoby 2NT→cue→RKC)~~ **LÖST 2026-07-07** (F1 familj
  D; slutgiltigt genom att motorns auto-cue-rond togs bort helt med de ärliga
  slamportarna samma kväll). Facit `auction-slam-jacoby-cue.test.ts`. Behandla
  inte längre som parkerad.

### Bevaka-arkiv — fulltexter (komprimerade till en rad var i CLAUDE.md 2026-07-21)

- **Advancern hoppar inte förbi utgång (#33, 2026-07-07, LIVE):** när du och
  din bot-partner tävlar/cue-bjuder efter en upplysningsdubbling höjer boten inte
  längre förbi utgång på inbjudningsvärden (förr kunde en "inbjudande hopp" bli 7♦
  över partnerns 5♦). **Bevaka:** passar boten lagom (den saknar ännu slam-drivning
  som advancer — med äkta slamvärden kan den nöja sig med utgång; säg till om den
  borde utforskat slam).
- **6-5-öppning (#32, 2026-07-07, LIVE):** med 6-korts lågfärg + 5-korts
  högfärg öppnar boten nu **högfärgen med 12–15**, men **lågfärgen med 16+** (för att
  reverse:a in högfärgen). **Bevaka:** (a) väljer den rätt (öppnar 1♦ på rätt starka
  6-5, 1♠/1♥ på minimum)? (b) *återbudet* efter en 16+ 1♦-öppning — visar den 6-5:an
  begripligt (reverse in i högfärgen), eller blir fortsättningen konstig? Säg till om
  6-5:an tappas bort i rond 2.
- **2♣ dör inte längre i delkontrakt + systems-on (2026-07-07, LIVE):**
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
- **Inget svagt hoppskift längre (#31, 2026-07-06, LIVE):** svarar du på
  partnerns öppning med en svag 6-korts högfärg bjuder boten nu **1♥/1♠** (lågt,
  rondkrav), aldrig 2♥/2♠. **Bevaka:** håller boten budgivningen lagom låg, eller
  borde en riktigt svag spärrig hand ibland fått hoppa? (Ägarprincip: håll låg när
  partnern öppnat.) Öppnaren förklarar fortfarande ett MANUELLT hoppskift rätt om du
  själv hoppar.
- **Stark jämn hand efter minorhöjning i konkurrens (#30, 2026-07-06, LIVE):**
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
- **"Låna en kung" i balansering (§7.1, 2026-07-05, LIVE):** i
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
  LIVE):** öppnar du 1 i färg, partnern svarar en fri ny färg / 1NT
  och motståndarna bjuder om (t.ex. `1♥–(1♠)–2♣–(2♠)`), passar öppnaren inte längre
  bort en stark hand. Extra visas med **cue i deras färg** (15+, hitta rätt utgång),
  18+ med högfärgsfit → 4M, 18+ jämn m. stopp → 3NT, 15–17 m. högfärgsfit →
  inbjudande hopphöjning; minimum tävlar med en egen 6+ färg eller en fit, annars
  pass. **Bevaka:** (a) cue:ar boten lagom ofta (inte varje 15-poängare som borde
  passat)? (b) hittar den rätt utgång efter cuet, eller överbjuder den? (c) medvetet
  bortval: i det här läget väljs **cue framför straffdubbling** på extra-händer –
  säg till om en straffdubbling av deras bud borde ha varit rätt i stället.
- **Störda krav = RONDKRAV (§5.5, 2026-07-05):** klev en motståndare in och du
  gjorde ett **fritt bud** (ny färg, t.ex. `1♦–(1♠)–2♣`) eller öppnaren **reverse:ade**
  (`1♣–1♥–(1♠)–2♦`), så passar din partner inte längre — hen tvingas svara med ett
  naturligt minimibud (`competitionForce`/`honorForce`). Men bara **rondkrav**: buden
  får stanna UNDER utgång (ett inkliv "lånar" utrymme). **Bevaka:** (a) svarar boten
  förnuftigt (rätt naturligt bud, inte ett tvångsbud som låter konstigt)? (b) driver
  den ALDRIG till utgång i onödan här (2/1 i konkurrens lovar värden men ej utgång)?
  Hopp, cue i deras färg och en passad svarare undantas medvetet — säg till om ett av
  dem borde ha tvingat fram ett svar ändå.
- **Utgångskrav får aldrig passas OFF-BOOK (felrapport #26 + #27, 2026-07-05):**
  två luckor där boten passade en KRAV-auktion när du bjudit off-book
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
- **Lågfärgsutgång 5♣/5♦ nu nåbar (Kontraktväljaren delsteg 1, 2026-07-05):**
  motorn kunde förr aldrig bjuda 5♣/5♦ (valde alltid 3NT). Nu, efter inverterad
  minor: en svarare med lågfärgsfit + en **osparrad färg** utforskar via 2m och
  landar i **5m** när paret inte kan hålla alla färger (i stället för att chansa
  3NT). Ägarregel: utforska bara med en **riktigt svag** färg (♠xx/♥xxx utan
  honnör). **Bevaka:** (a) drar boten till 5m när 3NT egentligen var säkert? (b)
  chansar den fortfarande 3NT med en helt öppen färg? Trösklar i `responses.ts`
  (`hasWeakSideSuit`) + `responder-rebids.ts` (inverterad-minimum → 5m).
- **Motspelarens kast-vakt + 1NT-återbudsförklaring (felrapport #24 + #25,
  2026-07-05):** (1) **spelfel #25** – en försvarare som sakar blottar inte
  längre en honnör i onödan: ny "motspelarens kast-vakt" (`play-bot.ts`
  `defenderGuardDiscard`) sakar hellre ur en färg UTAN skyddsvärd honnör (en J+
  som ännu kan slås av ett högre ospelat kort), ärligt räknat ur egen hand +
  träkarl. Löser bara honnörs-blottning; bredare försvarsinferens (kasta rätt när
  partnerns hand är okänd) är fortsatt SENARE. Säg till om vakten någon gång
  behåller fel kort. (2) **budförklaring #24** – öppnarens 1NT-återbud efter
  färgöppning beskrivs nu som "balanserad minimihand ~12–14 hp" (ej "svag");
  ingen ändrad budgivning, bara texten (`auction-interpret.ts`).
- **Takeout-doublingar (felrapport #23 + stark-hand-fortsättning + tvåfärgs-X,
  2026-07-05):** (1) en **17+ stark enfärgshand** upplysningsdubblar en öppning
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
- **Öppnarens rond-2 i inklämt konkurrensläge (R1 Fynd #2 delbit 6):** efter
  `1M–(inkliv)–2M–(deras inklämda bud)` passar öppnaren inte längre blint. Med
  minimum + 6:e trumf konkurrerar den 3M; med utgångsintresse (~15–17) dubblar den
  (**X = maximal dubbling = game try**, INTE straff i det läget); med 18+ bjuder den
  4M. Partnern svarar X:et 4M (max) / 3M (min). Golv: 15+ = game try, 18+ = utgång
  (speglar den ostörda openerRebidAfterSimpleRaise). Säg till om X-som-game-try
  känns fel, eller om golven bör justeras.
- **DONT mot deras 1NT (R1 Fynd #2 delbit 1):** bottarna stör nu deras
  1NT-öppning med DONT (X/2-läget) — golv 8 hp direkt, 6 hp balansering. Säg till
  om det känns för aggressivt/passivt.
- **Försvar mot deras svaga tvåor/spärrar (R1 Fynd #2 delbit 2):** bottarna
  kliver nu in mot motståndarnas svaga 2♦/2♥/2♠ och spärrar (3-läget+) — takeout-X,
  2NT (15–18), cue, naturligt, 3NT. Golv för takeout-X: 12 hp ej sårbar / 13 sårbar
  direkt, 10 hp balansering; mot spärr 14 hp (medvetet stramare — säg till om du
  vill lätta även spärr-balanseringen).
- **Svar när motståndaren stör VÅR öppning (R1 Fynd #2 delbit 4):** när du
  öppnar 1NT och en motståndare stör med DONT svarar din bot-partner nu (X/XX =
  straff/värden från 8 hp, egen 5+ färg = naturligt, annars pass) i stället för att
  passa. När du öppnar en svag tvåa/spärr och de takeout-dubblar redubblar partnern
  med 10+ (värden) eller höjer spärrartat med fit. Säg till om golven (8 / 10)
  känns fel.
- **Straffdubbla flykten efter vår XX (R1 Fynd #2 delbit 5):** öppnar du
  1NT, de stör med DONT och din bot-partner redubblar (XX = vi äger handen), så
  flyr motståndarna undan till en färg STRAFFDUBBLAR din sida dem nu — varje steg,
  tills de får spela dubblat — i stället för att passa flykten. Utlöses bara efter
  vårt 1NT + XX (inte efter svaga tvåor/spärrar — där äger vi inte handen). Säg
  till om det känns för aggressivt att dubbla varje flyktbud.
