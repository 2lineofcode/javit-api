import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { Readable, Writable } from 'node:stream'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const packageRequire = createRequire(import.meta.url)
const ts = packageRequire('typescript')
const axios = packageRequire('axios')
const directory = path.dirname(fileURLToPath(import.meta.url))

// Load handlers without starting Next.js or contacting upstream providers.
const modules = new Map()
function load(file) {
  file = path.resolve(directory, '..', file)
  if (modules.has(file)) return modules.get(file).exports
  const moduleRecord = { exports: {} }
  modules.set(file, moduleRecord)
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const localRequire = id =>
    id.startsWith('.') ? load(path.resolve(path.dirname(file), `${id}.ts`)) : packageRequire(id)
  new Function('require', 'module', 'exports', output)(
    localRequire,
    moduleRecord,
    moduleRecord.exports
  )
  return moduleRecord.exports
}
function request(query = {}, method = 'GET') {
  return { query, method, headers: { host: 'localhost' }, url: '/api' }
}
function response() {
  return {
    headers: {},
    statusCode: 200,
    headersSent: false,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      assert.equal(this.headersSent, false, 'response sent twice')
      this.body = body
      this.headersSent = true
      return this
    },
    send(body) {
      return this.json(body)
    },
    destroy() {
      this.destroyed = true
    },
  }
}
async function withAxios(get, run) {
  const original = axios.get
  axios.get = get
  try {
    await run()
  } finally {
    axios.get = original
  }
}
const api = load('src/api.ts')
const proxy = load('src/media-proxy.ts')
const utils = load('src/utils.ts').default
const proxyHandler = load('pages/api/index.ts').default

test('query defaults, methods, arrays, and unsafe values', () => {
  assert.deepEqual(
    api.readQuery(request({ q: ' test ' }), response(), { page: '1', lang: 'id' }, ['q']),
    { q: 'test', page: '1', lang: 'id' }
  )
  for (const query of [
    { q: ['a', 'b'] },
    { q: '' },
    { q: 'test', page: '0' },
    { q: 'test', page: '1.5' },
    { q: 'test', page: '9007199254740992' },
    { q: 'test', perPage: '101' },
    { q: 'test', lang: '../' },
    { q: 'test', code: '../../' },
  ]) {
    const res = response()
    assert.equal(api.readQuery(request(query), res, {}, ['q']), null)
    assert.equal(res.statusCode, 400)
  }
  const res = response()
  assert.equal(api.readQuery(request({}, 'POST'), res), null)
  assert.equal(res.statusCode, 405)
  assert.equal(res.headers.allow, 'GET')
})

test('missing query stops each search handler before an upstream call', async () => {
  await withAxios(
    () => {
      assert.fail('unexpected upstream call')
    },
    async () => {
      for (const site of ['missav', 'njav']) {
        const res = response()
        await load(`pages/api/${site}/search.ts`).default(request(), res)
        assert.equal(res.statusCode, 400)
      }
    }
  )
})

test('bycode applies default language; upstream and HTML 404 stop cleanly', async () => {
  for (const site of ['missav', 'njav']) {
    const handler = load(`pages/api/${site}/bycode.ts`).default
    await withAxios(
      async url => {
        assert.match(url, /\/id\/TEST-001$/)
        return {
          data: '<meta property="og:title" content="TEST-001 Example" /><span>Code:</span><span class="font-medium">TEST-001</span>',
        }
      },
      async () => {
        const res = response()
        await handler(request({ code: 'TEST-001' }), res)
        assert.equal(res.statusCode, 200)
        assert.equal(res.body.title, 'Example')
      }
    )
    await withAxios(
      async () => ({ data: '>404<' }),
      async () => {
        const res = response()
        await handler(request({ code: 'TEST-001' }), res)
        assert.equal(res.statusCode, 404)
      }
    )
    await withAxios(
      async () => ({ data: '<html>challenge</html>' }),
      async () => {
        const res = response()
        await handler(request({ code: 'TEST-001' }), res)
        assert.equal(res.statusCode, 502)
      }
    )
  }
})

