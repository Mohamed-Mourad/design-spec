// emit-flutter.mjs — write the default schema's Flutter output into a Flutter
// project, once per naming mode, so `flutter analyze` can prove the Dart is
// valid. Each mode lands in lib/<mode>/ (the emitted imports are relative, so
// the modes don't collide). Run after `npm run build`.
//
//   node scripts/emit-flutter.mjs <flutter-project-dir>

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { compileFlutter, defaultSchema } from '../dist/index.js'

const MODES = ['prefixed-class', 'snake_const', 'raw']

const project = process.argv[2]
if (!project) {
  console.error('usage: node scripts/emit-flutter.mjs <flutter-project-dir>')
  process.exit(2)
}

for (const mode of MODES) {
  const schema = { ...defaultSchema, export: { ...defaultSchema.export, flutterNaming: mode } }
  const files = compileFlutter(schema)
  for (const file of files) {
    const out = resolve(project, 'lib', mode.replace(/-/g, '_'), file.filename.replace(/^lib\//, ''))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, file.content)
  }
  console.log(`${mode}: ${files.length} file(s) → ${join('lib', mode.replace(/-/g, '_'))}`)
}
