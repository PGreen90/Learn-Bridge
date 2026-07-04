# Projektrevision (RebidZ) — R1–R6 promptsystem för Claude Code

**Syfte:** Kritisk, ärlig revision av budsystemets korrekthet, appens arkitektur,
UI/UX, dokumentation och utvecklingsprocess — så att projektet kan växa utan att
glida mot inkonsekvens eller teknisk skuld.

**Så här kör vi (beslutat med ägaren 2026-07-04):**
- **Bantad & sammanslagen.** 9 mall-faser → **6 revisionssteg (R1–R6)**. Vi döper
  dem R-något för att **inte** krocka med projektets egna FAS 0–12.
- **En gren per steg.** Varje R-steg körs i en egen `--worktree`-gren
  `audit/rX-namn` och skriver sin rapport till `docs/audit/rX-namn.md`.
- **Enkel svenska först.** Varje rapport börjar med *"Så här ligger det till"*
  på vanlig svenska + en färgtabell (Kritisk/Hög/Medium/Låg). Teknisk detalj
  längre ner. Ägaren läser inte koden själv.
- **Bygg vidare, gör inte om.** Mycket är redan kartlagt i `docs/sanningskarta.md`
  (FAS 0: systembok mot kod), `docs/status.md` och `docs/historik.md`. Revisionen
  ska **utgå från** dessa och leta det de *inte* redan täcker — inte upprepa dem.
- **Matning framåt:** varje R-rapport matas in i slutrapporten (R6).

---

## Fix-protokollet (läs innan något steg körs)

Revisionen är i grunden en **läsning**, inte en ombyggnad. Men småfel får lagas
på plats enligt dessa regler (beslutat med ägaren — "laga direkt när det är enkelt",
med skyddsräcken):

1. **Bara småfel på plats:** kosmetiskt/LÅG, eller en tydligt isolerad bugg där
   jag **skriver testet först (facit före fix)** — samma standard som
   felrapporterna. Allt större → beskrivs som fynd i rapporten, lagas inte nu.
2. **Budsystem-grunden rörs aldrig tyst.** Ändringar i öppningar/systembok/
   kärnlogik kräver **exempelhänder + ägarens ja först** (låst regel i CLAUDE.md).
   En 12 HP-hand öppnar alltid — TP får aldrig nedgradera.
3. **Separata commits.** En fix committas skilt från rapporten, i R-stegets gren.
4. **Inget pushas eller merge:as utan ägarens ja** (fråga-innan-PCD). Ägaren
   godkänner varje merge av en `audit/rX-…`-gren.
5. **Fynden landar i kartan.** Det som inte lagas på plats förs in i
   NU/NÄST/SENARE-kartan i CLAUDE.md (eller lämnas till R6:s handlingsplan), så
   ägaren väljer ordning. Järnregeln gäller: NU = exakt en sak.

---

## Projektkontext (ifylld — Claude ska inte gissa detta)

