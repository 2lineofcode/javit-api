import type { NextApiRequest, NextApiResponse } from 'next'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import utils from '../../src/utils'
import { ApiError, readQuery, sendError } from '../../src/api'
import { proxyRequest, proxyUrl, rewritePlaylist } from '../../src/media-proxy'

export const config = { api: { responseLimit: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = readQuery(req, res)
  if (!query) return
  if (Object.keys(query).length === 0) {
    const route = [
      {
        helper: '== HELPER ==',
        list: [
          {
            getSiteWithProxy: utils.baseUrl(req) + '/api?site=https://r18.dev',
            getImageWithProxy:
              utils.baseUrl(req) +
              '/api?image=https://pics.dmm.co.jp/digital/video/eyan00181/eyan00181jp-1.jpg',
            getVideoWithProxy:
              utils.baseUrl(req) +
              '/api?video=https://cc3001.dmm.co.jp/litevideo/freepv/eyan/eyan00181/eyan00181_dmb_w.mp4',
          },
        ],
      },
      {
        provider_name: 'r18',
        desc: 'Fast and Accurate Data Source',
        api_url: utils.baseUrl(req) + '/api/r18/',
        site: 'https://r18.dev',
      },
      {
        provider_name: 'njav',
        desc: 'Support Multi Language',
        api_url: utils.baseUrl(req) + '/api/njav/',
        site: 'https://njavtv.com/',
      },
      {
        provider_name: 'missav',
        desc: 'Support Multi Language',
        api_url: utils.baseUrl(req) + '/api/missav/',
        site: 'https://missav.ws/',
      },
    ]
    res.status(200).json({
      code: 200,
      server_time: Date.now(),
      examples: route,
    })
    return
  }
  const modes = ['site', 'image', 'video'].filter(key => query[key])
  if (modes.length !== 1 || Object.keys(query).length !== 1) {
    res.status(400).json({ error: 'Provide exactly one of site, image, or video' })
    return
  }
  const mode = modes[0]
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'")
  try {
    const target = proxyUrl(query[mode])
    const headers: Record<string, string> = {
      accept: '*/*',
      'accept-encoding': 'identity',
      origin: 'https://javtrailers.com',
      referer: 'https://javtrailers.com/',
    }
    if (mode === 'site') {
      const { response } = await proxyRequest(target.href, 'text')
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.status(response.status).send(response.data)
    } else if (mode === 'image') {
      const { response } = await proxyRequest(target.href, 'arraybuffer')
      const contentType = String(response.headers['content-type'] ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase()
      if (!/^image\/(jpeg|png|gif|webp|avif|bmp|x-icon)$/.test(contentType)) {
        throw new ApiError(502, 'Upstream did not return a supported image')
      }
      res.setHeader('Content-Type', contentType)
      res.status(response.status).send(Buffer.from(response.data))
    } else if (target.pathname.toLowerCase().endsWith('.m3u8')) {
      const { response, url } = await proxyRequest(target.href, 'text', headers)
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
      res.status(response.status).send(rewritePlaylist(response.data, url))
    } else {
      if (req.headers.range) headers.range = req.headers.range
      const { response } = await proxyRequest(target.href, 'stream', headers)
      const stream: Readable = response.data
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
        if (typeof value === 'string' || typeof value === 'number') res.setHeader(key, value)
      }
      res.setHeader('Content-Type', contentType)
      res.status(response.status)
      await pipeline(stream, res)
    }
  } catch (error) {
    sendError(res, error)
  }
}
