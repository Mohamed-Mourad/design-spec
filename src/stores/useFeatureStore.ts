// useFeatureStore — the feature request board.
//
// Two things this store is careful about, both of them the same idea from
// different ends:
//
//  1. **It never computes a vote's weight.** The weight comes back from the API,
//     resolved from the account's plan; nothing here multiplies by 5. An
//     optimistic bump uses the tier the entitlement call reported, and is
//     immediately settled against the `vote_count` the server returns — so a
//     wrong guess is visible for one round trip and never persists.
//  2. **Dedup is advisory.** A failed or unavailable probe leaves the submit
//     form exactly as usable as a successful one. The suggestion list is a
//     shortcut to an existing request, never a gate on filing a new one.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  ApiError,
  api,
  apiConfigured,
  features,
  githubLogin,
  sessionToken,
  type FeatureRequest,
  type FeatureStatus,
} from '@/utils/api'
import { trackEvent } from '@/utils/telemetry'

/** How long to wait after the last keystroke before asking for suggestions. */
export const DEDUP_DEBOUNCE_MS = 300

/** Below this, a title is too short to mean anything to a vector search. */
export const MIN_DEDUP_QUERY = 8

export const useFeatureStore = defineStore('features', () => {
  const requests = ref<FeatureRequest[]>([])
  const cursor = ref<string | null>(null)
  const statusFilter = ref<FeatureStatus | ''>('')

  const loading = ref(false)
  const loadingMore = ref(false)
  const submitting = ref(false)
  const voting = ref<string | null>(null)
  const error = ref('')

  const draftTitle = ref('')
  const draftDescription = ref('')
  const similar = ref<FeatureRequest[]>([])
  const probing = ref(false)
  /** False when the deployment cannot suggest at all, or the provider failed. */
  const dedupAvailable = ref(true)

  /** The viewer's plan, for the vote-weight hint and the Free upsell. */
  const tier = ref<'free' | 'pro'>('free')

  const available = computed(() => apiConfigured())
  const signedIn = computed(() => sessionToken() !== null)
  const hasMore = computed(() => cursor.value !== null)
  const voteWeight = computed(() => (tier.value === 'pro' ? 5 : 1))
  /** A Free voter is shown what Pro would be worth — never a blocked button. */
  const showUpsell = computed(() => signedIn.value && tier.value === 'free')

  let probeTimer: ReturnType<typeof setTimeout> | undefined
  // Only the newest probe may write to `similar`: a slow early request must not
  // land on top of the answer for what is now in the box.
  let probeSeq = 0

  function reportError(err: unknown, fallback: string): void {
    error.value = err instanceof ApiError ? err.message : fallback
  }

  /** Load the first page, replacing whatever is on screen. */
  async function load(): Promise<void> {
    if (!available.value) return
    loading.value = true
    error.value = ''
    try {
      const page = await features.board({
        status: statusFilter.value === '' ? undefined : statusFilter.value,
      })
      requests.value = page.data
      cursor.value = page.next_cursor
    } catch (err) {
      reportError(err, 'Could not load the feature board.')
    } finally {
      loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (!cursor.value || loadingMore.value) return
    loadingMore.value = true
    try {
      const page = await features.board({
        cursor: cursor.value,
        status: statusFilter.value === '' ? undefined : statusFilter.value,
      })
      requests.value = [...requests.value, ...page.data]
      cursor.value = page.next_cursor
    } catch (err) {
      reportError(err, 'Could not load more requests.')
    } finally {
      loadingMore.value = false
    }
  }

  async function setStatus(next: FeatureStatus | ''): Promise<void> {
    statusFilter.value = next
    cursor.value = null
    await load()
  }

  /**
   * Read the viewer's plan so the board can say what a vote is worth.
   *
   * Best-effort: a failure leaves the hint at Free, which understates rather
   * than overstates. The number that counts is the one the vote returns.
   */
  async function loadTier(): Promise<void> {
    const login = githubLogin()
    if (!login || !available.value) return
    try {
      const ent = await api.entitlement(login)
      tier.value = ent.hosted_janitor ? 'pro' : 'free'
    } catch {
      tier.value = 'free'
    }
  }

  async function init(): Promise<void> {
    await Promise.all([load(), loadTier()])
  }

  // ── dedup ──────────────────────────────────────────────────────────────────

  /**
   * Ask for similar requests, 300 ms after typing stops.
   *
   * Never sets `error`: a probe that fails is a missing shortcut, not something
   * the person filing did wrong, and putting it in the error slot would make it
   * look like the form is broken.
   */
  function probeSimilar(query: string): void {
    clearTimeout(probeTimer)
    const q = query.trim()
    if (q.length < MIN_DEDUP_QUERY) {
      similar.value = []
      probing.value = false
      return
    }
    if (!available.value || !signedIn.value) return

    probeTimer = setTimeout(() => {
      const seq = ++probeSeq
      probing.value = true
      features
        .similar(q)
        .then((res) => {
          if (seq !== probeSeq) return
          similar.value = res.data
          dedupAvailable.value = res.dedup_available
        })
        .catch(() => {
          if (seq !== probeSeq) return
          similar.value = []
          dedupAvailable.value = false
        })
        .finally(() => {
          if (seq === probeSeq) probing.value = false
        })
    }, DEDUP_DEBOUNCE_MS)
  }

  function cancelProbe(): void {
    clearTimeout(probeTimer)
    probeSeq++
    probing.value = false
  }

  function resetDraft(): void {
    cancelProbe()
    draftTitle.value = ''
    draftDescription.value = ''
    similar.value = []
  }

  // ── writes ─────────────────────────────────────────────────────────────────

  /** File the draft. Returns the created request, or null on failure. */
  async function submit(): Promise<FeatureRequest | null> {
    if (submitting.value) return null
    submitting.value = true
    error.value = ''
    try {
      const created = await features.file(draftTitle.value, draftDescription.value)
      requests.value = [created, ...requests.value]
      resetDraft()
      trackEvent('feature_request_filed', { weight: created.viewer_vote?.weight ?? 1 })
      return created
    } catch (err) {
      reportError(err, 'Could not file that request.')
      return null
    } finally {
      submitting.value = false
    }
  }

  /**
   * Vote on a request, from the board or from a suggestion.
   *
   * The optimistic bump is the tier hint; the settle is the server's count. A
   * 409 means this account already voted — the row is marked rather than
   * treated as an error, because it is the true state, just not the one the
   * button assumed.
   */
  async function vote(id: string): Promise<void> {
    if (voting.value) return
    const row = find(id)
    if (!row || row.viewer_vote) return

    voting.value = id
    error.value = ''
    const optimistic = voteWeight.value
    patch(id, (r) => ({
      ...r,
      vote_count: r.vote_count + optimistic,
      viewer_vote: { weight: optimistic, created_at: new Date().toISOString() },
    }))

    try {
      const cast = await features.vote(id)
      patch(id, (r) => ({
        ...r,
        vote_count: cast.vote_count,
        viewer_vote: { weight: cast.weight, created_at: cast.created_at },
      }))
      trackEvent('feature_vote_cast', { weight: cast.weight })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already voted. Keep the marked state, drop the double count.
        patch(id, (r) => ({ ...r, vote_count: r.vote_count - optimistic }))
        return
      }
      patch(id, (r) => ({ ...r, vote_count: r.vote_count - optimistic, viewer_vote: null }))
      reportError(err, 'Could not record that vote.')
    } finally {
      voting.value = null
    }
  }

  function find(id: string): FeatureRequest | undefined {
    return requests.value.find((r) => r.id === id) ?? similar.value.find((r) => r.id === id)
  }

  /** Apply an update to a request wherever it is shown — board and suggestions. */
  function patch(id: string, update: (r: FeatureRequest) => FeatureRequest): void {
    requests.value = requests.value.map((r) => (r.id === id ? update(r) : r))
    similar.value = similar.value.map((r) => (r.id === id ? update(r) : r))
  }

  return {
    requests,
    similar,
    statusFilter,
    loading,
    loadingMore,
    submitting,
    voting,
    probing,
    dedupAvailable,
    error,
    draftTitle,
    draftDescription,
    tier,
    available,
    signedIn,
    hasMore,
    voteWeight,
    showUpsell,
    init,
    load,
    loadMore,
    setStatus,
    loadTier,
    probeSimilar,
    cancelProbe,
    resetDraft,
    submit,
    vote,
  }
})
