import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import { Readable } from 'node:stream'
import { createServer } from 'node:http'
import { once } from 'node:events'
import axios from 'axios'
import { chromium } from 'playwright-core'
import { readQuery, errorResponse } from '../src/lib/api.ts'
import * as proxy from '../src/lib/media-proxy.ts'
import utils from '../src/lib/utils.ts'
import * as parser from '../src/providers/parser.ts'
import { parseFanzaMovie, parseFanzaSearch } from '../src/providers/fanza.ts'
import { GET as fanzaMovie } from '../src/app/api/fanza/bycode/route.ts'
import { GET as fanzaSearch } from '../src/app/api/fanza/search/route.ts'
import { GET as fanzaExamples } from '../src/app/api/fanza/route.ts'
import { parseR18 } from '../src/providers/r18.ts'
import { fetchText } from '../src/providers/http.ts'
import { GET as proxyHandler } from '../src/app/api/route.ts'
import { GET as actressHandler } from '../src/app/api/actress/route.ts'
import { GET as r18Handler } from '../src/app/api/r18/bycode/route.ts'
import { GET as missavMovie } from '../src/app/api/missav/bycode/route.ts'
import { GET as njavMovie } from '../src/app/api/njav/bycode/route.ts'
import { GET as missavSearch } from '../src/app/api/missav/search/route.ts'
import { GET as njavSearch } from '../src/app/api/njav/search/route.ts'
import { GET as missavRanking } from '../src/app/api/missav/star_rank/route.ts'
import { GET as njavRanking } from '../src/app/api/njav/star_rank/route.ts'
import { GET as r18Examples } from '../src/app/api/r18/route.ts'
import { GET as missavExamples } from '../src/app/api/missav/route.ts'
import { GET as njavExamples } from '../src/app/api/njav/route.ts'

function request(query = {}, headers = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry)
  }
  return new Request(`https://api.example/api?${params}`, { headers })
}
async function withAxios(get, run) {
  const replacement = mock.method(axios, 'get', get)
  try {
    await run()
  } finally {
    replacement.mock.restore()
  }
}
function withCredentials(run) {
  const saved = [process.env.DMM_API_ID, process.env.DMM_AFFILIATE_ID]
  process.env.DMM_API_ID = 'test-api'
  process.env.DMM_AFFILIATE_ID = 'test-affiliate'
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [index, key] of ['DMM_API_ID', 'DMM_AFFILIATE_ID'].entries()) {
        if (saved[index] === undefined) delete process.env[key]
        else process.env[key] = saved[index]
      }
    })
}

test('query validation rejects duplicate, unknown, unsafe and empty values', () => {
  const defaults = { page: '1', lang: 'id' }
  assert.deepEqual(readQuery(request({ q: ' test ' }), defaults, ['q']), { q: 'test', ...defaults })
  for (const query of [
    { q: ['a', 'b'] },
    { q: '' },
    { q: 'x', page: '0' },
    { q: 'x', page: '1.5' },
    { q: 'x', page: '9007199254740992' },
    { q: 'x', perPage: '101' },
    { q: 'x', lang: '../' },
    { code: '../../' },
    { q: 'x', foo: 'bar' },
    { q: '..' },
    { q: 'a'.repeat(2049) },
  ])
    assert.throws(
      () => readQuery(request(query), defaults, ['q'], ['q', 'code', 'page', 'perPage', 'lang']),
      { status: 400 }
    )
  assert.throws(() => readQuery(request({ ['__proto__']: 'x' })), { status: 400 })
})

test('all missing required parameters stop before network calls', async () => {
  await withAxios(
    () => assert.fail('unexpected upstream call'),
    async () => {
      for (const handler of [
        missavMovie,
        njavMovie,
        r18Handler,
        missavSearch,
        njavSearch,
        actressHandler,
        fanzaMovie,
        fanzaSearch,
      ]) {
        assert.equal((await handler(request())).status, 400)
      }
    }
  )
})

