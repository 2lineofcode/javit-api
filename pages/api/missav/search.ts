import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchText, readQuery, sendError } from '../../../src/api'
import { parseSearch } from '../../../src/provider-parser'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = readQuery(req, res, { page: '1', lang: 'id' }, ['q'])
  if (!query) return
  try {
    const html = await fetchText(
      `https://missav.ws/en/search/${encodeURIComponent(query.q)}?page=${query.page}`
    )
    const parsed = parseSearch(html)
    res.status(200).json({
      code: 200,
      server_time: Date.now(),
      page: Number(query.page),
      total: parsed.result.length,
      ...parsed,
    })
  } catch (error) {
    sendError(res, error)
  }
}
