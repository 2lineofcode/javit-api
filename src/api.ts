import { fetchBrowserText } from './scraper-browser'
import axios from 'axios'
import type { NextApiRequest, NextApiResponse } from 'next'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string>
  ) {
    super(message)
  }
}

export function readQuery(
  req: NextApiRequest,
  res: NextApiResponse,
  defaults: Record<string, string> = {},
  required: string[] = []
): Record<string, string> | null {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return null
  }
  const values = { ...defaults }
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) {
      res.status(400).json({ error: `Invalid parameter: ${key}` })
      return null
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
    (values.code && !/^[a-zA-Z0-9_-]{1,100}$/.test(values.code) ? 'code' : undefined)
  if (invalid) {
    res.status(400).json({ error: `Missing or invalid parameter: ${invalid}` })
    return null
  }
  return values
}

export async function fetchText(url: string): Promise<string> {
  try {
    const response = await axios.get<string>(url, {
      responseType: 'text',
      timeout: 15000,
      maxContentLength: 2 * 1024 * 1024,
    })
    return response.data
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 403 &&
      (error.response.headers?.['cf-mitigated'] === 'challenge' ||
        String(error.response.data).includes('Just a moment'))
    ) {
      if (new URL(url).hostname === 'missav.ws') return fetchBrowserText(url)
      throw new ApiError(503, 'Provider requires browser verification', {
        code: 'PROVIDER_VERIFICATION_REQUIRED',
        provider: new URL(url).hostname,
      })
    }
    throw error
  }
}

export function sendError(res: NextApiResponse, error: unknown) {
  if (res.headersSent || res.destroyed) {
    res.destroy()
    return
  }
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
  res.status(status).json({
    ...(error instanceof ApiError ? error.details : {}),
    error:
      error instanceof ApiError
        ? error.message
        : status === 504
          ? 'Upstream request timed out'
          : status === 404
            ? 'Resource not found'
            : 'Upstream request failed',
  })
}
