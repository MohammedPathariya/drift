export type Classification = 'investment' | 'void';
export type SegmentClassification = Classification | 'pending' | null;

export interface PendingSegment {
  domain: string;
  minutes: number;
  date: string;
}

export interface DailyRecord {
  date: string;
  investmentMinutes: number;
  voidMinutes: number;
  dailyTargetMinutes: number;
  timeCapital?: number; // V3
}

export interface ActiveSegment {
  domain: string;
  startTime: number; // Date.now()
  classification: SegmentClassification;
}

export interface TodayLedger {
  date: string; // 'YYYY-MM-DD'
  checkingSpentMinutes: number; // void + investment (total active time used)
  investmentMinutes: number;
  voidMinutes: number;
  pendingMinutes: number;
  pendingSegments: PendingSegment[];
}

export interface DriftStorage {
  // Onboarding
  onboardingComplete: boolean;
  dailyTargetMinutes: number;
  openaiApiKey?: string;

  // Classification cache (persists forever — one-time per domain)
  domainClassifications: Record<string, Classification>;
  pendingDomains: string[]; // awaiting user response

  // Active tracking state (restored on service worker wake)
  activeSegment: ActiveSegment | null;

  // Today's ledger (reset at midnight)
  today: TodayLedger;

  // Historical records (V3 dashboard)
  history: DailyRecord[]; // one entry per past day

  // V3 fields (initialized empty in V1)
  currentStreakDays: number;
  bestStreakDays: number;
  streakMultiplier: number; // default 1.0
}

// Messages between background and content scripts
export interface ShowOverlayMessage {
  type: 'SHOW_OVERLAY';
  domain: string;
  aiGuess?: Classification;
}

export interface ClassificationResponseMessage {
  type: 'CLASSIFICATION_RESPONSE';
  domain: string;
  choice: Classification | 'dismissed';
}

export type ExtensionMessage = ShowOverlayMessage | ClassificationResponseMessage;
