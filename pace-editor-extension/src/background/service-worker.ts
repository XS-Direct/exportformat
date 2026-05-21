import type { ExtensionMessage } from '../shared/messages'

// Allow the toolbar icon to toggle the side panel on Pace tabs.
chrome.sidePanel
  ?.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.warn('[pace-editor] setPanelBehavior failed', err))

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
  // If the message came from the content script, it already knows the tab.
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
