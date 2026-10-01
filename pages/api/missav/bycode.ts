import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchText, readQuery, sendError } from '../../../src/api'
import { parseMovie } from '../../../src/provider-parser'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = readQuery(req, res, { lang: 'id' }, ['code'])
  if (!query) return
  try {
    const html = await fetchText(
      `https://missav.ws/${query.lang}/${encodeURIComponent(query.code)}`
    )
    res.status(200).json(parseMovie(html, query.code))
  } catch (error) {
    sendError(res, error)
  }
}
