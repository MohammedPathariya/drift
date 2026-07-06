/**
 * alarms.ts — Chrome alarm handlers for badge refresh and midnight reset.
 */

import { getStorage } from './storage';
import { checkingRemainingPercent, nextMidnight } from '../shared/utils';
import {
  BADGE_REFRESH_ALARM_MINUTES,
  BADGE_COLOR_GREEN,
  BADGE_COLOR_YELLOW,
  BADGE_COLOR_RED,
  BADGE_GREEN_THRESHOLD,
  BADGE_YELLOW_THRESHOLD,
} from '../shared/constants';
import { performMidnightReset } from './ledger';

export const ALARM_BADGE_REFRESH = 'badgeRefresh';
export const ALARM_MIDNIGHT_RESET = 'midnightReset';

/** Register all alarms (called on install and startup) */
export async function registerAlarms(): Promise<void> {
  // Badge refresh — every 1 minute
  await chrome.alarms.create(ALARM_BADGE_REFRESH, {
    delayInMinutes: BADGE_REFRESH_ALARM_MINUTES,
    periodInMinutes: BADGE_REFRESH_ALARM_MINUTES,
  });

  // Midnight reset — fire at next midnight, then every 24h
  const midnight = nextMidnight();
  const delayInMinutes = (midnight.getTime() - Date.now()) / 60_000;
  await chrome.alarms.create(ALARM_MIDNIGHT_RESET, {
    delayInMinutes,
    periodInMinutes: 24 * 60,
  });
}

/** Main alarm dispatcher — called from background/index.ts */
export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name === ALARM_BADGE_REFRESH) {
    await refreshBadge();
  } else if (alarm.name === ALARM_MIDNIGHT_RESET) {
    await performMidnightReset();
    await refreshBadge();
  }
}

/** Recalculate and update the extension badge */
export async function refreshBadge(): Promise<void> {
  const storage = await getStorage();

  // Calculate elapsed time in current segment (if active and classified)
  let extraMinutes = 0;
  if (storage.activeSegment && storage.activeSegment.classification !== null
    && storage.activeSegment.classification !== 'pending') {
    extraMinutes = (Date.now() - storage.activeSegment.startTime) / 60_000;
  }

  const totalSpent = storage.today.checkingSpentMinutes + extraMinutes;
  const percent = checkingRemainingPercent(totalSpent, storage.dailyTargetMinutes);

  const text = `${Math.round(percent)}%`;
  const color = getBadgeColor(percent);

  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

function getBadgeColor(percent: number): string {
  if (percent > BADGE_GREEN_THRESHOLD) return BADGE_COLOR_GREEN;
  if (percent > BADGE_YELLOW_THRESHOLD) return BADGE_COLOR_YELLOW;
  return BADGE_COLOR_RED;
}
