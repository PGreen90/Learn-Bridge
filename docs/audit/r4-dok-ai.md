# R4 — Dokumentation & AI-förvaltningsbarhet

> Revisionssteg R4 (se `AUDIT_PROMPTS.md`). Gren `audit/r4-dok-ai`.
> Granskar all projektdokumentation (`CLAUDE.md`, `MEMORY.md`, `docs/*.md`,
> kodkommentarer) + hur väl projektet lämpar sig för fortsatt utveckling via
> parallella Claude Code-`--worktree`-sessioner. Bygger vidare på R1–R3.
> Genomförd 2026-07-04 (audit session 7).

## Så här ligger det till (för ägaren)

Dokumentationen är **ovanligt rik och välskött** — troligen appens starkaste
sida vid sidan av testsviten. Systemboken (`budsystem.md`), sanningskartan,
status, historik och projektkartan i `CLAUDE.md` gör tillsammans att en ny
utvecklare (människa eller AI) kommer långt utan att fråga dig. **Inget fynd är
KRITISK eller HÖG** — ingen dokumentation kan få appen att bygga ett felaktigt
bud.

Men just för att dokumentationen är så mycket och skrivs i realtid har den börjat
**glida isär på några punkter**. Det viktigaste: en fil (`handvardering.md`) säger
längst upp, med fet stil, att "TP styr INTE budbesluten" — vilket var sant en gång
men numera är **raka motsatsen** till hur motorn faktiskt fungerar (TP styr
öppning, slamzon och höjningar). En läsare som litar på den feta raden får fel
bild. Dessutom säger `status.md` att en Bergen-höjning (3♣) är 7–**9** hp medan
systemboken säger 7–**10** — en liten men konkret motsägelse i själva
budsystemet, och den sortens tvetydighet som gör att två parallella AI-sessioner
kan bygga OLIKA. Och `kortspel.md` beskriver fortfarande spelläget som det såg ut
för många steg sedan (heuristiskt kontrakt, inga signaler, ingen DDS-facit).

För AI-förvaltningen är den enskilt viktigaste luckan att **R2:s egen
R4-rekommendation aldrig genomfördes**: att skriva ner "tre-lager-kontraktet"
(vilket auktionslager gör vad) så att en parallell session inte bygger budlogik i
fel fil. Den kunskapen finns bara i R2-rapporten. Ta fynden en i taget om/när du
vill — de flesta är rena dokumentändringar utan risk för koden.

## Fynd i korthet

