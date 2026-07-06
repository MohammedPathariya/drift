/**
 * background/index.ts — Service worker entry point.
 *
 * Wires all Chrome event listeners. MV3 service workers can terminate at any
 * time; all state lives in chrome.storage.local and is reconstructed on wake.
 */

import { registerAlarms, handleAlarm, refreshBadge } from './alarms';
import {
  handleTabActivated,
  handleTabUpdated,
  handleWindowFocusChanged,
  handleTabChange,
} from './tracker';
import { handleClassificationResponse } from './classifier';
import type { ClassificationResponseMessage, ExtensionMessage } from '../shared/types';

// ─── Install / Startup ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  await registerAlarms();
  await refreshBadge();

  if (details.reason === 'install') {
    // Open onboarding page on first install
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await registerAlarms();
  await restoreActiveTab();
  await refreshBadge();
});

// ─── Tab Events ──────────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(handleTabActivated);

chrome.tabs.onUpdated.addListener(handleTabUpdated);

chrome.tabs.onRemoved.addListener(async (tabId) => {
  // When a tab is closed, find the new active tab
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && activeTab.id !== tabId) {
      await handleTabChange(activeTab.id);
    } else {
      await handleTabChange(null);
    }
  } catch {
    await handleTabChange(null);
  }
});

// ─── Window Events ───────────────────────────────────────────────────────────

chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

// ─── Alarms ──────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(handleAlarm);

// ─── Messages from Content Scripts ──────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'CLASSIFICATION_RESPONSE') {
      const msg = message as ClassificationResponseMessage;
      handleClassificationResponse(msg.domain, msg.choice)
        .then(() => refreshBadge())
        .then(() => sendResponse({ ok: true }))
        .catch((err) => {
          console.error('[Drift] Classification response error:', err);
          sendResponse({ ok: false });
        });
      return true; // keep message channel open for async response
    }
    return false;
  },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** On SW wake, restore tracking from the currently active tab */
async function restoreActiveTab(): Promise<void> {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      await handleTabChange(activeTab.id);
    }
  } catch {
    // No active window
  }
}
