import { handleRequest } from '../../../lib/api.ts'
import { providerExamples } from '../../../providers/catalog.ts'

export function GET(request: Request) {
  return handleRequest(request, () => Response.json(providerExamples(request, 'fanza')))
}