```
PROJEKT: RebidZ (repo: PGreen90/Learn-Bridge, live: pgreen90.github.io/Learn-Bridge/)
Stack: React + Vite + TypeScript + Tailwind v4. Ingen backend. GitHub Pages.

SÖKVÄGAR:
- Budmotor:            src/lib/engine/         (motorlogik + .test.ts bredvid varje fil)
- Tolkande budlager:   src/lib/engine/auction-interpret.ts, auction-live.ts, auction.ts
- Kortspel/DDS:        src/lib/engine/play*.ts, dds.ts, monte-carlo*.ts, card-counting.ts
- UI-skärmar:          src/pages/              (Home, BiddingPractice, Learn, Settings, Spela …)
- UI-byggblock:        src/components/         (Layout, Panel, Button, HandView, SuitSymbol …)
- Data:                src/data/               (givar + teman som JSON)
- Storage:             src/lib/storage.ts      (localStorage, inga konton)

SANNINGSKÄLLA FÖR SYSTEMET (det finns INGEN .docx):
- docs/budsystem.md    = systemboken. Allt i appen härleds härifrån.
- docs/sanningskarta.md= FAS 0: systemboken mot koden, rad för rad (KODAT/DELVIS/EJ KODAT
                         + kolumnen "Inkopplad"). REVISIONEN BYGGER VIDARE PÅ DENNA.
- docs/handvardering.md, off-book-syd.md, bot-hjarna.md, kortspel.md, tp-arbetslista.md
- docs/status.md, docs/historik.md, docs/arbetslista.md = var vi är / vad som gjorts.
- CLAUDE.md = spelreglerna + projektkartan (NU/NÄST/SENARE/PARKERAT) + låsta beslut.

LÅSTA SYSTEMBESLUT (från docs/budsystem.md — använd den, hitta inte på konventioner):
- System: 2 över 1 game force (2/1 GF).
- 5-korts högfärger, 3+ minorer (minor-regeln: 3-3→1♣, 4-4/5-5→1♦, annars längst).
- 1NT 15–17, 2NT 20–21, 3NT 25–27, stark konstgjord 2♣ (22+), svaga 2♦/2♥/2♠ (6-korts).
- Konventioner (se budsystem.md §4–§8 för exakt omfattning): Bergen-höjningar,
  inverterade minorhöjningar, Stayman/Smolen/Jacoby/Minor Suit Stayman/Texas,
  splinter, RKC + slamverktyg, Drury, Lebensohl, negativa/support/responsive-dubblingar,
  försvarskonventioner (DONT m.fl. i src/lib/engine/defense-conventional.ts, dont.ts).
- TP-beslut: motorn tänker i totalpoäng/fördelning, inte rå HP — MEN en 12 HP-hand
  öppnar alltid; TP får bara uppgradera, aldrig nedgradera en öppningshand.
- Verifiera alltid en konvention mot koden innan den bedöms — anta inte att
  mallens namn = verkligheten.

DESIGNRIKTNING (för R3 — läs de faktiska tokens i koden, anta inte):
- App-namn RebidZ. Synrey-inspirerat uttryck, EMERALD-palett, SPADER svarta
  (ägaröverride). Egen stil bortom Synrey tillåts. Läs tailwind-config/index.css
  för de verkliga färgerna/typsnitten — mallens gamla "varmblå/guld/Playfair" gäller INTE.

TESTLÄGE: Omfattande. ~1600+ tester, en *.test.ts bredvid nästan varje motorfil.
Frågan är alltså INTE "finns tester" utan "vilka kvaliteter/edge-cases testas inte".

FELRAPPORTERING: Live. GitHub-issues från Spela-läget; skill "felrapporter"
återskapar given som test (facit före fix). Felrapport #1–#13 lagade.
```

**Prioritetsdefinition (samma genom alla steg):**
- **KRITISK** = kan ge felaktigt/olagligt bud i en verklig budgivning, eller
  krasch/deadlock i Spela-läget.
- **HÖG** = korrekt i vanliga fall men trasig i definierade edge-cases
  (konkurrensbud, sällsynta sekvenser).
- **MEDIUM** = fungerar men skapar teknisk skuld, otydlighet eller onödigt underhåll.
- **LÅG** = kosmetiskt, optimering, "nice to have".

Hittar ett steg inget underlag: skriv **"SAKNAS — inte utvärderat"**, gissa aldrig,
och anta aldrig att frånvaro av fel = godkänt.

**Rapportmall (varje R-steg börjar så här):**
```
# RX — <namn>
## Så här ligger det till (för ägaren)
2–5 meningar på vanlig svenska: är det bra eller oroande, och det viktigaste fyndet.
## Fynd i korthet
| # | Fynd | Prioritet | Lagat nu? |
|---|------|-----------|-----------|
## Teknisk genomgång
(detaljer per fynd: Problem / Rotorsak / Konsekvens med budexempel / Lösning / Prioritet)
```

---

## R1 — Budsystemets korrekthet & testtäckning
*(slår ihop mallens Fas 1 + Fas 2)*

