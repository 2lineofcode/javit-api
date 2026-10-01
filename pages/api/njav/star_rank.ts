import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchText, readQuery, sendError } from '../../../src/api'
import { parseRanking } from '../../../src/provider-parser'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!readQuery(req, res)) return
  try {
    const html = await fetchText('https://njavtv.com/en/actresses/ranking')
    res.status(200).json({ code: 200, server_time: Date.now(), result: parseRanking(html) })
  } catch (error) {
    sendError(res, error)
  }
}
