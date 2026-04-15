# BlueKiwi CLI

BlueKiwi CLI installs the BlueKiwi MCP client and bundled skills into supported
agent runtimes.

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