test('provider examples keep public URLs and disable response caching', async () => {
  for (const handler of [proxyHandler, r18Examples, missavExamples, njavExamples, fanzaExamples]) {
    const response = await handler(request())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(JSON.stringify(await response.json()), /https:\/\/api.example\/api/)
  }
})

test('movie defaults, missing resources and malformed provider pages', async () => {
  for (const handler of [missavMovie, njavMovie]) {
    await withAxios(
      async url => {
        assert.match(url, /\/id\/TEST-001$/)
        return {
          data: '<meta property="og:title" content="TEST-001 Example"><span>Code:</span><span>TEST-001</span>',
        }
      },
      async () => {
        const response = await handler(request({ code: 'TEST-001' }))
        assert.equal(response.status, 200)
        assert.equal((await response.json()).title, 'Example')
      }
    )
    for (const [data, expected] of [
      ['>404<', 404],
      ['<html>challenge</html>', 502],
    ]) {
      await withAxios(
        async () => ({ data }),
        async () => assert.equal((await handler(request({ code: 'TEST-001' }))).status, expected)
      )
    }
  }
})

test('errors preserve HTTP status without disclosing credentials or upstream bodies', async () => {
  for (const [code, status, expected] of [
    ['ERR_BAD_RESPONSE', 403, 502],
    ['ECONNABORTED', undefined, 504],
    ['ETIMEDOUT', undefined, 504],
    ['ERR_BAD_RESPONSE', 404, 404],
  ]) {
    await withAxios(
      async () => {
        throw new axios.AxiosError('secret', code, { url: 'secret' }, undefined, {
          status,
          data: 'secret',
        })
      },
      async () => {
        for (const handler of [missavSearch, njavSearch]) {
          const response = await handler(request({ q: 'test' }))
          assert.equal(response.status, expected)
          assert.doesNotMatch(await response.text(), /secret/)
        }
      }
    )
  }
  assert.equal(errorResponse(new Error('secret')).status, 502)
})

