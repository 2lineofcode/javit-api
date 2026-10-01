import { handleRequest } from '../../../../lib/api.ts'
import { getFanzaMovie } from '../../../../providers/fanza.ts'

export function GET(request: Request) {
  return handleRequest(request, async query => Response.json(await getFanzaMovie(query.code)), {}, [
    'code',
  ])
}
