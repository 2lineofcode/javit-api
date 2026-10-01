import { handleRequest } from '../../../../lib/api.ts'
import { getR18Movie } from '../../../../providers/r18.ts'

export function GET(request: Request) {
  return handleRequest(request, async query => Response.json(await getR18Movie(query.code)), {}, [
    'code',
  ])
}
