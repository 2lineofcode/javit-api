import { handleRequest } from '../../../../lib/api.ts'
import { getRanking } from '../../../../providers/catalog.ts'

export function GET(request: Request) {
  return handleRequest(request, async () => Response.json(await getRanking('njav')), {}, [])
}
