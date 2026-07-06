# Drift

> Your browser time as a financial ledger.

Drift is a Chrome extension (Manifest V3) that converts browsing time into a financial metaphor. You set a daily time budget — your **Checking Account**. Time on productive sites earns into an **Investment Account**. Time on passive/entertainment sites drains the budget as **Void**. A live badge shows the remaining percentage at all times.

---

## The Mental Model

| Concept | Meaning |
|---|---|
| **Checking Account** | Your daily time budget (default: 8h). Depleted by all active browsing. |
| **Investment** | Time on productive sites — learning, building, creating. |
| **Void** | Time on passive/entertainment sites — social media, streaming, etc. |
| **Pending** | Time on unclassified sites — held until you classify them, then settled retroactively. |
| **Badge** | Shows `%` of checking remaining. Green (>50%) → Yellow (25–50%) → Red (<25%). |

---

## Features (V1)

- **Automatic classification** — OpenAI GPT-4o-mini classifies new domains on first visit (BYOK)
- **Manual classification fallback** — inline page overlay appears if no API key is set
- **Hint-based pre-fill** — overlay pre-selects a suggestion based on known domain patterns
- **Persistent classification cache** — each domain is classified once, remembered forever
- **Pending time buffer** — time on unknown sites is held and retroactively allocated on classification
- **Live badge** — updates every minute with current checking remaining %
- **Focus-aware tracking** — pauses when Chrome loses OS focus or no tab is active
- **Service worker resilience** — MV3 SW termination handled correctly via `chrome.storage.local` as source of truth
- **Midnight reset** — today's ledger snapshots to history at midnight, fresh budget begins
- **Popup** — real-time view of today's investment, void, and pending time
- **Dashboard** — full history table (chart visualizations in V3)
- **Onboarding** — guided setup for daily target and API key

---

## Architecture

```
drift/
├── src/
│   ├── background/
│   │   ├── index.ts        # Service worker — wires all Chrome event listeners
│   │   ├── tracker.ts      # Tab/window focus tracking, segment open/close
│   │   ├── classifier.ts   # OpenAI call + overlay dispatch + fallback logic
│   │   ├── ledger.ts       # Accounting: routes minutes to investment/void/pending
│   │   ├── storage.ts      # chrome.storage.local typed wrappers
│   │   └── alarms.ts       # Badge refresh (1 min) + midnight reset
│   ├── content/
│   │   └── overlay.ts      # Shadow DOM classification overlay (injected into all pages)
│   ├── popup/              # React — today's ledger summary
│   ├── dashboard/          # React — full history view (V3 charts scaffolded)
│   ├── onboarding/         # React — daily target + API key setup
│   └── shared/
│       ├── types.ts        # All TypeScript interfaces
│       ├── constants.ts    # Thresholds, domain hints, timing constants
│       └── utils.ts        # formatMinutes, extractDomain, checkingRemainingPercent, etc.
└── public/icons/           # Extension icons (16, 32, 48, 128px)
```

### Key architectural decisions

**`chrome.storage.local` is the only source of truth.** MV3 service workers terminate after ~30s of inactivity. Any in-memory state is lost. Every significant event writes to storage first; on SW wake, state is reconstructed from storage.

**`chrome.alarms` instead of `setInterval`.** Alarms survive SW termination. A `badgeRefresh` alarm fires every minute; a `midnightReset` alarm fires at midnight and every 24h after.

**Shadow DOM for the overlay.** The classification overlay is injected as a closed Shadow DOM tree to prevent CSS bleed from host pages. It works correctly on sites with aggressive global styles (Twitter, YouTube, etc.).

**Segments, not polling.** Time is tracked as open segments: `{ domain, startTime, classification }`. When a segment closes, elapsed minutes are routed to the appropriate bucket. The live balance is always `today.checkingSpentMinutes + (Date.now() - activeSegment.startTime)`.

---

## Storage Schema

```typescript
interface DriftStorage {
  onboardingComplete: boolean;
  dailyTargetMinutes: number;
  openaiApiKey?: string;

  domainClassifications: Record<string, 'investment' | 'void'>; // permanent cache
  pendingDomains: string[];

  activeSegment: {
    domain: string;
    startTime: number;
    classification: 'investment' | 'void' | 'pending' | null;
  } | null;

  today: {
    date: string;                  // 'YYYY-MM-DD'
    checkingSpentMinutes: number;
    investmentMinutes: number;
    voidMinutes: number;
    pendingMinutes: number;
    pendingSegments: PendingSegment[];
  };

  history: DailyRecord[];          // one entry per past day

  // V3 fields (initialized, not yet used)
  currentStreakDays: number;
  bestStreakDays: number;
  streakMultiplier: number;
}
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome (or any Chromium-based browser)
- Optional: OpenAI API key for automatic classification

### Install & Build

```bash
git clone https://github.com/YOUR_USERNAME/drift.git
cd drift
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `dist/` folder
4. Pin the Drift icon from the extensions toolbar

### Development (watch mode)

```bash
npm run dev
```

After each change, go to `chrome://extensions` and click the refresh icon on the Drift card. The popup and dashboard pages support HMR via CRXJS.

### Debugging

- **Service worker logs:** `chrome://extensions` → Drift → "service worker" link → DevTools console
- **Storage state:** In the service worker DevTools console:
  ```js
  chrome.storage.local.get(null, console.log)
  ```
- **Content script:** Open DevTools (F12) on any page → Console

---

## Roadmap

### V1 (current)
- [x] Tab/window focus tracking with segment-based accounting
- [x] OpenAI GPT-4o-mini automatic classification (BYOK)
- [x] Manual overlay fallback with hint pre-fill
- [x] Pending time buffer with retroactive settlement
- [x] Live badge (%, green/yellow/red)
- [x] Midnight reset with history snapshotting
- [x] Popup: today's ledger
- [x] Dashboard: history table
- [x] Onboarding: daily target + API key

### V2 (planned)
- [ ] Page-title classification for mixed-use domains (e.g. YouTube — tutorial vs. entertainment)
- [ ] Idle detection (`chrome.idle`) — pause on system idle
- [ ] Recovery Window — void time can be "recovered" within a time window

### V3 (planned)
- [ ] Streak multiplier — consecutive investment-heavy days multiply investment value
- [ ] Time Capital score — cross-day aggregate metric
- [ ] Dashboard charts (Recharts) — investment/void trend over time
- [ ] Weekly and monthly summaries

---

## Stack

| Layer | Technology |
|---|---|
| Build | Vite + CRXJS |
| UI | React 18 |
| Language | TypeScript (strict) |
| Extension | Chrome MV3 |
| AI | OpenAI GPT-4o-mini (BYOK) |
| Storage | `chrome.storage.local` |

---

## License

MIT
