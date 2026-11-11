// Läs och tolka JSON-kroppen ur en Node-request med ett storlekstak (Vercel
// parsar inte åt oss). Delad variant — de äldre endpointsen har var sin lokala
// kopia (skicka-in.ts, dagens-logg.ts) som får stå orörda tills de ändå rörs.

import type { IncomingMessage } from 'node:http'

export function lasJson(req: IncomingMessage, maxTecken: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    let avbruten = false
    req.on('data', (chunk) => {
      if (avbruten) return
      data += chunk
      if (data.length > maxTecken) {
        avbruten = true
        reject(new Error('för stor kropp'))
      }
    })
    req.on('end', () => {
      if (avbruten) return
      try {
        resolve(data ? JSON.parse(data) : null)
      } catch {
        reject(new Error('ogiltig JSON'))
      }
    })
    req.on('error', reject)
  })
}
