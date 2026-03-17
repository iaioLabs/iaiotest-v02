/**
 * Background Service Worker — iaio Test v2
 *
 * Screenshot flow:
 *  1. Mask sensitive fields in the tab (password, credit card, etc.)
 *  2. Capture the visible tab
 *  3. Unmask fields
 *  4. Return screenshot to content script
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreenshot') {
    const tabId = sender.tab?.id

    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID' })
      return true
    }

    ;(async () => {
      try {
        // 1. Mask sensitive fields before capture
        await chrome.tabs.sendMessage(tabId, { action: 'maskSensitiveFields' })

        // 2. Capture
        const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })

        // 3. Unmask immediately after
        await chrome.tabs.sendMessage(tabId, { action: 'unmaskSensitiveFields' })

        sendResponse({ success: true, screenshot: dataUrl })
      } catch (err) {
        // Unmask even if capture fails
        chrome.tabs.sendMessage(tabId, { action: 'unmaskSensitiveFields' }).catch(() => {})
        sendResponse({ success: false, error: (err as Error).message })
      }
    })()

    return true // Keep channel open for async response
  } else if (request.action === 'googleLogin') {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Failed to get auth token' });
        return;
      }

      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userInfo = await response.json();

        if (!userInfo.email) {
          sendResponse({ success: false, error: 'Could not retrieve user email' });
          return;
        }

        sendResponse({
          success: true,
          session: {
            email: userInfo.email,
            name: userInfo.name || userInfo.given_name || 'User',
            token: token
          }
        });
      } catch (err) {
        sendResponse({ success: false, error: err instanceof Error ? err.message : 'Failed to fetch user info' });
      }
    });
    return true;
  } else if (request.action === 'googleLogout') {
    if (request.token) {
      chrome.identity.removeCachedAuthToken({ token: request.token }, () => {
        sendResponse({ success: true });
      });
      return true;
    }
    sendResponse({ success: true });
    return false;
  }
})
