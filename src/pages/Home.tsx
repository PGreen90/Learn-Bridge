import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark, Wordmark } from '../components/BrandMark'
import { Felt } from '../components/Felt'
import { TyckTillKnapp } from '../components/TyckTill'
import { useAuth } from '../components/AuthProvider'
import { loadTavlingFramsteg } from '../lib/backend'
import type { TavlingsForm } from '../lib/engine/matchpoints'
import { tavlingsStatus } from '../lib/tavlingsstatus'
import { fetchMittLage, fetchVeckansStjarna, talText, type MittLage, type VeckansStjarna } from '../lib/backend/tavling'
import { guldVecka } from '../lib/engine/daily'

// Egna linje-ikoner i guld, ritade i samma språk som logotypen (BrandMark):
// inline-SVG → knivskarpa i alla storlekar och alltid på varumärket.
const ICON_SVG = 'h-6 w-6'
const MODE_ICONS: Record<string, ReactNode> = {
  // Spela kort: ett spelkort med brandens egen guldspader som filled pip.
  cards: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path
        d="M12 7 C 10 9.5, 7.5 11, 7.5 13 C 7.5 14.5, 9 15, 10 14 C 9.8 15.5, 9.2 16, 8.5 16.3 L 15.5 16.3 C 14.8 16, 14.2 15.5, 14 14 C 15 15, 16.5 14.5, 16.5 13 C 16.5 11, 14 9.5, 12 7 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  ),
  // Budträning: måltavla — hitta rätt bud.
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Budvisning: ett öga — titta på när datorn budar.
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <path d="M2.5 12 C 6 7, 18 7, 21.5 12 C 18 17, 6 17, 2.5 12 Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  // Dagens giv: en kalender med guldpricken på dagens datum.
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5 L 20.5 9.5" />
      <path d="M8 3 L 8 6.5 M16 3 L 16 6.5" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Spela med vänner: två personer vid samma bord.
  friends: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <circle cx="8.5" cy="8.5" r="3" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path d="M2.5 19 C 3 15.5, 5.5 14, 8.5 14 C 11.5 14, 14 15.5, 14.5 19" />
      <path d="M15.5 14.2 C 18.5 14, 21 15.5, 21.5 18.5" />
    </svg>
  ),
  // Budsystem: en uppslagen bok.
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <path d="M12 6.5 C 10 5.2, 6.5 5, 4 5.5 L 4 17.5 C 6.5 17, 10 17.2, 12 18.5 C 14 17.2, 17.5 17, 20 17.5 L 20 5.5 C 17.5 5, 14 5.2, 12 6.5 Z" />
      <path d="M12 6.5 L 12 18.5" />
    </svg>
  ),
  // Stjärntävlingen: en stjärna i linjestil.
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <path d="M12 3.2 L 14.7 8.9 L 20.8 9.7 L 16.3 14 L 17.5 20.1 L 12 17.1 L 6.5 20.1 L 7.7 14 L 3.2 9.7 L 9.3 8.9 Z" />
    </svg>
  ),
  // Klar tävling: en bock.
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <path d="M5 12.5 L 10 17.5 L 19 7" />
    </svg>
  ),
}

// Startsidan i GRUPPER (ägarbeslut 2026-11-22: "har blivit för mycket"): förr
// åtta lika stora kort med en förklarande mening var. Nu samma innehåll på EN
// sida, ordnat efter vad man gör: Tävla (en panel, tre rader som visar var man
// står), Träna (tre brickor) och två rader underst. Inget ligger längre bort
// än ett tryck — ägarens första idé (två vägval) hade kostat ett extra tryck
// till den dagliga tävlingen. Förklaringarna bor kvar i "Så funkar rebidz".

