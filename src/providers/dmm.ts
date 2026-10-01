import axios from 'axios'
import { toHiragana } from 'wanakana'
import { ApiError } from '../lib/api.ts'
import { upstreamOptions } from './http.ts'

export async function searchActresses(q: string, page: string, perPage: string) {
  const apiId = process.env.DMM_API_ID
  const affiliateId = process.env.DMM_AFFILIATE_ID
  if (!apiId || !affiliateId)
    throw new ApiError(503, 'Set DMM_API_ID and DMM_AFFILIATE_ID to enable actress search', {
      code: 'DMM_NOT_CONFIGURED',
    })
  const offset = (Number(page) - 1) * Number(perPage) + 1
  if (!Number.isSafeInteger(offset)) throw new ApiError(400, 'Page offset is too large')
  const response = await axios.get<unknown>('https://api.dmm.com/affiliate/v3/ActressSearch', {
    ...upstreamOptions,
    params: {
      api_id: apiId,
      affiliate_id: affiliateId,
      output: 'json',
      offset,
      hits: Number(perPage),
      keyword: toHiragana(q),
      sort: '-birthday',
    },
  })
  if (typeof response.data !== 'object' || response.data === null || !('result' in response.data))
    throw new ApiError(502, 'Provider returned unexpected actress data')
  return response.data
}
