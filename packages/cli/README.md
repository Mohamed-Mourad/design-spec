# @design-spec/cli

The local-first Design Spec engine. It detects your stack, synthesizes
`design-spec.schema.json`, compiles `DESIGN.md`, `SKILL.md` and framework token
files from it, keeps them fresh, and serves scoped token context to AI agents
over MCP.

The package is `@design-spec/cli`; the command it installs is `design-spec`.

> The unscoped npm package `design-spec` is **not** this project. Always run
> `npx @design-spec/cli …`, or install the scoped package and call
> `design-spec …`.

```bash
npx @design-spec/cli init          # one-off, no install

npm i -D @design-spec/cli          # or install it into the project
npx @design-spec/cli compile      # uses the installed copy
```

Requires Node 22 or newer.

## Commands

| Command | What it does |
|---|---|
| `init` | Detect your framework, synthesize `design-spec.schema.json`, and compile outputs. `--yes` takes every default (CI-safe). |
| `config` | View or edit the project export config: frameworks, naming, prefixes. |
| `compile` | Compile the schema to every output file. |
| `watch` | Recompile whenever the schema is saved. `--sync` also keeps it in step with your dashboard. |
| `status` | Schema location, configured frameworks, and output freshness. |
| `diff` | Token drift between the schema and the live framework config. |
| `lint` | Validate the schema and detect stale generated output. Read-only. |
| `fix` | Rewrite raw values (hex, px, arbitrary classes) to the nearest token. |
| `hook` | Install or remove the git pre-commit hook that blocks stale output. |
| `serve` | Run a local MCP server (stdio) that feeds AI agents scoped token context. |
| `sync` | Pull presentation config from your dashboard. |
| `push` | Push your local schema to your dashboard (never to git). |

Global flags: `--json`, `--quiet`, `--verbose`, `--no-color`, `--dry-run`
(alias `--plan`). Run `design-spec <command> --help` for each command's options.

## Dashboard sync

`sync`, `push` and `watch --sync` talk to your Design Spec dashboard with an API
key from **Settings → Developer**.

| Variable | Purpose |
|---|---|
| `DESIGN_SPEC_API_KEY` | The API key (`ds_live_…` or `ds_test_…`). |
| `DESIGN_SPEC_API_URL` | The API host. Defaults to `https://api.design-spec.ai`. `http://` is accepted only for `localhost`. |
| `DESIGN_SPEC_TELEMETRY` | Off unless set to `1`. With it and an API key, `serve` reports each MCP tool call's size to your dashboard: a session id, the blueprint name, two token estimates and the client's name. Never a tool argument, a result, or anything from your schema. |

Set the key in your environment rather than on the command line, where it would
land in your shell history:

```bash
export DESIGN_SPEC_API_KEY=…      # paste the key from Settings → Developer
design-spec sync
```

`--key` still works, and the key is remembered in
`~/.config/design-spec/config.json` (never inside the project), so it is needed
at most once. The CLI never prints a key; it shows `ds_live_…abcd` instead.

### Layer rules

The schema has two layers that sync differently:

- **Presentation** (bento layout, branding, sharing) is owned by the dashboard.
  `sync` takes the dashboard's version; `push` keeps it.
- **Export** (frameworks, naming, prefixes, font loading) is owned by the
  developer. `sync` leaves yours alone unless you pass `--force`.

A push of a schema that already matches the dashboard is a no-op and does not
bump the revision. Your Figma token is never synced, and nothing here ever
writes to git.

## License

MIT
