import { load, type CheerioAPI } from 'cheerio'
import { ApiError } from '../lib/api.ts'
import utils from '../lib/utils.ts'
import type { MovieModel } from './movie.ts'
import { fetchText } from './http.ts'
import { origins } from './catalog.ts'

function imageUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value, origins.fanza)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    // LibreDMM still serves some DMM actress image URLs with an HTTP scheme.
    if (url.hostname.endsWith('.dmm.co.jp')) url.protocol = 'https:'
    return url.href
  } catch {
    return null
  }
}

function definition($: CheerioAPI, name: string) {
  return $('main dt')
    .filter((_, el) => $(el).text().trim() === name)
    .first()
    .next('dd')
}

export function parseFanzaMovie(html: string): MovieModel {
  const $ = load(html)
  const heading = $('main button[data-clipboard-text] h1').first()
  const code = heading.find('span').first().text().trim()
  const title = heading.find('span').eq(1).text().trim()
  if (!code || !title) {
    if (
      /^not found/i.test($('main h1').text().trim()) ||
      $('main form#search[action="/movies"]').length
    )
      throw new ApiError(404, 'Video not found')
    throw new ApiError(502, 'Provider returned an unexpected movie page')
  }
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(code))
    throw new ApiError(502, 'Provider returned an invalid movie code')
  const list = (name: string) =>
    definition($, name)
      .find('li')
      .toArray()
      .map(el => $(el).text().trim())
      .filter(Boolean)
  const release = definition($, 'Release Date').text().trim() || null
  const durationText = definition($, 'Volume')
    .text()
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s+minutes$/i)?.[1]
  const duration =
    durationText && Number.isFinite(Number(durationText)) ? Number(durationText) : null
  const ratingText = definition($, 'User Rating').text().trim()
  const score = /^\d+(?:\.\d+)?$/.test(ratingText) ? Number(ratingText) : null
  const cover = imageUrl($('main > .row > .col-md-8 > img').first().attr('src'))
  return {
    video_id: code,
    video_code_id: code,
    video_code: code,
    title,
    title_ja: title,
    title_en: null,
    description: definition($, 'Description').text().trim() || null,
    fan_art: cover,
    poster: imageUrl(definition($, 'Thumbnail Image').find('img').attr('src')),
    trailer: null,
    actors: definition($, 'Actresses')
      .find('.card.actress')
      .toArray()
      .flatMap(el => {
        const card = $(el)
        const name = card.find('.card-title').text().trim()
        const id = card.find('a[href^="/actresses/"]').attr('href')?.split('/').pop()
        if (!name || !id) return []
        return [
          {
            cast_id: id,
            cast_names: name,
            cast_image: imageUrl(card.find('img').attr('src')) ?? undefined,
          },
        ]
      }),
    genre: list('Genres'),
    release_date: release,
    release_date_formated: release ? utils.toDateFormat(release) : null,
    duration,
    duration_formated: duration === null ? null : utils.toDurationFormat(duration),
    studio: list('Makers').join(', ') || null,
    label: list('Labels').join(', ') || null,
    director: list('Directors').join(', ') || null,
    series: null,
    screenshot: $('#sample-images a')
      .toArray()
      .flatMap(el => {
        const url = imageUrl($(el).attr('href'))
        return url ? [url] : []
      }),
    score,
    view_count: null,
  }
}

export function parseFanzaSearch(html: string) {
  const $ = load(html)
  if (!$('main form#search[action="/movies"]').length)
    throw new ApiError(502, 'Provider returned an unexpected search page')
  const result: MovieModel[] = []
  $('main .movies > .card').each((_, el) => {
    const card = $(el)
    const link = card.find('a.card-title[href^="/movies/"]').first()
    if (!link.length) return // LibreDMM pads its last row with empty cards.
    const code = link.find('h5').text().trim()
    const title = link.find('h6').text().trim()
    if (!code || !title || !/^[a-zA-Z0-9_-]{1,100}$/.test(code))
      throw new ApiError(502, 'Provider returned unexpected search data')
    const poster = imageUrl(card.find('img').first().attr('src'))
    result.push({
      video_id: code,
      video_code: code,
      title,
      title_ja: title,
      poster,
      fan_art: poster,
      trailer: null,
    })
  })
  return { result, has_next_page: $('main a[rel="next"][href]').length > 0 }
}

export async function getFanzaMovie(code: string) {
  // Use the site's own normalizer, including content IDs such as eyan00181.
  return parseFanzaMovie(await fetchText(`${origins.fanza}/search?q=${encodeURIComponent(code)}`))
}

export async function searchFanzaMovies(q: string, page: string) {
  const parsed = parseFanzaSearch(
    await fetchText(`${origins.fanza}/movies?q=${encodeURIComponent(q)}&page=${page}`)
  )
  return {
    code: 200,
    server_time: Date.now(),
    page: Number(page),
    total: parsed.result.length,
    ...parsed,
  }
}
