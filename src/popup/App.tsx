import { useEffect, useState } from 'react';
import type { DriftStorage } from '../shared/types';
import { checkingRemainingPercent, formatMinutes } from '../shared/utils';
import {
  BADGE_GREEN_THRESHOLD,
  BADGE_YELLOW_THRESHOLD,
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
  liveExtraMinutes: number;
}

// Aura colors keyed to checking balance
function getAuraColor(percent: number): string {
  if (percent > BADGE_GREEN_THRESHOLD) return 'rgba(34, 197, 94, 0.18)';
  if (percent > BADGE_YELLOW_THRESHOLD) return 'rgba(234, 179, 8, 0.18)';
  return 'rgba(239, 68, 68, 0.18)';
}

function getBalanceColor(percent: number): string {
  if (percent > BADGE_GREEN_THRESHOLD) return '#22c55e';
  if (percent > BADGE_YELLOW_THRESHOLD) return '#f59e0b';
  return '#ef4444';
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
    return (
      <div style={{ ...s.root, alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
        <div style={s.loadingDot} />
      </div>
    );
  }

  if (!state.onboardingComplete) {
    return (
      <div style={s.root}>
        <div style={{ padding: '28px 20px', textAlign: 'center' as const }}>
          <div style={s.wordmark}>Drift</div>
          <p style={{ color: '#6b6b8a', fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
            Set up your daily budget to begin.
          </p>
          <button
            style={{ ...s.pill, marginTop: 20, width: '100%' }}
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') })}
          >
            Open Setup →
          </button>
        </div>
      </div>
    );
  }

  const totalSpent = state.checkingSpentMinutes + state.liveExtraMinutes;
  const remainPercent = checkingRemainingPercent(totalSpent, state.dailyTargetMinutes);
  const remainingMinutes = Math.max(0, state.dailyTargetMinutes - totalSpent);
  const auraColor = getAuraColor(remainPercent);
  const balanceColor = getBalanceColor(remainPercent);

  const investPct = Math.min(100, (state.investmentMinutes / state.dailyTargetMinutes) * 100);
  const voidPct = Math.min(100, (state.voidMinutes / state.dailyTargetMinutes) * 100);

  const isActiveClassified =
    state.activeClassification &&
    state.activeClassification !== 'pending';

  return (
    <div style={s.root}>
      {/* Reactive aura */}
      <div
        style={{
          ...s.aura,
          background: `radial-gradient(ellipse 280px 160px at 50% -20px, ${auraColor}, transparent)`,
        }}
      />

      {/* Header */}
      <div style={s.header}>
        <span style={s.wordmark}>Drift</span>
        <button
          style={s.iconBtn}
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })}
          title="Open dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 12L12 2M12 2H6M12 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Main balance */}
      <div style={s.balanceSection}>
        <div style={{ ...s.balanceNumber, color: balanceColor }}>
          {Math.round(remainPercent)}
          <span style={s.balancePct}>%</span>
        </div>
        <div style={s.balanceLabel}>checking remaining</div>
        <div style={s.balanceSub}>{formatMinutes(remainingMinutes)} of {formatMinutes(state.dailyTargetMinutes)} left</div>
      </div>

      {/* Progress track */}
      <div style={s.track}>
        <div style={{ ...s.trackFill, width: `${investPct}%`, background: '#22c55e' }} />
        <div style={{ ...s.trackFill, width: `${voidPct}%`, left: `${investPct}%`, background: '#ef4444' }} />
      </div>

      {/* Glass cards row */}
      <div style={s.cardsRow}>
        <GlassCard
          label="Investment"
          value={formatMinutes(state.investmentMinutes)}
          color="#22c55e"
          pct={investPct}
        />
        <GlassCard
          label="Void"
          value={formatMinutes(state.voidMinutes)}
          color="#ef4444"
          pct={voidPct}
        />
        {state.pendingMinutes > 0.1 && (
          <GlassCard
            label="Pending"
            value={formatMinutes(state.pendingMinutes)}
            color="#f59e0b"
            pct={0}
            compact
          />
        )}
      </div>

      {/* Active segment */}
      {state.activeDomain && (
        <div style={s.activeBar}>
          <span style={{ ...s.activePulse, background: isActiveClassified ? balanceColor : '#f59e0b' }} />
          <span style={s.activeDomain}>{state.activeDomain}</span>
          <span style={{
            ...s.activeTag,
            color: isActiveClassified
              ? (state.activeClassification === 'investment' ? '#22c55e' : '#ef4444')
              : '#f59e0b',
          }}>
            {state.activeClassification === 'investment' ? 'invest'
              : state.activeClassification === 'void' ? 'void'
              : 'pending'}
          </span>
        </div>
      )}
    </div>
  );
}

function GlassCard({
  label,
  value,
  color,
  pct,
  compact = false,
}: {
  label: string;
  value: string;
  color: string;
  pct: number;
  compact?: boolean;
}) {
  return (
    <div style={{ ...s.card, flex: compact ? '0 0 auto' : 1 }}>
      {/* micro fill bar at bottom of card */}
      <div style={{ ...s.cardFill, width: `${pct}%`, background: `${color}40` }} />
      <div style={{ ...s.cardLabel, color: `${color}cc` }}>{label}</div>
      <div style={{ ...s.cardValue, color }}>{value}</div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#07090f',
    position: 'relative' as const,
    overflow: 'hidden',
    minHeight: 220,
  },

  aura: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    pointerEvents: 'none' as const,
    transition: 'background 1.5s ease',
    zIndex: 0,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 0',
    position: 'relative' as const,
    zIndex: 1,
  },

  wordmark: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.3)',
  },

  iconBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    width: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  balanceSection: {
    padding: '18px 16px 10px',
    textAlign: 'center' as const,
    position: 'relative' as const,
    zIndex: 1,
  },

  balanceNumber: {
    fontSize: 64,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums' as const,
    transition: 'color 1.5s ease',
  },

  balancePct: {
    fontSize: 28,
    fontWeight: 600,
    verticalAlign: 'super',
    marginLeft: 2,
  },

  balanceLabel: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 6,
  },

  balanceSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 4,
    fontVariantNumeric: 'tabular-nums' as const,
  },

  track: {
    height: 3,
    background: 'rgba(255,255,255,0.05)',
    margin: '8px 16px 12px',
    borderRadius: 2,
    position: 'relative' as const,
    overflow: 'hidden',
    zIndex: 1,
  },

  trackFill: {
    position: 'absolute' as const,
    top: 0,
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.6s ease',
  },

  cardsRow: {
    display: 'flex',
    gap: 8,
    padding: '0 12px 12px',
    position: 'relative' as const,
    zIndex: 1,
  },

  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '10px 12px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    position: 'relative' as const,
    overflow: 'hidden',
  },

  cardFill: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    height: '100%',
    borderRadius: 12,
    transition: 'width 0.6s ease',
  },

  cardLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    position: 'relative' as const,
    zIndex: 1,
  },

  cardValue: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 3,
    fontVariantNumeric: 'tabular-nums' as const,
    letterSpacing: '-0.01em',
    position: 'relative' as const,
    zIndex: 1,
  },

  activeBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.03)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    position: 'relative' as const,
    zIndex: 1,
  },

  activePulse: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 1s ease',
  },

  activeDomain: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontVariantNumeric: 'tabular-nums' as const,
  },

  activeTag: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    flexShrink: 0,
    transition: 'color 0.3s',
  },

  pill: {
    background: 'rgba(99,102,241,0.9)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
  },
} satisfies Record<string, React.CSSProperties>;