| # | Fynd | Prioritet | Lagat nu? |
|---|------|-----------|-----------|
| 1 | `handvardering.md` säger med fet "Viktig låsning" att TP INTE styr budbesluten — direkt motsägelse mot resten av samma fil + verkligheten (TP styr öppning/slam/höjningar) | **MEDIUM** | ✅ Ja (`72357e2`) |
| 2 | Bergen 3♣-intervallet: systembok + översikt säger 7–10, `status.md` säger 7–9; systemboken har dessutom ett **överlappande** golv (3♣ = 7–10 OCH 3♦ = 10–12 → "10" i båda) → parallella sessioner kan koda olika | **MEDIUM** | ✅ Ja – bok→7–9 (`5a4f1c6`) |
| 3 | `kortspel.md` (Status/Återstår/Avgränsningar) beskriver spelläget flera iterationer föråldrat (heuristiskt `pickContract`/`dealForPlay`, inga signaler, ingen DDS-facit, inga bot-hjärna) | **MEDIUM** | ✅ Ja (`6f5eac9`) |
| 4 | Tre-lager-auktionskontraktet (`open`-flaggan: `auction.ts` → `auction-live.ts` → `auction-interpret.ts`) är odokumenterat — R2 rekommenderade uttryckligen att skriva ner det; finns bara i R2-rapporten | **MEDIUM** | ✅ Ja (`f68628a`) |
| 5 | Föråldrade "NÄSTA/PRIO"-pekare i planeringsdokumenten (`arbetslista.md` rad 3, `sanningskarta.md` "Nästa steg: FAS 1") pekar på sedan länge klart arbete och konkurrerar med `CLAUDE.md`-kartan om vad som är nästa | **MEDIUM** | ✅ Ja (`06b9f26`) |
| 6 | `CLAUDE.md`s "## Beslut"-block talar fortfarande i FAS-termer och säger "NÄSTA GÅNG STARTAR VI MED: balansering …" (klart via R1) + "Inga nya funktioner förrän FAS 1–6" — nedre halvan är en tidskapsel som motsäger kartan högst upp | **MEDIUM** | ✅ Ja (`37753b1`) |
| 7 | App-namnet **RebidZ** och designöverriden (spader SVARTA, emerald) finns i koden + `MEMORY.md` + `AUDIT_PROMPTS.md` men INTE i `CLAUDE.md`/systemboken (som fortfarande heter "Bridge-app") → en läsare som bara ser docs vet inte namnet, en som "rättar" spaderfärgen bryter ett medvetet beslut | **LÅG–MEDIUM** | ✅ Ja (`37753b1`) |
| 8 | Hårdkodade testantal (587/612/…/1676) i minst 6 dokument + `MEMORY.md` glider isär vid varje ny test | **LÅG** | ✅ Ja – konvention (`8c0a1a3`) |
| 9 | Ingen `README.md` i repo-roten — en människa som landar på GitHub-repot har ingen ingång (CLAUDE.md är AI-orienterad) | **LÅG** | ✅ Ja (`8c0a1a3`) |
| ✓ | **Verifierat GOTT:** terminologin är genomgående konsekvent (hf/lf/hp/TP/startpoäng definierade i `oversikt.md` + `handvardering.md`; "förlorare" låst för LTC); systemboken är EN tydlig sanningskälla | — | Inget att göra |

**Ingen KRITISK. Ingen HÖG.** Alla fynd är dokumentationsdrift eller
AI-förvaltningstydlighet — inget kan producera ett felaktigt bud.

## Åtgärdslogg (2026-07-04, audit session 7)

Ägaren valde att laga **alla nio fynd**, ett i taget (rena dokumentändringar; #2
efter ägarbeslut att rätta boken snarare än koden). Inga kodändringar → ingen
testpåverkan. Commits på gren `audit/r4-dok-ai`:
- **#4** (`f68628a`): nytt avsnitt "Budmotorns tre auktionslager + `open`-handoff"
  i `status.md` + pekare i `CLAUDE.md`.
- **#1** (`72357e2`): `handvardering.md` — feta "TP styr INTE budbesluten" ersatt
  med korrekt historik (TP styr numera utvalda beslut, "nedgradera aldrig").
- **#3** (`6f5eac9`): `kortspel.md` — NUTIDSNOT överst + Status/Återstår märkta
  som första-omgångshistorik, pekar till `status.md`/`bot-hjarna.md`.
- **#2** (`5a4f1c6`): `budsystem.md` (§4.1-tabeller + princip) + `oversikt.md`
  ändrade 3♣ = 7–10 → **7–9** (matchar koden: `sp>=10 → 3♦`). Ändringsloggpost.
  Ingen beteendeändring.
- **#5** (`06b9f26`): historik-noter i `arbetslista.md`-toppen + `sanningskarta.md`
  sektion III (kartan i `CLAUDE.md` + R1–R6 är enda källa för NU/NÄST).
- **#6+#7** (`37753b1`): `CLAUDE.md` — föråldrad "NÄSTA GÅNG"-rad → historik-not;
  "Vad det här är" namnger appen RebidZ + låst designriktning (spader svarta).
- **#8+#9** (`8c0a1a3`): konventionsrad om testantal i `arbetsrutiner.md`; ny
  `README.md` i repo-roten.

---

## Teknisk genomgång

### Fynd 1 — `handvardering.md` motsäger sig själv om TP styr budbeslut (MEDIUM)

**Problem.** `docs/handvardering.md` rad 13–16 (avsnittet "Mål och princip") står:

