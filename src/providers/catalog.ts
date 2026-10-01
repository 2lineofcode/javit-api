import { fetchText } from './http.ts'
import { parseMovie, parseSearch, parseRanking } from './parser.ts'

export const origins = {
  missav: 'https://missav.ws',
  njav: 'https://njavtv.com',
  r18: 'https://r18.dev',
  fanza: 'https://www.libredmm.com',
}
type ScrapedProvider = 'missav' | 'njav'

export async function getMovie(provider: ScrapedProvider, code: string, lang: string) {
  return parseMovie(
    await fetchText(`${origins[provider]}/${lang}/${encodeURIComponent(code)}`),
    code
  )
}

export async function searchMovies(
  provider: ScrapedProvider,
  q: string,
  page: string,
  lang: string
) {
  const parsed = parseSearch(
    await fetchText(`${origins[provider]}/${lang}/search/${encodeURIComponent(q)}?page=${page}`)
  )
  return {
    code: 200,
    server_time: Date.now(),
    page: Number(page),
    total: parsed.result.length,
    ...parsed,
  }
}

export async function getRanking(provider: ScrapedProvider) {
  return {
    code: 200,
    server_time: Date.now(),
    result: parseRanking(await fetchText(`${origins[provider]}/en/actresses/ranking`)),
  }
}

export function providerExamples(request: Request, provider: keyof typeof origins) {
  const base = new URL(request.url).origin
  const list = [`${base}/api/${provider}/bycode?code=EYAN-181`]
  if (provider !== 'r18') list.push(`${base}/api/${provider}/search?q=example&page=1`)
  if (provider === 'missav' || provider === 'njav') list.push(`${base}/api/${provider}/star_rank`)
  return {
    code: 200,
    server_time: Date.now(),
    examples: [{ path: `/api/${provider}`, origin: origins[provider], list }],
  }
}
