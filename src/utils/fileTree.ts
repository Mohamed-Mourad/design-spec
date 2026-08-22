import type { FileOutput } from '@/types/compiler'

// A folder/file tree built from flat FileOutput filenames (which may contain '/').
export interface TreeNode {
  name: string
  path: string
  children: TreeNode[]
  file?: FileOutput
}

export function buildTree(files: FileOutput[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] }
  for (const file of files) {
    const parts = file.filename.split('/')
    let node = root
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1
      let child = node.children.find((c) => c.name === part)
      if (!child) {
        child = { name: part, path: parts.slice(0, i + 1).join('/'), children: [] }
        node.children.push(child)
      }
      if (isLeaf) child.file = file
      node = child
    })
  }
  const sort = (nodes: TreeNode[]) => {
    // Folders first, then files; alphabetical within each.
    nodes.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name))
    nodes.forEach((n) => sort(n.children))
  }
  sort(root.children)
  return root.children
}
