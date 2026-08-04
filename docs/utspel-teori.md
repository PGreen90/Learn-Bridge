# Utspel — källförankrad bridgeteori (grund för omdesignen)

> **Vad det här är.** Den samlade, källförankrade doktrinen för öppningsutspel,
> syntetiserad ur auktoritativa källor (2026-08-04, tre parallella research-svep).
> Systerdokument: `docs/utspel-diagnos.md` (kodens NUläge + byggordning A–G) och
> `docs/budsystem.md §8.3` (produktytan ägaren läser i appen). **Det här är VAD som
> är rätt bridge; diagnosen är VAR koden avviker.** Bygg alltid mot den här filen.
>
> **Källor (auktoritet):** Richard Pavlicek (rpbridge.net), Karen Walker
> (kwbridge.com), Larry Cohen (larryco.com), bridgebum.com (ägarens föredragna
> referens, se [[bridgebum-convention-reference]]), ACBL, csbnews.org, Wikipedia
> (Klinger). Fullständiga URL:er längst ned. Samstämmighet noterad; äkta
> oenigheter märkta **[VAL]** (partnerskapsinställning, inte en sanning).

---

## 0. Vad appen REDAN har låst (bygg vidare på detta)

- **Ess från A-K** (inte kung) — modern praxis, matchar Larry Cohen. `signals.ts
  honorLead`, `budsystem.md §8.3`.
- **3:e/5:e bästa** spotkort (3:e vid jämn längd, lägsta/5:e vid udda) — expertval,
  regelbundet rekommenderat *mot färg*. `signals.ts spotLead`.
- **Topp av sekvens** för honnörsutspel (KQJ→K, QJT→Q, JT9→J). `honorLead`.

Dessa tre är beslutade och ändras inte utan ägarbeslut. Allt annat nedan är
antingen (a) doktrin appen ska LÄRA sig, eller (b) ett **[VAL]** att ta.

---

## 1. Expertens beslutsordning (ramverket hela motorn ska följa)

Ingen källa publicerar en färdig algoritm, men alla kombinerar samma fyra ingångar.
Beslutsordning för motorn:

1. **Lead-dirigerande dubbling går före allt.** En Lightner-dubbling (av slam) eller
   dubbling av ett konstgjort bud pekar ut färgen. Välj sedan kort enligt §3.
2. **Bestäm AKTIVT vs PASSIVT ur auktionen** (detta ramar in hela valet, se §5).
3. **Välj FÄRG** (se §2 för prioritetsordningen), viktad av steg 2.
4. **Välj KORT** i färgen (holdings-tabellerna §3 + räkning/attityd i partnerns färg
   §4).
5. **Sårbarhet/poängform som tiebreak** (§5 slut).

Varje källa betonar: **det här är omdöme, inte en fast regel** (Cohen: principerna
"krockar ibland"). Motorn bör därför vara en **viktad prioritetskedja** där
aktiv/passiv-läsningen skjuter vikterna — inte en stel if-trappa.

---

## 2. Färgval — prioritetsordning

**Pavliceks rangordning mot FÄRGKONTRAKT** (hög → låg):
1. Färg med **A-K**
2. **Singel** (om ruff önskas — kräver trumfkontroll/entré, se §6)
3. **Säker honnörssekvens** (KQJ, QJT, J109…)
4. **Lång färg utan ess eller kung**
5. **Säkert trumfutspel**
6. **Osäker/bruten honnörssekvens** (gaffel/tenass — helst INTE, se §3b)
7. Värdelös dubbelton
8. Värdelösa tre kort
9. **Lång färg MED ess eller kung** (= underspel — sista utväg)

**Karen Walkers praktiska ordning:** singel (ruff) → partnerns bjudna färg →
attackerande grannhonnörer (KQ10x, QJ10, J109) → längsta färg utan grannhonnörer
(lågt) → föredra **objudna** färger → bordets färg → trumf.

