import { useEffect, useState } from 'react';
import type { DriftStorage, DailyRecord } from '../shared/types';
import { formatMinutes, checkingRemainingPercent } from '../shared/utils';
import { BADGE_GREEN_THRESHOLD, BADGE_YELLOW_THRESHOLD } from '../shared/constants';

interface DashboardState {
  loaded: boolean;
  today: {
    investmentMinutes: number;
    voidMinutes: number;
    pendingMinutes: number;
    checkingSpentMinutes: number;
    dailyTargetMinutes: number;
  };
  history: DailyRecord[];
}

function getBalanceColor(percent: number): string {
  if (percent > BADGE_GREEN_THRESHOLD) return '#22c55e';
  if (percent > BADGE_YELLOW_THRESHOLD) return '#f59e0b';
  return '#ef4444';
}

export default function App() {
  const [state, setState] = useState<DashboardState>({
    loaded: false,
    today: {
      investmentMinutes: 0,
      voidMinutes: 0,
      pendingMinutes: 0,
      checkingSpentMinutes: 0,
      dailyTargetMinutes: 480,
    },
    history: [],
  });

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    const items = await chrome.storage.local.get(null) as Partial<DriftStorage>;
    setState({
      loaded: true,
      today: {
        investmentMinutes: items.today?.investmentMinutes ?? 0,
        voidMinutes: items.today?.voidMinutes ?? 0,
        pendingMinutes: items.today?.pendingMinutes ?? 0,
        checkingSpentMinutes: items.today?.checkingSpentMinutes ?? 0,
        dailyTargetMinutes: items.dailyTargetMinutes ?? 480,
      },
      history: items.history ?? [],
    });
  }

  if (!state.loaded) {
    return (
      <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  const { today } = state;
  const remainPercent = checkingRemainingPercent(today.checkingSpentMinutes, today.dailyTargetMinutes);
  const balanceColor = getBalanceColor(remainPercent);
  const investRatio = today.dailyTargetMinutes > 0
    ? (today.investmentMinutes / today.dailyTargetMinutes) * 100
    : 0;
  const voidRatio = today.dailyTargetMinutes > 0
    ? (today.voidMinutes / today.dailyTargetMinutes) * 100
    : 0;

  return (
    <div style={s.page}>
      {/* Aura */}
      <div style={s.aura} />

      <div style={s.inner}>
        {/* Header */}
        <header style={s.header}>
          <div>
            <div style={s.wordmark}>Drift</div>
            <div style={s.headerSub}>Daily Overview</div>
          </div>
          <div style={{ color: balanceColor, fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(remainPercent)}%
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', fontWeight: 500, marginLeft: 6 }}>
              remaining
            </span>
          </div>
        </header>

        {/* Today's progress bar */}
        <div style={s.mainTrack}>
          <div style={{ ...s.mainFill, width: `${investRatio}%`, background: '#22c55e' }} />
          <div style={{ ...s.mainFill, width: `${voidRatio}%`, left: `${investRatio}%`, background: '#ef4444' }} />
          {today.pendingMinutes > 0 && (
            <div style={{
              ...s.mainFill,
              width: `${Math.min(100, (today.pendingMinutes / today.dailyTargetMinutes) * 100)}%`,
              left: `${investRatio + voidRatio}%`,
              background: '#f59e0b',
            }} />
          )}
        </div>

        {/* Today stat cards */}
        <div style={s.cardsGrid}>
          <TodayCard
            label="Investment"
            value={formatMinutes(today.investmentMinutes)}
            sub={`${Math.round(investRatio)}% of budget`}
            color="#22c55e"
          />
          <TodayCard
            label="Void"
            value={formatMinutes(today.voidMinutes)}
            sub={`${Math.round(voidRatio)}% of budget`}
            color="#ef4444"
          />
          <TodayCard
            label="Budget"
            value={formatMinutes(today.dailyTargetMinutes)}
            sub={`${formatMinutes(Math.max(0, today.dailyTargetMinutes - today.checkingSpentMinutes))} left`}
            color="#6366f1"
          />
          {today.pendingMinutes > 0.1 && (
            <TodayCard
              label="Pending"
              value={formatMinutes(today.pendingMinutes)}
              sub="Awaiting classification"
              color="#f59e0b"
            />
          )}
        </div>

        {/* History */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <div style={s.sectionTitle}>History</div>
            <div style={s.sectionSub}>{state.history.length} days recorded</div>
          </div>

          {state.history.length === 0 ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2v8l4 4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="8.5" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
                </svg>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                Past days will appear here after midnight.
              </p>
            </div>
          ) : (
            <div style={s.historyList}>
              {[...state.history].reverse().map((record) => {
                const total = record.investmentMinutes + record.voidMinutes;
                const ratio = total > 0 ? (record.investmentMinutes / total) : 0;
                const iRatio = (record.investmentMinutes / record.dailyTargetMinutes) * 100;
                const vRatio = (record.voidMinutes / record.dailyTargetMinutes) * 100;

                return (
                  <div key={record.date} style={s.historyRow}>
                    <div style={s.historyDate}>{formatDate(record.date)}</div>

                    {/* Mini progress bar */}
                    <div style={s.miniTrack}>
                      <div style={{ ...s.miniFill, width: `${Math.min(100, iRatio)}%`, background: '#22c55e' }} />
                      <div style={{ ...s.miniFill, width: `${Math.min(100, vRatio)}%`, left: `${Math.min(100, iRatio)}%`, background: '#ef4444' }} />
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ color: '#22c55e', fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 36 }}>
                        {formatMinutes(record.investmentMinutes)}
                      </span>
                      <span style={{ color: '#ef4444', fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 36 }}>
                        {formatMinutes(record.voidMinutes)}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: ratio >= 0.5 ? '#22c55e' : '#ef4444',
                        background: ratio >= 0.5 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        minWidth: 52,
                        textAlign: 'center' as const,
                      }}>
                        {Math.round(ratio * 100)}% inv
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div style={s.v3Note}>Chart visualizations coming in V3.</div>
      </div>
    </div>
  );
}

function TodayCard({ label, value, sub, color }: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div style={{ ...s.card, borderColor: `${color}18` }}>
      <div style={{ ...s.cardLabel, color: `${color}99` }}>{label}</div>
      <div style={{ ...s.cardValue, color }}>{value}</div>
      <div style={s.cardSub}>{sub}</div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    background: '#07090f',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    overflowX: 'hidden' as const,
  },

  aura: {
    position: 'fixed' as const,
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 1000,
    height: 700,
    background: 'radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 65%)',
    pointerEvents: 'none' as const,
    zIndex: 0,
  },

  inner: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '40px 28px 60px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 32,
    position: 'relative' as const,
    zIndex: 1,
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },

  wordmark: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.25)',
  },

  headerSub: {
    fontSize: 22,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: '-0.02em',
    marginTop: 4,
  },

  mainTrack: {
    height: 6,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    position: 'relative' as const,
    overflow: 'hidden',
  },

  mainFill: {
    position: 'absolute' as const,
    top: 0,
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.6s ease',
  },

  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },

  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid',
    borderRadius: 14,
    padding: '18px 20px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },

  cardLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },

  cardValue: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    marginTop: 6,
    fontVariantNumeric: 'tabular-nums' as const,
  },

  cardSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 4,
  },

  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.25)',
  },

  sectionSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.15)',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
    padding: '40px 0',
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyList: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    overflow: 'hidden',
  },

  historyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '14px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },

  historyDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 500,
    minWidth: 96,
    flexShrink: 0,
  },

  miniTrack: {
    flex: 1,
    height: 4,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    position: 'relative' as const,
    overflow: 'hidden',
  },

  miniFill: {
    position: 'absolute' as const,
    top: 0,
    height: '100%',
    borderRadius: 2,
  },

  v3Note: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.1)',
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
} satisfies Record<string, React.CSSProperties>;
