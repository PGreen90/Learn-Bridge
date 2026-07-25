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