**Motorns försonade ordning:** (1) uppenbar singel-ruff med kort trumf; (2)
partnerns färg; (3) topp av stark/solid sekvens i objuden färg; (4) A-K-färg; (5)
säker lång färg utan honnör / trumf (passivt); (6) — bara om aktivt krävs — bruten
honnör eller ostött ess; **aldrig** underleda ett ess, och "underleda K/D" resp.
"leda motståndarens färg" är lågprioriterade sista utvägar som gate:as på
aktiv/passiv-beslutet.

---

## 3. Holdings → kort att leda

### 3a. Tabell (samstämmig utom där [VAL] anges)

`x` = spotkort (9 eller lägre, icke-honnör). T = tia.

| Innehav | Mot FÄRG | Mot NT | Regel |
|---|---|---|---|
| AK, KQ, QJ, JT, xx (dubbelton) | **topp** | topp | Topp av dubbelton |
| A K x(x+) | **A** | **A** (från AKJT/AKQ; annars 4:e) | Ess-från-AK (appen låst) |
| K Q J x | **K** | **K** | Topp av sekvens |
| Q J T x | **Q** | **Q** | |
| J T 9 x | **J** | **J** | |
| T 9 8 x | **T** | **T** | Topp av "nothing"-sekvens |
| **K J T x** | **J** | **J** | **Inre sekvens** — topp av den inre löpan (J), inte K |
| **K T 9 x** | **T** | **T** | Inre nära-sekvens |
| **Q T 9 x** | **T** | **T** | Inre nära-sekvens |
| **Q J 9 x** | **Q** | **Q** | "Två och en halv i rad" → Q |
| **A J T x** | **A** (mot färg) | **J** (mot NT) | Färg: underleda aldrig esset. NT: topp av inre sekvens |
| **A Q J T** | **A** (mot färg) | **Q** (mot NT) | Samma princip |
| K Q T 9 | **K** | **Q** [VAL] | Mot NT ber Q partnern blanka J (unblock-ask) om det är på |
| K J x x x, K J x x | **lågt** bara om du MÅSTE leda färgen; **helst inte alls** | 4:e bästa | Bruten/tenass — se §3b |
| A Q x x (x) | undvik; om tvingad **A** (aldrig lågt) | 4:e bästa | Tenass — vill bli spelad IN i |
| K x x, Q x x, J x x (honnör + 2 små) | **lågt** (helst undvik mot färg) | lågt (undvik oftast) | Underspel av honnör riskerar stick |
| A x x | undvik (underleder ess) | 4:e/lågt | Mot färg: leda lågt = underspel av ess |
| x x x (tre små) | **[VAL]** lågt / MUD / topp-av-inget | **[VAL]** hög (Pavlicek) / lågt (bridgebum) / MUD | Partnerskapskonvention |
| x x x x | 4:e bästa (3:e enligt 3/5-systemet) | 4:e bästa | Appen kör 3/5 → 3:e |
| x x x x x | 4:e bästa (5:e = lägsta enligt 3/5) | 4:e bästa | Appen kör 3/5 → lägsta |
| Singel x | **singeln** | (sällan) | Ruff, se §6 |

**Trumf-spotkort skiljer sig medvetet** (så partnern läser att det är TRUMF): från
**två eller fyra små trumf → lägsta**; från **tre små trumf → mitten** (topp om
grannkort). Annorlunda än sidofärgens "lågt från tre små".

### 3b. Tenass-principen — "led inte bort från honnörsgafflar" (kärnan)

**Absolut regel (alla källor):** mot ett färgkontrakt **underleder man aldrig ett
ess.** Reese (via Walker): att underleda ett ess fungerar "as long as you want to
look for a new partner". Skälet: i ett trumfkontrakt kan ditt ess ruffas bort — dess
jobb är att FÅNGA en honnör eller cashas innan det ruffas. Underleder du det vinner
spelföraren billigt med en singel/dubbel-K du kunde ha fångat, och ditt ess scorar
kanske aldrig. (Mot NT är underspel för att etablera en lång färg tvärtom standard —
ingen ruff finns.)

