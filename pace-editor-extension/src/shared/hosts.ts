// Runtime-configurable list of hosts the extension activates on. The
// manifest pins https://pace-bp.xsdirect.nl/*; everything else is opt-in
// via the options page, which calls chrome.permissions.request and then
// registers a dynamic content script for the host.

export interface ConfiguredHost {
  // Display label, eg. "Pace Production".
  label: string
  // Origin pattern, eg. "https://pace-bp-stg.xsdirect.nl/*".
  pattern: string
  // True for hosts that are baked into the manifest and can't be removed.
  builtin?: boolean
}

const STORAGE_KEY = 'pace.hosts.v1'

export const BUILTIN_HOSTS: ConfiguredHost[] = [
  { label: 'Pace Production', pattern: 'https://pace-bp.xsdirect.nl/*', builtin: true },
]

export async function loadConfiguredHosts(): Promise<ConfiguredHost[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return BUILTIN_HOSTS
  const data = await chrome.storage.local.get(STORAGE_KEY)
  const extra: ConfiguredHost[] = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : []
  return [...BUILTIN_HOSTS, ...extra.filter((h) => !BUILTIN_HOSTS.some((b) => b.pattern === h.pattern))]
}

export async function saveExtraHosts(extra: ConfiguredHost[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return
  await chrome.storage.local.set({ [STORAGE_KEY]: extra.filter((h) => !h.builtin) })
}

// Translate a user-supplied "pace-bp-stg.xsdirect.nl" into a manifest match
// pattern, with sanity checks. Returns null if the input doesn't look like
// a hostname we can safely activate on.
export function normalizeHostInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // Allow either bare hostname or a full pattern.
  if (trimmed.startsWith('https://')) {
    return trimmed.endsWith('/*') ? trimmed : trimmed.replace(/\/?$/, '/*')
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) return null
  return `https://${trimmed}/*`
}
