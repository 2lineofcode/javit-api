import { handleRequest } from '../../../../lib/api.ts'
import { searchMovies } from '../../../../providers/catalog.ts'

export function GET(request: Request) {
  return handleRequest(
    request,
    async query => Response.json(await searchMovies('njav', query.q, query.page, query.lang)),
    { page: '1', lang: 'id' },
    ['q']
  )
}