```
Kritisk revision av budmotorn i src/lib/engine/. UTGÅ FRÅN docs/sanningskarta.md
(FAS 0-kartläggningen) och docs/budsystem.md — leta det de INTE redan fångar.

Del A — korrekthet mot systemboken:
1. Logiska konflikter mellan konventioner (t.ex. var Jacoby 2NT och Smolen, eller
   transfers och Stayman, kan krocka i tolkning).
2. Odefinierade fortsättningar — lista VILKA sekvenser som saknar definierad
   fortsättning efter varje konvention.
3. Saknade konkurrenssekvenser (motpart doblar/överbjuder efter konventionen —
   vilka fall är otäckta i overcalls.ts / doubles.ts / auction-live.ts?).
4. Skillnad mellan vad budsystem.md säger och vad koden faktiskt gör. Om koden gör
   något som boken inte täcker: markera "odokumenterat beslut", anta inte att koden
   har rätt.
5. "Inkopplad?"-luckor: motorregler som är skrivna och testade men aldrig NÅS i en
   riktig auktion (buildAuction/decideCall). Sanningskartan flaggar detta för §7 —
   verifiera och sök fler.

Del B — testtäckning & blinda fläckar (tester FINNS, ~1600+):
6. Vilka konventioner/sekvenser saknar tester, och vilka test är "grunda"
   (testar happy path men inte edge-case/konkurrens/olaglighet)?
7. Regler i koden som vilar på outtalade antaganden (ingen kommentar, inget test,
   inget dok förklarar varför regeln ser ut som den gör).
8. Riskklassa varje otestat/svagt testat område enligt prioritetsdefinitionen.

Avsluta: kan nya konventioner läggas till utan att teknisk skuld ökar, givet
nuvarande test- och kopplingsläge? Motivera.

För varje fynd: Problem / Rotorsak / Konsekvens (konkret budexempel, t.ex.
"1♠–2♣–2♠–?") / Rekommenderad lösning / Prioritet.

Skriv resultatet till: docs/audit/r1-budsystem.md
```

---

## R2 — Teknisk arkitektur & skalbarhet
*(mallens Fas 4)*

```
Granska arkitekturen i hela kodbasen, med tyngd på src/lib/engine/ och kopplingen
motor ↔ UI (src/pages, src/components).

Identifiera:
1. Flaskhalsar vid tillväxt (fler konventioner, tyngre DDS/Monte-Carlo, fler skärmar).
2. Onödiga beroenden eller dubbelarbete mellan motorfilerna, och mellan motor och UI.
3. Bräcklig koppling: ställen där en ändring i EN konvention (t.ex. RKC/slam-auction)
   av misstag kan påverka en ANNAN (t.ex. en försvarskonvention) — delad state,
   gemensamma hjälpfunktioner, ordningsberoenden.
4. Överkomplexa lösningar där en enklare struktur räckt.
5. Kontraktshärledningen (auction-contract.ts) och X/XX-kedjan — är sanningskällan
   verkligen EN? (systemgranskningen 2026-07-03 slog ihop den; verifiera.)

Bedöm konkret: om vi lägger till 5 nya konventioner om ett år, vilka delar av
arkitekturen går sönder eller blir ohanterliga FÖRST?

Skriv resultatet till: docs/audit/r2-arkitektur.md
```

---

## R3 — UI/UX & Quality of Life
*(slår ihop mallens Fas 3 + Fas 7)*

```
Granska användarupplevelsen i appen (src/pages, src/components) med fokus på
långa spel- och lärsessioner.

LÄS FÖRST de faktiska design-tokens (tailwind-config, src/index.css) — bedöm mot
den VERKLIGA designriktningen (RebidZ, emerald-palett, svarta spader), inte mot
någon antagen palett.

Del A — UX:
1. Arbetsflöden som kräver fler klick/steg än nödvändigt (budträning + Spela-läget).
2. Punkter där användaren saknar feedback — efter ett bud/kort: vet spelaren om
   det var rätt, och varför?
3. Navigering som bryter mot vanlig webb-konvention utan skäl (HashRouter är låst —
   bedöm inte bort den, bedöm resten).
4. Funktioner som är tekniskt korrekta men förvirrande att använda.
5. Stödjer eller stör designvalen sessioner på 1+ timme (kontrast, färgläsbarhet
   av de fyra färgerna, ljuskägla, "förra sticket"-panelen)?

Del B — QoL (utan att ta bort funktionalitet):
6. Allt som fungerar men kräver onödigt många steg — föreslå konkret förenkling.
7. Sådant som är svårt att förklara i en mening.
8. Friktion vid onboarding av en ny användare.

Skriv resultatet till: docs/audit/r3-uiux-qol.md
```

---

## R4 — Dokumentation & AI-förvaltningsbarhet
*(slår ihop mallens Fas 5 + Fas 6)*

