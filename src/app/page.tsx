const providers = [
  {
    name: 'R18',
    initial: 'R',
    color: 'green',
    description: 'Detailed movie metadata, cast, artwork, and release information.',
    category: 'Movie metadata',
    parameter: 'code',
    example: 'EYAN-181',
    endpoints: [{ path: '/api/r18/bycode', query: 'code=EYAN-181', label: 'Find a movie' }],
  },
  {
    name: 'MissAV',
    initial: 'M',
    color: 'purple',
    description: 'Discover movies, explore search results, and browse actress rankings.',
    category: 'Search & discovery',
    parameter: 'code',
    example: 'EYAN-181',
    endpoints: [
      { path: '/api/missav/bycode', query: 'code=EYAN-181', label: 'Find a movie' },
      { path: '/api/missav/search', query: 'q=example&page=1', label: 'Search movies' },
      { path: '/api/missav/star_rank', query: '', label: 'Actress rankings' },
    ],
  },
  {
    name: 'NJav',
    initial: 'N',
    color: 'blue',
    description: 'Movie details and discovery with support for multiple languages.',
    category: 'Multilingual catalog',
    parameter: 'code',
    example: 'EYAN-181',
    endpoints: [
      { path: '/api/njav/bycode', query: 'code=EYAN-181', label: 'Find a movie' },
      { path: '/api/njav/search', query: 'q=example&page=1', label: 'Search movies' },
      { path: '/api/njav/star_rank', query: '', label: 'Actress rankings' },
    ],
  },
  {
    name: 'Fanza',
    initial: 'F',
    color: 'rose',
    description: 'Japanese movie metadata, cast, artwork, and search powered by LibreDMM.',
    category: 'LibreDMM catalog',
    parameter: 'code',
    example: 'EYAN-181',
    endpoints: [
      { path: '/api/fanza/bycode', query: 'code=EYAN-181', label: 'Find a movie' },
      { path: '/api/fanza/search', query: 'q=EYAN&page=1', label: 'Search movies' },
    ],
  },
  {
    name: 'DMM',
    initial: 'D',
    color: 'orange',
    description: 'Find actresses by name and explore their profile information.',
    category: 'Actress directory',
    parameter: 'q',
    example: 'Name',
    endpoints: [{ path: '/api/actress', query: 'q=Name&page=1', label: 'Search actresses' }],
  },
] as const

const sample = `{
  "video_code": "EYAN-181",
  "title": "…",
  "release_date": "…",
  "duration": 121,
  "actors": [ … ],
  "genre": [ … ],
  "poster": "https://…"
}`

