import axios from 'axios'

export class ApiError extends Error {
  status: number
  details?: Record<string, string>

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function readQuery(
  request: Request,
  defaults: Record<string, string> = {},
  required: string[] = [],
  allowed: string[] = [...Object.keys(defaults), ...required]
): Record<string, string> {
  const values = { ...defaults }
  const params = new URL(request.url).searchParams
  for (const [key, value] of params) {
    if (
      !allowed.includes(key) ||
      params.getAll(key).length !== 1 ||
      !value.trim() ||
      value.length > 2048
    ) {
      throw new ApiError(400, `Invalid parameter: ${key}`)
    }
    values[key] = value.trim()
  }
  const invalid =
    required.find(key => !values[key]) ??
    ['page', 'perPage'].find(
      key =>
        values[key] !== undefined &&
        (!/^[1-9]\d*$/.test(values[key]) || !Number.isSafeInteger(Number(values[key])))
    ) ??
    (values.perPage && Number(values.perPage) > 100 ? 'perPage' : undefined) ??
    (values.lang && !/^(en|id|cn|ja|ko|ms|th|de|fr|vi|fil|pt)$/.test(values.lang)
      ? 'lang'
      : undefined) ??
    (values.code && !/^[a-zA-Z0-9_-]{1,100}$/.test(values.code) ? 'code' : undefined) ??
    (values.q && /^\.{1,2}$/.test(values.q) ? 'q' : undefined)
  if (invalid) throw new ApiError(400, `Missing or invalid parameter: ${invalid}`)
  return values
}

export function errorResponse(error: unknown): Response {
  const timeout =
    axios.isAxiosError(error) && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '')
  const status =
    error instanceof ApiError
      ? error.status
      : timeout
        ? 504
        : axios.isAxiosError(error) && error.response?.status === 404
          ? 404
          : 502
  if (status >= 500)
    console.error(
      'API request failed',
      error instanceof ApiError
        ? error.message
        : axios.isAxiosError(error)
          ? { code: error.code, upstreamStatus: error.response?.status }
          : 'Unexpected upstream data'
    )
  return Response.json(
    {
      ...(error instanceof ApiError ? error.details : {}),
      error:
        error instanceof ApiError
          ? error.message
          : status === 504
            ? 'Upstream request timed out'
            : status === 404
              ? 'Resource not found'
              : 'Upstream request failed',
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

// Shared boundary for every endpoint; Next.js handles unsupported HTTP methods.
export async function handleRequest(
  request: Request,
  run: (query: Record<string, string>) => Response | Promise<Response>,
  defaults: Record<string, string> = {},
  required: string[] = [],
  allowed?: string[]
): Promise<Response> {
  try {
    const response = await run(readQuery(request, defaults, required, allowed))
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