test('upstream failure and timeout are sanitized rather than successful empty results', async () => {
  for (const [code, upstreamStatus, expected] of [
    ['ERR_BAD_RESPONSE', 403, 502],
    ['ECONNABORTED', undefined, 504],
    ['ERR_BAD_RESPONSE', 404, 404],
  ]) {
    await withAxios(
      async () => {
        throw new axios.AxiosError('secret', code, { url: 'secret' }, undefined, {
          status: upstreamStatus,
          data: 'secret',
        })
      },
      async () => {
        for (const site of ['missav', 'njav']) {
          const res = response()
          await load(`pages/api/${site}/search.ts`).default(request({ q: 'test' }), res)
          assert.equal(res.statusCode, expected)
          assert.doesNotMatch(JSON.stringify(res.body), /secret/)
        }
      }
    )
  }
})

test('search encodes query and sends page one by default', async () => {
  await withAxios(
    async url => {
      assert.match(url, /\/search\/a%2Fb%3F%26\?page=1$/)
      return { data: '<html>No results</html>' }
    },
    async () => {
      for (const site of ['missav', 'njav']) {
        const res = response()
        await load(`pages/api/${site}/search.ts`).default(request({ q: 'a/b?&' }), res)
        assert.equal(res.statusCode, 200)
        assert.equal(res.body.page, 1)
      }
    }
  )
})

test('proxy rejects private IPs, credentials, unsupported hosts and ambiguous parameters', async () => {
  await withAxios(
    () => {
      assert.fail('unexpected upstream call')
    },
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
      ]) {
        const res = response()
        await proxyHandler(request(query), res)
        assert.equal(res.statusCode, 400)
      }
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
  ])
    assert.equal(proxy.isPublicAddress(ip), false, ip)
  assert.equal(proxy.isPublicAddress('8.8.8.8'), true)
  assert.equal(proxy.isPublicAddress('2606:4700:4700::1111'), true)
})

test('redirects and DNS resolution cannot bypass proxy restrictions', async () => {
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
    async () => {
      await assert.rejects(proxy.proxyRequest('https://r18.dev', 'text'), { status: 400 })
    }
  )
})

test('proxy serves HTML as text and rejects HTML disguised as an image', async () => {
  await withAxios(
    async () => ({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<script>alert(1)</script>',
    }),
    async () => {
      const res = response()
      await proxyHandler(request({ site: 'https://r18.dev' }), res)
      assert.equal(res.statusCode, 200)
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
      assert.match(res.headers['content-security-policy'], /sandbox/)
      const image = response()
      await proxyHandler(request({ image: 'https://pics.dmm.co.jp/image.jpg' }), image)
      assert.equal(image.statusCode, 502)
    }
  )
})

test('HLS rewrites complete signed URLs, keys, maps, and master playlists', () => {
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

test('video streaming preserves range headers and completes with backpressure', async () => {
  const chunks = []
  const res = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(chunk)
      done()
    },
  })
  res.headers = {}
  res.setHeader = (key, value) => {
    res.headers[key] = value
  }
  res.status = code => {
    res.statusCode = code
    return res
  }
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
      const req = request({ video: 'https://cc3001.dmm.co.jp/video.mp4' })
      req.headers.range = 'bytes=0-2'
      await proxyHandler(req, res)
      assert.equal(res.statusCode, 206)
      assert.equal(res.headers['content-range'], 'bytes 0-2/3')
      assert.equal(Buffer.concat(chunks).toString(), 'abc')
    }
  )
})

test('malformed R18 data produces a controlled error; metadata formatting is safe', async () => {
  await withAxios(
    async () => ({ data: {} }),
    async () => {
      const res = response()
      await load('pages/api/r18/bycode.ts').default(request({ code: 'TEST-001' }), res)
      assert.equal(res.statusCode, 404)
    }
  )
  assert.equal(utils.toDateFormat('invalid'), null)
  assert.equal(utils.formatDurationToMinutes(''), 0)
  assert.equal(utils.formatDurationToMinutes('01:30:00'), 90)
  assert.equal(utils.toDurationFormat(NaN), '0 hrs 0 min')
})