**Generaliseringen (ägarens poäng, bekräftad):** samma fara gäller — svagare — ALLA
brutna honnörsinnehav där du har kort på båda sidor om en lucka, eller en honnör med
ett saknat högre kort sittande över dig. Det är **tenasser**: AQ, KJ, AJ10, **KJxxx**,
AQxxx, K10x, Q10x. Deras värde kräver att det saknade högre kortet leds **upp till
dig** eller finessas **genom** den andra försvararen — inte att du själv leder färgen.

- **KJxxx (ägarens nyckelexempel):** du vill att A och D leds *upp till* din KJ. Har
  spelföraren/bordet AQ vinner de billigt med D om du leder lågt, och din K faller
  under esset eller finessas. Leds färgen upp till dig blir K och J fångst-/
  finesslägen och du kan scora båda. **KJxxx är alltså ett innehav du hellre blir
  spelad IN i än leder bort från** — passiv färg i bästa fall.
- **AQxx / AJ10x:** klassiska tenasser. Lågt = underspel av ess (förbjudet); esset =
  dödar din egen finess. Alltså **leds de oftast inte alls** — du väntar in dem.

**Motsatsen — "säkra färger" (det du GÄRNA leder):** innehav där du **inte kan
kosta ett stick** genom att öppna färgen: en **solid/nära-solid sekvens** (KQJ, QJT,
J109), en färg med **AK** (cashar och tittar), en **singel** (ruff), en **värdelös
lång färg utan honnör** (xxxx), eller **trumf**. Pavliceks mentalmodell: tenasser
(AQ, KJ, AJ10) är FÖRSVARSkort du behåller och låter motståndarna attackera; säkra
färger är det du leder.

---

## 4. Att leda partnerns färg (budgivningen väger tyngst här)

Att leda partnerns visade färg är ett av de två högst rankade utspelen (i nivå med
topp-av-sekvens) — "kan vara fel, men är aldrig fel". "Partnerns färg" = partnern
öppnade den (3+), klev in (extra inbjudande), eller lead-dirigerade den.

**Vilket kort (räkning vs attityd — beror på om DU stött färgen):**
- **Ej stött** → **räkningskort** (partnern vet redan att du gillar färgen; visa
  längd): lågt från udda antal, högt från jämnt.
- **Stött** → **attitydkort** (längd redan känd; visa var honnören är): lågt från en
  honnör, topp från honnörslöst.

| Innehav i partnerns färg | Kort |
|---|---|
| Dubbelton utan honnör (9 7) | **9** (topp) |
| Dubbelton med honnör (Q 9) | **Q** (topp — aldrig lågt, blockerar) |
| Tre små (9 7 5) | **5** (lågt) om ostött; **9** (topp) om stött |
| Tre till en honnör (Q 9 5) | **5** (lågt) |
| Grannhonnörer (KQx, QJx, JTx) | **topphonnören** (överrider räkning/attityd) |
| Fyra små (9 7 5 3) | **9/7** (högt) |
| Singel i partnerns färg | **singeln** (ruff) |

**Undantag — led INTE partnerns färg när:** du har en singel i annan färg + trumf
att ruffa med; du har en klart bättre egen sekvens; partnerns färg går rakt in i
spelförarens/bordets visade styrka; (mot NT) du har en mycket längre/starkare egen
löpande färg.

**Undvik motståndarnas färger** (grovt i ordning): spelförarens naturliga färg →
bordets sidofärg för avslängning → färger de bjudit naturligt "på vägen upp".
**"Led genom styrka, upp mot svaghet":** föredra att leda en färg **bordet** bjöd
(du leder genom den starka handen som spelar tvåa) framför spelförarens. Måste du
leda en motståndarfärg: **bordets hellre än spelförarens.**

