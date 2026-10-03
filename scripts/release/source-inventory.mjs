import { git, repositoryRoot } from './common.mjs'

// These are repository-root outputs, never a nested
// `output/` directory inside application, Edge, public or release source.
const generatedRoots = [
  'node_modules/', 'dist/', 'dist-ssr/', 'output/release/', '.vitest/',
  'coverage/', '.playwright-cli/', '.playwright-mcp/',
]
// Exempt actual generated CLI metadata files, not arbitrary source placed in
// an ignored Supabase directory. Never read their possibly sensitive contents.
const supabaseMetadata = new Set([
  'supabase/.branches/_current_branch',
  ...['cli-latest', 'gotrue-version', 'linked-project.json', 'pooler-url',
    'postgres-version', 'project-ref', 'rest-version', 'storage-migration',
    'storage-version'].map(name => `supabase/.temp/${name}`),
])
const sourceRoots = ['src', 'scripts', 'supabase', '.github', 'public']
const rootConfigPatterns = [
  'package.json', 'package-lock.json', 'vite.config.*', 'tsconfig*',
  'eslint.config.*', '.eslintrc*', '.oxlintrc*', 'oxlint.config.*',
  '.nvmrc', '.node-version', 'index.html', 'deno.lock', '.gitignore', '.env.example',
  '.env', '.env.*',
]

function parseInventory(raw) {
  if (typeof raw !== 'string' || (raw && !raw.endsWith('\0'))) {
    throw new Error('Source inventory is not NUL terminated')
  }
  if (!raw) return []
  return raw.slice(0, -1).split('\0').map(file => {
    // Git emits repository-relative slash-separated paths on Windows too.
    // Refuse ambiguous names instead of normalizing them into a different file.
    if (!file || file.includes('\\') || [...file].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || file.startsWith('/')
      || /^[A-Za-z]:/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Unsafe source inventory path')
    }
    return file
  })
}

function generated(file) {
  const lower = file.toLowerCase()
  return generatedRoots.some(root => lower.startsWith(root) || lower === root.slice(0, -1))
    || supabaseMetadata.has(lower)
    || /^supabase\/\.temp\/start-secrets\/[^/]+\/env\/docker\.env$/.test(lower)
}

function relevantClass(file) {
  const lower = file.toLowerCase()
  const root = sourceRoots.find(name => lower === name || lower.startsWith(`${name}/`))
  if (root) return `${root}/`
  if (/^(?:package(?:-lock)?\.json|vite\.config\.[^/]+|tsconfig[^/]*|eslint\.config\.[^/]+|\.eslintrc[^/]*|\.oxlintrc[^/]*|oxlint\.config\.[^/]+|\.nvmrc|\.node-version|index\.html|deno\.lock|\.gitignore|\.env\.example)$/.test(lower)) {
    return 'root build/config files'
  }
  return undefined
}

/** Shared fail-closed inventory for classification, preflight and evidence. */
export function readSourceInventory({ cwd = repositoryRoot } = {}, dependencies = {}) {
  const readGit = dependencies.git ?? git
  const tracked = parseInventory(readGit(['ls-files', '--cached', '-z', '--'], { cwd }))
  const untracked = parseInventory(readGit(['ls-files', '--others', '--exclude-standard', '-z', '--'], { cwd }))
    .filter(file => !generated(file))
  // Limit the ignored query to source/config pathspecs so dependencies and
  // generated root outputs do not become an expensive or sensitive inventory.
  const ignored = parseInventory(readGit([
    'ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--',
    ...[...sourceRoots, ...rootConfigPatterns].map(pattern => `:(icase)${pattern}`),
  ], { cwd }))
  const ignoredConfig = []
  for (const file of ignored) {
    // Vite reads legitimate ignored root dotenv configuration. Bind those
    // inputs to evidence without printing or persisting any configuration value.
    if (/^\.env(?:\.[^/]+)?$/i.test(file) && file.toLowerCase() !== '.env.example') {
      ignoredConfig.push(file)
      untracked.push(file)
      continue
    }
    const pathClass = relevantClass(file)
    if (pathClass && !generated(file)) {
      throw new Error(`Ignored release-relevant source under ${pathClass}; source inventory is incomplete`)
    }
  }
  // Tracked files always remain covered, even inside a generated-looking path.
  return {
    files: [...new Set([...tracked, ...untracked])].sort(),
    untracked: [...new Set(untracked)].sort(), ignoredConfig: [...new Set(ignoredConfig)].sort(),
  }
}