test('actress defaults and page offset use environment credentials', async () => {
  const original = { api: process.env.DMM_API_ID, affiliate: process.env.DMM_AFFILIATE_ID }
  process.env.DMM_API_ID = 'test-api'
  process.env.DMM_AFFILIATE_ID = 'test-affiliate'
  try {
    await withAxios(
      async (_url, options) => {
        assert.equal(options.params.offset, 101)
        assert.equal(options.params.hits, 100)
        assert.equal(options.params.api_id, 'test-api')
        return { data: { result: [] } }
      },
      async () => {
        const res = response()
        await load('pages/api/actress.ts').default(request({ q: 'test', page: '2' }), res)
        assert.equal(res.statusCode, 200)
      }
    )
  } finally {
    for (const [key, value] of [
      ['DMM_API_ID', original.api],
      ['DMM_AFFILIATE_ID', original.affiliate],
    ]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('current provider markup keeps metadata and each search card together', () => {
  const parser = load('src/provider-parser.ts')
  const movie = parser.parseMovie(
    `<meta content="TEST-001 A &amp; B" property="og:title">
    <meta content="125" property="og:video:duration"><meta content="https://fourhoi.com/cover.jpg" property="og:image">
    <span>Code:</span><span>TEST-001</span><span>Release date:</span><time>2022-05-13</time>
    <a class="font-medium" href="/dm20/en/actresses/Name">Visible Name</a>`,
    'TEST-001'
  )
  assert.equal(movie.title, 'A & B')
  assert.equal(
    parser.parseMovie(
      '<meta property="og:title" content="TEST-001 Contoh"><span>Kode:</span><span>TEST-001</span><span>Judul:</span><span>日本語</span><time datetime="2022-05-13T00:00:00Z">13 Mei</time>',
      'TEST-001'
    ).release_date,
    '2022-05-13'
  )
  assert.equal(movie.duration, 2)
  assert.equal(movie.actors[0].cast_names, 'Visible Name')
  const parsed = parser.parseSearch(`<div class="thumbnail group"><img src="one.jpg">
    <a alt="TEST-001" class="text-secondary">TEST-001 One</a></div>
    <div class="group thumbnail"><video data-src="two.mp4"></video><img data-src="two.jpg">
    <a class="text-secondary" alt="TEST-002">TEST-002 Two</a><span>01:30:00</span></div>
    <a rel="next" href="?page=2">Next</a>`)
  assert.equal(parsed.result.length, 2)
  assert.equal(parsed.result[0].trailer, '')
  assert.equal(parsed.result[1].trailer, 'two.mp4')
  assert.equal(parsed.result[1].poster, 'two.jpg')
  assert.equal(parsed.result[1].duration, 90)
  assert.equal(parsed.has_next_page, true)
  assert.deepEqual(
    parser.parseRanking(`<div class="space-y-4"><a><div>
    <img alt="Name" src="https://fourhoi.com/actress/1-t.jpg"></div></a>
    <div><h4>Name</h4><span>Rank #1</span></div></div>`),
    [{ name: 'Name', rank: 'Rank #1', avatar: 'https://fourhoi.com/actress/1-t.jpg' }]
  )
  assert.throws(() => parser.parseSearch('<title>Just a moment...</title>'), { status: 502 })
})

test('Cloudflare fallback uses only the verified provider and errors describe missing configuration', async () => {
  const browser = load('src/scraper-browser.ts')
  const original = browser.fetchBrowserText
  browser.fetchBrowserText = async url => {
    assert.equal(new URL(url).hostname, 'missav.ws')
    return 'browser html'
  }
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
        assert.equal(await api.fetchText('https://missav.ws/en/search/test'), 'browser html')
        await assert.rejects(api.fetchText('https://njavtv.com/en/search/test'), { status: 503 })
      }
    )
    const saved = [process.env.DMM_API_ID, process.env.DMM_AFFILIATE_ID]
    delete process.env.DMM_API_ID
    delete process.env.DMM_AFFILIATE_ID
    try {
      const res = response()
      await load('pages/api/actress.ts').default(request({ q: 'test' }), res)
      assert.equal(res.statusCode, 503)
      assert.equal(res.body.code, 'DMM_NOT_CONFIGURED')
    } finally {
      for (const [index, key] of ['DMM_API_ID', 'DMM_AFFILIATE_ID'].entries()) {
        if (saved[index] === undefined) delete process.env[key]
        else process.env[key] = saved[index]
      }
    }
  } finally {
    browser.fetchBrowserText = original
  }
  assert.equal(proxy.proxyUrl('https://fourhoi.com/cover.jpg').hostname, 'fourhoi.com')
})
