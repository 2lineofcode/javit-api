# JavIt API

Next.js 16 App Router API for metadata from R18, MissAV, NJav, Fanza (LibreDMM), and DMM.
Requires Node.js 24.12 or newer (stable native TypeScript support). The project uses Yarn 4.18.1 and `yarn.lock`;
do not generate a second dependency lockfile with npm install.

## Development

```sh
npx --yes @yarnpkg/cli-dist@4.18.1 install --immutable
cp .env.example .env.local
npm run dev
```

Open [localhost:3000/api](http://localhost:3000/api) for endpoint examples.
Fill `DMM_API_ID` and `DMM_AFFILIATE_ID` in `.env.local` to enable actress
search. Configure these same variables in Vercel for production. Credentials
previously embedded in source should be rotated with the provider.

## Endpoints

All endpoints accept GET. Next.js also supplies HEAD and OPTIONS. Repeated,
unknown, empty, and invalid query values return 400; unsupported HTTP methods
return 405. Search query text is URL-encoded before forwarding. Metadata and
proxy responses use `Cache-Control: no-store` to avoid caching provider errors.

| Endpoint                                             | Parameters                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `/api`                                               | Provider examples, or exactly one of `site`, `image`, `video`              |
| `/api/r18`, `/api/missav`, `/api/njav`, `/api/fanza` | Endpoint examples                                                          |
| `/api/r18/bycode`                                    | Required `code`                                                            |
| `/api/missav/bycode`, `/api/njav/bycode`             | Required `code`; `lang` defaults to `id`                                   |
| `/api/missav/search`                                 | Required `q`; `page` defaults to 1; language is English                    |
| `/api/njav/search`                                   | Required `q`; `page` defaults to 1; `lang` defaults to `id`                |
| `/api/missav/star_rank`, `/api/njav/star_rank`       | No parameters                                                              |
| `/api/actress`                                       | Required `q`; `page` defaults to 1; `perPage` defaults to 100, maximum 100 |

Fanza adds `/api/fanza/bycode?code=EYAN-181` (required `code`) and
`/api/fanza/search?q=EYAN&page=1` (required `q`, `page` defaults to 1).
It scrapes [LibreDMM](https://www.libredmm.com/) HTML without DMM credentials.
The site's `/search` redirect normalizes content IDs such as `eyan00181` to
`EYAN-181`. Search uses its paginated `/movies` catalog. Titles, descriptions,
genres, and cast names remain in the source language (Japanese); `lang` is not
accepted. Metadata reflects LibreDMM's preferred version, which may be a later
reissue and may differ from another provider. LibreDMM also aggregates other
sources, so this provider is not an official or exclusively FANZA API.
Unavailable fields such as trailer and series are `null`; search cards expose
only the summary fields present in the catalog. No actress ranking is exposed.

Supported languages: `en`, `id`, `cn`, `ja`, `ko`, `ms`, `th`, `de`, `fr`, `vi`,
`fil`, `pt`. Pages must be positive integers.

Missing resources return 404, upstream failures return 502, upstream timeouts
return 504, and unconfigured actress search returns 503. Provider blocks such as
HTTP 403 remain provider errors. MissAV uses a normal Google Chrome browser
when Cloudflare rejects the HTTP request. Install Chrome locally; a temporary
window may open during a request. The browser uses a fresh profile and closes
afterward. Challenges that still require human verification return 503.
For Vercel/Linux, configure `SCRAPER_BROWSER_URL` with a trusted Chrome DevTools
endpoint; Chrome is not bundled with the deployment. Protect this endpoint and
keep its URL private. NJav browser verification is not enabled or verified.
A successful build does not guarantee upstream availability.

## Proxy restrictions

Proxy URLs must use HTTPS on the default port, without embedded credentials.
The default allowed hosts are `r18.dev`, `njavtv.com`, `missav.live`, `missav.ws`,
`www.libredmm.com`, `fourhoi.com`, `javtrailers.com`, `pics.dmm.co.jp`, and subdomains of `dmm.co.jp`.
Administrators can add exact, trusted CDN hostnames using the comma-separated
`PROXY_ALLOWED_HOSTS` environment variable. Private/reserved IP addresses are
blocked after DNS resolution, and redirects are validated again.

`site` returns plain text, including HTML source, so upstream scripts cannot run
on the API origin. `image` accepts raster image formats and buffers up to 10 MiB.
Site responses and HLS playlists are limited to 2 MiB. Video responses stream
with backpressure and preserve range headers. Video streaming is uncapped;
Axios applies `maxContentLength` to streams as well as buffered bodies, so
metadata limits must not be applied to large videos. Unsatisfiable ranges
preserve HTTP 416 and the upstream `Content-Range` header. HLS master/media playlists, keys,
and initialization segments are rewritten through the proxy, preserving query
strings. All referenced CDN hosts must be allowed.

## Checks

```sh
npm run lint
npm run type-check
npm test
npm run format:check
npm run build
npx --yes @yarnpkg/cli-dist@4.18.1 npm audit --recursive
```

Type-checking uses TypeScript 7.0.2. The official TypeScript 6 compatibility
package supplies the compiler API required by ESLint and Next.js build tooling.
ESLint 10 uses `@eslint/compat` for Next.js plugins that still use older APIs.
These packages can be removed when the upstream plugins support the new APIs.
The `@humanfs/node` resolution applies its security patch until ESLint updates
its pinned dependency. Yarn still reports the older ESLint peer range declared
by `eslint-plugin-import`; the compatibility adapter keeps those rules enabled.
Yarn audit also flags deprecated `whatwg-encoding@3.1.1` through Cheerio's
`encoding-sniffer@0.2.1`. This is a transitive deprecation report; update Cheerio
when it adopts the newer decoder instead of forcing a major transitive override.
Regression checks use the built-in Node.js test runner and native TypeScript
execution, without a transpiler, test framework, or provider network requests.
`type-check` regenerates Next.js route types before checking the project.

## Structure

```text
src/
  app/             # Server-rendered home, root layout, and API route handlers
    api/           # Existing /api URLs, one route.ts per endpoint
  lib/             # Query validation, error responses, safe proxy, formatting
  providers/       # R18/DMM clients, shared MissAV/NJav parsers, browser fallback
tests/            # Offline API, parser, security, and streaming regression checks
```

Routes handle HTTP requests; provider modules fetch and normalize upstream data.
`MovieModel` and `ActorModel` retain the existing JSON field names, including
`release_date_formated` and `duration_formated`, for desktop client compatibility.
R18 responses are parsed from `unknown` with runtime validation rather than `any`.
Dates format in UTC so deployment timezone does not shift a release date.
The home page uses a Server Component; only the existing Speed Insights widget
needs client JavaScript. No database or authentication system is introduced.

For LAN development, set `DEV_ALLOWED_ORIGINS` to comma-separated hostnames
(without a scheme or port), such as `dev.example.com,*.dev.example.com`. Production secrets stay in the hosting environment. DNS checks and
redirect validation apply to each proxy hop. Request cancellation propagates to
the proxy connection and stream cancellation closes the upstream video stream.

CI checks `master`, `main`, and `develop`, including pull requests. Production
deployment runs only after all CI checks and the build pass for a push to
`master`. Set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as repository
secrets. The workflow uses Vercel CLI to build and deploy the checked revision.

## Documentation cross-check

Checked on October 1, 2026 with Context7 for Next.js Route Handlers, Node.js
native TypeScript execution, and Axios request/stream options. Stable release
versions were verified against npm's `latest` tags; Context7's version-specific
index can lag npm, so indexed versions are not used as upgrade targets.

- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js development hostname allowlist](https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins)
- [Node.js native TypeScript support](https://nodejs.org/docs/latest-v24.x/api/typescript.html)
- [Axios request configuration](https://axios.rest/pages/advanced/request-config)
