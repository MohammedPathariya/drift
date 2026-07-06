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

function getAuraColor(percent: number): string {
  if (percent > BADGE_GREEN_THRESHOLD) return 'rgba(34,197,94,0.07)';
  if (percent > BADGE_YELLOW_THRESHOLD) return 'rgba(245,158,11,0.07)';
  return 'rgba(239,68,68,0.07)';
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// Arc SVG progress indicator
function ArcProgress({ percent, color, size = 180 }: { percent: number; color: string; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;
  const stroke = size * 0.06;
  // Arc starts at 7 o'clock (210°) and sweeps 300° clockwise to 5 o'clock
  const startAngle = 210;
  const sweep = 300;
  const endAngle = startAngle + sweep * (percent / 100);

  function polar(angle: number, radius: number) {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(from: number, to: number, radius: number) {
    const start = polar(from, radius);
    const end = polar(to, radius);
    const large = to - from > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {/* Track */}
      <path
        d={arcPath(startAngle, startAngle + sweep, r)}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {/* Progress */}
      {percent > 0 && (
        <path
          d={arcPath(startAngle, endAngle, r)}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
      )}
      {/* Glow dot at end of progress */}
      {percent > 2 && percent < 98 && (() => {
        const pt = polar(endAngle, r);
        return (
          <circle
            cx={pt.x}
            cy={pt.y}
            r={stroke * 0.65}
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        );
      })()}
    </svg>
  );
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
    const iv = setInterval(loadState, 10_000);
    return () => clearInterval(iv);
  }, []);

  async function loadState() {
    const items = await chrome.storage.local.get(null) as Partial<DriftStorage>;

    // Add live elapsed from active segment
    const seg = items.activeSegment ?? null;
    let liveExtra = 0;
    if (seg?.classification && seg.classification !== 'pending') {
      liveExtra = (Date.now() - seg.startTime) / 60_000;
    }

    setState({
      loaded: true,
      today: {
        investmentMinutes: items.today?.investmentMinutes ?? 0,
        voidMinutes: items.today?.voidMinutes ?? 0,
        pendingMinutes: items.today?.pendingMinutes ?? 0,
        checkingSpentMinutes: (items.today?.checkingSpentMinutes ?? 0) + liveExtra,
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
  const auraColor = getAuraColor(remainPercent);
  const remaining = Math.max(0, today.dailyTargetMinutes - today.checkingSpentMinutes);

  const investPct = today.dailyTargetMinutes > 0
    ? Math.min(100, (today.investmentMinutes / today.dailyTargetMinutes) * 100) : 0;
  const voidPct = today.dailyTargetMinutes > 0
    ? Math.min(100, (today.voidMinutes / today.dailyTargetMinutes) * 100) : 0;

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Weekly totals from history
  const recentHistory = [...state.history].reverse().slice(0, 7);
  const weekInvest = recentHistory.reduce((a, r) => a + r.investmentMinutes, 0);
  const weekVoid = recentHistory.reduce((a, r) => a + r.voidMinutes, 0);
  const weekTotal = weekInvest + weekVoid;
  const weekRatio = weekTotal > 0 ? (weekInvest / weekTotal) * 100 : 0;

  return (
    <div style={s.page}>
      {/* Reactive aura */}
      <div style={{
        ...s.aura,
        background: `radial-gradient(ellipse 900px 500px at 50% -100px, ${auraColor}, transparent)`,
      }} />

      <div style={s.inner}>

        {/* ── Header ── */}
        <header style={s.header}>
          <div>
            <div style={s.wordmark}>Drift</div>
            <div style={s.todayLabel}>{todayLabel}</div>
          </div>
          <div style={s.headerBadge}>
            <span style={{ ...s.headerPercent, color: balanceColor }}>
              {Math.round(remainPercent)}%
            </span>
            <span style={s.headerRemLabel}>checking left</span>
          </div>
        </header>

        {/* ── Today hero row ── */}
        <div style={s.heroRow}>
          {/* Arc indicator */}
          <div style={s.arcWrap}>
            <div style={s.arcInner}>
              <ArcProgress percent={remainPercent} color={balanceColor} size={200} />
              <div style={s.arcCenter}>
                <div style={{ ...s.arcPct, color: balanceColor }}>
                  {Math.round(remainPercent)}
                  <span style={{ fontSize: 22, fontWeight: 600 }}>%</span>
                </div>
                <div style={s.arcSub}>{formatMinutes(remaining)} left</div>
              </div>
            </div>
          </div>

          {/* Right stats */}
          <div style={s.heroStats}>
            <StatRow
              label="Investment"
              value={formatMinutes(today.investmentMinutes)}
              pct={investPct}
              color="#22c55e"
              budget={today.dailyTargetMinutes}
            />
            <div style={s.statDivider} />
            <StatRow
              label="Void"
              value={formatMinutes(today.voidMinutes)}
              pct={voidPct}
              color="#ef4444"
              budget={today.dailyTargetMinutes}
            />
            {today.pendingMinutes > 0.5 && (
              <>
                <div style={s.statDivider} />
                <StatRow
                  label="Pending"
                  value={formatMinutes(today.pendingMinutes)}
                  pct={Math.min(100, (today.pendingMinutes / today.dailyTargetMinutes) * 100)}
                  color="#f59e0b"
                  budget={today.dailyTargetMinutes}
                />
              </>
            )}

            {/* Daily total bar */}
            <div style={{ marginTop: 'auto', paddingTop: 20 }}>
              <div style={s.totalBarLabel}>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Today's split</span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
                  {formatMinutes(today.investmentMinutes + today.voidMinutes)} tracked
                </span>
              </div>
              <div style={s.totalBar}>
                <div style={{ ...s.totalFill, width: `${investPct}%`, background: '#22c55e' }} />
                <div style={{ ...s.totalFill, left: `${investPct}%`, width: `${voidPct}%`, background: '#ef4444' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── 7-day summary (if history exists) ── */}
        {recentHistory.length > 0 && (
          <div style={s.weekRow}>
            <WeekCard label="7-day Investment" value={formatMinutes(weekInvest)} color="#22c55e" />
            <WeekCard label="7-day Void" value={formatMinutes(weekVoid)} color="#ef4444" />
            <WeekCard
              label="Invest ratio"
              value={`${Math.round(weekRatio)}%`}
              color={weekRatio >= 50 ? '#22c55e' : '#ef4444'}
            />
          </div>
        )}

        {/* ── History ── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionTitle}>History</span>
            <span style={s.sectionSub}>{state.history.length} day{state.history.length !== 1 ? 's' : ''} recorded</span>
          </div>

          {state.history.length === 0 ? (
            <EmptyHistory />
          ) : (
            <div style={s.historyList}>
              {[...state.history].reverse().map((record, idx) => (
                <HistoryRow key={record.date} record={record} isLast={idx === state.history.length - 1} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function StatRow({ label, value, pct, color, budget }: {
  label: string; value: string; pct: number; color: string; budget: number;
}) {
  void budget;
  return (
    <div style={s.statRow}>
      <div style={s.statTop}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={s.statLabel}>{label}</span>
        </div>
        <span style={{ ...s.statValue, color }}>{value}</span>
      </div>
      <div style={s.statTrack}>
        <div style={{
          ...s.statFill,
          width: `${pct}%`,
          background: color,
          boxShadow: `0 0 8px ${color}50`,
        }} />
      </div>
    </div>
  );
}

function WeekCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={s.weekCard}>
      <div style={{ ...s.weekLabel, color: `${color}88` }}>{label}</div>
      <div style={{ ...s.weekValue, color }}>{value}</div>
    </div>
  );
}

function HistoryRow({ record, isLast }: { record: DailyRecord; isLast: boolean }) {
  const total = record.investmentMinutes + record.voidMinutes;
  const iRatio = record.dailyTargetMinutes > 0
    ? Math.min(100, (record.investmentMinutes / record.dailyTargetMinutes) * 100) : 0;
  const vRatio = record.dailyTargetMinutes > 0
    ? Math.min(100, (record.voidMinutes / record.dailyTargetMinutes) * 100) : 0;
  const investRatio = total > 0 ? (record.investmentMinutes / total) : 0;
  const isGood = investRatio >= 0.5;

  return (
    <div style={{ ...s.histRow, borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
      {/* Date */}
      <div style={s.histDate}>{formatDate(record.date)}</div>

      {/* Stacked bar */}
      <div style={s.histBarWrap}>
        <div style={s.histBar}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            height: '100%', width: `${iRatio}%`,
            background: '#22c55e', borderRadius: '3px 0 0 3px',
            transition: 'width 0.4s ease',
          }} />
          <div style={{
            position: 'absolute', top: 0, left: `${iRatio}%`,
            height: '100%', width: `${vRatio}%`,
            background: '#ef4444',
            borderRadius: iRatio === 0 ? '3px 0 0 3px' : '0',
            transition: 'width 0.4s ease, left 0.4s ease',
          }} />
        </div>
        <div style={s.histNums}>
          <span style={{ color: '#22c55e' }}>{formatMinutes(record.investmentMinutes)}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span style={{ color: '#ef4444' }}>{formatMinutes(record.voidMinutes)}</span>
        </div>
      </div>

      {/* Ratio badge */}
      <div style={{
        ...s.ratioBadge,
        color: isGood ? '#22c55e' : '#ef4444',
        background: isGood ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
        borderColor: isGood ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      }}>
        {Math.round(investRatio * 100)}%
      </div>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div style={s.emptyWrap}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="17" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
        <path d="M18 10v8l5 5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 13, textAlign: 'center' as const, lineHeight: 1.6 }}>
        Past days appear here after midnight.<br />
        Keep tracking to build your history.
      </p>
    </div>
  );
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
    top: 0, left: 0, right: 0,
    height: 600,
    pointerEvents: 'none' as const,
    zIndex: 0,
    transition: 'background 2s ease',
  },
  inner: {
    maxWidth: 820,
    margin: '0 auto',
    padding: '44px 32px 80px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 36,
    position: 'relative' as const,
    zIndex: 1,
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.25em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.2)',
  },
  todayLabel: {
    fontSize: 22,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: '-0.02em',
    marginTop: 6,
  },
  headerBadge: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: 2,
  },
  headerPercent: {
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums' as const,
    lineHeight: 1,
    transition: 'color 1.5s ease',
  },
  headerRemLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    fontWeight: 500,
  },

  // Hero row
  heroRow: {
    display: 'flex',
    gap: 32,
    alignItems: 'stretch',
  },
  arcWrap: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcInner: {
    position: 'relative' as const,
    width: 200,
    height: 200,
  },
  arcCenter: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  arcPct: {
    fontSize: 44,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums' as const,
    lineHeight: 1,
    transition: 'color 1.5s ease',
  },
  arcSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.22)',
    fontVariantNumeric: 'tabular-nums' as const,
  },

  // Right stats panel
  heroStats: {
    flex: 1,
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: '24px 24px 20px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 0,
  },
  statRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    padding: '14px 0',
  },
  statTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'capitalize' as const,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  statTrack: {
    height: 4,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  statFill: {
    position: 'absolute' as const,
    top: 0, left: 0,
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.6s ease',
  },
  statDivider: {
    height: '1px',
    background: 'rgba(255,255,255,0.05)',
  },
  totalBarLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalBar: {
    height: 5,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  totalFill: {
    position: 'absolute' as const,
    top: 0,
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.6s ease, left 0.6s ease',
  },

  // 7-day row
  weekRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  weekCard: {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: '16px 18px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  weekLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  weekValue: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums' as const,
  },

  // Section
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.2)',
  },
  sectionSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.12)',
  },

  // History
  historyList: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  histRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '14px 20px',
  },
  histDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 500,
    minWidth: 104,
    flexShrink: 0,
  },
  histBarWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  histBar: {
    height: 6,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  histNums: {
    display: 'flex',
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  ratioBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 5,
    border: '1px solid',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums' as const,
    minWidth: 42,
    textAlign: 'center' as const,
  },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 16,
    padding: '48px 0',
  },
} satisfies Record<string, React.CSSProperties>;
