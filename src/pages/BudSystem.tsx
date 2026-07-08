import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import bookRaw from '../../docs/budsystem.md?raw'
import { SUIT_INK } from '../lib/suitColors'
import { CHAR_SUIT, SuitText } from '../components/SuitText'

// Sidan läser systemboken (docs/budsystem.md) direkt och visar den i utfällbara
// sektioner. Boken är sanningskällan – ändra där, så uppdateras sidan automatiskt.
// Sökfältet filtrerar sektionerna på sökordet och fäller ut träffarna.

type Sub = { title: string; body: string; search: string }
type Section = { title: string; intro: string; subs: Sub[]; search: string }

function stripHeading(line: string): string {
  return line.replace(/^#+\s*/, '').trim()
}

/** Delar upp boken i ##-sektioner och ###-undersektioner (preamblen släpps).
 *  `search` = titel + text i gemener, förberäknat så sökningen blir snabb. */
function parseBook(md: string): Section[] {
  const sections: Section[] = []
  for (const part of md.split(/\n(?=## )/)) {
    if (!part.startsWith('## ')) continue
    const nl = part.indexOf('\n')
    const title = stripHeading(nl < 0 ? part : part.slice(0, nl))
    if (title.includes('Ändringslogg')) continue
    const rest = nl < 0 ? '' : part.slice(nl + 1)
    let intro = ''
    const subs: Sub[] = []
    rest.split(/\n(?=### )/).forEach((sp, i) => {
      if (sp.startsWith('### ')) {
        const snl = sp.indexOf('\n')
        const subTitle = stripHeading(snl < 0 ? sp : sp.slice(0, snl))
        const body = snl < 0 ? '' : sp.slice(snl + 1).trim()
        subs.push({ title: subTitle, body, search: `${subTitle}\n${body}`.toLowerCase() })
      } else if (i === 0) {
        intro = sp.trim()
      }
    })
    sections.push({ title, intro, subs, search: `${title}\n${intro}`.toLowerCase() })
  }
  return sections
}

const SECTIONS = parseBook(bookRaw)

// En nod i markdown-renderarens HTML-träd (hast) — bara fälten vi rör.
type HastNode = {
  type: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

/**
 * Rehype-plugin: färglägger alla ♠ ♥ ♦ ♣ i bokens text med fyrfärgsleken
 * (samma kulörer som budlådan, ägarbeslut 2026-07-03). Går igenom textnoderna
 * och sveper varje symboltecken i ett färgat <span>.
 */
function rehypeSuitColors() {
  const visit = (node: HastNode) => {
    if (!node.children) return
    node.children = node.children.flatMap((child): HastNode[] => {
      if (child.type === 'text' && child.value && /[♠♥♦♣]/.test(child.value)) {
        return child.value
          .split(/([♠♥♦♣])/)
          .filter((s) => s !== '')
          .map((s): HastNode => {
            const suit = CHAR_SUIT[s]
            if (!suit) return { type: 'text', value: s }
            return {
              type: 'element',
              tagName: 'span',
              properties: { className: [SUIT_INK[suit]] },
              children: [{ type: 'text', value: s }],
            }
          })
      }
      visit(child)
      return [child]
    })
  }
  return (tree: HastNode) => {
    visit(tree)
    return tree
  }
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSuitColors]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

/** Rubrik med första sökträffen gulmarkerad (färgsymboler alltid i fyrfärg). */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q) : -1
  if (i < 0) return <SuitText>{text}</SuitText>
  return (
    <>
      <SuitText>{text.slice(0, i)}</SuitText>
      <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-600/50 dark:text-inherit">
        <SuitText>{text.slice(i, i + q.length)}</SuitText>
      </mark>
      <SuitText>{text.slice(i + q.length)}</SuitText>
    </>
  )
}

export function BudSystem() {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // Sökning: visa sektioner där något matchar. Matchar själva sektionen
  // (rubrik/ingress) visas alla undersektioner, annars bara de som träffar.
  // Träffarna fälls ut automatiskt medan man söker.
  const visible = q
    ? SECTIONS.flatMap((s) => {
        const subs = s.subs.filter((sub) => sub.search.includes(q))
        if (subs.length === 0 && !s.search.includes(q)) return []
        return [{ ...s, subs: subs.length > 0 ? subs : s.subs }]
      })
    : SECTIONS

  const hits = q ? visible.reduce((n, s) => n + Math.max(s.subs.length, 1), 0) : 0

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Budsystem</h1>
        <p className="text-ink-soft">
          Vårt 2-över-1-system i sin helhet – öppningar, svar, återbud, slam,
          försvar och markeringar. Klicka på en rubrik för att fälla ut, eller sök.
        </p>
      </header>

      {/* Sökfältet: filtrerar sektionerna medan man skriver. */}
      <div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök i systemet, t.ex. Stayman, spärr, 1NT …"
            className="w-full rounded-xl border border-line-strong bg-control py-2.5 pl-10 pr-10 text-sm
              placeholder:text-ink-faint focus:border-emerald-500 focus:outline-none focus:ring-2
              
              "
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-ink-faint hover:bg-panel-2 hover:text-ink-soft"
              aria-label="Rensa sökningen"
            >
              ✕
            </button>
          )}
        </div>
        {q && (
          <p className="mt-1.5 px-1 text-xs text-ink-muted">
            {hits === 0
              ? 'Inga träffar – prova ett annat ord.'
              : `${hits} träff${hits === 1 ? '' : 'ar'} i ${visible.length} sektion${visible.length === 1 ? '' : 'er'}.`}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {visible.map((s) => (
          <details
            key={s.title}
            open={q ? true : undefined}
            className="group rounded-xl border border-line bg-panel shadow-sm"
          >
            <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 font-semibold text-accent-strong [&::-webkit-details-marker]:hidden">
              <span>
                <Highlight text={s.title} q={q} />
              </span>
              <span className="text-ink-faint transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="border-t border-line px-4 pb-4 pt-2">
              {s.intro && <Markdown>{s.intro}</Markdown>}
              {s.subs.length > 0 && (
                <div className="mt-3 space-y-2">
                  {s.subs.map((sub) => (
                    <details
                      key={sub.title}
                      open={q ? true : undefined}
                      className="group/sub rounded-lg border border-line bg-panel-2"
                    >
                      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-3 py-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                        <span>
                          <Highlight text={sub.title} q={q} />
                        </span>
                        <span className="text-ink-faint transition-transform group-open/sub:rotate-180">
                          ▾
                        </span>
                      </summary>
                      <div className="px-3 pb-3 pt-1">
                        <Markdown>{sub.body}</Markdown>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
        {q && visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-muted">
            Inget i systemboken matchar &quot;{query}&quot;.
          </p>
        )}
      </div>
    </div>
  )
}
