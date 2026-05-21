import type { ExtensionMessage } from '../shared/messages'
import { loadConfiguredHosts, BUILTIN_HOSTS } from '../shared/hosts'

const DYNAMIC_SCRIPT_ID = 'pace-editor-dynamic'

// Allow the toolbar icon to toggle the side panel on Pace tabs.
chrome.sidePanel
  ?.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.warn('[pace-editor] setPanelBehavior failed', err))

// On startup, register a content script for every opt-in host the user has
// actually granted permission for. Hosts that lost permission are silently
// dropped (the user may have revoked them in chrome://extensions).
async function syncDynamicContentScripts(): Promise<void> {
  const configured = await loadConfiguredHosts()
  const extras = configured.filter((h) => !h.builtin).map((h) => h.pattern)
  const builtinPatterns = BUILTIN_HOSTS.map((h) => h.pattern)
  const granted = await chrome.permissions.getAll()
  const grantedOrigins = new Set(granted.origins ?? [])
  // Built-in hosts are covered by manifest content_scripts; only register
  // dynamic scripts for the extras that have permission and are not
  // accidentally re-declaring a built-in pattern.
  const dynamicMatches = extras.filter(
    (p) => grantedOrigins.has(p) && !builtinPatterns.includes(p),
  )
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [DYNAMIC_SCRIPT_ID],
    })
    if (existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [DYNAMIC_SCRIPT_ID] })
    }
    if (dynamicMatches.length === 0) return
    await chrome.scripting.registerContentScripts([
      {
        id: DYNAMIC_SCRIPT_ID,
        // Re-use the same compiled content script the manifest points at;
        // crxjs copies it to a stable path in the bundle output.
        js: ['src/content/index.ts'],
        matches: dynamicMatches,
        runAt: 'document_idle',
      },
    ])
  } catch (err) {
    console.warn('[pace-editor] failed to sync dynamic content scripts', err)
  }
}

chrome.runtime.onInstalled.addListener(() => void syncDynamicContentScripts())
chrome.runtime.onStartup.addListener(() => void syncDynamicContentScripts())
chrome.permissions?.onAdded?.addListener(() => void syncDynamicContentScripts())
chrome.permissions?.onRemoved?.addListener(() => void syncDynamicContentScripts())

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
  if (message.type === 'PACE_OPEN_EDITOR') {
    const tabId = sender.tab?.id
    const windowId = sender.tab?.windowId
    if (windowId !== undefined) {
      // sidePanel.open is gated on a user gesture; the content-script click
      // counts as one because it was forwarded synchronously from a real
      // event handler.
      chrome.sidePanel.open({ windowId, tabId }).catch((err) => {
        console.warn('[pace-editor] failed to open side panel', err)
      })
    }
  }
})

// When the side panel asks for a snapshot it doesn't know which tab Pace
// is in, so the background worker resolves that on its behalf and forwards.
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type !== 'PACE_REQUEST_SNAPSHOT' && message.type !== 'PACE_WRITE_REPEATING_CODE') {
    return false
  }
  if (sender.tab) return false
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (!tab?.id) {
      sendResponse({ ok: false, error: 'No active tab' })
      return
    }
    try {
      const reply = await chrome.tabs.sendMessage(tab.id, message)
      sendResponse(reply)
    } catch (err) {
      sendResponse({ ok: false, error: (err as Error).message })
    }
  })()
  return true
})
