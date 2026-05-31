# @design-spec/janitor — CI Drift-Janitor

The hosted half of `design-spec fix`. Runs as a GitHub Action on pull requests:
it checks out the PR branch, runs the **same** `@design-spec/compiler`
`detect`/`fix` engine the CLI runs locally, auto-commits the token-ref fixes
back onto the branch, posts a 🧹 summary comment, and **always exits 0**.

> Remediation, not obstruction. The janitor never blocks a merge.

## Usage

```yaml
# .github/workflows/janitor.yml
name: Design Spec Janitor
on: pull_request
permissions:
  contents: write          # commit the fix back onto the PR branch
  pull-requests: write      # post/update the 🧹 comment
jobs:
  janitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}   # operate on the PR branch tip
          fetch-depth: 0
      - uses: design-spec/janitor@v1
        # with:
        #   strict: true                # fail the check on advisory drift only
```

Grant **only** `contents: write` + `pull-requests: write`. Nothing else.

## Inputs

| Input | Default | Description |
|---|---|---|
| `token` | `${{ github.token }}` | Token for push + comment. |
| `schema` | `design-spec.schema.json` | Schema path, relative to repo root. |
| `source-glob` | `**/*.{ts,tsx,js,jsx,vue,css,scss,dart}` | Files to scan. |
| `strict` | `false` | Fail the check on advisory (non-fixable) drift. Auto-fixes still commit. |

## Behavior contract

- **Always exit 0** — except the sanctioned `strict: true` opt-in, which fails
  the check on remaining *advisory* drift only (auto-fixes are still committed).
- **Auto-fixable** (committed): inline hex / raw values, arbitrary Tailwind
  classes, Flutter `Color()` — whenever the compiler resolves a token within its
  own tolerance (perceptual ΔE for color, gap-relative snapping for dimensions).
  **Thresholds live in the compiler; the janitor never inlines them.**
- **Advisory** (comment only, non-blocking): values with no token in tolerance.
- **Loop-safe**: commits are authored `design-spec-janitor[bot]` and carry
  `[skip ci]`; the janitor skips any tip commit it authored.
- **Push**: `git push origin HEAD:$GITHUB_HEAD_REF --force-with-lease`. A
  concurrent manual push fails the lease → the run aborts clean and exits 0.
- **Never rewrites generated token-definition files** (`compileAll(schema)`
  filenames are excluded), so `tokens.css` etc. are left alone.

## Publish gate

The action image installs `@design-spec/compiler` from npm at the pinned
version. Per `releasing-packages`, **publish the compiler first**, then release
`design-spec/janitor@v1`. The janitor consumes the compiler as a published
artifact — never shared source.