> **Viktig låsning:** TP **styr INTE budbesluten** i det här steget. Budmotorn
> fattar beslut precis som idag (på `hcp`). TP är ett pedagogiskt lager … Inkoppling
> i budlogiken är ett separat, framtida beslut.

Men **samma fil** rad 165–213 ("TP styr budbeslut", "FAS 4 punkt 16") och
`CLAUDE.md`s beslutslogg beskriver i detalj att TP numera **styr** öppningsgolvet
(`openings.ts`: `HP ≥ 12 || TP ≥ 12`), slamzonen (`slam-auction.ts` ≥ 33/37),
svararens höjningar (`responses.ts`, stödpoäng), accepter (`rebids.ts`) och
reverse/hoppskift (TP-steg A–F, alla klara 2026-07-03).

**Rotorsak.** Rad 13–16 skrevs när TP var ett rent pedagogiskt visningslager. När
TP kopplades in i budlogiken lades det till LÄNGRE NER i filen i stället för att
den ursprungliga "låsningen" uppdaterades. Den feta, auktoritativa formuleringen
blev kvar.

**Konsekvens.** En läsare (särskilt en AI som citerar den fetstilta "Viktig
låsning" som en regel) drar slutsatsen att motorn fattar beslut på rå HP — raka
motsatsen till sanningen. Kunde leda till att någon "återinför" TP-inkoppling som
redan finns, eller bygger på en felaktig premiss. Ingen kodrisk, men aktivt
vilseledande dokumentation om en av projektets viktigaste låsta principer.

**Lösning.** Ersätt rad 13–16 med en not om att TP **numera styr** utvalda beslut
(golv, slam, höjningar) enligt "nedgradera aldrig"-principen, och länka till
avsnittet längre ner + `tp-arbetslista.md`. Ren dokumentändring.

**Prioritet: MEDIUM** (otydlighet/motsägelse om en låst kärnprincip).

---

### Fynd 2 — Bergen 3♣-intervallet: doc-motsägelse + överlappande golv (MEDIUM)

**Problem.** Två fel i samma detalj:

1. **Doc mot doc.** Systemboken `budsystem.md` (sanningskällan, rad 70/97/111) och
   `oversikt.md` (rad 20) säger **3♣ = 7–10 hp (konstruktiv)**. Men `status.md`
   (rad 26 + 55, "Stödsystem") säger **3♣ = 7–9 konstruktiv**. status.md har tyst
   snävat övre gränsen.
2. **Systemboken mot sig själv.** `budsystem.md` säger både **3♣ = 7–10** OCH
   **3♦ = 10–12**. Talet **10** ligger i BÅDA intervallen — boken definierar inte
   vart en exakt 10-poängare med 4 trumf går.

Koden (`src/lib/engine/responses.ts:70`) använder `sp >= 7 → 3♣ (Bergen
konstruktiv)` utan uttryckligt tak; 3♦-grenen (limit) tar över däröver. Så koden
har *ett* svar, men ingen av de tre dokumenten säger entydigt vilket.

**Rotorsak.** Systembokens ursprungliga intervallnotation är inklusiv i båda
ändar (7–10 / 10–12) och `status.md` "löste" tvetydigheten åt ena hållet (7–9)
utan att uppdatera boken.

**Konsekvens (AI-förvaltning — kärnan i R4 Del B).** Det här är precis den sorts
tvetydighet som gör att **två separata Claude-sessioner i olika worktrees skulle
kunna implementera 3♣-taket olika** (en läser status.md → 9, en läser boken → 10),
och det ger en merge-konflikt i LOGIK, inte bara i kod. Låg praktisk sannolikhet
(gränsfallet är en enda poäng) men exakt det mönster AUDIT_PROMPTS R4 punkt 5 ber
mig leta efter.

**Lösning.** Bestäm gränsen (koden säger implicit: 10 → 3♦ limit, eftersom limit
är det starkare/mer beskrivande budet — men **bekräfta med ägaren**), skriv den
entydigt i systemboken (`3♣ = 7–9`, `3♦ = 10–12`, eller vad ägaren vill), och
rätta `status.md` + `oversikt.md` att matcha. Rör budsystem-grunden i prosa →
enligt fix-protokollet krävs ägarens ja innan ändring.

**Prioritet: MEDIUM** (odokumenterat/tvetydigt beslut i systemboken +
doc-motsägelse; låg budrisk men äkta AI-divergensrisk).

---

### Fynd 3 — `kortspel.md` är flera iterationer föråldrad (MEDIUM)

**Problem.** `docs/kortspel.md` är spec-filen för spelläget, men dess nedre del
(Status / Återstår / Avgränsningar / Vägval) beskriver ett tidigt tillstånd:

- "**Ingen budgivning → spel-koppling ännu** (kontraktet väljs heuristiskt)" och
  `pickContract`/`dealForPlay` som aktuell kontraktskälla — men `status.md` säger
  att spelläget numera härleder kontraktet ur en **verklig auktion**
  (`auction-contract.ts`, `contractFromCalls`) och att `dealForPlay` inte längre
  används.
- "Bottar spelar tumregler, inte optimalt" / "botCard tumregler" som bot-motor —
  men bot-hjärnan (Monte-Carlo-DDS, `botCardSmart`, signalavkodning, "Varför?"-
  knapp) är byggd och live (`bot-hjarna.md`, `status.md`).
- "Ingen DDS-facit/poängsättning (punkt 28, separat)" och "Inga markeringar/
  signaler (punkt 30) ännu" — båda är sedan länge inkopplade.

**Rotorsak.** `kortspel.md` skrevs som byggplan för den FÖRSTA spel-omgången och
uppdaterades aldrig när spelläget fick auktion, DDS-facit, signaler och bot-hjärna.
Den vidare utvecklingen dokumenterades i stället i `status.md` + `bot-hjarna.md`.

**Konsekvens.** En läsare som öppnar `kortspel.md` (den fil som HETER kortspel och
som `status.md` länkar till som "Spec") får en bild av spelläget som är ~5
iterationer gammal. Motsäger `status.md` och `bot-hjarna.md`.

**Lösning.** Lägg en tydlig "Status per 2026-07-04 (uppdaterad)"-not överst som
pekar till `status.md`/`bot-hjarna.md` för nuläget, och/eller markera de gamla
Status/Återstår-punkterna som historik. Ren dokumentändring.

**Prioritet: MEDIUM** (föråldrad spec som aktivt motsäger nuvarande status).

---

### Fynd 4 — Tre-lager-auktionskontraktet är odokumenterat (MEDIUM, AI-förvaltning)

**Problem.** R2-rapporten (`r2-arkitektur.md`, "Arkitekturseam värt att
dokumentera") identifierade att motorn har **tre auktionslager** med olika ansvar,
kopplade via flaggan `BuiltAuction.open`:

- `auction.ts` (`buildAuction`, generativt) — bygger systemlinjen + EN
  konkurrensrond, sätter `open: true`, lämnar över.
- `auction-live.ts` (`decideCall`) — följer linjen tills off-book, tar sedan över
  via detektorkedjan.
- `auction-interpret.ts` (`interpretCall`) — översätter bud till text.

R2 avslutade med en uttrycklig **R4-rekommendation**: *"skriv upp detta
tre-lager-kontrakt explicit i `docs/status.md` eller `bot-hjarna.md`, så en
parallell session inte råkar bygga budlogik i fel lager."*

**Rotorsak / verifiering.** Sökning (`grep`) på hela `docs/`: kontraktet finns
BARA i `r2-arkitektur.md` självt. Det fördes aldrig in i status/bot-hjarna/CLAUDE.

**Konsekvens.** Detta är R4 Del B punkt 6 i renodlad form — ett beslut en AI
*måste* känna till för att inte bryta systemet, men som inte står i CLAUDE.md. En
parallell session som ska lägga till en konkurrenskonvention vet inte om den ska
röra `auction.ts` (generativt) eller `auction-live.ts` (detektor) — och det finns
kommentarer i koden ("Måste ligga FÖRE …") vars *skäl* bara framgår om man förstår
lager-kontraktet. Fel val → subtila logikfel eller dubblerad logik.

**Lösning.** Lägg ett kort "Tre auktionslager + `open`-handoff"-avsnitt i
`status.md` (eller `bot-hjarna.md`), och en enradslänk från `CLAUDE.md`s
projektstruktur. Ren dokumentändring; underlaget finns färdigt i R2-rapporten.

**Prioritet: MEDIUM** (högst prioriterade Del B-fyndet — direkt R2→R4-matning,
låg insats, hög effekt för parallellarbete).

---

### Fynd 5 — Föråldrade "NÄSTA/PRIO"-pekare konkurrerar med kartan (MEDIUM)

**Problem.** Flera dokument bär sin egen "nästa steg"-rad som pekar på klart
arbete:

- `arbetslista.md` rad 1–4: "🔺 **NÄSTA SESSIONS PRIO:** systematisk felsökning
  enligt `BUDSYSTEM – PRIORITERAD FELSÖKNINGS.txt`" — hela den felsökningsplanen
  (FAS 0–12) är genomförd.
- `sanningskarta.md` rad 205–207: "Nästa steg enligt planen: **FAS 1 punkt 1**"
  och "Inga nya funktioner förrän FAS 1–6 är verifierade" — FAS 1–6 är klara.
- Systembokens ändringslogg och flera status-avsnitt har egna "**Nästa gång:**"-
  rader från juni som aldrig städades.

**Rotorsak.** Varje dokument fick historiskt en egen framåtpekare. När arbetet
gick vidare uppdaterades `CLAUDE.md`-kartan (den avsedda enda källan för
NU/NÄST/SENARE) men inte de lokala pekarna.

**Konsekvens.** `CLAUDE.md`-kartan säger att nästa steg är R4/R-revisionen; de
lokala pekarna säger felsökningsplanen/FAS 1. En session som (mot rutinen) litar
på ett dokuments egen "PRIO"-rad i stället för kartan kan börja om redan klart
arbete. Motsäger järnregeln "kartan styr ordningen".

**Lösning.** Ersätt de lokala "NÄSTA/PRIO"-raderna med en hänvisning till
`CLAUDE.md`-kartan (en källa), eller markera dem tydligt som historik. Ren
dokumentändring.

**Prioritet: MEDIUM** (konkurrerande sanningskällor för "vad är nästa").

---

### Fynd 6 — `CLAUDE.md`s "## Beslut"-block är en tidskapsel (MEDIUM)

**Problem.** Projektkartan HÖGST UPP i `CLAUDE.md` är aktuell (R3 klar, R4 näst).
Men den nedre "## Beslut"-sektionen talar fortfarande i FAS-termer och innehåller
föråldrade framåtpekare, bl.a.:

- "**NÄSTA GÅNG STARTAR VI MED:** balansering (inkliv efter en passrunda) +
  inkliv över andra öppningar (1NT/svaga tvåor)" — balansering och försvar mot
  svaga tvåor/spärrar byggdes i R1 Fynd #2 (delbit 1–2, live).
- PIVOT-avsnittets "Steg 3 klart … NÄSTA GÅNG STARTAR VI MED: balansering" (samma
  klara arbete).

**Rotorsak.** Beslutsloggen har vuxit additivt; färdigt arbete flyttades till
`historik.md` men de inbäddade "NÄSTA GÅNG"-raderna i besluts-prosan följde inte
med.

**Konsekvens.** Nedre halvan av den fil som ska läsas FÖRST varje session beskriver
ett läge som är veckor gammalt. En fresh/parallell session som läser "Beslut" (inte
bara kartan) kan följa en superseded ordning. Överlappar Fynd 5 men gäller
specifikt `CLAUDE.md` — den mest lästa filen.

**Lösning.** Rensa "NÄSTA GÅNG STARTAR VI MED"-raderna ur Beslut-blocket (arbetet
är gjort → hör till historik.md); låt Beslut behålla de *låsta besluten* (2/1, TP,
tolkande motor) men inte framåtpekare — de bor i kartan. Ren dokumentändring i en
fil ägaren är känslig för → presentera exakt diff först.

**Prioritet: MEDIUM.**

---

### Fynd 7 — Namn + designöverride finns i kod/minne men inte i "läs-först"-docs (LÅG–MEDIUM)

**Problem.** App-namnet **RebidZ** och den medvetna designöverriden (spader
SVARTA, emerald-palett, Synrey-inspirerat) finns i:
- koden (`Home.tsx`, `BrandMark.tsx`, `PlayingCard.tsx`, `index.css`),
- Claudes privata `MEMORY.md` (`design-lift-business-ambition`,
  `visual-direction-synrey`),
- `AUDIT_PROMPTS.md`.

Men INTE i `CLAUDE.md` (som fortfarande rubriceras "CLAUDE.md — Bridge-app" och
kallar appen "Interaktiv webbapp för att lära sig … bridge") eller i någon
`docs/`-fil. Repo/URL heter `Learn-Bridge` (medvetet, ägarbeslut).

**Rotorsak.** Namn- och designbesluten fattades 2026-07-02/03 och landade i minne +
kod, men `CLAUDE.md`s identitetsrubrik uppdaterades aldrig.

**Konsekvens.** Test enligt AUDIT_PROMPTS ("om en ny AI fick ENBART
dokumentationen"): en session utan Claudes privata minne vet inte att appen heter
RebidZ (den ser "Bridge-app" i CLAUDE.md men "RebidZ" i koden → förvirring om vad
som är rätt) och känner inte till att **svarta spader är ett medvetet ägaröverride**
— risk att en välmenande session "rättar" spader till konventionell färg och bryter
beslutet. Mildras av att namnet finns i koden, så en kod-läsare hittar det; men den
"läs-först"-fil rutinen pekar på (CLAUDE.md) motsäger koden.

**Lösning.** Lägg en rad i `CLAUDE.md` ("Appen heter **RebidZ** i UI; repo/URL
förblir Learn-Bridge") + en kort designnot (emerald, spader svarta = ägaröverride,
länk till minnet/AUDIT_PROMPTS). Ren dokumentändring.

**Prioritet: LÅG–MEDIUM** (identitet/design finns i kod men motsäger den mest
lästa doc-filen).

---

### Fynd 8 — Hårdkodade testantal driver isär (LÅG)

**Problem.** Absoluta testantal är inbäddade som progress-markörer i minst
`status.md`, `arbetslista.md`, `bot-hjarna.md`, `sanningskarta.md` (via FAS),
audit-rapporterna och `MEMORY.md` — 587 / 612 / 630 / 644 / 697 / 727 / 1481 /
1626 / 1657 / 1668 / 1676 osv. `MEMORY.md` säger "testsvit 1626" medan R2/R3 säger
1676; `bot-hjarna.md` säger 727 medan `status.md` säger 697 för samma epok.

**Rotorsak.** Varje avstämning skrev in dagens totalsiffra. Siffran är korrekt när
den skrivs men föråldras vid nästa test.

**Konsekvens.** Kosmetisk/vilseledande — siffrorna motsäger varandra men ingen
bygglogik hänger på dem. Låg risk, men skräpar ner intrycket av en annars pålitlig
dokumentation.

**Lösning (valfri).** Behandla inbäddade antal som historiska tidsstämplar (lämna
dem), ELLER ersätt "testsvit N" med "hela sviten grön" där siffran inte tillför
något. Ingen brådska.

**Prioritet: LÅG.**

---

### Fynd 9 — Ingen README.md (LÅG)

**Problem.** Repo-roten har ingen `README.md`. Ingångsfilen är `CLAUDE.md`
(AI-orienterad arbetsinstruktion). En människa (eller AI utan direktiv om
CLAUDE.md) som landar på GitHub-repot ser ingen översikt: vad appen är, live-länk,
hur man kör den.

**Konsekvens.** Låg — projektet är privat drivet och CLAUDE.md fyller rollen för
den avsedda arbetsflödet. Men en minimal README (vad, live-länk, "utveckling styrs
av CLAUDE.md") skulle kosta lite och göra repot självförklarande.

**Lösning (valfri).** Skapa en kort `README.md`: en mening om RebidZ, live-länken,
och en pekare till CLAUDE.md/docs för utvecklare.

**Prioritet: LÅG.**

---

## Verifierat gott (bevara)

- **EN tydlig sanningskälla för systemet.** `budsystem.md` är otvetydigt boken;
  övriga docs hänvisar korrekt till den. Sanningskartan (FAS 0) kopplar bok →
  kod rad för rad. Detta är en styrka de flesta projekt saknar.
- **Terminologin är konsekvent.** hf/lf/hp/GF definieras i `oversikt.md`;
  TP/startpoäng/stödpoäng/Bergenpoäng definieras noga i `handvardering.md`;
  "förlorare" är låst för LTC i minnet. Samma konvention kallas samma sak överallt
  (Bergen, Jacoby 2NT, Minor Suit Stayman, DONT …). Ett undantag: Bergen 3♣-taket
  (Fynd 2).
- **Historik separerad från karta.** Flytten av "🎉 KLART"-block till
  `historik.md` (2026-07-04) höll CLAUDE.md-kartan ren — rätt instinkt.
- **Arbetsrutinerna** (`arbetsrutiner.md`, 🟢/🔴-checklistor) + järnregeln (ett NU)
  är exakt det som håller parallellarbete i schack. Behåll.

## Bedömning: hur långt kommer en ny AI/person på ENBART dokumentationen?

**Långt — troligen 90 % av vägen.** Systemboken + sanningskartan + status gör att
man kan förstå budsystemet, hitta rätt motorfil och veta vad som är byggt. Man
fastnar först på:

1. **Vilket auktionslager rör jag?** (Fynd 4 — inte dokumenterat.) Störst risk för
   faktiskt fel arbete.
2. **Är TP inkopplat i budbesluten eller inte?** (Fynd 1 — motsägelse.)
3. **Vad heter appen och varför är spader svarta?** (Fynd 7 — bara i kod/minne.)
4. **Vad är egentligen NÄST?** (Fynd 5/6 — flera konkurrerande pekare; räddas av
   att kartan i CLAUDE.md är korrekt och att rutinen säger "läs kartan först".)

Ingen av dessa stoppar arbetet helt, men #1 och #2 kan leda till FEL arbete, vilket
är värre än att fastna.

## Matning till R6

- KRITISK: inga. HÖG: inga.
- MEDIUM (låg insats, hög effekt — bra "denna vecka"-kandidater):
  **Fynd 4** (dokumentera tre-lager-kontraktet — R2 bad redan om det),
  **Fynd 1** (rätta TP-motsägelsen), **Fynd 3** (uppdatera kortspel.md).
- MEDIUM (kräver ägarbeslut om systemboken): **Fynd 2** (Bergen 3♣-gränsen — enda
  fyndet som rör systemgrunden; besluta talet, rätta alla tre docs).
- MEDIUM (städning i lästa filer): **Fynd 5, 6**.
- LÅG: **Fynd 7** (namn/design i CLAUDE.md), **Fynd 8** (testantal), **Fynd 9**
  (README).
- **Motsägelse att bevaka i R6:** Fynd 4 säger "dokumentera var
  konkurrenslogiken bor" medan R1 Fynd #2 + R2 Fynd #1 föreslår att STRUKTURELLT
  göra om `decideCall`-kedjan (datadriven). Dokumentera lager-kontraktet FÖRST
  (billigt, oförstörande), ta ombyggnaden när/om ägaren vill — annars dokumenterar
  vi ett läge som strax ändras.

*Fix-protokollet följt: R4 är en läsning. Inga fixar gjorda på plats — alla fynd är
dokumentation (varav Fynd 2 rör systembokens prosa) och lämnas till ägarens val,
ett i taget, enligt hur R1–R3 kördes.*
