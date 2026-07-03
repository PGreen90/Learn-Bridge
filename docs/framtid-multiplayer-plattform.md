# Framtidsplan — från webbapp till riktig plattform (multiplayer, konton, app)

> **Status: PARKERAT / sparat för senare (nedskrivet 2026-07-04).** Ingen kod ska
> byggas på detta förrän ägaren uttryckligen säger "kör". Det här dokumentet är
> beslutsunderlaget så vi slipper väga om allt från noll när det blir läge.
>
> **Vid uppstart av detta arbete:** läs hela dokumentet, bekräfta med ägaren att
> valen nedan fortfarande gäller (särskilt databasvalet), och bygg i den
> stegordning som står under "Stegordning". Bygg ALDRIG allt på en gång.

## Vad ägaren vill (visionen, ägarens egna ord 2026-07-03/04)

- Egen **domän** (`rebidz` — den lediga domän vi diskuterat tidigare, se
  designbeslutet om appnamnet).
- **Nå ut till fler människor.**
- **Användare som kan registrera sig och ha egna konton.**
- **Spela mot varandra** (multiplayer — riktig bridge, fyra spelare).
- **App på iOS och Android**, inte bara webb.
- Kunna **hosta tävlingar.**
- **Inga begränsningar** (plattform som kan växa).
- **Inte** ett projekt för att tjäna mycket pengar — men kanske ett
  **donationssystem** om användare uppskattar appen.
- Ska **fortfarande fungera på webben** under den egna domänen.
- Vill **göra rätt en gång** — undvika att behöva bygga om senare.

## Varför GitHub Pages inte räcker (kärnproblemet)

