import type { DriftStorage, TodayLedger } from '../shared/types';
import { DEFAULT_DAILY_TARGET_MINUTES } from '../shared/constants';
import { todayString } from '../shared/utils';

function defaultTodayLedger(): TodayLedger {
  return {
    date: todayString(),
    checkingSpentMinutes: 0,
    investmentMinutes: 0,
    voidMinutes: 0,
    pendingMinutes: 0,
    pendingSegments: [],
  };
}

const DEFAULTS: DriftStorage = {
  onboardingComplete: false,
  dailyTargetMinutes: DEFAULT_DAILY_TARGET_MINUTES,
  openaiApiKey: undefined,
  domainClassifications: {},
  pendingDomains: [],
  activeSegment: null,
  today: defaultTodayLedger(),
  history: [],
  currentStreakDays: 0,
  bestStreakDays: 0,
  streakMultiplier: 1.0,
};

/** Read the full storage state, merging with defaults for any missing keys */
export async function getStorage(): Promise<DriftStorage> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const stored = items as Partial<DriftStorage>;
      const merged: DriftStorage = { ...DEFAULTS, ...stored };

      // Ensure today's ledger is for today
      if (!merged.today || merged.today.date !== todayString()) {
        merged.today = defaultTodayLedger();
      }

      resolve(merged);
    });
  });
}

/** Write a partial update to storage */
export async function setStorage(partial: Partial<DriftStorage>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(partial, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/** Read a single key from storage */
export async function getStorageKey<K extends keyof DriftStorage>(
  key: K,
): Promise<DriftStorage[K]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (items) => {
      const val = (items as Partial<DriftStorage>)[key];
      resolve(val !== undefined ? val : DEFAULTS[key]);
    });
  });
}

export { defaultTodayLedger };
