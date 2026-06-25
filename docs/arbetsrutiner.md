# Arbetsrutiner

Fasta rutiner för varje arbetssession, så att vi alltid börjar och slutar
metodiskt. Claude följer dessa; ägaren behöver inte göra något själv.

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
