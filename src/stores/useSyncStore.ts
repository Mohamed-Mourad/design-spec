// useSyncStore — developer API keys and the dashboard copy of a workspace.
//
// The dashboard is where the CLI and this app meet (architecture-plan §16.4,
// §20): a developer's `design-spec push` lands a schema here, a designer opens
// it as a workspace, edits presentation (bento layout, branding, sharing) and
// saves it back, and the developer's `design-spec sync` pulls that
// presentation — remote wins — without touching their export config.
//
// Three rules this store keeps:
//  1. A freshly minted API key lives in memory only, for the one screen that
//     shows it. It is never written to localStorage and never re-fetchable.
//  2. Saving is dashboard-only. No git, no branch — that is "Push to GitHub".
//  3. A save names the revision this workspace last saw; if the CLI pushed in
//     between, the answer is a conflict to resolve, not a silent overwrite.
//
// The Figma PAT has nothing to do with any of this and never passes through.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { projectSlug } from '@/utils/projectSlug'
import {
  ApiError,
  apiConfigured,
  dashboard,
  sessionToken,
  type DashboardProject,
  type DeveloperKey,
} from '@/utils/api'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

/** Which dashboard project a workspace is linked to, and the revision it last saw. */
export interface DashboardLink {
  project: string
  revision: number
}

const linkKey = (workspaceId: string) => `dsa-ws-dashboard-${workspaceId}`

function readLink(workspaceId: string): DashboardLink | null {
  try {
    const raw = localStorage.getItem(linkKey(workspaceId))
    return raw ? (JSON.parse(raw) as DashboardLink) : null
  } catch {
    return null
  }
}

function writeLink(workspaceId: string, link: DashboardLink): void {
  try {
    localStorage.setItem(linkKey(workspaceId), JSON.stringify(link))
  } catch {
    /* private mode — the link just won't survive a reload */
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export const useSyncStore = defineStore('dashboardSync', () => {
  const ds = useDesignSystemStore()

  const keys = ref<DeveloperKey[]>([])
  const projects = ref<DashboardProject[]>([])
  /** The one-time plaintext of a key just minted. Memory only. */
  const revealedKey = ref<DeveloperKey | null>(null)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)

  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const lastSaved = ref<DashboardProject | null>(null)

  /** Bumped on every link write so `activeLink` re-reads localStorage. */
  const linkTick = ref(0)

  // A plain ref, refreshed on demand: the session lives in localStorage, which
  // Vue cannot observe, so a computed over it would cache a stale answer.
  const available = ref(false)
  function checkSession(): boolean {
    available.value = apiConfigured() && sessionToken() !== null
    return available.value
  }

  const activeLink = computed<DashboardLink | null>(() => {
    void linkTick.value
    return readLink(ds.activeWorkspaceId)
  })

  /** Where a save of the active workspace goes. */
  const activeTarget = computed(() => activeLink.value?.project ?? projectSlug(ds.schema.name))

  async function init(): Promise<void> {
    if (!checkSession()) return
    loading.value = true
    error.value = null
    try {
      const [k, p] = await Promise.all([dashboard.keys(), dashboard.projects()])
      keys.value = k.data
      projects.value = p.data
    } catch (e) {
      error.value = message(e)
    } finally {
      loading.value = false
    }
  }

  async function generateKey(environment: 'live' | 'test'): Promise<void> {
    busy.value = true
    error.value = null
    try {
      const minted = await dashboard.createKey(environment)
      revealedKey.value = minted
      // The list never holds a plaintext: store the masked shape only.
      const { key: _plaintext, ...masked } = minted
      keys.value = [...keys.value.filter((k) => k.environment !== environment), masked]
    } catch (e) {
      error.value = message(e)
    } finally {
      busy.value = false
    }
  }

  function dismissRevealedKey(): void {
    revealedKey.value = null
  }

  async function revokeKey(id: string): Promise<void> {
    busy.value = true
    error.value = null
    try {
      await dashboard.revokeKey(id)
      keys.value = keys.value.filter((k) => k.id !== id)
      if (revealedKey.value?.id === id) revealedKey.value = null
    } catch (e) {
      error.value = message(e)
    } finally {
      busy.value = false
    }
  }

  async function refreshProjects(): Promise<void> {
    try {
      projects.value = (await dashboard.projects()).data
    } catch (e) {
      error.value = message(e)
    }
  }

  /**
   * Open the dashboard's latest copy of a project as a new, linked workspace.
   *
   * A workspace previously linked to the same project is kept — it may hold
   * edits that were never saved — but unlinked, so only the fresh copy saves
   * back and the stale one can't trip the revision check by accident.
   */
  async function openProject(slug: string): Promise<void> {
    busy.value = true
    error.value = null
    try {
      const remote = await dashboard.project(slug)
      for (const w of ds.workspaces) {
        if (readLink(w.id)?.project === slug) localStorage.removeItem(linkKey(w.id))
      }
      const id = ds.createWorkspaceFromSchema(remote.name || slug, remote.schema_json)
      writeLink(id, { project: slug, revision: remote.revision })
      linkTick.value++
    } catch (e) {
      error.value = message(e)
    } finally {
      busy.value = false
    }
  }

  /** Save the active workspace to its dashboard project. */
  async function saveActive(): Promise<void> {
    saving.value = true
    saveError.value = null
    const workspaceId = ds.activeWorkspaceId
    const link = activeLink.value
    const slug = activeTarget.value
    try {
      if (!slug) throw new Error('Name the design system before saving it to the dashboard.')
      const saved = await dashboard.save(slug, ds.schema, link?.revision ?? 0)
      writeLink(workspaceId, { project: slug, revision: saved.revision })
      linkTick.value++
      lastSaved.value = saved
      projects.value = [saved, ...projects.value.filter((p) => p.project !== slug)]
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        saveError.value = link
          ? 'The dashboard changed since you opened this (a CLI push?). Re-open it from Settings to get the latest, then re-apply your edit.'
          : `A dashboard project "${slug}" already exists. Open it from Settings → Developer to edit it.`
      } else if (e instanceof ApiError && e.status === 403) {
        saveError.value = 'Free accounts sync one project. Upgrade to Pro for unlimited.'
      } else {
        saveError.value = message(e)
      }
    } finally {
      saving.value = false
    }
  }

  /**
   * Delete a dashboard project (session only — the API refuses a key). Any
   * workspace linked to it is unlinked; the workspace itself stays, since it
   * lives in this browser and may hold unsaved work.
   */
  async function deleteProject(slug: string): Promise<void> {
    busy.value = true
    error.value = null
    try {
      await dashboard.remove(slug)
      for (const w of ds.workspaces) {
        if (readLink(w.id)?.project === slug) localStorage.removeItem(linkKey(w.id))
      }
      linkTick.value++
      projects.value = projects.value.filter((p) => p.project !== slug)
    } catch (e) {
      error.value = message(e)
    } finally {
      busy.value = false
    }
  }

  return {
    keys,
    projects,
    revealedKey,
    loading,
    busy,
    error,
    saving,
    saveError,
    lastSaved,
    available,
    checkSession,
    activeLink,
    activeTarget,
    init,
    generateKey,
    dismissRevealedKey,
    revokeKey,
    refreshProjects,
    openProject,
    saveActive,
    deleteProject,
  }
})
