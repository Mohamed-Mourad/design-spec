# Design Spec

Generate the AI context files that teach your coding agents to build visually consistent UI — without repeating your design rules in every prompt.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/design-spec)](https://www.npmjs.com/package/design-spec)

---

## What It Does

AI coding agents don't know your design system. Each generated screen picks arbitrary colors, spacing, and typography — and they all look different.

Design Spec gives you two files your agents understand natively:

**`DESIGN.md`** — your visual identity in plain text: color tokens, typography scales, spacing, elevation, and component styles. Drop it in your project root and every AI tool that reads project context now knows your brand.

**`SKILL.md`** — coding rules and component examples for your framework. The agent knows not just what your colors are, but how to use them in React, Vue, or Flutter code.

---

## Get Started

### Web App

Visit **[design-spec.ai](https://design-spec.ai)** — no install required.

1. Configure your design tokens (colors, typography, spacing, components)
2. Select your target framework (React + Tailwind, Vue, Flutter)
3. Export — download a ZIP or push directly to a GitHub repo

The export includes `DESIGN.md`, `SKILL.md`, theme config files, and typed component stubs.

### CLI

Use the CLI to initialize Design Spec inside an existing project:

```bash
npx design-spec init
```

The CLI scans your project, detects your framework, extracts existing tokens from `tailwind.config.js` or CSS variables, and generates `DESIGN.md` and `SKILL.md` in your project root.

```bash
# Sync latest changes from your dashboard
npx design-spec sync --key <your-api-key>

# Push local token changes back to the dashboard
npx design-spec push --key <your-api-key>

# Show drift between your config and DESIGN.md
npx design-spec diff
```

Get your API key from the dashboard under **Settings → Developer**.

---

## What You Get

A typical export for a React + Tailwind project:

```
your-design-system/
├── DESIGN.md              ← drop in your project root
├── SKILL.md               ← drop in .claude/, .cursor/, or .windsurf/
├── tailwind.config.js     ← extend your existing Tailwind config
├── tokens.css             ← CSS custom properties
└── src/components/
    ├── Button/Button.tsx
    ├── Input/Input.tsx
    ├── Card/Card.tsx
    └── ...
```

**Example `DESIGN.md` snippet:**

```yaml
---
name: Acme Design System
colors:
  primary: "#3B6EF5"
  surface-default: "#FFFFFF"
  on-surface: "#0F172A"
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: 6px
    paddingX: 16px
---
```

---

## Features

- **Full token editor** — colors with semantic roles, typography scales, spacing, shadows, border radius, motion, z-index, breakpoints, icon sizes
- **Responsive component tokens** — define how each component looks at mobile, tablet, and desktop; compilers emit the correct Tailwind responsive prefixes or CSS media queries
- **Multi-framework export** — React + Tailwind, Vue + CSS variables, Flutter *(coming)*
- **Component blueprints** — props, variants, states, and anatomy documented in `SKILL.md` so agents build the right structure, not just the right colors
- **Bento preview** — a full-page visual overview of your entire design system; share the link with designers and managers for quick approvals
- **Figma token sync** *(Pro)* — paste a Figma file URL to import colors and typography directly
- **GitHub push** *(Pro)* — provision a repo and commit your full bundle in one click, no terminal needed

---

## Using the Output

### With Claude Code

```bash
cp SKILL.md .claude/skills/my-design-system/SKILL.md
cp DESIGN.md ./DESIGN.md
```

Claude Code will automatically load both files when working in your project.

### With Cursor

```bash
cp SKILL.md .cursor/rules/my-design-system.md
cp DESIGN.md ./DESIGN.md
```

### With any agent

`DESIGN.md` at your project root is read by any AI tool that respects project context. Reference it explicitly in prompts when needed:

```
Build a user profile card following the design system in DESIGN.md.
```

---

## Self-Hosting

Design Spec is a static Vue 3 app — export and preview work entirely in the browser, no backend required.

```bash
git clone https://github.com/your-org/design-spec.git
cd design-spec
npm install
npm run dev
```

---

## Contributing

Contributions are welcome. Before opening a pull request:

1. Read `.claude/skills/frontend/SKILL.md` — coding conventions for this codebase
2. Run `npm run type-check` — must pass
3. Keep changes focused; one concern per PR

For significant changes, open an issue first.

---

## License

MIT — see [LICENSE](LICENSE).
