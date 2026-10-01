import axios from 'axios'
import { lookup } from 'node:dns/promises'
import { Agent } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { ApiError } from './api.ts'

const blocked = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  blocked.addSubnet(address, prefix, 'ipv4')
blocked.addSubnet('2001::', 23, 'ipv6')
blocked.addSubnet('2001:db8::', 32, 'ipv6')
blocked.addSubnet('2002::', 16, 'ipv6')
blocked.addSubnet('3fff::', 20, 'ipv6')

export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  return family === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !blocked.check(address, 'ipv6')
}

export function proxyUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ApiError(400, 'Invalid proxy URL')
  }
  const hosts = [
    'r18.dev',
    'www.libredmm.com',
    'njavtv.com',
    'missav.live',
    'missav.ws',
    'fourhoi.com',
    'javtrailers.com',
    'pics.dmm.co.jp',
    ...(process.env.PROXY_ALLOWED_HOSTS ?? '')
      .split(',')
      .map(host => host.trim().toLowerCase())
      .filter(Boolean),
  ]
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    isIP(url.hostname) ||
    !(hosts.includes(url.hostname) || url.hostname.endsWith('.dmm.co.jp'))
  ) {
    throw new ApiError(400, 'Proxy destination is not allowed')
  }
  url.hash = ''
  return url
}

const agent = new Agent({
  lookup(hostname, options, callback) {
    lookup(hostname, { all: true })
      .then(addresses => {
        if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
          callback(new ApiError(400, 'Proxy destination resolved to a non-public address'), '')
          return
        }
        const candidates = options.family
          ? addresses.filter(({ family }) => family === options.family)
          : addresses
        if (!candidates.length) {
          callback(new Error('No address for requested IP family'), '')
        } else if (options.all) {
          callback(null, candidates)
        } else {
          callback(null, candidates[0].address, candidates[0].family)
        }
      })
      .catch((error: Error) => callback(error, ''))
  },
})

// Every redirect is checked again; the agent pins connections to validated DNS results.
export async function proxyRequest(
  value: string,
  responseType: 'text' | 'arraybuffer' | 'stream',
  headers: Record<string, string> = {},
  signal?: AbortSignal
) {
  let url = proxyUrl(value)
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await axios.get(url.href, {
      responseType,
      headers,
      signal,
      httpsAgent: agent,
      proxy: false,
      maxRedirects: 0,
      timeout: 15000,
      // Axios now enforces this cap on streams too; videos stay unbuffered and uncapped.
      maxContentLength:
        responseType === 'stream'
          ? -1
          : responseType === 'arraybuffer'
            ? 10 * 1024 * 1024
            : 2 * 1024 * 1024,
      decompress: responseType !== 'stream',
      validateStatus: status =>
        (status >= 200 && status < 400) ||
        (responseType === 'stream' && !!headers.range && status === 416),
    })
    if (response.status >= 300 && response.status < 400) {
      if (responseType === 'stream') response.data.destroy()
      const location = response.headers.location
      if (typeof location !== 'string') throw new ApiError(502, 'Invalid upstream redirect')
      url = proxyUrl(new URL(location, url).href)
      continue
    }
    return { response, url }
  }
  throw new ApiError(502, 'Too many upstream redirects')
}

export function rewritePlaylist(content: string, url: URL): string {
  if (!content.trimStart().startsWith('#EXTM3U')) throw new ApiError(502, 'Invalid HLS playlist')
  const rewrite = (uri: string) =>
    `/api?video=${encodeURIComponent(proxyUrl(new URL(uri, url).href).href)}`
  return content
    .split(/\r?\n/)
    .map(line => {
      if (!line.trim()) return line
      if (!line.startsWith('#')) return rewrite(line.trim())
      return line.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${rewrite(uri)}"`)
    })
    .join('\n')
}
