import { handleRequest } from '../../../../lib/api.ts'
import { getMovie } from '../../../../providers/catalog.ts'

export function GET(request: Request) {
  return handleRequest(
    request,
    async query => Response.json(await getMovie('njav', query.code, query.lang)),
    { lang: 'id' },
    ['code']
  )
}
