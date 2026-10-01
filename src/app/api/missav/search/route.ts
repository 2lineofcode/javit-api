import { handleRequest } from '../../../../lib/api.ts'
import { searchMovies } from '../../../../providers/catalog.ts'

export function GET(request: Request) {
  return handleRequest(
    request,
    async query => Response.json(await searchMovies('missav', query.q, query.page, 'en')),
    { page: '1', lang: 'id' },
    ['q']
  )
}
