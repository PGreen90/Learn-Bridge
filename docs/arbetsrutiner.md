# Arbetsrutiner

Fasta rutiner för varje arbetssession, så att vi alltid börjar och slutar
metodiskt. Claude följer dessa; ägaren behöver inte göra något själv.

> 📌 **Sifferregeln (ersatte R4:s konvention 2026-07-25).** En siffra får skrivas
> i ett levande dokument **bara om kommandot som återskapar den står bredvid**.
> Går den inte att reproducera ska den inte stå där — skriv "hela sviten grön".
>
> **Varför regeln byttes:** den gamla konventionen sa att testantal var
> historiska tidsstämplar som inte skulle synkas. Genomgången 2026-07-25 visade
> vad det kostade: baslinjen "1626 tester gröna (92 filer)" i revisionen R1 gick <!-- vakt-ok: citerar den felaktiga siffran som varnande exempel -->
> inte att reproducera — repot hade **48 testfiler** den dagen. Siffran var
> aldrig körd, men den spreds till fem filer och fick en regel som gjorde det
> *otillåtet att upptäcka felet*. En regel som förbjuder kontroll skyddar inte
> dokumentationen, den skyddar felet. Vakten `src/docs-vakt.test.ts` gör numera
> testsviten röd om ett odaterat testantal skrivs in i ett levande dokument.

## 🟢 Sessionsstart (starta metodiskt)
> Mål: snabbt veta *var vi är* och *vad vi gör idag* innan något ändras.

1. **Läs spelreglerna** – `CLAUDE.md` (arbetssätt + beslut).
2. **Läs var vi är** – `docs/budsystem.md`, särskilt **ändringsloggen**
   (vad gjordes sist, vad är nästa steg).
3. **Kolla projektets hälsa** – senaste git-commits, att inget ligger
   halvfärdigt/ostädat, och att senaste publiceringen blev grön (live-länken
   svarar).
4. **Verktygskoll (bara om vi ska bygga/pusha)** – Node på PATH, `gh` inloggad.
5. **Statusrapport till ägaren** – kort: *här står vi · vad vi gjorde sist ·
   förslag på dagens mål.*
6. **Bekräfta dagens mål** med ägaren innan vi sätter igång.

## 📋 Regel: visa alltid återstående punkter när ett jobb är klart
När ett jobb precis avslutats och Claude frågar ägaren *vad vi ska göra härnäst*,
ska Claude **alltid** presentera de återstående punkterna — 🟢 NÄST, ⚪ SENARE och
🅿️ PARKERAT ur **projektkartan i `CLAUDE.md`** (full beskrivning i
`docs/senare.md`) — så ägaren väljer nästa steg ur helheten i stället för ur
minnet. Gäller varje sådant tillfälle, inte bara vid sessionsslut.
*(Rättat 2026-07-25: regeln pekade på `docs/arbetslista.md`, som är arkiv sedan
kartan flyttade till CLAUDE.md — två dokument gav motstridiga besked.)*

## 👀 Regel: en bevaka-rad kräver frö/giv + måltestfil (2026-10-06)
`docs/bevaka.md` är en **vakt**, inte en backlogg (ägarbeslut 2026-10-06 efter
översynen: 48 avsnitt, 36 strukna, fyra "ej byggt"-rader hade redan gröna facit).
En rad får bara skrivas när den har (1) ett frö eller en giv och (2) namnet på
testfilen den ska landa i — helst som ett `it.todo` med position och förväntat
kort/bud redan skrivet. Raden stryks när testet blir `it` (eller en sond vaktar
principen). "Säg till om det känns fel"-rader, gränsfrågor och mätnoteringar
skrivs inte där: gränser och doktrin i `docs/budsystem.md`/`docs/bot-hjarna.md`,
mätningar i `docs/historik.md`, kända hål utan giv i `docs/senare.md`.
Bakgrund: ägarens känsla "jag anmärker på samma saker igen" — mätt 2026-10-06:
0 av 99 felrapporter säger "igen", så hålen sitter i obevakade principer.

