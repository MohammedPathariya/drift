import { INVESTMENT_HINT_DOMAINS, INVESTMENT_HINT_PATTERNS, VOID_HINT_DOMAINS } from './constants';
import type { Classification } from './types';

/** Format minutes as "Xh Ym" or "Ym" */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Get today's date string in 'YYYY-MM-DD' format */
export function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Extract the registrable domain from a URL string */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    // Return hostname (e.g. "www.github.com" → "www.github.com")
    return parsed.hostname;
  } catch {
    return null;
  }
}

/** Normalize domain for matching (strip www.) */
export function normalizeDomain(domain: string): string {
  return domain.replace(/^www\./, '');
}

/** Check if a domain matches a hint list */
export function getDomainHint(domain: string): Classification | null {
  const normalized = normalizeDomain(domain);

  for (const d of VOID_HINT_DOMAINS) {
    if (normalized === d || normalized.endsWith(`.${d}`)) return 'void';
  }

  for (const d of INVESTMENT_HINT_DOMAINS) {
    if (normalized === d || normalized.endsWith(`.${d}`)) return 'investment';
  }

  for (const pattern of INVESTMENT_HINT_PATTERNS) {
    if (normalized.startsWith(pattern)) return 'investment';
  }

  return null;
}

/** Calculate checking remaining percentage */
export function checkingRemainingPercent(
  checkingSpentMinutes: number,
  dailyTargetMinutes: number,
): number {
  if (dailyTargetMinutes <= 0) return 0;
  const remaining = dailyTargetMinutes - checkingSpentMinutes;
  return clamp((remaining / dailyTargetMinutes) * 100, 0, 100);
}

/** Get midnight timestamp for next reset */
export function nextMidnight(): Date {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight;
}