test('search encodes text, applies page one and preserves language behavior', async () => {
  await withAxios(
    async url => {
      assert.match(url, /\/search\/a%2Fb%3F%26\?page=1$/)
      assert.match(url, /\/(en|id)\/search\//)
      return { data: '<html>No results</html>' }
    },
    async () => {
      for (const handler of [missavSearch, njavSearch]) {
        const response = await handler(request({ q: 'a/b?&' }))
        assert.equal(response.status, 200)
        assert.equal((await response.json()).page, 1)
      }
    }
  )
})

test('proxy rejects untrusted hosts, protocols, addresses and ambiguous modes', async () => {
  await withAxios(
    () => assert.fail('unexpected upstream call'),
    async () => {
      for (const query of [
        { foo: 'bar' },
        { site: 'https://r18.dev', video: 'https://r18.dev' },
        ...[
          'http://127.0.0.1',
          'https://127.0.0.1',
          'https://[::1]',
          'https://r18.dev.evil.example',
          'https://r18.dev:8443',
          'https://user:pass@r18.dev',
          'https://evil.example',
          'file:///etc/passwd',
        ].flatMap(url => ['site', 'image', 'video'].map(mode => ({ [mode]: url }))),
      ])
        assert.equal((await proxyHandler(request(query))).status, 400)
    }
  )
  for (const ip of [
    '127.0.0.1',
    '127.0.0.2',
    '10.1.1.1',
    '169.254.169.254',
    '172.16.1.1',
    '192.168.1.1',
    '100.64.1.1',
    '0.0.0.0',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    '2001:db8::1',
    '2002:7f00:1::1',
    '192.88.99.1',
    '3fff::1',
  ])
    assert.equal(proxy.isPublicAddress(ip), false, ip)
  assert.equal(proxy.isPublicAddress('8.8.8.8'), true)
  assert.equal(proxy.isPublicAddress('2606:4700:4700::1111'), true)
})

test('redirects and DNS cannot bypass proxy restrictions', async () => {
  let calls = 0
  await withAxios(
    async () => {
      calls++
      return { status: 302, headers: { location: 'https://127.0.0.1/' } }
    },
    async () => {
      await assert.rejects(proxy.proxyRequest('https://r18.dev', 'text'), { status: 400 })
      assert.equal(calls, 1)
    }
  )
  await withAxios(
    async (_url, options) => {
      assert.equal(options.proxy, false)
      await new Promise((resolve, reject) =>
        options.httpsAgent.options.lookup('localhost', {}, error =>
          error ? reject(error) : resolve()
        )
      )
    },
    async () => await assert.rejects(proxy.proxyRequest('https://r18.dev', 'text'), { status: 400 })
  )
})

test('proxy returns inert HTML and rejects HTML images', async () => {
  await withAxios(
    async () => ({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<script>alert(1)</script>',
    }),
    async () => {
      const response = await proxyHandler(request({ site: 'https://r18.dev' }))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8')
      assert.match(response.headers.get('content-security-policy'), /sandbox/)
      assert.match(await response.text(), /<script>/)
      assert.equal(
        (await proxyHandler(request({ image: 'https://pics.dmm.co.jp/image.jpg' }))).status,
        502
      )
    }
  )
})

test('HLS rewrites signed segments, keys, maps and nested playlists', () => {
  const source =
    '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin?token=1&sig=2"\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-STREAM-INF:BANDWIDTH=100\nchild.m3u8?token=1&sig=2\nsegment.ts?token=1&sig=2\n'
  const output = proxy.rewritePlaylist(
    source,
    new URL('https://cc3001.dmm.co.jp/video/master.m3u8')
  )
  assert.match(
    output,
    /video=https%3A%2F%2Fcc3001\.dmm\.co\.jp%2Fvideo%2Fsegment\.ts%3Ftoken%3D1%26sig%3D2/
  )
  assert.match(output, /URI="\/api\?video=/)
  assert.throws(
    () =>
      proxy.rewritePlaylist(
        '#EXTM3U\nhttp://127.0.0.1/segment.ts',
        new URL('https://r18.dev/master.m3u8')
      ),
    { status: 400 }
  )
  assert.throws(
    () => proxy.rewritePlaylist('<html>error</html>', new URL('https://r18.dev/master.m3u8')),
    { status: 502 }
  )
})

test('video streams preserve range and content headers', async () => {
  await withAxios(
    async (_url, options) => {
      assert.equal(options.headers.range, 'bytes=0-2')
      return {
        status: 206,
        headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-2/3' },
        data: Readable.from([Buffer.from('abc')]),
      }
    },
    async () => {
      const response = await proxyHandler(
        request({ video: 'https://cc3001.dmm.co.jp/video.mp4' }, { range: 'bytes=0-2' })
      )
      assert.equal(response.status, 206)
      assert.equal(response.headers.get('content-range'), 'bytes 0-2/3')
      assert.equal(await response.text(), 'abc')
    }
  )
})

test('canceling video consumption destroys upstream; upstream stream errors reach the consumer', async () => {
  const stream = new Readable({ read() {} })
  await withAxios(
    async () => ({ status: 200, headers: { 'content-type': 'video/mp4' }, data: stream }),
    async () => {
      const response = await proxyHandler(request({ video: 'https://cc3001.dmm.co.jp/video.mp4' }))
      await response.body.cancel()
      assert.equal(stream.destroyed, true)
    }
  )
  const broken = new Readable({
    read() {
      this.destroy(new Error('connection lost'))
    },
  })
  await withAxios(
    async () => ({ status: 200, headers: { 'content-type': 'video/mp4' }, data: broken }),
    async () => {
      const response = await proxyHandler(request({ video: 'https://cc3001.dmm.co.jp/video.mp4' }))
      await assert.rejects(response.text(), /connection lost/)
    }
  )
})

test('R18 typed normalization and malformed data handling', async () => {
  const source = {
    content_id: 'test001',
    title: 'Example',
    categories: [{ name: 'Drama' }],
    images: { jacket_image: { large2: 'https://pics.dmm.co.jp/pl.jpg' } },
    release_date: '2022-05-13',
    runtime_minutes: 90,
  }
  const detail = {
    actresses: [{ id: 1, name_romaji: 'Name', image_url: 'name.jpg' }],
    gallery: [{ image_full: 'image.jpg' }],
  }
  const movie = parseR18(source, detail, 'test-001')
  assert.equal(movie.video_code, 'TEST-001')
  assert.equal(movie.poster, 'https://pics.dmm.co.jp/ps.jpg')
  assert.equal(movie.duration, 90)
  assert.deepEqual(movie.genre, ['Drama'])
  assert.throws(() => parseR18(source, { ...detail, actresses: [null] }, 'test-001'), {
    status: 502,
  })
  await withAxios(
    async () => ({ data: {} }),
    async () => assert.equal((await r18Handler(request({ code: 'TEST-001' }))).status, 404)
  )
  let count = 0
  await withAxios(
    async url => {
      count++
      assert.match(url, count === 1 ? /dvd_id=TEST-001/ : /combined=test001/)
      return { data: count === 1 ? source : detail }
    },
    async () => assert.equal((await r18Handler(request({ code: 'TEST-001' }))).status, 200)
  )
  assert.equal(utils.toDateFormat('invalid'), null)
  assert.equal(utils.toDateFormat('2022-05-13'), 'May 13, 2022')
  assert.equal(utils.formatDurationToMinutes(''), 0)
  assert.equal(utils.formatDurationToMinutes('01:30:00'), 90)
  assert.equal(utils.formatDurationToMinutes('01:99:00'), 0)
  assert.equal(utils.toDurationFormat(NaN), '0 hrs 0 min')
  assert.equal(utils.fixTitle('TEST-001 &#128512;'), '😀')
})

test('DMM credentials, pagination offset and malformed results', async () => {
  await withCredentials(async () => {
    await withAxios(
      async (_url, options) => {
        assert.equal(options.params.offset, 101)
        assert.equal(options.params.hits, 100)
        assert.equal(options.params.api_id, 'test-api')
        return { data: { result: [] } }
      },
      async () =>
        assert.equal((await actressHandler(request({ q: 'test', page: '2' }))).status, 200)
    )
    await withAxios(
      () => assert.fail('unexpected upstream call'),
      async () =>
        assert.equal(
          (await actressHandler(request({ q: 'test', page: '9007199254740991' }))).status,
          400
        )
    )
    await withAxios(
      async () => ({ data: '<html>error</html>' }),
      async () => assert.equal((await actressHandler(request({ q: 'test' }))).status, 502)
    )
  })
})

test('provider HTML parsing keeps cards and metadata together', async () => {
  const movie = parser.parseMovie(
    `<meta content="TEST-001 A &amp; B" property="og:title"><meta content="125" property="og:video:duration"><meta content="https://fourhoi.com/cover.jpg" property="og:image"><span>Code:</span><span>TEST-001</span><span>Release date:</span><time>2022-05-13</time><a class="font-medium" href="/dm20/en/actresses/Name">Visible Name</a>`,
    'TEST-001'
  )
  assert.equal(movie.title, 'A & B')
  assert.equal(movie.duration, 2)
  assert.equal(movie.actors[0].cast_names, 'Visible Name')
  assert.equal(
    parser.parseMovie(
      '<meta property="og:title" content="TEST-001 Contoh"><span>Kode:</span><span>TEST-001</span><span>Judul:</span><span>日本語</span><time datetime="2022-05-13T00:00:00Z">13 Mei</time>',
      'TEST-001'
    ).release_date,
    '2022-05-13'
  )
  const parsed = parser.parseSearch(
    `<div class="thumbnail group"><img src="one.jpg"><a alt="TEST-001" class="text-secondary">TEST-001 One</a></div><div class="group thumbnail"><video data-src="two.mp4"></video><img data-src="two.jpg"><a class="text-secondary" alt="TEST-002">TEST-002 Two</a><span>01:30:00</span></div><a rel="next" href="?page=2">Next</a>`
  )
  assert.equal(parsed.result.length, 2)
  assert.equal(parsed.result[0].trailer, '')
  assert.equal(parsed.result[1].trailer, 'two.mp4')
  assert.equal(parsed.result[1].poster, 'two.jpg')
  assert.equal(parsed.result[1].duration, 90)
  assert.equal(parsed.has_next_page, true)
  const html =
    '<div class="space-y-4"><a><div><img alt="Name" src="https://fourhoi.com/actress/1-t.jpg"></div></a><div><h4>Name</h4><span>Rank #1</span></div></div>'
  assert.deepEqual(parser.parseRanking(html), [
    { name: 'Name', rank: 'Rank #1', avatar: 'https://fourhoi.com/actress/1-t.jpg' },
  ])
  await withAxios(
    async () => ({ data: html }),
    async () => {
      for (const handler of [missavRanking, njavRanking])
        assert.equal((await handler(request())).status, 200)
    }
  )
  assert.throws(() => parser.parseSearch('<title>Just a moment...</title>'), { status: 502 })
})

test('Cloudflare fallback stays restricted to MissAV and cleans up the browser', async () => {
  const saved = process.env.SCRAPER_BROWSER_URL
  process.env.SCRAPER_BROWSER_URL = 'http://trusted-browser.example'
  let contextClosed = false,
    browserClosed = false
  const browserMock = mock.method(chromium, 'connectOverCDP', async () => ({
    newContext: async () => ({
      route: async () => {},
      newPage: async () => ({
        goto: async () => ({ status: () => 200 }),
        waitForFunction: async () => {},
        content: async () => 'browser html',
      }),
      close: async () => {
        contextClosed = true
      },
    }),
    close: async () => {
      browserClosed = true
    },
  }))
  try {
    await withAxios(
      async () => {
        throw new axios.AxiosError('secret', 'ERR_BAD_RESPONSE', {}, undefined, {
          status: 403,
          headers: { 'cf-mitigated': 'challenge' },
          data: 'Just a moment',
        })
      },
      async () => {
        assert.equal(await fetchText('https://missav.ws/en/search/test'), 'browser html')
        await assert.rejects(fetchText('https://njavtv.com/en/search/test'), { status: 503 })
      }
    )
    assert.equal(contextClosed, true)
    assert.equal(browserClosed, true)
  } finally {
    browserMock.mock.restore()
    if (saved === undefined) delete process.env.SCRAPER_BROWSER_URL
    else process.env.SCRAPER_BROWSER_URL = saved
  }
})

test('unconfigured DMM returns a clear 503', async () => {
  await withCredentials(async () => {
    delete process.env.DMM_API_ID
    delete process.env.DMM_AFFILIATE_ID
    const response = await actressHandler(request({ q: 'test' }))
    assert.equal(response.status, 503)
    assert.equal((await response.json()).code, 'DMM_NOT_CONFIGURED')
  })
})

test('image and playlist responses preserve bytes, MIME type, redirect base and cancellation signal', async () => {
  await withAxios(
    async (_url, options) => {
      assert.ok(options.signal instanceof AbortSignal)
      return {
        status: 200,
        headers: { 'content-type': 'image/png' },
        data: Buffer.from([137, 80, 78, 71]),
      }
    },
    async () => {
      const response = await proxyHandler(request({ image: 'https://pics.dmm.co.jp/image.png' }))
      assert.equal(response.headers.get('content-type'), 'image/png')
      assert.deepEqual(
        new Uint8Array(await response.arrayBuffer()),
        new Uint8Array([137, 80, 78, 71])
      )
    }
  )
  let calls = 0
  await withAxios(
    async () => {
      calls++
      return calls === 1
        ? { status: 302, headers: { location: '/cdn/master.m3u8' } }
        : { status: 200, headers: {}, data: '#EXTM3U\nsegment.ts?sig=1&key=2' }
    },
    async () => {
      const response = await proxyHandler(request({ video: 'https://r18.dev/master.m3u8' }))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'application/vnd.apple.mpegurl')
      assert.match(await response.text(), /%2Fcdn%2Fsegment.ts%3Fsig%3D1%26key%3D2/)
      assert.equal(calls, 2)
    }
  )
})

test('JavMost catalog commands pass through the site proxy', async () => {
  const payload = JSON.stringify({ success: true, total: 1, result: [{ name: 'TEST-001' }] })
  await withAxios(
    async (url, options) => {
      assert.equal(new URL(url).hostname, 'www.javmost.ws')
      assert.equal(options.responseType, 'text')
      return { status: 200, headers: {}, data: payload }
    },
    async () => {
      for (const path of [
        'new/1/release',
        'none/1/topmonth',
        'none/1/topweek',
        'none/1/topdaily',
        'none/1/rating',
        'TEST-001/1/search',
      ]) {
        const response = await proxyHandler(
          request({ site: `https://www.javmost.ws/showlist2/${path}/` })
        )
        assert.equal(response.status, 200)
        assert.equal(await response.text(), payload)
      }
    }
  )
  assert.throws(() => proxy.proxyUrl('https://www.javmost.ws.evil.example/showlist2/'), {
    status: 400,
  })
})

test('redirect loops terminate and administrator allowlists match exact hostnames', async () => {
  let calls = 0
  await withAxios(
    async () => {
      calls++
      return { status: 302, headers: { location: '/again' } }
    },
    async () => {
      await assert.rejects(proxy.proxyRequest('https://r18.dev', 'text'), { status: 502 })
      assert.equal(calls, 4)
    }
  )
  const saved = process.env.PROXY_ALLOWED_HOSTS
  process.env.PROXY_ALLOWED_HOSTS = 'cdn.example.com'
  try {
    assert.equal(proxy.proxyUrl('https://cdn.example.com/video.mp4').hostname, 'cdn.example.com')
    assert.throws(() => proxy.proxyUrl('https://cdn.example.com.evil.example/video.mp4'), {
      status: 400,
    })
    assert.throws(() => proxy.proxyUrl('https://sub.cdn.example.com/video.mp4'), { status: 400 })
  } finally {
    if (saved === undefined) delete process.env.PROXY_ALLOWED_HOSTS
    else process.env.PROXY_ALLOWED_HOSTS = saved
  }
})

test('video larger than metadata limits is streamed completely without a size cap', async () => {
  const bytes = Buffer.alloc(3 * 1024 * 1024, 42)
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'video/mp4' })
    res.end(bytes)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const originalGet = axios.get
  try {
    // Real Axios transport exercises its streaming size limit; only the test URL is replaced.
    await withAxios(
      async (_url, options) => {
        assert.equal(options.maxContentLength, -1)
        return originalGet(`http://127.0.0.1:${server.address().port}`, options)
      },
      async () => {
        const response = await proxyHandler(request({ video: 'https://r18.dev/video.mp4' }))
        assert.equal((await response.arrayBuffer()).byteLength, bytes.length)
      }
    )
  } finally {
    await new Promise((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    )
  }
  for (const [mode, limit] of [
    ['site', 2 * 1024 * 1024],
    ['image', 10 * 1024 * 1024],
  ]) {
    await withAxios(
      async (_url, options) => {
        assert.equal(options.maxContentLength, limit)
        return {
          status: 200,
          headers: { 'content-type': mode === 'image' ? 'image/png' : 'text/plain' },
          data: mode === 'image' ? Buffer.from('image') : 'text',
        }
      },
      async () =>
        assert.equal((await proxyHandler(request({ [mode]: 'https://r18.dev/file' }))).status, 200)
    )
  }
})

