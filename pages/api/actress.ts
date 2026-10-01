import { NextApiRequest, NextApiResponse } from 'next'
import { ApiError, readQuery, sendError } from '../../src/api'
import axios from 'axios'
import * as wanakana from 'wanakana'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = readQuery(req, res, { page: '1', perPage: '100' }, ['q'])
  if (!query) return
  const { q, page, perPage } = query

  try {
    const _url = `https://api.dmm.com/affiliate/v3/`
    const _apiId = process.env.DMM_API_ID
    const _affiliateId = process.env.DMM_AFFILIATE_ID
    if (!_apiId || !_affiliateId)
      throw new ApiError(
        503,
        'Set DMM_API_ID and DMM_AFFILIATE_ID in .env.local to enable actress search',
        { code: 'DMM_NOT_CONFIGURED' }
      )
    const hiraganaName = wanakana.toHiragana(q.toString())

    const response = await axios.get(`${_url}ActressSearch`, {
      timeout: 15000,
      maxContentLength: 2 * 1024 * 1024,
      params: {
        api_id: _apiId,
        affiliate_id: _affiliateId,
        output: 'json',
        offset: (Number(page) - 1) * Number(perPage) + 1,
        hits: Number(perPage),
        keyword: hiraganaName,
        sort: '-birthday',
      },
    })

    res.status(200).json(response.data)
  } catch (error) {
    sendError(res, error)
  }
}
