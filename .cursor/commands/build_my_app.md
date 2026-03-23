# Build My App

Read the project brief and build the described application.

## Overview

This command reads `DESIGN.md` (which contains the project creator's vision) and implements the described application using standard Nuxt patterns, Vuetify components, and the Lovelace platform's data APIs.

**This is meant to be the first thing a user runs after opening their project in Cursor.**

---

## Step 1: Read the Brief

Read `DESIGN.md` from the project root.

```bash
cat DESIGN.md
```

Look for a `## Vision` section -- this contains the project creator's description of what they want to build.

**If the file doesn't exist or has no Vision section:**

> No project brief found. That's fine -- tell me what you'd like to build and I'll help you get started!

Stop here and wait for the user to describe what they want.

---

## Step 2: Check MCP Servers

Check if Lovelace MCP tools are available by looking at your tool list for
tools like `elemental_get_schema`, `elemental_get_entity`, etc.

**If MCP tools are available:** Great — you have access to Lovelace platform
tools (entity search, market data, news, etc.) that you can use during
development.

**If MCP tools are NOT available:** Check if `.cursor/mcp.json` exists:

```bash
cat .cursor/mcp.json 2>/dev/null
```

If the file exists but tools aren't showing, they may need to be enabled:

> Your project has Lovelace MCP servers configured (`.cursor/mcp.json`),
> but they don't appear to be active yet. Cursor disables new MCP servers
> by default.
>
> Open **Cursor Settings** (Cmd+Shift+J) → **Tools & MCP** and enable the
> `lovelace-*` servers listed there. They should show green toggles when
> active. Let me know when they're enabled (or if you'd like to skip this).

Wait for confirmation before proceeding. If the user skips this step or
the settings panel isn't available (e.g. Cursor Cloud), proceed without
MCP tools — the app can still be built using the Elemental API client
(`useElementalClient()`) directly.

---

## Step 3: Understand the Environment

First, ensure dependencies are installed (skill docs and types aren't available without this):

```bash
test -d node_modules || npm install
```

Then read these files to understand what's available:

1. `DESIGN.md` -- project vision and current status
2. `broadchurch.yaml` -- project config (name, gateway URL, etc.)
3. **The `api` cursor rule** -- this is critical. It describes the Query Server, the platform's primary data source. Build against platform APIs, not external sources.
4. **`.cursor/skills/`** — Each subdirectory is one skill. List them, open each skill’s entry (usually `SKILL.md`) and follow its structure to learn what is documented (APIs, schemas, helpers, etc.).
5. `.cursor/rules/` -- scan rule names to know what other patterns are available

**Important: Use the platform's data.** This app runs on the Lovelace platform, which provides a Query Server with entities, news, filings, sentiment, relationships, events, and more. Read the `api` rule and the skills under `.cursor/skills/` to understand what data is available. Use `getSchema()` to discover entity types and properties at runtime.

Key capabilities:

- **Query Server / Elemental API** -- the primary data source. Use `useElementalClient()` from `@yottagraph-app/elemental-api/client`. See the `api` rule.
- **KV storage** -- always available for preferences and lightweight data (see `pref` rule)
- **Supabase** -- check if `NUXT_PUBLIC_SUPABASE_URL` is in `.env` for database access
- **AI agent chat** -- use the `useAgentChat` composable to build a chat UI for deployed agents
- **MCP servers** -- Lovelace MCP servers may be available (check `.cursor/mcp.json`)
- **Components** -- Vuetify 3 component library is available

---

## Step 4: Design the UX

Based on the brief, think about the right UX for this specific problem. Do NOT default to a sidebar-with-tabs layout. Consider:

- **Single-page app** -- if the core experience is one focused view (e.g. a dashboard, a watchlist, a chat interface)
- **Multi-page with navigation** -- if the app has distinct sections. Choose the right nav pattern: sidebar, top tabs, bottom nav, breadcrumbs, etc.
- **Hybrid** -- a primary view with secondary pages accessible from a menu or header

Design the UX around the user's workflow, not around a fixed navigation pattern.

Plan what you'll build:

1. What pages to create in `pages/`
2. What reusable components to extract into `components/`
3. What shared logic belongs in `composables/`
4. What data needs to be persisted (and whether KV or Supabase is appropriate)
5. Whether the app needs AI agents or MCP servers
6. Whether the app needs an agent chat page (use the `useAgentChat` composable)
7. Whether `app.vue` needs a sidebar, tabs, or other navigation (and what it should look like)

Present the plan to the user and ask for approval before proceeding.

---

## Step 5: Build

Implement the plan:

1. Create pages in `pages/` (standard Nuxt file-based routing)
2. Extract reusable components into `components/`
3. Put shared logic in `composables/`
4. If the app needs navigation, add it to `app.vue` or to individual pages
5. Use `Pref<T>` for any persisted settings (see `pref.mdc`)
6. Use Vuetify components and the project's dark theme
7. Update `DESIGN.md` with what you built

**Follow the project's coding conventions:**

- `<script setup lang="ts">` for all Vue components
- TypeScript required
- Composables return `readonly()` refs with explicit setters

---

## Step 6: Verify

After building, check dependencies are installed and run a build:

```bash
test -d node_modules || npm install
npm run build
```

Fix any build errors.

Then suggest the user run `npm run dev` to preview their app locally.

---

## Step 7: Next Steps

> Your app is taking shape! Here's what you can do next:
>
> - **Preview locally** with `npm run dev`
> - **Push to deploy** -- Vercel auto-deploys on push to main
> - **Deploy an AI agent** -- run `/deploy_agent` when you have an agent ready
> - **Deploy an MCP server** -- run `/deploy_mcp` for tool servers