test('unsatisfiable video ranges preserve 416 and release the upstream error stream', async () => {
  const stream = Readable.from(['upstream error details'])
  await withAxios(
    async (_url, options) => {
      assert.equal(options.validateStatus(416), true)
      assert.equal(options.validateStatus(403), false)
      return {
        status: 416,
        headers: { 'content-type': 'text/html', 'content-range': 'bytes */100' },
        data: stream,
      }
    },
    async () => {
      const response = await proxyHandler(
        request({ video: 'https://r18.dev/video.mp4' }, { range: 'bytes=200-' })
      )
      assert.equal(response.status, 416)
      assert.equal(response.headers.get('content-range'), 'bytes */100')
      assert.equal(await response.text(), '')
      assert.equal(stream.destroyed, true)
    }
  )
})

test('empty upstream responses do not produce forbidden Response bodies', async () => {
  for (const status of [204, 205]) {
    await withAxios(
      async () => ({ status, headers: {}, data: '' }),
      async () => {
        const response = await proxyHandler(request({ site: 'https://r18.dev' }))
        assert.equal(response.status, status)
        assert.equal(await response.text(), '')
      }
    )
    const stream = Readable.from([])
    await withAxios(
      async () => ({ status, headers: {}, data: stream }),
      async () => {
        const response = await proxyHandler(request({ video: 'https://r18.dev/video.mp4' }))
        assert.equal(response.status, status)
        assert.equal(stream.destroyed, true)
      }
    )
  }
})

