# Handvärdering — Bergens Adjust-3 (plan + spec)

> Källa: "Hand Evaluation – Using Marty Bergen's Adjust-3 Method" (Neil H. Timm),
> bygger på Bergens bok *Slam Bidding Made Easier* (2008).
> Den här filen är både **specifikationen** (reglerna, vår sanningskälla) och
> **byggplanen** (numrerad ordning, test-drivet). Status längst ned.

## Mål och princip
- **Hp ljuger.** Ess och tior är undervärderade, damer och knektar övervärderade.
  Två händer med samma honnörspoäng kan vara olika starka.
- Vi inför en **totalpoäng (TP)** som värderar handen mer rättvist, och visar
  den **bredvid** honnörspoängen i appen: **`15 HP (17 TP)`**.
- **Viktig låsning:** TP **styr INTE budbesluten** i det här steget. Budmotorn
  fattar beslut precis som idag (på `hcp`). TP är ett pedagogiskt lager som visar
  ägaren *varför* en hand är värd mer eller mindre än de råa honnörspoängen.
  Inkoppling i budlogiken är ett separat, framtida beslut.

## Terminologi (svensk vokabulär)
- **Hp** = honnörspoäng = HCP (A=4, K=3, D=2, kn=1). Finns redan som `hcp()`.
- **TP** = totalpoäng = handens värde efter värdering. TP betyder olika saker
  beroende på kontext:
  - **Startpoäng** — TP utan känd fit (det öppnaren räknar för att öppna).
    Detta är **standard-TP** som visas för en ensam hand utan auktionskontext.
  - **Stödpoäng** — svararens TP när fit i **högfärg** hittats (lägg till kortfärg).
  - **Bergenpoäng** — öppnarens omvärderade TP efter att fit hittats.

---

## SPECIFIKATION — reglerna

### Nivå 1 — Startpoäng (alltid; det öppnaren behöver för att öppna)

Sex steg, i ordning:

1. **Hp** — A=4, K=3, D=2, kn=1.
2. **Adjust-3** (justering för över/undervärderade honnörer):
   - Räkna undervärderade = antal **ess + tior**.
   - Räkna övervärderade = antal **damer + knektar**.
   - Ta differensen (större − mindre):
     - 0–2 → ingen justering
     - 3–5 → 1 poäng
     - 6+ (sällsynt) → 2 poäng
   - **Fler ess/tior → lägg TILL.** **Fler damer/knektar → DRA IFRÅN.**
3. **Längd** — +1 poäng per kort i en färg **över 4** (5-färg +1, 6-färg +2, 7-färg +3 …).
4. **Tvivelaktiga honnörer** — DRA IFRÅN 1 poäng för var och en av:
   - **Dubbletonger:** AkN, KD, KkN, DkN, Dx, kNx. (½ eller 0 säkra stick.)
   - **Singlar:** K, D, kn. (½ eller 0 säkra stick.)
   - **Undantag (dras INTE):** AK, AD (innehåller ess + topphonnör), samt Ax och Kx.
5. **Färgkvalitet** — +1 poäng per färg med **3+ av topp-5** honnörerna (A K D kn 10).
6. **Flathet** — DRA IFRÅN 1 poäng om formen är **4-3-3-3, 5-3-3-2, 6-3-2-2 eller
   7-2-2-2** (i färgkontrakt). I NT-kontrakt: dra ifrån 1 även för 4-3-3-3.

→ **Startpoäng = summan av steg 1–6.**
**Öppningsregel (INKOPPLAD, `openings.ts`):** öppna 1-i-färg när **HP ≥ 12
ELLER startpoäng (TP) ≥ 12**. Två vägar (ägarens beslut 2026-06-30):
- **HP-golv:** 12+ honnörspoäng öppnar *alltid* – en människa nedgraderar i
  princip aldrig en öppningshand, så TP får aldrig sänka en 12-hp-hand under
  tröskeln (t.ex. en platt 4-3-3-3 med 12 hp / 10 TP öppnar ändå).
- **TP-upgrade:** en bra 11-hp-hand som når 12 TP (ess/tior/längd/kvalitet)
  öppnar också. En platt 11:a (TP < 12) avstår fortfarande.
NT-stegen (1NT 15–17 osv.) är hp-definierade.

### Nivå 2 — Stödpoäng (svararen, vid fit i HÖGFÄRG)

Gäller när partnern öppnat en **högfärg** och svararen har **3+ stöd** (eller när
öppnaren öppnat minor och svararen visar 4-korts högfärg som öppnaren har 4 i).
Gäller **inte** minor- eller NT-öppning utan känd fit. Lägg till **kortfärgspoäng**
ovanpå startpoängen:

