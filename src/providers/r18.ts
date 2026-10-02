import axios from 'axios'
import { ApiError } from '../lib/api.ts'
import * as utils from '../lib/utils.ts'
import type { MovieModel } from './movie.ts'
import { upstreamOptions } from './http.ts'

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

export function parseR18(prefix: unknown, combined: unknown, code: string): MovieModel {
  const source = record(prefix)
  const detail = record(combined)
  const id = text(source.content_id)
  if (!id) throw new ApiError(404, 'Video not found')
  if (
    !Array.isArray(detail.actresses) ||
    !Array.isArray(detail.gallery) ||
    !Array.isArray(source.categories)
  ) {
    throw new ApiError(502, 'Provider returned unexpected movie data')
  }
  const cover = text(record(record(source.images).jacket_image).large2)
  const release = text(source.release_date)
  const duration =
    typeof source.runtime_minutes === 'number' &&
    Number.isFinite(source.runtime_minutes) &&
    source.runtime_minutes >= 0
      ? source.runtime_minutes
      : null
  return {
    video_id: id,
    video_code_id: id,
    video_code: code.toUpperCase(),
    title: text(source.title),
    title_ja: text(detail.title_ja),
    description: text(detail.comment_en),
    fan_art: cover,
    poster: cover?.replaceAll('pl.jpg', 'ps.jpg') ?? null,
    trailer: text(record(source.sample).high),
    actors: detail.actresses.map(value => {
      const actor = record(value)
      if (
        (typeof actor.id !== 'string' && typeof actor.id !== 'number') ||
        typeof actor.name_romaji !== 'string' ||
        typeof actor.image_url !== 'string'
      )
        throw new ApiError(502, 'Provider returned unexpected actress data')
      return {
        cast_id: actor.id,
        cast_names: actor.name_romaji,
        cast_image: `https://pics.dmm.co.jp/mono/actjpgs/${actor.image_url}`,
      }
    }),
    genre: source.categories.map(value => {
      const name = text(record(value).name)
      if (name === null) throw new ApiError(502, 'Provider returned unexpected genre data')
      return name
    }),
    release_date: release,
    release_date_formated: release ? utils.toDateFormat(release) : null,
    duration,
    duration_formated: utils.toDurationFormat(duration ?? 0),
    studio: text(record(source.maker).name),
    label: text(record(source.label).name),
    director: text(source.director),
    series: text(record(source.series).name),
    screenshot: detail.gallery.map(value => {
      const image = text(record(value).image_full)
      if (image === null) throw new ApiError(502, 'Provider returned unexpected gallery data')
      return image
    }),
    view_count: null,
    score: null,
  }
}

export async function getR18Movie(code: string) {
  const prefix = (
    await axios.get<unknown>(
      `https://r18.dev/videos/vod/movies/detail/-/dvd_id=${encodeURIComponent(code)}/json`,
      upstreamOptions
    )
  ).data
  const id = text(record(prefix).content_id)
  if (!id) throw new ApiError(404, 'Video not found')
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw new ApiError(502, 'Provider returned an invalid content ID')
  const combined = (
    await axios.get<unknown>(
      `https://r18.dev/videos/vod/movies/detail/-/combined=${encodeURIComponent(id)}/json`,
      upstreamOptions
    )
  ).data
  return parseR18(prefix, combined, code)
}