const fanzaHtml = `<main>
  <button data-clipboard-text="TEST-001"><h1><span>TEST-001</span><span>サンプル &amp; Example</span></h1></button>
  <div class="row"><div class="col-md-8"><img src="https://pics.dmm.co.jp/cover.jpg"></div>
  <div class="col-md-4"><dl>
    <dt>Thumbnail Image</dt><dd><img src="https://pics.dmm.co.jp/poster.jpg"></dd>
    <dt>Release Date</dt><dd>2026-01-02</dd>
    <dt>Directors</dt><dd><ul><li>Director</li></ul></dd>
    <dt>Genres</dt><dd><ul><li>Genre A</li><li>Genre B</li></ul></dd>
    <dt>Labels</dt><dd><ul><li>Label</li></ul></dd>
    <dt>Makers</dt><dd><ul><li>Studio</li></ul></dd>
    <dt>Volume</dt><dd>120 minutes</dd><dt>User Rating</dt><dd>6.6</dd>
  </dl></div></div>
  <dl><dt>Description</dt><dd>A &amp; B</dd>
    <dt>Actresses</dt><dd><div class="movies"><div class="card actress">
      <a href="/actresses/123"><img src="http://pics.dmm.co.jp/actor.jpg"></a>
      <h6 class="card-title"><a href="/actresses/123">Actor Name</a></h6></div><div class="card"></div></div></dd>
    <dt>Sample Images</dt><dd><div id="sample-images"><a href="https://pics.dmm.co.jp/sample.jpg"><img src="sample.jpg"></a></div></dd>
  </dl>
</main>`
const fanzaSearchHtml = `<main><form id="search" action="/movies"></form>
  <div class="movies card-group"><div class="card"><a href="/movies/TEST-001"><img src="https://pics.dmm.co.jp/poster.jpg"></a>
    <div class="card-body"><a class="card-title" href="/movies/TEST-001"><h5>TEST-001</h5><h6>サンプル &amp; Example</h6></a></div></div><div class="card"></div></div>
  <a rel="next" href="/movies?q=TEST&page=2">Next</a>
</main>`

