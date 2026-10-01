import { load } from 'cheerio'
import * as wanakana from 'wanakana'
import type { MovieModel } from '../models/movie_model'
import { ApiError } from './api'
import utils from './utils'

export function parseMovie(html: string, code: string): MovieModel {
  if (html.includes('>404<')) throw new ApiError(404, 'Video not found')
  const $ = load(html)
  const meta = (key: string) =>
    $(`meta[property="${key}"], meta[name="${key}"]`).attr('content') ?? ''
  const detail = (name: string) =>
    $('span')
      .filter((_, el) => $(el).text().trim() === `${name}:`)
      .first()
      .next()
      .text()
      .trim()
  const links = (section: string) => $(`a[href*="/${section}/"].font-medium`)
  const value = (section: string) => links(section).first().text().trim()
  const codeSpan = $('span.font-medium')
    .filter((_, el) => /^[A-Z0-9]+-[A-Z0-9_-]*\d[A-Z0-9_-]*$/i.test($(el).text().trim()))
    .first()
  const vidCode = detail('Code') || detail('Kode') || codeSpan.text().trim()
  if (!vidCode || !meta('og:title')) throw new ApiError(502, 'Provider returned an unexpected page')
  const fanArt = meta('twitter:image') || meta('og:image')
  const releaseDate =
    $('time[datetime]').first().attr('datetime')?.slice(0, 10) ||
    detail('Release date') ||
    detail('Tanggal rilis') ||
    null
  const duration = Math.round(Number(meta('og:video:duration') || 0) / 60)
  return {
    video_id: vidCode,
    video_code_id: vidCode,
    video_code: code.toUpperCase(),
    title: utils.fixTitle(meta('og:title')),
    title_ja:
      detail('Title') ||
      detail('Judul') ||
      codeSpan.parent().next().find('span.font-medium').first().text().trim() ||
      null,
    description: meta('og:description'),
    fan_art: fanArt,
    poster: fanArt.replace('?class=normal', '?class=thumbnail'),
    trailer: '',
    actors: links('actresses')
      .toArray()
      .map(el => {
        const name = $(el).text().trim()
        const prefix = utils.reverseName(name)?.toLowerCase().replaceAll(' ', '_')
        return {
          cast_names: name,
          cast_id: name.toLowerCase().replaceAll(' ', '_'),
          cast_image: `https://pics.dmm.co.jp/mono/actjpgs/${prefix}.jpg`,
        }
      }),
    genre: links('genres')
      .toArray()
      .map(el => $(el).text().trim()),
    release_date: releaseDate,
    release_date_formated: releaseDate ? utils.toDateFormat(releaseDate) : null,
    duration,
    duration_formated: utils.toDurationFormat(duration),
    studio: wanakana.toRomaji(value('makers')),
    label: wanakana.toRomaji(value('labels')),
    director: value('directors'),
    series: value('series'),
    screenshot: fanArt ? [fanArt] : [],
    view_count: null,
    score: null,
  }
}

export function parseSearch(html: string) {
  const $ = load(html)
  const result: MovieModel[] = []
  $('.thumbnail').each((_, el) => {
    const card = $(el)
    const link = card.find('a.text-secondary').first()
    const code = link.attr('alt') || link.attr('href')?.split('/').pop()
    if (!code || !link.text().trim()) return
    const image = card.find('img').first()
    const poster = image.attr('data-src') || image.attr('src') || ''
    const video = card.find('video').first()
    const duration = utils.formatDurationToMinutes(
      card
        .find('span')
        .filter((_, span) => /^\d+:\d{2}(:\d{2})?$/.test($(span).text().trim()))
        .first()
        .text()
        .trim()
    )
    result.push({
      video_id: code.toUpperCase(),
      video_code: code.toUpperCase(),
      title: utils
        .maxWords(utils.fixTitle(link.text().trim()), 25)
        .replaceAll(code.toUpperCase(), '')
        .trim(),
      fan_art: poster.replace('?class=thumbnail', ''),
      poster,
      trailer: video.attr('data-src') || video.attr('src') || '',
      duration,
      duration_formated: utils.toDurationFormat(duration),
    })
  })
  if (
    !result.length &&
    !/no (?:results|videos)|search result/i.test($('title').text() + $('body').text())
  ) {
    throw new ApiError(502, 'Provider returned an unexpected search page')
  }
  return { result, has_next_page: $('a[rel="next"]').length > 0 }
}

export function parseRanking(html: string) {
  const $ = load(html)
  const result: { name: string; rank: string; avatar: string }[] = []
  $('img').each((_, el) => {
    const image = $(el)
    const avatar = image.attr('data-src') || image.attr('src') || ''
    if (!avatar.includes('/actress/')) return
    const card = image.closest('div.space-y-4')
    const rank = card.text().match(/Rank\s*#\d+/)?.[0]
    const name = card.find('h4').text().trim() || image.attr('alt')
    if (name && rank) result.push({ name, rank, avatar })
  })
  if (!result.length) throw new ApiError(502, 'Provider returned an unexpected ranking page')
  return result
}