export default function Home() {
  return (
    <div className="api-page">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="#main" aria-label="kuraku-api home">
          <span className="brand-mark" aria-hidden="true">
            k.
          </span>
          <span>
            kuraku<span className="brand-suffix">-api</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-link active" href="#providers">
            Overview
          </a>
          <a className="nav-link" href="#quick-start">
            Quick start
          </a>
          <a className="nav-action" href="/api" target="_blank" rel="noopener noreferrer">
            API index <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <main id="main" className="workspace">
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <p className="eyebrow">
              <span className="tiny-square" /> THE KURAKU TOOLKIT
            </p>
            <h1 id="hero-title">
              One API.
              <br />A world of metadata.
            </h1>
            <p className="hero-description">
              Find movies, discover cast, and bring your library to life.
              <br className="desktop-break" /> Your gateway to five metadata providers.
            </p>
            <a className="primary-button" href="#providers">
              Explore providers <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero-aside">
            <span className="connection-line" aria-hidden="true" />
            <div className="hero-monogram" aria-hidden="true">
              {'{ k }'}
            </div>
            <p>
              Built for your library.
              <br />
              <span>Ready for your next request.</span>
            </p>
          </div>
        </section>

        <div className="facts" aria-label="API overview">
          <div>
            <strong>{String(providers.length).padStart(2, '0')}</strong>
            <span>Metadata providers</span>
          </div>
          <div>
            <strong>
              {providers.reduce(
                (total, provider) => total + provider.endpoints.length,
                1 + providers.filter(provider => provider.parameter === 'code').length
              )}
            </strong>
            <span>Public endpoints</span>
          </div>
          <div>
            <strong>JSON</strong>
            <span>Metadata responses</span>
          </div>
          <div>
            <strong>GET</strong>
            <span>Simple requests</span>
          </div>
        </div>

        <section id="providers" aria-labelledby="providers-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CHOOSE YOUR SOURCE</p>
              <h2 id="providers-title">Meet the providers</h2>
            </div>
            <span className="section-note">Try a request. Results open in a new tab.</span>
          </div>
          <div className="provider-grid">
            {providers.map(provider => (
              <article className="provider-card" key={provider.name}>
                <div className="provider-heading">
                  <span className={`provider-icon ${provider.color}`} aria-hidden="true">
                    {provider.initial}
                  </span>
                  <div>
                    <h3>{provider.name}</h3>
                    <p>{provider.category}</p>
                  </div>
                </div>
                <p className="provider-description">{provider.description}</p>
                <form
                  action={provider.endpoints[0].path}
                  method="get"
                  target="_blank"
                  className="request-form"
                >
                  <label htmlFor={`query-${provider.initial}`}>
                    {provider.parameter === 'code' ? 'Movie code' : 'Actress name'}
                  </label>
                  <div className="input-row">
                    <input
                      id={`query-${provider.initial}`}
                      name={provider.parameter}
                      placeholder={provider.example}
                      defaultValue={provider.parameter === 'code' ? provider.example : undefined}
                      required
                      maxLength={provider.parameter === 'code' ? 100 : 2048}
                      pattern={provider.parameter === 'code' ? '[a-zA-Z0-9_\\-]+' : undefined}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      aria-label={`Try ${provider.name} request (opens in a new tab)`}
                    >
                      Try <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                </form>
                <details className="endpoint-details">
                  <summary>
                    Explore endpoints{' '}
                    <span>
                      {provider.endpoints.length} <span aria-hidden="true">＋</span>
                    </span>
                  </summary>
                  <ul>
                    {provider.endpoints.map(endpoint => (
                      <li key={endpoint.path}>
                        <a
                          href={`${endpoint.path}${endpoint.query ? `?${endpoint.query}` : ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span>
                            {endpoint.label} <span aria-hidden="true">↗</span>
                          </span>
                          <code>{endpoint.path}</code>
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
                {provider.name === 'DMM' && (
                  <p className="provider-footnote">Requires configured DMM credentials.</p>
                )}
              </article>
            ))}
          </div>
          <p className="availability-note">
            Provider availability may vary. Some sources require browser verification.
          </p>
        </section>

        <section id="quick-start" className="quick-start" aria-labelledby="quick-start-title">
          <div className="quick-start-copy">
            <p className="eyebrow">FROM CODE TO CATALOG</p>
            <h2 id="quick-start-title">
              A little request.
              <br />A lot of detail.
            </h2>
            <p>
              Pass a movie code to get its metadata. Open the example to see the response from your
              running API.
            </p>
            <ol className="steps">
              <li>
                <span>01</span>
                <div>
                  <strong>Choose a provider</strong>
                  <p>Start with R18 for detailed movie information.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Send a movie code</strong>
                  <p>
                    Use the <code>code</code> query parameter.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Make it yours</strong>
                  <p>Use the response to enrich your library.</p>
                </div>
              </li>
            </ol>
            <a
              className="text-link"
              href="/api/r18/bycode?code=EYAN-181"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open example response <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="code-panel">
            <div className="code-panel-top">
              <span>
                <span className="code-dot" /> Request preview
              </span>
              <span>R18</span>
            </div>
            <div className="code-request">
              <span className="method">GET</span>
              <code>/api/r18/bycode?code=EYAN-181</code>
            </div>
            <div className="code-response-heading">
              <span>Response shape</span>
              <span>application/json</span>
            </div>
            <pre>
              <code>{sample}</code>
            </pre>
            <p className="code-panel-note">Illustrative response · actual fields vary by movie</p>
          </div>
        </section>

        <aside className="proxy-banner" aria-labelledby="proxy-title">
          <span className="proxy-icon" aria-hidden="true">
            ⇄
          </span>
          <div>
            <h2 id="proxy-title">More than metadata</h2>
            <p>Access images, video streams, and source pages through the built-in media proxy.</p>
          </div>
          <a href="/api" target="_blank" rel="noopener noreferrer">
            View proxy examples <span aria-hidden="true">↗</span>
          </a>
        </aside>
      </main>
      <footer className="footer">
        <span>
          kuraku-api <span className="footer-divider">/</span> Your library, connected.
        </span>
        <a href="#main">
          Back to top <span aria-hidden="true">↑</span>
        </a>
      </footer>
    </div>
  )
}