test('Fanza parses definition lists, artwork, cast, and source-language metadata', () => {
  const movie = parseFanzaMovie(fanzaHtml)
  assert.equal(movie.video_code, 'TEST-001')
  assert.equal(movie.title, 'サンプル & Example')
  assert.equal(movie.title_ja, movie.title)
  assert.equal(movie.description, 'A & B')
  assert.equal(movie.duration, 120)
  assert.equal(movie.release_date, '2026-01-02')
  assert.equal(movie.release_date_formated, 'Jan 02, 2026')
  assert.equal(movie.studio, 'Studio')
  assert.equal(movie.label, 'Label')
  assert.equal(movie.director, 'Director')
  assert.equal(movie.score, 6.6)
  assert.deepEqual(movie.genre, ['Genre A', 'Genre B'])
  assert.deepEqual(movie.actors, [
    { cast_id: '123', cast_names: 'Actor Name', cast_image: 'https://pics.dmm.co.jp/actor.jpg' },
  ])
  assert.deepEqual(movie.screenshot, ['https://pics.dmm.co.jp/sample.jpg'])
  assert.equal(movie.trailer, null)
  const minimal = parseFanzaMovie(
    '<main><button data-clipboard-text="TEST-001"><h1><span>TEST-001</span><span>Example</span></h1></button></main>'
  )
  assert.equal(minimal.duration, null)
  assert.equal(minimal.poster, null)
  assert.equal(minimal.release_date, null)
  assert.equal(minimal.score, null)
  assert.deepEqual(minimal.actors, [])
  assert.throws(() => parseFanzaMovie('<title>Just a moment</title>'), { status: 502 })
  assert.throws(() => parseFanzaMovie('<main><h1>Not found <small>yet</small></h1></main>'), {
    status: 404,
  })
})

