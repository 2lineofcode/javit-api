import axios from 'axios'
import { ApiError } from '../lib/api.ts'
import { fetchBrowserText } from './browser.ts'

export const upstreamOptions = { timeout: 15000, maxContentLength: 2 * 1024 * 1024 }

export async function fetchText(url: string): Promise<string> {
  try {
    const response = await axios.get<string>(url, { ...upstreamOptions, responseType: 'text' })
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
