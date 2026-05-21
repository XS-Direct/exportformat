import type { ExtensionMessage } from '../shared/messages'
import { loadConfiguredHosts, BUILTIN_HOSTS } from '../shared/hosts'

// --- Auto-update check ---
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000 // 1 hour
const GITHUB_REPO = 'XS-Direct/exportformat'
const PACKAGE_PATH = 'pace-editor-extension/package.json'

async function checkForUpdate(): Promise<void> {
  try {
    const currentVersion = chrome.runtime.getManifest().version
    const resp = await fetch(
      `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${PACKAGE_PATH}`,
      { cache: 'no-store' },
    )
    if (!resp.ok) return
    const pkg = await resp.json()
    const remoteVersion = pkg.version
    if (remoteVersion && remoteVersion !== currentVersion) {
      console.log(`[pace-editor] Update available: ${currentVersion} → ${remoteVersion}`)
      await chrome.storage.local.set({
        'pace.update': { current: currentVersion, remote: remoteVersion, checkedAt: Date.now() },
      })
      // Show badge on extension icon
      chrome.action.setBadgeText({ text: '!' })
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' })
    } else {
      await chrome.storage.local.remove('pace.update')
      chrome.action.setBadgeText({ text: '' })
    }
  } catch (err) {
    console.warn('[pace-editor] update check failed:', err)
  }
}

// Check on install/startup and then periodically
chrome.runtime.onInstalled.addListener(() => void checkForUpdate())
chrome.runtime.onStartup.addListener(() => void checkForUpdate())
setInterval(() => void checkForUpdate(), UPDATE_CHECK_INTERVAL)

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
    console.log('[pace-editor][bg] forwarding', message.type, 'to tab:', tab?.id, tab?.url)
    if (!tab?.id) {
      console.warn('[pace-editor][bg] no active tab found')
      sendResponse({ ok: false, error: 'No active tab' })
      return
    }
    try {
      const reply = await chrome.tabs.sendMessage(tab.id, message)
      console.log('[pace-editor][bg] got reply from content:', reply?.ok, 'error:', reply?.error)
      sendResponse(reply)
    } catch (err) {
      const errMsg = (err as Error).message
      // "Receiving end does not exist" = content script not loaded (e.g. after
      // extension reload). Inject it on the fly and retry once.
      if (errMsg.includes('Receiving end does not exist')) {
        console.warn('[pace-editor][bg] content script not loaded, injecting...')
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/content/index.ts'],
          })
          // Wait briefly for the script to initialize
          await new Promise((r) => setTimeout(r, 300))
          const retry = await chrome.tabs.sendMessage(tab.id, message)
          console.log('[pace-editor][bg] retry succeeded:', retry?.ok)
          sendResponse(retry)
        } catch (retryErr) {
          console.error('[pace-editor][bg] inject+retry failed:', (retryErr as Error).message)
          sendResponse({ ok: false, error: (retryErr as Error).message })
        }
      } else {
        console.error('[pace-editor][bg] sendMessage failed:', errMsg)
        sendResponse({ ok: false, error: errMsg })
      }
    }
  })()
  return true
})
