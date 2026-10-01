import { handleRequest } from '../../../../lib/api.ts'
import { searchFanzaMovies } from '../../../../providers/fanza.ts'

export function GET(request: Request) {
  return handleRequest(
    request,
    async query => Response.json(await searchFanzaMovies(query.q, query.page)),
    { page: '1' },
    ['q']
  )
}