/** Guld linje-ikon i en tonad ruta (mot det gröna filtet). */
function ModeIcon({ icon, liten = false }: { icon: string; liten?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-xl bg-emerald-50/10 text-gold-300 ${liten ? 'h-9 w-9' : 'h-10 w-10'}`}
    >
      {MODE_ICONS[icon]}
    </span>
  )
}

/** Gruppens rubrik: liten, guld, vänsterställd över sin panel. */
function GruppRubrik({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 px-1 text-left text-sm font-semibold text-gold-200">
      {children}
    </h2>
  )
}

const RAD =
  'focus-ring group flex select-none items-center gap-3 px-4 py-3 text-left transition-colors [-webkit-touch-callout:none] hover:bg-emerald-950/30 active:bg-emerald-950/40'
const PIL = 'ml-auto flex shrink-0 items-center gap-0.5 text-sm'

/** Liten högerpil för rader som leder vidare. */
function Pil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M9 6 L 15 12 L 9 18" />
    </svg>
  )
}

/** En tävlingsrad (Beslut B etapp 2 · Dagens IMP 2026-09-26 · stjärntävlingen
 *  2026-11-11). Raden visar VAR MAN STÅR, räknat ur enhetens sparade framsteg
 *  utan nätverksanrop (UI/UX-punkt 2, 2026-11-12): påbörjad → mätare och
 *  guldknappen "Fortsätt", klar → bock och "Resultat", annars "Spela".
 *  Raderna ligger ALLTID i samma ordning — bara guldknappen flyttar sig. */
function TavlingRad({
  to,
  form,
  titel,
  ikon,
  server,
}: {
  to: string
  form: TavlingsForm
  titel: string
  ikon: string
  server: MittLage | null
}) {
  const { signedIn } = useAuth()
  // Utloggad: aldrig ett gammalt kontos framsteg på en delad enhet.
  // Det lokala visas direkt; serverns besked (alla enheter) rättar raden när
  // det kommer (ägarbeslut 2026-11-22: läget följer kontot, inte enheten).
  const status = tavlingsStatus(
    form,
    signedIn ? loadTavlingFramsteg(form) : null,
    new Date(),
    signedIn ? server?.[form] : undefined,
  )
  return (
    <Link to={to} className={RAD} data-testid={`tavling-rad-${form}`}>
      <ModeIcon icon={status.lage === 'klar' ? 'check' : ikon} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-emerald-50">{titel}</div>
        {/* Klar: bocken i ikonrutan säger det (ägarbeslut 2026-11-22: "räcker
            med symbolen"). Texten finns kvar för skärmläsare. */}
        {status.lage === 'klar' ? (
          <span className="sr-only">Klar</span>
        ) : (
          <div className="text-sm text-emerald-100/90">{status.text}</div>
        )}
        {status.lage === 'pagar' && (
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-950/60"
            role="progressbar"
            aria-label={`${titel}: ${status.text}`}
            aria-valuemin={0}
            aria-valuemax={12}
            aria-valuenow={status.antal}
          >
            <div className="h-full rounded-full bg-gold-400" style={{ width: `${(status.antal / 12) * 100}%` }} />
          </div>
        )}
      </div>
      {status.lage === 'pagar' ? (
        <span className="ml-auto shrink-0 rounded-lg bg-gold-400 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition-colors group-hover:bg-gold-300">
          Fortsätt
        </span>
      ) : (
        <span className={`${PIL} text-gold-100`}>
          {status.lage === 'klar' ? 'Resultat' : 'Spela'}
          <Pil />
        </span>
      )}
    </Link>
  )
}

/** En vanlig rad i en panel (Spela med vänner, Budsystem). */
function LankRad({ to, icon, title }: { to: string; icon: string; title: string }) {
  return (
    <Link to={to} className={RAD}>
      <ModeIcon icon={icon} liten />
      <span className="font-medium text-emerald-50">{title}</span>
      <span className={`${PIL} text-emerald-100/80`}>
        <Pil />
      </span>
    </Link>
  )
}

/** En träningsbricka: ikon över namn, tre i bredd även på telefon. */
function Bricka({ to, icon, title }: { to: string; icon: string; title: string }) {
  return (
    <Link
      to={to}
      className="focus-ring gold-frame-hover relative flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-950/30 px-1 py-3.5 text-center ring-1 ring-emerald-50/10 select-none transition-[transform,background-color] duration-150 ease-out [-webkit-touch-callout:none] hover:-translate-y-0.5 hover:bg-emerald-950/45 active:scale-[0.97]"
    >
      <span aria-hidden className="text-gold-300">
        {MODE_ICONS[icon]}
      </span>
      <span className="text-sm font-medium text-emerald-50">{title}</span>
    </Link>
  )
}

/** Guldstjärnan som flankerar veckans stjärna. */
function Stjarna() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-gold-300" aria-hidden>
      <path d="M12 2.6 L 14.8 8.6 L 21.3 9.4 L 16.5 13.9 L 17.8 20.4 L 12 17.2 L 6.2 20.4 L 7.5 13.9 L 2.7 9.4 L 9.2 8.6 Z" />
    </svg>
  )
}

/** Veckans stjärna i SIDHUVUDET (ägarbeslut 2026-11-12, flyttad hit 2026-11-22:
 *  "skall visas till varje pris"). Vinnaren av FÖRRA veckans stjärntävling bär
 *  titeln måndag–söndag; raden under säger vilken vecka segern gällde, så titeln
 *  inte läses som den pågående veckans ledare. Stjärna före och efter namnet
 *  (ägarönskemål). Guldlinjerna på sidorna tar bredden som blir över, så ett
 *  långt namn (högst tio tecken enligt namnregeln) ryms; `truncate` är bara en
 *  spärr om den regeln ändras. Höjden är FAST så sidan inte hoppar när svaret
 *  kommer. */
function Stjarnhuvud() {
  const [stjarna, setStjarna] = useState<VeckansStjarna | null>(null)
  useEffect(() => {
    let lever = true
    void fetchVeckansStjarna().then((s) => {
      if (lever) setStjarna(s)
    })
    return () => {
      lever = false
    }
  }, [])
  return (
    <div className="flex h-[4.25rem] w-full max-w-xl items-center gap-3" data-testid="veckans-stjarna">
      <span aria-hidden className="h-px min-w-4 flex-1 bg-gold-400/40" />
      <div className="min-w-0 text-center">
        <div className="text-xs text-emerald-100">Veckans stjärna</div>
        {stjarna ? (
          <>
            <div className="flex items-center justify-center gap-2 font-brand text-xl text-gold-100">
              <Stjarna />
              <span className="truncate">{stjarna.namn}</span>
              <Stjarna />
            </div>
            <div className="text-xs text-gold-200">
              {stjarna.nummer > 0 && `vann vecka ${guldVecka(stjarna.nummer)} · `}
              {talText(stjarna.snitt, 'guld', 1)}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1 text-sm text-gold-100">
            <Stjarna />
            <span>Koras på måndag</span>
            <Stjarna />
          </div>
        )}
      </div>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-gold-400/40" />
    </div>
  )
}

/** Textlänk på filtet. Tryckytan är 44 px hög (py + negativ marginal lämnar
 *  radhöjden orörd) och länken bryts aldrig mitt i ("Skapa / konto"). */
const TEXTLANK =
  'inline-block whitespace-nowrap py-3.5 -my-3.5 font-semibold text-gold-200 underline underline-offset-2 hover:text-gold-100'

const PANEL = 'overflow-hidden rounded-2xl divide-y divide-emerald-50/10'

export function Home() {
  const { loading, signedIn } = useAuth()
  // Mitt läge från servern: ETT anrop för alla tre tävlingarna, bara inloggad.
  const [mittLage, setMittLage] = useState<MittLage | null>(null)
  useEffect(() => {
    if (!signedIn) {
      setMittLage(null)
      return
    }
    let lever = true
    void fetchMittLage().then((l) => {
      if (lever) setMittLage(l)
    })
    return () => {
      lever = false
    }
  }, [signedIn])
  return (
    // ETT samlat grönt hero. Avboxat (frameless, mjuk kant via felt-melt) med luft.
    <Felt
      rounded="rounded-[2.75rem]"
      className="felt-melt border-transparent px-4 py-7 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.5)] sm:px-10 sm:py-16"
    >
      {/* Svag stor spader-vattenstämpel bakom = öppen grön yta (base44-idén). */}
      <BrandMark
        bare
        className="pointer-events-none absolute left-1/2 top-28 h-72 w-72 -translate-x-1/2 opacity-[0.07] sm:top-48"
      />
      <div className="relative flex flex-col items-center gap-4 text-center text-emerald-50 sm:gap-5">
        {/* Varumärkesblocket: spader + ordmärke. Taglinen "Träna, spela, tävla"
            (2026-08-02) utgick 2026-11-22 — grupprubrikerna säger samma sak,
            och platsen under ordmärket är veckans stjärnas. */}
        <BrandMark bare className="h-10 w-10 drop-shadow-md sm:h-14 sm:w-14" />
        <h1 className="-mt-2 text-5xl sm:text-6xl">
          <Wordmark />
        </h1>
        <Stjarnhuvud />

        {/* TÄVLA — flaggskeppen i EN guldramad panel. Ordningen är fast:
            MP%, IMP, stjärntävlingen. */}
        <section className="w-full max-w-xl" aria-labelledby="grupp-tavla">
          <GruppRubrik id="grupp-tavla">Tävla</GruppRubrik>
          <div className="gold-frame relative rounded-2xl bg-emerald-950/45 ring-1 ring-gold-400/25">
            <div className={PANEL}>
              <TavlingRad to="/spela-kort/tavling" form="mp" titel="Dagens MP%" ikon="calendar" server={mittLage} />
              <TavlingRad to="/spela-kort/tavling?form=imp" form="imp" titel="Dagens IMP" ikon="calendar" server={mittLage} />
              <TavlingRad to="/spela-kort/tavling?form=guld" form="guld" titel="Veckans stjärntävling" ikon="star" server={mittLage} />
            </div>
          </div>
          {/* Utloggad: EN rad om kontot. Visas först när inloggningsläget är
              känt, så den inte blinkar. */}
          {!loading && !signedIn && (
            <p className="mt-3 text-sm text-emerald-100">
              Tävlingarna kräver ett gratis konto.{' '}
              <Link to="/registrera" className={TEXTLANK}>
                Skapa konto
              </Link>
              {' · '}
              <Link to="/logga-in" className={TEXTLANK}>
                Logga in
              </Link>
            </p>
          )}
        </section>

        {/* TRÄNA — tre brickor i bredd. */}
        <section className="w-full max-w-xl" aria-labelledby="grupp-trana">
          <GruppRubrik id="grupp-trana">Träna</GruppRubrik>
          <div className="grid grid-cols-3 gap-2.5">
            <Bricka to="/spela-kort" icon="cards" title="Spela kort" />
            <Bricka to="/budtraning" icon="target" title="Budträning" />
            <Bricka to="/budvisning" icon="eye" title="Budvisning" />
          </div>
          {/* Det som varken är tävling eller träning. */}
          <div className="mt-2.5 rounded-2xl bg-emerald-950/30 ring-1 ring-emerald-50/10">
            <div className={PANEL}>
              <LankRad to="/spela-med-vanner" icon="friends" title="Spela med vänner" />
              <LankRad to="/budsystem" icon="book" title="Budsystem" />
            </div>
          </div>
        </section>

        {/* Vägen in för nya ögon (Etapp D) och användarnas röst (nästa nivå
            etapp 1, 2026-11-11): en diskret rad underst. Samma Tyck till-dialog
            nås från sidfoten på alla sidor. */}
        <p className="text-sm text-emerald-100">
          <Link to="/om" className={TEXTLANK}>
            Så funkar rebidz
          </Link>
          {' · '}
          <Link to="/sa-bjuder-rebidz" className={TEXTLANK}>
            Så bjuder datorn
          </Link>
          {' · '}
          <TyckTillKnapp className={TEXTLANK}>
            Tyck till
          </TyckTillKnapp>
        </p>
      </div>
    </Felt>
  )
}