```
Granska all projektdokumentation (CLAUDE.md, MEMORY.md, docs/*.md, README,
kodkommentarer) OCH hur väl projektet lämpar sig för fortsatt utveckling via
Claude Code med parallella --worktree-sessioner.

Del A — dokumentation:
1. Motstridig information mellan dokument (budsystem.md vs sanningskarta.md vs
   status.md vs CLAUDE.md — samma sak sagd olika?).
2. Duplicerad information som riskerar att glida isär vid uppdatering.
3. Kunskap som bara finns "i Patriks huvud" eller implicit i kodstruktur.
4. Inkonsekvent terminologi (samma konvention/begrepp kallat olika saker).

Del B — AI-förvaltning:
5. Regler tvetydiga nog att två separata Claude Code-sessioner (olika worktrees)
   troligen skulle implementera OLIKA — vilket ger merge-konflikter i LOGIK, inte
   bara i kod. (Detta är extra viktigt eftersom vi nu KÖR revisionen i worktrees.)
6. Beslut som inte står i CLAUDE.md men som en AI ändå måste känna till för att
   inte bryta systemet.
7. Konkreta förbättringar av CLAUDE.md/MEMORY.md-strukturen och NU/NÄST-kartan som
   minskar risken att parallella sessioner motsäger varandra.

Bedöm: om en ny person eller AI fick ENBART dokumentationen och inte kunde fråga
Patrik — hur långt kommer de innan de fastnar, och var?

Skriv resultatet till: docs/audit/r4-dok-ai.md
```

---

## R5 — Git, deployment & process
*(mallens Fas 8)*

```
Granska git-historik, gren-strategi och deploy-processen.

Identifiera (utifrån vad du FAKTISKT ser i historiken, inte generellt):
1. Är commits små och spårbara, eller stora "allt-i-ett"?
2. Saknas en gren-strategi som gör rollback svårt? (Nu tillkommer audit/rX-grenar
   och parallella worktrees — hur påverkar det?)
3. Är deployen (GitHub Actions → Pages) reproducerbar och dokumenterad? Är Vite
   base-pathen ("/Learn-Bridge/") skyddad mot att brytas?

Besvara direkt: om Claude Code får utveckla projektet i sex månader utan mänsklig
granskning mellan varje steg — vilka tre risker är störst för att det glider mot
inkonsekvens eller teknisk skuld, givet historiken?

Skriv resultatet till: docs/audit/r5-git-deploy.md
```

---

## R6 — Slutrapport (körs sist, efter R1–R5)

```
Läs samtliga rapporter docs/audit/r1-*.md … r5-*.md.

Sammanställ docs/audit/SLUTRAPPORT.md med:
1. Kort bedömning per steg (2–3 meningar var) — och en "Så här ligger det till"
   på vanlig svenska överst för ägaren.
2. En samlad lista över ALLA fynd klassade KRITISK och HÖG, sorterade efter nytta
   per arbetsinsats (lågt arbete + hög effekt högst upp), med sekundär hänsyn till
   riskreducering, kvalitet och framtida skalbarhet.
3. Konkret handlingsplan: denna vecka / denna månad / detta kvartal — formulerad
   så att fynden kan föras rakt in i NU/NÄST/SENARE-kartan (ett NU i taget).
4. Eget avsnitt: vilka fynd MOTSÄGER varandra mellan stegen (t.ex. om R2 föreslår
   en omstrukturering som R4 varnar för p.g.a. AI-tvetydighet)?

Kortfattad i sammanfattningen, fullständig i handlingsplanen.
```

---

## Praktiska tips för körning

- Ordning: **R1 → R2 → R3 → R4 → R5 → R6**. R1 (korrekthet) är viktigast och körs
  först. R6 sist.
- Varje steg i egen gren `audit/rX-namn`; rapporten committas där. Ägaren godkänner
  varje merge till main (fråga-innan-PCD).
- Tappar en session kontext: låt Claude läsa tillbaka den redan skrivna
  `docs/audit/rX-*.md` istället för att hålla allt i minnet.
- Fix-protokollet ovan gäller i ALLA steg. Vid minsta tvekan: rapportera fyndet,
  laga inte.
- Den här filen bor i repo-roten och återanvänds vid nästa stora revision.
