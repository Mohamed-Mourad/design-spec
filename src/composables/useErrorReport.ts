import { ref } from 'vue'

interface ActionEntry {
  ts: number
  action: string
  args: unknown[]
}

const isOpen = ref(false)
const capturedError = ref<Error | null>(null)
const capturedTrace = ref<ActionEntry[]>([])

export function useErrorReport() {
  function openReport(error?: Error, trace?: ActionEntry[]) {
    capturedError.value = error ?? null
    capturedTrace.value = trace ?? []
    isOpen.value = true
  }

  function closeReport() {
    isOpen.value = false
    capturedError.value = null
    capturedTrace.value = []
  }

  return { isOpen, capturedError, capturedTrace, openReport, closeReport }
}
