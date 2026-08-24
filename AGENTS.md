# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## Commands

```bash
bun install                # Install dependencies
bun run dev                # Frontend dev server (Vite, port 5174, proxies /api → :3000)
bun run api                # Backend API server (Bun, port 3000)
bun run build              # Build frontend to dist/
docker compose build --no-cache && docker compose up -d  # Docker deployment
```

Run `dev` and `api` simultaneously during development. No test or lint commands exist.

## Runtime & Stack

- **Bun is required** — the backend uses `Bun.serve`, `bun:sqlite`, `Bun.password.hash/verify`, `Bun.file`, and `import.meta.dirname`. Plain `node` will not run `api/server.js`.
- **Top-level await** in `api/server.js` (`initializeDefaultPassword()`, `startScheduledTasks()`).
- **Frontend**: Vite 5 + vanilla JavaScript (no framework), CSS custom properties.
- **No TypeScript, no linter, no formatter** — follow existing patterns.

## Code Style

- **ESM everywhere**: `import`/`export` only; `package.json` has `"type": "module"`. Never use `require()`.
- **kebab-case** for all file and directory names.
- **2-space indentation**.
- **Responses**: always use `jsonResponse()` / `errorResponse()` from `@api/utils/response.js`. CORS headers passed as last arg.
- **Zod v4**: schemas in `@api/validators/`. Use `{ error: '中文消息' }` for required-type errors (v4 syntax, not v3).
- **Custom modals only**: use `showPrompt()` / `showMultiPrompt()` / `showAlert()` from `@web/src/components/prompt-modal.js`. Never use `prompt()` or `alert()`.

## Architecture

- **Backend flow**: `server.js` → Routes → Controllers → Services → DB (prepared statements).
- **Auth**: `withAuth(handler)` wraps protected routes; sessions in SQLite with HttpOnly cookies. See `@docs/AUTH.md`.
- **Database**: SQLite at `./data/timeline.db`. Migrations in `@api/db/migrations.js` — append to the `migrations` array with incrementing version numbers. See `@docs/DATABASE.md`.
- **Static files**: `api/server.js` serves `dist/` only when `NODE_ENV=production`. In dev, static requests return 404 — use the Vite dev server (`bun run dev`) instead.
- **Security headers**: injected in `api/server.js` on every response. HSTS added in production only.

## Frontend Patterns

- **State**: `@web/src/state.js` provides `getState()`/`setState()`.
- **AbortController hygiene**: `main.js` aborts the previous `AbortController` on each `createApp()` before binding new listeners — prevents accumulation across login/logout cycles. Follow this pattern when adding `document`/`window` listeners.
- **API client**: `@web/src/utils/api.js` — `apiFetch` has 10s timeout (AbortController), auto-401 handling, `skipAuthCheck` option. `meetingsAPI.delete()` returns `{ ok: true }` for 204 No Content.

## Shared Code

`dateParser.js` is duplicated in `@api/utils/dateParser.js` and `@web/src/utils/dateParser.js`. Both must be kept in sync manually — the Docker build only copies the backend version. Run `/sync-dateparser` after editing either copy.

## Date Constraints

- `MAX_RANGE_DAYS = 366`, `MAX_TOTAL_DATES = 366`.
- All date handling uses UTC (`Date.UTC`, `getUTC*`) — never use local-time methods.
- `isValidCalendarDate()` rejects impossible dates like Feb 31.

## Commit & PR Guidelines

- Commit messages are concise and in Chinese (e.g., `fix 日历样式 & 主题样式`).
- Use `fix`, `feat`, or similar prefixes followed by a short description.
- For PRs: include a description of changes, link to relevant issues in `issues/`, and note any migration changes.

## Security & Known Issues

See `@issues/01-code-audit.md` and `@issues/02-code-audit-r2.md`. Key open items:
- No CSRF protection
- Hardcoded default password (`REDACTED`) with no forced change
- No login rate limiting
- Docker container runs as root

---

`AGENTS.local.md` can be created for private, per-user instructions (auto-loaded with higher priority, gitignored by default). For module-specific guidance, subdirectory `AGENTS.md` files can be added and are loaded automatically when working in those directories.
