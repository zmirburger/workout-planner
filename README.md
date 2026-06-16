# Hypertrophy — Next Workout

A static, read-only "Next Workout" dashboard. A single Cloudflare Pages Function
reads a Notion page **server-side** and returns its workout JSON; the static page
renders it with Pull / Push tabs (the upcoming session is badged **NEXT**).

**Live:** <https://workout.zmirburger.com>

- **No framework, no build step.** `public/index.html` is plain HTML/CSS/JS.
- **The Notion token never reaches the browser.** It lives only as a Cloudflare
  secret and is used exclusively inside the server-side Function.

## How it works

```
public/index.html              Static dashboard. Fetches /api/prescription on load.
                               Ships with an inline FALLBACK so it renders instantly.
functions/api/prescription.js  Pages Function (GET /api/prescription). Calls the
                               Notion API with NOTION_TOKEN, scans the page for JSON
                               code blocks, and returns them keyed by session:
                               { "pull": {...}, "push": {...} }.
wrangler.toml                  Pages project config + plaintext NOTION_PAGE_ID var.
```

The Function reads the children of the configured Notion page, keeps every `code`
block whose language is `json` (or unset), parses each one, and indexes it by its
lowercased `session` field (e.g. `"Pull"` → `pull`). Responses are cached at the
Cloudflare edge for 5 minutes.

## Environment variables

The Function needs two variables on the Cloudflare Pages project:

| Name             | Type                | Value                                                  |
| ---------------- | ------------------- | ------------------------------------------------------ |
| `NOTION_PAGE_ID` | Plaintext           | `381b7d6d-bb29-8143-86d3-da9dca9c1924` (set in `wrangler.toml` `[vars]`) |
| `NOTION_TOKEN`   | Secret (encrypted)  | A Notion internal integration token. **Never committed.** Set it via Cloudflare only. |

> The Notion integration must be shared with the page (in Notion: open the page →
> ••• menu → **Connections** → add your integration) or the API returns 404/403.

## Editing the workout

The dashboard is **read-only**. To change what it shows, edit the JSON code
blocks on the Notion page — one block per session, each an object with a
`session` field plus `rows`, `tempo`, `warmup`, etc.

Changes appear within ~5 minutes (the edge cache TTL). To see them immediately,
bypass the cache:

```
GET /api/prescription?nocache=1
```

## Local development

```bash
npm install -g wrangler            # if not already installed
echo 'NOTION_TOKEN = "secret_..."' > .dev.vars   # gitignored; never commit
wrangler pages dev public
```

`.dev.vars` supplies the secret locally; `NOTION_PAGE_ID` comes from
`wrangler.toml`. Open the printed `http://localhost:8788`.

## Deploy (Cloudflare Pages)

### Option A — Wrangler CLI

```bash
# Create the project once (skip if it already exists)
wrangler pages project create workout-planner --production-branch main

# Deploy the static assets + Function
wrangler pages deploy public --project-name workout-planner

# Set the secret (prompts you to paste the token; never stored in the repo)
wrangler pages secret put NOTION_TOKEN --project-name workout-planner
```

`NOTION_PAGE_ID` is applied from `wrangler.toml` `[vars]`. Confirm it under
**Pages → project → Settings → Variables and Secrets**; add it there if missing.

### Option B — Dashboard (Git integration)

1. Push this repo to GitHub (private).
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**,
   select the repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(empty)*
   - **Build output directory:** `public`
4. **Settings → Variables and Secrets**, add:
   - `NOTION_PAGE_ID` — plaintext — `381b7d6d-bb29-8143-86d3-da9dca9c1924`
   - `NOTION_TOKEN` — **encrypted / secret** — your Notion token
5. Deploy. Each push to `main` redeploys automatically.

### Custom domain

Pages project → **Custom domains → Set up a custom domain** → enter the hostname
(here, `workout.zmirburger.com`). When the apex zone is already on the same
Cloudflare account, the proxied CNAME is created automatically and the
certificate provisions in a few minutes.

### Current deployment

`main` is connected to a Cloudflare Pages project named **`workout-planner`**
(Git integration), served at <https://workout.zmirburger.com>. Every push to
`main` auto-redeploys; workout content is edited in Notion (no redeploy needed).

## Acceptance checks

```bash
# Shaped { "pull": {...}, "push": {...} }, each with a rows array
curl https://workout.zmirburger.com/api/prescription

# Fresh data, bypassing the 5-minute edge cache
curl 'https://workout.zmirburger.com/api/prescription?nocache=1'
```

- Root URL renders the dashboard with **Pull / Push** tabs; Pull is badged **NEXT**.
- View source / Network panel: `NOTION_TOKEN` appears **nowhere** client-side.

## Security

- `NOTION_TOKEN` is **only** a Cloudflare secret — never hardcoded, never committed.
- `.dev.vars` (local secret store) is gitignored.
- The browser only ever talks to `/api/prescription`; the Notion API call and the
  token stay on the server.