test('Fanza catalog parsing skips padded cards, preserves pagination and detects invalid pages', () => {
  const parsed = parseFanzaSearch(fanzaSearchHtml)
  assert.equal(parsed.result.length, 1)
  assert.equal(parsed.result[0].video_code, 'TEST-001')
  assert.equal(parsed.result[0].title, 'サンプル & Example')
  assert.equal(parsed.has_next_page, true)
  assert.deepEqual(parseFanzaSearch('<main><form id="search" action="/movies"></form></main>'), {
    result: [],
    has_next_page: false,
  })
  assert.throws(() => parseFanzaSearch('<title>Just a moment</title>'), { status: 502 })
  assert.throws(() => parseFanzaSearch(fanzaSearchHtml.replace('<h5>TEST-001</h5>', '<h5></h5>')), {
    status: 502,
  })
})

test('Fanza handlers use source normalization and URL-encoded catalog search', async () => {
  await withAxios(
    async url => {
      assert.equal(url, 'https://www.libredmm.com/search?q=test00001')
      return { data: fanzaHtml }
    },
    async () => {
      const response = await fanzaMovie(request({ code: 'test00001' }))
      assert.equal(response.status, 200)
      assert.equal((await response.json()).video_code, 'TEST-001')
    }
  )
  await withAxios(
    async url => {
      assert.equal(url, 'https://www.libredmm.com/movies?q=a%2Fb%3F%26&page=2')
      return { data: fanzaSearchHtml }
    },
    async () => {
      const response = await fanzaSearch(request({ q: 'a/b?&', page: '2' }))
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.page, 2)
      assert.equal(body.total, 1)
      assert.equal(body.has_next_page, true)
    }
  )
  const body = await (await fanzaExamples(request())).json()
  assert.equal(body.examples[0].origin, 'https://www.libredmm.com')
  assert.equal(body.examples[0].list.length, 2)
  assert.doesNotMatch(JSON.stringify(body), /star_rank/)
})

test('Fanza rejects invalid parameters and preserves controlled upstream errors', async () => {
  await withAxios(
    () => assert.fail('unexpected upstream call'),
    async () => {
      for (const query of [
        { code: '../../' },
        { code: ['TEST-001', 'TEST-002'] },
        { code: 'TEST-001', lang: 'en' },
      ])
        assert.equal((await fanzaMovie(request(query))).status, 400)
      for (const query of [
        { q: 'x', page: '0' },
        { q: 'x', lang: 'ja' },
      ])
        assert.equal((await fanzaSearch(request(query))).status, 400)
    }
  )
  for (const [code, status, expected] of [
    ['ERR_BAD_RESPONSE', 404, 404],
    ['ERR_BAD_RESPONSE', 403, 502],
    ['ECONNABORTED', undefined, 504],
  ]) {
    await withAxios(
      async () => {
        throw new axios.AxiosError('secret', code, {}, undefined, { status, data: 'secret' })
      },
      async () => {
        const response = await fanzaMovie(request({ code: 'TEST-001' }))
        assert.equal(response.status, expected)
        assert.doesNotMatch(await response.text(), /secret/)
      }
    )
  }
})