## 🙋 Regel: fråga ägaren om DETALJERNA innan en budstruktur byggs (2026-09-18)
När ett fel visar sig vara ett **hål i en budstruktur** (inte bara ett enstaka
felbud) ska Claude **inte** föreslå en egen färdig struktur. Claude ska:
1. laga/låsa det ägaren uttryckligen sagt (facit på den rapporterade given),
2. visa hålen konkret (typhänder → vad motorn bjuder i dag),
3. **fråga ägaren hur detaljerna ska byggas** — vilken konvention, vad varje bud
   ska betyda, gränser/nivåer — med konkreta svarsalternativ, och
4. bygga först när svaren finns. Ett eget förslag får nämnas som ETT alternativ,
   aldrig som utgångspunkt.
*(Bakgrund: felrapport #77 — Claude föreslog "Lebensohl även mot DONT" när ägaren
ville ha systems on + stulet bud. Ägaren: "du borde fråga mig om hur jag vill
bygga detaljer".)*

## 🔢 Regel: händer som visas för ägaren räknas med KOD (2026-09-28)
Poäng och kortantal för en hand som visas för ägaren (felrapporter, exempelgivar,
budtabeller) räknas **aldrig i huvudet och ärvs aldrig från ett tidigare svar** —
de räknas med motorns egna funktioner (`hcp(parseHand(...))`, `src/lib/engine/hand.ts`)
varje gång. Innan en tabell med fyra händer skrivs kontrolleras att de **summerar
till 40 hp och 13 kort var**; stämmer det inte visas ingenting förrän felet är hittat.
Samma disciplin gäller påståenden om vad ett bud *lovar*: kolla systemboken (t.ex. att
negativ dubbling visar "typiskt" de objudna högfärgerna — en 4-4-fit är alltså
**inte känd** för partnern) innan ett läge beskrivs som känt.
*(Bakgrund: felrapport #88 — hp-raden 12/16/6/5 summerade till 39, rätt var
11/15/9/5; Östs 9 hp hade räknats till 6 och upprepats i tre svar. Samma dag
en tredje felräkning: ♠KJ ♥Q8 ♦AKJ764 ♣K103 kallades 18 hp, är 17 — ägaren
fattade ett beslut på fel siffra. Ägaren: "väldigt oroväckande, gör inte om
detta". Regeln står också i `CLAUDE.md`, `.claude/commands/felrapporter.md`
och i minnet.)*

**Så räknas det (kopiera, kör, läs av — innan handen skrivs i svaret):**
```
cat > src/lib/engine/tmp-hp.test.ts <<'EOF'
import { it } from 'vitest'; import { writeFileSync } from 'node:fs'
import { parseHand } from '../bidding'; import { hcp } from './hand'
const hs = ['S:KJ H:Q8 D:AKJ764 C:KT3']   // ← händerna som ska visas
it('hp', () => writeFileSync(process.env.TEMP + '/hp.txt', hs.map((h) => `${h}: ${hcp(parseHand(h))} hp, ${parseHand(h).length} kort`).join('\n')))
EOF
npx vitest run src/lib/engine/tmp-hp.test.ts >/dev/null 2>&1; rm src/lib/engine/tmp-hp.test.ts; cat "$TEMP/hp.txt"
```

## 🔴 Sessionsavslut (avsluta smart & noggrant)
> Mål: inget lämnas trasigt, allt är sparat, och nästa start blir lätt.

1. **Sammanfatta** vad vi gjorde denna session (i klartext för ägaren).
2. **Uppdatera dokumentationen** – systembokens ändringslogg och/eller
   `CLAUDE.md` (nya beslut, nästa steg).
3. **Inget halvfärdigt brutet** – om något påbörjats men inte är klart: skriv
   ner *exakt var vi stannade* + nästa steg.
4. **Spara & publicera** – om kod ändrats: bygg → commit → push → vänta på grön
   deploy → verifiera live-länken. (Bara dokument: commit + push.)
5. **"Nästa gång börjar vi med …"** – en tydlig rad så starten blir enkel.
6. **Städa** bort temporära filer.
7. **Slutrapport till ägaren** – kort summering + live-länk.
