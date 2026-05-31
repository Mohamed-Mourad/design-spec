import { ref } from 'vue'
import type { ReportKind } from '@/utils/telemetry'

interface ActionEntry {
  ts: number
  action: string
  args: unknown[]
}

const isOpen = ref(false)
const capturedError = ref<Error | null>(null)
const capturedTrace = ref<ActionEntry[]>([])
const capturedKind = ref<ReportKind>('error')

export function useErrorReport() {
  /** Open the report modal for a caught error (ErrorBoundary path). */
  function openReport(error?: Error, trace?: ActionEntry[]) {
    capturedError.value = error ?? null
    capturedTrace.value = trace ?? []
    capturedKind.value = 'error'
    isOpen.value = true
  }

  /** Open the report modal for proactively-flagged behavior — no error, just the
   *  user's comment + the recent action trace for context. */
  function openBehaviorReport(trace?: ActionEntry[]) {
    capturedError.value = null
    capturedTrace.value = trace ?? []
    capturedKind.value = 'behavior'
    isOpen.value = true
  }

  function closeReport() {
    isOpen.value = false
    capturedError.value = null
    capturedTrace.value = []
    capturedKind.value = 'error'
  }

  return { isOpen, capturedError, capturedTrace, capturedKind, openReport, openBehaviorReport, closeReport }
}
