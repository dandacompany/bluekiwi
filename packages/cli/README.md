# BlueKiwi CLI

BlueKiwi CLI installs the BlueKiwi MCP client and bundled skills into supported
agent runtimes.

## Supported runtimes

The CLI ships 17 runtime adapters out of the box:

| Runtime            | `--runtime` id   | Notes                                                                            |
| ------------------ | ---------------- | -------------------------------------------------------------------------------- |
| Claude Code        | `claude-code`    | Native skills support.                                                           |
| Claude Desktop     | `claude-desktop` | Native skills support (`Skills/` subdir).                                        |
| Codex CLI          | `codex`          | TOML config with managed `[mcp_servers.bluekiwi]` section.                       |
| Gemini CLI         | `gemini-cli`     | Native skills support.                                                           |
| OpenCode           | `opencode`       | Native skills support.                                                           |
| OpenClaw           | `openclaw`       | Native skills support.                                                           |
| Cursor             | `cursor`         |                                                                                  |
| Antigravity        | `antigravity`    | Google Antigravity IDE.                                                          |
| Windsurf           | `windsurf`       | Codeium Windsurf IDE.                                                            |
| Cline (VS Code)    | `cline`          | VS Code extension `saoudrizwan.claude-dev`.                                      |
| Roo Code (VS Code) | `roo-code`       | VS Code extension `rooveterinaryinc.roo-cline`.                                  |
| VS Code (Copilot)  | `vscode`         | Uses top-level `servers` key + `type: "stdio"`.                                  |
| Continue.dev       | `continue`       | Standalone YAML file under `~/.continue/mcpServers/`.                            |
| Zed                | `zed`            | Uses `context_servers` key (not `mcpServers`).                                   |
| Goose              | `goose`          | YAML with sentinel-delimited managed block.                                      |
| JetBrains AI       | `jetbrains`      | Fan-out: writes to every installed IntelliJ/PyCharm/WebStorm/Rider/… config dir. |
| Trae               | `trae`           | Global `mcp.json` path is best-effort (not officially documented by Trae).       |

Run `bluekiwi runtimes` to see which of these are detected on your machine, or
`bluekiwi runtimes add <id>` to install into a specific one.

### Adapter strategy

13 adapters share the same `JsonMcpAdapter` base class and are declared in a
single constructor call (see `src/runtimes/*.ts`). Adding a new JSON-based
runtime typically takes ~15 lines. The four outliers are:

- **Codex** — TOML, merges a `[mcp_servers.bluekiwi]` section via regex.
- **Goose** — YAML, uses sentinel comments (`# bluekiwi:begin`/`# bluekiwi:end`) to stay idempotent without pulling in a YAML parser.
- **Continue.dev** — owns its own YAML file so install/uninstall is a single file write/unlink.
- **JetBrains** — resolves paths at call time, fanning out across every installed IDE.

### Skills installation

BlueKiwi skill bundles are installed under each adapter's `skills` directory
and all bundle names are prefixed with `bk-` so prune/uninstall can safely
identify BlueKiwi-managed files without touching the user's other skills.
Runtimes that natively scan a skills directory (Claude Code, Claude Desktop,
Codex, Gemini, OpenCode, OpenClaw) pick them up as slash commands; other IDEs
receive the files but do not auto-load them today.

## Local runtime (Beta)

The CLI can also manage a local BlueKiwi runtime backed by SQLite.

Current stability level: `Beta`.

- `bluekiwi start`
- `bluekiwi stop`
- `bluekiwi restart`
- `bluekiwi status`

Runtime resolution order:

1. `BLUEKIWI_APP_ROOT`
2. `BLUEKIWI_APP_RUNTIME_PATH`
3. bundled standalone runtime under `dist/assets/app-runtime`
4. source checkout discovered from the current working directory

For packaged quickstart builds, generate the standalone app bundle first:

```bash
npm run build:cli
```

## Development

```bash
npm install     # installs vitest + typescript
npm run build   # tsc + asset bundling
npm test        # runs the 115-test Vitest suite
```

The test suite covers every adapter's install/uninstall round-trip and
idempotency semantics. See `tests/json-adapters.test.ts`,
`tests/custom-adapters.test.ts`, and `tests/skills-helper.test.ts`.
