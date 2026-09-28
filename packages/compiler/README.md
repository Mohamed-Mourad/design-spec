# @design-spec/compiler

Pure, deterministic compilers from a Design Spec schema
(`design-spec.schema.json`) to code: `DESIGN.md`, `SKILL.md`, CSS custom
properties, `tailwind.config.js`, React / Vue component stubs, and Flutter
theme + widget files. It also carries token drift detection (`detect`, `fix`),
static token extraction from existing configs, and the MCP semantic routing the
CLI's `serve` uses.

It is the engine shared by the Design Spec web workspace, the
[`@design-spec/cli`](https://www.npmjs.com/package/@design-spec/cli), and the CI
Drift-Janitor.

```bash
npm i @design-spec/compiler
```

```ts
import { compileAll, defaultSchema } from '@design-spec/compiler'

const files = compileAll(defaultSchema) // FileOutput[]: { filename, content, language }
```

Every compiler is a pure `(schema) => output` function: no I/O, no clock, no
randomness. The same schema always produces byte-identical output.

The one side-effecting helper, `atomicWrite`, lives on a separate Node-only
entry so the main entry stays browser-safe:

```ts
import { atomicWrite } from '@design-spec/compiler/node'
```

ESM only. Requires Node 18 or newer.

## License

MIT
