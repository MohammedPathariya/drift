/**
 * tracker.ts — Tab/window focus tracking and segment management.
 *
 * Segments are time intervals on a single domain. When a segment ends,
 * its duration is handed to the ledger for accounting.
 */

import { getStorage, setStorage } from './storage';
import { extractDomain } from '../shared/utils';
import type { ActiveSegment } from '../shared/types';
import { closeSegment } from './ledger';
import { triggerClassification } from './classifier';

/** Called when the user navigates to a new tab or domain */
export async function handleTabChange(tabId: number | null): Promise<void> {
  const storage = await getStorage();

  // Close the current segment before opening a new one
  if (storage.activeSegment) {
    await closeSegment(storage.activeSegment, storage);
  }

  if (tabId === null) {
    // No active tab (e.g., window lost focus)
    await setStorage({ activeSegment: null });
    return;
  }

  // Get the URL of the newly active tab
  const tab = await getTab(tabId);
  if (!tab?.url) {
    await setStorage({ activeSegment: null });
    return;
  }

  const domain = extractDomain(tab.url);
  if (!domain) {
    await setStorage({ activeSegment: null });
    return;
  }

  // Re-read storage after closeSegment may have updated it
  const updatedStorage = await getStorage();
  const existingClassification = updatedStorage.domainClassifications[domain] ?? null;

  const newSegment: ActiveSegment = {
    domain,
    startTime: Date.now(),
    classification: existingClassification,
  };

  await setStorage({ activeSegment: newSegment });

  // If domain is unknown, trigger classification flow
  if (!existingClassification && !updatedStorage.pendingDomains.includes(domain)) {
    await triggerClassification(domain, tabId);
  }
}

/** Called when Chrome window focus changes */
export async function handleWindowFocusChanged(windowId: number): Promise<void> {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Chrome lost OS focus — pause tracking
    const storage = await getStorage();
    if (storage.activeSegment) {
      await closeSegment(storage.activeSegment, storage);
      await setStorage({ activeSegment: null });
    }
    return;
  }

  // Chrome regained focus — find the active tab in this window
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });
    if (activeTab?.id) {
      await handleTabChange(activeTab.id);
    }
  } catch {
    // Window may have closed
  }
}

/** Called on tab navigation completion (same tab, new URL) */
export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  if (changeInfo.status !== 'complete') return;
  if (!tab.active) return;

  await handleTabChange(tabId);
}

/** Called when a tab is activated (user switches tabs) */
export async function handleTabActivated(
  activeInfo: chrome.tabs.TabActiveInfo,
): Promise<void> {
  await handleTabChange(activeInfo.tabId);
}

/** Helper: get tab safely */
async function getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}
