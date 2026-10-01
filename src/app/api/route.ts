import { Readable } from 'node:stream'
import { ApiError, handleRequest } from '../../lib/api.ts'
import { proxyRequest, proxyUrl, rewritePlaylist } from '../../lib/media-proxy.ts'
import { origins } from '../../providers/catalog.ts'

export const runtime = 'nodejs'

export function GET(request: Request) {
  return handleRequest(
    request,
    async query => {
      if (!Object.keys(query).length) {
        const base = new URL(request.url).origin
        return Response.json({
          code: 200,
          server_time: Date.now(),
          examples: [
            {
              helper: '== HELPER ==',
              list: [
                {
                  getSiteWithProxy: `${base}/api?site=https://r18.dev`,
                  getImageWithProxy: `${base}/api?image=https://pics.dmm.co.jp/digital/video/eyan00181/eyan00181jp-1.jpg`,
                  getVideoWithProxy: `${base}/api?video=https://cc3001.dmm.co.jp/litevideo/freepv/eyan/eyan00181/eyan00181_dmb_w.mp4`,
                },
              ],
            },
            ...(['r18', 'njav', 'missav', 'fanza'] as const).map(provider => ({
              provider_name: provider,
              desc:
                provider === 'fanza'
                  ? 'LibreDMM Movie Metadata & Search'
                  : provider === 'r18'
                    ? 'Fast and Accurate Data Source'
                    : 'Support Multi Language',
              api_url: `${base}/api/${provider}/`,
              site: origins[provider],
            })),
          ],
        })
      }
      const modes = Object.keys(query)
      if (modes.length !== 1)
        throw new ApiError(400, 'Provide exactly one of site, image, or video')
      const mode = modes[0]
      const target = proxyUrl(query[mode])
      const headers = new Headers({
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'",
      })
      const upstreamHeaders: Record<string, string> = {
        accept: '*/*',
        'accept-encoding': 'identity',
        origin: 'https://javtrailers.com',
        referer: 'https://javtrailers.com/',
      }
      if (mode === 'site') {
        const { response } = await proxyRequest(target.href, 'text', {}, request.signal)
        headers.set('Content-Type', 'text/plain; charset=utf-8')
        return new Response(
          response.status === 204 || response.status === 205 ? null : response.data,
          {
            status: response.status,
            headers,
          }
        )
      }
      if (mode === 'image') {
        const { response } = await proxyRequest(target.href, 'arraybuffer', {}, request.signal)
        const contentType = String(response.headers['content-type'] ?? '')
          .split(';')[0]
          .trim()
          .toLowerCase()
        if (!/^image\/(jpeg|png|gif|webp|avif|bmp|x-icon)$/.test(contentType))
          throw new ApiError(502, 'Upstream did not return a supported image')
        headers.set('Content-Type', contentType)
        return new Response(response.status === 204 ? null : new Uint8Array(response.data), {
          status: response.status,
          headers,
        })
      }
      if (target.pathname.toLowerCase().endsWith('.m3u8')) {
        const { response, url } = await proxyRequest(
          target.href,
          'text',
          upstreamHeaders,
          request.signal
        )
        headers.set('Content-Type', 'application/vnd.apple.mpegurl')
        return new Response(rewritePlaylist(response.data, url), {
          status: response.status,
          headers,
        })
      }
      const range = request.headers.get('range')
      if (range) upstreamHeaders.range = range
      const { response } = await proxyRequest(
        target.href,
        'stream',
        upstreamHeaders,
        request.signal
      )
      const stream: Readable = response.data
      if (response.status === 416) {
        stream.destroy()
        const contentRange = response.headers['content-range']
        if (typeof contentRange === 'string') headers.set('Content-Range', contentRange)
        return new Response(null, { status: 416, headers })
      }
      const contentType = String(response.headers['content-type'] ?? 'application/octet-stream')
      if (!/^(video\/|audio\/|application\/(octet-stream|mp4)(?:;|$))/i.test(contentType)) {
        stream.destroy()
        throw new ApiError(502, 'Upstream did not return video or audio data')
      }
      for (const key of [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'content-encoding',
      ]) {
        const value = response.headers[key]
        if (typeof value === 'string' || typeof value === 'number') headers.set(key, String(value))
      }
      headers.set('Content-Type', contentType)
      if (response.status === 204 || response.status === 205) {
        stream.destroy()
        return new Response(null, { status: response.status, headers })
      }
      // Cancellation and backpressure flow through Node's native stream adapter.
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
        status: response.status,
        headers,
      })
    },
    {},
    [],
    ['site', 'image', 'video']
  )
}
