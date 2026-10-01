# JavIt API

Next.js Pages Router API for metadata from R18, MissAV, NJav, and DMM.
Requires Node.js 24 or newer. The project uses Yarn 4.18.1 and `yarn.lock`;
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

All endpoints accept GET. Repeated, empty, and invalid query values return 400;
other HTTP methods return 405. Search query text is URL-encoded before forwarding.

| Endpoint                                       | Parameters                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `/api`                                         | Provider examples, or exactly one of `site`, `image`, `video`              |
| `/api/r18`, `/api/missav`, `/api/njav`         | Endpoint examples                                                          |
| `/api/r18/bycode`                              | Required `code`                                                            |
| `/api/missav/bycode`, `/api/njav/bycode`       | Required `code`; `lang` defaults to `id`                                   |
| `/api/missav/search`                           | Required `q`; `page` defaults to 1; language is English                    |
| `/api/njav/search`                             | Required `q`; `page` defaults to 1; `lang` defaults to `id`                |
| `/api/missav/star_rank`, `/api/njav/star_rank` | No parameters                                                              |
| `/api/actress`                                 | Required `q`; `page` defaults to 1; `perPage` defaults to 100, maximum 100 |

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
`fourhoi.com`, `javtrailers.com`, `pics.dmm.co.jp`, and subdomains of `dmm.co.jp`.
Administrators can add exact, trusted CDN hostnames using the comma-separated
`PROXY_ALLOWED_HOSTS` environment variable. Private/reserved IP addresses are
blocked after DNS resolution, and redirects are validated again.

`site` returns plain text, including HTML source, so upstream scripts cannot run
on the API origin. `image` accepts raster image formats and buffers up to 10 MiB.
Site responses and HLS playlists are limited to 2 MiB. Video responses stream
with backpressure and preserve range headers. HLS master/media playlists, keys,
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
Regression checks run locally without contacting providers.

CI checks `master`, `main`, and `develop`, including pull requests. Production
deployment runs only after all CI checks and the build pass for a push to
`master`. Set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as repository
secrets. The workflow uses Vercel CLI to build and deploy the checked revision.
