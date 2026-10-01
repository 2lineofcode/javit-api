import { handleRequest } from '../../../lib/api.ts'
import { searchActresses } from '../../../providers/dmm.ts'

export function GET(request: Request) {
  return handleRequest(
    request,
    async query => Response.json(await searchActresses(query.q, query.page, query.perPage)),
    { page: '1', perPage: '100' },
    ['q']
  )
}