- **Dubbleton:** +1 (alltid)
- **Singel:** +2, men **+3 med 4+ trumf**
- **Renons:** +antal trumf på handen

→ **Stödpoäng = startpoäng + kortfärgspoäng.**
*Obs:* kortfärgspoäng räknas **aldrig** när man öppnar (innan fit). Bara
tvivelaktiga kort-honnörer (steg 4) påverkar startpoängen.

**INKOPPLAD (TP-steg B, `responses.ts` `respondToMajor`):** svararens
högfärgshöjningar väljer nivå på **stödpoäng = `max(HP, dummyPoints)`** i stället
för rå HP. `max(...)` = "nedgradera aldrig under HP" (ägarens princip): korthet/
längd får *lyfta* en höjning (11 HP + singel + 4 trumf = 14 stödp. → splinter/GF),
men en platt övervärderad hand stannar på HP-golvet. Trösklarna (Bergen spärr <7 /
konstruktiv 7–9 / limit 10–12 / Jacoby ≥13 / splinter ≥12 m. kortfärg) läses nu i
stödpoäng.

### Nivå 3 — Bergenpoäng (ÖPPNAREN, efter att fit hittats)

När öppnaren fått veta att fit finns omvärderas handen uppåt:

1. **Extra trumflängd** — med 6+ trumf, +1 per trumf efter den femte (6-färg +1,
   7-färg +2 …).
2. **Sidofärger** — +1 för varje **4- eller 5-korts** sidofärg.
3. **Kortfärgspoäng (endast färgkontrakt, EJ NT):**
   - +1 extra för **2 eller 3 dubbletonger** (totalt, inte per styck — skiljer sig
     från svararens stödpoäng-procedur)
   - +2 för en singel
   - +4 för en renons (vissa använder antal trumf)

→ **Bergenpoäng = startpoäng + steg 1–3.**
I NT: bara steg 1–2 (ingen kortfärg).

**Trösklar (referens):** 26 poäng för utgång i högfärg/NT, 29 för utgång i minor,
33 för slam. (Används senare om/när vi kopplar in TP i budlogiken.)

---

## ARKITEKTUR

Ny **ren modul** `src/lib/engine/evaluation.ts`, byggd test-drivet i samma stil
som `src/lib/engine/hand.ts`. Inga sidoeffekter, hand in → uppdelad värdering ut.

Returvärde är en **uppdelning**, inte bara en siffra, så appen kan visa hela
uträkningen ("därför 17, inte 15"):

```ts
interface Evaluation {
  hp: number              // steg 1
  adjust3: number         // steg 2 (kan vara negativ)
  length: number          // steg 3
  dubiousHonors: number   // steg 4 (≤ 0)
  suitQuality: number     // steg 5
  flatness: number        // steg 6 (≤ 0)
  startingPoints: number  // summa 1–6  ← standard-TP
}
```

Fit-beroende lager läggs som separata funktioner som tar extra kontext
(trumffärg + roll), eftersom de kräver känd fit:

```ts
function startingPoints(hand): Evaluation
function dummyPoints(hand, trump): { startingPoints, shortness, total }   // Nivå 2
function bergenPoints(hand, trump, { notrump }): { startingPoints, ..., total } // Nivå 3
```

**Visning:** standard är `${hp} HP (${startingPoints} TP)`. När en auktion ger
känd fit + roll kan vyn i stället visa stöd-/Bergenpoäng som TP. Detalj på
uträkningen (Adjust-3, längd osv.) visas i en utfällbar ruta / tooltip.

## Var det visas
- `src/components/HandView.tsx` — lägg till en valfri rad/etikett `15 HP (17 TP)`
  under handen (prop-styrt, så vyn kan användas utan poäng där det inte passar).
- Budträningen och Spela-fliken som renderar `HandView` får poängen "på köpet".

---

## BYGGPLAN (numrerad, test-driven; varje steg = en avstämningspunkt)

> Verkställs **inte** förrän ägaren ger OK. Varje punkt: skriv tester först,
> grön `npm test`, sedan nästa.

1. **Modul-skelett + Hp + Adjust-3.** `evaluation.ts` med `startingPoints()` som
   först bara gör steg 1–2. Tester mot PDF:ens Hand 1–5 (Adjust-3-delen).
2. **Längd + tvivelaktiga honnörer + kvalitet + flathet.** Fyll på steg 3–6.
   Tester: PDF:ens fem händer ska ge startpoäng 12 / 11 / 11 / 12 / 20.
3. **Stödpoäng (Nivå 2).** `dummyPoints(hand, trump)`. Tester: PDF:ens Hand A–F
   ska ge 17 / 20 / 12 / 16 / 8 / 15 stödpoäng.
