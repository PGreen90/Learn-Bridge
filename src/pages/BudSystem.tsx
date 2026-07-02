import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import bookRaw from '../../docs/budsystem.md?raw'

// Sidan läser systemboken (docs/budsystem.md) direkt och visar den i utfällbara
// sektioner. Boken är sanningskällan – ändra där, så uppdateras sidan automatiskt.

type Sub = { title: string; body: string }
type Section = { title: string; intro: string; subs: Sub[] }

function stripHeading(line: string): string {
  return line.replace(/^#+\s*/, '').trim()
}

/** Delar upp boken i ##-sektioner och ###-undersektioner (preamblen släpps). */
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
        subs.push({
          title: stripHeading(snl < 0 ? sp : sp.slice(0, snl)),
          body: snl < 0 ? '' : sp.slice(snl + 1).trim(),
        })
      } else if (i === 0) {
        intro = sp.trim()
      }
    })
    sections.push({ title, intro, subs })
  }
  return sections
}

const SECTIONS = parseBook(bookRaw)

function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

export function BudSystem() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Budsystem</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Vårt 2-över-1-system i sin helhet – öppningar, svar, återbud, slam,
          försvar och markeringar. Klicka på en rubrik för att fälla ut.
        </p>
      </header>

      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <details
            key={s.title}
            className="group rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 font-semibold text-emerald-900 dark:text-emerald-200 [&::-webkit-details-marker]:hidden">
              <span>{s.title}</span>
              <span className="text-slate-400 transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-2">
              {s.intro && <Markdown>{s.intro}</Markdown>}
              {s.subs.length > 0 && (
                <div className="mt-3 space-y-2">
                  {s.subs.map((sub) => (
                    <details
                      key={sub.title}
                      className="group/sub rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
                        <span>{sub.title}</span>
                        <span className="text-slate-400 transition-transform group-open/sub:rotate-180">
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
      </div>
    </div>
  )
}
