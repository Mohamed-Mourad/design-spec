// projectSlug — a dashboard project's slug from a design system's name.
//
// Must match the CLI's `projectSlug` (packages/cli/src/sync/merge.ts): both
// sides default a project to its schema name, and if they slugged it
// differently a workspace save and a `design-spec push` of the same system
// would land in two projects. The parity cases are pinned in the tests of both.

export function projectSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // strip the accents NFKD split off
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
}