---

## 5. Aktivt vs passivt (ramar in hela valet)

**Walkers trestegsmodell:** aggressivt-eller-passivt? → vilken färg? → vilket kort?

- **Aktivt (attackera, cash:a ess, etablera fort — även från brutna honnörer) när**
  auktionen säger att spelföraren har en **stickkälla du måste hinna före**: bordet
  har visat en **lång stark sidofärg** (förlorare slängs där), motståndarna nådde
  utgång självsäkert med uppenbar fit, eller du kan se sticken komma.
- **Passivt (säker färg, topp av sekvens, trumf, eller honnörslös färg; ge inget)
  när** auktionen inte tyder på brådska — balanserat/begränsat/tunn utgång, ingen
  lång sidofärg hotar, spelföraren får jobba för varje stick. Låt spelföraren själv
  knäcka tenasserna. Passivt är också rätt när alla dina honnörer är tenasser.

**Cohens sammanfattning:** *passivt som default; aktivt bara när bevisen säger att
spelföraren KOMMER slänga förlorare (stark sidofärg på bordet, självsäker slam) om
du inte tar stick först.* Pivotfrågan: **"Kommer spelföraren slänga förlorare på
bordets långa färg?"** Nej → passivt.

**Sårbarhet/poängform (tiebreak):** sårbara/högre insats → stadigare, mer passivt.
IMPs/rubber → att fälla kontraktet dominerar (ta rimlig risk); MP → övertricken
räknas, passivt "ge-inget" mer attraktivt när kontraktet ser omöjligt att fälla ut.

---

## 6. Trumf- och kortfärgsutspel

**Led trumf när** auktionen tyder på att spelföraren tänker ruffa i kortahanden och
du vill skära ner det: bordet lär vara kort (singel/dubbelton sidofärg, ingen lång
sidofärg); motståndarna bjöd tre-fyra färger (korsruff); de offrade; eller partnern
straffdubblade en delgiv (partnern har trumflängd). Trumf är också den passiva
utvägen när allt annat är tenass. **Vilket kort:** två/fyra små → lägsta; tre små →
mitten. **Aldrig singel-trumf** (kostar oftast partnerns trumfstick); akta Ax/Kx i
trumf.

**Singel/kortfärg för ruff:** led singel för ruff när du har **små trumf att ruffa
med** (xx/xxx) och trolig entré. **Gör det INTE med trumflängd/-kontroll** (t.ex.
fyra trumf, Kxxx/QJ10x) — då är motsatsen ofta bättre: en **tvingande** (forcing)
försvarsspel där du leder din EGNA långa färg och tvingar spelföraren ruffa, så hans
trumf kortas under dina. Dubbelton-ruff är mycket sämre än singel (kräver två ronder
+ entréer) — led toppen.

---

## 7. Auktionsmönster → slutsats

| Mönster | Avslöjar | Utspelsslutsats |
|---|---|---|
| 1NT–3NT ostört | Balanserat ~25–26 hp, ingen lång färg visad | **Default:** 4:e bästa (appen: 3/5) ur längsta/bästa; attackera |
| 1NT–2♣(Stayman)–…–3NT | 4-korts högfärg finns/kollades | Undvik högfärgerna de fann; attackera objuden färg; håll du mycket hp → partnern tom |
| 1NT–transfer–…3NT | 5+ i den transfererade högfärgen | Undvik den; led objuden, "genom styrka" |
| 1♥–2♥–4♥ (självsäker höjning) | Solid fit, ingen scramble | **Passivt** — trumf eller idel-små färg; led inte bort från honnör |
| 1♥–1♠–2♥–4♠ / konkurrenspush | Båda bjöd; slängbara förlorare möjliga | **Aktivt** — attackera fort, särskilt om bordet visat sidofärg |
| Push till tunn utgång | Kontrakt på gränsen | **Passivt** — ge inget, ett stick avgör |
| Självsäkert till utgång/slam | De har kraft; extrastick väntar | **Aktivt** — ta stick NU innan avslängning/löpande färg |
| Kvantitativ NT-slam (4NT–6NT) | 12 stick hänger på finess/sits | **Passivt** — bryt ingen färg, led inte bort från honnör |
| Liten färgslam (6♥) | Spelföraren stark | **Oftast aktivt** — led ofta bort från en honnör för ett stick innan det försvinner |
| De/partnern spärrade | Vild fördelning, ruffvärden | Trumf om korsruff läses; annars cash:a fort / partnerns spärrfärg |
| Stark 2♣ (2♣–2♦–…) | Spelföraren har kraftpaket; ni svaga | **Passivt** — få stick, ge inget; undvik en färg 2♣-handen visar |

