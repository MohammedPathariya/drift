/**
 * ledger.ts — Segment classification routing and accounting.
 *
 * When a segment closes, its minutes are routed to the correct bucket:
 *   investment, void, or pending (unknown domain).
 * Pending segments are retroactively settled when the user classifies the domain.
 */

import { getStorage, setStorage } from './storage';
import type { ActiveSegment, DriftStorage, PendingSegment, Classification } from '../shared/types';
import { todayString } from '../shared/utils';

/** Close a segment and route its time to the appropriate bucket */
export async function closeSegment(
  segment: ActiveSegment,
  storage: DriftStorage,
): Promise<void> {
  const elapsedMinutes = (Date.now() - segment.startTime) / 60_000;

  // Ignore segments shorter than 3 seconds (accidental clicks, etc.)
  if (elapsedMinutes < 0.05) return;

  const today = { ...storage.today };

  if (segment.classification === 'investment') {
    today.investmentMinutes += elapsedMinutes;
    today.checkingSpentMinutes += elapsedMinutes;
  } else if (segment.classification === 'void') {
    today.voidMinutes += elapsedMinutes;
    today.checkingSpentMinutes += elapsedMinutes;
  } else {
    // pending or null — add to pending buffer
    today.pendingMinutes += elapsedMinutes;
    const pendingSegment: PendingSegment = {
      domain: segment.domain,
      minutes: elapsedMinutes,
      date: todayString(),
    };
    today.pendingSegments = [...today.pendingSegments, pendingSegment];
  }

  await setStorage({ today });
}

/**
 * Settle all pending segments for a domain once it's been classified.
 * Moves minutes from pending → investment or void buckets.
 */
export async function settlePendingForDomain(
  domain: string,
  classification: Classification,
): Promise<void> {
  const storage = await getStorage();
  const today = { ...storage.today };

  // Find all pending segments matching this domain (today only)
  const domainSegments = today.pendingSegments.filter(
    (s) => s.domain === domain && s.date === todayString(),
  );

  let totalMinutes = 0;
  for (const seg of domainSegments) {
    totalMinutes += seg.minutes;
  }

  if (totalMinutes > 0) {
    today.pendingMinutes = Math.max(0, today.pendingMinutes - totalMinutes);
    today.checkingSpentMinutes += totalMinutes;

    if (classification === 'investment') {
      today.investmentMinutes += totalMinutes;
    } else {
      today.voidMinutes += totalMinutes;
    }
  }

  // Remove settled segments from pending list
  today.pendingSegments = today.pendingSegments.filter(
    (s) => !(s.domain === domain && s.date === todayString()),
  );

  // Remove from pendingDomains list
  const pendingDomains = storage.pendingDomains.filter((d) => d !== domain);

  // Save classification to cache
  const domainClassifications = {
    ...storage.domainClassifications,
    [domain]: classification,
  };

  await setStorage({ today, pendingDomains, domainClassifications });

  // If there's an active segment on this domain, update its classification
  if (storage.activeSegment?.domain === domain) {
    const activeSegment = { ...storage.activeSegment, classification };
    await setStorage({ activeSegment });
  }
}

/**
 * Snapshot today's ledger into history and reset for a new day.
 * Called by midnight alarm.
 */
export async function performMidnightReset(): Promise<void> {
  const storage = await getStorage();
  const today = storage.today;

  // Only snapshot if there's meaningful data
  const hasData =
    today.investmentMinutes > 0 ||
    today.voidMinutes > 0 ||
    today.pendingMinutes > 0;

  if (hasData) {
    const record = {
      date: today.date,
      investmentMinutes: today.investmentMinutes,
      voidMinutes: today.voidMinutes,
      dailyTargetMinutes: storage.dailyTargetMinutes,
    };
    const history = [...storage.history, record];
    await setStorage({ history });
  }

  // Reset today's ledger
  const newToday = {
    date: todayString(),
    checkingSpentMinutes: 0,
    investmentMinutes: 0,
    voidMinutes: 0,
    pendingMinutes: 0,
    pendingSegments: [],
  };

  // Close any open segment cleanly
  await setStorage({ today: newToday, activeSegment: null });
}
