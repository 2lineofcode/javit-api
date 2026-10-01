import { chromium } from 'playwright-core'
import { ApiError } from '../lib/api.ts'

export async function fetchBrowserText(url: string): Promise<string> {
  // Only the provider verified with the local browser uses this fallback.
  if (new URL(url).hostname !== 'missav.ws') throw new ApiError(400, 'Unsupported browser provider')
  const remote = process.env.SCRAPER_BROWSER_URL
  if (!remote && (process.env.VERCEL || process.platform === 'linux')) {
    throw new ApiError(503, 'Configure SCRAPER_BROWSER_URL for this server', {
      code: 'BROWSER_NOT_CONFIGURED',
    })
  }
  let browser
  try {
    browser = remote
      ? await chromium.connectOverCDP(remote, { timeout: 15000 })
      : await chromium.launch({ channel: 'chrome', headless: false, timeout: 15000 })
    const context = await browser.newContext({ serviceWorkers: 'block' })
    try {
      await context.route('**/*', route => {
        const request = route.request()
        const target = new URL(request.url())
        if (
          ['image', 'media', 'font'].includes(request.resourceType()) ||
          target.protocol !== 'https:' ||
          !['missav.ws', 'challenges.cloudflare.com'].includes(target.hostname)
        ) {
          return route.abort()
        }
        return route.continue()
      })
      const page = await context.newPage()
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      if (response?.status() === 404) throw new ApiError(404, 'Resource not found')
      await page.waitForFunction(
        () =>
          !document.title.includes('Just a moment') &&
          (!!document.querySelector(
            'meta[property="og:title"], .thumbnail, img[src*="/actress/"]'
          ) ||
            /search result/i.test(document.title)),
        undefined,
        { timeout: 30000 }
      )
      const html = await page.content()
      if (Buffer.byteLength(html) > 2 * 1024 * 1024)
        throw new ApiError(502, 'Provider page is too large')
      return html
    } finally {
      await context.close()
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(503, 'Browser unavailable or provider verification still required', {
      code: 'BROWSER_PROVIDER_UNAVAILABLE',
    })
  } finally {
    await browser?.close()
  }
}
