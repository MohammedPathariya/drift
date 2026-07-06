import { useEffect, useState } from 'react';
import type { DriftStorage } from '../shared/types';
import { checkingRemainingPercent, formatMinutes } from '../shared/utils';
import {
  BADGE_GREEN_THRESHOLD,
  BADGE_YELLOW_THRESHOLD,
  BADGE_COLOR_GREEN,
  BADGE_COLOR_YELLOW,
  BADGE_COLOR_RED,
} from '../shared/constants';

interface PopupState {
  loaded: boolean;
  onboardingComplete: boolean;
  dailyTargetMinutes: number;
  checkingSpentMinutes: number;
  investmentMinutes: number;
  voidMinutes: number;
  pendingMinutes: number;
  activeDomain: string | null;
  activeClassification: string | null;
  // Live elapsed in current segment (if classified)
  liveExtraMinutes: number;
}

export default function App() {
  const [state, setState] = useState<PopupState>({
    loaded: false,
    onboardingComplete: false,
    dailyTargetMinutes: 480,
    checkingSpentMinutes: 0,
    investmentMinutes: 0,
    voidMinutes: 0,
    pendingMinutes: 0,
    activeDomain: null,
    activeClassification: null,
    liveExtraMinutes: 0,
  });

  useEffect(() => {
    loadState();
    // Refresh live counter every 5 seconds
    const interval = setInterval(loadState, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadState() {
    const items = await chrome.storage.local.get(null) as Partial<DriftStorage>;

    if (!items.onboardingComplete) {
      setState((s) => ({ ...s, loaded: true, onboardingComplete: false }));
      return;
    }

    const seg = items.activeSegment ?? null;
    let liveExtra = 0;
    if (seg && seg.classification && seg.classification !== 'pending') {
      liveExtra = (Date.now() - seg.startTime) / 60_000;
    }

    setState({
      loaded: true,
      onboardingComplete: true,
      dailyTargetMinutes: items.dailyTargetMinutes ?? 480,
      checkingSpentMinutes: items.today?.checkingSpentMinutes ?? 0,
      investmentMinutes: items.today?.investmentMinutes ?? 0,
      voidMinutes: items.today?.voidMinutes ?? 0,
      pendingMinutes: items.today?.pendingMinutes ?? 0,
      activeDomain: seg?.domain ?? null,
      activeClassification: seg?.classification ?? null,
      liveExtraMinutes: liveExtra,
    });
  }

  if (!state.loaded) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (!state.onboardingComplete) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Drift</div>
        <p style={{ color: '#9999bb', fontSize: 13, padding: '16px 20px' }}>
          Complete setup to start tracking.
        </p>
        <button
          style={styles.actionBtn}
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') })}
        >
          Open Setup
        </button>
      </div>
    );
  }

  const totalSpent = state.checkingSpentMinutes + state.liveExtraMinutes;
  const remainPercent = checkingRemainingPercent(totalSpent, state.dailyTargetMinutes);
  const remainingMinutes = Math.max(0, state.dailyTargetMinutes - totalSpent);
  const percentColor = getPercentColor(remainPercent);

  const investPercent = state.dailyTargetMinutes > 0
    ? Math.min(100, (state.investmentMinutes / state.dailyTargetMinutes) * 100)
    : 0;
  const voidPercent = state.dailyTargetMinutes > 0
    ? Math.min(100, (state.voidMinutes / state.dailyTargetMinutes) * 100)
    : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span>Drift</span>
        <button
          style={styles.dashboardBtn}
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })}
          title="Open dashboard"
        >
          ↗
        </button>
      </div>

      {/* Checking account balance */}
      <div style={styles.balanceSection}>
        <div style={{ ...styles.balancePercent, color: percentColor }}>
          {Math.round(remainPercent)}%
        </div>
        <div style={styles.balanceLabel}>Checking remaining</div>
        <div style={styles.balanceSub}>{formatMinutes(remainingMinutes)} left of {formatMinutes(state.dailyTargetMinutes)}</div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressInvest,
            width: `${investPercent}%`,
          }}
          title={`Investment: ${formatMinutes(state.investmentMinutes)}`}
        />
        <div
          style={{
            ...styles.progressVoid,
            width: `${voidPercent}%`,
            left: `${investPercent}%`,
          }}
          title={`Void: ${formatMinutes(state.voidMinutes)}`}
        />
      </div>

      {/* Breakdown */}
      <div style={styles.breakdown}>
        <Stat label="Investment" value={formatMinutes(state.investmentMinutes)} color="#22c55e" />
        <Stat label="Void" value={formatMinutes(state.voidMinutes)} color="#ef4444" />
        {state.pendingMinutes > 0 && (
          <Stat label="Pending" value={formatMinutes(state.pendingMinutes)} color="#f59e0b" />
        )}
      </div>

      {/* Active segment */}
      {state.activeDomain && (
        <div style={styles.activeSegment}>
          <span style={styles.activeDot} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {state.activeDomain}
          </span>
          <span style={styles.activeTag}>
            {state.activeClassification === 'pending' || !state.activeClassification
              ? 'pending'
              : state.activeClassification}
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={styles.statItem}>
      <div style={{ ...styles.statDot, background: color }} />
      <span style={styles.statLabel}>{label}</span>
      <span style={{ ...styles.statValue, color }}>{value}</span>
    </div>
  );
}

function getPercentColor(percent: number): string {
  if (percent > BADGE_GREEN_THRESHOLD) return BADGE_COLOR_GREEN;
  if (percent > BADGE_YELLOW_THRESHOLD) return BADGE_COLOR_YELLOW;
  return BADGE_COLOR_RED;
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#0f0f1a',
    minHeight: 200,
  },

  loading: {
    padding: 20,
    color: '#666688',
    fontSize: 13,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px 0',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
    color: '#6366f1',
  },

  dashboardBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6366f1',
    cursor: 'pointer',
    fontSize: 16,
    padding: 0,
    lineHeight: 1,
  },

  balanceSection: {
    padding: '20px 16px 12px',
    textAlign: 'center' as const,
  },

  balancePercent: {
    fontSize: 52,
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums' as const,
  },

  balanceLabel: {
    fontSize: 11,
    color: '#555577',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    marginTop: 4,
  },

  balanceSub: {
    fontSize: 12,
    color: '#666688',
    marginTop: 6,
  },

  progressTrack: {
    height: 6,
    background: 'rgba(255,255,255,0.06)',
    position: 'relative' as const,
    margin: '0 16px 16px',
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressInvest: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    height: '100%',
    background: '#22c55e',
    borderRadius: 3,
    transition: 'width 0.5s',
  },

  progressVoid: {
    position: 'absolute' as const,
    top: 0,
    height: '100%',
    background: '#ef4444',
    borderRadius: 3,
    transition: 'width 0.5s, left 0.5s',
  },

  breakdown: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    padding: '0 16px 12px',
  },

  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
  },

  statDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },

  statLabel: {
    flex: 1,
    color: '#888899',
  },

  statValue: {
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
  },

  activeSegment: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    background: 'rgba(99, 102, 241, 0.08)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    fontSize: 12,
    color: '#888899',
    overflow: 'hidden',
  },

  activeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#6366f1',
    flexShrink: 0,
    animation: 'pulse 2s infinite',
  },

  activeTag: {
    fontSize: 10,
    padding: '2px 6px',
    background: 'rgba(99,102,241,0.15)',
    color: '#6366f1',
    borderRadius: 4,
    flexShrink: 0,
    textTransform: 'capitalize' as const,
  },

  actionBtn: {
    margin: '0 20px 20px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
