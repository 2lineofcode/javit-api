import { NextApiRequest, NextApiResponse } from 'next'
import { MovieModel } from '../../../models/movie_model'
import { ActorModel } from '../../../models/actor_model'
import utils from '../../../src/utils'
import { ApiError, readQuery, sendError } from '../../../src/api'
import axios from 'axios'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = readQuery(req, res, {}, ['code'])
  if (!query) return
  const { code } = query

  try {
    const __r18 = await utils.r18prefix(code)
    const prefixCode = __r18?.['content_id']
    if (typeof prefixCode !== 'string' || !prefixCode) throw new ApiError(404, 'Video not found')
    const response = (
      await axios.get(
        `https://r18.dev/videos/vod/movies/detail/-/combined=${encodeURIComponent(prefixCode)}/json`,
        { timeout: 15000, maxContentLength: 2 * 1024 * 1024 }
      )
    ).data
    if (
      !Array.isArray(response?.actresses) ||
      !Array.isArray(response?.gallery) ||
      !Array.isArray(__r18?.categories)
    ) {
      throw new ApiError(502, 'Provider returned unexpected movie data')
    }
    const actorList: ActorModel[] = []
    for (const actor of response['actresses']) {
      actorList.push({
        cast_id: actor['id'],
        cast_names: actor['name_romaji'],
        cast_image: `https://pics.dmm.co.jp/mono/actjpgs/${actor['image_url']}`,
      })
    }

    const genreList: string[] = []
    for (const genre of __r18['categories']) {
      genreList.push(genre['name'])
    }

    const ssList: string[] = []
    for (const ss of response['gallery']) {
      ssList.push(ss['image_full'])
    }

    /// * [OUTPUT] ------------------------------------------------------
    const movie: MovieModel = {
      video_id: prefixCode,
      video_code_id: prefixCode,
      video_code: code.toString().toUpperCase(),
      title: __r18['title'] ?? null,
      title_ja: response['title_ja'] ?? null,
      description: response['comment_en'],
      fan_art: __r18['images']?.['jacket_image']?.['large2'] ?? null,
      poster: __r18['images']?.['jacket_image']?.['large2']?.replaceAll('pl.jpg', 'ps.jpg') ?? null,
      trailer: __r18['sample']?.['high'] ?? null,
      actors: actorList,
      genre: genreList,
      release_date: __r18['release_date'] ?? null,
      release_date_formated: __r18['release_date']
        ? utils.toDateFormat(__r18['release_date'])
        : null,
      duration: __r18['runtime_minutes'] ?? null,
      duration_formated: utils.toDurationFormat(__r18['runtime_minutes']) ?? null,
      studio: __r18['maker']?.['name'] ?? null,
      label: __r18['label']?.['name'] ?? null,
      director: __r18['director'] ?? null,
      series: __r18['series']?.['name'] ?? null,
      screenshot: ssList,
      view_count: null,
      score: null,
    }
    res.status(200).json(movie)
  } catch (error) {
    sendError(res, error)
  }
}
