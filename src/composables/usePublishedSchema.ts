import { ref, type Ref } from 'vue'
import { ApiError, portfolio, type Proposal, type SnapshotLink } from '@/utils/api'
import type { DesignSystemSchema } from '@/types/schema'

/**
 * Load a schema someone else published — a proposal at `/p/{slug}`, or a
 * snapshot behind a short link.
 *
 * Shared by three routes that each render the bento from a different source but
 * need identical loading, not-found and offline behaviour. What arrives is
 * still remote JSON, so it is shape-checked exactly like a hash link is before
 * any component is handed it.
 */
export interface PublishedState {
  schema: Ref<DesignSystemSchema | null>
  proposal: Ref<Proposal | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  loadProposal: (slug: string) => Promise<void>
  loadSnapshot: (id: string) => Promise<void>
}

function isSchema(value: unknown): value is DesignSystemSchema {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  const isRecord = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)
  return typeof s.name === 'string' && isRecord(s.colors) && isRecord(s.typography)
}

export function usePublishedSchema(): PublishedState {
  const schema = ref<DesignSystemSchema | null>(null)
  const proposal = ref<Proposal | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(fetcher: () => Promise<Proposal | SnapshotLink>) {
    loading.value = true
    error.value = null
    try {
      const result = await fetcher()
      if (!isSchema(result.schema_json)) {
        error.value = 'That design system could not be read.'
        return
      }
      schema.value = result.schema_json
      proposal.value = 'slug' in result ? (result as Proposal) : null
    } catch (e) {
      error.value =
        e instanceof ApiError && e.status === 404
          ? 'There is nothing published at this address.'
          : e instanceof ApiError
            ? e.message
            : 'Could not load this design system.'
    } finally {
      loading.value = false
    }
  }

  return {
    schema,
    proposal,
    loading,
    error,
    loadProposal: (slug: string) => load(() => portfolio.getProposal(slug)),
    loadSnapshot: (id: string) => load(() => portfolio.getSnapshot(id)),
  }
}
