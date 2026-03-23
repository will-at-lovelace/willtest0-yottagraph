# AGENTS.md

Broadchurch tenant application built on Aether (Nuxt 3 + Vuetify).

## Cursor Cloud specific instructions

If you are in Cursor Cloud, the environment is **already fully set up**.
The `environment.json` install step has already run `init-project.js` and
`npm install`. A dev server terminal is running on port 3000.

**Do NOT** manually run `nvm install`, `nvm use`, `node init-project.js`,
or `npm install` — these have already completed.

### Initial environment setup only

This subsection applies ONLY when first asked to "set up the development
environment" or "demonstrate that the environment is working." It does
**NOT** apply to ongoing development — once the app is built, use the
browser normally to test and verify UI changes.

**During initial setup**, skip browser/UI testing. The starter UI is a
placeholder template that will be replaced by `/build_my_app`. Do not
launch a browser, record videos, or take screenshots at this stage.
Verifying `npm run build` passes is sufficient.

1. Check the "Dev Server" terminal output for a line containing
   `Listening on` or `Local: http://localhost:3000`. If present, the
   environment is working.
2. If the dev server is NOT running, start it with `npm run dev` and wait
   for the "Listening on" line.
3. Run `npm run build` to verify the project compiles.
4. Once confirmed, tell the user the environment is ready, then
   immediately run the `/build_my_app` command.

### MCP tools

Lovelace MCP servers (`lovelace-elemental`, `lovelace-stocks`, etc.)
should be available if configured at the org level. Check your tool list
for `elemental_*` tools. If they're not available, use the Elemental API
client (`useElementalClient()`) and the skill docs in
`skills/elemental-api/` and `skills/data-model/` for platform data access instead.

### Technical details

Node 20 is the baseline (`.nvmrc`). The `environment.json` install step
handles this via `nvm install 20 && nvm alias default 20`. Newer Node
versions (22, 25) generally work but may produce `EBADENGINE` warnings
during install — safe to ignore.

The install step runs `node init-project.js --local` (creates `.env` if
absent) then `npm install` (triggers `postinstall` → `nuxt prepare` +
orval codegen). Auth0 is bypassed via `NUXT_PUBLIC_USER_NAME=dev-user`
in the generated `.env`.

**No automated test suite.** Verification is `npm run build` (compile
check) and `npm run format:check` (Prettier). See Verification Commands.

**Before committing:** always run `npm run format` — the husky pre-commit
hook runs `lint-staged` with `prettier --check` and will reject
unformatted files.

## Manual / Local Setup

Node 20 is the baseline (pinned in `.nvmrc`). Newer versions generally work.

```bash
npm run init -- --local   # creates .env with dev defaults (no Auth0)
npm install               # all deps are public on npmjs.com -- no tokens needed
npm run dev               # dev server on port 3000
```

For the full interactive wizard (project name, Auth0, query server, etc.):

```bash
npm run init              # interactive, or --non-interactive for CI (see --help)
```

## .env Essentials

| Variable                           | Purpose                          | Default                                 |
| ---------------------------------- | -------------------------------- | --------------------------------------- |
| `NUXT_PUBLIC_APP_ID`               | Unique app identifier            | derived from directory name             |
| `NUXT_PUBLIC_APP_NAME`             | Display name                     | derived from directory name             |
| `NUXT_PUBLIC_USER_NAME`            | Set to any value to bypass Auth0 | `dev-user` in local mode                |
| `NUXT_PUBLIC_QUERY_SERVER_ADDRESS` | Query Server URL                 | read from `broadchurch.yaml` if present |
| `NUXT_PUBLIC_GATEWAY_URL`          | Portal Gateway for agent chat    | read from `broadchurch.yaml` if present |
| `NUXT_PUBLIC_TENANT_ORG_ID`        | Auth0 org ID for this tenant     | read from `broadchurch.yaml` if present |

See `.env.example` for the full list.

## Project Structure