---

## 8. Lead-dirigerande dubblingar

- **Lightner (dubbling av frivilligt bjuden SLAM av utspelarens partner):** ber om
  ett **OVANLIGT** utspel — INTE det normala, aldrig trumf, aldrig er egen färg.
  Prioritet: (1) **bordets först bjudna sidofärg** (vanligast), (2) spelförarens
  först bjudna sidofärg om bordet inte bjöd någon, (3) annars ovanligt — dubblaren är
  ofta renons och vill ha ruff. **Negativ slutledning:** bjöd de en sidofärg mot slam
  och partnern INTE dubblade → partnern vill inte ha den ledd. Gäller INTE när de
  offrar (då straffdubbling).
- **Dubbling av frivilligt 3NT:** (1) dubblaren bjöd färg → led dubblarens färg; (2)
  utspelaren bjöd färg men inte dubblaren → led din egen bjudna färg; (3) ingendera
  bjöd → led bordets först bjudna (inkl. *implicerad*, t.ex. högfärg via Stayman); (4)
  inget naturligt bjudet → "hitta min färg" (partnerskapsavtal, ofta klöver).
- **Dubbling av konstgjort bud:** ber partnern **leda den färg budet nämner** (t.ex.
  dubbel 2♣-Stayman → klöver). Stark signal, visar oftast bra innehav.

---

## 9. Slam-specifikt

- **Färgslam: default PASSIVT.** Med 5–8 hp på utspel har partnern nästan inget →
  underspel för att "hitta" partnerns kort är förlorande. Trumf eller topp-av-sekvens
  ger inget. **Led inte ett ostött ess** mot slam (sätter upp bordets kung / krockar).
  Undantag: cash:a ett ess när du ser fällstickct, eller (MP) för ett säkert stick.
  **Undantag — hopp till slam utan Blackwood:** de kan vara renons/sakna ess → led ett
  ess i objuden färg (titta innan det försvinner) blir rimligt.
- **6NT: default passivt** — du behöver bara 2 stick; T-xxxx är ett idealiskt passivt
  utspel. Attackera bara om auktionen visar en lång löpande färg.
- **Storslam:** maximalt passivt/säkert.

---

## 10. Konventionsval att ta (partnerskapsinställningar, inte sanningar)

Appen har redan låst ess-från-AK och 3:e/5:e. Kvar att besluta (rekommendation
angiven, men ägaren väljer):

1. **Tre små (xxx):** lågt / MUD / topp-av-inget. **Rek:** lågt (enklast för partnern
   att läsa en senare dubbelton; Pavliceks default) — konsekvent med appens
   lågt-orienterade spotdoktrin.
2. **3:e/5:e även mot NT, eller 4:e bästa mot NT?** Många experter kör rent 4:e bästa
   mot NT (Regel-om-11 blir exakt). **Rek:** behåll 3:e/5:e överallt för enkelhet och
   konsekvens — men flagga att det gör Regel-om-11 oexakt för partnern/motståndaren.
3. **KQ109 mot NT = Q (unblock-ask) eller K?** **Rek:** håll K tills vi bygger
   unblock-avtal (inte värt komplexiteten nu).
