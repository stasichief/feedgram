# feedgram

An offline-first RSS / Atom / JSON Feed reader with a Lemmy-style layout,
built with [InfernoJS](https://infernojs.org/).

```
┌──────────────────────────────────────────────────────────────┐
│ TOP BAR   feedgram   [ search / paste a feed URL ]  [+ Create]│
├────────────┬─────────────────────────────┬───────────────────┤
│ LEFT NAV   │ CENTER FEED                 │ RIGHT SIDEBAR     │
│ Subscribed │ [Active][New][Hot][Top]     │ Trending feeds    │
│ Explore    │  ▲42  Post title            │ Site info         │
│ All        │  ▼    domain.com            │                   │
│ Settings   │       "excerpt…"           │                   │
│ (O) Sign in│       💬 12 • 3h ago        │                   │
├────────────┴─────────────────────────────┴───────────────────┤
│ Mobile: one column, everything else lives in the hamburger menu │
└──────────────────────────────────────────────────────────────┘
```

## Features

- **Feed reader** — RSS 2.0, Atom and JSON Feed parsing, plus URL
  auto-discovery (paste any site URL and the feed is found for you).
- **Source picker** — choose *RSS/Atom/JSON*, *Lemmy*, *ActivityPub/Mastodon*
  or *Bluesky* when adding a feed, and the matching API is used. See
  [Remote sources](#remote-sources).
- **Lemmy-style layout** — three panes on desktop, a single column with a
  drawer on mobile.
- **Reader mode** — full articles are extracted with `@mozilla/readability`
  and rendered inline underneath the post, cached in IndexedDB.
- **Offline-first PWA** — Workbox service worker, precached app shell,
  runtime caching for feeds and articles, conservative background sync.
- **Subscriptions** — OPML import/export, per-feed comment endpoint
  configuration.
- **Engagement** — local up/down votes and bookmarks, real scores and comment
  counts from Lemmy / Mastodon / Bluesky.
- **Comments** — resolved through the Lemmy REST API, the Mastodon status
  context API, the Bluesky post-thread API, or a custom JSON endpoint.
- **Publishing** — create posts to Mastodon, Lemmy, Bluesky, WordPress or any
  Micropub endpoint.
- **Theming** — Light / Sepia / True Black, sans or serif, five font sizes,
  three line widths.

## Remote sources

Both the *Subscribed* and *Explore* add-feed forms have a **Source** dropdown:

| Source | Input | API used |
| --- | --- | --- |
| RSS / Atom / JSON Feed | Any site or feed URL | Feed discovery, then `fast-xml-parser` / JSON Feed |
| Lemmy (REST API) | `https://lemmy.sdf.org/c/humanrights`, `!community@instance`, `/u/user`, or an instance root | `/api/v3/community`, `/api/v3/post/list`, `/api/v3/user`, `/api/v3/site` |
| ActivityPub / Mastodon | `https://defcon.social/explore`, `https://host/@user`, or any actor URL | Mastodon `/api/v1/accounts/lookup`, `/api/v1/accounts/:id/statuses`, `/api/v1/trends/statuses`; generic actors via their ActivityPub outbox |
| Bluesky (ATProto) | `https://bsky.app/profile/handle` or a bare handle | `public.api.bsky.app` — `getProfile`, `getAuthorFeed` |

Social sources store the complete post body (`Post.inline`), so the inline
reader shows it directly instead of re-fetching the page. Comment threads are
resolved per source:

- **Lemmy** — `GET /api/v3/comment/list?post_id=…`, nested through
  `comment.path`.
- **Mastodon** — `GET /api/v1/statuses/:id/context`.
- **Bluesky** — `GET app.bsky.feed.getPostThread?uri=…`.

In development every remote request is relayed through
`/__feedgram/proxy` (see `vite.config.ts`), so no CORS proxy is needed while
running `npm run dev`.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | InfernoJS 10 (class components — Inferno ships no React hooks) |
| Build | Vite 7 + `babel-plugin-inferno` (emits Inferno v10 vNode flags) |
| Styling | Tailwind CSS 3 with theme tokens as CSS variables |
| Routing | `inferno-router` (hash routing, so any static host works) |
| Storage | IndexedDB via `idb` |
| Parsing | `fast-xml-parser` |
| Articles | `@mozilla/readability` |
| PWA | `vite-plugin-pwa` (injectManifest) + Workbox |
| Icons | `lucide` (raw SVG node data) |

## Getting started

```bash
npm install
npm run dev        # development server on http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
```

## Hosting

The app is a static bundle, so any static host works. It uses hash routing
(`/#/feeds`), which means **no SPA rewrite rules are required** — including
when it is served from a subdirectory.

```bash
npm run build
# copy dist/ to your host
```

Set the **Site URL** in *Settings → Proxy configuration* to the URL the app is
served from. It is used to build OAuth redirect URIs.

## Native Android and web builds

Both targets use this single TypeScript/Inferno source tree. `npm run build` remains the static web build for GitHub Pages. In a Tauri runtime, `src/lib/proxy.ts` uses Tauri’s Rust-backed HTTP plugin for remote feed/API requests, avoiding WebView CORS; in a normal browser it keeps the existing browser/proxy behavior. The native HTTP scope intentionally permits HTTP(S) hosts broadly because users choose arbitrary Lemmy, Mastodon, and feed instances. The native build skips service-worker registration; the website keeps its PWA behavior.

Tauri v2 setup files are in `src-tauri/`. The first Android setup requires Rust 1.90+, Java, Android Studio/SDK and NDK. After installing those locally, run:

```bash
npm install
npm run tauri:android:init
npm run tauri:android:dev
npm run tauri:android:build   # APK
npm run tauri:android:bundle  # AAB for store upload
```

The configured Android callback URI is `app.feedgram.client://oauth/callback`. Mastodon and Micropub authorization open in the system browser and return through Tauri’s deep-link plugin. Use the GitHub Pages URL (including the repository subpath) as **Site URL** in the web build so its OAuth callback is the static site URL. The website and Android bundle do not need separate feature branches or duplicated source code.

Lemmy is different: its standard client API login returns a JWT from `/api/v3/user/login` and does not define a generic third-party OAuth browser redirect for apps. Therefore the Tauri client sends the credentials directly to the chosen HTTPS Lemmy instance through native HTTP; only the resulting session token is retained. Mastodon instances currently document PKCE but require an instance-registered client secret for token exchange. In this client the per-instance secret is held in WebView storage only during the pending login and is removed after success; it cannot be treated as confidential in a distributed app. Connected session tokens continue to use the project’s existing IndexedDB storage, not Android Keystore encryption. A small OAuth broker/backend and native secure token storage are stronger options if you need to keep client secrets off-device or encrypt tokens at rest. These flows follow the relevant [Tauri deep-link](https://v2.tauri.app/plugin/deep-linking/), [Tauri HTTP](https://v2.tauri.app/plugin/http-client/), [Tauri opener](https://v2.tauri.app/plugin/opener/), [Mastodon OAuth](https://docs.joinmastodon.org/spec/oauth/) and [OAuth for Native Apps](https://www.rfc-editor.org/rfc/rfc8252) documentation.

## Configuration

Everything is configurable from *Settings*:

| Setting | Description |
| --- | --- |
| Theme / Font / Font size / Line width | Appearance and typography |
| Poll interval | How often feeds are refreshed while the app is open (5m/15m/30m/1h) |
| Background sync | Opt-in service worker scheduling (conservative, see below) |
| Explore feed URLs | Discovery feeds shown on the Explore page. Removing one asks whether to delete its cached posts as well. |
| Proxy mode | `Direct` or `Custom` |
| Proxy URL | Any CORS proxy. Use `{url}` as a placeholder, e.g. `https://proxy.example/?url={url}` |
| Custom headers / Timeout / Retries / User-Agent | Advanced proxy options |
| Import / Export OPML | Subscription management |

### Proxy behaviour

When a custom proxy is configured **every** feed and article request goes
through it; otherwise requests are made directly from the browser. Any
compatible proxy works — AllOrigins, corsproxy.io, r.jina.ai, a self-hosted
worker, or your own service.

### Background sync policy

Deliberately conservative:

- Foreground polling is the primary mechanism and only runs while the tab is
  visible and the device is online.
- The Background Sync API is opt-in and never schedules more than one pending
  sync.
- A sync never runs more often than twice the configured poll interval.
- At most 50 feeds are fetched per pass, round-robin.
- Three consecutive failed passes pause automatic syncing.
- Data-saver and 2G connections pause syncing entirely.
- Feeds use conditional requests (`ETag` / `If-Modified-Since`), so unchanged
  feeds cost nothing.

## Authentication

Five methods are supported, all optional:

| Method | What you need |
| --- | --- |
| Micropub | Micropub endpoint, client id, authorization endpoint, and optional token endpoint/client secret |
| Mastodon | Instance URL (the app registers itself, OAuth 2.0) |
| WordPress | Site URL, username and application password |
| Bluesky | Handle, app password and PDS URL |
| Lemmy | Instance, username, password (and TOTP if enabled) |

Tokens are stored in IndexedDB. Publishing to an instance happens from
*Create post*; the target is chosen from the connected accounts.

### Comments

The comments panel only appears when a comment endpoint is available:

- **Mastodon** feeds use `https://<instance>/api/v1/statuses/<id>/context`.
- **Lemmy** feeds use `https://<instance>/api/v3/post?id=<id>`.
- **Any other feed** can be given a custom JSON endpoint in
  *Subscribed feeds → edit*. Use `{id}` as the placeholder for the post id;
  the endpoint may return an array or `{ "comments": [...] }`.

## Project layout

```
src/
├── App.tsx                  # root component, routing and shared state
├── main.tsx                 # entry point
├── sw.ts                    # service worker (Workbox)
├── components/
│   ├── Layout/              # TopBar, LeftNav, RightSidebar, ThreePane, MobileDrawer
│   ├── Feed/                # PostCard, PostList, SortBar, PostDetail, CommentsPanel
│   ├── Settings/            # ThemePicker, TypographyControls, SyncConfig, ProxyConfig, DataManagement
│   ├── Auth/                # one card per authentication method
│   ├── Create/              # CreatePost
│   └── common/              # Button, Avatar, Field, Icon
├── lib/
│   ├── db.ts                # IndexedDB access
│   ├── feed-parser.ts       # RSS / Atom / JSON Feed parsing
│   ├── feed-discovery.ts    # URL → feed discovery
│   ├── sources.ts           # Lemmy / ActivityPub / Bluesky source adapters
│   ├── feeds.ts             # fetching, sorting, voting, bookmarking
│   ├── comments.ts          # comment endpoint resolution + normalisation
│   ├── readability.ts       # article extraction and sanitising
│   ├── opml.ts              # OPML import / export
│   ├── proxy.ts             # CORS proxy client
│   ├── settings.ts          # settings store
│   ├── store.ts             # tiny observable store
│   ├── sync.ts              # conservative sync policy
│   └── auth/                # one module per authentication method
├── pages/                   # Subscribed, Explore, All, Feeds, Settings, Profile, Create, PostPage, AuthCallback
└── styles/                  # Tailwind entry + theme tokens
```

## Testing

```bash
node scripts/mock-feed-server.mjs   # serves RSS/Atom/JSON feeds + articles
node scripts/e2e-test.mjs           # end-to-end test in a real browser
node scripts/smoke-test.mjs         # UI smoke test + screenshots
node scripts/test-sources.mjs       # live check against lemmy.sdf.org / defcon.social / bsky.app
node scripts/verify-comments.mjs    # Lemmy subscription + real comment thread
```

Both browser scripts use the Edge installation on this machine through
`playwright-core`; they expect `npm run preview` to be running on port 4173
(`test-sources.mjs` and `verify-comments.mjs` use the dev server on 5174 by
default — override with `APP_URL`).

## Notes on the InfernoJS stack

Inferno has no React-style hooks — `useState` and `useEffect` do not exist in
any Inferno release, and there is no `inferno-hooks` package. The app is
therefore written with class components and a small observable store
(`src/lib/store.ts`). `inferno-compat` provides `createElement` and
`forwardRef`, so React libraries that do not rely on hooks or context still
work through the `react` → `inferno-compat` alias; the icon set uses the raw
`lucide` SVG data for exactly this reason.

**Controlled inputs.** After an `input` event Inferno writes the vNode's
`value` prop back onto the DOM node. If the owning component does not re-render
with the new value, the keystroke is undone and the field looks read-only.
`Input` and `TextArea` in `components/common/Field.tsx` handle this internally
(call `forceUpdate()` after updating their value), so use those components
rather than raw `<input>` elements.