GitHub Pages kan bara visa färdiga, statiska sidor — som en anslagstavla. Den kan
inte *minnas* något om enskilda användare. Allt ägaren nu vill ha (konton,
inloggning, spela mot varandra, tävlingar, donationer) kräver att appen kan spara
och dela data mellan användare. Det kräver en **backend** ("en delad hjärna +
receptionist i molnet"): receptionisten känner igen dig vid inloggning, arkivet
sparar allas resultat och tävlingar på ett gemensamt ställe.

Dagens app har bara den del som syns på skärmen (allt körs i webbläsaren, ingen
backend). Vi **lägger till** hjärnan bakom — hela den befintliga appen, budmotorn
och kortspelet **behålls**. Vi bygger vidare, river inte.

**Bonus:** när vi ändå flyttar webbhostingen försvinner GitHub Pages
deploy-hicka ("Deployment failed, try again later") på köpet — se
`docs/`-anteckningar/minnet om den utredningen; de moderna alternativen är
stabilare.

## Rekommenderad teknik (nybörjarvänligt, billigt att börja, låg inlåsning)

Tre pusselbitar:

1. **Webben + egen domän:** flytta appen till **Vercel** (eller Netlify). Gratis
   att börja, kopplar `rebidz`-domänen, lägger ut nya versioner automatiskt vid
   push (som nu, fast stabilare).
2. **Hjärnan (konton, tävlingar, resultat):** **Supabase** (se beslut nedan).
   Ger inloggning (inkl. Apple Sign In för iPhone) och ett delat databas-arkiv
   färdigt; generös gratisnivå; öppen och flyttbar.
3. **Appen på iPhone + Android:** **Capacitor** stoppar in den *befintliga*
   webbappen i ett native-skal som kan läggas i App Store och Google Play —
   nästan ingen omskrivning. (Prestandan räcker gott; bridge är inget tungt
   3D-spel.)

**Donationer** läggs till sist med en färdig knapp (Stripe eller Ko-fi).

## Beslut: databasvalet — Supabase (med Firebase som fullgott alternativ)

Två AI:er (Claude + ägarens Grok) landade oberoende i **samma helhetsbild**;
enda skillnaden var databasval. Båda kan konton, inloggning, Apple Sign In och
realtid — så det är ingen ödesfråga.

- **Firebase (Groks förslag):** Googles färdiga paket. Snabbast igång, flest
  färdiga exempel för *kortspel i realtid*. Nackdelar: mer **inlåst hos Google**
  och priset kan **hoppa oväntat** vid många samtidiga spelare (betalning per
  liten händelse).
- **Supabase (Claudes förslag, ägarens preliminära val):** som en städad,
  vanlig databas (tabeller, likt ett kraftfullt kalkylark). Passar **bättre för
  tävlingar och resultatlistor** (ordnad data), **öppnare/flyttbar** (mindre
  inlåsning), **mer förutsägbart pris**.

**Rekommendation: Supabase**, kopplat till ägarens önskan att "göra rätt en
gång": tävlingar/resultat är ordnad list-data (SQL passar), ingen inlåsning, och
förutsägbar kostnad för ett donationsfinansierat projekt. Firebases enda verkliga
övertag (fler kortspels-exempel) landar på Claude som skriver koden, inte på
ägaren. **Firebase är inte fel** — bara ett annat dugligt val. Om ägaren ändrar
sig till Firebase: helt okej, samma helhetsplan gäller.

> **Öppen fråga att bekräfta med ägaren innan bygge:** Supabase eller Firebase?
> (Preliminärt Supabase. Ägaren fick välja men ville spara beslutet till senare.)

## Den viktigaste principen: håll backend UTBYTBAR

Det som verkligen skyddar mot "bygga om" är **inte** vilken databas vi väljer,
utan att appen byggs så att backend-delen är **löst inkopplad**, inte inkittad
överallt. Då är Firebase/Supabase inte ett livslångt äktenskap utan utbytbart.
Tre saker som skyddar ägaren:

1. Behåll den befintliga budmotorn/kortspelslogiken.
2. Lägg **fusk-kontrollen (validering av bud/drag) på servern** — annars kan
   någon lura webbläsar-koden. Blandning/giv görs också bäst på servern.
3. Kapsla in allt backend-specifikt bakom ett tunt eget lager så det går att
   byta leverantör utan att röra resten av appen.

## Mobil-vägen i tre steg (i denna ordning)

1. **PWA först (gratis, snabbt):** lägg till `manifest.json` + enkel service
   worker så appen kan "Läggas till på hemskärmen" på iPhone/Android — egen ikon,
   känns som en app, ingen App Store, ingen avgift. Bra för att testa vattnet.
2. **Capacitor (när App Store vill nås):** wrappa den befintliga webbappen till
   ett riktigt Xcode-/Android-projekt → TestFlight → App Store + Google Play.
   Native push-notiser via backend.
3. **Flutter — bara om Capacitor någon gång inte räcker.** Kräver omskrivning av
   UI till Dart = mycket mer jobb; inte aktuellt i tidigt skede.

## Ärlig kostnads- och arbetskoll

- **Pengar:** att *börja* är i princip gratis (domän ~100–150 kr/år, redan
  påtänkt). Hårda avgifter som inte går runt: **Apple 99 USD/år** (för iPhone
  App Store) och **Google 25 USD en gång** (Android). Supabase/Vercel gratis tills
  meningsfull trafik.
- **Arbete:** större kliv än allt vi gjort hittills ("app-projekt fas 2"). Görs i
  lugna steg. **Riktig fyrmanna-bridge mot varandra (budgivning, någon tappar
  nätet mitt i) är en av de svårare sakerna** man kan bygga — börja enkelt
  (konton + lobby + ev. tvåspelarläge) innan tävlingar.
- **Ansvar:** i samma stund konton sparas får ägaren ansvar för användarnas
  uppgifter (integritet/GDPR, särskilt för svenska/EU-användare). Ska göras rätt;
  Claude guidar.

## Stegordning (bygg ETT i taget, eget facit per steg)

1. **Flytta webben** till Vercel/Netlify + koppla `rebidz`-domänen. (Minst risk,
   störst nytta direkt — och deploy-problemet försvinner.)
2. **Konton** — registrera/logga in (inkl. Apple Sign In).
3. **Spara framsteg/resultat per användare** (idag: bara localStorage lokalt).
4. **Lobby + spela mot varandra** — skapa/joina bord, synka spel-läge i realtid,
   servern validerar varje bud/drag, hantera disconnect/reconnect. Börja litet.
5. **Appen i App Store + Google Play** via Capacitor (PWA-steget kan tas redan
   tidigare, parallellt).
6. **Tävlingar** (mest avancerat — kommer när grunden står stadig).
7. **Donationsknapp** (Stripe/Ko-fi).

## Inspiration / referens (bygg eget, men titta gärna)

- **Funbridge** — flöde och UX för webb + appar.
- **Synrey Bridge** — redan vår visuella förebild (se designbeslutet).
- Open source-bridge på GitHub för hur andra strukturerar logik (t.ex.
  "bridge-web") — titta, kopiera inte.

---

*Nedskrivet efter ägarens uttryckliga önskan att spara materialet för senare
(2026-07-04). Ingen kod byggd. Nästa steg avgörs av ägaren.*