4. **Rusinow (näst högsta av grannhonnörer):** nej (appen kör topp av sekvens) —
   redan §8.4 "medvetet inte".

---

## 11. Hur teorin mappar mot byggordningen (A–G i diagnosen)

- **Hål B (inre sekvenser):** §3a-raderna KJTx→J, KT9x→T, QT9x→T, QJ9x→Q, AJTx (NT→J).
  Ren utökning av `honorLead` att känna igen inre/nära sekvenser.
- **Hål F (ess-underspel mitt i given):** §3b — samma tenass-regel överallt, inte bara
  trick 1.
- **Hål E (NT ≠ färg i färgvalet):** §3a-kolumnen "mot NT" + §2 (längst & starkast,
  majorpreferens) + [VAL] 2.
- **Hål A (budgivningen):** §1 ramverket + §4 (partnerns färg/undvik deras) + §5
  (aktiv/passiv) + §7 (auktionsmönster). Störst; kräver att utspelet får `calls`.
- **Hål C+D (trumf/singel):** §6 — meningsfulla först med §5:s aktiv/passiv-kontext.
- **Hål G (underleda kung mot färg):** §3b generaliserar ess-regeln till tenasser;
  detta är egentligen kärnan i ägarens KJxxx-poäng och bör byggas TILLSAMMANS med
  hål F snarare än sist.

---

## 12. Källor

**Färgkontrakt & tenass-principen:** Pavlicek [Suit Leads &amp; Strategy](http://www.rpbridge.net/4h00.htm),
[Doubleton Leads](http://www.rpbridge.net/8c13.htm); Karen Walker [Opening Leads](https://kwbridge.com/leads.htm),
[Improve Your Opening Leads](https://kwbridge.com/bb/leads1.htm); Larry Cohen [Opening Leads](https://www.larryco.com/bridge-articles/opening-leads);
bridgebum [Standard Leads](https://www.bridgebum.com/standard_leads.php), [Trump Leads](https://www.bridgebum.com/trump_leads.php),
[Ace from AK](https://www.bridgebum.com/ace_from_ace_king.php); csbnews [vs Slam](https://csbnews.org/en/what-are-good-opening-leads-against-slam-contracts/).

**NT:** Pavlicek [Notrump Leads &amp; Strategy](http://www.rpbridge.net/4g00.htm),
[Standard agreements](http://www.rpbridge.net/3u69.htm); Walker [Improve Your Opening Leads](https://kwbridge.com/bb/leads1.htm);
Larry Cohen [lesson summary](https://news.bridgebase.com/2021/03/15/summary-larry-cohens-lesson-on-opening-leads/);
bridgebum [Rule of 11](https://www.bridgebum.com/rule_of_eleven.php), [Rule of 10/12](https://www.bridgebum.com/rule_of_10_12.php);
ACBL Unit 390 [3rd &amp; 5th](https://www.acblunit390.org/Simon/3rdn5th.htm); csbnews [When to be passive](https://csbnews.org/en/opening-leads-when-to-be-passive/).

**Budgivningen:** Walker [Leads](https://kwbridge.com/leads.htm), [Lead-directing doubles](https://kwbridge.com/leaddbl2.htm),
[Through strength](https://kwbridge.com/defense.htm); bridgebum [Lightner](https://www.bridgebum.com/lightner_double.php);
Larry Cohen [Overview](https://www.larryco.com/bridge-articles/opening-leads-an-overview),
[Passive or Aggressive](https://www.larryco.com/bridge-articles/defense-passive-or-aggressive);
Adventures in Bridge [partner's suit card](https://www.advinbridge.com/this-week-in-bridge/396);
Wikipedia [Opening lead](https://en.wikipedia.org/wiki/Opening_lead), [Rule of 11](https://en.wikipedia.org/wiki/Rule_of_11),
[Rusinow](https://en.wikipedia.org/wiki/Rusinow_leads).
