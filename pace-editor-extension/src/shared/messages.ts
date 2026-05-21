// Message contracts shared between content script, background and side panel.
// Keep the union flat so chrome.runtime.sendMessage discriminates on `type`.

export interface PaceModelSnapshot {
  // Pace's model title from the "Title" input.
  title: string
  outputFormat: 'json' | 'custom' | 'unknown'
  codeBefore: string
  repeatingCode: string
  codeAfter: string
  // Field refs scraped from the "Fields" strip (raw text inside braces).
  fields: string[]
  // The current hash route at the moment of capture, eg. "#modelId=42&show=modelEdit".
  hash: string
  // The host the content script is running on, eg. "pace-bp.xsdirect.nl".
  host: string
}

export interface PaceModelInfo {
  id: string
  title: string
  type: 'download' | 'export' | 'other'
  client: string // extracted client name (e.g. "Aidsfonds")
}

export type ExtensionMessage =
  | { type: 'PACE_OPEN_EDITOR' }
  | { type: 'PACE_REQUEST_SNAPSHOT' }
  | { type: 'PACE_REQUEST_SNAPSHOT_BY_ID'; blockId: string }
  | { type: 'PACE_LIST_MODELS' }
  | { type: 'PACE_SNAPSHOT'; snapshot: PaceModelSnapshot }
  | { type: 'PACE_WRITE_REPEATING_CODE'; value: string; codeBefore?: string; codeAfter?: string; blockId?: string }
  | { type: 'PACE_WRITE_RESULT'; ok: boolean; error?: string }
  | { type: 'PACE_CONTEXT_LOST' }

export type ExtensionResponse =
  | { ok: true }
  | { ok: false; error: string }
