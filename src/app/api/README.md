# OmegaRod API Conventions

This directory holds Next.js App Router API routes (`src/app/api/**/route.ts`).
Two cross-cutting conventions apply to every handler.

## 1. Use the `withResource` / `loadResourceOrFail` helpers

The repeating "load by id → not-found check → permission check" pattern lives
in `src/lib/api-helpers.ts`. Use it instead of inlining the boilerplate.

- **`withResource<T>({...})`** — wraps `withAuth`, loads the row, runs the
  permission check, and hands a clean `{ resource, user, request, params }`
  context to your handler. Best fit for `GET` and simple `DELETE` routes that
  load one row and do one thing.
- **`loadResourceOrFail<T>({...})`** — lower-level helper that returns
  `{ resource, response }`. Call it inside a regular `withAuth(...)` handler
  when you also need to parse a body, run a follow-up reference check, or use
  the `existing` row in a transaction. Early-return when `response` is set.

Both helpers preserve `errorResponse` codes and statuses; pick `forbiddenCode`
explicitly when the route returns something other than `OWNERSHIP_REQUIRED`.

## 2. All `errorResponse` calls must carry a meaningful `code`

`errorResponse(code, message, status, details?)` from `@/lib/db` produces the
canonical error envelope `{ error: { code, message, details? } }`. The web UI
translates errors via `translateServerError` (`src/lib/i18n/server-errors.ts`),
which looks up `code` in `CODE_TO_I18N_KEY` and returns a localized string.
The `message` field is the fallback for non-UI consumers (CLI, MCP) and for
codes that have no translation yet.

### Rules

1. **Use a meaningful code.** Codes are `SCREAMING_SNAKE_CASE` and describe
   the _cause_, not the HTTP status. Prefer a domain-specific code
   (`INSTRUCTION_IN_USE`, `CREDENTIAL_REVEAL_DENIED`) over a generic one
   (`FORBIDDEN`, `NOT_FOUND`) whenever the UI needs to differentiate behavior.
2. **Register every new code.** Add it to `CODE_TO_I18N_KEY` in
   `src/lib/i18n/server-errors.ts` and to both `ko.json` and `en.json` under
   one of these namespaces:
   - `rbacErrors.*` — permission, ownership, visibility
   - `serverErrors.*` — system state (missing config, environment, HTTP-style)
   - `validationErrors.*` — request input problems
3. **Pass parameters via `details`.** When the message needs runtime values
   (e.g. a count), pass them as `details: { count: 3 }` and reference
   `{count}` in the i18n template. Do not interpolate them into the `message`
   string itself — the translation layer handles both.
4. **One code per failure mode.** Do not reuse `OWNERSHIP_REQUIRED` for
   unrelated conditions. If two paths need different user-facing behavior,
   give them different codes.

### Adding a new code

1. Pick a name: `<DOMAIN>_<CONDITION>`, `SCREAMING_SNAKE_CASE`.
2. Add it to `CODE_TO_I18N_KEY` with the appropriate namespace key.
3. Add the Korean and English messages to `ko.json` and `en.json`.
4. Use `errorResponse("NEW_CODE", "Korean fallback", statusCode, details?)`
   in the route.
5. Optional: add a test in `tests/server-errors.test.ts` asserting the
   translation flow.