| Directory      | Contents                                             | Deployed to            |
| -------------- | ---------------------------------------------------- | ---------------------- |
| `pages/`       | Nuxt pages (file-based routing)                      | Vercel (with app)      |
| `components/`  | Vue components                                       | Vercel (with app)      |
| `composables/` | Vue composables (auto-imported by Nuxt)              | Vercel (with app)      |
| `utils/`       | Utility functions (NOT auto-imported)                | Vercel (with app)      |
| `server/`      | Nitro API routes (KV storage, avatar proxy)          | Vercel (with app)      |
| `agents/`      | Python ADK agents (each subdirectory is deployable)  | Vertex AI Agent Engine |
| `mcp-servers/` | Python MCP servers (each subdirectory is deployable) | Cloud Run              |

### Directories populated by `npm install`

`skill-packages.json` lists which npm skill packages to copy into `skills/`.
`skills/elemental-api/` contains API skill documentation (endpoint reference,
types, usage patterns), copied from `@yottagraph-app/elemental-api-skill`.
`skills/data-model/` contains Lovelace data model documentation (entity types,
schemas per fetch source), copied from `@yottagraph-app/data-model-skill`.
Both are populated during the `postinstall` step. **Those directories are empty
until you run `npm install`.** If you're exploring the project before installing
dependencies, the skill docs won't be there yet — this is expected.

### Agents

`agents/example_agent/` is a working starter agent that queries the Elemental
Knowledge Graph. It includes schema discovery, entity search, property lookup,
and optional MCP server integration. Use it as a starting point — customize the
instruction, add tools, and see the `agents` cursor rule for the full guide.

## Configuration

`broadchurch.yaml` contains tenant-specific settings (GCP project, org ID,
service account, gateway URL, query server URL). It's generated during
provisioning and committed by the `tenant-init` workflow. Don't edit manually
unless you know what you're doing.

## Storage

Each project gets storage services provisioned automatically by the Broadchurch
platform and connected via Vercel env vars:

### KV Store (Upstash Redis) -- always available

Key-value storage for preferences, sessions, caching, and lightweight data.

| Env var             | Purpose                 |
| ------------------- | ----------------------- |
| `KV_REST_API_URL`   | Redis REST API endpoint |
| `KV_REST_API_TOKEN` | Auth token              |

**Server-side** (`server/` routes): use `@upstash/redis` via `server/utils/redis.ts`.
**Client-side** (composables): use `usePrefsStore()` which calls `/api/kv/*` routes.
See the `pref` cursor rule for the `Pref<T>` pattern.

### PostgreSQL (Supabase) -- optional

Full relational database for structured data. Added during project creation
(optional checkbox) or post-creation from the Broadchurch Portal dashboard.

| Env var                         | Purpose                           | Client-safe? |
| ------------------------------- | --------------------------------- | ------------ |
| `NUXT_PUBLIC_SUPABASE_URL`      | Supabase project URL              | Yes          |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key                   | Yes          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only service role key      | **No**       |
| `SUPABASE_DB_URL`               | Direct Postgres connection string | **No**       |

Install `@supabase/supabase-js` to use. See the `server` cursor rule for examples.

## How Deployment Works

### App (Nuxt UI + server routes)

Vercel auto-deploys on every push to `main`. Preview deployments are created for
other branches. The app is available at `{slug}.yottagraph.app`.

### Agents (`agents/`)

Each subdirectory in `agents/` is a self-contained Python ADK agent. Deploy via
the Portal UI or `/deploy_agent` in Cursor.

### MCP Servers (`mcp-servers/`)

Each subdirectory in `mcp-servers/` is a Python FastMCP server. Deploy via
the Portal UI or `/deploy_mcp` in Cursor.

## Verification Commands

```bash
npm run dev          # dev server -- check browser at localhost:3000
npm run build        # production build -- catches compile errors
npm run format       # Prettier formatting (run before committing)
```

## Known Issues

### Blank white page after `npm run dev`

If the server returns HTTP 200 but the page is blank, check the browser console
for `SyntaxError` about missing exports. This is caused by Nuxt's auto-import
scanner. **Fix:** verify the `imports:dirs` hook in `nuxt.config.ts` is present.

### Port 3000 conflict

The dev server binds to port 3000 by default. If another service is already
using that port, start with `PORT=3001 npm run dev`.

### Formatting

Pre-commit hook runs `lint-staged` with Prettier. Run `npm run format` before
committing to avoid failures.
