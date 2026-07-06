// Badge color thresholds (percentage of checking remaining)
export const BADGE_GREEN_THRESHOLD = 50;   // > 50% remaining → green
export const BADGE_YELLOW_THRESHOLD = 25;  // 25–50% remaining → yellow
                                            // < 25% remaining → red

export const BADGE_COLOR_GREEN = '#22c55e';
export const BADGE_COLOR_YELLOW = '#eab308';
export const BADGE_COLOR_RED = '#ef4444';

// Timing
export const OVERLAY_AUTO_DISMISS_SECONDS = 8;
export const BADGE_REFRESH_ALARM_MINUTES = 1; // every 1 minute

// Default settings
export const DEFAULT_DAILY_TARGET_MINUTES = 8 * 60; // 8 hours

// Domain hints for overlay pre-fill (NOT auto-classification)
export const INVESTMENT_HINT_DOMAINS: readonly string[] = [
  'github.com',
  'stackoverflow.com',
  'figma.com',
  'notion.so',
  'linear.app',
  'jira.atlassian.com',
  'confluence.atlassian.com',
  'codepen.io',
  'replit.com',
  'codesandbox.io',
];

export const INVESTMENT_HINT_PATTERNS: readonly string[] = [
  'docs.',
  'developer.',
  'learn.',
  'edu.',
  'course.',
];

export const VOID_HINT_DOMAINS: readonly string[] = [
  'youtube.com',
  'twitter.com',
  'x.com',
  'reddit.com',
  'netflix.com',
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'twitch.tv',
  'pinterest.com',
  'snapchat.com',
  'tumblr.com',
];

// OpenAI
export const OPENAI_MODEL = 'gpt-4o-mini';
export const OPENAI_CLASSIFY_PROMPT = `You are classifying browser domains for a productivity tracker.

Classify the given domain as either "investment" (productive, skill-building, creative work, communication) or "void" (entertainment, social media, passive consumption, time-wasting).

Respond with ONLY the single word: investment or void

Domain: `;
