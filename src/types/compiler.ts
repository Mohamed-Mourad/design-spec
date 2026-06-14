// FileOutput is the compiler I/O contract — re-export from the source of truth.
// Framework is a convenience alias derived from the export config.
import type { ExportConfig } from '@design-spec/compiler'

export type { FileOutput } from '@design-spec/compiler'

export type Framework = ExportConfig['frameworks'][number]
