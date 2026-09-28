# Development — Repo Topology & Dev/Prod Linking

How the four repos resolve `@design-spec/compiler` in development vs production.
Bootstrapped in Phase 0.9 (see `architecture-plan.md`).

## Repos

| Repo | Visibility | Role |
|---|---|---|
| `design-spec/` | public | OSS monorepo — `packages/compiler` (published to npm), `packages/cli`, `packages/janitor`, web SPA |
| `design-spec-backend/` | private | Go HTTP API + PostgreSQL (incl. `staging_changes`) |
| `design-spec-admin/` | private | Vue 3 admin SPA |
| `design-spec-figma-plugin/` | private / closed-source | Two-way Figma sandbox; consumes published `@design-spec/compiler` |

## Intra-repo (the public monorepo)

`cli`, `janitor`, and the web app consume `@design-spec/compiler` through native
npm **workspaces** (`"workspaces": ["packages/*"]`). The workspace protocol
resolves to local source — no manual linking, and dev matches prod.

```bash
npm install                 # at design-spec/ root — links all packages/*
npm run build:compiler      # build @design-spec/compiler
```

## Cross-repo (private plugin -> compiler, before npm publish)

A separate git repo cannot be workspace-linked. Until `@design-spec/compiler`
is on npm, simulate the package boundary with **yalc** — it mimics a real
registry install into `node_modules`, avoiding the symlink/dedupe traps
`npm link` hits on a package that carries its own deps.

```bash
# 1. publish the compiler to the local yalc store (run in the public repo)
cd design-spec/packages/compiler
npm run build
npx yalc publish

# 2. link it into the plugin WITHOUT mutating package.json (run in the plugin repo)
cd ../../../design-spec-figma-plugin
npm install
npm run link:compiler        # -> npx yalc link @design-spec/compiler

# 3. propagate a compiler change live
cd ../design-spec/packages/compiler
npm run build && npx yalc push
```

`yalc link` (not `yalc add`) is used on purpose: it installs the overlay into
`node_modules` **without** rewriting the plugin's `package.json`.

### Manifest discipline

- The plugin's `package.json` always pins the real semver:
  `"@design-spec/compiler": "^0.7.0"`.
- The yalc overlay lives only in `node_modules` + `.yalc/`, both git-ignored.
- **Never commit** `file:../` or `link:` paths. The committed manifest is
  already production-shaped, so nothing has to change at publish time.

## Publish gate (end of build sprint)

The CLI ships as **`@design-spec/cli`** (command name `design-spec`). The
unscoped npm name `design-spec` belongs to an unrelated third party, so every
instruction uses `npx @design-spec/cli …` — never `npx design-spec …`, which
would run their binary. `src/test/npxName.test.ts` fails the web suite on a
regression. Before publishing, prove the tarballs work without the registry:

```bash
npm run build:compiler && npm run build --workspace @design-spec/cli
npm pack --workspace @design-spec/compiler --workspace @design-spec/cli --dry-run   # dist + README + LICENSE only
npm pack --workspace @design-spec/compiler --workspace @design-spec/cli --pack-destination /tmp/ds
cd /tmp/ds && npm init -y && npm i ./design-spec-compiler-*.tgz ./design-spec-cli-*.tgz
npx design-spec init --yes && npx design-spec compile && npx design-spec lint
```

```bash
# publish the real package
cd design-spec
npm run publish:compiler                 # @design-spec/compiler -> npm (always first)
npm run publish:cli                      # @design-spec/cli -> npm (exact-pins the compiler)

# drop the local overlay in the plugin; resolve from the registry
cd ../design-spec-figma-plugin
npm run unlink:compiler                  # -> npx yalc remove @design-spec/compiler
npm install                              # clean install from npm
npm run build                            # verify from-scratch build, zero local links
```

CI for the plugin runs a from-scratch clone + `npm ci` + `npm run build` to
prove it builds purely against the published artifact — no local links.

**Dev = local yalc overlay. Prod/CI = pinned registry artifact.**