4. **Bergenpoäng (Nivå 3).** `bergenPoints(...)`. Tester: PDF:ens facit-händer
   (t.ex. exempel-handen → 26 Bergenpoäng; övningarna 1–5 → 24/19/24/12/15).
5. **Visning i HandView.** `15 HP (17 TP)` + utfällbar uträkning. Verifiera i
   webbläsaren (preview) att budträningen och Spela visar rätt.
6. **Dokumentation + commit/push.** Uppdatera ändringslogg och arbetslista;
   deploya och verifiera live-länken.

## TP styr budbeslut (steg 2 – inkopplat senare)
Efter den rent pedagogiska visningen kopplades TP in i utvalda beslut:
- **Öppningströskeln** (`openings.ts`): färgöppning sker nu vid **TP ≥ 12**
  (Bergens grundregel "öppna med 12+ startpoäng") i stället för hp ≥ 12.
  NT-stegen och starka 2♣ är fortsatt hp-definierade (konventionella ranges).
  Effekt: bra 11-hp-händer öppnar; platta D/kn-tunga 12-hp-händer (→ 11 TP) avstår.
- **Slamzon** (`slam-auction.ts`): tröskeln **33** (Bergenpoäng + stödpoäng) avgör
  om en Jacoby-2NT-auktion växer vidare till 1430 RKC; **37** för storslam.

## Öppna frågor / kantfall att bevaka
- **Säkra stick (quick tricks):** öppningsregeln nämner "2 säkra stick". Vi
  *visar* TP men inkopplar inte öppningsregeln, så vi kan vänta med en
  `quickTricks()`-funktion tills den behövs. (Noteras som möjlig framtida punkt.)
- **TP utan kontext:** för en ensam hand visar vi startpoäng som TP. Stöd-/
  Bergenpoäng kräver känd fit och dyker upp först när auktionen ger den.
- **"x" i tvivelaktiga dubbletonger** (Dx, kNx) = honnör + småkort; AK/AD/Ax/Kx
  undantas enligt spec. Testas explicit.

## Källavvikelser (PDF:en räknar fel på några ställen)
13 av 16 facit-händer stämmer exakt med reglerna ovan. Dessa avviker — vi följer
**regeln**, inte felräkningen, och testar därför inte deras totalsummor:
- **Nivå 2, Hand D** (♠9876 ♥AK ♦75 ♣AQT84): metodtexten säger "dubbleton 1 poäng
  *var*", så två dubbletonger = +2 → **17 stödpoäng**. PDF skriver "add 2 points"
  men summerar fel till 16. Vi använder 17.
- **Nivå 2, Hand F** (♠T2 ♥J64 ♦KQJ ♣KQT98): formen 5-3-3-2 ska ge flathet −1 →
  13 start / 14 stöd. PDF glömmer flatheten (14/15). Vi följer regeln.
- **Nivå 3, Hand (2)** (♠KQ ♥AKJ64 ♦K763 ♣Q3): regeln ger 18 start (hjärter AKJ
  är en kvalitetsfärg), PDF skriver 17. Sannolikt missad kvalitetspoäng i källan.
- **Nivå 3, Hand (4)** (♠Q74 ♥QJ7 ♦K76 ♣KQ72): formen 4-3-3-3 ska ge flathet −1.
  PDF räknar 12 (utan flathet). Vi följer regeln.
- **Det stora exemplet** (♠AK42 ♥KQ632 ♦AK109 ♣void): regeln "+1 per sidofärg"
  ger 27 Bergen (två 4-kortsfärger), PDF räknar 26 (en sidofärg). Startpoängen
  21 stämmer; vi testar bara den.

## Status
- ✅ Plan godkänd av ägaren
- ✅ Punkt 1–4: `evaluation.ts` med startpoäng (Nivå 1), stödpoäng (Nivå 2) och
  Bergenpoäng (Nivå 3). Test-drivet, 18 tester gröna mot PDF:ens facit-händer.
- ✅ Punkt 5: visning `15 HP (17 TP)` i `HandView` (prop `showPoints`) med
  utfällbar uträkning. Inkopplad i Spela- och Budträning-vyerna. Verifierad i
  webbläsaren (alla fyra givhänder räknar rätt, inga konsolfel).
- ✅ Punkt 6: commit/push + live ([live-länken](https://pgreen90.github.io/Learn-Bridge/) grön).
- ✅ Tillägg: `deferredShortness()` + grå rad "Kortfärg (räknas först vid fit)" i
  uträkningen. Bergens regel "ingen korthet i startpoäng vid öppning" gäller
  fortfarande – men singel/dubbel/renons visas nu som *uppskjutna*, inte glömda,
  med en notis om ungefärligt TP-värde när fit hittats.
